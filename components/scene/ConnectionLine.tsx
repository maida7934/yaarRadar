"use client";

import { motion, type MotionValue } from "framer-motion";

interface ConnectionLineProps {
  x1: MotionValue<number>;
  y1: MotionValue<number>;
  x2: MotionValue<number>;
  y2: MotionValue<number>;
}

/**
 * A dashed line directly between the two dots, in the same 0-100 percent
 * coordinate space they're positioned in. Because the friend's position
 * now depends on both distance (vertical) and bearing (horizontal sway),
 * this reads as a diagonal that visibly tilts as bearing changes, rather
 * than a fixed road.
 */
export function ConnectionLine({ x1, y1, x2, y2 }: ConnectionLineProps) {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <motion.line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="currentColor"
        className="text-zinc-300 dark:text-zinc-700"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
