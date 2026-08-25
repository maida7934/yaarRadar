"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, useMotionValue, useAnimationFrame } from "framer-motion";
import gsap from "gsap";
import { usePreloadImages } from "@/hooks/usePreloadImages";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useDistanceBearing } from "@/hooks/useDistanceBearing";
import { useCharacter } from "@/lib/characterState";
import { useAuth } from "@/lib/authState";
import { supabase } from "@/lib/supabaseClient";
import { getFriends, pushLocation, getLocations, type Friend } from "@/lib/api";
import { haversineDistance, initialBearing, type Coords } from "@/utils/geo";
import { ConnectionLine } from "./ConnectionLine";
import { TabBar } from "./TabBar";
import { SpriteCharacter } from "./SpriteCharacter";
import {
  CHARACTER_SPRITE_BUNDLES,
  DEFAULT_CHARACTER_ID,
  ALL_SPRITE_SRCS,
  type CharacterSpriteBundle,
  type DirectionalSpriteSet,
} from "./spriteSets";
import { NotchedFrame } from "@/components/ui/NotchedFrame";
import { HOW_TO_USE_TITLE } from "@/lib/howToUse";
import { HowToUseSteps } from "@/components/ui/HowToUseSteps";
import { avatarBackgroundPosition } from "@/lib/spriteAvatar";

// ── Game world ────────────────────────────────────────────────────────
// World coordinates are the background image's own native pixel grid --
// (0,0) is its top-left corner, (WORLD_WIDTH, WORLD_HEIGHT) its
// bottom-right. WORLD_SCALE_TARGET is purely a *rendering* multiplier (keeps the
// pixel art crisp/blocky at phone-screen size) and never enters the
// world-coordinate math itself, so distance/bearing stay scale-independent.
const WORLD_WIDTH = 1820;
const WORLD_HEIGHT = 1024;
// Preferred rendering zoom -- lower shows more of the world ("zoomed out").
// This is a target, not the value actually rendered at: see `worldScale` in
// the component, which raises it when a viewport is too tall for it. Sprite
// size doesn't come from here (SpriteCharacter has its own DISPLAY_SCALE),
// so tuning this zooms the world without resizing the characters.
const WORLD_SCALE_TARGET = 0.95;
// Each world-pixel is this many "meters" for the HUD readout -- tuned so
// the ~40m default gap between Me and the test friend spawn point (see
// SPAWN_SCREEN_OFFSET_* below) lands on the same "40m that way" example
// CLAUDE.md uses for a nearby friend.
const METERS_PER_WORLD_UNIT = 0.47;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// How long to wait between pushing a fresh GPS fix to the backend -- per
// CLAUDE.md, POST /locations should run on an interval, not on every single
// watchPosition event. Short enough that a friend's Realtime-pushed
// position doesn't go stale for long (the friend sprite only moves in
// response to a `friendCoords` update, which happens exactly this often).
const LOCATION_PUSH_INTERVAL_MS = 5000;

// Above this (meters), the status line calls out that "your" GPS accuracy
// is coarse rather than staying silent about it -- see useGeolocation's own
// (higher) threshold for what it actually accepts/prefers; this is purely
// about when it's worth telling the user their fix might be rough.
const NOTABLE_ACCURACY_METERS = 50;

// Beyond this real distance, the pair is too far apart for the "walking
// toward each other" radar visualization to mean anything -- the sprites
// stop moving and a message explains why, instead of quietly rendering
// them pinned near the saturated edge of the visible world regardless of
// whether they're 5km or 5000km apart.
const MAX_MEANINGFUL_DISTANCE_METERS = 1_500_000; // 1500km

// Per-frame ease-toward-target factor for both real-GPS-driven sprites.
// Deliberately slow (settles over ~3s, not ~1s) so each sprite is still
// visibly gliding toward its last-known target for most of the gap between
// LOCATION_PUSH_INTERVAL_MS updates, instead of snapping there almost
// instantly and then sitting frozen until the next update arrives -- that
// snap-then-freeze pattern is what reads as the sprite "getting stuck".
const REAL_FOLLOW_LERP = 0.02;

// Minimum real-world movement (meters) between two accepted GPS fixes
// before it counts as "this person actually moved" -- below this, treat
// them as stationary (idle pose, facing held) rather than flipping
// direction or animating a walk cycle off GPS jitter alone.
const MIN_MOVEMENT_METERS = 4;

// GET /locations and the Realtime subscription both return whatever's in
// the `locations` row regardless of whether that person currently has
// location sharing turned on -- a friend who shared once, then toggled it
// off (or just closed the app) still has a row sitting there from their
// last push. Without a freshness check, turning location on immediately
// treats that stale row as "the friend is right here right now", which is
// what caused the friend sprite to jump on top of "me" the instant
// location was enabled, before the friend had done anything. A row is only
// trusted as "currently live" while its `updated_at` is within this many
// ms -- comfortably more than LOCATION_PUSH_INTERVAL_MS so normal network/
// timer jitter doesn't false-positive as "gone stale", but tight enough to
// notice within a few push cycles once someone actually stops sharing.
const FRIEND_LOCATION_STALE_MS = LOCATION_PUSH_INTERVAL_MS * 3;

// Real GPS distance is unbounded (a friend could be 2m or 20km away), but
// the game world is a small fixed canvas -- this caps how far the friend
// sprite's world-space offset from "me" can grow, so a very distant friend
// reads as "far, near the edge of the visible world" instead of being
// placed off it (or clamped to WORLD_WIDTH/HEIGHT's raw edge) entirely.
// Near real-world distances stay ~linear at METERS_PER_WORLD_UNIT's usual
// scale (matches the dev-mode spawn gap); the curve only saturates once
// distance grows large enough to matter.
const REAL_LOCATION_MAX_WORLD_RADIUS = 480;

function distanceBearingToWorldOffset(distanceMeters: number, bearingDegrees: number) {
  const unitsPerMeter = 1 / METERS_PER_WORLD_UNIT;
  const linearRadius = distanceMeters * unitsPerMeter;
  const radius =
    REAL_LOCATION_MAX_WORLD_RADIUS * (1 - Math.exp(-linearRadius / REAL_LOCATION_MAX_WORLD_RADIUS));
  const rad = (bearingDegrees * Math.PI) / 180;
  // bearing 0 = north = "up" on screen = -Y, matching the existing
  // atan2(dx, -dy) convention the HUD/encounter code below already uses.
  return { dx: radius * Math.sin(rad), dy: -radius * Math.cos(rad) };
}

type Facing = "up" | "down" | "left" | "right" | "upleft" | "upright" | "downleft" | "downright";

// 8-way bucket a compass heading (degrees, 0 = north, clockwise -- same
// convention as initialBearing()) into a sprite facing, in the same
// up=north/-Y screen convention distanceBearingToWorldOffset uses. Real GPS
// heading is always a definite direction (never an ambiguous zero vector
// the way an on-screen offset can be near-zero), so this buckets directly
// off the angle rather than needing a magnitude deadzone.
const FACINGS_BY_OCTANT: Facing[] = ["up", "upright", "right", "downright", "down", "downleft", "left", "upleft"];
function headingDegreesToFacing(headingDegrees: number): Facing {
  const normalized = ((headingDegrees % 360) + 360) % 360;
  return FACINGS_BY_OCTANT[Math.round(normalized / 45) % 8];
}

export function FindScene() {
  usePreloadImages(ALL_SPRITE_SRCS);

  const keysRef = useRef<Record<string, boolean>>({});

  // World coordinates for both characters -- the only positions distance/
  // bearing are ever computed from. Me spawns near the world's center; the
  // friend spawns SPAWN_SCREEN_OFFSET_* *screen* pixels away at the current
  // WORLD_SCALE_TARGET (converted to world-units below) -- expressing the spawn
  // gap in screen pixels, not raw world-units, is what actually guarantees
  // both characters land on-screen together with a visible gap between
  // them, regardless of how WORLD_SCALE_TARGET gets tuned later. (A raw world-unit
  // offset picked without accounting for WORLD_SCALE_TARGET previously put the
  // friend most of a viewport-width off to the side -- clipped out of view
  // by the root's overflow-hidden, which is what read as "no distance
  // between them": only Me, plus a connecting line clipped down to a
  // barely-visible stub, was ever actually on screen.)
  const SPAWN_SCREEN_OFFSET_X = 70;
  const SPAWN_SCREEN_OFFSET_Y = -95;

  const meWorldX = useMotionValue(WORLD_WIDTH / 2);
  const meWorldY = useMotionValue(WORLD_HEIGHT / 2);

  const friendWorldX = useMotionValue(WORLD_WIDTH / 2 + SPAWN_SCREEN_OFFSET_X / WORLD_SCALE_TARGET);
  const friendWorldY = useMotionValue(WORLD_HEIGHT / 2 + SPAWN_SCREEN_OFFSET_Y / WORLD_SCALE_TARGET);

  // Screen coordinates for rendering -- percent of the game viewport, same
  // API SpriteCharacter/ConnectionLine already expect. Derived each frame
  // from world position relative to the camera (see useAnimationFrame
  // below), not set directly.
  const meScreenX = useMotionValue(50);
  const meScreenY = useMotionValue(50);
  const friendScreenX = useMotionValue(50);
  const friendScreenY = useMotionValue(50);

  // Game viewport's own measured pixel size (it's a flex-1 box, so its
  // actual size depends on layout/available space) -- needed to convert
  // world coordinates to screen percent and to clamp the camera so the
  // background never scrolls past its own edges.
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 360, height: 480 });
  // The zoom actually rendered at. WORLD_SCALE_TARGET is what we want (tuned
  // against a phone screen); the two viewport terms are a hard floor, never a
  // preference. The world layer is a fixed-size div -- WORLD_WIDTH/HEIGHT
  // multiplied by this -- so if it ever came out smaller than the viewport,
  // the page's own background would show through as bands past the art's
  // edge. A 1080px-tall desktop window needs ~1.055 just to stay covered,
  // which is why the target alone can't be used at every size. On phones both
  // floor terms sit well under the target, so they never bind and the target
  // is what's used.
  const worldScale = Math.max(
    WORLD_SCALE_TARGET,
    viewportSize.height / WORLD_HEIGHT,
    viewportSize.width / WORLD_WIDTH,
  );
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setViewportSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Background layer's screen-space translate (px, within the viewport) --
  // positions the (much larger than the viewport) world image so the
  // camera's current world point sits at the viewport's center.
  const bgTranslateX = useMotionValue(0);
  const bgTranslateY = useMotionValue(0);

  const scaleOne = useMotionValue(1);

  const [meState, setMeState] = useState<{ moving: boolean; facing: Facing }>({ moving: false, facing: "up" });
  const [friendState, setFriendState] = useState<{ moving: boolean; facing: Facing }>({ moving: false, facing: "down" });
  
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [distance, setDistance] = useState(0);
  const [bearing, setBearing] = useState(0);
  // Whether the two sprites are currently close enough on screen to
  // visually overlap -- Me renders above the friend while true, DOM order
  // decides as before otherwise. World-unit threshold, not meters: it's
  // sized to the sprites' own on-screen width (cellWidth 78 * SpriteCharacter's
  // DISPLAY_SCALE 1.4 = ~109 screen px, /WORLD_SCALE_TARGET = ~78 world units for
  // edge-to-edge; a bit less than that so it kicks in once they actually
  // start overlapping, not just as soon as they touch).
  const SPRITE_OVERLAP_WORLD_UNITS = 55;
  const [spritesOverlapping, setSpritesOverlapping] = useState(false);

  // ── Encounter animation state machine ────────────────────────────────
  // Phases: "none" → "facing" (face each other, 2s) → "settling" (slide
  // down + turn toward camera, 1.5s) → "victory" (show banner, wait for
  // dismiss). Movement is blocked during all non-"none" phases.
  type EncounterPhase = "none" | "facing" | "settling" | "victory";
  const [encounterPhase, setEncounterPhase] = useState<EncounterPhase>("none");
  const encounterPhaseRef = useRef<EncounterPhase>("none");
  const ENCOUNTER_SLIDE_WORLD_UNITS = 15; // how far down they slide during "settling"
  // Horizontal gap kept between the two sprites for the whole encounter --
  // the trigger fires at <= 2m apart, which at this world scale puts their
  // sprite art overlapping, so they're held apart around the trigger
  // midpoint instead of at their literal (too-close) snapshot spots.
  const ENCOUNTER_FACE_GAP_WORLD_UNITS = 100;
  // Snapshot of both world positions when the encounter fires, so the
  // settling slide starts from exactly where they stood when it triggered.
  const encounterSnapshot = useRef<{
    meX: number; meY: number; friendX: number; friendY: number;
    midX: number; midY: number; meFacesRight: boolean;
  } | null>(null);
  // Cooldown flag: don't re-trigger immediately after dismissing.
  const encounterCooldownRef = useRef(false);
  // Victory message fade-in
  const [victoryVisible, setVictoryVisible] = useState(false);
  // Mirrors encounterSnapshot.current.meFacesRight, which sprite selection
  // during render reads -- refs can't be read during render (their updates
  // don't trigger a re-render, so the displayed sprite could silently go
  // stale), so this is the render-safe copy; the ref itself still holds the
  // full snapshot for the effect-only code below (positions, tween restart).
  const [meFacesRightState, setMeFacesRightState] = useState(true);

  // GSAP-driven tween target -- a single plain object (not the Framer
  // motion values directly, gsap tweens plain numeric props) whose
  // onUpdate re-syncs meWorldX/Y, friendWorldX/Y, and the camera focus
  // every tick, so every position change during an encounter (spreading
  // apart to face each other, sliding down to settle) glides on an eased
  // curve instead of snapping instantly on each phase change.
  const encounterTween = useRef({ meX: 0, meY: 0, friendX: 0, friendY: 0, camX: 0, camY: 0 });
  // Where the camera is actually centered, each frame -- normally just
  // mirrors Me's position, but during an encounter this is what pans to
  // the pair's midpoint instead, and is what the *next* encounter's tween
  // starts from (so re-triggering mid-pan doesn't jump).
  const cameraFocus = useRef({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 });

  const startEncounter = useCallback(() => {
    if (encounterPhaseRef.current !== "none" || encounterCooldownRef.current) return;
    // Snapshot positions -- meFacesRight is which way each sprite needs to
    // turn to actually face the other, based on who's standing where when
    // the encounter fires (not assumed -- the friend could approach from
    // either side).
    const meFacesRight = friendWorldX.get() >= meWorldX.get();
    const snap = {
      meX: meWorldX.get(), meY: meWorldY.get(),
      friendX: friendWorldX.get(), friendY: friendWorldY.get(),
      midX: (meWorldX.get() + friendWorldX.get()) / 2,
      midY: (meWorldY.get() + friendWorldY.get()) / 2,
      meFacesRight,
    };
    encounterSnapshot.current = snap;
    setMeFacesRightState(meFacesRight);
    setVictoryVisible(false);
    encounterPhaseRef.current = "facing";
    setEncounterPhase("facing");
    // Stop both sprites' movement immediately, turned toward each other.
    setMeState({ moving: false, facing: meFacesRight ? "right" : "left" });
    setFriendState({ moving: false, facing: meFacesRight ? "left" : "right" });

    const halfGap = ENCOUNTER_FACE_GAP_WORLD_UNITS / 2;
    const meFacingX = snap.midX + (meFacesRight ? -halfGap : halfGap);
    const friendFacingX = snap.midX + (meFacesRight ? halfGap : -halfGap);

    // Glide both sprites apart into their facing spots and pan the camera
    // to the encounter's midpoint together, in one eased tween -- starting
    // from wherever they/the camera actually are right now.
    gsap.killTweensOf(encounterTween.current);
    encounterTween.current = {
      meX: snap.meX, meY: snap.meY,
      friendX: snap.friendX, friendY: snap.friendY,
      camX: cameraFocus.current.x, camY: cameraFocus.current.y,
    };
    gsap.to(encounterTween.current, {
      meX: meFacingX, meY: snap.meY,
      friendX: friendFacingX, friendY: snap.friendY,
      camX: snap.midX, camY: snap.midY,
      duration: 1.1,
      ease: "sine.inOut",
      onUpdate: () => {
        const v = encounterTween.current;
        meWorldX.set(v.meX);
        meWorldY.set(v.meY);
        friendWorldX.set(v.friendX);
        friendWorldY.set(v.friendY);
        cameraFocus.current.x = v.camX;
        cameraFocus.current.y = v.camY;
      },
    });

    // After 2s → settling
    setTimeout(() => {
      encounterPhaseRef.current = "settling";
      setEncounterPhase("settling");
      setMeState({ moving: false, facing: "down" });
      setFriendState({ moving: false, facing: "down" });

      // Slide down together, eased -- replaces the earlier phase's target
      // position with the settled one, still gliding rather than jumping.
      gsap.to(encounterTween.current, {
        meY: snap.meY + ENCOUNTER_SLIDE_WORLD_UNITS,
        friendY: snap.friendY + ENCOUNTER_SLIDE_WORLD_UNITS,
        camY: snap.midY + ENCOUNTER_SLIDE_WORLD_UNITS,
        duration: 1.4,
        ease: "power2.inOut",
        onUpdate: () => {
          const v = encounterTween.current;
          meWorldY.set(v.meY);
          friendWorldY.set(v.friendY);
          cameraFocus.current.y = v.camY;
        },
      });

      // After 1.5s → victory
      setTimeout(() => {
        encounterPhaseRef.current = "victory";
        setEncounterPhase("victory");
        // Small delay for the banner fade-in
        setTimeout(() => setVictoryVisible(true), 100);
      }, 1500);
    }, 2000);
  }, [meWorldX, meWorldY, friendWorldX, friendWorldY]);

  const dismissEncounter = useCallback(() => {
    gsap.killTweensOf(encounterTween.current);
    encounterPhaseRef.current = "none";
    setEncounterPhase("none");
    setVictoryVisible(false);
    encounterSnapshot.current = null;
    // Brief cooldown so walking away from 2m doesn't immediately re-trigger.
    encounterCooldownRef.current = true;
    setTimeout(() => { encounterCooldownRef.current = false; }, 3000);
  }, []);

  // Kill any in-flight encounter tween on unmount so its onUpdate doesn't
  // fire against motion values belonging to an already-torn-down scene.
  useEffect(() => {
    return () => { gsap.killTweensOf(encounterTween.current); };
  }, []);

  // Character selection
  const { characterId, loading: characterLoading } = useCharacter();
  const myCharacterBundle = CHARACTER_SPRITE_BUNDLES[characterId || DEFAULT_CHARACTER_ID] ?? CHARACTER_SPRITE_BUNDLES[DEFAULT_CHARACTER_ID];

  // Friend selection
  const { accessToken, user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [friendPickerOpen, setFriendPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [activeInfoPanel, setActiveInfoPanel] = useState<null | "howto" | "terms" | "privacy" | "notifications" | "about">(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [resetSending, setResetSending] = useState(false);

  const closeSettings = () => {
    setSettingsOpen(false);
    setChangingPassword(false);
    setActiveInfoPanel(null);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordSuccess(null);
  };

  const INFO_PANELS: Record<"howto" | "terms" | "privacy" | "notifications" | "about", { title: string; body: string[] }> = {
    // Same copy as the popup shown on app open -- both render
    // <HowToUseSteps/>, which reads lib/howToUse.ts, so they can't drift
    // apart. `body` is empty because this one panel isn't a list of plain
    // paragraphs: see the activeInfoPanel branch below.
    howto: {
      title: HOW_TO_USE_TITLE,
      body: [],
    },
    terms: {
      title: "TERMS AND CONDITIONS",
      body: [
        "By using YaarRadar, you agree to share your live location only with friends you've explicitly confirmed -- never publicly or with strangers.",
        "You're responsible for keeping your account credentials safe. Don't share your password with anyone.",
        "YaarRadar is provided as-is, without warranty of any kind. Location accuracy depends on your device's GPS and network conditions.",
      ],
    },
    privacy: {
      title: "PRIVACY POLICY",
      body: [
        "Your location is only visible to friends you've mutually confirmed -- never to the public or to friends you haven't accepted.",
        "We store your latest location only (no history) and overwrite it on every update.",
        "Unfriending someone immediately removes their access to your location, in both directions.",
      ],
    },
    notifications: {
      title: "NOTIFICATIONS",
      body: [
        "Notification preferences aren't configurable yet -- this is a placeholder for future settings like friend request alerts and proximity pings.",
        "Check back in a future update.",
      ],
    },
    about: {
      title: "ABOUT",
      body: [
        "YaarRadar shows you and a friend's straight-line distance and direction to each other in real time, as two characters walking toward one another.",
        "Not turn-by-turn navigation -- just \"they're 40m that way.\"",
      ],
    },
  };

  const submitPasswordChange = async () => {
    if (!user?.email) return;
    setPasswordError(null);
    setPasswordSuccess(null);
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation don't match.");
      return;
    }
    setPasswordSubmitting(true);
    try {
      // Supabase's updateUser doesn't check the current password itself, so
      // re-authenticate with it first to confirm it's actually correct.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });
      if (signInError) {
        setPasswordError("Old password is incorrect.");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setPasswordError(updateError.message);
        return;
      }
      setPasswordSuccess("Password updated.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordError("Something went wrong. Try again.");
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    setResetSending(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email);
      if (error) throw error;
      setPasswordSuccess(`Reset link sent to ${user.email}.`);
    } catch {
      setPasswordError("Could not send reset email. Try again.");
    } finally {
      setResetSending(false);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    getFriends(accessToken)
      .then((list) => {
        setFriends(list);
        setSelectedFriend((current) => current ?? list[0] ?? null);
      })
      .catch(() => {})
      .finally(() => setFriendsLoading(false));
  }, [accessToken]);

  const friendCharacterBundle =
    CHARACTER_SPRITE_BUNDLES[selectedFriend?.character_id ?? DEFAULT_CHARACTER_ID] ??
    CHARACTER_SPRITE_BUNDLES[DEFAULT_CHARACTER_ID];

  // ── Real location tracking ─────────────────────────────────────────────
  // Only watches/pushes/subscribes while the location toggle is on -- when
  // it's off, "friend" stays under WASD test control exactly as before, so
  // none of this touches the existing dev/test walk behavior.
  const { coords: myCoords, error: geoError, accuracy: myAccuracy } = useGeolocation(locationEnabled);
  const [friendCoords, setFriendCoords] = useState<Coords | null>(null);
  const [friendLocationError, setFriendLocationError] = useState<string | null>(null);
  // When the friend's location row was last actually updated (ms since
  // epoch, from the row's own `updated_at`) -- a ref because it needs to be
  // read every animation frame for freshness (see FRIEND_LOCATION_STALE_MS)
  // without waiting on a React re-render.
  const friendUpdatedAtRef = useRef<number | null>(null);
  // Render-visible mirror of "is the friend's row still fresh right now",
  // re-checked on a timer since staleness can newly become true purely from
  // time passing, with no new event to trigger a re-render on its own.
  const [friendStale, setFriendStale] = useState(false);
  // Whether both sprites have already jumped to their correct real-data
  // position once this "session" (since location was turned on, or since
  // the selected friend last changed) -- false again after either reset,
  // so re-enabling/switching snaps fresh instead of gliding from stale
  // leftover positions. See the snap-vs-ease branch in useAnimationFrame.
  const hasSnappedToRealRef = useRef(false);
  // Last real coords each person's heading-of-travel was measured from --
  // see the heading-of-travel effects below. Separate from the position
  // model (the shared-midpoint target above): this is purely about which
  // way each sprite should *face* while it steps, based on that person's
  // own actual movement, not their bearing relative to the other person.
  const meLastHeadingCoordsRef = useRef<Coords | null>(null);
  const friendLastHeadingCoordsRef = useRef<Coords | null>(null);

  // Push my own coords to the backend on an interval as they come in from
  // watchPosition -- not on every single fix, per CLAUDE.md.
  const lastPushRef = useRef(0);
  useEffect(() => {
    if (!locationEnabled || !accessToken || !myCoords) return;
    const now = Date.now();
    if (now - lastPushRef.current < LOCATION_PUSH_INTERVAL_MS) return;
    lastPushRef.current = now;
    pushLocation(accessToken, myCoords.latitude, myCoords.longitude).catch(() => {});
  }, [locationEnabled, accessToken, myCoords]);

  // Fetch the selected friend's last known location, then subscribe to
  // Supabase Realtime for live updates to just that friend's row -- the one
  // direct-Supabase piece per CLAUDE.md, RLS-scoped to rows we're allowed to
  // see (our own, or a confirmed friend's).
  useEffect(() => {
    queueMicrotask(() => {
      setFriendCoords(null);
      setFriendLocationError(null);
      setFriendStale(false);
    });
    friendUpdatedAtRef.current = null;
    hasSnappedToRealRef.current = false;
    meLastHeadingCoordsRef.current = null;
    friendLastHeadingCoordsRef.current = null;
    if (!locationEnabled || !accessToken || !selectedFriend) return;

    let cancelled = false;
    getLocations(accessToken, [selectedFriend.id])
      .then((rows) => {
        if (cancelled) return;
        const row = rows[0];
        if (row) {
          friendUpdatedAtRef.current = new Date(row.updated_at).getTime();
          setFriendCoords({ latitude: row.latitude, longitude: row.longitude });
          setFriendStale(Date.now() - friendUpdatedAtRef.current > FRIEND_LOCATION_STALE_MS);
        } else {
          setFriendLocationError(`${selectedFriend.username} hasn't shared their location yet.`);
        }
      })
      .catch(() => {
        if (!cancelled) setFriendLocationError("Could not load that friend's location.");
      });

    const channel = supabase
      .channel(`locations-${selectedFriend.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "locations", filter: `user_id=eq.${selectedFriend.id}` },
        (payload) => {
          const row = payload.new as { latitude?: number; longitude?: number; updated_at?: string } | null;
          if (row && typeof row.latitude === "number" && typeof row.longitude === "number") {
            friendUpdatedAtRef.current = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();
            setFriendCoords({ latitude: row.latitude, longitude: row.longitude });
            setFriendLocationError(null);
            // A push just landed, so this is definitionally fresh -- no
            // need to wait for the staleness-check interval below to say so.
            setFriendStale(false);
          }
        },
      )
      .subscribe();

    // Re-checks staleness purely from elapsed time, since a friend closing
    // the app or toggling location off doesn't itself produce any event --
    // the row just stops being updated, so this is what actually notices.
    const staleCheck = setInterval(() => {
      const updatedAt = friendUpdatedAtRef.current;
      setFriendStale(updatedAt === null || Date.now() - updatedAt > FRIEND_LOCATION_STALE_MS);
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(staleCheck);
      supabase.removeChannel(channel);
    };
  }, [locationEnabled, accessToken, selectedFriend]);

  // Real distance/bearing from actual coords -- fed dummy coords when either
  // side isn't ready yet, but `hasRealFix` gates all actual use of the
  // result so a stale/placeholder value never reaches the HUD or the scene.
  const realDistanceBearing = useDistanceBearing(
    myCoords ?? { latitude: 0, longitude: 0 },
    friendCoords ?? { latitude: 0, longitude: 0 },
  );
  // Requires the friend's location to be fresh, not just present -- see
  // FRIEND_LOCATION_STALE_MS -- so a friend who isn't currently sharing
  // doesn't get treated as "right here" off a leftover row from before.
  const hasRealFix = locationEnabled && Boolean(myCoords) && Boolean(friendCoords) && !friendStale;
  // A valid, fresh fix on both sides, but too far apart to visualize
  // meaningfully -- see MAX_MEANINGFUL_DISTANCE_METERS.
  const tooFarApart = hasRealFix && realDistanceBearing.distance > MAX_MEANINGFUL_DISTANCE_METERS;

  // ── Heading-of-travel (facing/walk-cycle) ────────────────────────────
  // Each sprite's facing direction and whether it's playing its walk cycle
  // come from that person's own real movement between consecutive accepted
  // GPS fixes -- a compass, not "which way to lean to reach the other
  // person". Below MIN_MOVEMENT_METERS since the last accepted point, treat
  // them as stationary (idle, facing held) rather than reacting to GPS
  // jitter. Runs off myCoords/friendCoords directly (not the animation
  // frame loop), so it fires exactly once per real update, independent of
  // how the position-lerp above is easing the sprite there visually.
  useEffect(() => {
    if (!locationEnabled || !myCoords || tooFarApart) return;
    const last = meLastHeadingCoordsRef.current;
    if (!last) {
      meLastHeadingCoordsRef.current = myCoords;
      return;
    }
    const movedMeters = haversineDistance(last, myCoords);
    if (movedMeters < MIN_MOVEMENT_METERS) {
      queueMicrotask(() => setMeState((prev) => (prev.moving ? { ...prev, moving: false } : prev)));
      return;
    }
    const heading = initialBearing(last, myCoords);
    meLastHeadingCoordsRef.current = myCoords;
    queueMicrotask(() => setMeState({ moving: true, facing: headingDegreesToFacing(heading) }));
  }, [locationEnabled, myCoords, tooFarApart]);

  useEffect(() => {
    if (!locationEnabled || !friendCoords || tooFarApart) return;
    const last = friendLastHeadingCoordsRef.current;
    if (!last) {
      friendLastHeadingCoordsRef.current = friendCoords;
      return;
    }
    const movedMeters = haversineDistance(last, friendCoords);
    if (movedMeters < MIN_MOVEMENT_METERS) {
      queueMicrotask(() => setFriendState((prev) => (prev.moving ? { ...prev, moving: false } : prev)));
      return;
    }
    const heading = initialBearing(last, friendCoords);
    friendLastHeadingCoordsRef.current = friendCoords;
    queueMicrotask(() => setFriendState({ moving: true, facing: headingDegreesToFacing(heading) }));
  }, [locationEnabled, friendCoords, tooFarApart]);

  // Whenever there's no trustworthy real fix on both sides (still waiting,
  // the friend's row just went stale, or location got turned off) -- or
  // there is one but they're too far apart to visualize -- hold both idle,
  // otherwise a walk cycle could keep animating in place with nothing
  // actually moving.
  useEffect(() => {
    if (hasRealFix && !tooFarApart) return;
    queueMicrotask(() => {
      setMeState((prev) => (prev.moving ? { ...prev, moving: false } : prev));
      setFriendState((prev) => (prev.moving ? { ...prev, moving: false } : prev));
    });
  }, [hasRealFix, tooFarApart]);

  useEffect(() => {
    function updateState() {
      const keys = keysRef.current;
      
      // Me (Arrow Keys)
      const rawUp = keys["ArrowUp"];
      const rawDown = keys["ArrowDown"];
      const rawLeft = keys["ArrowLeft"];
      const rawRight = keys["ArrowRight"];
      
      const up = rawUp && !rawDown;
      const down = rawDown && !rawUp;
      const left = rawLeft && !rawRight;
      const right = rawRight && !rawLeft;
      
      setMeState((prev) => {
        let nextFacing = prev.facing;
        if (up && left) nextFacing = "upleft";
        else if (up && right) nextFacing = "upright";
        else if (down && left) nextFacing = "downleft";
        else if (down && right) nextFacing = "downright";
        else if (up) nextFacing = "up";
        else if (down) nextFacing = "down";
        else if (left) nextFacing = "left";
        else if (right) nextFacing = "right";
        const nextMoving = Boolean(up || down || left || right);
        if (prev.moving === nextMoving && prev.facing === nextFacing) return prev;
        return { moving: nextMoving, facing: nextFacing };
      });
      
      // Friend (WASD)
      const rawW = keys["w"] || keys["W"];
      const rawS = keys["s"] || keys["S"];
      const rawA = keys["a"] || keys["A"];
      const rawD = keys["d"] || keys["D"];
      
      const w = rawW && !rawS;
      const s = rawS && !rawW;
      const a = rawA && !rawD;
      const d = rawD && !rawA;
      
      setFriendState((prev) => {
        let nextFacing = prev.facing;
        if (w && a) nextFacing = "upleft";
        else if (w && d) nextFacing = "upright";
        else if (s && a) nextFacing = "downleft";
        else if (s && d) nextFacing = "downright";
        else if (w) nextFacing = "up";
        else if (s) nextFacing = "down";
        else if (a) nextFacing = "left";
        else if (d) nextFacing = "right";
        const nextMoving = Boolean(w || s || a || d);
        if (prev.moving === nextMoving && prev.facing === nextFacing) return prev;
        return { moving: nextMoving, facing: nextFacing };
      });
    }

    function onKeyDown(e: KeyboardEvent) {
      if (keysRef.current[e.key]) return;
      keysRef.current[e.key] = true;
      updateState();
    }
    function onKeyUp(e: KeyboardEvent) {
      keysRef.current[e.key] = false;
      updateState();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useAnimationFrame((t, delta) => {
    const phase = encounterPhaseRef.current;
    const speed = 0.05 * delta;
    const keys = keysRef.current;

    // ── During encounter: positions are owned by the GSAP tween in
    // startEncounter (see encounterTween's onUpdate) -- just skip normal
    // player input, don't fight it by setting positions here too.
    if (phase === "none") {
      if (locationEnabled) {
        // ── Real-GPS movement ────────────────────────────────────────────
        // Both sprites walk toward a shared midpoint, closing the real
        // distance from both sides at once -- "two people ... shown as two
        // animated sprite characters walking toward each other", not one
        // fixed anchor with the other doing all the moving. Arrow keys/WASD
        // are disabled while this is active (see the `else` branch below)
        // so they can't fight it. Facing/walk-cycle state is handled
        // separately (see the heading-of-travel effects below) -- purely
        // each person's own real movement between fixes, not their
        // position relative to this target. Skipped entirely while too far
        // apart (see MAX_MEANINGFUL_DISTANCE_METERS) -- neither sprite
        // moves, and `hasSnappedToRealRef` deliberately stays false so
        // coming back into range snaps fresh instead of gliding from
        // wherever they were left.
        if (hasRealFix && !tooFarApart) {
          const half = distanceBearingToWorldOffset(realDistanceBearing.distance / 2, realDistanceBearing.bearing);
          const spawnX = WORLD_WIDTH / 2;
          const spawnY = WORLD_HEIGHT / 2;
          const meTargetX = clamp(spawnX - half.dx, 0, WORLD_WIDTH);
          const meTargetY = clamp(spawnY - half.dy, 0, WORLD_HEIGHT);
          const friendTargetX = clamp(spawnX + half.dx, 0, WORLD_WIDTH);
          const friendTargetY = clamp(spawnY + half.dy, 0, WORLD_HEIGHT);

          if (!hasSnappedToRealRef.current) {
            // First fix after enabling location (or switching friends):
            // jump straight there instead of easing from wherever the
            // sprites happened to be left (dev/test position, a previous
            // friend's spot, or the initial spawn point) -- that's what
            // read as the sprites sliding together/apart on toggle-on.
            // Only real subsequent movement should ever animate.
            meWorldX.set(meTargetX);
            meWorldY.set(meTargetY);
            friendWorldX.set(friendTargetX);
            friendWorldY.set(friendTargetY);
            hasSnappedToRealRef.current = true;
          } else {
            // Ease toward each target rather than snapping -- see
            // REAL_FOLLOW_LERP's comment for why this is deliberately slow.
            meWorldX.set(meWorldX.get() + (meTargetX - meWorldX.get()) * REAL_FOLLOW_LERP);
            meWorldY.set(meWorldY.get() + (meTargetY - meWorldY.get()) * REAL_FOLLOW_LERP);
            friendWorldX.set(friendWorldX.get() + (friendTargetX - friendWorldX.get()) * REAL_FOLLOW_LERP);
            friendWorldY.set(friendWorldY.get() + (friendTargetY - friendWorldY.get()) * REAL_FOLLOW_LERP);
          }
        }
      } else {
        // ── Dev/test movement (unchanged) ─────────────────────────────────
        // Move Me (arrow keys), clamped to the world's own bounds -- the
        // player can walk right up to the edge of the background image, but
        // never past it.
        let mx = 0; let my = 0;
        if (keys["ArrowUp"]) my -= speed;
        if (keys["ArrowDown"]) my += speed;
        if (keys["ArrowLeft"]) mx -= speed;
        if (keys["ArrowRight"]) mx += speed;
        if (mx !== 0 || my !== 0) {
          meWorldX.set(clamp(meWorldX.get() + mx, 0, WORLD_WIDTH));
          meWorldY.set(clamp(meWorldY.get() + my, 0, WORLD_HEIGHT));
        }

        // Friend (WASD test control) -- same world-bounds clamp.
        let fx = 0; let fy = 0;
        if (keys["w"] || keys["W"]) fy -= speed;
        if (keys["s"] || keys["S"]) fy += speed;
        if (keys["a"] || keys["A"]) fx -= speed;
        if (keys["d"] || keys["D"]) fx += speed;
        if (fx !== 0 || fy !== 0) {
          friendWorldX.set(clamp(friendWorldX.get() + fx, 0, WORLD_WIDTH));
          friendWorldY.set(clamp(friendWorldY.get() + fy, 0, WORLD_HEIGHT));
        }
      }
    }

    // Camera: in dev/test mode, follows Me alone (unchanged); in real-GPS
    // mode it follows the pair's midpoint instead -- both sprites now drift
    // from the world's center independently (see the real-GPS movement
    // branch above), so anchoring on "me" alone could push a distant friend
    // off-screen even though their own world-space offset is still capped.
    // Midpoint framing keeps each sprite within the same capped distance of
    // screen-center regardless. During an encounter, both are overridden by
    // cameraFocus, which the GSAP tween above pans to the pair's midpoint
    // (see startEncounter) -- either way it's clamped so the viewport
    // never shows past the background image's own edges (the world is
    // larger than the viewport, but not infinite).
    if (phase === "none") {
      if (locationEnabled) {
        cameraFocus.current.x = (meWorldX.get() + friendWorldX.get()) / 2;
        cameraFocus.current.y = (meWorldY.get() + friendWorldY.get()) / 2;
      } else {
        cameraFocus.current.x = meWorldX.get();
        cameraFocus.current.y = meWorldY.get();
      }
    }
    const halfViewWorldW = viewportSize.width / (2 * worldScale);
    const halfViewWorldH = viewportSize.height / (2 * worldScale);
    const camX = WORLD_WIDTH <= halfViewWorldW * 2
      ? WORLD_WIDTH / 2
      : clamp(cameraFocus.current.x, halfViewWorldW, WORLD_WIDTH - halfViewWorldW);
    const camY = WORLD_HEIGHT <= halfViewWorldH * 2
      ? WORLD_HEIGHT / 2
      : clamp(cameraFocus.current.y, halfViewWorldH, WORLD_HEIGHT - halfViewWorldH);
    // Keep cameraFocus synced to the camera's actual (post-clamp) position
    // while idle, so if an encounter starts, its pan tween begins from
    // exactly where the camera visually is right now -- not raw Me
    // coordinates, which can diverge from it near a world edge.
    if (phase === "none") {
      cameraFocus.current.x = camX;
      cameraFocus.current.y = camY;
    }

    // world -> camera -> screen: position the (oversized) background layer
    // so the camera's current world point lands at the viewport's center.
    bgTranslateX.set(viewportSize.width / 2 - camX * worldScale);
    bgTranslateY.set(viewportSize.height / 2 - camY * worldScale);

    // Both sprites use the exact same world->camera->screen conversion,
    // expressed as percent-of-viewport (SpriteCharacter/ConnectionLine's
    // existing coordinate space) -- Me isn't hardcoded to the center
    // anymore, it just lands there naturally whenever the camera isn't
    // clamped away from it.
    const toScreenPercent = (worldX: number, worldY: number) => ({
      x: viewportSize.width > 0 ? ((viewportSize.width / 2 + (worldX - camX) * worldScale) / viewportSize.width) * 100 : 50,
      y: viewportSize.height > 0 ? ((viewportSize.height / 2 + (worldY - camY) * worldScale) / viewportSize.height) * 100 : 50,
    });

    const mePos = toScreenPercent(meWorldX.get(), meWorldY.get());
    meScreenX.set(mePos.x);
    meScreenY.set(mePos.y);

    const friendPos = toScreenPercent(friendWorldX.get(), friendWorldY.get());
    friendScreenX.set(friendPos.x);
    friendScreenY.set(friendPos.y);

    // World positions still drive sprite-overlap stacking regardless of
    // mode -- purely visual (who renders on top), unrelated to which HUD
    // number is authoritative below.
    const dx = friendWorldX.get() - meWorldX.get();
    const dy = friendWorldY.get() - meWorldY.get();
    const worldDist = Math.sqrt(dx * dx + dy * dy);
    setSpritesOverlapping((prev) => {
      const next = worldDist < SPRITE_OVERLAP_WORLD_UNITS;
      return prev !== next ? next : prev;
    });

    // HUD distance/bearing + the "found each other" trigger: real GPS-
    // derived values once a fix on both sides exists, the existing WORLD-
    // position-derived values in dev/test mode (unchanged from before),
    // and -- deliberately -- neither while location is on but still
    // waiting for a fix, so a stale/placeholder number never shows.
    let dist: number | null = null;
    let brg: number | null = null;
    if (hasRealFix) {
      dist = realDistanceBearing.distance;
      brg = realDistanceBearing.bearing;
    } else if (!locationEnabled) {
      dist = worldDist * METERS_PER_WORLD_UNIT;
      brg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    }

    if (dist !== null && brg !== null) {
      const finalDist = dist;
      const finalBrg = brg;
      setDistance((prev) => Math.round(finalDist) !== Math.round(prev) ? finalDist : prev);
      setBearing((prev) => Math.round(finalBrg) !== Math.round(prev) ? finalBrg : prev);

      // ── Encounter trigger: ≤ 2 meters apart ──────────────────────────
      if (phase === "none" && finalDist <= 2) {
        startEncounter();
      }
    }
  });

  function getSpritesForFacing(bundle: CharacterSpriteBundle, facing: Facing): DirectionalSpriteSet {
    let sprites = bundle.towardCamera;
    if (facing === "up") sprites = bundle.you;
    else if (facing === "left") sprites = bundle.faceLeft;
    else if (facing === "right") sprites = bundle.faceRight;
    else if (facing === "upleft") sprites = { ...bundle.you, straight: bundle.you.left.settled };
    else if (facing === "upright") sprites = { ...bundle.you, straight: bundle.you.right.settled };
    else if (facing === "downleft") sprites = { ...bundle.towardCamera, straight: bundle.towardCamera.left.settled };
    else if (facing === "downright") sprites = { ...bundle.towardCamera, straight: bundle.towardCamera.right.settled };
    return sprites;
  }

  // During encounter phases, override sprite selection:
  //  "facing"   → turned toward each other, whichever side each one is
  //               actually standing on (see encounterSnapshot.meFacesRight)
  //  "settling"/"victory" → both face toward camera (down)
  const meFacesRight = meFacesRightState;
  const meSprites = encounterPhase === "facing"
    ? (meFacesRight ? myCharacterBundle.faceRight : myCharacterBundle.faceLeft)
    : (encounterPhase === "settling" || encounterPhase === "victory")
      ? myCharacterBundle.towardCamera
      : getSpritesForFacing(myCharacterBundle, meState.facing);

  const friendSprites = encounterPhase === "facing"
    ? (meFacesRight ? friendCharacterBundle.faceLeft : friendCharacterBundle.faceRight)
    : (encounterPhase === "settling" || encounterPhase === "victory")
      ? friendCharacterBundle.towardCamera
      : getSpritesForFacing(friendCharacterBundle, friendState.facing);

  const encounterActive = encounterPhase !== "none";

  return (
    <div ref={viewportRef} className="relative flex min-h-dvh w-full flex-col overflow-hidden">
      {/* World layer -- fills the *entire* screen (not just a boxed-off
          middle section), sitting behind every UI element (HUD, WELCOME,
          SELECT FRIEND, TabBar, ...), which all render on top of it at a
          higher z-index further down. The background image itself is
          never stretched (backgroundSize matches its own native aspect
          ratio, scaled by worldScale only), translated in screen space
          so the camera's current world point stays centered on screen. */}
      <motion.div
        className="absolute left-0 top-0 z-0"
        style={{
          width: WORLD_WIDTH * worldScale,
          height: WORLD_HEIGHT * worldScale,
          backgroundColor: "#3d5c33",
          backgroundImage: "url(/yaarRadar-assets/bg-wide.jpg)",
          backgroundSize: "auto 100%",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
          x: bgTranslateX,
          y: bgTranslateY,
        }}
        aria-hidden
      />

      {/* Sprite layer -- also full-screen, above the world background but
          below the UI, so the characters walk on the grass that's visibly
          behind/around the HUD rather than being clipped to a smaller box. */}
      <div className="absolute inset-0 z-[5] pointer-events-none">
        <ConnectionLine
          x1={meScreenX} y1={meScreenY}
          x2={friendScreenX} y2={friendScreenY}
        />

        {/* Wait out the character fetch before rendering -- otherwise, on a
            fresh load, this flashes the default character bundle first (the
            fallback while characterId is still resolving) and only swaps to
            the real picked character once GET /users/me resolves. Same fix
            as the friend sprite below, for the same reason. No accessToken
            (dev/testing) still renders immediately. */}
        {(!accessToken || !characterLoading) && (
          <SpriteCharacter
            sprites={meSprites}
            scale={scaleOne}
            lookSway={0}
            isMoving={encounterActive ? false : meState.moving}
            xPercent={meScreenX} yPercent={meScreenY}
            label={locationEnabled ? "Me" : "Me (Arrows)"}
            zIndex={spritesOverlapping ? 2 : undefined}
          />
        )}

        {/* Wait out the friends fetch before rendering the friend sprite --
            otherwise it flashes the default character bundle first, then
            swaps to the real selected friend's sprite once the request
            resolves. No accessToken (dev/testing, no real friend data
            incoming) still renders immediately, same as before. */}
        {(!accessToken || !friendsLoading) && (
          <SpriteCharacter
            sprites={friendSprites}
            scale={scaleOne}
            lookSway={0}
            isMoving={encounterActive ? false : friendState.moving}
            xPercent={friendScreenX} yPercent={friendScreenY}
            label={selectedFriend?.username ?? (locationEnabled ? "Friend" : "Friend (WASD)")}
          />
        )}

        {/* ── Victory banner — floats above both sprites during the
            encounter's "victory" phase ──────────────────────────────── */}
        {encounterPhase === "victory" && (
          <motion.div
            className="absolute z-30 flex flex-col items-center pointer-events-auto"
            style={{
              left: `${(meScreenX.get() + friendScreenX.get()) / 2}%`,
              top: `${Math.min(meScreenY.get(), friendScreenY.get()) - 20}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div
              className="flex flex-col items-center gap-2 px-6 py-3 relative"
              style={{
                opacity: victoryVisible ? 1 : 0,
                transform: victoryVisible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.8)",
                transition: "opacity 0.5s ease-out, transform 0.5s ease-out",
              }}
            >
              {/* Banner box */}
              <div className="relative px-5 py-2.5">
                <NotchedFrame colors={["#5C4528", "#F3E8DB", "#8EA971"]} step={4} ringWidth={3.5} />
                <span
                  className="relative z-10 font-bold tracking-widest whitespace-nowrap"
                  style={{
                    fontFamily: "var(--font-pixel)",
                    fontSize: 14,
                    color: "#2C421C",
                    textShadow: "1px 1px 0 rgba(255,255,255,0.6)",
                  }}
                >
                  ✦ FOUND EACH OTHER! ✦
                </span>
              </div>
              {/* Dismiss button */}
              <button
                type="button"
                onClick={dismissEncounter}
                className="relative px-4 py-1.5 mt-1"
                style={{ border: "none" }}
              >
                <NotchedFrame colors={["#8C6551", "#F3E8DB", "#fdf1e5"]} step={3} ringWidth={3} />
                <span
                  className="relative z-10 font-bold tracking-wide"
                  style={{
                    fontFamily: "var(--font-pixel)",
                    fontSize: 9,
                    color: "#5a4632",
                  }}
                >
                  CONTINUE
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </div>

      <div className="relative z-10 flex flex-1 w-full flex-col" style={{ paddingBottom: 76 }}>

        {/* ── Distance readout + heading + settings — distance box and
            welcome box top-align; settings icon vertically centered between
            the two; location toggle below the distance box. ─────────────── */}
        <div className="flex items-start gap-1.5 px-3 pt-3 mx-auto w-full max-w-3xl">
          {/* Left column: distance box + location toggle stacked */}
          <div className="flex flex-col gap-1.5 shrink-0">
            {/* Distance/bearing box -- provided pixel-art box asset */}
            <div
              className="flex flex-col items-center justify-center shrink-0"
              style={{
                width: 92,
                height: 92,
                backgroundImage: "url(/pixelated-icons/buttons/distance-box.png)",
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
                imageRendering: "pixelated",
              }}
            >
              <span style={{ fontFamily: "var(--font-pixel)", fontSize: 14, fontWeight: 700, color: "#5a4632", marginBottom: 1 }}>
                {Math.round(distance)}M
              </span>
              <div className="flex items-center gap-1 mt-0.5" style={{ color: "#5a4632" }}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{
                    transform: `rotate(${bearing}deg)`,
                    transition: "transform 0.2s linear"
                  }}
                >
                  <path d="M12 2L4 14h5v8h6v-8h5L12 2z" />
                </svg>
                <span style={{ fontFamily: "var(--font-pixel)", fontSize: 9 }}>
                  {Math.round(bearing)}&deg;
                </span>
              </div>
            </div>

            {/* Location toggle box -- provided pixel-art box asset */}
            <div
              className="relative flex items-center justify-center gap-2"
              style={{
                width: 104,
                height: 46,
                padding: "0 8px",
                backgroundImage: "url('/pixelated-icons/buttons/location-toggle-box.png')",
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
                imageRendering: "pixelated",
              }}
            >
              <span
                className="relative z-10"
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 8,
                  color: "#3f4a24",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                }}
              >
                Turn on<br />location
              </span>
              {/* Toggle switch */}
              <button
                type="button"
                aria-label="Toggle location"
                onClick={() => setLocationEnabled((v) => !v)}
                className="relative z-10 shrink-0"
                style={{
                  width: 26,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: locationEnabled ? "#8EA971" : "#b7b78f",
                  border: "1.5px solid #5d6b34",
                  padding: 0,
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: "#fdf1e5",
                    border: "1px solid #5d6b34",
                    transition: "transform 0.2s",
                    transform: locationEnabled ? "translateX(12px)" : "translateX(2px)",
                  }}
                />
              </button>
            </div>

            {/* Status line -- only appears while location is on and there's
                something worth telling the user (permission/GPS trouble,
                still waiting for a fix, the friend hasn't shared their
                location yet, or they're too far apart to show); silent
                once a real, in-range fix on both sides lands. */}
            {locationEnabled && (!hasRealFix || tooFarApart) && (
              <span
                className="text-center"
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 7,
                  lineHeight: 1.3,
                  color: geoError || friendLocationError ? "#a33" : "#5a4632",
                  maxWidth: 104,
                }}
              >
                {geoError ||
                  friendLocationError ||
                  (tooFarApart
                    ? `You and ${selectedFriend?.username ?? "your friend"} are ${Math.round(realDistanceBearing.distance / 1000).toLocaleString()}km apart -- too far to show.`
                    : !myCoords
                      ? "Locating you..."
                      : friendStale
                        ? `Waiting for ${selectedFriend?.username ?? "your friend"} to turn on location...`
                        : "Locating friend...")}
                {/* Surfaces a coarse fix rather than hiding it -- a desktop/
                    laptop browser (no GPS chip, WiFi/IP-based positioning)
                    routinely can't do better than this, so it's worth
                    knowing the shown position may be rough. */}
                {!tooFarApart && myCoords && myAccuracy !== null && myAccuracy > NOTABLE_ACCURACY_METERS && (
                  <>
                    <br />
                    {`(your GPS accuracy: ~${Math.round(myAccuracy)}m)`}
                  </>
                )}
              </span>
            )}
          </div>

          {/* Welcome box — vertically centered relative to the full left column height */}
          <div className="flex-1 min-w-0 flex items-center" style={{ height: 92, marginLeft: -8 }}>
            <div className="relative flex flex-col items-center justify-center w-full gap-0.5" style={{ height: 56 }}>
              <NotchedFrame colors={["#8C6551", "#F3E8DB", "#bfc08e"]} step={5} ringWidth={3.5} />
              <img src="/pixelated-icons/vines.jpg" alt="" className="relative z-10 w-3/4 h-2 object-cover opacity-80" style={{ mixBlendMode: "multiply", imageRendering: "pixelated" }} />
              <h1 className="relative z-10 font-bold tracking-wide whitespace-nowrap" style={{ color: "#5a4632", fontFamily: "var(--font-pixel)", fontSize: "clamp(9px, 3vw, 13px)" }}>
                WELCOME
              </h1>
              <img src="/pixelated-icons/vines.jpg" alt="" className="relative z-10 w-3/4 h-2 object-cover opacity-80 scale-y-[-1]" style={{ mixBlendMode: "multiply", imageRendering: "pixelated" }} />
            </div>
          </div>

          {/* Settings — vertically centered between the distance box and
              welcome box's combined vertical span */}
          <button
            type="button"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
            className="flex items-center justify-center shrink-0"
            style={{
              width: 44,
              height: 44,
              border: "none",
              marginTop: 24,
            }}
          >
            <img
              src="/pixelated-icons/buttons/settings-icon.png"
              alt=""
              className="w-full h-full"
              style={{ imageRendering: "pixelated" }}
            />
          </button>
        </div>

        {/* World shows through here -- this row is deliberately empty and
            transparent; the actual background/sprites are the full-screen
            layers above (z-0/z-[5]), behind this whole UI column. */}
        <div className="flex-1" />

        <div className="relative z-40 flex justify-center px-3 pb-3">
          <button
            type="button"
            onClick={() => setFriendPickerOpen(true)}
            className="relative flex items-center justify-center gap-2 shrink-0"
            style={{ height: 44, minWidth: 170, padding: "0 16px", border: "none" }}
          >
            <NotchedFrame colors={["#8C6551", "#F3E8DB", "#fdf1e5"]} step={5} ringWidth={3.5} />
            <span className="relative z-10 px-icon px-icon-friends" style={{ color: "#6B4731" }} aria-hidden></span>
            <span className="relative z-10" style={{ fontFamily: "var(--font-pixel)", fontSize: 10, color: "#6B4731" }}>
              {friendsLoading ? "LOADING..." : selectedFriend ? `SELECT FRIEND: ${selectedFriend.username}` : "NO FRIENDS YET"}
            </span>
          </button>
        </div>
      </div>

      <TabBar />

      {friendPickerOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setFriendPickerOpen(false)}
        >
          <div
            className="w-full max-w-sm relative overflow-hidden"
            style={{
              backgroundColor: "#EADBC8",
              borderStyle: "solid",
              borderWidth: 14,
              borderImageSource: "url(/pixelated-icons/buttons/popup-frame.png)",
              borderImageSlice: 55,
              borderImageRepeat: "stretch",
              imageRendering: "pixelated",
              borderRadius: 22,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-3 py-2 border-b-4 border-[#6B4731]"
              style={{ backgroundColor: "#6B4731" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 text-[#C2D6AD] text-lg leading-none select-none">✦</div>
                <h2 className="text-sm font-bold text-white tracking-widest">SELECT FRIEND</h2>
              </div>
              <button
                type="button"
                onClick={() => setFriendPickerOpen(false)}
                className="w-7 h-7 flex items-center justify-center border-[3px] border-[#6B4731] bg-[#EADBC8] rounded-md text-[#6B4731] font-bold select-none active:scale-95"
                style={{ fontFamily: "var(--font-pixel)" }}
              >
                X
              </button>
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              {friendsLoading ? (
                <div className="py-8 text-center text-[10px] text-[var(--px-text-dim)]">LOADING RADAR...</div>
              ) : friends.length === 0 ? (
                <div className="py-8 text-center text-[10px] text-[var(--px-text-dim)]">NO FRIENDS FOUND</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {friends.map((f) => {
                    const isSelected = selectedFriend?.id === f.id;
                    const bundle = CHARACTER_SPRITE_BUNDLES[f.character_id ?? DEFAULT_CHARACTER_ID] ?? CHARACTER_SPRITE_BUNDLES[DEFAULT_CHARACTER_ID];
                    return (
                      <button
                        key={f.id}
                        onClick={() => { setSelectedFriend(f); setFriendPickerOpen(false); }}
                        className="relative flex flex-col items-center gap-1.5 p-2 overflow-hidden"
                        style={{
                          backgroundColor: isSelected ? "#D5E4BB" : "transparent",
                          border: "none",
                          borderRadius: 10,
                        }}
                      >
                        <NotchedFrame colors={["#365224", "#8FA873", "#E1EDCB"]} step={4} ringWidth={2.5} />
                        <div
                          className="relative z-10 w-16 h-16 p-1 flex items-center justify-center mt-1"
                          style={{
                            backgroundColor: "var(--px-white)",
                            border: "2px solid #365224",
                            borderRadius: 6,
                          }}
                        >
                          <div
                            className="w-full h-full"
                            style={{
                              backgroundImage: `url('${bundle.towardCamera.straight.idleSrc}')`,
                              backgroundPosition: avatarBackgroundPosition(bundle.towardCamera.straight.idleSrc),
                              backgroundSize: "cover",
                              backgroundRepeat: "no-repeat",
                              imageRendering: "pixelated",
                            }}
                          />
                        </div>
                        <span className="relative z-10 text-[9px] font-bold uppercase" style={{ color: "#2C421C" }}>
                          {f.username}
                        </span>
                        {isSelected && <span className="relative z-10 text-[8px] font-bold" style={{ color: "#365224" }}>SELECTED</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Settings side drawer — slides in from the right, covering
          ~65% of the screen width (roughly "one and a half quarters"). ── */}
      {settingsOpen && (
        <div className="absolute inset-0 z-50 flex justify-end" onClick={closeSettings}>
          <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.55)" }} />
          <div
            className="relative h-full flex flex-col gap-3 p-4 overflow-y-auto"
            style={{ width: "65%", maxWidth: 340, backgroundColor: "#fdf1e5", borderLeft: "4px solid #8C6551" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {(changingPassword || activeInfoPanel) && (
                  <button
                    type="button"
                    onClick={() => { setChangingPassword(false); setActiveInfoPanel(null); setPasswordError(null); setPasswordSuccess(null); }}
                    aria-label="Back"
                    style={{ color: "#5a4632", fontFamily: "var(--font-pixel)", fontSize: 16, fontWeight: 700, border: "none", background: "none" }}
                  >
                    &lsaquo;
                  </button>
                )}
                <h2 style={{ fontFamily: "var(--font-pixel)", color: "#5a4632", fontSize: 16, fontWeight: 700 }}>
                  {changingPassword ? "CHANGE PASSWORD" : activeInfoPanel ? INFO_PANELS[activeInfoPanel].title : "SETTINGS"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeSettings}
                aria-label="Close settings"
                className="flex items-center justify-center"
                style={{
                  width: 30,
                  height: 30,
                  border: "2px solid #8C6551",
                  borderRadius: 6,
                  backgroundColor: "#bfc08e",
                  color: "#5a4632",
                  fontFamily: "var(--font-pixel)",
                  fontWeight: 700,
                }}
              >
                X
              </button>
            </div>

            {changingPassword ? (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span style={{ fontFamily: "var(--font-pixel)", fontSize: 9, color: "#6B4731" }}>OLD PASSWORD</span>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="login-input"
                    style={{ fontFamily: "var(--font-pixel)", fontSize: 11, padding: "8px 10px" }}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span style={{ fontFamily: "var(--font-pixel)", fontSize: 9, color: "#6B4731" }}>NEW PASSWORD</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="login-input"
                    style={{ fontFamily: "var(--font-pixel)", fontSize: 11, padding: "8px 10px" }}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span style={{ fontFamily: "var(--font-pixel)", fontSize: 9, color: "#6B4731" }}>CONFIRM NEW PASSWORD</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="login-input"
                    style={{ fontFamily: "var(--font-pixel)", fontSize: 11, padding: "8px 10px" }}
                  />
                </label>

                <button
                  type="button"
                  onClick={sendPasswordReset}
                  disabled={resetSending}
                  className="text-left"
                  style={{ fontFamily: "var(--font-pixel)", fontSize: 9, color: "#8C6551", border: "none", background: "none", textDecoration: "underline", opacity: resetSending ? 0.5 : 1 }}
                >
                  {resetSending ? "Sending..." : "Forgotten password?"}
                </button>

                {passwordError && (
                  <p style={{ fontFamily: "var(--font-pixel)", fontSize: 9, color: "#a33" }}>{passwordError}</p>
                )}
                {passwordSuccess && (
                  <p style={{ fontFamily: "var(--font-pixel)", fontSize: 9, color: "#365224" }}>{passwordSuccess}</p>
                )}

                <button
                  type="button"
                  onClick={submitPasswordChange}
                  disabled={passwordSubmitting}
                  style={{
                    marginTop: 4,
                    padding: "10px 14px",
                    backgroundColor: "#bfc08e",
                    border: "3px solid #8C6551",
                    borderRadius: 10,
                    fontFamily: "var(--font-pixel)",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#5a4632",
                    opacity: passwordSubmitting ? 0.6 : 1,
                  }}
                >
                  {passwordSubmitting ? "..." : "DONE"}
                </button>
              </div>
            ) : activeInfoPanel === "howto" ? (
              <HowToUseSteps />
            ) : activeInfoPanel ? (
              <div className="flex flex-col gap-3">
                {INFO_PANELS[activeInfoPanel].body.map((paragraph, i) => (
                  <p key={i} style={{ fontFamily: "var(--font-pixel)", fontSize: 10, lineHeight: 1.6, color: "#5a4632" }}>
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : (
              <>
                {(
                  [
                    { label: "HOW TO USE", key: "howto" },
                    { label: "CHANGE PASSWORD", key: null },
                    { label: "TERMS AND CONDITIONS", key: "terms" },
                    { label: "PRIVACY POLICY", key: "privacy" },
                    { label: "NOTIFICATIONS", key: "notifications" },
                    { label: "ABOUT", key: "about" },
                  ] as const
                ).map(({ label, key }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => { if (label === "CHANGE PASSWORD") setChangingPassword(true); else if (key) setActiveInfoPanel(key); }}
                    className="w-full flex items-center justify-between text-left"
                    style={{
                      padding: "12px 14px",
                      backgroundColor: "#f3e8db",
                      border: "2px solid #8C6551",
                      borderRadius: 10,
                      fontFamily: "var(--font-pixel)",
                      fontSize: 11,
                      color: "#5a4632",
                      fontWeight: 700,
                    }}
                  >
                    {label}
                    <span>&rsaquo;</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
