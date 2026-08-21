"""
Regenerates public/sprites-purple/chibi-up{left,right}-{walk,idle}.png
from a standalone green-screen sheet (public/yaarRadar-assets/chici.png)
-- two unlabeled rows of 4 frames each, both back-facing (walking away).

Row mapping confirmed by request: TOP row -> upright, BOTTOM row ->
upleft. (Note this is the opposite of the naive top-then-bottom guess --
see build-sprites-purple-downdiag.py's note about the downleft/downright
sheets being mirrored the same way relative to the sheets' own visual
layout. Don't "fix" this back.)

Image processing lives in scripts/sprite_pipeline.py (the standard
chroma-key + spill-suppression pipeline); this file only supplies this
one sheet's 8 crop boxes.

Scaled to a fixed FILL_HEIGHT_RATIO (0.862), same reasoning as
build-sprites-purple-downdiag.py -- matches the other 6 directions'
character-height fill so upleft/upright aren't a different size just
because they're scaled independently off their own source image. Run
manually (`python scripts/build-sprites-purple-updiag.py`) if this source
sheet changes.
"""

import numpy as np
from PIL import Image

from sprite_pipeline import CELL_H, CELL_W, build_strip, place_in_cell

SRC = "public/yaarRadar-assets/chici.png"
OUT_DIR = "public/sprites-purple/"

UP_RIGHT_WALK = [(292, 50, 467, 374), (619, 50, 795, 381), (977, 50, 1145, 381), (1311, 50, 1486, 381)]
UP_LEFT_WALK = [(287, 491, 461, 815), (637, 491, 806, 822), (976, 491, 1155, 822), (1333, 491, 1508, 822)]

FILL_HEIGHT_RATIO = 0.862

if __name__ == "__main__":
    img = Image.open(SRC).convert("RGB")
    arr_full = np.array(img)

    all_boxes = UP_LEFT_WALK + UP_RIGHT_WALK
    max_raw_h = max(y1 - y0 for x0, y0, x1, y1 in all_boxes)
    scale = (FILL_HEIGHT_RATIO * CELL_H) / max_raw_h

    for name, boxes in [("upleft", UP_LEFT_WALK), ("upright", UP_RIGHT_WALK)]:
        build_strip(img, arr_full, boxes, scale).save(f"{OUT_DIR}chibi-{name}-walk.png")
        place_in_cell(img, arr_full, boxes[0], scale).save(f"{OUT_DIR}chibi-{name}-idle.png")
        print(f"Wrote {name} to {OUT_DIR}, cell size {CELL_W}x{CELL_H}, scale {scale:.3f}, 4 walk frames.")
