"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { motion, MotionValue, useMotionTemplate, useMotionValue } from "framer-motion";

export interface ScrollingTile {
  src: string;
  /** Native pixel size of the tile -- it should already mirror itself so
   * its own repeat boundary is seamless (see scripts/build-road.py /
   * build-ground.py). Used only for aspect ratio -- the tile is always
   * displayed at the container's actual width (see the resize-aware sizing
   * below), not a fixed px value, so it stays "infinite" (no visible edge)
   * regardless of viewport size. */
  nativeWidth: number;
  nativeHeight: number;
  /** Seconds for one full vertical scroll cycle (one tile-height). */
  scrollSeconds: number;
}

interface ScrollingBackgroundProps {
  tile: ScrollingTile;
  /** Scrolls continuously while true, holds still otherwise. */
  isMoving: boolean;
  offsetX?: MotionValue<number>;
  offsetY?: MotionValue<number>;
}

/**
 * A continuously vertically-scrolling texture behind the characters --
 * reinforces "walking" independently of the sprite walk-cycle. Scrolls
 * downward (content advances from the top toward the viewer), the usual
 * "moving forward" convention for a scrolling ground plane. Linear easing
 * deliberately, unlike the sprite's stepped frames -- this is a continuous
 * texture translation, not frame-by-frame pixel art.
 */
export function ScrollingBackground({ tile, isMoving, offsetX, offsetY }: ScrollingBackgroundProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dummyOffset = useMotionValue(0);
  const bgPos = useMotionTemplate`${offsetX || dummyOffset}px ${offsetY || dummyOffset}px`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let ctx: gsap.Context;

    const initAnim = () => {
      const rect = el.getBoundingClientRect();
      const currentWidth = rect.width;
      const h = currentWidth * (tile.nativeHeight / tile.nativeWidth);
      
      if (ctx) ctx.revert();
      
      ctx = gsap.context(() => {
        gsap.set(el, { backgroundPositionY: "0px", backgroundSize: `${currentWidth}px ${h}px` });
        if (isMoving) {
          gsap.to(el, {
            backgroundPositionY: `${h}px`,
            duration: tile.scrollSeconds,
            ease: "none",
            repeat: -1,
          });
        }
      });
    };

    initAnim();
    window.addEventListener("resize", initAnim);
    return () => {
      window.removeEventListener("resize", initAnim);
      if (ctx) ctx.revert();
    };
  }, [isMoving, tile.nativeWidth, tile.nativeHeight, tile.scrollSeconds]);

  return (
    <motion.div
      ref={ref}
      className="absolute inset-0"
      style={{
        backgroundImage: `url("${tile.src}")`,
        backgroundRepeat: "repeat",
        ...(isMoving ? {} : { backgroundPosition: bgPos }),
      }}
      aria-hidden
    />
  );
}
