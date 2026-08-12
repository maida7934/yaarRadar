"use client";

import { useCallback, useState } from "react";
import { offsetCoords, type Coords } from "@/utils/geo";

const START_DISTANCE_METERS = 300;
const DISTANCE_STEP_METERS = 40;
const BEARING_STEP_DEGREES = 12;
const START_BEARING_DEGREES = 180; // matches useFindDemo's ME_BASE_BEARING -- centered, no sway
const MIN_DISTANCE_METERS = 2;
// Deliberately well past distanceToCloseness's own clamp (2000m) -- the
// point of manual mode is testing how the scene holds up at, and beyond,
// the edges of the range it's designed for.
const MAX_DISTANCE_METERS = 6000;

/**
 * Manual movement for "me", for testing the scene's layout at arbitrary
 * distances/bearings instead of the automated useFindDemo walk. Bearing
 * starts at 180 to match useFindDemo's ME_BASE_BEARING (centered, no sway).
 * "Friend" isn't part of this hook -- FindScene pins them to a fixed point
 * while this is active.
 */
export function useManualWalk(origin: Coords) {
  const [distance, setDistance] = useState(START_DISTANCE_METERS);
  const [bearing, setBearing] = useState(START_BEARING_DEGREES);

  // Called whenever test mode is (re-)entered, so it always starts fresh
  // from the same spot instead of picking up wherever a previous session
  // was left.
  const reset = useCallback(() => {
    setDistance(START_DISTANCE_METERS);
    setBearing(START_BEARING_DEGREES);
  }, []);

  const moveForward = useCallback(
    () => setDistance((d) => Math.max(MIN_DISTANCE_METERS, d - DISTANCE_STEP_METERS)),
    [],
  );
  const moveBack = useCallback(
    () => setDistance((d) => Math.min(MAX_DISTANCE_METERS, d + DISTANCE_STEP_METERS)),
    [],
  );
  const moveLeft = useCallback(() => setBearing((b) => (b - BEARING_STEP_DEGREES + 360) % 360), []);
  const moveRight = useCallback(() => setBearing((b) => (b + BEARING_STEP_DEGREES) % 360), []);

  const coords = offsetCoords(origin, distance, bearing);

  return { coords, distance, bearing, moveForward, moveBack, moveLeft, moveRight, reset };
}
