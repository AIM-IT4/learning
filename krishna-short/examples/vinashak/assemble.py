"""Assemble the documentary "अपने ही विनाशक" (Destroyers of Ourselves).

  python3 assemble.py <clips_dir> <lines.json> <takes_dir> <picks.json> <out_dir> [music_file]

15 Flow clips joined with 0.5 s dissolves and a held, dimmed last frame for the end card; Charon narration cut
line by line out of the chosen takes (letter-level alignment against faster-whisper word times) and placed on
its shot; Hindi subtitles, sourced fact labels, title and end card drawn with libass; the clips' own sound kept
well under the voice; optional background music (credited on the end card) far below the voice, a little higher in
the pauses and over the end card; two-pass loudnorm to -14 LUFS. Writes film.mp4, narration.wav, mix.wav, film.ass, timeline.json.
"""
import json, re, subprocess, sys, tempfile
from difflib import SequenceMatcher
from pathlib import Path
import numpy as np

clips_dir, lines_f, takes_dir, picks_f, out = map(Path, sys.argv[1:6])
MUSIC = Path(sys.argv[6]) if len(sys.argv) > 6 else None
MUSIC_CREDIT = "संगीत: Gymnopédie No. 1 (Erik Satie) • Kevin MacLeod (incompetech.com) • CC BY 4.0"
MUSIC_DB = {"under": -22.0, "gap": -12.0, "end": -10.0}    # music loudness relative to the narration (-16 LUFS)
out.mkdir(parents=True, exist_ok=True)
FONTS = str(Path(__file__).resolve().parents[2] / "code_scenes" / "fonts")
SR, XF, HOLD, W, H = 48000, 0.5, 4.5, 1080, 1920
L = json.load(open(lines_f, encoding="utf-8"))
picks = json.load(open(picks_f))

# narration lines: take, anchor (start of the line in the spoken text), subtitle text with digits
LINES = [
 ("N1", "पूरे ब्रह्मांड", "पूरे ब्रह्मांड में… अब तक हमें एक ही घर मिला है — यह धरती।"),
 ("N1", "और इस घर", "और इस घर में एक ही प्राणी है… जिसने आग जलाना सीखा…"),
 ("N1", "और फिर", "और फिर, उसी आग से अपना ही घर जलाना।"),
 ("N2", "हर साल", "हर साल, करीब एक करोड़ हेक्टेयर जंगल कट जाते हैं।"),
 ("N2", "जिस समंदर", "जिस समंदर से जीवन शुरू हुआ… वह आज प्लास्टिक से भर रहा है।"),
 ("N2", "और वही", "और वही प्लास्टिक… अब इंसान के ख़ून तक पहुँच चुका है।"),
 ("N3", "ज़हरीली", "ज़हरीली हवा… हर साल करीब 67 लाख लोगों की जान ले लेती है।"),
 ("N3", "धरती तप", "धरती तप रही है… 2015 से 2024… इतिहास के दस सबसे गर्म साल।"),
 ("N3", "कहीं आग", "कहीं आग… कहीं बाढ़…"),
 ("N3", "उन्नीस सौ", "1970 से अब तक, वन्यजीवों की आबादी औसतन 73% घट गई है।"),
 ("N4", "और जो पैसा", "और जो पैसा इस धरती को बचा सकता था… उससे हम हथियार बनाते हैं — सिर्फ़ 2024 में, करीब 2.7 ट्रिलियन डॉलर।"),
 ("N4", "बारह हज़ार", "बारह हज़ार से ज़्यादा परमाणु हथियार… और हम इसे \"सुरक्षा\" कहते हैं।"),
 ("N4", "सबसे बड़ा", "सबसे बड़ा ख़तरा बाहर नहीं… हमारे भीतर है — लालच… और बेपरवाही।"),
 ("N5", "पर जिन", "पर जिन हाथों ने यह सब बिगाड़ा… वही हाथ इसे सँवार भी सकते हैं।"),
 ("N5", "विनाशक भी", "विनाशक भी हम हैं… और रक्षक भी हम। फ़ैसला… हमारा है।"),
]
# fact labels per shot (index): headline, source
FACTS = {
 3: ("हर साल ~1 करोड़ हेक्टेयर जंगल कटते हैं", "स्रोत: FAO, Global Forest Resources Assessment 2020 (2015–2020 औसत)"),
 5: ("माइक्रोप्लास्टिक इंसानी ख़ून में मिला", "स्रोत: Leslie et al., Environment International, 2022"),
 6: ("वायु प्रदूषण: ~67 लाख असमय मौतें हर साल", "स्रोत: WHO"),
 7: ("2015–2024: रिकॉर्ड के 10 सबसे गर्म साल", "स्रोत: WMO"),
 9: ("वन्यजीव आबादी औसतन −73% (1970–2020)", "स्रोत: WWF Living Planet Report 2024"),
 10: ("2024 में दुनिया का सैन्य खर्च: $2.72 ट्रिलियन", "स्रोत: SIPRI, अप्रैल 2025"),
 11: ("परमाणु हथियार: ~12,241 (जनवरी 2025)", "स्रोत: SIPRI Yearbook 2025"),
}

def run(cmd, **kw): return subprocess.run(cmd, check=True, **kw)
def load(f, sr=SR, ch=1):
    raw = run(["ffmpeg", "-v", "error", "-i", str(f), "-ac", str(ch), "-ar", str(sr), "-f", "f32le", "-"], capture_output=True).stdout
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
def n2(s): return re.sub(r"[^\u0900-\u097F]", "", s.replace("़", "").replace("ँ", "ं").replace("ॉ", "ो")).replace("।", "")

# ---- shots
clips = [clips_dir / f"scene-{i:02d}.mp4" for i in range(1, 16)]
durs = [vdur(c) for c in clips]
starts = [0.0]
for d in durs[:-1]: starts.append(starts[-1] + d - XF)
end_video = starts[-1] + durs[-1]
TOTAL = round(end_video + HOLD, 3)

# ---- narration: align each take, cut its lines
from faster_whisper import WhisperModel
model = WhisperModel("mobiuslabsgmbh/faster-whisper-large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=4)
cuts = {}
for take in ["N1", "N2", "N3", "N4", "N5"]:
    f = takes_dir / f"{take}_{picks[take]}.wav"
    y = load(f); y16 = load(f, 16000)
    sg, _ = model.transcribe(y16, language="hi", word_timestamps=True, beam_size=5)
    ws = [(w.word.strip(), w.start, w.end) for s_ in sg for w in s_.words]
    asr, times = "", []
    for w, a, b in ws: c = n2(w); asr += c; times += [(a, b)] * len(c)
    scr = n2(L["takes"][take]["text"]); mp = {}
    for blk in SequenceMatcher(None, scr, asr, autojunk=False).get_matching_blocks():
        for k in range(blk.size): mp[blk.a + k] = blk.b + k
    def at(ci, end=False):
        keys = [k for k in mp if (k < ci if end else k >= ci)]
        return times[mp[max(keys) if end else min(keys)]][1 if end else 0] if keys else None
    mine = [(i, anc) for i, (tk, anc, _) in enumerate(LINES) if tk == take]
    pos, last = [], 0
    for i, anc in mine:
        p = scr.find(n2(anc), last); assert p >= 0, (take, anc); pos.append(p); last = p + 1
    pos.append(len(scr))
    for j, (i, anc) in enumerate(mine):
        a, b = at(pos[j]), at(pos[j + 1], end=True)
        nxt = at(pos[j + 1]) if j + 1 < len(mine) else None
        a0 = max(0.0, a - 0.06)
        b1 = min(b + 0.18, (nxt - 0.04) if nxt else len(y) / SR)
        seg = y[int(a0 * SR): int(b1 * SR)].copy()
        fade = int(0.02 * SR); seg[:fade] *= np.linspace(0, 1, fade); seg[-fade:] *= np.linspace(1, 0, fade)
        cuts[i] = seg
# ---- place lines on the shots
track = np.zeros(int(TOTAL * SR), np.float32)
placed, prev_end = [], 0.0
OFFSET = {7: -0.25}                     # line 8 opens just before its cut (J-cut), leaving a pause near 60 s for the WhatsApp split
for i in range(15):
    t = max(starts[i] + OFFSET.get(i, 0.6), prev_end + 0.4)
    seg = cuts[i]; i0 = int(t * SR)
    if i0 + len(seg) > len(track): raise SystemExit(f"line {i + 1} runs past the end ({t:.2f}+{len(seg) / SR:.2f} > {TOTAL})")
    track[i0: i0 + len(seg)] += seg
    prev_end = t + len(seg) / SR
    placed.append([round(t, 2), round(prev_end, 2)])
Lv = lufs(track[np.abs(track) > 1e-4]); track *= db(-16 - Lv)
save(out / "narration.wav", track)

# ---- the clips' own sound: each levelled to -24 LUFS, dissolved like the picture, kept under the voice
amb = None
for c, d in zip(clips, durs):
    a = load(c, SR, 2)[: int(d * SR)]
    a = np.pad(a, ((0, max(0, int(d * SR) - len(a))), (0, 0)))
    g = np.clip(-24 - lufs(a), -12, 12) if np.abs(a).max() > 1e-4 else 0
    a = a * db(g)
    if amb is None: amb = a
    else:
        n = int(XF * SR); fo = np.cos(np.linspace(0, np.pi / 2, n))[:, None]; fi = np.sin(np.linspace(0, np.pi / 2, n))[:, None]
        amb = np.concatenate([amb[:-n], amb[-n:] * fo + a[:n] * fi, a[n:]])
amb = np.pad(amb, ((0, max(0, len(track) - len(amb))), (0, 0)))[: len(track)]
hop = SR // 100; env = np.sqrt(np.convolve(track ** 2, np.ones(hop * 3) / (hop * 3), "same"))[::hop]
on = env > db(-42) * max(env.max(), 1e-9); hold = np.zeros_like(on)
for i in np.where(on)[0]: hold[max(0, i - 30): i + 60] = True
gdb = np.where(hold, -10.0, -3.0 if MUSIC else -1.0)    # ambience at -24 LUFS: -34 under the voice, -25 (-27 with music) in the gaps
k = 25; gdb = np.convolve(np.pad(gdb, (k, k), mode="edge"), np.ones(2 * k + 1) / (2 * k + 1), "valid")
gain = db(np.interp(np.arange(len(track)) / SR, np.arange(len(gdb)) / 100, gdb))
tt = np.arange(len(track)) / SR
gain *= np.clip((end_video + 2.5 - tt) / 2.5, 0, 1) * np.clip(tt / 0.6, 0, 1)     # sound fades over the end card
mix = amb * gain[:, None] + track[:, None]
if MUSIC:
    mus = load(MUSIC, SR, 2)
    mus = np.pad(mus, ((0, max(0, len(track) - len(mus))), (0, 0)))[: len(track)]
    Lm = lufs(mus[: int(min(len(mus) / SR, end_video) * SR)])
    mdb = np.where(hold, MUSIC_DB["under"], MUSIC_DB["gap"]) + (-16 - Lm)
    tt100 = np.arange(len(mdb)) / 100
    mdb = np.where(tt100 >= end_video - 0.5, MUSIC_DB["end"] + (-16 - Lm), mdb)
    k2 = 50; mdb = np.convolve(np.pad(mdb, (k2, k2), mode="edge"), np.ones(2 * k2 + 1) / (2 * k2 + 1), "valid")   # ~1 s ramps
    mg = db(np.interp(tt, tt100, mdb)) * np.clip(tt / 1.5, 0, 1) * np.clip((TOTAL - tt) / 3.0, 0, 1) ** 1.3
    mix = mix + mus * mg[:, None]
with tempfile.TemporaryDirectory() as td:
    pre = Path(td) / "pre.wav"; save(pre, mix)
    m = subprocess.run(["ffmpeg", "-v", "info", "-nostats", "-i", str(pre), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex("{"): m.rindex("}") + 1])
    ln = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
          f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
    run(["ffmpeg", "-y", "-v", "error", "-i", str(pre), "-af", ln + ",aresample=48000", "-c:a", "pcm_s24le", str(out / "mix.wav")])

# ---- titles, subtitles, facts (ASS, drawn by libass)
def ts(x):
    x = max(0.0, x); h = int(x // 3600); m_ = int(x % 3600 // 60); s = x % 60
    return f"{h}:{m_:02d}:{s:05.2f}"
ass = ["[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}", "WrapStyle: 0", "ScaledBorderAndShadow: yes", "",
       "[V4+ Styles]",
       "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
       "Style: Sub,Noto Sans Devanagari,50,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,3.5,1.5,2,90,90,300,1",
       "Style: Fact,Noto Sans Devanagari,44,&H004DD3FF,&H004DD3FF,&H70000000,&H00000000,0,0,0,0,100,100,0,0,3,16,0,7,70,70,190,1",
       "Style: Src,Noto Sans Devanagari,27,&H00DCE6F2,&H00DCE6F2,&H70000000,&H00000000,0,0,0,0,100,100,0,0,3,12,0,7,70,70,282,1",
       "Style: Title,Rozha One,128,&H004DD3FF,&H004DD3FF,&H00060A3A,&H64000000,1,0,0,0,100,100,0,0,1,7,2,5,40,40,0,1",
       "Style: TSub,Tiro Devanagari Hindi,54,&H00DCF4FF,&H00DCF4FF,&H00060A14,&H64000000,0,0,0,0,100,100,0,0,1,4,1,5,60,60,0,1",
       "Style: Dim,Noto Sans Devanagari,20,&H00000000,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1",
       "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
ev = lambda a, b, style, text, layer=1: ass.append(f"Dialogue: {layer},{ts(a)},{ts(b)},{style},,0,0,0,,{text}")
# title over the opening shot
ev(0.9, 6.6, "Title", r"{\fad(700,600)\pos(540,700)}अपने ही विनाशक")
ev(1.8, 6.6, "TSub", r"{\fad(700,600)\pos(540,830)}एक छोटी डॉक्यूमेंट्री")
# subtitles: one per line, held until the next line or 0.3 s after its end
for i, (a, b) in enumerate(placed):
    nxt = placed[i + 1][0] if i + 1 < len(placed) else TOTAL
    if i == 0: a = max(a, 6.7)            # the title owns the first seconds
    ev(a - 0.08, min(b + 0.35, nxt - 0.05), "Sub", r"{\fad(150,150)}" + LINES[i][2])
for i, (head, src) in FACTS.items():
    a, b = starts[i] + 0.9, starts[i] + durs[i] - XF - 0.3
    ev(a, b, "Fact", r"{\fad(300,300)}" + head); ev(a + 0.25, b, "Src", r"{\fad(300,300)}" + src)
# end card: the last frame held and dimmed, the title back
ev(end_video - 0.2, TOTAL, "Dim", r"{\fad(900,0)\pos(0,0)\p1\1c&H000000&\1a&H50&}m 0 0 l 1080 0 1080 1920 0 1920{\p0}", layer=0)
ev(end_video + 0.3, TOTAL, "Title", r"{\fad(800,0)\pos(540,860)}अपने ही विनाशक")
ev(end_video + 1.1, TOTAL, "TSub", r"{\fad(800,0)\pos(540,990)}विनाशक भी हम… रक्षक भी हम।")
if MUSIC: ev(end_video + 1.6, TOTAL, "Src", r"{\fad(600,0)\an2\pos(540,1700)}" + MUSIC_CREDIT)
(out / "film.ass").write_text("\n".join(ass) + "\n", encoding="utf-8")

# ---- picture
fc, cur = [], None
for i in range(15): fc.append(f"[{i}:v]scale={W}:{H}:flags=lanczos,setsar=1,fps=24,format=yuv420p,trim=duration={durs[i]:.3f},setpts=PTS-STARTPTS[v{i}]")
cur = "v0"; acc = durs[0]
for i in range(1, 15):
    fc.append(f"[{cur}][v{i}]xfade=transition=fade:duration={XF}:offset={acc - XF:.3f}[x{i}]"); cur = f"x{i}"; acc += durs[i] - XF
fc.append(f"[{cur}]tpad=stop_mode=clone:stop_duration={HOLD},ass={out / 'film.ass'}:fontsdir={FONTS},fade=t=in:st=0:d=0.8,fade=t=out:st={TOTAL - 1.0:.3f}:d=1.0[vout]")
cmd = ["ffmpeg", "-y", "-v", "error"]
for c in clips: cmd += ["-i", str(c)]
cmd += ["-i", str(out / "mix.wav"), "-filter_complex", ";".join(fc), "-map", "[vout]", "-map", "15:a", "-t", f"{TOTAL:.3f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out / "film.mp4")]
run(cmd)
gaps = [((placed[k][1] + placed[k + 1][0]) / 2, placed[k + 1][0] - placed[k][1]) for k in range(14)]
ok = [g for g in gaps if TOTAL - 59.8 <= g[0] <= 59.8 and g[1] >= 0.3]
split = round(max(ok, key=lambda g: g[1])[0], 2) if ok else None
json.dump({"split": split, "starts": [round(s, 3) for s in starts], "durs": durs, "lines": placed, "end_video": end_video, "total": TOTAL,
           "narration_lufs_in": Lv}, open(out / "timeline.json", "w"), indent=1)
print(json.dumps({"split": split, "total": TOTAL, "lines": placed, "last_line_end": placed[-1][1], "end_video": round(end_video, 2)}))
