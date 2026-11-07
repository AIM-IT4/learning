#!/usr/bin/env python3
"""Detail crops + shot order for the Kurukshetra reel: python crops.py <images_dir> <out_dir>"""
import sys
from pathlib import Path
from PIL import Image
src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
V, C, G = (Image.open(src / f) for f in ("01.jpg", "02.jpg", "03.jpg"))
def crop(img, box):
    w, h = img.size
    return img.crop((int(box[0]*w), int(box[1]*h), int(box[2]*w), int(box[3]*h)))
plan = [
    ("01", V, None),                          # Vishvarupa, full
    ("02", G, None),                          # Gita updesh, full
    ("03", G, (0.12, 0.08, 0.52, 0.85)),      # Krishna teaching
    ("04", G, (0.50, 0.15, 0.86, 0.85)),      # Arjun listening
    ("05", V, (0.29, 0.00, 0.69, 0.53)),      # Vishvarupa face + arms (DROP)
    ("06", C, (0.28, 0.08, 0.62, 0.36)),      # Hanuman flag
    ("07", C, (0.45, 0.33, 0.92, 0.75)),      # Arjun in the chariot
    ("08", C, (0.00, 0.42, 0.48, 0.88)),      # Krishna as charioteer + horses
    ("09", V, (0.33, 0.50, 0.65, 0.88)),      # cosmos inside Vishvarupa's body
    ("10", C, None),                          # Kurukshetra chariot, full (OUTRO)
]
for name, img, box in plan:
    im = img if box is None else crop(img, box)
    im.convert("RGB").save(out / f"{name}.jpg", quality=93)
    print(name, im.size)
