"use client";

import { useFindDemo, SCENE_ORIGIN } from "@/hooks/useFindDemo";
import { useDistanceBearing } from "@/hooks/useDistanceBearing";
import { useScreenPosition } from "@/hooks/useScreenPosition";
import { usePreloadImages } from "@/hooks/usePreloadImages";
import { hasArrived, distanceToCloseness } from "@/utils/distanceToPosition";
import { bearingToSway } from "@/utils/bearingToSway";
import { ConnectionLine } from "./ConnectionLine";
import { ScrollingBackground } from "./ScrollingBackground";
import { ROAD_TILE } from "./backgroundTiles";
import { SpriteCharacter } from "./SpriteCharacter";
import { YOU_SPRITES, FRIEND_SPRITES, ALL_SPRITE_SRCS } from "./spriteSets";

// Both people walk toward this shared screen point from opposite edges --
// "you" from the bottom, "friend" from the top -- rather than one being a
// fixed anchor the other approaches.
const CENTER_X_PERCENT = 50;
const MEET_Y_PERCENT = 50;
const BOTTOM_Y_PERCENT = 85;
const TOP_Y_PERCENT = 15;

function meClosenessToY(t: number) {
  return MEET_Y_PERCENT + t * (BOTTOM_Y_PERCENT - MEET_Y_PERCENT);
}
function friendClosenessToY(t: number) {
  return MEET_Y_PERCENT - t * (MEET_Y_PERCENT - TOP_Y_PERCENT);
}

/** Where a character would be if position followed the raw distance/bearing
 * exactly, with no spring smoothing -- used only to compute which way to
 * *look*, not for the actual (smoothed) screen position. See below for why. */
function targetXY(distanceMeters: number, bearingDegrees: number, closenessToY: (t: number) => number) {
  const closeness = distanceToCloseness(distanceMeters);
  return { x: CENTER_X_PERCENT + bearingToSway(bearingDegrees), y: closenessToY(closeness) };
}

export function FindScene() {
  usePreloadImages(ALL_SPRITE_SRCS);

  const { me, friend, presets, applyPreset, playing, toggleWalking } = useFindDemo();
  const { distance, bearing } = useDistanceBearing(me, friend);
  const arrived = hasArrived(distance);

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

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-hidden">
      {/* Full-screen background -- the character area below is just a
          positioning context now, no boxed-in square. Swap `ROAD_TILE` for
          `GROUND_TILE` (both in ./backgroundTiles) to switch textures. */}
      <ScrollingBackground tile={ROAD_TILE} isMoving={playing} />

      <div className="relative z-10 flex min-h-dvh w-full flex-col px-4 pb-8 pt-6">
        <header className="text-center">
          <h1 className="inline-block rounded-full bg-white/80 px-3 py-1 text-lg font-semibold text-zinc-900 dark:bg-black/60 dark:text-zinc-50">
            Find
          </h1>
        </header>

        <div className="relative flex-1">
          <ConnectionLine x1={mePos.x} y1={mePos.y} x2={friendPos.x} y2={friendPos.y} />
          <SpriteCharacter
            xPercent={mePos.x}
            yPercent={mePos.y}
            scale={mePos.scale}
            lookSway={meLookSway}
            sprites={YOU_SPRITES}
            isMoving={playing}
            label="You"
          />
          <SpriteCharacter
            xPercent={friendPos.x}
            yPercent={friendPos.y}
            scale={friendPos.scale}
            lookSway={friendLookSway}
            sprites={FRIEND_SPRITES}
            isMoving={playing}
            label="Friend"
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
