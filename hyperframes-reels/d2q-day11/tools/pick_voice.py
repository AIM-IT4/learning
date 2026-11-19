"""Rank narrator takes: speech check (faster-whisper small, WER vs script), pace, pitch and loudness.
usage: python tools/pick_voice.py script.txt take.wav [...]"""
import sys, re, numpy as np, librosa
from faster_whisper import WhisperModel
ref = open(sys.argv[1]).read().strip()
norm = lambda s: re.sub(r"[^a-z0-9 ]", " ", s.lower().replace("-", " ")).split()
m = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)
def wer(a, b):
    d = np.zeros((len(a) + 1, len(b) + 1), int); d[:, 0] = range(len(a) + 1); d[0, :] = range(len(b) + 1)
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (a[i - 1] != b[j - 1]))
    return d[-1, -1] / max(1, len(a))
for f in sys.argv[2:]:
    y, sr = librosa.load(f, sr=16000)
    segs, _ = m.transcribe(y, language="en", beam_size=5)
    heard = " ".join(s.text.strip() for s in segs)
    yt, _ = librosa.effects.trim(y, top_db=35)
    f0, _, _ = librosa.pyin(yt, fmin=60, fmax=300, sr=sr); f0 = f0[~np.isnan(f0)]
    words = len(ref.split())
    print(f"{f.split('/')[-1]:14s} dur {len(yt)/sr:5.2f}s  {words/(len(yt)/sr):.2f} w/s  F0 {np.median(f0):3.0f} Hz (IQR {np.percentile(f0,25):.0f}-{np.percentile(f0,75):.0f})"
          f"  rms {20*np.log10(np.sqrt(np.mean(yt**2))+1e-9):5.1f} dB  WER {wer(norm(ref), norm(heard)):.2f} | {heard}")
