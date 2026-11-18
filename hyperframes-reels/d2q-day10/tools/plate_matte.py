"""Cut a prop render out of its plain studio backdrop so it sits on the reel's own background.

usage: python3 tools/plate_matte.py <in.jpeg> <out.png> [--feather 0.80 0.98] [--floor 0.035]

The backdrop is fitted as a smooth quadratic surface from the image border (robust to the object touching an
edge), then every pixel is split into the least-opaque foreground that reproduces it over that backdrop
(known-background matting). Soft shadows stay as dark semi-transparent pixels and the green glow as a
semi-transparent green, so both read on the reel's background. A radial feather fades the edges (it also
removes the render's corner mark).
"""
import sys
import numpy as np
from PIL import Image


def fit_backdrop(img, band=56):
    h, w, _ = img.shape
    yy, xx = np.mgrid[0:h, 0:w]
    m = np.zeros((h, w), bool)
    m[:band, :] = m[-band:, :] = True
    m[:, :band] = m[:, -band:] = True
    m[int(h * 0.80):, int(w * 0.80):] = False            # corner mark
    x, y = xx[m] / w - 0.5, yy[m] / h - 0.5
    A = np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], 1)
    X, Y = xx / w - 0.5, yy / h - 0.5
    Af = np.stack([np.ones_like(X), X, Y, X * X, X * Y, Y * Y], -1)
    out = np.zeros_like(img)
    for c in range(3):
        v = img[..., c][m]
        keep = np.ones(v.shape, bool)
        for _ in range(4):                                 # drop the object where it touches the border
            coef, *_ = np.linalg.lstsq(A[keep], v[keep], rcond=None)
            r = v - A @ coef
            mad = np.median(np.abs(r[keep])) + 0.5
            keep = np.abs(r) < 3.0 * mad
        out[..., c] = Af @ coef
    return np.clip(out, 1, 254)


def main():
    a = sys.argv[1:]
    src, dst = a[0], a[1]
    f0, f1 = 0.80, 0.98
    floor = 0.035
    if "--feather" in a:
        i = a.index("--feather"); f0, f1 = float(a[i + 1]), float(a[i + 2])
    if "--floor" in a:
        floor = float(a[a.index("--floor") + 1])
    img = np.asarray(Image.open(src).convert("RGB"), dtype=np.float64)
    h, w, _ = img.shape
    B = fit_backdrop(img)
    up = np.where(img > B, (img - B) / (255.0 - B), (B - img) / B)
    alpha = up.max(-1)
    safe = np.maximum(alpha, 1e-4)[..., None]
    F = np.clip((img - (1.0 - alpha[..., None]) * B) / safe, 0, 255)
    alpha = np.clip((alpha - floor) / (1.0 - floor), 0, 1)
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot((xx + 0.5) / w - 0.5, (yy + 0.5) / h - 0.5) * 2.0
    t = np.clip((r - f0) / (f1 - f0), 0, 1)
    alpha *= 1.0 - t * t * (3 - 2 * t)
    out = np.dstack([F, alpha * 255.0]).round().astype(np.uint8)
    Image.fromarray(out, "RGBA").save(dst, optimize=True)
    print(dst, "backdrop corners", [tuple(int(v) for v in B[y, x]) for y, x in ((0, 0), (0, w - 1), (h - 1, 0), (h // 2, w // 2))])


if __name__ == "__main__":
    main()
