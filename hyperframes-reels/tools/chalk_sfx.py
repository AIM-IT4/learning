"""Synthesise chalk-on-slate sounds (no samples): python3 tools/chalk_sfx.py chalk/assets/sfx
Writes chalk-line.mp3 (a stroke), chalk-scribble.mp3 (hatching), chalk-write.mp3 (writing) and chalk-tap.mp3 (a tap)."""
import os, subprocess, sys, tempfile
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt

SR = 48000
bp = lambda x, lo, hi: sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x)


def strokes(dur, rate, seed, grit=0.6):
    n = int(dur * SR); t = np.arange(n) / SR; r = np.random.default_rng(seed)
    noise = bp(r.standard_normal(n), 1800, 7500); env = np.zeros(n); k = 0.0
    while k < dur:                                   # each stroke rises and falls; strokes overlap a little
        L = (0.6 + 0.8 * r.random()) / rate; i = int(k * SR); j = min(n, int((k + L) * SR)); u = np.linspace(0, 1, j - i)
        env[i:j] += np.sin(np.pi * u) ** 0.6 * (0.6 + 0.4 * r.random()); k += L * (1.05 + 0.3 * r.random())
    grain = (r.random(n) < 0.35).astype(float) * grit + (1 - grit)   # chalk skips on the slate
    s = noise * env * grain + 0.3 * bp(r.standard_normal(n), 300, 900) * env * 0.25
    s *= np.minimum(1, t / 0.01) * np.minimum(1, (dur - t) / 0.05)
    return s / np.abs(s).max() * 0.9


def tap(seed):
    n = int(0.12 * SR); t = np.arange(n) / SR; r = np.random.default_rng(seed)
    s = bp(r.standard_normal(n), 900, 5000) * np.exp(-t * 60) + 0.5 * np.sin(2 * np.pi * 420 * t) * np.exp(-t * 80)
    return s / np.abs(s).max() * 0.9


if __name__ == "__main__":
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    sounds = {"chalk-line": strokes(0.7, 2.2, 1, 0.5), "chalk-scribble": strokes(0.9, 9, 2, 0.7), "chalk-write": strokes(1.0, 6, 3, 0.6), "chalk-tap": tap(4)}
    with tempfile.TemporaryDirectory() as d:
        for name, s in sounds.items():
            w = os.path.join(d, name + ".wav"); sf.write(w, s.astype(np.float32), SR)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", w, "-codec:a", "libmp3lame", "-q:a", "3", os.path.join(out, name + ".mp3")], check=True)
    print("chalk sounds in", out)
