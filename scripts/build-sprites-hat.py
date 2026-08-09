"""
Per-sheet config for public/yaarRadar-assets/hat-girl.png -- the actual
image processing lives in scripts/sprite_pipeline.py (shared with
build-sprites-purple.py and any future sheet). Run manually
(`python scripts/build-sprites-hat.py`) if the source sheet changes.

Two things make this sheet's boxes different from build-sprites-purple.py:

1. The wizard hat is wide enough that frames visually touch/overlap within
   the LEFT / BACK(UP) / RIGHT row -- blob detection (see
   scratchpad/detect_boxes_hat.py) merged each of those three 4-frame
   groups into one blob per group. Verified by eye (cropped the row) that
   each merged group really is 4 roughly-equal-width frames, not a
   different count, so LEFT_WALK/UP_WALK/RIGHT_WALK below split each
   group's total span into 4 even slices rather than using exact
   per-frame edges.

2. The BACK LEFT (UP-LEFT) and BACK RIGHT (UP-RIGHT) rows have a genuine
   authoring mistake in the source sheet itself: 5 rendered frames where 4
   are labeled, with the first frame duplicated (visible on the BACK
   RIGHT row's own frame-number labels: "1 1 2 3 4"). Confirmed by
   cropping both the labeled row and the two candidate duplicate frames --
   both are full, distinct character renders, not a detection artifact.
   UP_LEFT_WALK/UP_RIGHT_WALK below keep frames [1st, 3rd, 4th, 5th] and
   drop the duplicate 2nd.
"""

from sprite_pipeline import generate

SRC = "public/yaarRadar-assets/hat-girl.png"
OUT_DIR = "public/sprites-hat/"

DOWN_WALK = [(225, 128, 305, 257), (335, 128, 415, 257), (445, 127, 525, 257), (554, 128, 636, 257)]
DOWN_LEFT_WALK = [(28, 342, 114, 472), (120, 342, 205, 471), (211, 342, 297, 471), (304, 342, 388, 471)]
DOWN_RIGHT_WALK = [(481, 342, 563, 471), (570, 341, 654, 470), (667, 342, 749, 469), (755, 342, 843, 470)]
LEFT_WALK = [(9, 555, 79, 686), (79, 555, 149, 686), (149, 555, 219, 686), (219, 555, 288, 686)]
UP_WALK = [(297, 555, 368, 676), (368, 555, 439, 676), (439, 555, 509, 676), (509, 555, 580, 676)]
RIGHT_WALK = [(581, 555, 654, 686), (654, 555, 727, 686), (727, 555, 800, 686), (800, 555, 874, 686)]
UP_LEFT_WALK = [(26, 784, 100, 901), (167, 791, 244, 901), (238, 790, 317, 899), (312, 788, 391, 898)]
UP_RIGHT_WALK = [(490, 784, 568, 901), (644, 787, 722, 901), (722, 787, 800, 901), (801, 791, 879, 901)]

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
