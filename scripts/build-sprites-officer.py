"""
Per-sheet config for public/yaarRadar-assets/officer-sprite.png -- the
actual image processing lives in scripts/sprite_pipeline.py (shared with
build-sprites-purple.py and build-sprites-hat.py). Run manually
(`python scripts/build-sprites-officer.py`) if the source sheet changes.

This sheet is otherwise clean (unlike hat-girl.png, no merged or
duplicated frames -- see scratchpad/detect_boxes_officer2.py), but has two
things the other two don't:

1. A ~2px dark border framing the whole sheet, which threw off a
   corner-sampled background color (the corners are on the border, not the
   green fill). Worked around by trimming a margin before background
   detection -- doesn't affect the crop boxes below, which are already
   well inside the border.

2. Extra content beyond the standard 8-direction/4-frame grid: duplicate
   rows (a second "BACK (UP)" in the LEFT/BACK/RIGHT row, a second
   "FRONT LEFT/RIGHT", a "FRONT STRAIGHT (DOWN)" with 5 frames instead of
   4), plus a whole separate IDLE/SALUTE/FIST pose row and a bonus
   character portrait. Per request, only the 8 directions matching the
   other sprite-* folders are included below -- everything else is
   intentionally left out.
"""

from sprite_pipeline import generate

SRC = "public/yaarRadar-assets/officer-sprite.png"
OUT_DIR = "public/sprites-officer/"

# DOWN and UP both live in the same row (FRONT (DOWN) on the left half,
# BACK (UP) on the right half) -- taken directly from there instead of the
# LEFT/BACK/RIGHT row lower down, which has a second (redundant) copy of
# BACK (UP).
DOWN_WALK = [(93, 147, 148, 266), (179, 147, 234, 266), (270, 147, 324, 266), (357, 145, 413, 266)]
UP_WALK = [(567, 147, 626, 266), (658, 147, 714, 265), (752, 147, 808, 266), (839, 146, 896, 265)]

DOWN_LEFT_WALK = [(85, 340, 139, 457), (173, 340, 224, 456), (260, 339, 315, 457), (349, 339, 402, 454)]
DOWN_RIGHT_WALK = [(565, 338, 617, 456), (658, 339, 710, 454), (754, 340, 806, 458), (845, 339, 898, 454)]

LEFT_WALK = [(45, 530, 94, 642), (116, 530, 167, 641), (190, 530, 240, 641), (265, 530, 315, 642)]
RIGHT_WALK = [(678, 530, 729, 643), (755, 530, 807, 643), (835, 530, 887, 642), (912, 530, 964, 642)]

UP_LEFT_WALK = [(89, 718, 143, 828), (175, 718, 227, 828), (258, 718, 310, 828), (346, 718, 398, 828)]
UP_RIGHT_WALK = [(559, 718, 612, 828), (649, 718, 703, 827), (744, 718, 797, 827), (838, 717, 891, 827)]

DIRECTIONS = {
    "down": DOWN_WALK,
    "downleft": DOWN_LEFT_WALK,
    "downright": DOWN_RIGHT_WALK,
    "left": LEFT_WALK,
    "up": UP_WALK,
    "right": RIGHT_WALK,
    "upleft": UP_LEFT_WALK,
    "upright": UP_RIGHT_WALK,
}

if __name__ == "__main__":
    generate(SRC, OUT_DIR, DIRECTIONS)
