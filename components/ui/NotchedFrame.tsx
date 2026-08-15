"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/** A rectangle with a 2-step pixel staircase cut into each corner, as an SVG
 * `points` string. Used for every notched-outline frame across the app --
 * takes the box's own (x0,y0,w,h) so the same shape can be nested at
 * different insets to build up concentric rings. `s` is the step size, kept
 * as a fixed real-pixel amount rather than a proportion of the box, so
 * corners stay uniform regardless of the box's size. */
export function notchedRectPoints(x0: number, y0: number, w: number, h: number, s: number): string {
  const points: [number, number][] = [
    [x0 + 2 * s, y0],
    [x0 + w - 2 * s, y0],
    [x0 + w - 2 * s, y0 + s],
    [x0 + w - s, y0 + s],
    [x0 + w - s, y0 + 2 * s],
    [x0 + w, y0 + 2 * s],
    [x0 + w, y0 + h - 2 * s],
    [x0 + w - s, y0 + h - 2 * s],
    [x0 + w - s, y0 + h - s],
    [x0 + w - 2 * s, y0 + h - s],
    [x0 + w - 2 * s, y0 + h],
    [x0 + 2 * s, y0 + h],
    [x0 + 2 * s, y0 + h - s],
    [x0 + s, y0 + h - s],
    [x0 + s, y0 + h - 2 * s],
    [x0, y0 + h - 2 * s],
    [x0, y0 + 2 * s],
    [x0 + s, y0 + 2 * s],
    [x0 + s, y0 + s],
    [x0 + 2 * s, y0 + s],
  ];
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

/** A stack of concentric filled notched-corner rings, sized to its own parent
 * via ResizeObserver, so a box's frame stays crisp and unstretched no matter
 * its actual measured width/height (unlike a fixed-resolution PNG run
 * through border-image). `colors` goes outer -> inner; the last color
 * becomes the element's visible fill wherever nothing else covers it, so the
 * element itself needs no separate CSS background. Pass just two colors
 * (border, fill) for a plain single-outline box -- e.g. the same simple
 * look as the Friends page's FRIENDS/VIEW REQUESTS container -- or four for
 * the fuller double-outline "staircase" banner look used for headings.
 * Rendered behind the element's normal content via zIndex:-1 (the parent
 * must be position:relative so the negative z-index resolves within its own
 * stacking context instead of falling behind the whole page). */
export function NotchedFrame({ colors, step = 4, ringWidth = 4 }: { colors: string[]; step?: number; ringWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none" style={{ zIndex: -1 } as CSSProperties} aria-hidden>
      {size.width > 0 && size.height > 0 && (
        <svg className="absolute inset-0" width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} shapeRendering="crispEdges">
          {colors.map((color, i) => {
            const inset = i * ringWidth;
            return (
              <polygon
                key={i}
                points={notchedRectPoints(inset, inset, size.width - inset * 2, size.height - inset * 2, step)}
                fill={color}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
