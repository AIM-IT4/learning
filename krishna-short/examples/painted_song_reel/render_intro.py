"""The 3.4-second intro of the reel (1080x1920, 30 fps): a laptop on a dark desk with a glowing keyboard, two tiles
on top ("Claude" x the song), the laptop screen showing the chat that made the reel, then a player window opening on
the finished music video; it dims to black at the end.
  python3 render_intro.py <laptop.jpeg> <mv.mp4> <out.mp4>
The laptop picture must show a flat green screen: it is found by colour and replaced in perspective.
"""
import math, subprocess, sys
from pathlib import Path
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS, DUR = 1080, 1920, 30, 3.40
HERE = Path(__file__).resolve().parent
FD = Path(__file__).resolve().parents[2] / "code_scenes" / "fonts"
REPO_FONTS = FD
laptop_p, mv_p, out_p = sys.argv[1:4]

def ease(u, kind="inout"):
    u = min(1.0, max(0.0, u))
    return 1 - (1 - u) ** 3 if kind == "out" else 0.5 - 0.5 * math.cos(math.pi * u)

# ---------------------------------------------------------------- the laptop picture and its screen
lap0 = cv2.imread(laptop_p)
h0, w0 = lap0.shape[:2]
mk = np.zeros((h0, w0), np.uint8); cv2.circle(mk, (w0 - 113, h0 - 113), 40, 255, -1)       # Flow's corner mark
lap0 = cv2.inpaint(lap0, mk, 9, cv2.INPAINT_TELEA)
def find_green(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    g = ((hsv[..., 0] > 40) & (hsv[..., 0] < 90) & (hsv[..., 1] > 90) & (hsv[..., 2] > 70)).astype(np.uint8) * 255
    return cv2.morphologyEx(g, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
def quad_of(gmask):
    cnts, _ = cv2.findContours(gmask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cnt = max(cnts, key=cv2.contourArea); q = None
    for eps in np.linspace(0.01, 0.08, 15):
        ap = cv2.approxPolyDP(cnt, eps * cv2.arcLength(cnt, True), True)
        if len(ap) == 4: q = ap.reshape(4, 2).astype(np.float32); break
    if q is None: q = cv2.boxPoints(cv2.minAreaRect(cnt)).astype(np.float32)
    s_ = q.sum(1); d_ = np.diff(q, axis=1).ravel()
    return np.array([q[np.argmin(s_)], q[np.argmin(d_)], q[np.argmax(s_)], q[np.argmax(d_)]], np.float32)  # tl tr br bl
q0 = quad_of(find_green(lap0))
# frame it like the original: the screen spans x 108-979 with its top edge at y 561
sc = 871 / ((q0[1, 0] - q0[0, 0] + q0[2, 0] - q0[3, 0]) / 2)
A = np.float32([[sc, 0, 108 - sc * min(q0[0, 0], q0[3, 0])], [0, sc, 561 - sc * min(q0[0, 1], q0[1, 1])]])
bg = [int(v) for v in np.median(lap0[: h0 // 6].reshape(-1, 3), 0)]
lap = cv2.warpAffine(lap0, A, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=bg)
green = find_green(lap)
quad = quad_of(green)
print("screen quad", quad.round(1).tolist())
mask = np.zeros((H, W), np.float32)
cv2.fillConvexPoly(mask, quad.astype(np.int32), 1.0)
near = cv2.dilate((mask * 255).astype(np.uint8), np.ones((25, 25), np.uint8))       # only green at the screen is keyed
green_in = cv2.bitwise_and(green, near)
mask = np.maximum(mask, cv2.dilate(green_in, np.ones((5, 5), np.uint8)).astype(np.float32) / 255)
mask = cv2.GaussianBlur(mask, (0, 0), 1.2)[..., None]
# green light the screen threw on the bezel and the desk: pull green down to the other channels everywhere
b, g, r = cv2.split(lap.astype(np.float32))
g = np.minimum(g, np.maximum(r, b) + 6)
lap = cv2.merge([b, g, r])

# ---------------------------------------------------------------- what the screen shows
SW = 1600; SH = int(round(SW / ((np.linalg.norm(quad[1] - quad[0]) + np.linalg.norm(quad[2] - quad[3])) / (np.linalg.norm(quad[3] - quad[0]) + np.linalg.norm(quad[2] - quad[1])))))
def font(name, size):
    return ImageFont.truetype(str(name), size)
F_UI = FD / "Poppins_300Light.ttf"; F_UIM = FD / "Poppins_500Medium.ttf"

def chat_screen(show_file):
    im = Image.new("RGB", (SW, SH), (38, 38, 36)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, SW, 46], fill=(30, 30, 28)); d.text((24, 10), "Reel · Sochenge Tumhe Pyar", font=font(F_UIM, 20), fill=(210, 205, 195))
    for k, c in enumerate([(236, 106, 94), (245, 191, 79), (98, 197, 84)]): d.ellipse([SW - 110 + 30 * k, 16, SW - 96 + 30 * k, 30], fill=c)
    d.rectangle([0, 46, 300, SH], fill=(32, 32, 30))
    for k, t in enumerate(["New chat", "Projects", "Song reels", "Story films", "Documentary"]):
        d.text((28, 80 + 46 * k), t, font=font(F_UI, 21), fill=(170, 165, 155))
    y = 90
    d.rounded_rectangle([760, y, 1540, y + 74], radius=18, fill=(58, 57, 54))
    d.text((786, y + 20), "Make a reel like this one for this song", font=font(F_UI, 24), fill=(235, 230, 220)); y += 120
    lines = ["Hook found at 0:52, the mukhda twice and the antara line, 123 BPM.",
             "Twelve painted shots, one per bar, cut on the downbeat:",
             "the hill and the daisy, a heart in the clouds, the swing,",
             "the phone call, the diary, rooftops under the stars.",
             "", "Painted every shot in Flow, depth maps done, moving each",
             "still in 2.5D. Rendering the master: 1080x1920, 30 fps."]
    for t in lines:
        d.text((360, y), t, font=font(F_UI, 25), fill=(222, 216, 204)); y += 42
    if show_file:
        y += 20
        d.rounded_rectangle([360, y, 980, y + 92], radius=16, fill=(50, 49, 46), outline=(80, 78, 74), width=2)
        d.rounded_rectangle([382, y + 18, 432, y + 74], radius=8, fill=(90, 88, 84))
        d.polygon([(400, y + 34), (400, y + 58), (420, y + 46)], fill=(230, 226, 216))
        d.text((452, y + 16), "Sochenge_Tumhe_Pyar_reel.mp4", font=font(F_UIM, 23), fill=(235, 230, 220))
        d.text((452, y + 50), "Video · 27.5 s", font=font(F_UI, 20), fill=(160, 156, 148))
    d.rounded_rectangle([360, SH - 110, 1540, SH - 40], radius=20, fill=(50, 49, 46), outline=(74, 72, 68), width=2)
    d.text((390, SH - 92), "Reply…", font=font(F_UI, 23), fill=(130, 126, 120))
    return np.array(im)[..., ::-1].astype(np.float32)

SCR_A, SCR_B = chat_screen(False), chat_screen(True)

cap = cv2.VideoCapture(mv_p); mv_frames = []
while len(mv_frames) < int(1.6 * FPS):
    ok, fr = cap.read()
    if not ok: break
    mv_frames.append(fr)
cap.release()

def player(fr_mv, k):
    """A player window (title bar, 16:9 video, scrub bar) as RGBA float, 1180 px wide."""
    pw = 1180; vh = int(pw * 9 / 16); ph = vh + 40 + 46
    img = Image.new("RGBA", (pw + 40, ph + 40), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    sh = Image.new("L", img.size, 0); ImageDraw.Draw(sh).rounded_rectangle([24, 28, pw + 16, ph + 20], radius=16, fill=170)
    img.putalpha(sh.filter(ImageFilter.GaussianBlur(10)))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([20, 20, pw + 20, ph + 20], radius=14, fill=(28, 28, 27, 255))
    d.text((40, 28), "Sochenge_Tumhe_Pyar_reel.mp4", font=font(F_UIM, 20), fill=(220, 215, 205, 255))
    d.text((pw - 10, 26), "×", font=font(F_UI, 24), fill=(200, 195, 185, 255))
    v = cv2.resize(fr_mv, (pw, vh), interpolation=cv2.INTER_AREA)[..., ::-1]
    img.paste(Image.fromarray(v), (20, 60))
    yb = 60 + vh + 18
    d.line([90, yb, pw - 30, yb], fill=(90, 88, 84, 255), width=4)
    d.line([90, yb, 90 + (pw - 120) * min(1, 0.04 + k * 0.012), yb], fill=(235, 230, 220, 255), width=4)
    d.text((34, yb - 13), "▶", font=font(F_UI, 20), fill=(235, 230, 220, 255))
    a = np.array(img).astype(np.float32)
    return a

def screen_at(t):
    scr = (SCR_A if t < 0.9 else SCR_B).copy()
    if t >= 1.75 and mv_frames:
        q = ease((t - 1.75) / 0.22, "out")
        k = min(len(mv_frames) - 1, int((t - 1.75) * FPS))
        pl = player(mv_frames[k], k)
        sc = 0.88 + 0.12 * q
        h_, w_ = pl.shape[:2]
        M = cv2.getRotationMatrix2D((w_ / 2, h_ / 2), 0, sc); M[0, 2] += SW / 2 - w_ / 2; M[1, 2] += SH / 2 - h_ / 2 + 20
        wp = cv2.warpAffine(pl, M, (SW, SH), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
        a = wp[..., 3:4] / 255 * q
        scr = scr * (1 - a) + wp[..., [2, 1, 0]] * a
    return scr

Mq = cv2.getPerspectiveTransform(np.float32([[0, 0], [SW, 0], [SW, SH], [0, SH]]), quad)

# ---------------------------------------------------------------- the tiles on top
def tiles():
    im = Image.new("RGBA", (W, 420), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    T = 158; y0 = 209
    for cx in (330, 750):
        sh = Image.new("L", im.size, 0); ImageDraw.Draw(sh).rounded_rectangle([cx - T / 2 + 4, y0 + 8, cx + T / 2 + 4, y0 + T + 8], radius=38, fill=150)
        im = Image.alpha_composite(im, Image.merge("RGBA", [Image.new("L", im.size, 0)] * 3 + [sh.filter(ImageFilter.GaussianBlur(9))]))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([330 - T / 2, y0, 330 + T / 2, y0 + T], radius=38, fill=(250, 248, 244, 255))
    f = font(F_UIM, 34); w_ = f.getlength("Claude")
    d.text((330 - w_ / 2, y0 + T / 2 - 24), "Claude", font=f, fill=(40, 38, 36, 255))
    grad = np.zeros((T, T, 4), np.uint8)
    for yy in range(T):
        u = yy / T; grad[yy, :, :3] = (int(232 - 40 * u), int(92 - 30 * u), int(110 - 25 * u)); grad[yy, :, 3] = 255
    gm = Image.new("L", (T, T), 0); ImageDraw.Draw(gm).rounded_rectangle([0, 0, T - 1, T - 1], radius=38, fill=255)
    gi = Image.fromarray(grad, "RGBA"); gi.putalpha(gm)
    im.alpha_composite(gi, (750 - T // 2, y0))
    d = ImageDraw.Draw(im)
    fd = ImageFont.truetype(str(REPO_FONTS / "YatraOne.ttf"), 44, layout_engine=ImageFont.Layout.RAQM)
    bb = fd.getbbox("सोचेंगे", language="hi")
    d.text((750 - (bb[2] - bb[0]) / 2 - bb[0], y0 + T / 2 - (bb[3] - bb[1]) / 2 - bb[1]), "सोचेंगे", font=fd, fill=(255, 240, 225, 255), language="hi")
    fx = font(F_UIM, 52); d.text((540 - fx.getlength("x") / 2, y0 + T / 2 - 36), "x", font=fx, fill=(255, 255, 255, 255))
    return np.array(im).astype(np.float32)
TILES = tiles()

rng = np.random.default_rng(3)
jit = np.cumsum(rng.normal(0, 0.35, (int(DUR * FPS) + 2, 2)), 0); jit -= jit.mean(0)
p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                      "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p", out_p], stdin=subprocess.PIPE)
for i in range(int(round(DUR * FPS))):
    t = i / FPS
    scr = cv2.warpPerspective(screen_at(t), Mq, (W, H), flags=cv2.INTER_AREA)
    f = lap * (1 - mask) + (scr * 0.92 + 6) * mask
    z = 1.0 + 0.035 * t / DUR                                           # handheld: slow push and a little drift
    M = cv2.getRotationMatrix2D((W / 2, H * 0.62), 0.15 * math.sin(t * 1.3), z); M[:, 2] += jit[i] * 1.4
    f = cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    a = TILES[..., 3:4] / 255
    f[:420] = f[:420] * (1 - a) + TILES[..., [2, 1, 0]] * a
    f *= 1 - ease((t - 2.95) / 0.42)                                    # dims to black
    p.stdin.write(np.clip(f, 0, 255).astype(np.uint8).tobytes())
p.stdin.close(); p.wait(); print("done", out_p)
