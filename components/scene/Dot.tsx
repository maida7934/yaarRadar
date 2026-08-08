"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";

interface DotProps {
  /** Horizontal position, in percent (0-100), as a MotionValue. */
  xPercent: MotionValue<number>;
  /** Vertical position, in percent (0-100), as a MotionValue. */
  yPercent: MotionValue<number>;
  label: string;
  color: string;
}

/**
 * Placeholder stand-in for the eventual sprite character -- deliberately
 * dumb (no walk-cycle, no facing) so the coordinates -> distance/bearing ->
 * position pipeline can be verified before any sprite/GSAP work starts.
 */
export function Dot({ xPercent, yPercent, label, color }: DotProps) {
  const left = useTransform(xPercent, (v) => `${v}%`);
  const top = useTransform(yPercent, (v) => `${v}%`);

  return (
    <motion.div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{ left, top }}
    >
      <div
        className="h-6 w-6 rounded-full border-2 border-white shadow dark:border-zinc-900"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
    </motion.div>
  );
}
