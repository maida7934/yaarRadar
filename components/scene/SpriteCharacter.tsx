"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import gsap from "gsap";
import { resolveDirection, type FacingDirection } from "@/utils/direction";
import type { DirectionalSpriteSet, SpriteSet } from "./spriteSets";

interface SpriteCharacterProps {
  xPercent: MotionValue<number>;
  yPercent: MotionValue<number>;
  /** Distance-driven size, bigger when close -- see useScreenPosition. */
  scale: MotionValue<number>;
  /** How far left/right this character should look/lean right now, from
   * the raw (unsprung) target line angle -- a plain number, not a
   * MotionValue, deliberately: it should update the instant the underlying
   * data changes (in sync with when the smoothed position starts moving),
   * not smoothly interpolate itself. See FindScene for why. */
  lookSway: number;
  sprites: DirectionalSpriteSet;
  /** Steps through the walk frames on loop when true, holds the idle frame otherwise. */
  isMoving: boolean;
  label: string;
}

// The new sheet's cells (78x130) are notably bigger than the old sheet's
// (54x78) -- scaled down from before so on-screen character size stays
// similar rather than suddenly ballooning.
const DISPLAY_SCALE = 1.1;
// A touch slower than a real walking cadence reads calmer/smoother on a
// small pixel-art loop -- too fast made the leg-alternation read as a
// jittery side-to-side dance rather than a stride.
const SECONDS_PER_FRAME = 0.2;
// How far the sway has to commit before switching sprite, and how far back
// toward center before switching back -- see resolveDirection for why
// these need to differ (hysteresis, no flicker at the boundary). Both
// characters now have a real settled-diagonal pose for any lean (not a
// stand-in), so it should kick in for any real lean, not just an extreme
// one -- lower than the values used when the diagonal was a rarer,
// less-certain fallback. Still enough hysteresis, combined with the calm
// wander in useFindDemo, to not flicker back and forth.
const ENTER_THRESHOLD = 18;
const EXIT_THRESHOLD = 10;
// How long the sharper "turning" pose shows before settling into the
// sustained lean pose -- real turning is quick, not a held stance.
const TURN_DURATION_MS = 400;

/**
 * Renders one sprite-sheet character, picking one of three pre-drawn
 * poses (straight/left/right) from `sprites` based on sway, rather than
 * rotating a single image -- a flat 2D sprite rotated past a few degrees
 * reads as tilting over, not turning, since there's no art for the
 * in-between angles. Deliberately only knows `isMoving` and `lookSway`
 * -- not distance/bearing/coords -- so this stays decoupled from *why* the
 * character is moving.
 */
export function SpriteCharacter({
  xPercent,
  yPercent,
  scale,
  lookSway,
  sprites,
  isMoving,
  label,
}: SpriteCharacterProps) {
  const left = useTransform(xPercent, (v) => `${v}%`);
  const top = useTransform(yPercent, (v) => `${v}%`);
  const frameRef = useRef<HTMLDivElement>(null);

  // Pure sway-threshold hysteresis, not velocity: an earlier version tried
  // triggering the turn from useVelocity(xPercent) directly (the idea being
  // "only turn when they're actually moving that way"), but instantaneous
  // spring velocity is noisy -- a settling spring's velocity oscillates
  // and crosses small thresholds repeatedly even at rest, which read as
  // random flicker. A sustained sway-threshold crossing already *is* "they
  // decided to move that way" (sway only moves when the underlying line
  // angle actually changes), without the noise.
  const [direction, setDirection] = useState<FacingDirection>(() =>
    resolveDirection(lookSway, "straight", ENTER_THRESHOLD, EXIT_THRESHOLD),
  );
  const previousDirectionRef = useRef(direction);
  useEffect(() => {
    const next = resolveDirection(lookSway, previousDirectionRef.current, ENTER_THRESHOLD, EXIT_THRESHOLD);
    if (next !== previousDirectionRef.current) {
      previousDirectionRef.current = next;
      setDirection(next);
    }
  }, [lookSway]);

  // Turn/settle: a real turn is a brief moment, not a held stance -- show
  // the sharper "turning" pose right when `direction` changes, then settle
  // into the sustained lean pose. Skips the turn animation on the very
  // first render (nothing to turn *from* yet).
  const [phase, setPhase] = useState<"turning" | "settled">("settled");
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setPhase("turning");
    const timeout = setTimeout(() => setPhase("settled"), TURN_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [direction]);

  const activeSprite: SpriteSet =
    direction === "straight" ? sprites.straight : sprites[direction][phase];
  const { walkSrc, idleSrc, frameCount, cellWidth, cellHeight } = activeSprite;
  const displayWidth = cellWidth * DISPLAY_SCALE;
  const displayHeight = cellHeight * DISPLAY_SCALE;

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    // gsap.context scopes the tween for cleanup on unmount/re-run --
    // without it, React 18 strict-mode's double-invoke in dev can leave a
    // duplicate looping tween behind.
    const ctx = gsap.context(() => {
      if (isMoving) {
        gsap.set(el, {
          backgroundImage: `url(${walkSrc})`,
          backgroundSize: `${displayWidth * frameCount}px ${displayHeight}px`,
          backgroundPositionX: "0px",
        });
        gsap.to(el, {
          backgroundPositionX: `-${displayWidth * frameCount}px`,
          duration: frameCount * SECONDS_PER_FRAME,
          ease: `steps(${frameCount})`,
          repeat: -1,
        });
      } else {
        gsap.set(el, {
          backgroundImage: `url(${idleSrc})`,
          backgroundSize: `${displayWidth}px ${displayHeight}px`,
          backgroundPositionX: "0px",
        });
      }
    });

    return () => ctx.revert();
  }, [isMoving, walkSrc, idleSrc, frameCount, displayWidth, displayHeight]);

  return (
    <motion.div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{ left, top }}
    >
      <motion.div
        ref={frameRef}
        style={{ width: displayWidth, height: displayHeight, imageRendering: "pixelated", scale }}
      />
      <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-black/60 dark:text-zinc-200">
        {label}
      </span>
    </motion.div>
  );
}
