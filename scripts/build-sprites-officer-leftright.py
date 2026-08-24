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
mid-stride pose per direction) -- pasting that single pose into all 4 walk
cells unmodified (as build_strip would) plays back as motionless, since
SpriteCharacter's isMoving branch just steps through 4 identical frames.
BOB_OFFSETS below fakes a walking bounce instead -- the one pose nudged up
1-2px on alternating frames -- so isMoving actually reads as walking rather
than a frozen repeat of the idle-look pose. Still the same shape as every
other sprite-* walk strip (4 cells, 78x130 each), so no frontend code needs
to change to accommodate this.

Scaled to build-sprites-officer.py's FILL_HEIGHT_RATIO (0.846) so left/right
stay the same size as the rest of the officer set -- see that file for why
this can't be left to sprite_pipeline's usual per-call auto-fit. Run
manually (`python scripts/build-sprites-officer-leftright.py`) if this
source sheet changes.
"""

import numpy as np
from PIL import Image

from sprite_pipeline import CELL_H, CELL_W, place_in_cell

SRC = "public/yaarRadar-assets/ChatGPT Image Aug 21, 2026, 10_59_07 PM.png"
OUT_DIR = "public/sprites-officer/"

LEFT_IDLE = (240, 107, 347, 394)
LEFT_WALK = (524, 107, 669, 391)
RIGHT_IDLE = (243, 575, 348, 862)
RIGHT_WALK = (523, 575, 667, 859)

FILL_HEIGHT_RATIO = 0.846

# Vertical nudge (px, negative = up) applied to the one walk pose per frame
# -- a gentle single bob across the loop (up, peak, back down) rather than
# a real leg-alternating cycle, since none exists in the source art. Small
# enough to stay inside the headroom already above the character in its
# cell (character fills ~85% of CELL_H, anchored to the bottom) so nothing
# clips.
BOB_OFFSETS = [0, -1, -2, -1]


def build_bob_strip(walk_cell):
    strip = Image.new("RGBA", (CELL_W * len(BOB_OFFSETS), CELL_H), (0, 0, 0, 0))
    for i, dy in enumerate(BOB_OFFSETS):
        strip.paste(walk_cell, (i * CELL_W, dy), walk_cell)
    return strip


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
        walk_cell = place_in_cell(img, arr_full, walk_box, scale)
        build_bob_strip(walk_cell).save(f"{OUT_DIR}chibi-{name}-walk.png")

    print(f"Wrote left/right to {OUT_DIR}, cell size {CELL_W}x{CELL_H}, scale {scale:.3f}.")
