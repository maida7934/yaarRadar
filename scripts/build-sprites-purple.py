"""
One-time preprocessing of public/yaarRadar-assets/purple-girl-sprite.png (a
second chibi sheet, same "ripped by Dazz" template as spritefinal.jpeg but a
different source image/layout) into uniform, transparent sprite strips.

Output-only addition: writes to public/sprites-purple/, mirroring the shape
of public/sprites/ (same chibi-{direction}-{walk,idle}.png naming per
direction, same 78x130 cell size) but does not touch public/sprites/,
spriteSets.ts, or anything else already wired into the app.

Not part of the app's runtime -- run manually
(`python scripts/build-sprites-purple.py`) if the source sheet changes.

Unlike build-sprites.py, the 32 per-frame crop boxes below were found by
connected-component blob detection (scipy.ndimage.label) against a
per-image-sampled background color, not hand-eyeballed -- this sheet's
layout doesn't line up 1:1 with spritefinal.jpeg's (different image size,
an extra duplicate row), so the old hardcoded boxes don't apply. The two
BACK/UP frames only that came out merged (the character's hair overlaps
the neighboring frame slot) are split evenly after detection -- see
UP_WALK below.
"""

from PIL import Image

SRC = "public/yaarRadar-assets/purple-girl-sprite.png"
OUT_DIR = "public/sprites-purple/"

# (x0, y0, x1, y1) boxes, found via blob detection on this specific sheet
# (see scratchpad/detect_boxes.py) -- these are specific to this image's
# layout/resolution, not reusable for a different source sheet.
DOWN_WALK = [(204, 147, 296, 291), (326, 147, 419, 291), (452, 147, 544, 291), (577, 147, 670, 291)]
DOWN_LEFT_WALK = [(36, 398, 113, 533), (133, 400, 206, 536), (231, 401, 304, 536), (327, 401, 398, 533)]
DOWN_RIGHT_WALK = [(477, 399, 550, 533), (570, 399, 644, 535), (667, 399, 740, 535), (763, 398, 838, 533)]
LEFT_WALK = [(6, 662, 75, 792), (77, 662, 146, 792), (148, 662, 217, 792), (218, 662, 285, 792)]
# The sheet's two BACK(UP) blobs came out merged pairwise by the character's
# long hair touching the neighboring frame -- (304,662,442,794) is really
# frames 1+2, (444,662,580,794) is really frames 3+4. Split each in half.
UP_WALK = [(304, 662, 373, 794), (373, 662, 442, 794), (444, 662, 512, 794), (512, 662, 580, 794)]
RIGHT_WALK = [(595, 662, 663, 792), (666, 662, 734, 792), (739, 661, 808, 792), (810, 661, 880, 792)]
UP_LEFT_WALK = [(42, 910, 117, 1041), (136, 910, 210, 1041), (233, 910, 307, 1042), (327, 910, 405, 1042)]
UP_RIGHT_WALK = [(488, 909, 565, 1041), (582, 909, 656, 1041), (679, 909, 753, 1041), (775, 909, 848, 1041)]

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

# Same target cell size as public/sprites/ (see spriteSets.ts CELL_WIDTH/
# CELL_HEIGHT) so this character is drop-in compatible with the existing
# SpriteSet shape if it's wired in later.
CELL_W, CELL_H = 78, 130

# This sheet's art is drawn larger relative to its frame slot than
# spritefinal.jpeg's -- the biggest raw crop (DOWN, 93x144) doesn't fit in
# a 78x130 cell. A single uniform scale factor (computed from the largest
# crop, applied to every frame) shrinks everything to fit while keeping
# this character's own proportions consistent across directions -- e.g.
# DOWN stays visibly the "tallest" pose relative to LEFT/RIGHT, same as in
# the source, just scaled down as a whole rather than per-frame.
ALL_BOXES = [box for boxes in DIRECTIONS.values() for box in boxes]
MAX_RAW_W = max(x1 - x0 for x0, y0, x1, y1 in ALL_BOXES)
MAX_RAW_H = max(y1 - y0 for x0, y0, x1, y1 in ALL_BOXES)
SCALE = min(CELL_W / MAX_RAW_W, CELL_H / MAX_RAW_H)


def sample_background(img):
    w, h = img.size
    corners = [img.getpixel((0, 0)), img.getpixel((w - 1, 0)), img.getpixel((0, h - 1)), img.getpixel((w - 1, h - 1))]
    r = sum(c[0] for c in corners) / 4
    g = sum(c[1] for c in corners) / 4
    b = sum(c[2] for c in corners) / 4
    return r, g, b


def dechroma(frame, bg, threshold=40):
    frame = frame.convert("RGBA")
    px = frame.load()
    br, bg_, bb = bg
    for y in range(frame.height):
        for x in range(frame.width):
            r, g, b, a = px[x, y]
            dist = ((r - br) ** 2 + (g - bg_) ** 2 + (b - bb) ** 2) ** 0.5
            if dist < threshold:
                px[x, y] = (r, g, b, 0)
    return frame


def place_in_cell(img, box, bg):
    frame = dechroma(img.crop(box), bg)
    scaled_w = max(1, round(frame.width * SCALE))
    scaled_h = max(1, round(frame.height * SCALE))
    frame = frame.resize((scaled_w, scaled_h), Image.LANCZOS)
    cell = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    x = (CELL_W - frame.width) // 2
    y = CELL_H - frame.height  # anchor feet to the bottom of the cell
    cell.paste(frame, (x, y), frame)
    return cell


def build_strip(img, boxes, bg):
    strip = Image.new("RGBA", (CELL_W * len(boxes), CELL_H), (0, 0, 0, 0))
    for i, box in enumerate(boxes):
        strip.paste(place_in_cell(img, box, bg), (i * CELL_W, 0))
    return strip


def main():
    import os

    os.makedirs(OUT_DIR, exist_ok=True)
    img = Image.open(SRC).convert("RGB")
    bg = sample_background(img)

    for name, boxes in DIRECTIONS.items():
        build_strip(img, boxes, bg).save(f"{OUT_DIR}chibi-{name}-walk.png")
        place_in_cell(img, boxes[0], bg).save(f"{OUT_DIR}chibi-{name}-idle.png")

    print(f"Wrote {len(DIRECTIONS)} directions to {OUT_DIR}, cell size {CELL_W}x{CELL_H}, scale {SCALE:.3f}, 4 walk frames each.")


if __name__ == "__main__":
    main()
