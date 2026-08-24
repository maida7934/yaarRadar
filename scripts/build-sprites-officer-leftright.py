"""
Regenerates public/sprites-officer/chibi-{left,right}-{walk,idle}.png from a
standalone green-screen sheet (public/yaarRadar-assets/ChatGPT Image Aug 21,
2026, 10_59_07 PM.png) -- supersedes officer-sprite.png's `left`/`right`
walk boxes in build-sprites-officer.py, the same way build-sprites-officer-
down.py and build-sprites-officer-updiag.py already supersede
`down`/`upleft`/`upright` with their own standalone sheets. Image processing
is the shared scripts/sprite_pipeline.py (chroma-key + spill suppression);
this file only supplies this one sheet's crop boxes.

Unlike the other standalone officer sheets, this one has a genuine
standalone IDLE pose (arms at rest) distinct from the WALK pose
(mid-stride) -- sprite_pipeline.generate()/the other officer scripts always
reuse the walk strip's first frame as idle, so this script calls
sprite_pipeline's lower-level helpers directly instead, to use the real
idle art.

The sheet is a 2-row x 4-column grid: row 1 is one facing-left IDLE/WALK
pair, duplicated once more beside it (both duplicates confirmed
pixel-identical -- not distinct animation frames, so only the first of each
is used); row 2 is the same two poses mirrored to face right (confirmed by
comparing row 2 against a horizontally-flipped row 1 -- much closer than
comparing it unflipped). No separate walk-cycle frames exist (only the one
mid-stride pose per direction), so the walk strip repeats that single frame
4x -- same shape as every other sprite-* walk strip (4 cells, 78x130 each),
so no frontend code needs to change to accommodate this.

Scaled to build-sprites-officer.py's FILL_HEIGHT_RATIO (0.846) so left/right
stay the same size as the rest of the officer set -- see that file for why
this can't be left to sprite_pipeline's usual per-call auto-fit. Run
manually (`python scripts/build-sprites-officer-leftright.py`) if this
source sheet changes.
"""

import numpy as np
from PIL import Image

from sprite_pipeline import CELL_H, CELL_W, build_strip, place_in_cell

SRC = "public/yaarRadar-assets/ChatGPT Image Aug 21, 2026, 10_59_07 PM.png"
OUT_DIR = "public/sprites-officer/"

LEFT_IDLE = (240, 107, 347, 394)
LEFT_WALK = (524, 107, 669, 391)
RIGHT_IDLE = (243, 575, 348, 862)
RIGHT_WALK = (523, 575, 667, 859)

FILL_HEIGHT_RATIO = 0.846

if __name__ == "__main__":
    img = Image.open(SRC).convert("RGB")
    arr_full = np.array(img)

    max_raw_h = max(
        y1 - y0 for _, y0, _, y1 in (LEFT_IDLE, LEFT_WALK, RIGHT_IDLE, RIGHT_WALK)
    )
    scale = (FILL_HEIGHT_RATIO * CELL_H) / max_raw_h

    for name, idle_box, walk_box in (
        ("left", LEFT_IDLE, LEFT_WALK),
        ("right", RIGHT_IDLE, RIGHT_WALK),
    ):
        place_in_cell(img, arr_full, idle_box, scale).save(f"{OUT_DIR}chibi-{name}-idle.png")
        build_strip(img, arr_full, [walk_box] * 4, scale).save(f"{OUT_DIR}chibi-{name}-walk.png")

    print(f"Wrote left/right to {OUT_DIR}, cell size {CELL_W}x{CELL_H}, scale {scale:.3f}.")
