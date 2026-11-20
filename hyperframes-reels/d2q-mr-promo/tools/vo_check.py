"""Speech check for narrator takes: faster-whisper hears each take; numbers in what it heard are spelled out
(20.47% -> twenty point four seven percent, 1987 -> nineteen eighty-seven, S&P -> s and p) and compared word by word
with the script line. Also prints pace and pitch so takes of one voice can be compared.
usage: python tools/vo_check.py voice/lines_all.json <part>=take.wav [<part>=take.wav ...] [--model small]"""
import json, re, sys
import numpy as np, librosa
from num2words import num2words
from faster_whisper import WhisperModel

args = [a for a in sys.argv[2:] if not a.startswith("--")]
model = "small"
if "--model" in sys.argv: model = sys.argv[sys.argv.index("--model") + 1]; args = [a for a in args if a != model]
lines = dict(json.load(open(sys.argv[1], encoding="utf-8")))
ORD = {num2words(i, to="ordinal"): num2words(i) for i in range(1, 40)}


def spell(text):
    t = text.replace("S&P", "S and P").replace("&", " and ").replace("%", " percent").replace("—", " ").replace("–", " ")
    def num(m):
        s = m.group(0).replace(",", "")
        if re.fullmatch(r"(19|20)\d\d", s): return num2words(int(s), to="year")
        if re.fullmatch(r"\d+(st|nd|rd|th)", s): return num2words(int(re.sub(r"\D", "", s)))
        if "." in s: return num2words(float(s))
        return num2words(int(s))
    t = re.sub(r"\d[\d,]*(\.\d+)?(st|nd|rd|th)?", num, t)
    w = re.sub(r"[^a-z0-9' ]", " ", t.lower().replace("-", " ")).split()
    return [ORD.get(x, x) for x in w]


def wer(a, b):
    d = np.zeros((len(a) + 1, len(b) + 1), int); d[:, 0] = range(len(a) + 1); d[0, :] = range(len(b) + 1)
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (a[i - 1] != b[j - 1]))
    return d[-1, -1] / max(1, len(a))


m = WhisperModel(model, device="cpu", compute_type="int8", cpu_threads=4)
for a in args:
    part, f = a.split("=", 1)
    y, sr = librosa.load(f, sr=16000)
    segs, _ = m.transcribe(y, language="en", beam_size=5, condition_on_previous_text=False)
    heard = " ".join(s.text.strip() for s in segs)
    ref = spell(lines[part]); hyp = spell(heard)
    yt, _ = librosa.effects.trim(y, top_db=35)
    f0, _, _ = librosa.pyin(yt, fmin=60, fmax=300, sr=sr); f0 = f0[~np.isnan(f0)]
    print(f"{f.split('/')[-1]:16s} {len(yt)/sr:5.2f}s {len(lines[part].split())/(len(yt)/sr):.2f} w/s F0 {np.median(f0):3.0f} Hz"
          f" WER {wer(ref, hyp):.2f} | {heard}", flush=True)
