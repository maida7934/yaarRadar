"""
One-time preprocessing of the ripped RPG Maker MV road background
(public/yaarRadar-assets/...) into a vertically-repeatable texture tile for
the Find scene's scrolling road. Not part of the app's runtime -- run
manually (`python scripts/build-road.py`); output lives in
public/backgrounds/.

The source is a fixed-perspective battle background (stone road fading to a
hazy horizon), not a seamless tile. A horizontal band away from both the
hazy horizon and the most foreshortened foreground gives a reasonably
consistent texture scale; mirroring that band onto itself (crop, then the
same crop flipped vertically, stacked) makes the *tile's own* top/bottom
edges match at the repeat boundary, since a strip and its mirror always
join seamlessly along the shared edge -- this hides the seam a plain
repeat would otherwise show, without needing genuinely seamless source art.
"""

from PIL import Image

SRC = "public/yaarRadar-assets/PC _ Computer - RPG Maker MV - Battle Backgrounds - Road 3.png"
OUT = "public/backgrounds/road-tile.png"

BAND = (0, 450, 1000, 650)  # (x0, y0, x1, y1) -- clear stone texture, no sky/haze


def main():
    img = Image.open(SRC).convert("RGB")
    band = img.crop(BAND)
    mirrored = band.transpose(Image.FLIP_TOP_BOTTOM)

    tile = Image.new("RGB", (band.width, band.height * 2))
    tile.paste(band, (0, 0))
    tile.paste(mirrored, (0, band.height))
    tile.save(OUT)

    print(f"Wrote {OUT}, tile size {tile.size}")


if __name__ == "__main__":
    main()
