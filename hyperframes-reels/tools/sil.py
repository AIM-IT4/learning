"""Pauses in a take (50 ms frames, 38 dB below the peak): python3 sil.py take.wav"""
import sys, librosa, numpy as np
y, sr = librosa.load(sys.argv[1], sr=16000, mono=True)
f = int(0.05 * sr); e = np.array([np.sqrt(np.mean(y[i:i + f] ** 2)) for i in range(0, len(y) - f, f)])
db = 20 * np.log10(e + 1e-9); thr = db.max() - 38; run = None; out = []
for i, d in enumerate(list(db) + [-200]):
    if d < thr: run = i if run is None else run
    else:
        if run is not None and (i - run) * 0.05 >= 0.15: out.append(f"{run * 0.05:.2f}-{i * 0.05:.2f}")
        run = None
print("pauses:", " ".join(out), "| len", round(len(y) / sr, 2))
