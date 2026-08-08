"""
One-time preprocessing of public/yaarRadar-assets/spritefinal.jpeg (a
clean, properly-labeled 8-directional chibi sheet) into uniform,
transparent sprite strips for the Find scene. Not part of the app's
runtime -- run manually (`python scripts/build-sprites.py`) whenever the
source sheet or the crop boxes below change; output lives in
public/sprites/.

Unlike the earlier ripped Dark Magician Girl sheet, this one has genuine,
correctly-mirrored art for all 8 directions (verified: flipping a `right`
frame matches the corresponding `left` frame almost exactly), so no
per-direction mirroring workarounds are needed. This is what makes the
turn/settle state machine in SpriteCharacter.tsx possible for *both*
characters: "left"/"right" are real profile turns, "upleft"/"upright"/
"downleft"/"downright" are real forward-diagonal walks -- not one pose
standing in for another.

The source combines 3 direction-groups per row band in one spot (LEFT,
BACK/UP, RIGHT) with two of those groups having a merged frame-pair (no
green gap between them, so they'd otherwise show up as one wide box) --
the "left"/"right" boxes below split those merges at the midpoint, which
lines up with the frame width seen elsewhere in that same band.

Frames are placed into a fixed cell, anchored horizontal-center /
vertical-bottom (feet on a consistent baseline) so stepping through them
doesn't jitter vertically.
"""

from PIL import Image

SRC = "public/yaarRadar-assets/spritefinal.jpeg"
OUT_DIR = "public/sprites/"

# (x0, y0, x1, y1) tight bounding boxes, hand-derived from the source sheet.
DOWN_WALK = [(193, 144, 265, 270), (293, 144, 363, 270), (390, 144, 462, 270), (488, 144, 562, 270)]
DOWN_LEFT_WALK = [(32, 381, 94, 496), (116, 380, 178, 496), (199, 381, 261, 496), (283, 381, 345, 496)]
DOWN_RIGHT_WALK = [(399, 381, 459, 496), (483, 381, 544, 496), (569, 381, 629, 496), (652, 381, 714, 496)]
LEFT_WALK = [(17, 617, 71, 729), (71, 617, 125, 729), (126, 617, 180, 728), (183, 617, 237, 730)]
UP_WALK = [(254, 617, 311, 730), (315, 618, 372, 730), (377, 618, 433, 729), (437, 618, 494, 730)]
RIGHT_WALK = [(506, 617, 559, 730), (562, 618, 617, 730), (618, 617, 674, 730), (674, 617, 730, 729)]
UP_LEFT_WALK = [(29, 851, 95, 972), (115, 851, 182, 972), (202, 851, 267, 972), (290, 851, 357, 972)]
UP_RIGHT_WALK = [(390, 853, 455, 972), (476, 852, 541, 972), (562, 852, 627, 972), (650, 851, 714, 972)]

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

CELL_W, CELL_H = 78, 130


def is_greenish(r, g, b):
    return g > 120 and r < 100 and b < 100


def dechroma(frame):
    frame = frame.convert("RGBA")
    px = frame.load()
    for y in range(frame.height):
        for x in range(frame.width):
            r, g, b, a = px[x, y]
            if is_greenish(r, g, b):
                px[x, y] = (r, g, b, 0)
    return frame


def place_in_cell(img, box):
    frame = dechroma(img.crop(box))
    cell = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    x = (CELL_W - frame.width) // 2
    y = CELL_H - frame.height  # anchor feet to the bottom of the cell
    cell.paste(frame, (x, y), frame)
    return cell


def build_strip(img, boxes):
    strip = Image.new("RGBA", (CELL_W * len(boxes), CELL_H), (0, 0, 0, 0))
    for i, box in enumerate(boxes):
        strip.paste(place_in_cell(img, box), (i * CELL_W, 0))
    return strip


def main():
    img = Image.open(SRC).convert("RGB")

    for name, boxes in DIRECTIONS.items():
        build_strip(img, boxes).save(f"{OUT_DIR}chibi-{name}-walk.png")
        place_in_cell(img, boxes[0]).save(f"{OUT_DIR}chibi-{name}-idle.png")

    print(f"Wrote {len(DIRECTIONS)} directions to {OUT_DIR}, cell size {CELL_W}x{CELL_H}, 4 walk frames each.")


if __name__ == "__main__":
    main()
