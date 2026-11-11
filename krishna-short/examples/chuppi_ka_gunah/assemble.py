"""Assemble the story film "चुप्पी का गुनाह" (The Sin of Silence), extended cut of about 3 minutes: two narrators, Gauri and Aditya.

  python3 assemble.py <clips_dir> <lines.json> <takes_dir> <picks.json> <music_file> <out_dir>

23 Flow clips in story order (EDIT below), joined with 0.5 s dissolves, and a held, dimmed last frame for the end card.
A shot that carries more speech than its 8 s clip is slowed (frames blended, sound time-stretched) up to 1.5x; a shot
with time to spare is trimmed. Each narration line is its own take (Charon for Aditya, Sulafat for Gauri), trimmed to
its speech, each voice levelled to -16 LUFS, placed on its shot. Hindi subtitles in two colours (Gauri warm rose, Aditya
cream); title over the opening; the poem's last line written by hand (Kalam) over the old paper while Gauri reads it;
end card with the music credit; all drawn with libass. The clips' own sound is kept under the voices; the music (Kevin
MacLeod, CC BY 4.0) sits 22 dB under the voices while they speak, 12 dB under in the pauses, 10 dB under over the end
card. Two-pass loudnorm to -14 LUFS. Writes WhatsApp split points (each part at most 59.8 s, cut inside a pause).
"""
import json, re, subprocess, sys, tempfile
from pathlib import Path
import numpy as np

clips_dir, lines_f, takes_dir, picks_f, music_f, out = map(Path, sys.argv[1:7])
out.mkdir(parents=True, exist_ok=True)
FONTS = str(Path(__file__).resolve().parents[2] / "code_scenes" / "fonts")
SR, XF, HOLD, W, H, PART = 48000, 0.5, 4.0, 1080, 1920, 59.8
L = json.load(open(lines_f, encoding="utf-8"))["takes"]
picks = json.load(open(picks_f))
MUSIC_CREDIT = "संगीत: Sad Trio • Kevin MacLeod (incompetech.com) • CC BY 4.0"
MUSIC_DB = {"under": -22.0, "gap": -12.0, "end": -10.0}      # music loudness relative to the voices (-16 LUFS)

# The cut, in story order. f: Flow clip scene-NN.mp4; lines: spoken over the shot, in order; dur: seconds on screen
# (longer than the clip = slow motion, shorter = trimmed; keep "start" drops the head instead of the tail);
# lead: a line's start relative to its shot's cut (default 0.6 s; negative = it begins over the previous shot);
# grade: look applied in the edit (Flow lit some night and dusk scenes like day).
EDIT = [
    dict(f=1, lines=["L01"]),                                       # old hand on the letter; title
    dict(f=2, lines=["L02", "L03"], dur=9.4),                       # Aditya writes on the rooftop
    dict(f=16, lines=["LA"], dur=9.2),                              # he arrives with a tin trunk, Gauri peeks
    dict(f=3, lines=["L04"], dur=8.2),                              # Gauri's sitar
    dict(f=17, lines=["LB"], grade="dusk"),                         # Ganga aarti
    dict(f=4, lines=["L05"], dur=7.2),                              # monsoon, one umbrella
    dict(f=5, lines=["L06"], dur=5.6, keep="end", grade="lamp"),    # she reads his poems
    dict(f=6, lines=["L07"], dur=5.8, keep="end"),                  # the doctor's proposal
    dict(f=18, lines=["LC"]),                                       # her father's trust
    dict(f=7, lines=["L08"], dur=7.0, grade="night"),               # she goes to his door
    dict(f=8, lines=["L09"], dur=7.4, grade="night"),               # he does not open it
    dict(f=9, lines=["L10"], dur=8.8),                              # the train to Calcutta
    dict(f=10, lines=["L11"], dur=6.8),                             # the wedding fire
    dict(f=19, lines=["LD"], dur=6.8, grade="lampnight"),           # married, she rereads the poem
    dict(f=20, lines=["LE"], dur=7.0, keep="end"),                                       # the letter he never posts
    dict(f=11, lines=["L12"]),                                      # forty years of poems
    dict(f=12, lines=["L13"], dur=5.4),                             # he returns to the ghat
    dict(f=13, lines=["L14"], dur=6.8),                             # she recognises him
    dict(f=21, lines=["LF1", "LF2"], dur=11.85, lead={"LF1": -1.2}), # the poem's last line
    dict(f=22, lines=["LG1", "LG2"], dur=10.3),                      # 'were you happy?'
    dict(f=14, lines=["L15", "L16"], dur=11.85, lead={"L15": -0.2}), # her hand on his
    dict(f=23, lines=["LH"], dur=8.2, lead={"LH": 0.8}),                     # a young couple laughing
    dict(f=15, lines=["L17"]),                                      # sunrise; end card
]
POEM = {"line": "LF1", "start": 2.35, "second": 5.05, "after": 5.9,   # seconds into the line: quote, 'तो मैं…', 'और वहीं…'
        "text": ["गौरी… एक बार कह दो ‘रुको’…", "तो मैं…"], "before_sub": "उस कविता की आख़िरी पंक्ति थी…", "after_sub": "…और वहीं वो अधूरी रह गई।"}
GRADES = {"night": "eq=brightness=-0.11:contrast=1.08:saturation=0.72,colorbalance=bs=0.10:bm=0.05:rm=-0.03,vignette=PI/4",
          "lamp": "eq=brightness=-0.08:contrast=1.06:saturation=0.9,colorbalance=rs=0.06:gs=0.02:bs=-0.07,vignette=PI/4",
          "lampnight": "curves=all='0/0 0.5/0.36 1/0.74',eq=contrast=1.05:saturation=0.85,colorbalance=rs=0.05:bs=0.06:rh=0.04:bh=-0.04,vignette=PI/4",
          "dusk": "eq=brightness=-0.06:contrast=1.06:saturation=0.94,colorbalance=bs=0.06:rh=0.07:gh=0.02:bh=-0.05,vignette=PI/4"}

def run(cmd, **kw): return subprocess.run(cmd, check=True, **kw)
def load(f, sr=SR, ch=1, af=None):
    raw = run(["ffmpeg", "-v", "error", "-i", str(f)] + (["-af", af] if af else []) + ["-ac", str(ch), "-ar", str(sr), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy() if ch > 1 else np.frombuffer(raw, np.float32).copy()
def save(f, y):
    y2 = y if y.ndim == 2 else y[:, None]
    run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", str(y2.shape[1]), "-i", "-", "-c:a", "pcm_s24le", str(f)], input=y2.astype(np.float32).tobytes())
def lufs(y):
    with tempfile.NamedTemporaryFile(suffix=".wav") as tf:
        save(tf.name, y)
        err = subprocess.run(["ffmpeg", "-v", "info", "-nostats", "-i", tf.name, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    v = re.findall(r"I:\s+(-?[\d.]+) LUFS", err)
    return float(v[-1]) if v else -70.0
def vdur(f): return float(run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=duration", "-of", "csv=p=0", str(f)], capture_output=True, text=True).stdout.strip())
db = lambda x: 10 ** (x / 20)
def trim_speech(y):
    hop = SR // 100; e = np.sqrt(np.convolve(y ** 2, np.ones(hop * 2) / (hop * 2), "same"))[::hop]
    on = np.where(e > db(-40) * max(e.max(), 1e-9))[0]
    a = max(0, on[0] * hop - int(0.06 * SR)); b = min(len(y), (on[-1] + 1) * hop + int(0.18 * SR))
    seg = y[a:b].copy(); n = int(0.02 * SR); seg[:n] *= np.linspace(0, 1, n); seg[-n:] *= np.linspace(1, 0, n)
    return seg

# ---- shots: source clip, how much of it, at what speed
N = len(EDIT)
clips = [clips_dir / f"scene-{e['f']:02d}.mp4" for e in EDIT]
for e, c in zip(EDIT, clips):
    src = vdur(c); d = e.get("dur", src)
    e["src"], e["dur"] = src, d
    e["speed"] = min(1.0, src / d)                       # < 1 = slow motion
    e["skip"] = (src - d) if (d < src and e.get("keep") == "end") else 0.0
    if e["speed"] < 1 / 1.5 - 1e-6: raise SystemExit(f"scene-{e['f']:02d}: {d} s is more than 1.5x its clip")
durs = [e["dur"] for e in EDIT]
starts = [0.0]
for d in durs[:-1]: starts.append(starts[-1] + d - XF)
end_video = starts[-1] + durs[-1]
TOTAL = round(end_video + 12.0, 3)          # room while placing lines; set from the last line below

# ---- voices: each line trimmed, each speaker levelled to -16 LUFS
order = [n for e in EDIT for n in e["lines"]]
assert sorted(order) == sorted(L), "every line in lines.json must be placed exactly once"
seg = {n: trim_speech(load(takes_dir / f"{n}_{picks[n]}.wav")) for n in L}
for who in ("M", "F"):
    names = [n for n in L if L[n]["who"] == who]
    g = -16 - lufs(np.concatenate([seg[n] for n in names]))
    for n in names: seg[n] = seg[n] * db(g)
track = np.zeros(int(TOTAL * SR), np.float32)
placed, prev_end, prev_who = {}, 0.0, None
for i, e in enumerate(EDIT):
    for j, n in enumerate(e["lines"]):
        gap = 0.35 if L[n]["who"] == prev_who else 0.55
        t = max(starts[i] + e.get("lead", {}).get(n, 0.6) if j == 0 else 0.0, prev_end + gap)
        i0 = int(t * SR); y = seg[n]
        if i0 + len(y) > len(track): raise SystemExit(f"{n} runs past the end ({t:.2f}+{len(y) / SR:.2f} > {TOTAL})")
        track[i0: i0 + len(y)] += y
        prev_end, prev_who = t + len(y) / SR, L[n]["who"]
        placed[n] = [round(t, 2), round(prev_end, 2)]
last = order[-1]
TOTAL = round(max(end_video + HOLD, prev_end + 3.8), 3)       # the end card holds ~4 s after the last word
track = track[: int(TOTAL * SR)]
save(out / "narration.wav", track)

# ---- the clips' own sound (cut and stretched like the picture, levelled to -24 LUFS, dissolved), under the voices
amb = None
for e, c in zip(EDIT, clips):
    af = f"atrim=start={e['skip']:.3f}:duration={e['dur'] * e['speed']:.3f},asetpts=PTS-STARTPTS" + (f",atempo={e['speed']:.4f}" if e["speed"] < 1 else "")
    n_ = int(e["dur"] * SR)
    a = load(c, SR, 2, af)[:n_]
    a = np.pad(a, ((0, max(0, n_ - len(a))), (0, 0)))
    g = np.clip(-24 - lufs(a), -12, 12) if np.abs(a).max() > 1e-4 else 0
    a = a * db(g)
    if amb is None: amb = a
    else:
        n = int(XF * SR); fo = np.cos(np.linspace(0, np.pi / 2, n))[:, None]; fi = np.sin(np.linspace(0, np.pi / 2, n))[:, None]
        amb = np.concatenate([amb[:-n], amb[-n:] * fo + a[:n] * fi, a[n:]])
amb = np.pad(amb, ((0, max(0, len(track) - len(amb))), (0, 0)))[: len(track)]
hop = SR // 100; env = np.sqrt(np.convolve(track ** 2, np.ones(hop * 3) / (hop * 3), "same"))[::hop]
on = env > db(-42) * max(env.max(), 1e-9); hold = np.zeros_like(on)
for k in np.where(on)[0]: hold[max(0, k - 30): k + 60] = True
tt100 = np.arange(len(hold)) / 100
gdb = np.where(hold, -10.0, -3.0)
k = 25; gdb = np.convolve(np.pad(gdb, (k, k), mode="edge"), np.ones(2 * k + 1) / (2 * k + 1), "valid")
tt = np.arange(len(track)) / SR
gain = db(np.interp(tt, tt100, gdb)) * np.clip((end_video + 2.5 - tt) / 2.5, 0, 1) * np.clip(tt / 0.6, 0, 1)
mix = amb * gain[:, None] + track[:, None]
# ---- music
mus = load(music_f, SR, 2)
mus = np.pad(mus, ((0, max(0, len(track) - len(mus))), (0, 0)))[: len(track)]
Lm = lufs(mus[: int(min(len(mus) / SR, end_video) * SR)])
mdb = np.where(hold, MUSIC_DB["under"], MUSIC_DB["gap"]) + (-16 - Lm)
mdb = np.where(tt100 >= end_video - 0.5, MUSIC_DB["end"] + (-16 - Lm), mdb)
k2 = 50; mdb = np.convolve(np.pad(mdb, (k2, k2), mode="edge"), np.ones(2 * k2 + 1) / (2 * k2 + 1), "valid")
mg = db(np.interp(tt, tt100, mdb)) * np.clip(tt / 1.5, 0, 1) * np.clip((TOTAL - tt) / 3.0, 0, 1) ** 1.3
mix = mix + mus * mg[:, None]
with tempfile.TemporaryDirectory() as td:
    pre = Path(td) / "pre.wav"; save(pre, mix)
    m = subprocess.run(["ffmpeg", "-v", "info", "-nostats", "-i", str(pre), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex("{"): m.rindex("}") + 1])
    ln = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
          f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
    run(["ffmpeg", "-y", "-v", "error", "-i", str(pre), "-af", ln + ",aresample=48000", "-c:a", "pcm_s24le", str(out / "mix.wav")])

# ---- title, subtitles, poem, end card (ASS, drawn by libass). Devanagari needs letter spacing 0.
def ts(x):
    x = max(0.0, x); h = int(x // 3600); m_ = int(x % 3600 // 60); s = x % 60
    return f"{h}:{m_:02d}:{s:05.2f}"
ass = ["[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}", "WrapStyle: 0", "ScaledBorderAndShadow: yes", "",
       "[V4+ Styles]",
       "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
       "Style: SubF,Noto Sans Devanagari,50,&H00C8B8FF,&H00C8B8FF,&H00140A12,&H64000000,0,0,0,0,100,100,0,0,1,3.5,1.5,2,90,90,300,1",
       "Style: SubM,Noto Sans Devanagari,50,&H00E6F4FF,&H00E6F4FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,3.5,1.5,2,90,90,300,1",
       "Style: Title,Rozha One,132,&H004DD3FF,&H004DD3FF,&H00060A3A,&H64000000,0,0,0,0,100,100,0,0,1,7,2,5,40,40,0,1",
       "Style: TSub,Tiro Devanagari Hindi,52,&H00DCF4FF,&H00DCF4FF,&H00060A14,&H64000000,0,0,0,0,100,100,0,0,1,4,1,5,60,60,0,1",
       "Style: Poem,Kalam,72,&H00D2EEFA,&H00D2EEFA,&H00142030,&H8C000000,0,0,0,0,100,100,0,0,1,2.5,3,5,60,60,0,1",
       "Style: Src,Noto Sans Devanagari,27,&H00DCE6F2,&H00DCE6F2,&H70000000,&H00000000,0,0,0,0,100,100,0,0,3,12,0,2,70,70,0,1",
       "Style: Dim,Noto Sans Devanagari,20,&H00000000,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1",
       "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
ev = lambda a, b, style, text, layer=1: ass.append(f"Dialogue: {layer},{ts(a)},{ts(b)},{style},,0,0,0,,{text}")
for idx, n in enumerate(order):
    a, b = placed[n]
    nxt = placed[order[idx + 1]][0] if idx + 1 < len(order) else TOTAL
    st = "SubF" if L[n]["who"] == "F" else "SubM"
    if n == POEM["line"]:            # the quoted line is shown in his handwriting instead of a subtitle
        ev(a - 0.08, a + POEM["start"] - 0.1, st, r"{\fad(150,150)}" + POEM["before_sub"])
        ev(a + POEM["after"], min(b + 0.35, nxt - 0.05), st, r"{\fad(150,150)}" + POEM["after_sub"])
        si = next(i for i, e in enumerate(EDIT) if n in e["lines"]); p_end = starts[si] + durs[si]
        ev(a + POEM["start"], p_end, "Poem", r"{\fad(700,450)\pos(540,560)\frz-3}" + POEM["text"][0])
        ev(a + POEM["second"], p_end, "Poem", r"{\fad(700,450)\pos(600,680)\frz-3}" + POEM["text"][1])
        continue
    ev(a - 0.08, min(b + 0.35, nxt - 0.05), st, r"{\fad(150,150)}" + L[n]["sub"])
t_in = placed[order[0]][1] + 0.2
ev(t_in, starts[1] + 0.3, "Title", r"{\fad(700,500)\pos(540,820)}चुप्पी का गुनाह")
ev(t_in + 0.6, starts[1] + 0.3, "TSub", r"{\fad(700,500)\pos(540,950)}एक अनकही प्रेम कहानी")
ev(end_video - 0.2, TOTAL, "Dim", r"{\fad(900,0)\pos(0,0)\p1\1c&H000000&\1a&H60&}m 0 0 l 1080 0 1080 1920 0 1920{\p0}", layer=0)
card = max(end_video + 0.2, placed[last][1] - 0.6)
ev(card, TOTAL, "Title", r"{\fad(800,0)\pos(540,820)}चुप्पी का गुनाह")
ev(card + 0.7, TOTAL, "TSub", r"{\fad(800,0)\pos(540,950)}जिससे प्यार हो… उससे कह देना।")
ev(card + 1.2, TOTAL, "Src", r"{\fad(600,0)\pos(540,1720)}" + MUSIC_CREDIT)
(out / "film.ass").write_text("\n".join(ass) + "\n", encoding="utf-8")

# ---- picture
fc = []
for i, e in enumerate(EDIT):
    f = f"[{i}:v]trim=start={e['skip']:.3f}:duration={e['dur'] * e['speed']:.3f},setpts=PTS-STARTPTS,"
    if e["speed"] < 1: f += f"setpts=PTS/{e['speed']:.5f},framerate=fps=24:scene=100,"
    f += f"scale={W}:{H}:flags=lanczos,setsar=1,fps=24,format=yuv420p," + (GRADES[e["grade"]] + "," if "grade" in e else "")
    fc.append(f + f"trim=duration={e['dur']:.3f},setpts=PTS-STARTPTS[v{i}]")
cur, acc = "v0", durs[0]
for i in range(1, N):
    fc.append(f"[{cur}][v{i}]xfade=transition=fade:duration={XF}:offset={acc - XF:.3f}[x{i}]"); cur = f"x{i}"; acc += durs[i] - XF
fc.append(f"[{cur}]tpad=stop_mode=clone:stop_duration={TOTAL - end_video + 0.1:.3f},ass={out / 'film.ass'}:fontsdir={FONTS},fade=t=in:st=0:d=0.8,fade=t=out:st={TOTAL - 1.0:.3f}:d=1.0[vout]")
cmd = ["ffmpeg", "-y", "-v", "error"]
for c in clips: cmd += ["-i", str(c)]
cmd += ["-i", str(out / "mix.wav"), "-filter_complex", ";".join(fc), "-map", "[vout]", "-map", f"{N}:a", "-t", f"{TOTAL:.3f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out / "film.mp4")]
if "--no-video" not in sys.argv: run(cmd)

# ---- WhatsApp parts: fewest parts of at most 59.8 s, each cut in the middle of a pause between lines
gaps = [(placed[a_][1] + 0.12, placed[b_][0] - 0.12) for a_, b_ in zip(order, order[1:])]
gaps = [(g0, g1) for g0, g1 in gaps if g1 - g0 >= 0.2]
cands = sorted({round(x, 2) for g0, g1 in gaps for x in np.arange(g0, g1 + 1e-6, 0.1)})
cen = [next(min(x - g0, g1 - x) for g0, g1 in gaps if g0 - 1e-6 <= x <= g1 + 1e-6) for x in cands]
splits = [] if TOTAL <= PART else None
for parts in range(2, 8):                      # dp[j] = (worst distance of a cut from its pause's edge, path), last cut at cands[j]
    if splits is not None: break
    dp = [(cen[j], [j]) if x <= PART else None for j, x in enumerate(cands)]
    for _ in range(parts - 2):
        dp = [max(((min(dp[i][0], cen[j]), dp[i][1] + [j]) for i in range(j) if dp[i] and x - cands[i] <= PART), default=None)
              for j, x in enumerate(cands)]
    fin = [dp[j] for j, x in enumerate(cands) if dp[j] and TOTAL - x <= PART]
    if fin: splits = [cands[j] for j in max(fin)[1]]
json.dump({"splits": splits, "starts": [round(s, 3) for s in starts], "durs": durs, "files": [e["f"] for e in EDIT],
           "lines": placed, "end_video": end_video, "total": TOTAL},
          open(out / "timeline.json", "w"), indent=1, ensure_ascii=False)
print(json.dumps({"splits": splits, "total": TOTAL, "end_video": round(end_video, 2), "last_line_end": placed[last][1]}, ensure_ascii=False))
for i, e in enumerate(EDIT):
    print(f"shot{i + 1:2d} scene-{e['f']:02d} {starts[i]:6.2f}-{starts[i] + durs[i]:6.2f} x{1 / e['speed']:.2f}  " +
          "  ".join(f"{n}[{placed[n][0] - starts[i]:+.1f}..{placed[n][1] - starts[i] - durs[i]:+.1f}]" for n in e["lines"]))
