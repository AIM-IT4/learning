"""
parallax.py - "2.5D" camera moves for still images: an AI depth map (Depth Anything V2 Small,
Apache-2.0) makes near things (Krishna, the chariot) move more than the background, so a still
painting looks like a moving 3D shot. Used by make_reel.py --parallax.

Needs: pip install torch transformers  (CPU is fine; ~1-2 s of compute per second of video).
"""
import math
import subprocess

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image, ImageFilter

DEPTH_MODEL = "depth-anything/Depth-Anything-V2-Small-hf"
_depth = None


def depth_map(img):
    """Relative depth in [0, 1], 1 = nearest, same size as img, softened to avoid tearing at edges."""
    global _depth
    if _depth is None:
        from transformers import pipeline
        _depth = pipeline("depth-estimation", model=DEPTH_MODEL, device="cpu")
    d = _depth(img)["depth"].resize(img.size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(6))
    a = np.asarray(d, dtype=np.float32)
    lo, hi = np.percentile(a, 2), np.percentile(a, 98)
    return np.clip((a - lo) / (hi - lo + 1e-6), 0, 1)


def render(img_path, frames, kind, move, c, out, W, H, fps, grade):
    """Same contract as make_reel.render_clip: `frames` frames, punch landing on frame c."""
    torch.set_num_threads(4)
    img = Image.open(img_path).convert("RGB")
    # cover-fit at 1.15x the output so the camera has room to move
    scale = max(W * 1.15 / img.width, H * 1.15 / img.height)
    sw, sh = int(img.width * scale), int(img.height * scale)
    img = img.resize((sw, sh), Image.LANCZOS)
    dep = depth_map(img)
    src = torch.from_numpy(np.asarray(img, dtype=np.float32) / 255).permute(2, 0, 1)[None]
    dsrc = torch.from_numpy(dep)[None, None]

    # output pixel grid in source-normalised coords (the output window covers W/sw x H/sh of the source)
    ys = torch.linspace(-1, 1, H) * (H / sh)
    xs = torch.linspace(-1, 1, W) * (W / sw)
    gy, gx = torch.meshgrid(ys, xs, indexing="ij")
    base = torch.stack([gx, gy], dim=-1)[None]

    kb = {"intro": 0.10, "outro": 0.08}.get(kind, 0.05)
    punch = {"drop": 0.35, "beat": 0.16, "outro": 0.22}.get(kind, 0.0)
    tau = {"drop": 0.16, "outro": 0.20}.get(kind, 0.11) * fps
    par = {"intro": 0.06, "drop": 0.08, "outro": 0.05}.get(kind, 0.045)   # parallax strength
    dirs = {"in": (0.0, 0.0, 1), "out": (0.0, 0.0, -1), "up": (0.0, -1.0, 0), "down": (0.0, 1.0, 0)}
    dx, dy, dz = dirs.get(move, (1.0, 0.0, 0))
    if move in ("in", "out"):
        dx = 0.6 if hash(str(img_path)) % 2 else -0.6     # a gentle sideways drift with the dolly

    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(fps), "-i", "-", "-vf", f"{grade},format=yuv420p", "-c:v", "libx264",
         "-preset", "veryfast", "-crf", "16", str(out)], stdin=subprocess.PIPE)
    n = max(frames - 1, 1)
    with torch.no_grad():
        for f in range(frames):
            p = f / n
            e = p * p * (3 - 2 * p)                              # ease in-out
            z = 1 + kb * (e if dz >= 0 else 1 - e)
            if punch:
                z += punch * math.exp(-max(f - c, 0) / tau)
            g = base / z
            if kind == "drop":                                   # camera shake on the drop
                amp = 0.012 * math.exp(-max(f - c, 0) / 9)
                g = g + torch.tensor([amp * math.sin(f * 2.3), amp * math.cos(f * 1.7)])
            d = F.grid_sample(dsrc, g, mode="bilinear", padding_mode="border", align_corners=True)
            d = d[0, 0, :, :, None] - 0.5                        # near > 0, far < 0
            t = (e - 0.5) * 2                                    # -1 .. 1 across the shot
            shift = torch.tensor([dx * par * t, dy * par * t])
            dolly = g[0] * (d * par * 0.8 * (e if dz >= 0 else 1 - e) * (1 if dz else 0))
            gg = g[0] - shift * d - dolly
            frame = F.grid_sample(src, gg[None], mode="bilinear", padding_mode="reflection",
                                  align_corners=True)
            ff.stdin.write((frame[0].permute(1, 2, 0).clamp(0, 1) * 255).to(torch.uint8).numpy().tobytes())
    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit(f"parallax render failed for {img_path}")
