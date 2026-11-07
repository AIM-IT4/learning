#!/usr/bin/env python3
"""
make_short.py - build a 9:16 (1080x1920) devotional / epic-poem Short with ffmpeg.

The look (inspired by the "Krishna Ki Chetavani" style of edits):
  * one image per lyric line, hard cut on the line change, with a quick white "impact" flash
  * slow Ken Burns motion on every image (zoom in / zoom out / pan up / pan down, alternating)
  * warm, high-contrast grade with a dark vignette (deep blues + fire oranges)
  * rising fire embers layered over everything (screen blend)
  * Hindi (Devanagari) verse captions with an orange glow, synced to your lyric timings
  * optional title card, optional background music that ducks under the voice

Inputs you provide (use only material you have the rights to):
  --images  folder of images (jpg/png/webp), used in name order, cycling if there are fewer than lines
  --audio   main audio track (your own recitation / song)
  --lyrics  text file, one line per caption:   0:04.5 | हरि ने भीषण हुंकार किया
  --music   (optional) background music, mixed under --audio and ducked when the voice plays

Example:
  python make_short.py --images imgs --audio voice.mp3 --lyrics lyrics.txt \
      --title "कृष्ण की चेतावनी" --duration 60 --out short.mp4

Needs: ffmpeg (with libass) on PATH, Python 3.8+, numpy and Pillow (for the ember layer).
"""
import argparse
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

W, H, FPS = 1080, 1920, 30
HERE = Path(__file__).resolve().parent
FONT_DIR = HERE / "fonts"
FONTS = {
    # Google Fonts family -> css2 query. Downloaded once into ./fonts (SIL Open Font License).
    "Tiro Devanagari Hindi": "Tiro+Devanagari+Hindi",
    "Noto Sans Devanagari": "Noto+Sans+Devanagari:wght@800",
}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


# ----------------------------------------------------------------------------- helpers
def run(cmd, cwd=None, quiet=True):
    proc = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr[-4000:])
        raise SystemExit(f"command failed: {' '.join(map(str, cmd[:6]))} ...")
    if not quiet:
        sys.stderr.write(proc.stderr)
    return proc.stdout


def media_duration(path):
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "default=nw=1:nk=1", str(path)])
    return float(out.strip())


def ensure_fonts():
    FONT_DIR.mkdir(exist_ok=True)
    if any(FONT_DIR.glob("*.ttf")):
        return
    print("downloading Devanagari fonts from Google Fonts ...")
    for family, query in FONTS.items():
        css = urllib.request.urlopen(f"https://fonts.googleapis.com/css2?family={query}").read().decode()
        for i, url in enumerate(sorted(set(re.findall(r"url\((https://[^)]+\.ttf)\)", css)))):
            dest = FONT_DIR / f"{family.replace(' ', '')}-{i}.ttf"
            urllib.request.urlretrieve(url, dest)


def parse_time(s):
    parts = [float(p) for p in s.strip().split(":")]
    sec = 0.0
    for p in parts:
        sec = sec * 60 + p
    return sec


def parse_lyrics(path):
    lines = []
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        raw = raw.strip()
        if not raw or raw.startswith("#"):
            continue
        if "|" not in raw:
            raise SystemExit(f"lyrics line needs 'time | text': {raw!r}")
        t, text = raw.split("|", 1)
        lines.append((parse_time(t), text.strip()))
    lines.sort(key=lambda x: x[0])
    return lines


def ass_time(t):
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def ass_escape(text):
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")")


# ----------------------------------------------------------------------------- captions
def write_ass(path, lyrics, total, title):
    # Colours are &HAABBGGRR.  Gold = #FFC94A, fire orange = #FF7A00.
    # Keep Spacing at 0: libass letter-spacing splits Devanagari clusters (matras turn into dotted circles).
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Glow,Tiro Devanagari Hindi,86,&H00007AFF,&H000000FF,&H00007AFF,&H00000000,-1,0,0,0,100,100,0,0,1,10,0,2,70,70,560,1
Style: Verse,Tiro Devanagari Hindi,86,&H00F2FAFF,&H000000FF,&H00101010,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,2,70,70,560,1
Style: Title,Noto Sans Devanagari,104,&H004AC9FF,&H000000FF,&H00001A40,&H00000000,-1,0,0,0,100,100,0,0,1,5,0,8,60,60,230,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    if title:
        end = min(3.5, total)
        events.append(f"Dialogue: 2,{ass_time(0)},{ass_time(end)},Title,,0,0,0,,"
                      f"{{\\fad(400,500)\\blur1\\t(0,600,\\fscx108\\fscy108)}}{ass_escape(title)}")
    for i, (start, text) in enumerate(lyrics):
        if start >= total:
            break
        end = lyrics[i + 1][0] if i + 1 < len(lyrics) else total
        end = min(end, total)
        if end - start < 0.2 or not text:
            continue
        s, e = ass_time(start), ass_time(end)
        pop = "\\fscx92\\fscy92\\t(0,220,\\fscx100\\fscy100)"
        events.append(f"Dialogue: 0,{s},{e},Glow,,0,0,0,,{{\\fad(120,160){pop}\\blur14}}{ass_escape(text)}")
        events.append(f"Dialogue: 1,{s},{e},Verse,,0,0,0,,{{\\fad(120,160){pop}\\blur0.6}}{ass_escape(text)}")
    Path(path).write_text(header + "\n".join(events) + "\n", encoding="utf-8")


# ----------------------------------------------------------------------------- embers
def make_embers(path, seconds=10, w=540, h=960, count=140, seed=7):
    """Seamlessly looping layer of rising fire embers on black (for a screen blend)."""
    import numpy as np
    from PIL import Image, ImageFilter

    rng = np.random.default_rng(seed)
    n_frames = int(seconds * FPS)
    x0 = rng.uniform(0, w, count)
    y0 = rng.uniform(0, h, count)
    laps = rng.choice([1, 1, 2, 2, 3], count)            # integer laps per loop -> seamless
    sway_amp = rng.uniform(4, 22, count)
    sway_k = rng.integers(1, 4, count)
    sway_ph = rng.uniform(0, 2 * math.pi, count)
    flick_k = rng.integers(3, 9, count)
    flick_ph = rng.uniform(0, 2 * math.pi, count)
    size = rng.choice([1, 1, 2, 2, 3], count)
    base = rng.uniform(0.45, 1.0, count)
    col = np.array([[255, 150, 40], [255, 110, 20], [255, 200, 90]], dtype=np.float32)
    colour = col[rng.integers(0, 3, count)]

    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{w}x{h}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast",
         "-crf", "20", "-pix_fmt", "yuv420p", str(path)],
        stdin=subprocess.PIPE)
    for f in range(n_frames):
        p = f / n_frames
        ys = (y0 - laps * h * p) % h
        xs = (x0 + sway_amp * np.sin(2 * math.pi * sway_k * p + sway_ph)) % w
        bright = base * (0.55 + 0.45 * np.sin(2 * math.pi * flick_k * p + flick_ph)) ** 2
        bright *= np.clip(ys / (0.35 * h), 0, 1)           # fade out near the top
        frame = np.zeros((h, w, 3), dtype=np.float32)
        for x, y, s, b, c in zip(xs.astype(int), ys.astype(int), size, bright, colour):
            frame[max(y - s, 0):y + s + 1, max(x - s, 0):x + s + 1] += c * b
        img = Image.fromarray(np.clip(frame, 0, 255).astype(np.uint8))
        glow = img.filter(ImageFilter.GaussianBlur(4))
        out = np.clip(np.asarray(img, dtype=np.float32) + 1.6 * np.asarray(glow, dtype=np.float32), 0, 255)
        ff.stdin.write(out.astype(np.uint8).tobytes())
    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit("ember render failed")


# ----------------------------------------------------------------------------- shots
MOVES = ["in", "out", "up", "down"]


def zoompan_expr(move, frames):
    n = max(frames - 1, 1)
    if move == "in":
        z, x, y = f"1+0.14*on/{n}", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    elif move == "out":
        z, x, y = f"1.14-0.14*on/{n}", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    elif move == "up":
        z, x, y = "1.12", "iw/2-(iw/zoom/2)", f"(ih-ih/zoom)*(1-on/{n})"
    else:
        z, x, y = "1.12", "iw/2-(iw/zoom/2)", f"(ih-ih/zoom)*on/{n}"
    return f"zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={W}x{H}:fps={FPS}"


def render_shot(img, frames, move, flash, out):
    grade = ("eq=contrast=1.12:saturation=1.25:brightness=-0.03,"
             "colorbalance=rs=0.06:bs=0.06:rm=0.05:bm=-0.04:rh=0.04:bh=-0.06,"
             "vignette=angle=PI/4.2")
    vf = (f"scale={2*W}:{2*H}:force_original_aspect_ratio=increase,crop={2*W}:{2*H},setsar=1,"
          f"{zoompan_expr(move, frames)},{grade}")
    if flash:
        vf += ",fade=t=in:st=0:d=0.13:color=white"
    vf += ",format=yuv420p"
    run(["ffmpeg", "-y", "-i", str(img), "-vf", vf, "-frames:v", str(frames), "-r", str(FPS),
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", str(out)])


# ----------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--images", required=True, help="folder of images")
    ap.add_argument("--audio", required=True, help="main audio (your voice / song)")
    ap.add_argument("--lyrics", required=True, help="'m:ss.s | text' per line")
    ap.add_argument("--music", help="optional background music, ducked under --audio")
    ap.add_argument("--music-volume", type=float, default=0.35)
    ap.add_argument("--audio-start", type=float, default=0.0,
                    help="seconds to skip in --audio/--music (lyric times are relative to this)")
    ap.add_argument("--duration", type=float, help="length in seconds (default: audio length, max 180)")
    ap.add_argument("--title", default="", help="title card text for the first 3.5s")
    ap.add_argument("--no-embers", action="store_true")
    ap.add_argument("--no-flash", action="store_true")
    ap.add_argument("--out", default="short.mp4")
    args = ap.parse_args()

    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            raise SystemExit(f"{tool} not found on PATH")

    images = sorted(p for p in Path(args.images).iterdir() if p.suffix.lower() in IMAGE_EXTS)
    if not images:
        raise SystemExit(f"no images found in {args.images}")
    lyrics = parse_lyrics(args.lyrics)

    total = args.duration or min(media_duration(args.audio) - args.audio_start, 180.0)
    if total <= 0:
        raise SystemExit("duration is zero - check --audio-start / --duration")

    ensure_fonts()
    work = Path(tempfile.mkdtemp(prefix="short_"))
    print(f"working in {work}")

    # Shot boundaries = every lyric start (plus 0 and the end), converted to whole frames.
    cuts = sorted({0.0, *[t for t, _ in lyrics if 0 < t < total]})
    bounds = [round(t * FPS) for t in cuts] + [round(total * FPS)]
    shots = [(bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1) if bounds[i + 1] > bounds[i]]

    concat = []
    for i, (a, b) in enumerate(shots):
        clip = work / f"shot_{i:03d}.mp4"
        print(f"shot {i+1}/{len(shots)}  {a/FPS:6.2f}s -> {b/FPS:6.2f}s  {images[i % len(images)].name}")
        render_shot(images[i % len(images)], b - a, MOVES[i % len(MOVES)],
                    flash=(i > 0 and not args.no_flash), out=clip)
        concat.append(f"file '{clip.name}'")
    (work / "list.txt").write_text("\n".join(concat) + "\n")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "base.mp4"], cwd=work)

    write_ass(work / "captions.ass", lyrics, total, args.title)
    for f in FONT_DIR.glob("*.ttf"):
        shutil.copy(f, work / f.name)

    # ---- final composite
    inputs = ["-i", "base.mp4"]
    vchain = "[0:v]format=gbrp[base];"
    vin = "[base]"
    if not args.no_embers:
        print("rendering ember layer ...")
        make_embers(work / "embers.mp4")
        inputs += ["-stream_loop", "-1", "-i", "embers.mp4"]
        vchain += (f"[1:v]scale={W}:{H},format=gbrp[emb];"
                   f"[base][emb]blend=all_mode=screen:shortest=1[lit];")
        vin = "[lit]"
    vchain += f"{vin}format=yuv420p,ass=captions.ass:fontsdir=.:shaping=complex[vout]"  # complex = HarfBuzz (Hindi matras)

    a_idx = 2 if not args.no_embers else 1
    inputs += ["-ss", str(args.audio_start), "-i", str(Path(args.audio).resolve())]
    fade = f"afade=t=in:d=0.3,afade=t=out:st={max(total - 1.5, 0):.2f}:d=1.5"
    if args.music:
        inputs += ["-ss", str(args.audio_start), "-i", str(Path(args.music).resolve())]
        achain = (f"[{a_idx}:a]asplit=2[v1][v2];"
                  f"[{a_idx+1}:a]volume={args.music_volume}[m];"
                  f"[m][v1]sidechaincompress=threshold=0.04:ratio=6:attack=15:release=350[duck];"
                  f"[v2][duck]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95,{fade}[aout]")
    else:
        achain = f"[{a_idx}:a]alimiter=limit=0.95,{fade}[aout]"

    out = Path(args.out).resolve()
    print("compositing final video ...")
    run(["ffmpeg", "-y", *inputs, "-filter_complex", vchain + ";" + achain,
         "-map", "[vout]", "-map", "[aout]", "-t", f"{total:.3f}",
         "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)], cwd=work)
    shutil.rmtree(work, ignore_errors=True)
    print(f"done -> {out}")


if __name__ == "__main__":
    main()
