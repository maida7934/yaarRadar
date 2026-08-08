"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { offsetCoords, type Coords } from "@/utils/geo";

export interface DistancePreset {
  id: string;
  label: string;
  legMeters: number;
}

// A fixed virtual point both people walk toward -- not itself shown on
// screen, just the shared reference both bearings are measured from so
// their paths are collinear and they visibly meet in the middle rather
// than one of them being a stationary anchor.
export const SCENE_ORIGIN: Coords = { latitude: 12.9716, longitude: 77.5946 };

const ME_BASE_BEARING = 200;
const FRIEND_BASE_BEARING = 20; // opposite ME_BASE_BEARING -- collinear approach

// Independent wander per person (different amplitude/frequency/phase) so
// the walk reads as two people ambling, not one animation mirrored --
// "normal human movement", not a robotic symmetric one.
const ME_WANDER = { amplitude: 18, frequency: 0.05, phase: 0 };
const FRIEND_WANDER = { amplitude: 18, frequency: 0.07, phase: Math.PI / 3 };

const LEG_START_METERS = 900;
const LEG_END_METERS = 2;
const SIM_TICK_MS = 200;
// Constant-velocity, ~15s Far -> Arrived at 200ms/tick -- small, frequent
// steps rather than the earlier 90m/800ms jumps, so it reads as a steady
// walking pace instead of a series of hops.
const LEG_STEP_METERS = 12;

export const PRESETS: DistancePreset[] = [
  { id: "far", label: "Far (~1800m)", legMeters: LEG_START_METERS },
  { id: "medium", label: "Medium (~600m)", legMeters: 300 },
  { id: "close", label: "Close (~80m)", legMeters: 40 },
  { id: "arrived", label: "Arrived (~4m)", legMeters: LEG_END_METERS },
];

interface SimState {
  legMeters: number;
  tickIndex: number;
}

interface Wander {
  amplitude: number;
  frequency: number;
  phase: number;
}

function wanderBearing(base: number, tickIndex: number, wander: Wander): number {
  return base + wander.amplitude * Math.sin(tickIndex * wander.frequency + wander.phase);
}

export function useFindDemo() {
  const [sim, setSim] = useState<SimState>({ legMeters: LEG_START_METERS, tickIndex: 0 });
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!playing) return;

    intervalRef.current = setInterval(() => {
      setSim((current) => {
        const nextLeg = current.legMeters - LEG_STEP_METERS;
        const nextTick = current.tickIndex + 1;
        if (nextLeg <= LEG_END_METERS) {
          stop();
          return { legMeters: LEG_END_METERS, tickIndex: nextTick };
        }
        return { legMeters: nextLeg, tickIndex: nextTick };
      });
    }, SIM_TICK_MS);

    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [playing, stop]);

  const startWalking = useCallback(() => {
    setSim((current) =>
      current.legMeters <= LEG_END_METERS
        ? { legMeters: LEG_START_METERS, tickIndex: 0 }
        : current,
    );
    setPlaying(true);
  }, []);

  const toggleWalking = useCallback(() => {
    if (playing) stop();
    else startWalking();
  }, [playing, startWalking, stop]);

  const applyPreset = useCallback(
    (preset: DistancePreset) => {
      stop();
      setSim({ legMeters: preset.legMeters, tickIndex: 0 });
    },
    [stop],
  );

  const meBearing = wanderBearing(ME_BASE_BEARING, sim.tickIndex, ME_WANDER);
  const friendBearing = wanderBearing(FRIEND_BASE_BEARING, sim.tickIndex, FRIEND_WANDER);

  return {
    me: offsetCoords(SCENE_ORIGIN, sim.legMeters, meBearing),
    friend: offsetCoords(SCENE_ORIGIN, sim.legMeters, friendBearing),
    presets: PRESETS,
    applyPreset,
    playing,
    toggleWalking,
  };
}
