"""Timing for the homecoming film (chhath_ghar.html) from the chosen narration takes.

  python3 make_timing_ghar.py <take_dir> <out_dir> [--lines lines_ghar.json] [--start 0.6] [--gap 0.5] [--part1 auto]

Takes T1-T3 run back to back from --start (part 1, the journey home); part 2 (the four days) starts on the song's
vocal entry at --part1 and is cut to the song's bars; T4 and T5 are placed inside it. Each take is aligned to its
script letter by letter (faster-whisper word times), giving shot cuts on sentence starts, subtitle chunks in display
spelling and key-word cues. Writes out_dir/narration.wav (48 kHz mono on the film timeline), timing.json, words.json.
"""
import argparse, json, re, subprocess
from difflib import SequenceMatcher
from pathlib import Path
import numpy as np
from faster_whisper import WhisperModel

ap = argparse.ArgumentParser()
ap.add_argument("take_dir"); ap.add_argument("out_dir")
ap.add_argument("--lines", default=str(Path(__file__).with_name("lines_ghar.json")))
ap.add_argument("--start", type=float, default=0.6); ap.add_argument("--gap", type=float, default=0.5)
ap.add_argument("--part1", default="auto", help="film time where the song's vocal section starts (auto: bar-aligned after the narration)")
a = ap.parse_args()
take, out = Path(a.take_dir), Path(a.out_dir); out.mkdir(parents=True, exist_ok=True)
L = json.load(open(a.lines, encoding="utf-8"))
BAR, INTRO_END, BAR0 = 1.92076, 25.659, 0.689          # song grid: bars at BAR0 + n*BAR; vocals enter at INTRO_END
PART2 = [("day1", 3), ("day2", 3), ("day3", 5), ("kosi", 3), ("day4", 2.5), ("end", 3.5)]   # bars per shot
PLACED = {"T4": ("day3", 0.45), "T5": ("day4", 2.0)}  # take -> (shot it starts in, seconds after the cut)
SR = 48000

def load(f, sr=SR):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()
def n2(s): return re.sub(r"[^ऀ-ॿ]", "", s.replace("़", "").replace("ँ", "ं").replace("ॉ", "ो")).replace("।", "")
def trim(y):
    idx = np.where(np.abs(y) > 0.01 * np.abs(y).max())[0]; lead = max(idx[0] - int(0.04 * SR), 0)
    return y[lead: idx[-1] + int(0.12 * SR)], lead

model = WhisperModel("mobiuslabsgmbh/faster-whisper-large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=4)
def align(name, t0):
    """place take `name` at t0: returns (audio, chunk list [start, end, text, starts_shot, on_screen], cue times, words)"""
    y, lead = trim(load(take / f"{name}.wav"))
    y16 = load(take / f"{name}.wav", 16000)[int(lead / SR * 16000):]
    sg, _ = model.transcribe(y16, language="hi", word_timestamps=True, beam_size=5)
    ws = [[w.word.strip(), t0 + w.start, t0 + w.end] for s_ in sg for w in s_.words]
    asr, times = "", []
    for w, s0, s1 in ws: c = n2(w); asr += c; times += [(s0, s1)] * len(c)
    scr = n2(L["takes"][name]["text"])
    mp = {}
    for b in SequenceMatcher(None, scr, asr, autojunk=False).get_matching_blocks():
        for k in range(b.size): mp[b.a + k] = b.b + k
    def at(ci, end=False):
        keys = [k for k in mp if (k < ci if end else k >= ci)]
        if not keys: return None
        return times[mp[max(keys) if end else min(keys)]][1 if end else 0]
    def pos(ph, after=0):
        i = scr.find(n2(ph), after); return i if i >= 0 else None
    starts = []
    for anchor, *_ in L["takes"][name]["chunks"]:
        p = pos(anchor, starts[-1] + 1 if starts else 0)
        if p is None: raise SystemExit(f"anchor {anchor!r} not in {name}")
        starts.append(p)
    bounds = starts + [len(scr)]
    chunks = [[round(at(bounds[i]) - 0.08, 2), round(at(bounds[i + 1], end=True) + 0.3, 2), text, newshot, onscreen]
              for i, (anchor, text, newshot, onscreen) in enumerate(L["takes"][name]["chunks"])]
    cues = {k: round(at(pos(ph)), 2) for k, (tk, ph) in L["cues"].items() if tk == name and pos(ph) is not None}
    return y, chunks, cues, [w + [name] for w in ws]

placed, chunks, cues, words, t = {}, [], {}, [], a.start
for name in ["T1", "T2", "T3"]:
    y, ch, cu, ws = align(name, t); placed[name] = (t, y); chunks += ch; cues.update(cu); words += ws
    t += len(y) / SR + a.gap
narr_end = t - a.gap
if a.part1 == "auto":   # bed = song intro, then a bar-aligned repeat of it, so part 2 starts on a bar: 50.629 - j bars
    cands = [round(2 * INTRO_END - BAR0 - j * BAR, 3) for j in range(4)]
    P1 = min(c for c in cands if c >= narr_end + 2.0) if any(c >= narr_end + 2.0 for c in cands) else None
    if P1 is None: raise SystemExit(f"narration ends at {narr_end:.2f}s: too long for one intro repeat")
else: P1 = float(a.part1)
shots_p2, t2 = [], P1
for nm, bars in PART2: shots_p2.append([nm, round(t2, 3), round(t2 + bars * BAR, 3)]); t2 += bars * BAR
total = round(t2, 3)
for name, (shot, off) in PLACED.items():
    t0 = next(s for s in shots_p2 if s[0] == shot)[1] + off
    y, ch, cu, ws = align(name, t0); placed[name] = (t0, y); chunks += ch; cues.update(cu); words += ws
chunks.sort(key=lambda c: c[0])
for i, c in enumerate(chunks):
    nxt = chunks[i + 1][0] if i + 1 < len(chunks) else c[1] + 1
    c[1] = round(min(max(c[1], c[0] + 1.2), nxt - 0.02), 2)
# part 1 shots cut 0.35 s before the sentences that start a new shot
P1_SHOTS = ["mumbai", "phone", "pack", "flight", "train", "stations", "auto", "door", "family"]
cuts = [c[0] + 0.08 - 0.35 for c in chunks if c[3] and c[0] < P1]
assert len(cuts) == len(P1_SHOTS), (len(cuts), cuts)
cuts[0] = 0.0
shots = [[n, round(cuts[i], 3), round(cuts[i + 1] if i + 1 < len(cuts) else P1, 3)] for i, n in enumerate(P1_SHOTS)] + shots_p2
cues.update({"t4_end": round(placed["T4"][0] + len(placed["T4"][1]) / SR, 2), "t5_end": round(placed["T5"][0] + len(placed["T5"][1]) / SR, 2), "narr_end": round(narr_end, 2)})
timing = {"shots": shots, "subs": [c[:3] for c in chunks if not c[4]], "cues": cues, "total": total, "part1": P1,
          "song": {"intro_end": INTRO_END, "bar": BAR, "bar0": BAR0}}
track = np.zeros(int((total + 0.5) * SR), np.float32)
for name, (t0, y) in placed.items(): i0 = int(round(t0 * SR)); track[i0: i0 + len(y)] += y[: len(track) - i0]
json.dump(timing, open(out / "timing.json", "w"), ensure_ascii=False, indent=1)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", str(out / "narration.wav")], input=track.tobytes(), check=True)
json.dump(words, open(out / "words.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps({"shots": shots, "cues": cues, "part1": P1, "total": total, "narr_end": round(narr_end, 2)}, ensure_ascii=False))
