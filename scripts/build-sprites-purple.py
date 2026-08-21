"""
Per-sheet config for public/yaarRadar-assets/purple-girl-sprite.png -- the
actual image processing lives in scripts/sprite_pipeline.py (shared with
build-sprites-hat.py and any future sheet). Run manually
(`python scripts/build-sprites-purple.py`) if the source sheet changes.

The 32 per-frame crop boxes below were found by connected-component blob
detection (scipy.ndimage.label) against a per-image-sampled background
color, not hand-eyeballed -- this sheet's layout doesn't line up 1:1 with
spritefinal.jpeg's (different image size, an extra duplicate row), so the
original build-sprites.py's hardcoded boxes don't apply. The two BACK/UP
frames that came out merged (the character's hair overlaps the
neighboring frame slot) are split evenly after detection -- see UP_WALK.

`downleft`/`downright`/`upleft`/`upright` are no longer generated from
this sheet -- see build-sprites-purple-downdiag.py and
build-sprites-purple-updiag.py. DOWN_LEFT_WALK/DOWN_RIGHT_WALK/
UP_LEFT_WALK/UP_RIGHT_WALK below are kept only as a record of where the
original crops lived.
"""

from sprite_pipeline import generate

SRC = "public/yaarRadar-assets/purple-girl-sprite.png"
OUT_DIR = "public/sprites-purple/"

DOWN_WALK = [(204, 147, 296, 291), (326, 147, 419, 291), (452, 147, 544, 291), (577, 147, 670, 291)]
DOWN_LEFT_WALK = [(36, 398, 113, 533), (133, 400, 206, 536), (231, 401, 304, 536), (327, 401, 398, 533)]
DOWN_RIGHT_WALK = [(477, 399, 550, 533), (570, 399, 644, 535), (667, 399, 740, 535), (763, 398, 838, 533)]
LEFT_WALK = [(6, 662, 75, 792), (77, 662, 146, 792), (148, 662, 217, 792), (218, 662, 285, 792)]
UP_WALK = [(304, 662, 373, 794), (373, 662, 442, 794), (444, 662, 512, 794), (512, 662, 580, 794)]
RIGHT_WALK = [(595, 662, 663, 792), (666, 662, 734, 792), (739, 661, 808, 792), (810, 661, 880, 792)]
UP_LEFT_WALK = [(42, 910, 117, 1041), (136, 910, 210, 1041), (233, 910, 307, 1042), (327, 910, 405, 1042)]
UP_RIGHT_WALK = [(488, 909, 565, 1041), (582, 909, 656, 1041), (679, 909, 753, 1041), (775, 909, 848, 1041)]

DIRECTIONS = {
    "down": DOWN_WALK,
    "left": LEFT_WALK,
    "up": UP_WALK,
    "right": RIGHT_WALK,
}

if __name__ == "__main__":
    generate(SRC, OUT_DIR, DIRECTIONS)
