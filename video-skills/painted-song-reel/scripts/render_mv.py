"""Render the landscape music-video part of a painted-style song reel.

  python3 render_mv.py shots.json out.mp4 [--from T --to T] [--still T out.png] [--stills T,T,... dir]

Each shot is one painted still, moved in 2.5D: a camera move (zoom, centre, roll) plus depth parallax (near layers
shift and grow more than far ones, from a Depth Anything V2 map), cut on the beat. Transitions at the cuts: zoom-through
with radial blur, whip pans with motion blur, white flash, dissolve. Screen-space extras: petals, dust motes, bokeh,
twinkling stars, rain, snow, fireflies, embers, a cloud that forms a heart, karaoke lyric strips on torn paper (any
script PIL + raqm can shape: caption_font / caption_lang in the json), colour grades, a light vignette and grain.
Times in shots.json are MV seconds; the clip covers [start, end). Output 1920x1080, 30 fps, no sound.
Life inside each painting (on by default; "anim" per shot or for the whole json: false, a number to scale it, or
{"hair", "cloth", "foliage", "sky", "water", "lights", "breath": multipliers}): two small segmentation models find the
hair, clothes, trees / grass / flowers, sky, water and the people, and a gentle wind field moves them - hair and
dupatta sway, leaves and grass ripple, clouds drift, water shimmers, lamps flicker, people breathe - while faces and
hands stay still. Depth maps and these region maps are cached in $REEL_CACHE (default: depth_cache next to the
output), keyed by the picture's file name.
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
    if cfg.get("flow_mark", True):                     # Flow pictures carry a corner sparkle; others don't
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

def render_still(img, depth, z, c, rot, par, dolly, d0, shift=(0.0, 0.0), anim=None, ta=0.0):
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
    fl = None
    if anim is not None:                               # the painting's own motion, in picture pixels
        dx, dy, fl = anim_offsets(anim, mx, my, ta)
        mx = mx + dx; my = my + dy
    out = cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return out if fl is None else out * (1.0 + fl[..., None])

# ---------------------------------------------------------------- life inside the painting
ANIM_KEYS = ("hair", "cloth", "foliage", "sky", "water", "lights", "breath")
_SEG = {}
def anim_params(sh):
    """Multipliers for this shot: the json's "anim", then the shot's own "anim" (false = still)."""
    p = {k: 1.0 for k in ANIM_KEYS}
    for src in (cfg.get("anim", True), sh.get("anim", True)):
        if src is False or src == 0: return None
        if isinstance(src, (int, float)) and src is not True: p = {k: v * src for k, v in p.items()}
        elif isinstance(src, dict): p.update({k: float(v) for k, v in src.items() if k in p})
    return p

def anim_compute(img):
    """Region weights at 1/4 size: hair (more at the tips), cloth (more at the hem), foliage, sky, water, people
    (for breathing), lights (+ a flicker phase per light). Faces and hands are kept out of every moving region."""
    import torch
    from transformers import SegformerForSemanticSegmentation, SegformerImageProcessor
    from huggingface_hub import hf_hub_download
    torch.set_num_threads(4)
    if not _SEG:
        for name, repo in (("ade", "nvidia/segformer-b2-finetuned-ade-512-512"), ("clo", "mattmdjaga/segformer_b2_clothes")):
            _SEG[name] = (SegformerImageProcessor.from_pretrained(repo), SegformerForSemanticSegmentation.from_pretrained(repo).eval())
        _SEG["yunet"] = cv2.FaceDetectorYN.create(hf_hub_download("opencv/face_detection_yunet", "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 50)
    h, w = img.shape[:2]; fw, fh = w // 4, h // 4
    u8 = np.clip(img, 0, 255).astype(np.uint8)
    rgb = Image.fromarray(cv2.cvtColor(u8, cv2.COLOR_BGR2RGB)).resize((896, round(896 * h / w)))
    def seg(name):
        proc, model = _SEG[name]
        with torch.no_grad(): lo = model(**proc(images=rgb, return_tensors="pt")).logits
        return torch.nn.functional.interpolate(lo, size=(fh, fw), mode="bilinear").argmax(1)[0].numpy()
    a, c = seg("ade"), seg("clo")
    lab = _SEG["ade"][1].config.id2label
    ade = lambda *ws: np.isin(a, [i for i, n in lab.items() if any(x in n for x in ws)])
    Y, X = np.mgrid[0:fh, 0:fw].astype(np.float32)
    blur = lambda m, s=2.0: cv2.GaussianBlur(m.astype(np.float32), (0, 0), s)
    keep = 1.0 - np.clip(blur(cv2.dilate((np.isin(c, [11, 14, 15])).astype(np.uint8), np.ones((5, 5), np.uint8)), 2.5) * 1.6, 0, 1)
    # faces (YuNet, on a copy at most 1344 wide) anchor the hair ramp: still at the scalp, freer towards the tips
    k_ = min(1.0, 1344 / w); small = cv2.resize(u8, (round(w * k_), round(h * k_)))
    _SEG["yunet"].setInputSize((small.shape[1], small.shape[0])); _, fc = _SEG["yunet"].detect(small)
    faces = [] if fc is None else [(float(r[0] + r[2] / 2) / k_ / 4, float(r[1] + r[3] / 2) / k_ / 4, float(r[3]) / k_ / 4) for r in fc]
    hair = (c == 2).astype(np.float32)
    if faces:
        ramp = np.full_like(hair, 1.0)
        for (cx, cy, fhh) in faces:
            d2 = (X - cx) ** 2 + (Y - cy) ** 2
            r = np.clip((Y - cy) / (1.8 * fhh) + 0.25, 0.1, 1.0) * np.clip(np.sqrt(d2) / (1.2 * fhh), 0.25, 1.0)
            near = d2 < (4.0 * fhh) ** 2
            ramp = np.where(near, np.minimum(ramp, r), ramp)
    else:
        ramp = np.full_like(hair, 0.6)
    cl = np.isin(c, [4, 5, 7, 17])
    cramp = np.zeros_like(hair)
    if cl.any():
        ys = np.where(cl.any(1))[0]; y0, y1 = ys.min(), ys.max()
        cramp = np.clip((Y - y0) / max(1, y1 - y0), 0, 1) ** 1.3 * 0.85 + 0.15
    person = c > 0                                     # the main people only (the crowd stays put)
    yb = float(np.where(person.any(1))[0].max()) if person.any() else float(fh)
    # lights: small bright spots that stand out from a dark surround (lamps, candles, string lights) - not white flowers
    hsv = cv2.cvtColor(cv2.resize(u8, (fw, fh), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2HSV).astype(np.float32)
    V, S_ = hsv[..., 2], hsv[..., 1]
    lamp_zone = ade("lamp", "light", "chandelier", "sconce", "candle")
    dark = V.mean() < 115
    H_ = hsv[..., 0]
    away = cv2.dilate((person | ade("person")).astype(np.uint8), np.ones((9, 9), np.uint8)) == 0   # never a face or a jewel
    cand = ((V > 210) & (V - cv2.GaussianBlur(V, (0, 0), 6) > 28) & (((H_ >= 5) & (H_ <= 45) & (S_ > 50)) | lamp_zone)
            & (dark | lamp_zone) & away)
    n_, labels, st, _ = cv2.connectedComponentsWithStats(cand.astype(np.uint8))
    small_ = np.zeros(n_, bool); small_[1:] = st[1:, cv2.CC_STAT_AREA] < 0.0012 * fw * fh     # bulbs and flames, not windows
    cand = small_[labels]
    phase = np.random.default_rng(5).uniform(0, 2 * np.pi, n_ + 1).astype(np.float32)[labels]
    light = blur(cv2.dilate(cand.astype(np.uint8), np.ones((3, 3), np.uint8)), 1.5)
    return dict(hair=blur(hair) * ramp * keep, cloth=blur(cl) * cramp * keep,
                foliage=blur(ade("tree", "grass", "plant", "flower", "field", "palm"), 2.5) * keep,
                sky=blur(cv2.erode(ade("sky").astype(np.uint8), np.ones((5, 5), np.uint8)), 5.0), water=blur(ade("water", "sea", "river", "lake", "pool", "fountain"), 2.5),
                breath=blur(person, 3.0) * (Y - yb) * 4.0, light=np.clip(light * 1.4, 0, 1), phase=blur(phase, 1.0))

def anim_load(img, key, prm):
    p = CACHE / f"{key}_anim.npz"
    if p.exists():
        z_ = np.load(p); A = {k: z_[k].astype(np.float32) for k in z_.files}
    else:
        A = anim_compute(img); np.savez_compressed(p, **{k: v.astype(np.float16) for k, v in A.items()})
    fh, fw = A["hair"].shape; q = img.shape[1] / fw
    A["q"] = q; A["Y"], A["X"] = (g.astype(np.float32) * q for g in np.mgrid[0:fh, 0:fw])
    A["prm"] = prm; A["on"] = {k: float(np.abs(A[k]).max()) > 1e-3 for k in ("hair", "cloth", "foliage", "sky", "water", "breath", "light")}
    return A

def anim_offsets(A, mx, my, t):
    """Picture-pixel offsets (dx, dy) to add to the sampling map, and the light flicker gain, at shot time t."""
    w2, p, on, X, Y = 2 * math.pi, A["prm"], A["on"], A["X"], A["Y"]
    dx = np.zeros_like(A["hair"]); dy = np.zeros_like(dx); fl = None
    if on["hair"] and p["hair"]:
        Wh = A["hair"] * p["hair"]
        dx += 9.0 * Wh * (np.sin(w2 * 0.42 * t - Y / 170 + 0.3) + 0.35 * np.sin(w2 * 0.97 * t - Y / 90 + 1.1))
        dy += 2.5 * Wh * np.sin(w2 * 0.55 * t - Y / 150 + 2.0)
    if on["cloth"] and p["cloth"]:
        Wc = A["cloth"] * p["cloth"]
        dx += 5.0 * Wc * (np.sin(w2 * 0.33 * t - Y / 230 + 0.8) + 0.3 * np.sin(w2 * 0.81 * t - Y / 110))
        dy += 1.5 * Wc * np.sin(w2 * 0.41 * t - Y / 200 + 1.7)
    if on["foliage"] and p["foliage"]:
        Wf = A["foliage"] * p["foliage"]
        dx += 4.5 * Wf * (np.sin(w2 * 0.36 * t - X / 260 + Y / 600) + 0.4 * np.sin(w2 * 0.83 * t - X / 120 + 0.5))
        dy += 1.5 * Wf * np.sin(w2 * 0.47 * t - X / 200)
    if on["sky"] and p["sky"]: dx += -4.0 * t * A["sky"] * p["sky"]           # clouds drift ~4 px/s
    if on["water"] and p["water"]:
        Ww = A["water"] * p["water"]
        dy += 2.5 * Ww * np.sin(w2 * 0.8 * t - X / 40); dx += 1.5 * Ww * np.sin(w2 * 0.6 * t - Y / 30)
    if on["breath"] and p["breath"]: dy += -0.003 * A["breath"] * p["breath"] * math.sin(w2 * t / 3.6)
    fx, fy = mx / A["q"], my / A["q"]
    DX = cv2.remap(dx, fx, fy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    DY = cv2.remap(dy, fx, fy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    if on["light"] and p["lights"]:
        ph = A["phase"]
        f_ = A["light"] * (0.55 * np.sin(w2 * 1.7 * t + ph) + 0.45 * np.sin(w2 * 4.3 * t + 2.3 * ph)) * 0.22 * p["lights"]
        fl = cv2.remap(f_, fx, fy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return DX, DY, fl

# ---------------------------------------------------------------- screen-space extras
COLORS = {"petals": (252, 246, 236), "dust": (255, 220, 150), "bokeh": (255, 200, 120), "snow": (255, 255, 255),
          "fireflies": (210, 255, 120), "embers": (255, 150, 60), "rain": (205, 215, 230)}     # RGB defaults

class Particles:
    """kind: petals | dust | bokeh | stars | rain | snow | fireflies | embers | pearls; color (RGB) overrides the default."""
    def __init__(self, kind, n, seed, area=(0, 0, W, H), color=None):
        r = np.random.default_rng(seed)
        self.kind, self.n = kind, n
        rgb = color or COLORS.get(kind, (255, 245, 235)); self.col = (rgb[2], rgb[1], rgb[0])
        x0, y0, x1, y1 = area
        self.p = np.stack([r.uniform(x0, x1, n), r.uniform(y0, y1, n)], 1)
        if kind == "petals":
            self.v = np.stack([r.uniform(40, 140, n), r.uniform(-120, -30, n)], 1)
            self.size = r.uniform(10, 22, n); self.ang = r.uniform(0, 360, n); self.spin = r.uniform(-120, 120, n)
        elif kind == "dust":
            self.v = np.stack([r.uniform(-12, 12, n), r.uniform(-18, -4, n)], 1)
            self.size = r.uniform(1.5, 4.5, n); self.ph = r.uniform(0, 6.28, n)
        elif kind == "bokeh":
            self.v = np.stack([r.uniform(-6, 6, n), r.uniform(-10, -2, n)], 1)
            self.size = r.uniform(10, 34, n); self.ph = r.uniform(0, 6.28, n)
        elif kind == "stars":
            self.v = np.zeros((n, 2)); self.size = r.uniform(5, 13, n); self.ph = r.uniform(0, 6.28, n); self.fr = r.uniform(2, 5, n)
        elif kind == "rain":                                   # slanted streaks, fast
            self.v = np.stack([r.uniform(-260, -180, n), r.uniform(1500, 2100, n)], 1); self.size = r.uniform(26, 60, n)
        elif kind == "snow":                                   # soft flakes drifting down with a sway
            self.v = np.stack([r.uniform(-20, 20, n), r.uniform(40, 110, n)], 1); self.size = r.uniform(2, 6, n); self.ph = r.uniform(0, 6.28, n)
        elif kind == "pearls":                                 # shiny pearls raining down
            self.v = np.stack([r.uniform(-25, 25, n), r.uniform(430, 700, n)], 1)
            self.size = r.uniform(5.0, 11.0, n); self.ph = r.uniform(0, 6.28, n)
        elif kind in ("fireflies", "embers"):                  # glowing points: fireflies wander, embers rise
            up = (-90, -35) if kind == "embers" else (-14, 14)
            self.v = np.stack([r.uniform(-18, 18, n), r.uniform(*up, n)], 1); self.size = r.uniform(2.5, 5.5, n); self.ph = r.uniform(0, 6.28, n)
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
                cv2.ellipse(ov, (int(x), int(y)), (int(L), int(Wd)), ang, 0, 360, self.col, -1, cv2.LINE_AA)
            a = cv2.GaussianBlur(a, (0, 0), 1.2); ov = cv2.GaussianBlur(ov, (0, 0), 1.2)
        elif self.kind == "dust":
            for k in range(self.n):
                x = (self.p[k, 0] + self.v[k, 0] * t) % W; y = (self.p[k, 1] + self.v[k, 1] * t) % H
                tw = 0.45 + 0.55 * (0.5 + 0.5 * math.sin(2.2 * t + self.ph[k]))
                cv2.circle(a, (int(x), int(y)), int(self.size[k] + 2), 0.75 * tw, -1, cv2.LINE_AA)
                cv2.circle(ov, (int(x), int(y)), int(self.size[k] + 2), self.col, -1, cv2.LINE_AA)
            a = cv2.GaussianBlur(a, (0, 0), 2.2); ov = cv2.GaussianBlur(ov, (0, 0), 2.2)
        elif self.kind == "bokeh":
            for k in range(self.n):
                x = (self.p[k, 0] + self.v[k, 0] * t) % W; y = (self.p[k, 1] + self.v[k, 1] * t) % H
                tw = 0.35 + 0.65 * (0.5 + 0.5 * math.sin(1.3 * t + self.ph[k]))
                cv2.circle(a, (int(x), int(y)), int(self.size[k]), 0.32 * tw, -1, cv2.LINE_AA)
                cv2.circle(ov, (int(x), int(y)), int(self.size[k]), self.col, -1, cv2.LINE_AA)
            a = cv2.GaussianBlur(a, (0, 0), 6); ov = cv2.GaussianBlur(ov, (0, 0), 6)
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
        elif self.kind == "rain":
            for k in range(self.n):
                x = (self.p[k, 0] + self.v[k, 0] * t) % (W + 200) - 100; y = (self.p[k, 1] + self.v[k, 1] * t) % (H + 120) - 60
                L = self.size[k]; dx, dy = self.v[k] / np.linalg.norm(self.v[k]) * L
                cv2.line(a, (int(x), int(y)), (int(x + dx), int(y + dy)), 0.55, 2 if k % 3 == 0 else 1, cv2.LINE_AA)
            ov[:] = self.col; a = cv2.GaussianBlur(a, (0, 0), 0.8)
        elif self.kind == "snow":
            for k in range(self.n):
                x = (self.p[k, 0] + self.v[k, 0] * t + 22 * math.sin(0.9 * t + self.ph[k])) % W; y = (self.p[k, 1] + self.v[k, 1] * t) % (H + 20) - 10
                cv2.circle(a, (int(x), int(y)), int(self.size[k]), 0.85, -1, cv2.LINE_AA)
            ov[:] = self.col; a = cv2.GaussianBlur(a, (0, 0), 1.4)
        elif self.kind == "pearls":
            for k in range(self.n):
                x = (self.p[k, 0] + self.v[k, 0] * t + 8 * math.sin(1.3 * t + self.ph[k])) % (W + 40) - 20
                y = (self.p[k, 1] + self.v[k, 1] * t) % (H + 60) - 30
                rr_ = self.size[k]; c_ = (int(x), int(y))
                cv2.circle(a, c_, int(rr_), 0.97, -1, cv2.LINE_AA)
                cv2.circle(ov, c_, int(rr_), (196, 204, 214), -1, cv2.LINE_AA)                       # rim
                cv2.circle(ov, (int(x - rr_ * 0.15), int(y - rr_ * 0.18)), int(rr_ * 0.78), (232, 238, 244), -1, cv2.LINE_AA)
                cv2.circle(ov, (int(x - rr_ * 0.35), int(y - rr_ * 0.4)), max(1, int(rr_ * 0.3)), (255, 255, 255), -1, cv2.LINE_AA)
            a = cv2.GaussianBlur(a, (0, 0), 0.7); ov = cv2.GaussianBlur(ov, (0, 0), 0.7)
        elif self.kind in ("fireflies", "embers"):
            for k in range(self.n):
                x = (self.p[k, 0] + self.v[k, 0] * t + 16 * math.sin(0.7 * t + self.ph[k])) % W
                y = (self.p[k, 1] + self.v[k, 1] * t + 10 * math.cos(0.9 * t + self.ph[k])) % H
                tw = 0.25 + 0.75 * (0.5 + 0.5 * math.sin(2.6 * t + self.ph[k])) ** 2
                cv2.circle(a, (int(x), int(y)), int(self.size[k] * 3), 0.35 * tw, -1, cv2.LINE_AA)
                cv2.circle(a, (int(x), int(y)), int(self.size[k]), 1.0 * tw, -1, cv2.LINE_AA)
            ov[:] = self.col; a = np.maximum(cv2.GaussianBlur(a, (0, 0), 2.0), cv2.GaussianBlur(a, (0, 0), 7) * 1.4)
        a = np.clip(a * alpha, 0, 1)[..., None]
        return frame * (1 - a) + ov * a

FONTS = Path(__import__("os").environ.get("REEL_FONTS", str(Path(__file__).resolve().parents[1] / "fonts")))
FONT_DEV = cfg.get("caption_font") or str(FONTS / "NotoSansDevanagari_700Bold.ttf")   # the lyric strips' font
LANG = cfg.get("caption_lang", "hi")                                                     # raqm language for shaping

def strip_image(text, seed, size=46, ink=(28, 24, 22, 255), spans=False):
    """A torn strip of white paper with one lyric line (RGBA, with its soft shadow). spans=True also returns each
    word's [x0, x1] in the strip image (for the karaoke wipe)."""
    r = np.random.default_rng(seed)
    f = ImageFont.truetype(FONT_DEV, size, layout_engine=ImageFont.Layout.RAQM)
    bb = f.getbbox(text, language=LANG)
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
    ox = pad + 35 - bb[0]
    d.text((ox, pad + 22 - bb[1]), text, font=f, fill=ink, language=LANG)
    out = np.array(Image.alpha_composite(shadow, paper)).astype(np.float32)
    if not spans: return out
    ws, sp = text.split(" "), []
    for i in range(len(ws)):
        a = f.getlength(" ".join(ws[:i]) + (" " if i else ""), language=LANG) if i else 0.0
        sp.append([ox + bb[0] + a, ox + bb[0] + f.getlength(" ".join(ws[:i + 1]), language=LANG)])
    return out, sp

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
    prm = anim_params(sh)
    sh["anim_"] = anim_load(sh["img_"], Path(sh["img"]).stem, prm) if prm else None
    sh["fx_"] = [Particles(fx["kind"], fx.get("n", 30), 100 + 10 * k + j, tuple(fx.get("area", (0, 0, W, H))), fx.get("color"))
                 for j, fx in enumerate(sh.get("fx", []))]
strips = []
for j, s in enumerate(cfg.get("strips", [])):
    strips.append(dict(s, img_=strip_image(s["text"], 50 + j, s.get("size", 46))))
captions = []
for j, c in enumerate(cfg.get("captions", [])):
    text = " ".join(w for w, _ in c["words"])
    dim = strip_image(text, 80 + j, c.get("size", 60), ink=(150, 140, 132, 255))
    dark, spans = strip_image(text, 80 + j, c.get("size", 60), spans=True)
    captions.append(dict(c, dim_=dim, dark_=dark, spans_=spans, xx_=np.arange(dim.shape[1], dtype=np.float32)[None, :, None]))

def draw_captions(f, t):
    for c in captions:
        if not (c["t0"] - 0.15 <= t <= c["t1"] + 0.18): continue     # quick in and out, so two lines never overlap
        q = min(1.0, (t - c["t0"] + 0.15) / 0.15)
        out = max(0.0, min(1.0, (c["t1"] + 0.18 - t) / 0.18))
        rx = c["spans_"][0][0]                                    # karaoke: dark ink up to here
        ws = c["words"]
        for i, (_, ts) in enumerate(ws):
            nxt = ws[i + 1][1] if i + 1 < len(ws) else c["t1"]
            if t >= ts:
                k = min(1.0, (t - ts) / max(0.12, min(0.45, nxt - ts)))
                rx = c["spans_"][i][0] + k * (c["spans_"][i][1] - c["spans_"][i][0])
        m = np.clip((rx - c["xx_"]) / 10.0 + 0.5, 0, 1)
        img = c["dark_"] * m + c["dim_"] * (1 - m)
        sc = 0.86 + 0.14 * ease(q, "out")
        f = paste_rgba(f, img, c["x"], c["y"], sc, c.get("rot", 0), alpha=min(q * 1.4, out))
    return f
vig = None

HEART_UNIT = [(16 * math.sin(a) ** 3, -(13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a)))
              for a in np.linspace(0, 2 * math.pi, 34, endpoint=False)]
def heart_cloud(f, lt, ov):
    """A fluffy cloud that drifts together into a heart (screen space): two loose cloud groups meet over ov['form'] s."""
    k = ease(min(1.0, max(0.0, lt / ov.get("form", 1.6))), "inout")
    x0, y0, sz = ov["x"], ov["y"], ov["size"] / 32.0
    rr = np.random.default_rng(7)
    pts = list(HEART_UNIT)
    poly = np.array(HEART_UNIT, np.float32)
    for gy in np.arange(-11, 16, 2.4):                    # fill the inside densely (no holes)
        for gx in np.arange(-14, 15, 2.4):
            if cv2.pointPolygonTest(poly, (float(gx), float(gy)), True) > 1.0: pts.append((gx + rr.uniform(-.5, .5), gy + rr.uniform(-.5, .5)))
    ds = 4                                                # draw small, blur, scale up: soft painted edges
    a_ = np.zeros((H // ds, W // ds), np.float32); lit = np.zeros_like(a_); shade = np.zeros_like(a_)
    for i, (hx, hy) in enumerate(pts):
        side = -1 if hx < 0 else 1
        sx, sy = x0 + side * (380 + (i % 6) * 30) + hx * sz * 0.6, y0 + 60 + hy * sz * 0.5
        px, py = (sx + (x0 + hx * sz - sx) * k) / ds, (sy + (y0 + hy * sz - sy) * k) / ds
        r = ((2.6 + rr.uniform(0, 1.4)) if i < len(HEART_UNIT) else (2.3 + rr.uniform(0, 0.6))) * sz / ds
        cv2.circle(a_, (int(px), int(py)), int(r * 1.15), 1.0, -1, cv2.LINE_AA)
        cv2.circle(shade, (int(px), int(py + r * 0.35)), int(r), 1.0, -1, cv2.LINE_AA)
        cv2.circle(lit, (int(px - r * 0.25), int(py - r * 0.3)), int(r * 0.75), 1.0, -1, cv2.LINE_AA)
    a_, lit, shade = (cv2.GaussianBlur(m, (0, 0), 1.6 + 3 * (1 - k)) for m in (a_, lit, shade))
    up = lambda m: cv2.resize(m, (W, H), interpolation=cv2.INTER_CUBIC)[..., None]
    a_, lit = up(a_), up(lit)
    # sunset-lit cloud colours (BGR): warm cream on top, pink-mauve underneath, puff highlights, a little paint texture
    ys = np.where(a_[..., 0].max(1) > 0.2)[0]; y_top, y_bot = (ys.min(), ys.max()) if len(ys) else (0, H)
    vk = np.clip((y_bot - np.arange(H, dtype=np.float32)) / max(1, y_bot - y_top), 0, 1)[:, None, None] ** 0.8
    col = np.array([168, 150, 228], np.float32) * (1 - vk) + np.array([200, 220, 255], np.float32) * vk
    col = col * (1 - 0.4 * lit) + np.array([222, 238, 255], np.float32) * 0.4 * lit
    tex = cv2.resize(rr.normal(0, 1, (H // 45, W // 45)).astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)[..., None]
    col = col * (1 + 0.03 * tex)
    a = np.clip(a_ * ov.get("alpha", 0.93) * (0.55 + 0.45 * k), 0, 1)
    return f * (1 - a) + col * a

# grade: (BGR multiply, BGR add, saturation)
GRADES = {"night": ([0.80, 0.64, 0.51], [16, 6, 0], 1.0),        # moonlit: darker, cooler, blue lift in the shadows
          "warm":  ([0.92, 1.0, 1.06], [0, 4, 10], 1.04),          # golden hour
          "cool":  ([1.06, 0.98, 0.90], [8, 2, 0], 0.92),          # sad / lonely blue
          "rain":  ([1.04, 0.96, 0.88], [10, 6, 2], 0.72),         # grey-blue, washed out
          "sepia": ([0.78, 0.92, 1.04], [10, 14, 22], 0.35),       # memory / flashback
          "dusk":  ([1.02, 0.86, 0.96], [12, 0, 10], 0.95),        # violet evening
          "dawn":  ([0.96, 0.98, 1.04], [8, 10, 14], 0.96)}        # soft early light

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
    # keep the view inside the painting (no mirrored edges): clamp the centre for this zoom, roll and parallax
    hs, ws = sh["img_"].shape[:2]; s_ = max(W / ws, H / hs) * z
    mg = 0.012 + 0.55 * abs(math.sin(math.radians(rot))) + (abs(par[0]) / W + abs(par[1]) / H) * 0.6
    hx, hy = min(0.5, W / (2 * s_ * ws) + mg), min(0.5, H / (2 * s_ * hs) + mg)
    c = (min(max(c[0], hx), 1 - hx), min(max(c[1], hy), 1 - hy))
    f = render_still(sh["img_"], sh["depth_"], z, c, rot, par, sh.get("dolly", 0.0) * e, sh.get("d0", 0.5), shift,
                     sh.get("anim_"), t - sh["t0"])
    gr = sh.get("grade", cfg.get("grade"))
    if gr in GRADES:                                   # colour grade per shot (or for the whole reel)
        mul, add, sat = GRADES[gr]
        if sat != 1.0:
            lum = f @ np.array([0.114, 0.587, 0.299], np.float32)
            f = lum[..., None] + (f - lum[..., None]) * sat
        f = f * np.array(mul, np.float32) + np.array(add, np.float32)
    for ov in sh.get("overlays", []):
        if ov["kind"] == "heart": f = heart_cloud(f, t - sh["t0"], ov)
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
    f = draw_captions(f, t)
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
if "--stills" in args:                                  # --stills 1.5,7.2,... <dir>: several checking frames in one go
    i = args.index("--stills"); d = Path(args[i + 2]); d.mkdir(parents=True, exist_ok=True)
    for t in map(float, args[i + 1].split(",")): cv2.imwrite(str(d / f"still_{t:06.2f}.jpg"), finish(frame_at(t), t))
    sys.exit()
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
