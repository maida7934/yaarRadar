"""
Adds the 4 diagonal directions -- downleft/downright/upleft/upright -- to
the cowboy character (public/sprites-cowboy/), which previously only had
the 4 cardinal directions (see build-sprites-cowboy.py's docstring: "Only
4 directions (down/up/left/right), no diagonals ... matching what these
source sheets actually contain"). Two new standalone green-screen sheets
under public/yaarRadar-assets/ supply them, each a 2-row x 4-frame grid,
unlabeled, top row then bottom row per request:

- "ChatGPT Image Aug 21, 2026, 09_50_04 PM.png": front-facing (toward
  camera) lean pose -- top row -> downleft, bottom row -> downright.
- "ChatGPT Image Aug 21, 2026, 09_51_02 PM.png": back-facing (walking
  away) lean pose -- top row -> upleft, bottom row -> upright.

Image processing lives in scripts/sprite_pipeline.py (the standard
chroma-key + spill-suppression pipeline); this file only supplies each
sheet's 8 crop boxes. Each direction is scaled independently to a fixed
FILL_HEIGHT_RATIO (0.862), matching the cardinal directions' own fill (see
build-sprites-cowboy.py) so the diagonals aren't a different size next to
them just because they're scaled off their own source sheets. Run
manually (`python scripts/build-sprites-cowboy-diag.py`) if either source
sheet changes.
"""

import numpy as np
from PIL import Image

from sprite_pipeline import CELL_H, CELL_W, build_strip, place_in_cell

DOWN_DIAG_SRC = "public/yaarRadar-assets/ChatGPT Image Aug 21, 2026, 09_50_04 PM.png"
UP_DIAG_SRC = "public/yaarRadar-assets/ChatGPT Image Aug 21, 2026, 09_51_02 PM.png"
OUT_DIR = "public/sprites-cowboy/"

DOWN_LEFT_WALK = [(287, 60, 448, 370), (623, 65, 808, 376), (1004, 60, 1163, 370), (1329, 64, 1492, 376)]
DOWN_RIGHT_WALK = [(256, 495, 413, 806), (592, 497, 762, 810), (974, 495, 1132, 806), (1314, 497, 1484, 811)]
UP_LEFT_WALK = [(285, 104, 418, 388), (629, 105, 778, 395), (986, 104, 1119, 388), (1322, 104, 1463, 396)]
UP_RIGHT_WALK = [(307, 508, 442, 789), (615, 508, 762, 796), (1008, 508, 1143, 789), (1321, 508, 1465, 796)]

FILL_HEIGHT_RATIO = 0.862


def generate_direction(src, name, boxes):
    img = Image.open(src).convert("RGB")
    arr_full = np.array(img)
    max_raw_h = max(y1 - y0 for x0, y0, x1, y1 in boxes)
    scale = (FILL_HEIGHT_RATIO * CELL_H) / max_raw_h
    build_strip(img, arr_full, boxes, scale).save(f"{OUT_DIR}chibi-{name}-walk.png")
    place_in_cell(img, arr_full, boxes[0], scale).save(f"{OUT_DIR}chibi-{name}-idle.png")
    print(f"Wrote {name} to {OUT_DIR}, cell size {CELL_W}x{CELL_H}, scale {scale:.3f}, 4 walk frames.")


if __name__ == "__main__":
    generate_direction(DOWN_DIAG_SRC, "downleft", DOWN_LEFT_WALK)
    generate_direction(DOWN_DIAG_SRC, "downright", DOWN_RIGHT_WALK)
    generate_direction(UP_DIAG_SRC, "upleft", UP_LEFT_WALK)
    generate_direction(UP_DIAG_SRC, "upright", UP_RIGHT_WALK)
