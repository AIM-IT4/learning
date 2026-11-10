"""Speech-check narration takes against their script before they are used.

  python3 check_takes.py lines.json take_dir [--models medium,turbo]

lines.json: {"takes": {"T1": {"text": "...", "keys": ["word", ...]}, ...}}; takes are take_dir/<T>_<anything>.wav.
For each take: letter error rate after normalisation (nukta, chandrabindu and punctuation ignored), the key words
neither recogniser heard (fuzzy match < 0.75), the length and the longest pause. Writes take_dir/score.json.
Recognisers: faster-whisper `medium` (house standard for Hindi) and large-v3-turbo (which stops near 30 s).
"""
import argparse, json, re, subprocess
from difflib import SequenceMatcher
from pathlib import Path
import numpy as np
from faster_whisper import WhisperModel

ap = argparse.ArgumentParser(); ap.add_argument("lines"); ap.add_argument("take_dir"); ap.add_argument("--models", default="medium,turbo")
a = ap.parse_args()
TAKES = json.load(open(a.lines, encoding="utf-8"))["takes"]
NAMES = {"medium": "Systran/faster-whisper-medium", "turbo": "mobiuslabsgmbh/faster-whisper-large-v3-turbo"}

def norm(s):
    s = s.replace("़", "").replace("ॉ", "ो").replace("ँ", "ं")
    return re.sub(r"[^ऀ-ॿ]", "", s).replace("।", "")
def cer(r, h):
    x, y = norm(r), norm(h); d = list(range(len(y) + 1))
    for i in range(1, len(x) + 1):
        p, d[0] = d[0], i
        for j in range(1, len(y) + 1): p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (x[i - 1] != y[j - 1]))
    return d[len(y)] / max(1, len(x))
def hit(k, h):
    k, h = norm(k), norm(h); best = 0
    for i in range(max(1, len(h) - len(k) + 1)):
        for L in (len(k) - 1, len(k), len(k) + 1): best = max(best, SequenceMatcher(None, k, h[i:i + L]).ratio())
    return best
def load16(f): return np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout, np.float32).copy()
def pauses(y, sr=16000, thr_db=-38):
    hop = sr // 100; e = np.sqrt(np.convolve(y ** 2, np.ones(hop * 2) / (hop * 2), "same"))[::hop]
    on = np.where(20 * np.log10(e / (e.max() + 1e-9) + 1e-9) > thr_db)[0]
    if len(on) < 2: return 0.0, 0.0
    gaps = np.diff(on) / 100.0
    return round(float(gaps.max()), 2), round((on[-1] - on[0]) / 100.0, 2)

M = {m: WhisperModel(NAMES[m], device="cpu", compute_type="int8", cpu_threads=4) for m in a.models.split(",")}
out = {}
for f in sorted(Path(a.take_dir).glob("T*_*.wav")):
    name = f.stem.split("_")[0]
    if name not in TAKES: continue
    y = load16(f); row = {"dur": round(len(y) / 16000, 2)}; row["max_pause"], row["speech"] = pauses(y)
    weak_all = None
    for mn, m in M.items():
        segs, _ = m.transcribe(y, language="hi", beam_size=5)
        h = " ".join(s.text.strip() for s in segs)
        weak = [k for k in TAKES[name]["keys"] if hit(k, h) < 0.75]
        weak_all = set(weak) if weak_all is None else weak_all & set(weak)
        row[mn] = {"cer": round(cer(TAKES[name]["text"], h), 3), "weak": weak, "heard": h}
    row["weak_both"] = sorted(weak_all or [])
    out[f.stem] = row
    print(f"{f.stem:10s} {row['dur']:5.1f}s speech {row['speech']:5.1f}s max-pause {row['max_pause']:.2f}s  " +
          "  ".join(f"{mn} {row[mn]['cer']:.1%}" for mn in M) + f"  missed {row['weak_both']}", flush=True)
json.dump(out, open(Path(a.take_dir) / "score.json", "w"), ensure_ascii=False, indent=1)
