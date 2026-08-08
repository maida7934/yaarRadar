"use client";

import { useFindDemo, SCENE_ORIGIN } from "@/hooks/useFindDemo";
import { useDistanceBearing } from "@/hooks/useDistanceBearing";
import { useScreenPosition } from "@/hooks/useScreenPosition";
import { hasArrived } from "@/utils/distanceToPosition";
import { ConnectionLine } from "./ConnectionLine";
import { Dot } from "./Dot";

// Both people walk toward this shared screen point from opposite edges --
// "you" from the bottom, "friend" from the top -- rather than one being a
// fixed anchor the other approaches.
const CENTER_X_PERCENT = 50;
const MEET_Y_PERCENT = 50;
const BOTTOM_Y_PERCENT = 85;
const TOP_Y_PERCENT = 15;

export function FindScene() {
  const { me, friend, presets, applyPreset, playing, toggleWalking } = useFindDemo();
  const { distance, bearing } = useDistanceBearing(me, friend);
  const arrived = hasArrived(distance);

  const meFromOrigin = useDistanceBearing(SCENE_ORIGIN, me);
  const friendFromOrigin = useDistanceBearing(SCENE_ORIGIN, friend);

  const mePos = useScreenPosition({
    distanceMeters: meFromOrigin.distance,
    bearingDegrees: meFromOrigin.bearing,
    centerXPercent: CENTER_X_PERCENT,
    closenessToY: (t) => MEET_Y_PERCENT + t * (BOTTOM_Y_PERCENT - MEET_Y_PERCENT),
  });
  const friendPos = useScreenPosition({
    distanceMeters: friendFromOrigin.distance,
    bearingDegrees: friendFromOrigin.bearing,
    centerXPercent: CENTER_X_PERCENT,
    closenessToY: (t) => MEET_Y_PERCENT - t * (MEET_Y_PERCENT - TOP_Y_PERCENT),
  });

  return (
    <div className="flex min-h-dvh w-full flex-col px-4 pb-8 pt-6">
      <header className="text-center">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Find</h1>
      </header>

      <div className="relative my-6 min-h-[320px] w-full flex-1">
        <ConnectionLine x1={mePos.x} y1={mePos.y} x2={friendPos.x} y2={friendPos.y} />
        <Dot xPercent={mePos.x} yPercent={mePos.y} label="You" color="#2563eb" />
        <Dot xPercent={friendPos.x} yPercent={friendPos.y} label="Friend" color="#dc2626" />
      </div>

      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        {Math.round(distance)} m away &middot; bearing {Math.round(bearing)}°
        {arrived ? " · arrived" : ""}
      </p>

      <div className="mt-6 flex flex-col gap-4">
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
  );
}
