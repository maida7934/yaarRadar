import type { ScrollingTile } from "./ScrollingBackground";

// See scripts/build-road.py -- mirrored stone-road texture.
export const ROAD_TILE: ScrollingTile = {
  src: "/backgrounds/road-tile.png",
  nativeWidth: 1000,
  nativeHeight: 400,
  scrollSeconds: 3.5,
};

// See scripts/build-ground.py -- 2x2-mirrored (both axes) top-down grass
// texture; the source has no sky/horizon to crop, so both directions
// needed mirroring, unlike the road tile. (This got pointed at the raw,
// un-mirrored Road 3.png asset directly at one point -- that's the exact
// seam-generating file the mirroring exists to avoid; restored here.)
export const GROUND_TILE: ScrollingTile = {
  src: "/backgrounds/ground-tile.png",
  nativeWidth: 1472,
  nativeHeight: 840,
  scrollSeconds: 5,
};
