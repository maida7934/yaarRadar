"""
Per-sheet config for the cowboy character -- split across four source
sheets under public/yaarRadar-assets/, same green-screen idle/walk/idle/
walk (or idle/walk/walk/idle) 4-frame layout as the other sheets but
produced separately:

- "Screenshot 2026-08-21 135632.png": WALK LEFT row (left) -- originally
  also had WALK FRONT and WALK BACK rows, each superseded by its own
  standalone sheet below.
- "ChatGPT Image Aug 21, 2026, 02_41_26 PM.png": a standalone WALK FRONT
  sheet (down) at a much higher source resolution than the first sheet.
- "Screenshot 2026-08-21 155748.png": a standalone WALK BACK sheet (up).
- "ChatGPT Image Aug 21, 2026, 02_20_35 PM.png": a standalone WALK RIGHT
  sheet, also at a much higher source resolution than the first sheet.

The crop boxes below were found by connected-component blob detection
(scipy.ndimage.label against green-excess) rather than hand-eyeballed --
see build-sprites-purple.py's docstring for why.

Unlike sprite_pipeline.generate() (which fits each direction's tallest
frame flush to the cell edges, scale = min(CELL_W/max_w, CELL_H/max_h)),
each direction here is scaled to a fixed FILL_HEIGHT_RATIO of CELL_H
instead. These sheets' blob-detected boxes hug the character much more
tightly (near-zero margin above the hat) than sprites/sprites-purple/
sprites-officer's boxes do, so fitting flush left the cowboy filling
~97-100% of the cell with ~0% headroom -- looking visibly larger/more
tightly cropped than every other character wherever avatars are shown
side by side (e.g. the Me page bio-box avatar, which crops all
characters' chibi-down-idle.png with the same fixed background-position).
0.862 matches sprites/ and sprites-purple/'s own down-idle headroom
(their chibi-down-idle.png characters fill 86.2% of the 130px cell,
anchored to the bottom) so cowboy now reads as the same size as every
other character, not just internally consistent across its own 4
directions.

Only 4 directions (down/up/left/right), no diagonals -- same as
sprites-whiteboy/, matching what these source sheets actually contain.
Image processing lives in scripts/sprite_pipeline.py; run manually
(`python scripts/build-sprites-cowboy.py`) if any source sheet changes.
"""

import os

import numpy as np
from PIL import Image

from sprite_pipeline import CELL_H, CELL_W, build_strip, place_in_cell

LEFT_SRC = "public/yaarRadar-assets/Screenshot 2026-08-21 135632.png"
DOWN_SRC = "public/yaarRadar-assets/ChatGPT Image Aug 21, 2026, 02_41_26 PM.png"
UP_SRC = "public/yaarRadar-assets/Screenshot 2026-08-21 155748.png"
RIGHT_SRC = "public/yaarRadar-assets/ChatGPT Image Aug 21, 2026, 02_20_35 PM.png"
OUT_DIR = "public/sprites-cowboy/"

DOWN_WALK = [(404, 68, 615, 476), (787, 68, 999, 485), (1171, 68, 1382, 485), (1554, 68, 1771, 485)]
UP_WALK = [(39, 25, 195, 324), (284, 26, 440, 333), (534, 26, 690, 333), (797, 26, 954, 332)]
LEFT_WALK = [(141, 504, 202, 641), (261, 504, 333, 641), (388, 504, 450, 641), (515, 504, 584, 641)]
RIGHT_WALK = [(425, 64, 626, 516), (782, 67, 1014, 517), (1205, 67, 1407, 517), (1576, 69, 1820, 511)]

FILL_HEIGHT_RATIO = 0.862


def generate_direction(src, out_dir, direction, boxes):
    os.makedirs(out_dir, exist_ok=True)
    img = Image.open(src).convert("RGB")
    arr_full = np.array(img)

    max_raw_h = max(y1 - y0 for x0, y0, x1, y1 in boxes)
    scale = (FILL_HEIGHT_RATIO * CELL_H) / max_raw_h

    build_strip(img, arr_full, boxes, scale).save(f"{out_dir}chibi-{direction}-walk.png")
    place_in_cell(img, arr_full, boxes[0], scale).save(f"{out_dir}chibi-{direction}-idle.png")
    print(f"Wrote {direction} to {out_dir}, cell size {CELL_W}x{CELL_H}, scale {scale:.3f}, 4 walk frames.")


if __name__ == "__main__":
    generate_direction(LEFT_SRC, OUT_DIR, "left", LEFT_WALK)
    generate_direction(DOWN_SRC, OUT_DIR, "down", DOWN_WALK)
    generate_direction(UP_SRC, OUT_DIR, "up", UP_WALK)
    generate_direction(RIGHT_SRC, OUT_DIR, "right", RIGHT_WALK)
