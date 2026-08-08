"use client";

import { useEffect } from "react";

/** Warms the browser's image cache so later swaps (e.g. a sprite direction
 * change) don't flash blank while a never-before-requested image loads. */
export function usePreloadImages(srcs: string[]) {
  useEffect(() => {
    const images = srcs.map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });
    return () => {
      images.forEach((img) => {
        img.src = "";
      });
    };
  }, [srcs]);
}
