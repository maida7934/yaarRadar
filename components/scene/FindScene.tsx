"use client";

import { useEffect, useState } from "react";
import { useMotionValue, animate, motion } from "framer-motion";
import { useFindDemo, SCENE_ORIGIN } from "@/hooks/useFindDemo";
import { useDistanceBearing } from "@/hooks/useDistanceBearing";
import { useScreenPosition } from "@/hooks/useScreenPosition";
import { usePreloadImages } from "@/hooks/usePreloadImages";
import { hasArrived, distanceToCloseness } from "@/utils/distanceToPosition";
import { bearingToSway } from "@/utils/bearingToSway";
import { ConnectionLine } from "./ConnectionLine";
import { ScrollingBackground } from "./ScrollingBackground";
import { GROUND_TILE } from "./backgroundTiles";
import { SpriteCharacter } from "./SpriteCharacter";
import {
  YOU_SPRITES,
  TOWARD_CAMERA_SPRITES,
  FACE_RIGHT_SPRITES,
  PURPLE_FRIEND_SPRITES,
  PURPLE_FACE_LEFT_SPRITES,
  ALL_SPRITE_SRCS,
} from "./spriteSets";

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

  const { me, friend, presets, applyPreset, playing, toggleWalking } = useFindDemo();
  const { distance, bearing } = useDistanceBearing(me, friend);
  const arrived = hasArrived(distance);

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
    ? TOWARD_CAMERA_SPRITES
    : isFaceEachOther
      ? FACE_RIGHT_SPRITES
      : YOU_SPRITES;
  // Friend uses the purple-girl sheet for testing -- "You" is unaffected,
  // still using the default chibi sets above.
  const friendSprites = isFaceScreen
    ? PURPLE_FRIEND_SPRITES
    : isFaceEachOther
      ? PURPLE_FACE_LEFT_SPRITES
      : PURPLE_FRIEND_SPRITES;

  const meSway = isPostArrival ? 0 : meLookSway;
  const friendSway = isPostArrival ? 0 : friendLookSway;

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-hidden">
      {/* Full-screen background -- the character area below is just a
          positioning context now, no boxed-in square. Swap `GROUND_TILE` for
          `ROAD_TILE` (both in ./backgroundTiles) to switch textures. */}
      <ScrollingBackground tile={GROUND_TILE} isMoving={playing} />

      <div className="relative z-10 flex min-h-dvh w-full flex-col px-4 pb-8 pt-6">
        <header className="text-center">
          <h1 className="inline-block rounded-full bg-white/80 px-3 py-1 text-lg font-semibold text-zinc-900 dark:bg-black/60 dark:text-zinc-50">
            Find
          </h1>
        </header>

        <div className="relative flex-1">
          <ConnectionLine x1={meX} y1={meY} x2={friendX} y2={friendY} />

          {/* Success Text */}
          {isFaceScreen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="absolute left-1/2 top-[25%] -translate-x-1/2 text-center z-20 w-full"
            >
              <h2 className="text-2xl font-bold text-black dark:text-white drop-shadow-md bg-white/50 dark:bg-black/50 rounded-full px-4 py-1 inline-block backdrop-blur-sm">
                You found each other!
              </h2>
            </motion.div>
          )}

          <SpriteCharacter
            xPercent={friendX}
            yPercent={friendY}
            scale={friendPos.scale}
            lookSway={friendSway}
            sprites={friendSprites}
            isMoving={playing}
            label="Friend"
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

        {/* Pushed down, plain -- revisit styling later. */}
        <div className="mt-auto flex flex-col gap-4 rounded-2xl bg-white/85 p-4 backdrop-blur-sm dark:bg-black/70">
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            {Math.round(distance)} m away &middot; bearing {Math.round(bearing)}°
            {arrived ? " · arrived" : ""}
          </p>

          <button
            type="button"
            onClick={toggleWalking}
            className="w-full rounded-full bg-blue-600 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            {playing ? "Pause" : arrived ? "Walk again" : "Start walking"}
          </button>

          <div className="flex flex-wrap justify-center gap-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
