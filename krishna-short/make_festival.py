#!/usr/bin/env python3
"""
make_festival.py - calm, music-aligned FESTIVAL / DEVOTIONAL status video (WhatsApp status, Reels, Shorts), 1080x1920.

Built for songs like Chhath geet or bhajans, where a beat-cut glitch reel would feel wrong:
  * shots last whole bars of the song (tempo given in the storyboard), so cuts land on the music
  * photos get a gentle 3D camera move from an AI depth map (parallax.py); paintings a slow Ken Burns
  * soft transitions (dissolve, fade, light flash, circle reveal ...), each centred on its cut
  * floating diya sparks, slowly turning sun rays (baked with a fade envelope) and a hand-drawn
    Madhubani-style border that fades in and out where the storyboard asks for it
  * Devanagari captions: title, location tags, ritual names, hook line, end card (libass, complex shaping)
  * the song section given in the storyboard, faded in/out and loudness-matched (-14 LUFS)

  python make_festival.py examples/chhath_status/storyboard.json --images final --music song.wav \
      --fonts fonts --out chhath_status.mp4

Storyboard (JSON): start (s into the song), duration, bpm, beat0 (first beat, s into the clip), fade_out,
shots: [{img, bars, fx, move, parallax, kind}], captions: [{t, end, style, text, pos}],
frame: [[from, to], ...], rays: [[from, to], ...], embers: opacity.
Use music you have the rights to.  Needs: ffmpeg (libass), numpy, Pillow; torch + transformers for parallax.
"""
import argparse
import json
import math
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

import make_reel as mr
import make_short as ms

W, H, FPS = ms.W, ms.H, ms.FPS
FX_LEN = {"fade": 0.9, "dissolve": 0.9, "fadeslow": 1.1, "fadewhite": 0.5, "fadeblack": 0.8, "circleopen": 0.8,
          "circleclose": 0.8, "smoothup": 0.7, "smoothdown": 0.7, "smoothleft": 0.7, "smoothright": 0.7,
          "radial": 0.8, "hblur": 0.6, "zoomin": 0.6, "slideup": 0.5, "vertopen": 0.8, "horzopen": 0.8}


# ----------------------------------------------------------------------------- overlays
def madhubani_border(path, w=W, h=H, band=60):
    """Transparent PNG with a Mithila-style border: red band with fish and lotus, saffron hatched band,
    sun medallions in the corners, a dotted gold inner line."""
    s = 2                                                   # draw at 2x, then downscale (smooth edges)
    W2, H2, b = w * s, h * s, band * s
    im = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    red, saffron, green, indigo, pink, black, cream = ((176, 18, 27, 255), (242, 169, 0, 255), (30, 130, 70, 255),
                                                       (40, 52, 140, 255), (236, 92, 140, 255), (10, 10, 10, 255),
                                                       (252, 240, 214, 255))
    # outer red band and inner saffron hatched band
    d.rectangle([0, 0, W2, H2], outline=None)
    for x0, y0, x1, y1 in ((0, 0, W2, b), (0, H2 - b, W2, H2), (0, 0, b, H2), (W2 - b, 0, W2, H2)):
        d.rectangle([x0, y0, x1, y1], fill=red)
    hb = 16 * s
    inner = [(b, b, W2 - b, b + hb), (b, H2 - b - hb, W2 - b, H2 - b), (b, b, b + hb, H2 - b), (W2 - b - hb, b, W2 - b, H2 - b)]
    for x0, y0, x1, y1 in inner:
        d.rectangle([x0, y0, x1, y1], fill=saffron)
    step = 9 * s                                            # diagonal hatching on the saffron band
    for k in range(-H2, W2 + H2, step):
        for x0, y0, x1, y1 in inner:
            # clip a 45 degree line to the band rectangle
            pts = []
            for xx in (x0, x1):
                yy = xx - k
                if y0 <= yy <= y1:
                    pts.append((xx, yy))
            for yy in (y0, y1):
                xx = yy + k
                if x0 <= xx <= x1:
                    pts.append((xx, yy))
            if len(pts) >= 2:
                d.line([pts[0], pts[1]], fill=(120, 40, 0, 255), width=s)
    for x0, y0, x1, y1 in ((0, 0, W2 - 1, H2 - 1), (b, b, W2 - b, H2 - b), (b + hb, b + hb, W2 - b - hb, H2 - b - hb)):
        d.rectangle([x0, y0, x1, y1], outline=black, width=3 * s)

    def fish(cx, cy, ang, col):
        L, T = 30 * s, 11 * s
        ca, sa = math.cos(ang), math.sin(ang)
        rot = lambda px, py: (cx + px * ca - py * sa, cy + px * sa + py * ca)
        body = [rot(L * math.cos(t), T * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 40)]
        d.polygon(body, fill=col, outline=black)
        d.line(body + [body[0]], fill=black, width=2 * s)
        tail = [rot(-L * 0.9, 0), rot(-L * 1.45, -T * 1.1), rot(-L * 1.45, T * 1.1)]
        d.polygon(tail, fill=saffron, outline=black)
        d.line(tail + [tail[0]], fill=black, width=2 * s)
        for k in range(3):                                  # scale arcs
            px = -L * 0.35 + k * L * 0.32
            a0 = rot(px, -T * 0.7); a1 = rot(px + L * 0.12, 0); a2 = rot(px, T * 0.7)
            d.line([a0, a1, a2], fill=black, width=s)
        ex, ey = rot(L * 0.62, -T * 0.15)
        d.ellipse([ex - 3 * s, ey - 3 * s, ex + 3 * s, ey + 3 * s], fill=cream, outline=black, width=s)

    def lotus(cx, cy, ang):
        for k, a in enumerate(np.linspace(-1.1, 1.1, 5)):
            aa = ang + a
            px, py = cx + 14 * s * math.sin(aa), cy - 14 * s * math.cos(aa)
            r1, r2 = 6 * s, 15 * s
            pet = [(px + r1 * math.cos(t) * math.cos(aa) - r2 * math.sin(t) * math.sin(aa),
                    py + r1 * math.cos(t) * math.sin(aa) + r2 * math.sin(t) * math.cos(aa)) for t in np.linspace(0, 2 * math.pi, 30)]
            d.polygon(pet, fill=pink if k % 2 else cream, outline=black)
            d.line(pet + [pet[0]], fill=black, width=s)
        d.ellipse([cx - 7 * s, cy - 7 * s, cx + 7 * s, cy + 7 * s], fill=saffron, outline=black, width=2 * s)

    def motifs(x0, y0, x1, y1, horizontal):
        length = (x1 - x0) if horizontal else (y1 - y0)
        n = max(2, int(length / (118 * s)))
        for i in range(n):
            t = (i + 0.5) / n
            cx = x0 + t * (x1 - x0) if horizontal else (x0 + x1) / 2
            cy = (y0 + y1) / 2 if horizontal else y0 + t * (y1 - y0)
            if i % 2 == 0:
                fish(cx, cy, 0 if horizontal else math.pi / 2, (green, indigo, saffron)[(i // 2) % 3])
            else:
                lotus(cx, cy, 0 if horizontal else math.pi / 2)
    motifs(b, 0, W2 - b, b, True); motifs(b, H2 - b, W2 - b, H2, True)
    motifs(0, b, b, H2 - b, False); motifs(W2 - b, b, W2, H2 - b, False)

    def sun(cx, cy):
        R = b * 0.42
        for k in range(16):
            a = 2 * math.pi * k / 16
            tip = (cx + R * 1.18 * math.cos(a), cy + R * 1.18 * math.sin(a))
            l = (cx + R * 0.75 * math.cos(a - 0.17), cy + R * 0.75 * math.sin(a - 0.17))
            r = (cx + R * 0.75 * math.cos(a + 0.17), cy + R * 0.75 * math.sin(a + 0.17))
            d.polygon([l, tip, r], fill=saffron if k % 2 else cream, outline=black)
        d.ellipse([cx - R * 0.72, cy - R * 0.72, cx + R * 0.72, cy + R * 0.72], fill=(232, 90, 20, 255), outline=black, width=2 * s)
        d.ellipse([cx - R * 0.3, cy - R * 0.3, cx + R * 0.3, cy + R * 0.3], fill=saffron, outline=black, width=s)
    for cx, cy in ((b / 2, b / 2), (W2 - b / 2, b / 2), (b / 2, H2 - b / 2), (W2 - b / 2, H2 - b / 2)):
        d.rectangle([cx - b / 2, cy - b / 2, cx + b / 2, cy + b / 2], fill=red, outline=black, width=3 * s)
        sun(cx, cy)
    gold = (255, 205, 90, 255)                               # dotted gold line just inside the border
    o = b + hb + 9 * s
    for x in range(o, W2 - o, 14 * s):
        for y in (o, H2 - o):
            d.ellipse([x - 2 * s, y - 2 * s, x + 2 * s, y + 2 * s], fill=gold)
    for y in range(o, H2 - o, 14 * s):
        for x in (o, W2 - o):
            d.ellipse([x - 2 * s, y - 2 * s, x + 2 * s, y + 2 * s], fill=gold)
    im.resize((w, h), Image.LANCZOS).save(path)


def envelope(t, spans, ramp=0.8):
    """0..1: 1 inside the spans, smooth ramps at their edges."""
    v = 0.0
    for a, b in spans:
        up = np.clip((t - a) / ramp + 0.5, 0, 1) if a > 0 else 1.0
        dn = np.clip((b - t) / ramp + 0.5, 0, 1)
        v = max(v, float(min(up, dn)))
    return v


def sun_rays(path, duration, spans, w=540, h=960):
    """Warm god-rays from above the top of the frame, slowly turning; brightness follows the spans."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = w * 0.5, -h * 0.12
    theta = np.arctan2(yy - cy, xx - cx)
    r = np.hypot(xx - cx, yy - cy) / h
    fall = np.exp(-((r - 0.1) / 0.75) ** 2)
    glow = np.exp(-(r / 0.35) ** 2)
    col = np.array([255, 196, 110], np.float32)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
                           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                           "-pix_fmt", "yuv420p", str(path)], stdin=subprocess.PIPE)
    for f in range(int(duration * FPS) + 1):
        t = f / FPS
        e = envelope(t, spans)
        if e <= 0:
            ff.stdin.write(bytes(w * h * 3))
            continue
        rays = (0.5 + 0.5 * np.cos(13 * theta + 0.35 * t)) ** 7 + 0.6 * (0.5 + 0.5 * np.cos(7 * theta - 0.22 * t + 1.3)) ** 9
        v = (0.55 * rays * fall + 0.45 * glow) * e
        ff.stdin.write(np.clip(v[..., None] * col, 0, 255).astype(np.uint8).tobytes())
    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit("sun rays render failed")


# ----------------------------------------------------------------------------- captions
STYLES = {
    # name: font, size, primary, outline colour, outline, alignment, marginV, bold
    "Title":    ("Yatra One", 186, "&H004DD8FF", "&H00000A6A", 8, 8, 290, 0),
    "TitleSub": ("Tiro Devanagari Hindi", 72, "&H00E6F6FF", "&H00102040", 3, 8, 505, -1),
    "Days":     ("Noto Sans Devanagari", 42, "&H00B8E8FF", "&H00101828", 2, 8, 615, -1),
    "Loc":      ("Noto Sans Devanagari", 52, "&H00FFFFFF", "&H00101010", 2, 1, 300, -1),
    "Ritual":   ("Tiro Devanagari Hindi", 100, "&H004DD8FF", "&H00000A50", 6, 2, 470, -1),
    "Hook":     ("Yatra One", 132, "&H0059E1FF", "&H00000A6A", 7, 5, 0, 0),
    "End":      ("Yatra One", 146, "&H004DD8FF", "&H00000A6A", 7, 5, 0, 0),
    "EndSub":   ("Tiro Devanagari Hindi", 58, "&H00F2FAFF", "&H00101010", 3, 5, 0, -1),
    "Pre":      ("Yatra One", 124, "&H004DD8FF", "&H00000A6A", 7, 5, 0, 0),
    "PreSub":   ("Tiro Devanagari Hindi", 78, "&H00F2FAFF", "&H00101010", 3, 5, 0, -1),
    "RowDate":  ("Noto Sans Devanagari", 62, "&H004DD8FF", "&H00101010", 2, 4, 0, -1),
    "RowName":  ("Tiro Devanagari Hindi", 70, "&H00FFFFFF", "&H00101010", 2, 4, 0, -1),
}


def write_ass(path, captions, total):
    lines = ["[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}", "WrapStyle: 0",
             "ScaledBorderAndShadow: yes", "", "[V4+ Styles]",
             "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
             "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, "
             "MarginR, MarginV, Encoding"]
    for name, (font, size, prim, outc, outl, align, mv, bold) in STYLES.items():
        lines.append(f"Style: {name},{font},{size},{prim},&H000000FF,{outc},&H64000000,{bold},0,0,0,100,100,0,0,1,"
                     f"{outl},2,{align},70,70,{mv},1")
        lines.append(f"Style: {name}Glow,{font},{size},{prim},&H000000FF,{prim},&H00000000,{bold},0,0,0,100,100,0,0,1,"
                     f"{outl + 9},0,{align},70,70,{mv},1")
    lines += ["", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    t = ms.ass_time
    for c in captions:
        st, a, b = c["style"], c["t"], min(c.get("end", c["t"] + 3), total)
        txt = ms.ass_escape(c.get("text", ""))
        if st == "Banner":  # soft maroon panel behind a block of text: box = [x, y, w, h], alpha 00 (solid) - FF
            x, y, w, h = c["box"]
            r = 36
            shape = (f"m {r} 0 l {w - r} 0 b {w} 0 {w} 0 {w} {r} l {w} {h - r} b {w} {h} {w} {h} {w - r} {h} "
                    f"l {r} {h} b 0 {h} 0 {h} 0 {h - r} l 0 {r} b 0 0 0 0 {r} 0")
            lines.append(f"Dialogue: 0,{t(a)},{t(b)},Loc,,0,0,0,,{{\\fad(500,600)\\an7\\pos({x},{y})\\bord0\\shad0"
                         f"\\blur18\\1c&H14104A&\\1a&H{c.get('alpha', '38')}&\\p1}}{shape}{{\\p0}}")
            continue
        if st == "Loc":    # location tag: gold dot + name on a soft dark halo, sliding in from the left
            mv = f"\\fad(300,300)\\move(20,{H - 300},70,{H - 300},0,350)\\an1"
            lines.append(f"Dialogue: 2,{t(a)},{t(b)},Loc,,0,0,0,,{{{mv}\\bord18\\blur14\\3c&H101018&\\3a&H50&"
                         f"\\1a&HFF&\\shad0}}{{\\fnInter}}●{{\\fnNoto Sans Devanagari}} {txt}")
            lines.append(f"Dialogue: 3,{t(a)},{t(b)},Loc,,0,0,0,,{{{mv}\\bord2}}{{\\fnInter\\1c&H4DD8FF&}}●"
                         f"{{\\fnNoto Sans Devanagari\\1c&HFFFFFF&}} {txt}")
            continue
        if st == "Row":    # schedule row: gold date, then a gold dot and the name, sliding in from the left
            y = c["y"]
            xd, xn = c.get("x", [215, 500])
            for sty, x, body in (("RowDate", xd, ms.ass_escape(c["date"])),
                                 ("RowName", xn, f"{{\\1c&H4DD8FF&}}•{{\\1c&HFFFFFF&}}  {txt}")):
                lines.append(f"Dialogue: 1,{t(a)},{t(b)},{sty},,0,0,0,,{{\\fad(350,500)\\an4"
                             f"\\move({x - 40},{y},{x},{y},0,400)\\blur0.6}}{body}")
            continue
        anim = {"Title": "\\fad(500,600)\\fscx70\\fscy70\\t(0,700,\\fscx100\\fscy100)",
                "Hook": "\\fad(150,500)\\fscx135\\fscy135\\t(0,260,\\fscx100\\fscy100)",
                "End": f"\\fad(500,500)\\an5\\pos({W // 2},{H // 2 - 40})\\fscx80\\fscy80\\t(0,800,\\fscx100\\fscy100)",
                "EndSub": f"\\fad(500,500)\\an5\\pos({W // 2},{H // 2 + 110})",
                }.get(st, "\\fad(450,450)")
        if "pos" in c:      # explicit centre position; the text drifts up 30 px into place
            x, y = c["pos"]
            anim = f"\\fad(400,500)\\an5\\move({x},{y + 30},{x},{y},0,700)"
        glow = st in ("Title", "Hook", "End", "Ritual", "Pre")
        if glow:
            lines.append(f"Dialogue: 0,{t(a)},{t(b)},{st}Glow,,0,0,0,,{{{anim}\\blur14\\alpha&H60&}}{txt}")
        lines.append(f"Dialogue: 1,{t(a)},{t(b)},{st},,0,0,0,,{{{anim}\\blur0.8}}{txt}")
    Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")


# ----------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("storyboard")
    ap.add_argument("--images", required=True, help="folder with the storyboard's images")
    ap.add_argument("--music", required=True)
    ap.add_argument("--fonts", help="folder with the caption fonts (default: ./fonts next to this script)")
    ap.add_argument("--out", default="festival_status.mp4")
    ap.add_argument("--work", help="keep rendered clips here and reuse them")
    args = ap.parse_args()

    sb = json.loads(Path(args.storyboard).read_text(encoding="utf-8"))
    total, bar = float(sb["duration"]), 4 * 60.0 / float(sb["bpm"])
    beat0 = float(sb.get("beat0", 0.0))
    # shot boundaries on bars (frame exact), last shot runs to the end
    times, acc = [0.0], beat0
    for s in sb["shots"][:-1]:
        acc += s["bars"] * bar
        times.append(acc)
    S = [round(x * FPS) for x in times] + [round(total * FPS)]
    shots = sb["shots"]
    T = [0]
    for k in range(1, len(shots)):
        want = FX_LEN.get(shots[k].get("fx", "fade"), 0.8)
        room = min(S[k] - S[k - 1], S[k + 1] - S[k]) * 0.45 / FPS
        T.append(max(2, int(min(want, room) * FPS) // 2 * 2))
    T.append(0)

    work = Path(args.work) if args.work else Path(tempfile.mkdtemp(prefix="fest_"))
    work.mkdir(parents=True, exist_ok=True)
    cache = work / "clips"
    cache.mkdir(exist_ok=True)
    for k, s in enumerate(shots):
        a, b = S[k] - T[k] // 2, S[k + 1] + T[k + 1] // 2
        s["a"] = a
        img = Path(args.images) / s["img"]
        kind, move = s.get("kind", "intro"), s.get("move", "in")
        par = s.get("parallax", False)
        key = f"{img.stem}_{b - a}_{kind}_{move}_{T[k] // 2}_{int(par)}"
        out = cache / f"{key}.mp4"
        print(f"shot {k + 1:2d}/{len(shots)} {S[k] / FPS:6.2f}s {s.get('fx', '-'):10s} {s['img']}", flush=True)
        if not out.exists():
            if par:
                import parallax
                parallax.render(img, b - a, kind, move, T[k] // 2, out, W, H, FPS, ms.GRADE)
            else:
                mr.render_clip(img, b - a, kind, move, T[k] // 2, out)
        shutil.copy(out, work / f"c{k:03d}.mp4")

    # overlays
    madhubani_border(work / "border.png")
    sun_rays(work / "rays.mp4", total, sb.get("rays", []))
    ms.make_embers(work / "embers.mp4")
    fonts = Path(args.fonts) if args.fonts else ms.FONT_DIR
    for f in fonts.glob("*.ttf"):
        shutil.copy(f, work / f.name)
    write_ass(work / "cap.ass", sb.get("captions", []), total)

    inputs, graph = [], []
    for k in range(len(shots)):
        inputs += ["-i", f"c{k:03d}.mp4"]
    last = "[0:v]"
    for k in range(1, len(shots)):
        graph.append(f"{last}[{k}:v]xfade=transition={shots[k].get('fx', 'fade')}:duration={T[k] / FPS:.4f}:"
                     f"offset={shots[k]['a'] / FPS:.4f}[x{k}]")
        last = f"[x{k}]"
    n = len(shots)
    inputs += ["-i", "rays.mp4"]
    graph.append(f"{last}format=gbrp[b0];[{n}:v]scale={W}:{H},format=gbrp[ry];"
                 f"[b0][ry]blend=all_mode=screen:shortest=1[b1]")
    n += 1
    inputs += ["-stream_loop", "-1", "-i", "embers.mp4"]
    graph.append(f"[{n}:v]scale={W}:{H},format=gbrp[em];[b1][em]blend=all_mode=screen:"
                 f"all_opacity={float(sb.get('embers', 0.8)):.2f},format=yuv420p[b2]")
    n += 1
    last = "[b2]"
    for i, (fa, fb) in enumerate(sb.get("frame", [])):
        inputs += ["-loop", "1", "-t", f"{total:.3f}", "-i", "border.png"]
        fades = (f"fade=t=in:st={fa:.3f}:d=0.6:alpha=1," if fa > 0 else "") + \
                (f"fade=t=out:st={fb - 0.6:.3f}:d=0.6:alpha=1" if fb < total else "null")
        graph.append(f"[{n}:v]format=rgba,{fades.rstrip(',')}[fr{i}];{last}[fr{i}]overlay=0:0:shortest=1[o{i}]")
        last = f"[o{i}]"
        n += 1
    graph.append(f"{last}ass=cap.ass:fontsdir=.:shaping=complex,format=yuv420p[vout]")
    inputs += ["-ss", f"{float(sb['start']):.3f}", "-t", f"{total:.3f}", "-i", str(Path(args.music).resolve())]
    fo = float(sb.get("fade_out", 2.0))
    graph.append(f"[{n}:a]aformat=channel_layouts=stereo,afade=t=in:d=0.25,afade=t=out:st={total - fo:.3f}:d={fo:.3f},"
                 f"loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
    out = Path(args.out).resolve()
    print("compositing ...", flush=True)
    ms.run(["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(graph), "-map", "[vout]", "-map", "[aout]",
            "-t", f"{total:.3f}", "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", str(out)],
           cwd=work)
    if not args.work:
        shutil.rmtree(work, ignore_errors=True)
    print(f"done -> {out}")


if __name__ == "__main__":
    main()
