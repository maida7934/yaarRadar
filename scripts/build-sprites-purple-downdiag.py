"""
Regenerates public/sprites-purple/chibi-down{left,right}-{walk,idle}.png,
each from its own standalone green-screen sheet under
public/yaarRadar-assets/ -- downleft and downright were originally both
sourced from the same sheet ("ChatGPT Image Aug 21, 2026, 09_29_59
PM.png", labeled "LEFT"/"RIGHT" on the sheet but really the front-facing
lean pose used for downleft/downright elsewhere in this codebase -- see
build-sprites-purple.py), but downleft has since been superseded by its
own sheet ("ChatGPT Image Aug 21, 2026, 09_45_52 PM.png") per request;
downright still comes from the original sheet.

Image processing lives in scripts/sprite_pipeline.py (the standard
chroma-key + spill-suppression pipeline); this file only supplies each
sheet's 4 crop boxes.

Each direction is scaled independently to a fixed FILL_HEIGHT_RATIO
(0.862) rather than sprite_pipeline's usual "fit the tallest frame flush
to the cell" auto-scale -- matches the character-height fill of
purple-girl-sprite.png's other 6 directions (see build-sprites-purple.py),
so downleft/downright aren't a different size next to up/down/left/right/
upleft/upright just because each is scaled independently off its own
source image. Run manually
(`python scripts/build-sprites-purple-downdiag.py`) if either source
sheet changes.
"""

import numpy as np
from PIL import Image

from sprite_pipeline import CELL_H, CELL_W, build_strip, place_in_cell

DOWNLEFT_SRC = "public/yaarRadar-assets/ChatGPT Image Aug 21, 2026, 09_45_52 PM.png"
DOWNRIGHT_SRC = "public/yaarRadar-assets/ChatGPT Image Aug 21, 2026, 09_29_59 PM.png"
OUT_DIR = "public/sprites-purple/"

DOWN_LEFT_WALK = [(24, 106, 422, 781), (514, 106, 910, 783), (997, 106, 1395, 781), (1485, 106, 1877, 783)]
DOWN_RIGHT_WALK = [(109, 502, 313, 866), (484, 503, 686, 866), (859, 502, 1061, 866), (1235, 503, 1437, 866)]

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
    generate_direction(DOWNLEFT_SRC, "downleft", DOWN_LEFT_WALK)
    generate_direction(DOWNRIGHT_SRC, "downright", DOWN_RIGHT_WALK)
