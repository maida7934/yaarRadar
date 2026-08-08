"""
One-time preprocessing of public/yaarRadar-assets/ground.jpeg into a
vertically-repeatable texture tile for the Find scene's scrolling
background. Not part of the app's runtime -- run manually
(`python scripts/build-ground.py`); output lives in public/backgrounds/.

Unlike the RPG Maker road art (build-road.py), this is already a top-down
tileable-style texture with no fixed horizon/vanishing point, so a raw
repeat is close but not perfect -- there's a faint seam in both directions
where the darker mottled border pattern doesn't quite line up edge to edge.
Mirroring the image into a 2x2 grid (original, h-flipped, v-flipped, both-
flipped) makes every edge of the resulting tile match the opposite edge of
its neighbor when repeated, in both x and y -- same technique as the road
tile, extended to both axes since this source has no sky/horizon to crop
out first.
"""

from PIL import Image

SRC = "public/yaarRadar-assets/ground.jpeg"
OUT = "public/backgrounds/ground-tile.png"


def main():
    img = Image.open(SRC).convert("RGB")
    h_flip = img.transpose(Image.FLIP_LEFT_RIGHT)
    v_flip = img.transpose(Image.FLIP_TOP_BOTTOM)
    hv_flip = v_flip.transpose(Image.FLIP_LEFT_RIGHT)

    tile = Image.new("RGB", (img.width * 2, img.height * 2))
    tile.paste(img, (0, 0))
    tile.paste(h_flip, (img.width, 0))
    tile.paste(v_flip, (0, img.height))
    tile.paste(hv_flip, (img.width, img.height))
    tile.save(OUT)

    print(f"Wrote {OUT}, tile size {tile.size}")


if __name__ == "__main__":
    main()
