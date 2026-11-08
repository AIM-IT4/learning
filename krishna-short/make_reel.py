#!/usr/bin/env python3
"""
make_reel.py - beat-synced TRANSITION REEL (Instagram Reels / YouTube Shorts, 1080x1920).

It listens to the music, finds the tempo, the beats and the DROP, then:
  * intro (before the drop): slow shots, one per bar, soft blur/dissolve transitions,
    voice-over captions
  * the drop: white flash + zoom punch + camera shake
  * after the drop: a cut on every 2nd beat, then every beat (configurable), each with a different
    punchy transition (zoom, whip slide, squeeze, circle, radial, pixelize ...), a zoom punch,
    an RGB-split glitch and a whoosh sound effect, plus optional big "beat words"
  * outro: last hit, end-card text
Landscape artwork is placed on a blurred copy of itself so nothing important is cropped.

  python make_reel.py --images reel_images --music song.mp3 --voice voice.wav \
      --voice-lyrics voice_lyrics.txt --words "धर्म,कर्म,सत्य,युद्ध" \
      --end-text "धर्मक्षेत्रे कुरुक्षेत्रे" --out reel.mp4

Images are used in name order (01.jpg, 02.jpg ...), cycling if there are more shots than images.
Name one image drop.jpg and/or outro.jpg to reserve it for the drop / the final shot.
Use music you have the rights to, or post the reel without music and add a song in Instagram.
Needs: ffmpeg (libass), numpy, Pillow.  Shares helpers with make_short.py.
"""
import argparse
import hashlib
import math
import re
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np
from PIL import Image

import make_short as ms

W, H, FPS = ms.W, ms.H, ms.FPS
SR = 44100
INTRO_FX = ["hblur", "dissolve", "fadeslow", "smoothup"]
BEAT_FX = ["zoomin", "slideup", "hlwind", "smoothleft", "squeezev", "circleopen", "coverup",
           "slidedown", "radial", "vuwind", "smoothright", "diagtl", "pixelize", "revealdown",
           "hblur", "slideleft", "diagbr", "circleclose"]


# ----------------------------------------------------------------------------- beat detection
def load_mono(path, sr=22050, start=0.0):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-i", str(path), "-ac", "1",
                          "-ar", str(sr), "-f", "f32le", "-"], stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def detect_beats(x, sr=22050, hop=512, n_fft=2048):
    """Return (bpm, beat_times) using spectral flux + autocorrelation + comb search."""
    frames = 1 + (len(x) - n_fft) // hop
    idx = np.arange(n_fft)[None, :] + hop * np.arange(frames)[:, None]
    mag = np.log1p(100 * np.abs(np.fft.rfft(x[idx] * np.hanning(n_fft), axis=1)))
    flux = np.concatenate([[0], np.maximum(np.diff(mag, axis=0), 0).sum(axis=1)])
    k = max(int(sr / hop * 0.5), 1)
    flux = np.maximum(flux - np.convolve(flux, np.ones(k) / k, mode="same"), 0)
    flux /= flux.max() + 1e-9
    env_rate = sr / hop

    ac = np.correlate(flux, flux, mode="full")[len(flux) - 1:]
    lags = np.arange(1, len(ac))
    bpm = 60 * env_rate / lags
    prior = np.exp(-0.5 * (np.log2(bpm / 110) / 0.8) ** 2) * ((bpm >= 65) & (bpm <= 190))
    lag = lags[np.argmax(ac[1:] * prior)]

    best = (-1, lag, 0)
    for period in np.arange(lag - 1.5, lag + 1.5, 0.02):
        n = int((len(flux) - 1) / period)
        if n < 2:
            continue
        for off in np.arange(0, period, 0.5):
            pos = np.round(off + period * np.arange(n)).astype(int)
            pos = pos[pos < len(flux)]
            s = flux[pos].mean()
            if s > best[0]:
                best = (s, period, off)
    _, period, off = best
    # frame i covers samples [i*hop, i*hop+n_fft): report the window centre, not its start
    times = (off + period * np.arange(int((len(flux) - off) / period) + 1)) / env_rate + n_fft / (2 * sr)
    return 60 * env_rate / period, times[times < len(x) / sr]


def detect_drop(x, beats, sr=22050, window=4):
    """Beat where the BASS gets much louder (risers are mostly treble, so they don't fool it)."""
    if len(beats) < 2 * window + 1:
        return None
    spec = np.fft.rfft(x)
    spec[np.fft.rfftfreq(len(x), 1 / sr) > 160] = 0
    bass = np.fft.irfft(spec, len(x))
    rms = np.array([np.sqrt(np.mean(bass[int(a * sr):int(b * sr)] ** 2) + 1e-12)
                    for a, b in zip(beats[:-1], beats[1:])])
    best, idx = 0, None
    for b in range(window, len(rms) - window):
        ratio = rms[b:b + window].mean() / rms[b - window:b].mean()
        if ratio > best:
            best, idx = ratio, b
    if best < 1.6:
        return None
    # refine: the drop is the single beat with the sharpest bass jump near the best window
    near = [j for j in (idx - 1, idx, idx + 1) if 1 <= j < len(rms)]
    return max(near, key=lambda j: rms[j] / rms[j - 1])


# ----------------------------------------------------------------------------- shot plan
def plan(beats, drop_i, total, intro_every, cut_every, outro, sections=None, extra_drops=()):
    """Return a list of shots: dict(start, end, kind) with kind in intro/drop/beat/outro.

    sections: optional [(start_time, beats_per_cut), ...] after the drop, for full songs whose
    verse / chorus / drop parts need different pacing. extra_drops: times of later drops
    (they get the flash + shake + punch treatment and restart the cut grid)."""
    cuts = []
    if drop_i is not None:
        k = drop_i - intro_every
        while k > 0 and beats[k] > 0.8:
            cuts.append((beats[k], "intro"))
            k -= intro_every
        cuts.reverse()
        cuts.append((beats[drop_i], "drop"))
        first = drop_i
    else:
        first = 0
    outro_at = total - outro if outro > 0 else total
    post = [i for i in range(first, len(beats)) if beats[i] < outro_at - 0.3]
    drop_beats = {int(np.argmin(np.abs(beats - t))) for t in extra_drops}
    if post and sections:
        bounds = sorted(sections) + [(outro_at, None)]
        for (t0, every), (t1, _) in zip(bounds, bounds[1:]):
            idx = [i for i in post if t0 - 0.05 <= beats[i] < t1 - 0.05]
            if not idx:
                continue
            anchor = idx[0]
            for i in idx:
                if i in drop_beats:
                    anchor = i
                if i == first:
                    continue
                if i in drop_beats:
                    cuts.append((beats[i], "drop"))
                elif (i - anchor) % every == 0:
                    cuts.append((beats[i], "beat"))
        cuts.sort()
    elif post:
        parts = np.array_split(np.array(post), len(cut_every))
        start_i = post[0]
        for part, every in zip(parts, cut_every):
            for i in part:
                if (i - start_i) % every == 0 and i != first:
                    cuts.append((beats[i], "beat"))
    if outro > 0:
        j = int(np.argmin(np.abs(beats - outro_at)))
        if beats[j] > (cuts[-1][0] + 0.3 if cuts else 0.3):
            cuts.append((beats[j], "outro"))
    starts = [(0.0, "intro" if drop_i is not None else "beat")] + cuts
    shots = []
    for (s, kind), nxt in zip(starts, starts[1:] + [(total, None)]):
        if nxt[0] - s >= 0.15:
            shots.append({"start": s, "end": nxt[0], "kind": kind})
    return shots


# ----------------------------------------------------------------------------- rendering
def zoom_expr(kind, move, frames, c):
    """zoompan expressions: Ken Burns base + a decaying 'punch' that lands on the cut (frame c)."""
    n = max(frames - 1, 1)
    kb = {"intro": 0.12, "outro": 0.10}.get(kind, 0.06)
    punch = {"drop": 0.40, "beat": 0.20, "outro": 0.28}.get(kind, 0.0)
    tau = {"drop": 0.16, "outro": 0.20}.get(kind, 0.11) * FPS
    base = {"in": f"1+{kb}*on/{n}", "out": f"{1+kb}-{kb}*on/{n}"}.get(move, f"{1+kb/2}")
    z = f"{base}+{punch}*exp(-max(on-{c},0)/{tau:.2f})" if punch else base
    x = "iw/2-iw/zoom/2"
    y = {"up": f"(ih-ih/zoom)*(1-on/{n})", "down": f"(ih-ih/zoom)*on/{n}"}.get(move, "ih/2-ih/zoom/2")
    if kind == "drop":  # camera shake on the drop
        shake = f"38*exp(-max(on-{c},0)/9)"
        x = f"max(0,min(iw-iw/zoom,{x}+{shake}*sin(on*2.3)))"
        y = f"max(0,min(ih-ih/zoom,{y}+{shake}*cos(on*1.7)))"
    return f"zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={W}x{H}:fps={FPS}"


def render_clip(img, frames, kind, move, c, out):
    w, h = Image.open(img).size
    if w / h > 0.75:   # landscape / square art: fit width on a blurred, darkened copy of itself
        fg_w = int(2 * W * 1.12) // 2 * 2
        pre = (f"split[a][b];[a]scale={2*W}:{2*H}:force_original_aspect_ratio=increase,"
               f"crop={2*W}:{2*H},gblur=sigma=45,eq=brightness=-0.16:saturation=0.85[bg];"
               f"[b]scale={fg_w}:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2")
    else:
        pre = f"scale={2*W}:{2*H}:force_original_aspect_ratio=increase,crop={2*W}:{2*H}"
    dim = ",eq=brightness=-0.10,gblur=sigma=2" if kind == "outro" else ""   # keep end-card text readable
    vf = f"{pre},setsar=1,{zoom_expr(kind, move, frames, c)},{ms.GRADE}{dim},format=yuv420p"
    ms.run(["ffmpeg", "-y", "-i", str(img), "-filter_complex", vf, "-frames:v", str(frames),
            "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", str(out)])


# ----------------------------------------------------------------------------- sound effects
def whoosh(length, peak_at, up=True, rng=np.random.default_rng(11)):
    n = int(length * SR)
    t = np.arange(n) / n
    p = peak_at
    amp = np.where(t < p, (t / p) ** 2, np.exp(-(t - p) / (1 - p) * 4))
    sweep = (t / p) if up else (1 - t)
    cut_hi = 500 + 5500 * np.clip(sweep, 0, 1) ** 1.5
    cut_lo = cut_hi * 0.25
    x = rng.standard_normal(n)
    lo = hi = 0.0
    out = np.empty(n)
    for i in range(n):                       # time-varying band-pass (two one-pole low-passes)
        a_hi = 1 - math.exp(-2 * math.pi * cut_hi[i] / SR)
        a_lo = 1 - math.exp(-2 * math.pi * cut_lo[i] / SR)
        hi += a_hi * (x[i] - hi)
        lo += a_lo * (x[i] - lo)
        out[i] = hi - lo
    return out * amp / (np.abs(out).max() + 1e-9)


def make_sfx(path, shots, total, gain):
    mix = np.zeros(int((total + 1) * SR))
    for s in shots[1:]:
        if s["kind"] == "intro":
            snd, lead = whoosh(0.9, 0.7, up=False) * 0.5, 0.63
        else:
            snd, lead = whoosh(0.38, 0.75) * (1.0 if s["kind"] != "beat" else 0.75), 0.285
        a = max(int((s["start"] - lead) * SR), 0)
        mix[a:a + len(snd)] += snd[:len(mix) - a]
    mix *= gain
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())


# ----------------------------------------------------------------------------- captions
def write_captions(path, shots, voice_lines, words, word_every, end_text, end_sub, total, words_until=None,
                   words_from=None):
    hdr = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Glow,Tiro Devanagari Hindi,88,&H00007AFF,&H000000FF,&H00007AFF,&H00000000,-1,0,0,0,100,100,0,0,1,10,0,2,70,70,560,1
Style: Verse,Tiro Devanagari Hindi,88,&H00F2FAFF,&H000000FF,&H00101010,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,2,70,70,560,1
Style: WordGlow,Noto Sans Devanagari,190,&H00007AFF,&H000000FF,&H00007AFF,&H00000000,-1,0,0,0,100,100,0,0,1,14,0,5,40,40,0,1
Style: Word,Noto Sans Devanagari,190,&H00FFFFFF,&H000000FF,&H00202020,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,5,40,40,0,1
Style: End,Tiro Devanagari Hindi,128,&H004AC9FF,&H000000FF,&H00001A40,&H00000000,-1,0,0,0,100,100,0,0,1,5,0,5,60,60,0,1
Style: EndSub,Noto Sans Devanagari,54,&H00F2FAFF,&H000000FF,&H00101010,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    t = ms.ass_time
    for i, (start, text) in enumerate(voice_lines):
        end = min(voice_lines[i + 1][0] if i + 1 < len(voice_lines) else start + 6, total)
        drop = next((s["start"] for s in shots if s["kind"] == "drop"), None)
        outro_t = next((s["start"] for s in shots if s["kind"] == "outro"), None)
        if drop and start < drop:
            end = min(end, drop)
        if outro_t and start < outro_t:          # don't run into the end card
            end = min(end, outro_t)
        txt = ms.ass_escape(text)
        if len(text) > 24 and ", " in txt:
            txt = txt.replace(", ", ",\\N", 1)
        for layer, style, blur in ((0, "Glow", 14), (1, "Verse", 0.6)):
            ev.append(f"Dialogue: {layer},{t(start)},{t(end)},{style},,0,0,0,,{{\\fad(200,150)\\blur{blur}}}{txt}")
    beat_shots = [s for s in shots if s["kind"] in ("drop", "beat")
                  and (words_until is None or s["start"] < words_until)
                  and (words_from is None or s["start"] >= words_from)]
    if words:
        for n, s in enumerate(beat_shots[::word_every]):
            w = ms.ass_escape(words[n % len(words)])
            pop = "\\fscx135\\fscy135\\t(0,140,\\fscx100\\fscy100)"
            end = min(s["end"], s["start"] + 1.2)
            for layer, style, blur in ((2, "WordGlow", 16), (3, "Word", 0.8)):
                ev.append(f"Dialogue: {layer},{t(s['start'])},{t(end)},{style},,0,0,0,,{{\\fad(0,120){pop}\\blur{blur}}}{w}")
    outro = next((s for s in shots if s["kind"] == "outro"), None)
    if outro and end_text:
        a = outro["start"] + 0.15
        ev.append(f"Dialogue: 4,{t(a)},{t(total)},End,,0,0,0,,{{\\fad(250,400)\\blur1\\fscx120\\fscy120"
                  f"\\t(0,300,\\fscx100\\fscy100)}}{ms.ass_escape(end_text)}")
        if end_sub:
            ev.append(f"Dialogue: 4,{t(a + 0.4)},{t(total)},EndSub,,0,0,0,,{{\\fad(300,400)\\pos({W//2},{H//2+130})}}"
                      f"{ms.ass_escape(end_sub)}")
    Path(path).write_text(hdr + "\n".join(ev) + "\n", encoding="utf-8")


# ----------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--images", required=True)
    ap.add_argument("--music", required=True, help="song / beat to cut to (also used for beat detection)")
    ap.add_argument("--music-start", type=float, default=0.0, help="start this many seconds into the song")
    ap.add_argument("--duration", type=float, help="reel length (default: rest of the song, max 90s)")
    ap.add_argument("--no-music-in-output", action="store_true",
                    help="cut to the music but leave it out of the file (add the song inside Instagram)")
    ap.add_argument("--voice", help="voice-over wav (e.g. from make_voiceover.py), starts at 0s")
    ap.add_argument("--voice-lyrics", help="timed captions for the voice (make_voiceover.py output)")
    ap.add_argument("--bpm", type=float, help="override detected tempo")
    ap.add_argument("--drop", type=float, help="override detected drop time (seconds into the reel)")
    ap.add_argument("--intro-every", type=int, default=4, help="beats per shot before the drop")
    ap.add_argument("--intro-fx", default=",".join(INTRO_FX),
                    help="transitions used before the drop (comma list of ffmpeg xfade names, or 'beat')")
    ap.add_argument("--no-hits", action="store_true", help="no flash/blur/RGB-split on beat cuts")
    ap.add_argument("--cut-every", default="2,1",
                    help="beats per cut after the drop, per section, e.g. '2,1' = every 2 beats then every beat")
    ap.add_argument("--outro", type=float, default=3.0, help="seconds held on the last shot")
    ap.add_argument("--sections", help="full songs: 'time:beats_per_cut,...' after the drop, e.g. '28:2,74:1,95:2'")
    ap.add_argument("--extra-drops", default="", help="comma list of later drop times (flash + shake)")
    ap.add_argument("--words", default="", help="comma-separated big words flashed on beat cuts")
    ap.add_argument("--word-every", type=int, default=2)
    ap.add_argument("--words-until", type=float, help="only flash words on cuts before this time (e.g. first sung line)")
    ap.add_argument("--words-from", type=float, help="only flash words on cuts from this time on")
    ap.add_argument("--end-text", default="")
    ap.add_argument("--end-sub", default="")
    ap.add_argument("--sfx-volume", type=float, default=0.5)
    ap.add_argument("--duck", type=float, default=3.0,
                    help="how hard the music dips under the voice (compressor ratio; 1 = no dip)")
    ap.add_argument("--no-embers", action="store_true")
    ap.add_argument("--parallax", action="store_true",
                    help="3D camera moves on portrait images using an AI depth map (needs torch + transformers)")
    ap.add_argument("--out", default="reel.mp4")
    ap.add_argument("--work", help="keep rendered clips here and reuse them on the next run")
    args = ap.parse_args()

    images = sorted(p for p in Path(args.images).iterdir() if p.suffix.lower() in ms.IMAGE_EXTS)
    special = {p.stem.lower(): p for p in images
               if p.stem.lower() == "outro" or re.fullmatch(r"drop\d*", p.stem.lower())}
    images = [p for p in images if p.stem.lower() not in special] or list(special.values())
    if not images:
        raise SystemExit(f"no images in {args.images}")
    total = args.duration or min(ms.media_duration(args.music) - args.music_start, 90.0)

    # ---- analyse music
    x = load_mono(args.music, start=args.music_start)[: int(total * 22050)]
    bpm, beats = detect_beats(x)
    if args.bpm:
        period = 60 / args.bpm
        phase = beats[0] % period if len(beats) else 0
        bpm, beats = args.bpm, np.arange(phase, total, period)
    if args.drop is not None:
        drop_i = int(np.argmin(np.abs(beats - args.drop)))
    else:
        drop_i = detect_drop(x, beats)
    cut_every = [max(int(v), 1) for v in args.cut_every.split(",")]
    sections = [(float(a), max(int(b), 1)) for a, b in (x.split(":") for x in args.sections.split(","))] \
        if args.sections else None
    extra_drops = [float(t) for t in args.extra_drops.split(",") if t.strip()]
    shots = plan(beats, drop_i, total, args.intro_every, cut_every, args.outro, sections, extra_drops)
    drop_t = beats[drop_i] if drop_i is not None else None
    print(f"tempo {bpm:.1f} BPM, {len(beats)} beats, drop at "
          f"{'none' if drop_t is None else f'{drop_t:.2f}s'}, {len(shots)} shots")

    # ---- transitions (frame-exact windows so every xfade lands centred on its beat)
    S = [round(s["start"] * FPS) for s in shots] + [round(total * FPS)]
    T = [0]
    for k in range(1, len(shots)):
        kind = shots[k]["kind"]
        want = {"intro": 0.55, "drop": 0.26, "outro": 0.30}.get(kind, 0.22)
        room = min(S[k] - S[k - 1], S[k + 1] - S[k]) * 0.45 / FPS
        T.append(max(2, int(min(want, room) * FPS) // 2 * 2))
    T.append(0)
    fx_names = []
    bi = ii = 0
    for k in range(1, len(shots)):
        kind = shots[k]["kind"]
        if kind in ("drop", "outro"):
            fx_names.append("fadewhite")
        elif kind == "intro":
            ifx = BEAT_FX if args.intro_fx == "beat" else args.intro_fx.split(",")
            fx_names.append(ifx[ii % len(ifx)]); ii += 1
        else:
            fx_names.append(BEAT_FX[bi % len(BEAT_FX)]); bi += 1

    ms.ensure_fonts()
    work = Path(args.work) if args.work else Path(tempfile.mkdtemp(prefix="reel_"))
    work.mkdir(parents=True, exist_ok=True)
    cache = work / "clips"
    cache.mkdir(exist_ok=True)
    moves = ["in", "out", "up", "down"]
    next_img = n_drop = 0
    for k, s in enumerate(shots):
        a = S[k] - T[k] // 2
        b = S[k + 1] + T[k + 1] // 2
        s.update(a=a, b=b)
        if s["kind"] == "drop" and special.get(f"drop{n_drop + 1}" if n_drop else "drop"):
            img = special[f"drop{n_drop + 1}" if n_drop else "drop"]   # drop.jpg, drop2.jpg, ...
            n_drop += 1
        elif s["kind"] == "drop" and "drop" in special:
            img = special["drop"]
            n_drop += 1
        elif s["kind"] == "outro" and "outro" in special:
            img = special["outro"]
        else:
            img = images[next_img % len(images)]
            next_img += 1
        print(f"shot {k+1:2d}/{len(shots)} {s['kind']:5s} {S[k]/FPS:6.2f}s  "
              f"{(fx_names[k-1] if k else '-'):11s} {img.name}")
        w_img, h_img = Image.open(img).size
        use_par = args.parallax and w_img / h_img <= 0.75
        key = hashlib.sha1(f"{Path(img).resolve()}|{Path(img).stat().st_mtime}|{b - a}|{s['kind']}|"
                           f"{moves[k % 4]}|{T[k] // 2}|{use_par}".encode()).hexdigest()[:16]
        cached = cache / f"{key}.mp4"
        if not cached.exists():               # --work keeps clips, so caption/audio changes re-render fast
            if use_par:
                import parallax
                parallax.render(img, b - a, s["kind"], moves[k % 4], T[k] // 2, cached, W, H, FPS, ms.GRADE)
            else:
                render_clip(img, b - a, s["kind"], moves[k % 4], T[k] // 2, cached)
        shutil.copy(cached, work / f"c{k:03d}.mp4")

    # ---- video graph: xfade chain -> embers -> glitch on beat cuts -> captions
    inputs, graph = [], []
    for k in range(len(shots)):
        inputs += ["-i", f"c{k:03d}.mp4"]
    last = "[0:v]"
    for k in range(1, len(shots)):
        graph.append(f"{last}[{k}:v]xfade=transition={fx_names[k-1]}:duration={T[k]/FPS:.4f}:"
                     f"offset={shots[k]['a']/FPS:.4f}[x{k}]")
        last = f"[x{k}]"
    n_in = len(shots)
    if not args.no_embers:
        ms.make_embers(work / "embers.mp4")
        inputs += ["-stream_loop", "-1", "-i", "embers.mp4"]
        graph.append(f"{last}format=gbrp[bs];[{n_in}:v]scale={W}:{H},format=gbrp[em];"
                     f"[bs][em]blend=all_mode=screen:shortest=1,format=yuv420p[lit]")
        last = "[lit]"
        n_in += 1
    hits = [s["start"] for s in shots if s["kind"] in ("drop", "beat", "outro")]
    if hits and not args.no_hits:
        # impact on every beat cut: RGB split + a 2-frame motion blur + a short exposure flash
        en = "+".join(f"between(t,{h-0.04:.3f},{h+0.09:.3f})" for h in hits)
        blur = "+".join(f"between(t,{h-0.03:.3f},{h+0.04:.3f})" for h in hits)
        flash = "+".join(f"between(t,{h:.3f},{h+0.06:.3f})" for h in hits)
        graph.append(f"{last}rgbashift=rh=-16:bh=16:gv=6:enable='{en}',"
                     f"gblur=sigma=7:steps=2:enable='{blur}',"
                     f"eq=brightness=0.13:contrast=1.08:enable='{flash}'[gl]")
        last = "[gl]"

    voice_lines = ms.parse_lyrics(args.voice_lyrics) if args.voice_lyrics else []
    words = [w.strip() for w in args.words.split(",") if w.strip()]
    write_captions(work / "cap.ass", shots, voice_lines, words, args.word_every,
                   args.end_text, args.end_sub, total, args.words_until, args.words_from)
    for f in ms.FONT_DIR.glob("*.ttf"):
        shutil.copy(f, work / f.name)
    graph.append(f"{last}ass=cap.ass:fontsdir=.:shaping=complex[vout]")

    # ---- audio: music (ducked under voice) + voice + whooshes
    make_sfx(work / "sfx.wav", shots, total, args.sfx_volume)
    fade = f"afade=t=out:st={max(total - 1.2, 0):.2f}:d=1.2"
    a_parts = []
    inputs += ["-i", "sfx.wav"]
    sfx_i = n_in
    n_in += 1
    if not args.no_music_in_output:
        inputs += ["-ss", str(args.music_start), "-i", str(Path(args.music).resolve())]
        mus_i = n_in
        n_in += 1
    if args.voice:
        inputs += ["-i", str(Path(args.voice).resolve())]
        voc_i = n_in
        n_in += 1
        graph.append(f"[{voc_i}:a]aformat=channel_layouts=stereo,asplit=2[vk][vo]")
        if not args.no_music_in_output:
            graph.append(f"[{mus_i}:a]aformat=channel_layouts=stereo[mu];"
                         f"[mu][vk]sidechaincompress=threshold=0.05:ratio={args.duck}:attack=20:release=400[md]")
            a_parts.append("[md]")
        else:
            graph.append("[vk]anullsink")
        a_parts.append("[vo]")
    elif not args.no_music_in_output:
        a_parts.append(f"[{mus_i}:a]")
    graph.append(f"[{sfx_i}:a]aformat=channel_layouts=stereo[sf]")
    a_parts.append("[sf]")
    graph.append(f"{''.join(a_parts)}amix=inputs={len(a_parts)}:duration=longest:normalize=0,"
                 f"alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=11,{fade}[aout]")   # Instagram plays ~-14 LUFS

    out = Path(args.out).resolve()
    print("compositing ...")
    ms.run(["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(graph), "-map", "[vout]", "-map", "[aout]",
            "-t", f"{total:.3f}", "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "19",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)],
           cwd=work)
    cover_t = (drop_t + 0.5) if drop_t is not None else total / 2
    ms.run(["ffmpeg", "-y", "-ss", f"{min(cover_t, total - 0.1):.2f}", "-i", str(out), "-frames:v", "1",
            "-q:v", "2", str(out.with_suffix(".cover.jpg"))])
    if not args.work:
        shutil.rmtree(work, ignore_errors=True)
    print(f"done -> {out}\ncover -> {out.with_suffix('.cover.jpg')}")


if __name__ == "__main__":
    main()
