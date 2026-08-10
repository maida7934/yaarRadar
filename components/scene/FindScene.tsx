"use client";

import { useEffect, useState } from "react";
import { useMotionValue, animate, motion } from "framer-motion";
import { useFindDemo, SCENE_ORIGIN } from "@/hooks/useFindDemo";
import { useDistanceBearing } from "@/hooks/useDistanceBearing";
import { useScreenPosition } from "@/hooks/useScreenPosition";
import { usePreloadImages } from "@/hooks/usePreloadImages";
import { hasArrived, distanceToCloseness } from "@/utils/distanceToPosition";
import { bearingToSway } from "@/utils/bearingToSway";
import { PixelModal } from "@/components/ui/PixelModal";
import { avatarBackgroundPosition } from "@/lib/spriteAvatar";
import { characterAvatarSrc } from "@/lib/characterAvatars";
import { useCharacter } from "@/lib/characterState";
import { useAuth } from "@/lib/authState";
import { getFriends, type Friend } from "@/lib/api";
import { ConnectionLine } from "./ConnectionLine";
import { ScrollingBackground } from "./ScrollingBackground";
import { TabBar } from "./TabBar";
import { GROUND_TILE } from "./backgroundTiles";
import { SpriteCharacter } from "./SpriteCharacter";
import { CHARACTER_SPRITE_BUNDLES, DEFAULT_CHARACTER_ID, ALL_SPRITE_SRCS } from "./spriteSets";

// Both people walk toward this shared screen point from opposite edges --
// "you" from the bottom, "friend" from the top -- rather than one being a
// fixed anchor the other approaches.
const CENTER_X_PERCENT = 50;
const MEET_Y_PERCENT = 50;
const BOTTOM_Y_PERCENT = 85;
const TOP_Y_PERCENT = 15;

// The two don't converge all the way to MEET_Y_PERCENT -- closeness 0 (fully
// arrived) still leaves this much vertical gap between them, split evenly
// around the meet point, so they end up standing near each other rather than
// fully overlapping at the same point.  Made large enough that even at the
// constant sprite scale the two never visually overlap.
const ARRIVED_GAP_PERCENT = 14;
const ME_STOP_Y_PERCENT = MEET_Y_PERCENT + ARRIVED_GAP_PERCENT / 2;
const FRIEND_STOP_Y_PERCENT = MEET_Y_PERCENT - ARRIVED_GAP_PERCENT / 2;

// --- Arrival phase positions ---

// Phase 2 (face each other): both slide to the same Y, offset horizontally
// so "You" (right-facing) is on the left and "Friend" (left-facing) on the
// right -- reads as two people turning to face each other.
const FACE_EACH_OTHER_OFFSET_X = 10;
const FACE_EACH_OTHER_Y = MEET_Y_PERCENT;

// Phase 3 (face screen side-by-side): same horizontal layout but with more
// generous spacing so the two are clearly separate, and they slide downwards a bit.
const SIDE_BY_SIDE_OFFSET_X = 12;
const SIDE_BY_SIDE_Y = MEET_Y_PERCENT + 12;

// --- Arrival phase timing ---
// Phase 1 → 2: how long after arriving before turning to face each other.
const FACE_EACH_OTHER_DELAY_MS = 500;
// Phase 2 → 3: how long they hold the face-each-other beat.
const FACE_SCREEN_DELAY_MS = 1200;

function meClosenessToY(t: number) {
  return ME_STOP_Y_PERCENT + t * (BOTTOM_Y_PERCENT - ME_STOP_Y_PERCENT);
}
function friendClosenessToY(t: number) {
  return FRIEND_STOP_Y_PERCENT - t * (FRIEND_STOP_Y_PERCENT - TOP_Y_PERCENT);
}

/** Where a character would be if position followed the raw distance/bearing
 * exactly, with no spring smoothing -- used only to compute which way to
 * *look*, not for the actual (smoothed) screen position. See below for why. */
function targetXY(distanceMeters: number, bearingDegrees: number, closenessToY: (t: number) => number) {
  const closeness = distanceToCloseness(distanceMeters);
  return { x: CENTER_X_PERCENT + bearingToSway(bearingDegrees), y: closenessToY(closeness) };
}

// Arrival phases, in order:
//   "walking"        – sprites are on their walking path, normal look-sway
//   "faceEachOther"  – You faces right, Friend faces left, side-by-side
//   "faceScreen"     – both face the camera, standing side-by-side
type ArrivalPhase = "walking" | "faceEachOther" | "faceScreen";

export function FindScene() {
  usePreloadImages(ALL_SPRITE_SRCS);

  const { me, friend, playing, toggleWalking } = useFindDemo();
  const { distance, bearing } = useDistanceBearing(me, friend);
  const arrived = hasArrived(distance);

  // Whichever character was picked in the Me page's "Change Layout" ->
  // Character option -- persisted via the backend, so this is the same
  // choice everywhere, not just on this page (see lib/characterState.tsx).
  const { characterId } = useCharacter();
  const myCharacterSprites = CHARACTER_SPRITE_BUNDLES[characterId] ?? CHARACTER_SPRITE_BUNDLES[DEFAULT_CHARACTER_ID];

  // Who "Friend" represents in this walk -- picked via the "Select Friend"
  // popup below, from your real GET /friends list. Only the on-screen
  // name/avatar/sprite reflect the choice -- the walk itself is still
  // driven by the mock distance/bearing simulation (no real per-friend
  // location data yet).
  const { accessToken } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [friendPickerOpen, setFriendPickerOpen] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    getFriends(accessToken)
      .then((list) => {
        setFriends(list);
        setSelectedFriend((current) => current ?? list[0] ?? null);
      })
      .catch(() => {
        // Leave friends empty -- the picker just shows "no friends yet".
      })
      .finally(() => setFriendsLoading(false));
  }, [accessToken]);

  const friendCharacterSprites =
    CHARACTER_SPRITE_BUNDLES[selectedFriend?.character_id ?? DEFAULT_CHARACTER_ID] ??
    CHARACTER_SPRITE_BUNDLES[DEFAULT_CHARACTER_ID];
  const friendLabel = selectedFriend?.username ?? "Friend";

  // 3-phase arrival state machine.  Resets to "walking" whenever `arrived`
  // goes false (e.g. "Walk again").
  const [arrivalPhase, setArrivalPhase] = useState<ArrivalPhase>("walking");
  useEffect(() => {
    if (!arrived) {
      setArrivalPhase("walking");
      return;
    }

    // Phase 1 → 2: pause, then face each other
    const t1 = setTimeout(() => setArrivalPhase("faceEachOther"), FACE_EACH_OTHER_DELAY_MS);
    // Phase 2 → 3: longer hold, then face the screen
    const t2 = setTimeout(
      () => setArrivalPhase("faceScreen"),
      FACE_EACH_OTHER_DELAY_MS + FACE_SCREEN_DELAY_MS,
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [arrived]);

  const meFromOrigin = useDistanceBearing(SCENE_ORIGIN, me);
  const friendFromOrigin = useDistanceBearing(SCENE_ORIGIN, friend);

  const mePos = useScreenPosition({
    distanceMeters: meFromOrigin.distance,
    bearingDegrees: meFromOrigin.bearing,
    centerXPercent: CENTER_X_PERCENT,
    closenessToY: meClosenessToY,
  });
  const friendPos = useScreenPosition({
    distanceMeters: friendFromOrigin.distance,
    bearingDegrees: friendFromOrigin.bearing,
    centerXPercent: CENTER_X_PERCENT,
    closenessToY: friendClosenessToY,
  });

  // Look-direction (which pose each character shows) is deliberately
  // computed from the *raw, unsprung* target position, not from mePos/
  // friendPos above (which are spring-smoothed for the actual on-screen
  // motion). Deriving it from the smoothed position caused a visible lag:
  // the position started sliding the instant the underlying bearing
  // changed, but the pose only caught up once the smoothed sway built up
  // past the threshold -- reading as "floats over, then the walk animation
  // starts" instead of the pose reacting the moment the move begins.
  const meTarget = targetXY(meFromOrigin.distance, meFromOrigin.bearing, meClosenessToY);
  const friendTarget = targetXY(friendFromOrigin.distance, friendFromOrigin.bearing, friendClosenessToY);
  const targetAngleDeg =
    ((Math.atan2(friendTarget.y - meTarget.y, friendTarget.x - meTarget.x) * 180) / Math.PI + 90 + 360) % 360;
  const meLookSway = Math.sin((targetAngleDeg * Math.PI) / 180) * 100;
  const friendLookSway = -meLookSway;

  // MotionValues for the post-arrival poses, updated via animate() for smooth sliding
  const postX_me = useMotionValue(CENTER_X_PERCENT);
  const postY_me = useMotionValue(MEET_Y_PERCENT);
  const postX_friend = useMotionValue(CENTER_X_PERCENT);
  const postY_friend = useMotionValue(MEET_Y_PERCENT);

  // Resolve which positions, sprites, and sway to use per phase.
  const isPostArrival = arrivalPhase !== "walking";
  const isFaceScreen = arrivalPhase === "faceScreen";
  const isFaceEachOther = arrivalPhase === "faceEachOther";

  // Smoothly animate the post-arrival positions when the phase changes
  useEffect(() => {
    if (arrivalPhase === "faceEachOther") {
      // Snap to the expected stopped positions before animating to prevent
      // a huge slide if the user clicked the 'Arrived' preset while the
      // distance spring was still far away.
      postX_me.set(CENTER_X_PERCENT);
      postY_me.set(ME_STOP_Y_PERCENT);
      postX_friend.set(CENTER_X_PERCENT);
      postY_friend.set(FRIEND_STOP_Y_PERCENT);

      animate(postX_me, CENTER_X_PERCENT - FACE_EACH_OTHER_OFFSET_X, { duration: 0.5, ease: "easeOut" });
      animate(postY_me, FACE_EACH_OTHER_Y, { duration: 0.5, ease: "easeOut" });
      animate(postX_friend, CENTER_X_PERCENT + FACE_EACH_OTHER_OFFSET_X, { duration: 0.5, ease: "easeOut" });
      animate(postY_friend, FACE_EACH_OTHER_Y, { duration: 0.5, ease: "easeOut" });
    } else if (arrivalPhase === "faceScreen") {
      animate(postX_me, CENTER_X_PERCENT - SIDE_BY_SIDE_OFFSET_X, { duration: 0.8, ease: "easeInOut" });
      animate(postY_me, SIDE_BY_SIDE_Y, { duration: 0.8, ease: "easeInOut" });
      animate(postX_friend, CENTER_X_PERCENT + SIDE_BY_SIDE_OFFSET_X, { duration: 0.8, ease: "easeInOut" });
      animate(postY_friend, SIDE_BY_SIDE_Y, { duration: 0.8, ease: "easeInOut" });
    } else {
      // Keep them synced with the live positions while walking so the first transition is seamless
      postX_me.set(mePos.x.get());
      postY_me.set(mePos.y.get());
      postX_friend.set(friendPos.x.get());
      postY_friend.set(friendPos.y.get());
    }
  }, [arrivalPhase, postX_me, postY_me, postX_friend, postY_friend, mePos.x, mePos.y, friendPos.x, friendPos.y]);

  const meX = isPostArrival ? postX_me : mePos.x;
  const meY = isPostArrival ? postY_me : mePos.y;
  const friendX = isPostArrival ? postX_friend : friendPos.x;
  const friendY = isPostArrival ? postY_friend : friendPos.y;

  const meSprites = isFaceScreen
    ? myCharacterSprites.towardCamera
    : isFaceEachOther
      ? myCharacterSprites.faceRight
      : myCharacterSprites.you;
  // Whichever character the selected friend picked (see friendCharacterSprites
  // above) -- falls back to the default set if they haven't picked one, or
  // if no friend is selected at all.
  const friendSprites = isFaceScreen
    ? friendCharacterSprites.towardCamera
    : isFaceEachOther
      ? friendCharacterSprites.faceLeft
      : friendCharacterSprites.towardCamera;

  const meSway = isPostArrival ? 0 : meLookSway;
  const friendSway = isPostArrival ? 0 : friendLookSway;

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-hidden">
      {/* Seamless scrolling grass background */}
      <ScrollingBackground tile={GROUND_TILE} isMoving={playing} />

      {/* Full-screen overlay */}
      <div className="relative z-10 flex flex-1 w-full flex-col" style={{ paddingBottom: 68 }}>

        {/* ── TOP HUD ───────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-2 px-3 pt-3">

          {/* Distance & bearing — white pixel panel */}
          <div className="px-panel" style={{ padding: "10px 14px" }}>
            <div style={{
              fontFamily: "var(--font-pixel, 'Courier New', monospace)",
              fontSize: 10,
              lineHeight: 2,
              color: "var(--px-text)",
            }}>
              <span
                className="px-cursor"
                style={{ color: "var(--px-orange)", fontSize: 12 }}
              >
                {Math.round(distance)}M
              </span>
              <br />
              <span style={{ color: "var(--px-blue)" }}>
                {Math.round(bearing)}&deg; BRG
              </span>
              {arrived && (
                <><br /><span style={{ color: "var(--px-green)" }}>★ FOUND!</span></>
              )}
            </div>
          </div>

          {/* Play / Pause button — top right */}
          <button
            type="button"
            onClick={toggleWalking}
            className={`px-btn ${playing ? "px-btn-red" : "px-btn-green"}`}
            style={{ padding: "10px 14px", fontSize: 10, borderRadius: 2 }}
          >
            {playing ? "PAUSE" : arrived ? "AGAIN" : "START"}
          </button>
        </div>

        {/* ── CHARACTER SCENE ────────────────────────────────── */}
        <div className="relative flex-1">
          <ConnectionLine x1={meX} y1={meY} x2={friendX} y2={friendY} />

          {/* Arrival banner */}
          {isFaceScreen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="absolute left-1/2 top-[22%] -translate-x-1/2 z-20 pointer-events-none"
            >
              <div
                className="px-panel"
                style={{
                  fontFamily: "var(--font-pixel, 'Courier New', monospace)",
                  fontSize: 9,
                  color: "var(--px-green)",
                  letterSpacing: "0.06em",
                  padding: "10px 18px",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                  borderColor: "var(--px-green)",
                }}
              >
                ★ FOUND EACH OTHER! ★
              </div>
            </motion.div>
          )}

          <SpriteCharacter
            xPercent={friendX}
            yPercent={friendY}
            scale={friendPos.scale}
            lookSway={friendSway}
            sprites={friendSprites}
            isMoving={playing}
            label={friendLabel}
          />
          <SpriteCharacter
            xPercent={meX}
            yPercent={meY}
            scale={mePos.scale}
            lookSway={meSway}
            sprites={meSprites}
            isMoving={playing}
            label="You"
          />
        </div>

        {/* ── SELECT FRIEND ─────────────────────────────────── */}
        <div className="flex justify-center px-3 pb-3">
          <button
            type="button"
            onClick={() => setFriendPickerOpen(true)}
            className="px-btn px-btn-ghost"
            style={{ padding: "10px 16px", fontSize: 10 }}
          >
            <span className="px-icon px-icon-friends" aria-hidden></span>
            {friendsLoading ? "LOADING..." : selectedFriend ? `SELECT FRIEND: ${selectedFriend.username}` : "NO FRIENDS YET"}
          </button>
        </div>
      </div>

      {/* ── BOTTOM TAB BAR ────────────────────────────────────── */}
      <TabBar />

      {/* Friend picker sub-window */}
      <PixelModal
        open={friendPickerOpen}
        title="SELECT FRIEND"
        onClose={() => setFriendPickerOpen(false)}
      >
        {friends.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {friends.map((f) => {
              const pfp = characterAvatarSrc(f.character_id);
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setSelectedFriend(f);
                    setFriendPickerOpen(false);
                  }}
                  className="flex flex-col items-center gap-2 p-2 border-4"
                  style={{
                    borderColor: "var(--px-border)",
                    backgroundColor: f.id === selectedFriend?.id ? "var(--px-text)" : "var(--px-white)",
                  }}
                >
                  <div
                    className="px-avatar-circle w-14 h-14"
                    style={{
                      backgroundColor: "#e0e0e0",
                      backgroundImage: `url(${pfp})`,
                      backgroundSize: "cover",
                      backgroundPosition: avatarBackgroundPosition(pfp),
                    }}
                  />
                  <span
                    className="text-[10px] font-bold truncate w-full text-center"
                    style={{ color: f.id === selectedFriend?.id ? "var(--px-white)" : "var(--px-text)" }}
                  >
                    {f.username}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-sm" style={{ color: "var(--px-muted)" }}>
            No friends yet -- find some in Search!
          </p>
        )}
      </PixelModal>
    </div>
  );
}
