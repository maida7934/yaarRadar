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

const ME_BASE_BEARING = 180;
const FRIEND_BASE_BEARING = 0; // opposite ME_BASE_BEARING -- collinear approach

// Independent wander per person (different amplitude/frequency/phase) so
// the walk reads as two people ambling, not one animation mirrored --
// "normal human movement", not a robotic symmetric one. Kept small and
// slow -- at the original amplitude/frequency this swung enough, and
// through enough of a sine cycle over one walk, to cross the sprite
// direction thresholds (see SpriteCharacter) multiple times, reading as
// flickering left/right instead of one smooth, gentle drift.
const ME_WANDER = { amplitude: 8, frequency: 0.025, phase: 0 };
const FRIEND_WANDER = { amplitude: 8, frequency: 0.03, phase: Math.PI / 3 };

// A single, deliberate "friend suddenly cuts left" moment partway through
// the walk (~ticks 32-48 of ~75, roughly 6-10s into the ~15s walk) -- the
// ambient wander above is intentionally too gentle to ever cross the
// sprite direction thresholds (that's what made the walk feel calm rather
// than flickery), so without this, "left" is never actually demonstrated.
// This is a one-time scripted event, not a repeating wobble -- it doesn't
// reintroduce the flicker the calmer wander was fixing.
const FRIEND_EVENT_START_TICK = 32;
const FRIEND_EVENT_END_TICK = 48;
const FRIEND_EVENT_BEARING = -40; // sway from this is well past the "left" threshold

const ME_EVENT_START_TICK = 10;
const ME_EVENT_END_TICK = 25;
const ME_EVENT_BEARING = 90; // sway to the right

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

  const inMeEventWindow =
    sim.tickIndex >= ME_EVENT_START_TICK && sim.tickIndex < ME_EVENT_END_TICK;
  const meBearing = inMeEventWindow
    ? ME_EVENT_BEARING
    : wanderBearing(ME_BASE_BEARING, sim.tickIndex, ME_WANDER);

  const inFriendEventWindow =
    sim.tickIndex >= FRIEND_EVENT_START_TICK && sim.tickIndex < FRIEND_EVENT_END_TICK;
  const friendBearing = inFriendEventWindow
    ? FRIEND_EVENT_BEARING
    : wanderBearing(FRIEND_BASE_BEARING, sim.tickIndex, FRIEND_WANDER);

  return {
    me: offsetCoords(SCENE_ORIGIN, sim.legMeters, meBearing),
    friend: offsetCoords(SCENE_ORIGIN, sim.legMeters, friendBearing),
    presets: PRESETS,
    applyPreset,
    playing,
    toggleWalking,
  };
}
