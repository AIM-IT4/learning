"""Shorten long pauses in a take: python3 tighten.py in.wav out.wav [max_pause=0.5] [keep=0.36] [cut_end]
A pause is a run of 50 ms frames 38 dB under the peak (as in sil.py). Every pause longer than max_pause is cut down to
`keep` seconds from its middle (10 ms crossfade). Prints JSON: the removed spans, so measured times can be remapped."""
import json, sys
import numpy as np, soundfile as sf
src, dst = sys.argv[1], sys.argv[2]
mx = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5; keep = float(sys.argv[4]) if len(sys.argv) > 4 else 0.36
y, sr = sf.read(src)
if y.ndim > 1: y = y.mean(axis=1)
if len(sys.argv) > 5: y = y[: int(float(sys.argv[5]) * sr)]
fr = int(0.05 * sr); pk = 20 * np.log10(np.abs(y).max() + 1e-9)
db = np.array([20 * np.log10(np.sqrt(np.mean(y[i:i + fr] ** 2)) + 1e-9) for i in range(0, len(y) - fr, fr)])
runs, run = [], None
for i, d in enumerate(list(db) + [0]):
    if d < pk - 38: run = i if run is None else run
    else:
        if run is not None and run > 0 and i < len(db): runs.append((run * 0.05, i * 0.05))
        run = None
out, cuts, pos = [], [], 0
xf = int(0.01 * sr)
for a, b in runs:
    if b - a <= mx: continue
    m = (a + b) / 2; ca, cb = m - (b - a - keep) / 2, m + (b - a - keep) / 2
    ia, ib = int(ca * sr), int(cb * sr)
    seg = y[pos:ia].copy()
    if out and len(seg) > xf: seg[:xf] = seg[:xf] * np.linspace(0, 1, xf) + out[-1][-xf:] * np.linspace(1, 0, xf); out[-1] = out[-1][:-xf]
    out.append(seg); cuts.append([round(ca, 3), round(cb - ca, 3)]); pos = ib
seg = y[pos:].copy()
if out and len(seg) > xf: seg[:xf] = seg[:xf] * np.linspace(0, 1, xf) + out[-1][-xf:] * np.linspace(1, 0, xf); out[-1] = out[-1][:-xf]
out.append(seg)
z = np.concatenate(out); sf.write(dst, z, sr)
print(json.dumps({"in": src, "out": dst, "before": round(len(y) / sr, 2), "after": round(len(z) / sr, 2), "cuts": cuts}))
