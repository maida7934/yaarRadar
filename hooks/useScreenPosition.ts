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
}: UseScreenPositionOptions): { x: MotionValue<number>; y: MotionValue<number> } {
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
  const bearingSpring = useSpring(bearingTarget, { stiffness: 70, damping: 22 });

  const y = useTransform(closenessSpring, closenessToY);
  const x = useTransform(bearingSpring, (deg) => centerXPercent + bearingToSway(deg));

  return { x, y };
}
