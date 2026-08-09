"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";
import { distanceToCloseness } from "@/utils/distanceToPosition";
import { bearingToSway } from "@/utils/bearingToSway";
import { unwrapDegrees } from "@/utils/angle";

interface UseScreenPositionOptions {
  distanceMeters: number;
  bearingDegrees: number;
  centerXPercent: number;
  /** Maps a 0 (arrived) - 1 (farthest) closeness value to a vertical percent. */
  closenessToY: (closeness: number) => number;
}

// Scale is kept constant so both sprites remain the same visual size
// throughout the walk -- the original distance-driven scaling caused the
// front sprite to balloon when they converged.  Vertical position alone
// already reads as "approaching".

/**
 * Spring-smoothed screen position for one person, from their (real,
 * coordinate-derived) distance and bearing to a shared reference point.
 * Two independent springs -- distance drives vertical position, bearing
 * drives horizontal sway -- kept separate since they're conceptually
 * different motions (see FindScene for why bearing needs unwrapping before
 * it's sprung).
 */
export function useScreenPosition({
  distanceMeters,
  bearingDegrees,
  centerXPercent,
  closenessToY,
}: UseScreenPositionOptions): {
  x: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
} {
  const closeness = distanceToCloseness(distanceMeters);

  const closenessTarget = useMotionValue(closeness);
  useEffect(() => {
    closenessTarget.set(closeness);
  }, [closeness, closenessTarget]);
  const closenessSpring = useSpring(closenessTarget, { stiffness: 120, damping: 20 });

  // `bearingDegrees` is always wrapped to [0, 360) -- if we sprung that raw
  // value, a crossing of due north (e.g. 359 -> 1) would animate the *long*
  // way around through 180 instead of the short way through 0.
  // unwrapDegrees keeps a continuous running value so the spring always
  // takes the short path -- see utils/angle.ts.
  const unwrappedBearingRef = useRef(bearingDegrees);
  const bearingTarget = useMotionValue(bearingDegrees);
  useEffect(() => {
    unwrappedBearingRef.current = unwrapDegrees(unwrappedBearingRef.current, bearingDegrees);
    bearingTarget.set(unwrappedBearingRef.current);
  }, [bearingDegrees, bearingTarget]);
  // Gentler than the distance spring -- bearing drives a *sway*, and it
  // should read as minimal, compass-like drift, not a disorienting swing.
  // Low stiffness deliberately -- this spring is what will smooth real GPS
  // bearing updates later too, not just the mock event in useFindDemo, so
  // it needs to turn like an actual walking pace regardless of how big a
  // single bearing jump is, not snap-then-settle. A big target change (like
  // the scripted "sudden left" event) should still read as a real turn
  // taking a beat, not an instant redirect.
  const bearingSpring = useSpring(bearingTarget, { stiffness: 25, damping: 14 });

  const y = useTransform(closenessSpring, closenessToY);
  const x = useTransform(bearingSpring, (deg) => centerXPercent + bearingToSway(deg));
  const scale = useTransform(closenessSpring, () => 1);

  return { x, y, scale };
}
