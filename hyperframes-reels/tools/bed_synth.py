"""Original music beds, synthesised with numpy/scipy (no samples, nothing copyrighted).
usage: python3 bed_synth.py <style> <seconds> <out.wav> [--hit SECONDS]
styles: pop (UI, 112 bpm, C major) | marimba (curious ostinato, 96 bpm, D dorian) | pulse (confident, 100 bpm, A minor)
        | space (slow pads, 76 bpm, E minor) | tiles (bouncy marimba groove, 104 bpm, F major)
        | synthwave (pumping saw pad, arp with echoes, gated snare, 92 bpm, A minor)
        | lofi (Rhodes 9th chords, swung soft drums, vinyl crackle, 78 bpm, D dorian)
        | newsreel (stride/ragtime piano and brushes through an old-radio band-pass, 116 bpm, C major)
--hit puts a riser into a final hit at that time (the end card), then a soft tail."""
import argparse
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
rng = np.random.default_rng(7)


def t_(n): return np.arange(n) / SR
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x)


def place(buf, s, at, g=1.0):
    i = int(round(at * SR))
    if i >= len(buf): return
    j = min(len(buf), i + len(s)); buf[i:j] += g * s[: j - i]


def kick(g=1.0):
    n = int(0.42 * SR); t = t_(n); f = 46 + 80 * np.exp(-t * 28)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    s[:240] += np.linspace(0.6, 0, 240) * rng.standard_normal(240) * 0.3
    return g * s


def clap(g=1.0):
    n = int(0.25 * SR); s = np.zeros(n); noise = bp(rng.standard_normal(n), 900, 4200)
    for k, d in enumerate((0.0, 0.011, 0.022)):
        i = int(d * SR); e = np.exp(-t_(n - i) * (60 if k < 2 else 16)); s[i:] += noise[: n - i] * e
    return g * 0.5 * s


def hat(g=1.0, dec=70):
    n = int(0.07 * SR); return g * 0.25 * hp(rng.standard_normal(n), 7000) * np.exp(-t_(n) * dec)


def pluck(m, dur=0.35, g=1.0, bright=1.0):
    n = int(dur * SR); t = t_(n); f = hz(m); s = np.zeros(n)
    for h in range(1, 7):
        s += (0.9 ** h) / h * np.sin(2 * np.pi * f * h * t) * np.exp(-t * (6 + 5 * h * bright))
    return g * s * np.minimum(1, t / 0.003)


def marimba(m, dur=0.6, g=1.0):
    n = int(dur * SR); t = t_(n); f = hz(m)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 5.5) + 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 22)
    return g * s * np.minimum(1, t / 0.002)


def pad(ms, dur, g=1.0, cut=1800):
    n = int(dur * SR); t = t_(n); s = np.zeros(n)
    for m in ms:
        for c in (-7, 0, 6):
            ph = rng.uniform(0, 1); f = hz(m) * 2 ** (c / 1200)
            s += 2 * (((f * t + ph) % 1.0) - 0.5)
    s = lp(s / (3 * len(ms)), cut)
    a = int(0.35 * SR); r = int(0.6 * SR); env = np.ones(n); env[:a] = np.linspace(0, 1, a); env[-r:] *= np.linspace(1, 0, r)
    return g * s * env


def sub(m, dur, g=1.0):
    n = int(dur * SR); t = t_(n); env = np.minimum(1, t / 0.01) * np.minimum(1, (dur - t) / 0.05)
    return g * np.sin(2 * np.pi * hz(m) * t) * env


def bassline(m, dur, g=1.0):
    n = int(dur * SR); t = t_(n); f = hz(m)
    s = 2 * (((f * t) % 1.0) - 0.5) + 0.5 * np.sin(2 * np.pi * f / 2 * t)
    return g * lp(s, 600) * np.exp(-t * 3) * np.minimum(1, t / 0.004)


def riser(sec, g=1.0):
    n = int(sec * SR); t = t_(n); x = t / sec
    noise = hp(rng.standard_normal(n), 2500) * x ** 2.2
    tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * x ** 2) / SR) * x ** 3 * 0.3
    return g * (0.35 * noise + tone)


def impact(g=1.0):
    n = int(2.6 * SR); t = t_(n); f = 38 + 60 * np.exp(-t * 9)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    s += 0.25 * lp(rng.standard_normal(n), 3000) * np.exp(-t * 6)
    return g * s


def saw(m, dur, g=1.0, cut=2500, dec=None):
    n = int(dur * SR); t = t_(n); s = np.zeros(n)
    for c in (-9, 0, 9):
        f = hz(m) * 2 ** (c / 1200); s += 2 * (((f * t + rng.uniform(0, 1)) % 1.0) - 0.5)
    env = np.minimum(1, t / 0.005) * np.minimum(1, np.maximum(0, dur - t) / 0.03)
    if dec: env = env * np.exp(-t * dec)
    return g * lp(s / 3, cut) * env


def square(m, dur, g=1.0, cut=3200):
    n = int(dur * SR); t = t_(n); f = hz(m); x = np.sin(2 * np.pi * f * t)
    return g * lp(0.6 * np.sign(x) + 0.4 * x, cut) * np.exp(-t * 7) * np.minimum(1, t / 0.003)


def snare(g=1.0):
    n = int(0.32 * SR); t = t_(n)
    s = bp(rng.standard_normal(n), 1500, 7000) * np.exp(-t * 16) + 0.5 * np.sin(2 * np.pi * 185 * t) * np.exp(-t * 26)
    return g * 0.6 * s


def brush(g=1.0):
    n = int(0.22 * SR); t = t_(n); return g * 0.35 * bp(rng.standard_normal(n), 2000, 9000) * np.exp(-t * 14) * np.minimum(1, t / 0.02)


def epiano(m, dur, g=1.0):
    n = int(dur * SR); t = t_(n); f = hz(m)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 1.5) + 0.25 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 3) + 0.16 * np.sin(2 * np.pi * f * 7.1 * t) * np.exp(-t * 14)
    return g * s * (1 + 0.12 * np.sin(2 * np.pi * 4.5 * t)) * np.minimum(1, t / 0.004) * np.minimum(1, np.maximum(0, dur - t) / 0.08)


def piano(m, dur, g=1.0):
    n = int(dur * SR); t = t_(n); f = hz(m); s = np.zeros(n)
    for h in range(1, 9):
        s += (0.78 ** h) * np.sin(2 * np.pi * f * h * np.sqrt(1 + 0.0004 * h * h) * t + rng.uniform(0, 6.28)) * np.exp(-t * (1.4 + 0.9 * h))
    s += 0.12 * hp(rng.standard_normal(n), 2000) * np.exp(-t * 60)
    return g * s * np.minimum(1, t / 0.002) * np.minimum(1, np.maximum(0, dur - t) / 0.05)


def crackle(n, g=1.0):
    x = np.zeros(n); k = rng.integers(0, n, int(n / SR * 16)); x[k] = rng.uniform(-1, 1, len(k)) * rng.uniform(0.2, 1, len(k))
    return g * (0.5 * hp(x, 1000) + 0.02 * bp(rng.standard_normal(n), 800, 6000))


def reverb(x, sec=1.8, mix=0.22):
    n = int(sec * SR); ir = rng.standard_normal(n) * np.exp(-t_(n) * 4.2); ir = lp(ir, 5000); ir /= np.sqrt(np.sum(ir ** 2))
    wet = fftconvolve(x, ir)[: len(x)]
    return (1 - mix) * x + mix * wet


def build(style, seconds, hit):
    N = int(seconds * SR) + SR; dry = np.zeros(N); wet_in = np.zeros(N)
    if style == "pop":
        bpm, prog = 112, [(48, (60, 64, 67)), (45, (57, 60, 64)), (41, (57, 60, 65)), (43, (59, 62, 67))]   # C Am F G
        arp = [0, 1, 2, 1]
    elif style == "marimba":
        bpm, prog = 96, [(38, (62, 65, 69)), (36, (60, 64, 67)), (43, (62, 67, 71)), (38, (62, 65, 69))]   # Dm C G Dm (dorian)
        arp = [0, 2, 1, 2]
    elif style == "space":
        bpm, prog = 76, [(40, (64, 67, 71)), (36, (60, 64, 67)), (43, (62, 67, 71)), (38, (62, 66, 69))]   # Em C G D
        arp = [0, 2, 1, 2]
    elif style == "tiles":
        bpm, prog = 104, [(41, (65, 69, 72)), (38, (62, 65, 69)), (46, (62, 65, 70)), (48, (64, 67, 72))]  # F Dm Bb C
        arp = [0, 1, 2, 1]
    elif style == "synthwave":
        bpm, prog = 92, [(45, (57, 60, 64)), (41, (57, 60, 65)), (48, (60, 64, 67)), (43, (59, 62, 67))]   # Am F C G
        arp = [0, 1, 2, 1]
    elif style == "lofi":
        bpm, prog = 78, [(38, (60, 65, 69, 72)), (43, (59, 64, 65, 69)), (36, (59, 62, 64, 67)), (45, (60, 64, 67, 71))]  # Dm9 G13 Cmaj9 Am9
        arp = [0, 1, 2, 3]
    elif style == "newsreel":
        bpm, prog = 116, [(48, (64, 67, 72)), (45, (61, 64, 67)), (50, (60, 66, 69)), (43, (59, 65, 67))]   # C A7 D7 G7
        arp = [0, 1, 2, 1]
    else:
        bpm, prog = 100, [(45, (57, 60, 64)), (41, (57, 60, 65)), (48, (60, 64, 67)), (43, (59, 62, 67))]   # Am F C G
        arp = [0, 1, 2, 1]
    beat = 60.0 / bpm; bar = 4 * beat; end = hit if hit else seconds
    nbars = int(np.ceil(seconds / bar)) + 1
    for b in range(nbars):
        t0 = b * bar
        if t0 >= seconds: break
        root, chord = prog[b % len(prog)]
        build_up = hit and t0 + bar > hit - 2.0 and t0 < hit     # thin out under the riser
        if style == "pop":
            place(wet_in, pad(chord, bar + 0.4, 0.10, 1500), t0)
            place(dry, sub(root - 12, bar * 0.95, 0.13), t0)
            for k in range(4):
                if b >= 1 and k in (0, 2): place(dry, kick(0.36), t0 + k * beat)
                if b >= 2 and k in (1, 3): place(wet_in, clap(0.35), t0 + k * beat)
            for k in range(8):
                if b >= 1: place(dry, hat(0.6 if k % 2 else 0.35), t0 + k * beat / 2)
            for k in range(16):
                m = chord[arp[k % 4]] + (12 if (k // 4) % 2 else 0)
                place(wet_in, pluck(m, 0.3, 0.11 if b >= 1 else 0.07), t0 + k * beat / 4)
        elif style == "marimba":
            place(wet_in, pad(chord, bar + 0.4, 0.07, 1200), t0)
            place(dry, sub(root - 12, bar * 0.95, 0.10), t0)
            motif = [chord[0], chord[2], chord[1], chord[2] + 12, chord[1], chord[2], chord[0] + 12, chord[2]]
            layers = 1 + min(3, b // 2)           # a copy of the motif joins every 2 bars, an octave up: recursion in sound
            for L in range(layers):
                for k, m in enumerate(motif):
                    place(wet_in, marimba(m + 12 * L, 0.5, 0.16 / (1 + 0.6 * L)), t0 + k * beat / 2 + L * beat / 4)
            for k in range(8):
                place(dry, hat(0.35 if k % 2 else 0.18, 110), t0 + k * beat / 2)
            if b >= 2: place(dry, kick(0.22), t0)
        elif style == "space":
            place(wet_in, pad(chord, bar + 0.6, 0.13, 1300), t0)
            place(dry, sub(root - 12, bar * 0.95, 0.10), t0)
            for k in (0, 2):
                place(wet_in, pluck(chord[arp[(b + k) % 4]] + 24, 1.2, 0.05, 0.4), t0 + k * beat)
            for k in range(4):
                place(dry, hat(0.16, 140), t0 + k * beat)
            if b >= 3: place(dry, kick(0.18), t0)
        elif style == "tiles":
            place(wet_in, pad(chord, bar + 0.4, 0.07, 1500), t0)
            place(dry, sub(root - 12, bar * 0.95, 0.11), t0)
            for k in range(8):
                m = chord[arp[k % 4]] + (12 if k >= 4 else 0)
                place(wet_in, marimba(m, 0.45, 0.13), t0 + k * beat / 2)
                place(dry, hat(0.4 if k % 2 else 0.2, 100), t0 + k * beat / 2)
            if b >= 1:
                place(dry, kick(0.3), t0); place(dry, kick(0.3), t0 + 2 * beat)
            if b >= 2: place(wet_in, clap(0.28), t0 + 3 * beat)
        elif style == "synthwave":
            p = pad(chord, bar + 0.1, 0.16, 2600); tp = t_(len(p))
            place(wet_in, p * (1 - 0.65 * np.exp(-((tp % beat) / 0.12))), t0)          # pumps on every beat
            for k in range(8): place(dry, saw(root - 12, beat / 2 * 0.9, 0.13, 700, 2.0), t0 + k * beat / 2)
            if b >= 1:
                for k in range(16):
                    m = chord[arp[k % 4]] + (24 if (k // 4) % 2 else 12); at = t0 + k * beat / 4
                    place(wet_in, square(m, 0.22, 0.07), at); place(wet_in, square(m, 0.22, 0.03), at + 0.75 * beat); place(wet_in, square(m, 0.22, 0.012), at + 1.5 * beat)
            for k in range(4):
                if b >= 1 and not build_up: place(dry, kick(0.34), t0 + k * beat)
                if b >= 1 and k in (1, 3) and not build_up: place(wet_in, snare(0.42), t0 + k * beat)
            for k in range(8):
                if b >= 1: place(dry, hat(0.32 if k % 2 else 0.12, 60), t0 + k * beat / 2)
        elif style == "lofi":
            sw = beat / 2 * 0.62                                                     # swung eighths
            for j, m in enumerate(chord): place(wet_in, epiano(m, bar * 0.95, 0.07), t0 + 0.025 * j)
            for j, m in enumerate(chord[1:]): place(wet_in, epiano(m + 12, beat * 1.2, 0.035), t0 + 2 * beat + sw + 0.02 * j)
            place(dry, sub(root - 12, beat * 1.6, 0.12), t0); place(dry, sub(root - 12, beat * 0.8, 0.09), t0 + beat + sw)
            if b >= 1:
                place(dry, kick(0.26), t0); place(dry, kick(0.2), t0 + 2 * beat + sw)
                for k in (1, 3): place(wet_in, snare(0.16), t0 + k * beat)
                for k in range(4): place(dry, hat(0.16, 120), t0 + k * beat); place(dry, hat(0.09, 120), t0 + k * beat + sw)
        elif style == "newsreel":
            fifth = root + 7
            for k in range(4):
                if k % 2 == 0: place(dry, piano((root if k == 0 else fifth) - 12, beat * 0.9, 0.16), t0 + k * beat)
                else:
                    for m in chord: place(dry, piano(m - 12, beat * 0.5, 0.06), t0 + k * beat)
                place(dry, brush(0.5 if k % 2 else 0.25), t0 + k * beat)
            rhythm = [1, 0, 1, 1, 0, 1, 0, 1]
            for k in range(8):
                if rhythm[k] and b >= 1: place(dry, piano(chord[(k + b) % 3] + 12, beat * 0.45, 0.08), t0 + k * beat / 2)
        else:
            place(wet_in, pad(chord, bar + 0.4, 0.11, 2200), t0)
            for k in range(8):
                place(dry, bassline(root, beat / 2 * 0.95, 0.16 if not build_up else 0.09), t0 + k * beat / 2)
            for k in range(4):
                if b >= 2 and not build_up: place(dry, kick(0.32), t0 + k * beat)
                if b >= 4 and k in (1, 3) and not build_up: place(wet_in, clap(0.3), t0 + k * beat)
            for k in range(16):
                if b >= 1: place(dry, hat(0.45 if k % 4 == 2 else 0.18, 90), t0 + k * beat / 4)
    if hit:
        place(dry, riser(2.0, 0.5), hit - 2.0)
        place(dry, impact(0.9), hit)
        root, chord = prog[0]
        place(wet_in, pad(chord, 3.2, 0.12, 2500), hit)
    mix = dry + reverb(wet_in)
    if style == "lofi": mix = lp(mix, 3600) + crackle(len(mix), 0.05)
    if style == "newsreel": mix = bp(mix, 260, 3800) * 1.6 + crackle(len(mix), 0.07)
    mix = mix[: int(seconds * SR)]
    f = int(1.2 * SR); mix[-f:] *= np.linspace(1, 0, f) ** 1.5
    return 0.89 * mix / (np.abs(mix).max() + 1e-9)


if __name__ == "__main__":
    import soundfile as sf
    ap = argparse.ArgumentParser(); ap.add_argument("style"); ap.add_argument("seconds", type=float); ap.add_argument("out")
    ap.add_argument("--hit", type=float, default=None); a = ap.parse_args()
    sf.write(a.out, build(a.style, a.seconds, a.hit).astype(np.float32), SR)
    print(a.out, a.style, a.seconds, "s")
