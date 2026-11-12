"""Word onsets with the pause snap: Whisper starts a word too early when it follows a pause, so a word whose span
contains a pause (that ends before the word does) really starts where the pause ends.
usage: python3 snap.py take.wav [offset]   (needs take.words.json from words.py; prints onsets + offset as JSON)"""
import json, sys
import librosa, numpy as np

f = sys.argv[1]; off = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
words = json.load(open(f.rsplit(".", 1)[0] + ".words.json", encoding="utf-8"))
y, sr = librosa.load(f, sr=16000, mono=True)
fr = int(0.05 * sr)
db = np.array([20 * np.log10(np.sqrt(np.mean(y[i:i + fr] ** 2)) + 1e-9) for i in range(0, len(y) - fr, fr)])
thr = db.max() - 38; pauses = []; run = None
for i, d in enumerate(list(db) + [-200]):
    if d < thr: run = i if run is None else run
    else:
        if run is not None and (i - run) * 0.05 >= 0.15: pauses.append((run * 0.05, i * 0.05))
        run = None
out = []
for k, (w, s, e) in enumerate(words):
    on = s
    for ps, pe in pauses:
        if k > 0 and ps < e and pe > s and pe < e:      # a pause inside the span, with speech after it
            on = max(on, pe)
    out.append([w, round(on + off, 2)])
print(json.dumps(out, ensure_ascii=False))
