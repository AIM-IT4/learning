#!/usr/bin/env python3
"""
make_demo_assets.py - create placeholder images, a synthetic drum/drone track and a sample
lyrics file in ./demo so you can test make_short.py before using your own material.

  python make_demo_assets.py
  python make_short.py --images demo/images --audio demo/audio.wav --lyrics demo/lyrics.txt \
      --title "कृष्ण की चेतावनी" --out demo_short.mp4

Replace the placeholders with your own artwork, your own recitation and your own timings.
"""
import math
import random
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

W, H = 1080, 1920
OUT = Path(__file__).resolve().parent / "demo"
PALETTES = [  # (top sky, bottom fire, halo)
    ((8, 14, 48), (230, 90, 20), (120, 190, 255)),
    ((20, 8, 40), (200, 40, 30), (255, 200, 80)),
    ((4, 24, 60), (250, 140, 30), (160, 220, 255)),
    ((30, 10, 20), (240, 70, 10), (255, 160, 60)),
    ((6, 10, 30), (180, 60, 120), (200, 160, 255)),
    ((10, 30, 50), (255, 120, 0), (255, 230, 150)),
]

LYRICS = """\
# time | text      (one stanza from Rashmirathi by Ramdhari Singh Dinkar, for testing timings)
0:03.5 | हरि ने भीषण हुंकार किया,
0:06.0 | अपना स्वरूप-विस्तार किया,
0:08.5 | डगमग-डगमग दिग्गज डोले,
0:11.0 | भगवान कुपित होकर बोले-
0:13.5 | 'जंजीर बढ़ा कर साध मुझे,
0:16.0 | हाँ, हाँ दुर्योधन! बाँध मुझे।
"""


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_image(i, path):
    top, bottom, halo = PALETTES[i % len(PALETTES)]
    rnd = random.Random(i)
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = (y / H) ** 1.6
        d.line([(0, y), (W, y)], fill=lerp(top, bottom, t))
    for _ in range(260):  # stars
        x, y, r = rnd.randrange(W), rnd.randrange(int(H * 0.6)), rnd.choice([1, 1, 2, 3])
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255))

    glow = Image.new("RGB", (W, H))
    g = ImageDraw.Draw(glow)
    cx, cy = W // 2, int(H * (0.36 + 0.06 * math.sin(i)))
    for k in range(36):  # divine rays
        a = 2 * math.pi * k / 36 + i * 0.1
        g.line([(cx, cy), (cx + 1400 * math.cos(a), cy + 1400 * math.sin(a))], fill=halo, width=6)
    for r, alpha in ((420, 0.25), (300, 0.5), (210, 1.0)):
        g.ellipse([cx - r, cy - r, cx + r, cy + r], fill=tuple(int(c * alpha) for c in halo))
    glow = glow.filter(ImageFilter.GaussianBlur(40))
    img = Image.blend(img, Image.composite(glow, img, glow.convert("L")), 0.85)

    d = ImageDraw.Draw(img)
    d.ellipse([cx - 140, cy - 140, cx + 140, cy + 140], outline=(255, 240, 200), width=10)  # chakra
    for k in range(12):
        a = 2 * math.pi * k / 12
        d.line([(cx, cy), (cx + 140 * math.cos(a), cy + 140 * math.sin(a))], fill=(255, 240, 200), width=6)
    d.text((40, H - 70), f"placeholder {i + 1} - replace with your artwork", fill=(255, 255, 255))
    img.save(path, quality=92)


def make_audio(path, seconds=20):
    # Low drone (D + A) with a dhol-like hit on every beat at 96 BPM and a stronger hit every bar.
    beat = 60 / 96
    expr = (f"0.22*sin(2*PI*73.4*t)+0.12*sin(2*PI*110*t)+0.06*sin(2*PI*146.8*t)"
            f"+0.7*sin(2*PI*(52+40*exp(-30*mod(t,{beat})))*t)*exp(-9*mod(t,{beat}))"
            f"+0.5*sin(2*PI*41*t)*exp(-5*mod(t,{4*beat}))")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i",
                    f"aevalsrc='{expr}':s=44100:d={seconds}", "-af", "volume=0.6,alimiter",
                    str(path)], check=True)


def main():
    (OUT / "images").mkdir(parents=True, exist_ok=True)
    for i in range(len(PALETTES)):
        make_image(i, OUT / "images" / f"{i + 1:02d}.jpg")
    make_audio(OUT / "audio.wav")
    (OUT / "lyrics.txt").write_text(LYRICS, encoding="utf-8")
    print(f"demo assets written to {OUT}")


if __name__ == "__main__":
    main()
