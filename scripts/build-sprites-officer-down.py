"""
Regenerates just public/sprites-officer/chibi-down-{walk,idle}.png from a
standalone green-screen sheet (public/yaarRadar-assets/Screenshot
2026-08-21 190433.png) -- a different character render than the rest of
officer-sprite.png's 7 directions (see build-sprites-officer.py), supplied
separately per request. Image processing lives in scripts/sprite_pipeline.py
(the standard chroma-key + spill-suppression pipeline, same as
build-sprites-cowboy.py etc.); this file only supplies this one sheet's 4
crop boxes.

Scaled to a fixed FILL_HEIGHT_RATIO (0.846) rather than sprite_pipeline's
usual "fit the tallest frame flush to the cell" auto-scale -- this sheet is
scaled by its own call, so without pinning it would come out a different
size next to up/left/right/etc. build-sprites-officer.py now pins the same
0.846; keep the two in sync, and change them together or not at all.
(Until 2026-08-22 this note claimed 0.846 already matched that sheet's
fill. It did not -- that sheet was auto-fitting to a 1.0 fill, which is
exactly why the character grew when it turned left/right.) Run manually
(`python scripts/build-sprites-officer-down.py`) if this source sheet
changes.
"""

import numpy as np
from PIL import Image

from sprite_pipeline import CELL_H, CELL_W, build_strip, place_in_cell

SRC = "public/yaarRadar-assets/Screenshot 2026-08-21 190433.png"
OUT_DIR = "public/sprites-officer/"

DOWN_WALK = [(44, 50, 160, 320), (270, 50, 386, 327), (487, 50, 604, 327), (708, 50, 825, 325)]

FILL_HEIGHT_RATIO = 0.846

if __name__ == "__main__":
    img = Image.open(SRC).convert("RGB")
    arr_full = np.array(img)

    max_raw_h = max(y1 - y0 for x0, y0, x1, y1 in DOWN_WALK)
    scale = (FILL_HEIGHT_RATIO * CELL_H) / max_raw_h

    build_strip(img, arr_full, DOWN_WALK, scale).save(f"{OUT_DIR}chibi-down-walk.png")
    place_in_cell(img, arr_full, DOWN_WALK[0], scale).save(f"{OUT_DIR}chibi-down-idle.png")
    print(f"Wrote down to {OUT_DIR}, cell size {CELL_W}x{CELL_H}, scale {scale:.3f}, 4 walk frames.")
