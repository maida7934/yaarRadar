"""
Regenerates public/sprites-officer/chibi-up{left,right}-{walk,idle}.png
from a standalone green-screen sheet (public/yaarRadar-assets/officer.png)
-- a different character render than the rest of officer-sprite.png's
directions (same "suit man" character as build-sprites-officer-down.py,
not the uniformed officer), supplied separately per request. Two
unlabeled rows of 4 frames each, both back-facing (walking away).

Row mapping confirmed by request: TOP row -> upright, BOTTOM row ->
upleft (the opposite of the naive top-then-bottom guess used elsewhere --
see build-sprites-purple-downdiag.py's note about the same kind of mirrored
row order on a different sheet). Don't "fix" this back.

Image processing lives in scripts/sprite_pipeline.py (the standard
chroma-key + spill-suppression pipeline); this file only supplies this
one sheet's 8 crop boxes. Scaled to a fixed FILL_HEIGHT_RATIO (0.846),
matching officer-sprite.png's other directions' own fill (see
build-sprites-officer.py) and build-sprites-officer-down.py's same
reasoning, so upleft/upright aren't a different size just because they're
scaled independently off their own source sheet. Run manually
(`python scripts/build-sprites-officer-updiag.py`) if this source sheet
changes.
"""

import numpy as np
from PIL import Image

from sprite_pipeline import CELL_H, CELL_W, build_strip, place_in_cell

SRC = "public/yaarRadar-assets/officer.png"
OUT_DIR = "public/sprites-officer/"

UP_RIGHT_WALK = [(213, 92, 334, 401), (527, 92, 670, 399), (869, 92, 989, 400), (1168, 92, 1323, 399)]
UP_LEFT_WALK = [(226, 563, 343, 866), (522, 563, 660, 865), (874, 563, 991, 867), (1174, 563, 1323, 866)]

FILL_HEIGHT_RATIO = 0.846

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
