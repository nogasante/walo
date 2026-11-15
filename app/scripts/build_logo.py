#!/usr/bin/env python3
"""Draw Walo's mark (a leaf cradling a hand) and export transparent PNGs.

The brand art arrives as a flat raster on an off-white page, which cannot be used for a launcher tile,
a favicon or a splash screen. This draws the mark as vector geometry instead - a leaf with a deep
green body, a light top-right, a white sweep along its inner edge and a hand rising inside it - so
every export has a real alpha channel and stays crisp at any size. Shapes are rendered at SS x the
target size and reduced with LANCZOS, which is what smooths the edges without an SVG renderer.

Usage: python3 build_logo.py
Writes app/img/logo-mark*.png, logo.png (mark + wordmark), favicon-32.png, apple-touch-icon.png.
"""
import os
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, "..", "img")
SS = 4

GREEN_TOP = (126, 196, 70)
GREEN_MID = (56, 142, 60)
GREEN_DEEP = (22, 88, 50)
HAND_DARK = (31, 104, 58)
HAND_LIGHT = (116, 189, 110)
INK = (74, 80, 88)

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/opt/freestyle/python/lib/python3.12/site-packages/matplotlib/mpl-data/fonts/ttf/DejaVuSans.ttf",
]


def bez(pts, steps=90):
    """Sample a cubic bezier chain [p0, c1, c2, p1, c3, c4, p2, ...] in 0..1 space."""
    out = [pts[0]]
    i = 0
    while i + 3 < len(pts):
        p0, c1, c2, p3 = pts[i:i + 4]
        for s in range(1, steps + 1):
            t = s / steps
            u = 1 - t
            out.append((
                u ** 3 * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * p3[0],
                u ** 3 * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * p3[1],
            ))
        i += 3
    return out


def gradient(size):
    """Diagonal light-to-deep green with a soft highlight near the leaf's tip."""
    y, x = np.mgrid[0:size, 0:size] / (size - 1)
    t = np.clip(0.62 * (1 - x) + 0.38 * y, 0, 1)[..., None]
    a = np.array(GREEN_TOP, float)
    b = np.array(GREEN_MID, float)
    c = np.array(GREEN_DEEP, float)
    col = np.where(t < 0.5, a + (b - a) * (t / 0.5), b + (c - b) * ((t - 0.5) / 0.5))
    glow = np.exp(-(((x - 0.72) ** 2 + (y - 0.18) ** 2) / 0.06))[..., None] * 26
    return Image.fromarray(np.clip(col + glow, 0, 255).astype("uint8"), "RGB").convert("RGBA")


def capsule(draw, a, b, w, fill, size):
    (x0, y0), (x1, y1) = a, b
    draw.line((x0 * size, y0 * size, x1 * size, y1 * size), fill=fill, width=int(w * size))
    r = w * size / 2
    for x, y in ((x0, y0), (x1, y1)):
        draw.ellipse((x * size - r, y * size - r, x * size + r, y * size + r), fill=fill)


def mark(size):
    S = size * SS
    # the leaf: pointed tip top-right, broad rounded base bottom-left
    outline = bez([
        (0.94, 0.05), (0.84, 0.01), (0.62, 0.03), (0.42, 0.15),
        (0.20, 0.30), (0.04, 0.52), (0.03, 0.72),
        (0.02, 0.90), (0.18, 0.99), (0.38, 0.99),
        (0.64, 0.99), (0.90, 0.86), (0.96, 0.60),
        (1.00, 0.40), (1.00, 0.16), (0.94, 0.05),
    ])
    leaf = Image.new("L", (S, S), 0)
    ImageDraw.Draw(leaf).polygon([(x * S, y * S) for x, y in outline], fill=255)
    art = gradient(S)
    art.putalpha(leaf)

    # the white sweep: thin at the tip, thicker toward the base, following the inner right edge
    sweep = Image.new("L", (S, S), 0)
    sd = ImageDraw.Draw(sweep)
    spine = bez([(0.24, 0.83), (0.33, 0.62), (0.53, 0.35), (0.80, 0.15)], steps=140)
    n = len(spine)
    for i, (x, y) in enumerate(spine):
        t = i / (n - 1)
        r = S * (0.040 - 0.021 * t)
        sd.ellipse((x * S - r, y * S - r, x * S + r, y * S + r), fill=255)
    sweep = Image.composite(sweep, Image.new("L", (S, S), 0), leaf)
    art.paste((250, 250, 247, 255), (0, 0), sweep)

    # the hand: the palm's heel low in the leaf, four fingers opening up to the right. Each part is
    # outlined in the light green so the fingers stay separate even at 32 px.
    under = art.copy()
    parts = [
        ((0.43, 0.97), (0.67, 0.94), 0.25),   # palm and heel
        ((0.46, 0.93), (0.56, 0.79), 0.088),  # little finger
        ((0.56, 0.94), (0.67, 0.78), 0.094),
        ((0.66, 0.94), (0.78, 0.80), 0.092),
        ((0.73, 0.93), (0.85, 0.85), 0.082),  # thumb, lying flatter
    ]
    hand = Image.new("L", (S, S), 0)
    hd = ImageDraw.Draw(hand)
    for a, b, w in parts:
        capsule(hd, a, b, w, 255, S)
    hand = Image.composite(hand, Image.new("L", (S, S), 0), leaf)
    ring = ImageChops.subtract(hand.filter(ImageFilter.MaxFilter(11)), hand)
    art.paste(Image.new("RGBA", (S, S), HAND_LIGHT + (255,)), (0, 0), ring)
    art.paste(Image.new("RGBA", (S, S), (20, 80, 45, 255)), (0, 0), hand)

    art = art.crop(art.getchannel("A").getbbox())
    # a little air around the mark, so it never sits flush against an icon's edge
    pad = int(max(art.size) * 0.05)
    square = Image.new("RGBA", (max(art.size) + 2 * pad,) * 2, (0, 0, 0, 0))
    square.alpha_composite(art, ((square.width - art.width) // 2, (square.height - art.height) // 2))
    return square.resize((size, size), Image.LANCZOS)


def font_at(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    raise SystemExit("no sans font found; add its path to FONT_CANDIDATES")


def lockup(width):
    """Mark above the wordmark, transparent, padded to a square."""
    m = mark(int(width * 0.60))
    font = font_at(int(width * 0.235))
    tmp = Image.new("RGBA", (width, width), (0, 0, 0, 0))
    bbox = font.getbbox("walo")
    ImageDraw.Draw(tmp).text(
        ((width - (bbox[2] - bbox[0])) / 2 - bbox[0], width * 0.70 - bbox[1]),
        "walo", font=font, fill=INK + (255,),
    )
    tmp.alpha_composite(m, ((width - m.width) // 2, int(width * 0.04)))
    out = tmp.crop(tmp.getchannel("A").getbbox())
    side = max(out.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(out, ((side - out.width) // 2, (side - out.height) // 2))
    return canvas


def save(img, name):
    img.save(os.path.join(IMG, name), "PNG", optimize=True)
    print("wrote", name, img.size)


if __name__ == "__main__":
    save(mark(1024), "logo-mark-1024.png")
    save(mark(512), "logo-mark.png")
    save(mark(192), "logo-mark-192.png")
    save(mark(180), "apple-touch-icon.png")
    save(mark(32), "favicon-32.png")
    save(lockup(1024), "logo.png")
    # maskable launcher icon: the mark needs a filled square behind it, inside Android's safe circle
    tile = Image.new("RGBA", (512, 512), (244, 241, 234, 255))
    m = mark(368)
    tile.alpha_composite(m, ((512 - m.width) // 2, (512 - m.height) // 2))
    save(tile, "logo-mark-512-maskable.png")
