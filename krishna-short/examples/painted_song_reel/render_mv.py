"""Render the landscape music-video part of a painted-style song reel.

  python3 render_mv.py shots.json out.mp4 [--from T --to T] [--still T out.png]

Each shot is one painted still, moved in 2.5D: a camera move (zoom, centre, roll) plus depth parallax (near layers
shift and grow more than far ones, from a Depth Anything V2 map), cut on the beat. Transitions at the cuts: zoom-through
with radial blur, whip pans with motion blur, white flash, dissolve. Screen-space extras: drifting petals, dust motes,
twinkling stars, torn-paper lyric strips (Devanagari, shaped by raqm), a light vignette and animated grain.
Times in shots.json are reel seconds; the clip covers [start, end). Output 1920x1080, 30 fps, no sound.
"""
import json, math, subprocess, sys
from pathlib import Path
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1920, 1080, 30
cfg = json.load(open(sys.argv[1], encoding="utf-8"))
OUT = sys.argv[2]
args = sys.argv[3:]
HERE = Path(__file__).resolve().parent
CACHE = Path(__import__("os").environ.get("REEL_CACHE", str(Path(OUT).resolve().parent / "depth_cache"))); CACHE.mkdir(exist_ok=True)
rng0 = np.random.default_rng(7)

def ease(u, kind="inout"):
    u = min(1.0, max(0.0, u))
    if kind == "linear": return u
    if kind == "out": return 1 - (1 - u) ** 2
    if kind == "in": return u * u
    return 0.5 - 0.5 * math.cos(math.pi * u)
lerp = lambda a, b, u: a + (b - a) * u

# ---------------------------------------------------------------- stills and depth
def prepare(path):
    """Load a still, paint out the corner sparkle mark, and make (or load) its depth map (near = 1)."""
    key = Path(path).stem
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    mark = np.zeros((h, w), np.uint8)
    cx, cy, r = int(w - 113 * w / 2752), int(h - 113 * h / 1536), int(38 * w / 2752)
    cv2.circle(mark, (cx, cy), r, 255, -1)
    img = cv2.inpaint(img, mark, 9, cv2.INPAINT_TELEA)
    dp = CACHE / f"{key}_depth.npy"
    if dp.exists():
        d = np.load(dp)
    else:
        import torch
        from transformers import pipeline
        torch.set_num_threads(4)
        global _depth_pipe
        if "_depth_pipe" not in globals():
            _depth_pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf", device="cpu")
        small = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).resize((1036, int(1036 * h / w) // 14 * 14))
        d = np.array(_depth_pipe(small)["predicted_depth"]).astype(np.float32)
        lo, hi = np.percentile(d, 2), np.percentile(d, 98)
        d = np.clip((d - lo) / (hi - lo + 1e-6), 0, 1)
        d = cv2.resize(d, (w, h), interpolation=cv2.INTER_CUBIC)
        d = cv2.dilate(d, np.ones((19, 19), np.uint8))           # keep foreground silhouettes whole when they move
        d = cv2.GaussianBlur(d, (0, 0), 6)
        np.save(dp, d.astype(np.float16))
    return img.astype(np.float32), d.astype(np.float32)

XO, YO = np.meshgrid(np.arange(W, dtype=np.float32) - W / 2 + 0.5, np.arange(H, dtype=np.float32) - H / 2 + 0.5)

def render_still(img, depth, z, c, rot, par, dolly, d0, shift=(0.0, 0.0)):
    """One frame of a still: zoom z (1 = cover the frame), centre c (0..1 of the still), roll rot (deg),
    parallax par (screen px a depth-1 point moves relative to depth d0), dolly (extra growth of near layers),
    shift (screen px, for whip transitions)."""
    hs, ws = img.shape[:2]
    s = max(W / ws, H / hs) * z
    th = math.radians(rot)
    xo, yo = XO - shift[0], YO - shift[1]
    xr = (math.cos(th) * xo + math.sin(th) * yo) / s
    yr = (-math.sin(th) * xo + math.cos(th) * yo) / s
    Cx, Cy = c[0] * ws, c[1] * hs
    mx, my = Cx + xr, Cy + yr
    if par != (0, 0) or dolly:
        dd = cv2.remap(depth, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT) - d0
        g = 1.0 / (1.0 + dolly * dd)
        mx = Cx + (mx - Cx) * g - par[0] * dd / s
        my = Cy + (my - Cy) * g - par[1] * dd / s
    return cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)

# ---------------------------------------------------------------- screen-space extras
class Particles:
    def __init__(self, kind, n, seed, area=(0, 0, W, H)):
        r = np.random.default_rng(seed)
        self.kind, self.n = kind, n
        x0, y0, x1, y1 = area
        self.p = np.stack([r.uniform(x0, x1, n), r.uniform(y0, y1, n)], 1)
        if kind == "petals":
            self.v = np.stack([r.uniform(40, 140, n), r.uniform(-120, -30, n)], 1)
            self.size = r.uniform(10, 22, n); self.ang = r.uniform(0, 360, n); self.spin = r.uniform(-120, 120, n)
        elif kind == "dust":
            self.v = np.stack([r.uniform(-12, 12, n), r.uniform(-18, -4, n)], 1)
            self.size = r.uniform(1.5, 4.5, n); self.ph = r.uniform(0, 6.28, n)
        elif kind == "stars":
            self.v = np.zeros((n, 2)); self.size = r.uniform(5, 13, n); self.ph = r.uniform(0, 6.28, n); self.fr = r.uniform(2, 5, n)
        self.seed = seed

    def draw(self, frame, t, alpha=1.0):
        if alpha <= 0: return frame
        ov = np.zeros((H, W, 3), np.float32); a = np.zeros((H, W), np.float32)
        if self.kind == "petals":
            for k in range(self.n):
                x = (self.p[k, 0] + self.v[k, 0] * t + 30 * math.sin(1.7 * t + k)) % (W + 80) - 40
                y = (self.p[k, 1] + self.v[k, 1] * t) % (H + 80) - 40
                ang = self.ang[k] + self.spin[k] * t
                L, Wd = self.size[k], self.size[k] * 0.42
                cv2.ellipse(a, (int(x), int(y)), (int(L), int(Wd)), ang, 0, 360, 0.92, -1, cv2.LINE_AA)
                cv2.ellipse(ov, (int(x), int(y)), (int(L), int(Wd)), ang, 0, 360, (236, 246, 252), -1, cv2.LINE_AA)
            a = cv2.GaussianBlur(a, (0, 0), 1.2); ov = cv2.GaussianBlur(ov, (0, 0), 1.2)
        elif self.kind == "dust":
            for k in range(self.n):
                x = (self.p[k, 0] + self.v[k, 0] * t) % W; y = (self.p[k, 1] + self.v[k, 1] * t) % H
                tw = 0.45 + 0.55 * (0.5 + 0.5 * math.sin(2.2 * t + self.ph[k]))
                cv2.circle(a, (int(x), int(y)), int(self.size[k] + 2), 0.75 * tw, -1, cv2.LINE_AA)
                cv2.circle(ov, (int(x), int(y)), int(self.size[k] + 2), (150, 220, 255), -1, cv2.LINE_AA)
            a = cv2.GaussianBlur(a, (0, 0), 2.2); ov = cv2.GaussianBlur(ov, (0, 0), 2.2)
        elif self.kind == "stars":
            for k in range(self.n):
                x, y = int(self.p[k, 0]), int(self.p[k, 1])
                tw = max(0.0, math.sin(self.fr[k] * t + self.ph[k])) ** 3
                if tw < 0.02: continue
                L = int(self.size[k] * (0.6 + 0.6 * tw))
                cv2.line(a, (x - L, y), (x + L, y), tw, 1, cv2.LINE_AA); cv2.line(a, (x, y - L), (x, y + L), tw, 1, cv2.LINE_AA)
                cv2.circle(a, (x, y), 2, tw, -1, cv2.LINE_AA)
            ov[:] = (255, 245, 235)
            a = np.maximum(a, cv2.GaussianBlur(a, (0, 0), 2.5) * 1.6)
        a = np.clip(a * alpha, 0, 1)[..., None]
        return frame * (1 - a) + ov * a

FONT_DEV = str(Path(__file__).resolve().parents[2] / "code_scenes" / "fonts" / "NotoSansDevanagari_700Bold.ttf")

def strip_image(text, seed, size=46):
    """A torn strip of white paper with one lyric line (RGBA, with its soft shadow)."""
    r = np.random.default_rng(seed)
    f = ImageFont.truetype(FONT_DEV, size, layout_engine=ImageFont.Layout.RAQM)
    bb = f.getbbox(text, language="hi")
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    pw, ph = tw + 70, th + 44
    pad = 30
    im = Image.new("RGBA", (pw + 2 * pad, ph + 2 * pad), (0, 0, 0, 0))
    # torn outline: jagged short ends, gently wavy long edges
    pts = []
    for x in np.linspace(0, pw, 24): pts.append((pad + x, pad + r.uniform(0, 4)))
    for y in np.linspace(0, ph, 10): pts.append((pad + pw - r.uniform(0, 12), pad + y))
    for x in np.linspace(pw, 0, 24): pts.append((pad + x, pad + ph - r.uniform(0, 4)))
    for y in np.linspace(ph, 0, 10): pts.append((pad + r.uniform(0, 12), pad + y))
    sh = Image.new("L", im.size, 0); ImageDraw.Draw(sh).polygon([(x + 6, y + 8) for x, y in pts], fill=120)
    sh = sh.filter(ImageFilter.GaussianBlur(7))
    shadow = Image.new("RGBA", im.size, (20, 14, 8, 0)); shadow.putalpha(sh)
    paper = Image.new("RGBA", im.size, (0, 0, 0, 0))
    pm = Image.new("L", im.size, 0); ImageDraw.Draw(pm).polygon(pts, fill=255)
    base = np.zeros((im.size[1], im.size[0], 4), np.uint8)
    noise = r.normal(0, 4, (im.size[1], im.size[0]))
    base[..., 0] = np.clip(246 + noise, 0, 255); base[..., 1] = np.clip(243 + noise, 0, 255); base[..., 2] = np.clip(235 + noise, 0, 255)
    base[..., 3] = np.array(pm)
    paper = Image.fromarray(base, "RGBA")
    d = ImageDraw.Draw(paper)
    d.text((pad + 35 - bb[0], pad + 22 - bb[1]), text, font=f, fill=(28, 24, 22, 255), language="hi")
    out = Image.alpha_composite(shadow, paper)
    return np.array(out).astype(np.float32)

def paste_rgba(frame, rgba, cx, cy, scale=1.0, rot=0.0, alpha=1.0):
    if alpha <= 0: return frame
    h, w = rgba.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), rot, scale)
    M[0, 2] += cx - w / 2; M[1, 2] += cy - h / 2
    warped = cv2.warpAffine(rgba, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    a = (warped[..., 3:4] / 255.0) * alpha
    rgb = warped[..., [2, 1, 0]]
    return frame * (1 - a) + rgb * a

# ---------------------------------------------------------------- the cut
shots = cfg["shots"]
for k, sh in enumerate(shots):
    sh["img_"], sh["depth_"] = prepare(sh["img"])
    sh["fx_"] = [Particles(fx["kind"], fx.get("n", 30), 100 + 10 * k + j, tuple(fx.get("area", (0, 0, W, H))))
                 for j, fx in enumerate(sh.get("fx", []))]
strips = []
for j, s in enumerate(cfg.get("strips", [])):
    strips.append(dict(s, img_=strip_image(s["text"], 50 + j, s.get("size", 46))))
vig = None

def shot_frame(k, t, extra_zoom=1.0, shift=(0.0, 0.0)):
    sh = shots[k]
    u = (t - sh["t0"]) / (sh["t1"] - sh["t0"])
    e = ease(u, sh.get("ease", "inout"))
    z = lerp(*sh["z"], e) * extra_zoom
    c = (lerp(sh["c"][0][0], sh["c"][1][0], e), lerp(sh["c"][0][1], sh["c"][1][1], e))
    rot = lerp(*sh.get("rot", [0, 0]), e)
    if sh.get("swing"):
        a_, per = sh["swing"]
        rot += a_ * math.sin(2 * math.pi * (t - sh["t0"]) / per)
        c = (c[0] + 0.012 * math.sin(2 * math.pi * (t - sh["t0"]) / per + 0.6), c[1])
    par = sh.get("par", [0, 0]); par = (par[0] * e, par[1] * e)
    f = render_still(sh["img_"], sh["depth_"], z, c, rot, par, sh.get("dolly", 0.0) * e, sh.get("d0", 0.5), shift)
    for fx, spec in zip(sh["fx_"], sh.get("fx", [])):
        f = fx.draw(f, t - sh["t0"] + spec.get("t_off", 0.0), spec.get("alpha", 1.0))
    for s in strips:
        if s["shot"] == k and t >= s["t"]:
            q = min(1.0, (t - s["t"]) / 0.16)
            sc = 0.82 + 0.18 * ease(q, "out") + 0.03 * math.sin(min(1.0, q) * math.pi)
            f = paste_rgba(f, s["img_"], s["x"], s["y"], sc, s.get("rot", 0), alpha=min(1.0, q * 1.5))
    return f

def radial_blur(render, n=6, spread=0.06):
    acc = None
    for j in range(n):
        fr = render(1.0 + spread * j / max(1, n - 1))
        acc = fr if acc is None else acc + fr
    return acc / n

def dir_blur(f, dx, dy):
    L = int(max(abs(dx), abs(dy)))
    if L < 3: return f
    k = np.zeros((L, L), np.float32)
    cv2.line(k, (0, 0) if dx * dy >= 0 else (L - 1, 0), (L - 1, L - 1) if dx * dy >= 0 else (0, L - 1), 1.0, 1)
    if dy == 0: k = np.zeros((1, L), np.float32); k[0, :] = 1
    if dx == 0: k = np.zeros((L, 1), np.float32); k[:, 0] = 1
    return cv2.filter2D(f, -1, k / k.sum())

def frame_at(t):
    k = max(i for i, s in enumerate(shots) if s["t0"] <= t + 1e-9) if t >= shots[0]["t0"] else 0
    # transition into shot k (at its t0) or out of it (at its t1)?
    for kk in (k, k + 1):
        if kk == 0 or kk >= len(shots): continue
        T = shots[kk]["t0"]; tr = shots[kk - 1].get("out", "cut"); D = shots[kk - 1].get("out_d", 0.36)
        if tr == "cut" or not (T - D / 2 <= t < T + D / 2): continue
        a, b = kk - 1, kk
        q = (t - (T - D / 2)) / D                                # 0..1 across the transition
        if tr == "zoom":
            if t < T:
                p = ease((t - (T - D / 2)) / (D / 2), "in"); zf = 1 + 1.1 * p
                fa = radial_blur(lambda m: shot_frame(a, t, zf * m), 6, 0.10 * p)
                fb = None
            else:
                p = ease((t - T) / (D / 2), "out"); zf = 2.1 - 1.1 * p
                fb = radial_blur(lambda m: shot_frame(b, t, zf * m), 6, 0.10 * (1 - p)); fa = None
            if fa is None: fa = shot_frame(a, T - 1e-3, 2.1)
            if fb is None: fb = shot_frame(b, T, 2.1)
            w = ease((t - (T - D / 6)) / (D / 3))
            return fa * (1 - w) + fb * w
        if tr in ("whip", "whipleft", "whipup", "whipdown"):
            # the two frames side by side on one strip that slides past the camera, blurred by its speed
            dx, dy = {"whip": (-1, 0), "whipleft": (1, 0), "whipup": (0, 1), "whipdown": (0, -1)}[tr]
            Lx = W if dx else H
            off = Lx * ease(q)
            v = Lx * (ease(min(1, q + 0.02)) - ease(max(0, q - 0.02))) / 0.04 / (D * FPS)   # px per frame
            sa = (dx * off, dy * off); sb = (sa[0] - dx * Lx, sa[1] - dy * Lx)
            fa = shot_frame(a, min(t, T - 1e-3), 1.0, sa); fb = shot_frame(b, max(t, T), 1.0, sb)
            coord = XO + W / 2 - 0.5 if dx else YO + H / 2 - 0.5
            lo = sa[0] if dx else sa[1]
            m = ((coord >= lo) & (coord < lo + Lx)).astype(np.float32)[..., None]
            f = fa * m + fb * (1 - m)
            L = min(170.0, 1.1 * v)
            return dir_blur(f, L if dx else 0, L if dy else 0)
        if tr == "flash":
            w = ease(q); fa = shot_frame(a, t); fb = shot_frame(b, max(t, T))
            f = fa * (1 - w) + fb * w
            fl = max(0.0, 1 - abs(t - T) / (D / 2)) ** 1.5
            return f * (1 - 0.85 * fl) + 255 * 0.85 * fl
        if tr == "fade":
            w = ease(q); return shot_frame(a, t) * (1 - w) + shot_frame(b, max(t, T)) * w
    return shot_frame(k, t)

def finish(f, t):
    global vig
    if vig is None:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        rr = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
        vig = (1 - 0.22 * np.clip(rr - 0.55, 0, 1) ** 1.5)[..., None].astype(np.float32)
    f = f * vig
    g = np.random.default_rng(int(t * 1000)).normal(0, 3.2, (H // 2, W // 2)).astype(np.float32)
    f = f + cv2.resize(g, (W, H))[..., None]
    fi, fo = cfg.get("fade_in"), cfg.get("fade_out")
    if fi and t < cfg["start"] + fi: f = f * ((t - cfg["start"]) / fi)
    if fo and t > cfg["end"] - fo: f = f * max(0.0, (cfg["end"] - t) / fo)
    return np.clip(f, 0, 255).astype(np.uint8)

if "--still" in args:
    i = args.index("--still"); t = float(args[i + 1]); cv2.imwrite(args[i + 2], finish(frame_at(t), t)); sys.exit()
t0 = float(args[args.index("--from") + 1]) if "--from" in args else cfg["start"]
t1 = float(args[args.index("--to") + 1]) if "--to" in args else cfg["end"]
n = int(round((t1 - t0) * FPS))
p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                      "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p", OUT], stdin=subprocess.PIPE)
for i in range(n):
    t = t0 + i / FPS
    p.stdin.write(finish(frame_at(t), t).tobytes())
    if i % 60 == 0: print(f"{i}/{n}", flush=True)
p.stdin.close(); p.wait()
print("done", OUT)
