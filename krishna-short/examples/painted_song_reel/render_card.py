"""The 1-second "PLEASE ROTATE YOUR PHONE" card (1080x1920, 30 fps): a phone outline and a line fade in, the words
wipe in beside them, the whole group turns 90 degrees clockwise (the way the video that follows is turned), then
everything wipes out to black.
  python3 render_card.py out.mp4
"""
import math, subprocess, sys
from pathlib import Path
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

W, H, FPS, DUR = 1080, 1920, 30, 1.0
FONT = str(Path(__file__).resolve().parents[2] / "code_scenes" / "fonts" / "Poppins_300Light.ttf")
S = 4                                     # supersampling for clean thin lines

def ease(u):
    u = min(1.0, max(0.0, u)); return 0.5 - 0.5 * math.cos(math.pi * u)

def layers():
    """Phone + line layer and text layer, drawn upright at 4x, RGBA."""
    g = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    x0, y0, x1, y1 = 246, 768, 444, 1158                                  # phone outline
    d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], radius=30 * S, outline=(255, 255, 255, 255), width=int(3.2 * S))
    d.rounded_rectangle([(x0 + x1) / 2 * S - 22 * S, (y0 + 16) * S, (x0 + x1) / 2 * S + 22 * S, (y0 + 28) * S], radius=6 * S,
                        outline=(255, 255, 255, 255), width=int(2.6 * S))
    d.line([492 * S, 732 * S, 492 * S, 1182 * S], fill=(255, 255, 255, 255), width=int(3.4 * S))
    t = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0)); dt = ImageDraw.Draw(t)
    f = ImageFont.truetype(FONT, 50 * S)
    for k, word in enumerate(["PLEASE", "ROTATE", "YOUR", "PHONE"]):
        x, y = 540 * S, (812 + k * 70) * S
        for ch in word:                                                    # wide letter spacing
            dt.text((x, y), ch, font=f, fill=(255, 255, 255, 255))
            x += f.getlength(ch) + 9 * S
    return g, t

G, T = layers()
G = np.array(G.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
T = np.array(T.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
PIVOT = (377 * 1.5, 625 * 1.5)
XX = np.arange(W, dtype=np.float32)[None, :]

def frame(t):
    fade = min(1.0, t / 0.10) * (1 - ease((t - 0.84) / 0.12))
    reveal = 540 + 380 * ease((t - 0.08) / 0.22)                         # text wipes in from the left
    hide = 540 + 380 * ease((t - 0.70) / 0.16)                           # ...and out the same way
    tm = ((XX < reveal) & (XX >= hide)).astype(np.float32)[..., None]
    lay = G.copy()
    ta = T[..., 3:4] * tm
    lay[..., :3] = lay[..., :3] * (1 - ta) + T[..., :3] * ta
    lay[..., 3:4] = np.maximum(lay[..., 3:4], ta)
    ang = -90 * ease((t - 0.42) / 0.30)                                   # clockwise on screen
    M = cv2.getRotationMatrix2D(PIVOT, ang, 1.0)
    rot = cv2.warpAffine(lay, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
    a = rot[..., 3:4] * fade
    return np.clip(rot[..., :3] * a * 255, 0, 255).astype(np.uint8)

out = sys.argv[1]
p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                      "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
for i in range(int(DUR * FPS)):
    p.stdin.write(frame(i / FPS).tobytes())
p.stdin.close(); p.wait(); print("done", out)
