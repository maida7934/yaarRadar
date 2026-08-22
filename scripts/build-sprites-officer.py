"""
Per-sheet config for public/yaarRadar-assets/officer-sprite.png -- the
actual image processing lives in scripts/sprite_pipeline.py (shared with
build-sprites-purple.py and build-sprites-hat.py). Run manually
(`python scripts/build-sprites-officer.py`) if the source sheet changes.

`down`, `upleft`, and `upright` are no longer generated from this sheet --
each has been superseded by its own standalone green-screen sheet, see
build-sprites-officer-down.py and build-sprites-officer-updiag.py.
DOWN_WALK/UP_LEFT_WALK/UP_RIGHT_WALK below are kept only as a record of
where the original crops lived. (Removing upleft/upright from DIRECTIONS
doesn't affect the other 5 directions' shared scale below -- confirmed
neither was the tallest/widest box driving it. Moot now that the scale is
pinned to FILL_HEIGHT_RATIO rather than auto-fitted, but left as a record.)

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
    "downleft": DOWN_LEFT_WALK,
    "downright": DOWN_RIGHT_WALK,
    "left": LEFT_WALK,
    "up": UP_WALK,
    "right": RIGHT_WALK,
}

# Pinned rather than left to sprite_pipeline.generate()'s default auto-fit,
# for the same reason build-sprites-cowboy.py pins its own: officer is split
# across three source sheets (this one, plus -down and -updiag), each scaled
# by a separate call, so "fit the tallest frame flush to the cell" does NOT
# give them a common size -- it gives each sheet its own. This sheet's boxes
# carry more margin around the character than the other two's, so auto-fit
# landed it at a 1.0 fill (scale 1.09, i.e. actually upscaling the source)
# while -down/-updiag sat at 0.846 -- the character visibly grew whenever it
# turned left/right or onto a front diagonal. Matching their 0.846 fixes
# that, and dropping below scale 1.0 also clears the LANCZOS ringing halo
# that upscaling left around the left/right profiles.
#
# 0.846 (not the 0.862 that sprites/, sprites-purple/ and sprites-cowboy/
# share) because it's what -down/-updiag already use: matching them keeps
# the front-facing pose byte-identical instead of regenerating it. The 1.9%
# gap to the other characters is below the visible threshold; if officer
# ever needs to match them exactly, change this and the other two scripts
# to 0.862 together, never one alone.
FILL_HEIGHT_RATIO = 0.846

if __name__ == "__main__":
    generate(SRC, OUT_DIR, DIRECTIONS, fill_height_ratio=FILL_HEIGHT_RATIO)
