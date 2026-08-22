"""
Shared preprocessing pipeline for turning a green-screen "ripped by ___"
chibi reference sheet into uniform, transparent sprite strips under
public/sprites-<name>/. Used by build-sprites-purple.py and
build-sprites-hat.py -- each of those is just per-sheet config (source
path, output dir, 32 crop boxes); this module has the actual image work,
so fixes/improvements only need to happen in one place.

(public/sprites/ itself, from the original spritefinal.jpeg, is built by
the separate, pre-existing scripts/build-sprites.py and intentionally left
alone -- it already works for its source image and isn't part of this
shared pipeline.)

Pipeline per frame: crop -> chroma-key with spill suppression (soft alpha,
not a hard cutoff -- see dechroma_despill) -> uniform scale to fit the
target cell -> paste onto a transparent cell anchored bottom-center (feet
on a consistent baseline) -> concatenate 4 frames into a walk strip, save
frame 0 alone as the idle pose.

Why spill suppression instead of a simple "is this pixel green enough"
cutoff (the approach in build-sprites.py): on these particular sheets the
background isn't a flat, uniform color across the whole image (see
sample_local_background below), and anti-aliased pixels right at a
character's edge are a genuine blend of foreground and background color.
A hard distance threshold either leaves a visible green-tinted ring around
every character (threshold too strict) or eats into thin art details like
hair wisps (threshold loosened + erosion). Soft alpha keying based on
"how much more green than the other channels" handles the blend
correctly: edge pixels get partial transparency instead of being kept
fully opaque with a green tint or deleted outright.
"""

import os

import numpy as np
from PIL import Image

CELL_W, CELL_H = 78, 130


def sample_local_background(arr_full, box, margin=10):
    """Background color right around this crop box, not the whole image's
    corners -- these sheets have a subtle gradient/vignette, so a single
    global background sample can be 20+ RGB units off by the time you're
    looking at a crop far from the corners, which is enough to throw off
    keying."""
    x0, y0, x1, y1 = box
    h, w, _ = arr_full.shape
    pts = [
        arr_full[max(0, y0 - margin), (x0 + x1) // 2],
        arr_full[min(h - 1, y1 + margin), (x0 + x1) // 2],
        arr_full[(y0 + y1) // 2, max(0, x0 - margin)],
        arr_full[(y0 + y1) // 2, min(w - 1, x1 + margin)],
    ]
    return np.mean(pts, axis=0)


def dechroma_despill(frame_rgba, bg):
    """Soft chroma-key: alpha ramps down (and green spill is pulled back
    toward the other channels) proportional to how much greener a pixel is
    than its own red/blue, calibrated against how green pure background is.
    A pixel that isn't green-dominant at all (red or blue >= green) is left
    fully opaque and untouched."""
    arr = np.asarray(frame_rgba, dtype=np.float32)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]

    bg_excess = bg[1] - max(bg[0], bg[2])
    excess_green = g - np.maximum(r, b)
    alpha = 1.0 - np.clip(excess_green / bg_excess, 0, 1)
    new_g = np.minimum(g, np.maximum(r, b))

    out = arr.copy()
    out[..., 1] = new_g
    out[..., 3] = alpha * a  # combine with any pre-existing alpha
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def resize_no_fringe(frame, size):
    """Resize an RGBA image without bleeding background color into the
    edges. Plain Image.resize() interpolates RGB and alpha independently,
    so a fully-transparent pixel's leftover RGB still gets blended into
    neighboring opaque pixels at the boundary. Premultiplying alpha before
    resizing and dividing it back out afterward avoids that."""
    rgb = np.asarray(frame.convert("RGB"), dtype=np.float32)
    alpha = np.asarray(frame.getchannel("A"), dtype=np.float32) / 255.0
    premultiplied = (rgb * alpha[..., None]).astype(np.uint8)

    premultiplied_resized = Image.fromarray(premultiplied, "RGB").resize(size, Image.LANCZOS)
    alpha_resized = frame.getchannel("A").resize(size, Image.LANCZOS)

    alpha_arr = np.asarray(alpha_resized, dtype=np.float32) / 255.0
    safe_alpha = np.clip(alpha_arr, 1e-6, 1.0)
    unpremultiplied = np.clip(np.asarray(premultiplied_resized, dtype=np.float32) / safe_alpha[..., None], 0, 255)

    out = Image.fromarray(unpremultiplied.astype(np.uint8), "RGB").convert("RGBA")
    out.putalpha(alpha_resized)
    return out


def place_in_cell(img, arr_full, box, scale, cell_w=CELL_W, cell_h=CELL_H):
    bg = sample_local_background(arr_full, box)
    frame = dechroma_despill(img.crop(box).convert("RGBA"), bg)
    scaled_w = max(1, round(frame.width * scale))
    scaled_h = max(1, round(frame.height * scale))
    frame = resize_no_fringe(frame, (scaled_w, scaled_h))

    cell = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
    x = (cell_w - frame.width) // 2
    y = cell_h - frame.height  # anchor feet to the bottom of the cell
    cell.paste(frame, (x, y), frame)
    return cell


def build_strip(img, arr_full, boxes, scale, cell_w=CELL_W, cell_h=CELL_H):
    strip = Image.new("RGBA", (cell_w * len(boxes), cell_h), (0, 0, 0, 0))
    for i, box in enumerate(boxes):
        strip.paste(place_in_cell(img, arr_full, box, scale, cell_w, cell_h), (i * cell_w, 0))
    return strip


def generate(src, out_dir, directions, cell_w=CELL_W, cell_h=CELL_H, fill_height_ratio=None):
    """directions: dict of direction name -> list of 4 (x0,y0,x1,y1) crop
    boxes for that direction's walk cycle, in the source sheet's own pixel
    coordinates.

    fill_height_ratio: if given, the tallest raw frame is scaled to this
    fraction of cell_h instead of being fitted flush to the cell. Pass it
    whenever a character's directions are split across more than one source
    sheet -- the default auto-fit is computed per call, so two sheets
    generated by separate calls land at different character sizes even
    though both "fill the cell". Pinning both calls to the same ratio is
    what keeps them the same size (see build-sprites-officer.py and
    build-sprites-cowboy.py). It also avoids upscaling a tightly-cropped
    sheet past 1.0, which makes LANCZOS ring and leaves a visible halo of
    keyed-out background around the character."""
    os.makedirs(out_dir, exist_ok=True)
    img = Image.open(src).convert("RGB")
    arr_full = np.array(img)

    all_boxes = [box for boxes in directions.values() for box in boxes]
    max_raw_w = max(x1 - x0 for x0, y0, x1, y1 in all_boxes)
    max_raw_h = max(y1 - y0 for x0, y0, x1, y1 in all_boxes)
    if fill_height_ratio is None:
        scale = min(cell_w / max_raw_w, cell_h / max_raw_h)
    else:
        scale = (fill_height_ratio * cell_h) / max_raw_h

    for name, boxes in directions.items():
        build_strip(img, arr_full, boxes, scale, cell_w, cell_h).save(f"{out_dir}chibi-{name}-walk.png")
        place_in_cell(img, arr_full, boxes[0], scale, cell_w, cell_h).save(f"{out_dir}chibi-{name}-idle.png")

    print(f"Wrote {len(directions)} directions to {out_dir}, cell size {cell_w}x{cell_h}, scale {scale:.3f}, 4 walk frames each.")
