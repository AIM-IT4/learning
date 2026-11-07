#!/usr/bin/env python3
"""
make_beat.py - synthesise an ORIGINAL epic "war drums" track (no samples, nothing copyrighted),
shaped for transition reels: a calm drone intro for a voice hook, a riser, a big impact on the
DROP, then driving taiko/dhol drums, and an ending hit.

  python make_beat.py --bpm 100 --intro-bars 4 --drop-bars 5 --out beat.wav

It prints the drop time; make_reel.py finds the beats on its own (or pass --bpm/--drop).
Needs: numpy.
"""
import argparse
import wave

import numpy as np

SR = 44100
rng = np.random.default_rng(3)


def lowpass(x, cutoff):
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    spec *= 1 / (1 + (f / cutoff) ** 4)          # gentle 4th-order-ish roll-off
    return np.fft.irfft(spec, len(x))


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def env(n, decay):
    return np.exp(-np.arange(n) / SR * decay)


def taiko(amp=1.0, length=0.9):
    n = int(length * SR)
    t = np.arange(n) / SR
    freq = 42 + 95 * np.exp(-t * 22)
    body = np.sin(2 * np.pi * np.cumsum(freq) / SR) * env(n, 5.5)
    skin = lowpass(rng.standard_normal(n), 900) * env(n, 40) * 0.6
    return amp * (body + skin)


def tha(amp=1.0, length=0.35):
    n = int(length * SR)
    t = np.arange(n) / SR
    freq = 190 + 160 * np.exp(-t * 60)
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR) * env(n, 16)
    slap = highpass(rng.standard_normal(n), 1200) * env(n, 35) * 0.5
    return amp * (tone + slap)


def hat(amp=0.15, length=0.06):
    n = int(length * SR)
    return amp * highpass(rng.standard_normal(n), 6000) * env(n, 70)


def boom(amp=1.0, length=3.0):
    n = int(length * SR)
    t = np.arange(n) / SR
    low = np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-t * 8)) / SR) * env(n, 1.6)
    crash = lowpass(rng.standard_normal(n), 5000) * env(n, 2.5) * 0.35
    return amp * (low + crash + taiko(1.0, length)[:n] * 0.6)


def riser(seconds):
    n = int(seconds * SR)
    p = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    bright = highpass(noise, 800) * p ** 2 * 0.35 + lowpass(noise, 1500) * p ** 3 * 0.25
    sweep = np.sin(2 * np.pi * np.cumsum(150 + 900 * p ** 2) / SR) * p ** 2 * 0.25
    return (bright + sweep) * np.linspace(0.2, 1, n)


def drone(seconds):
    t = np.arange(int(seconds * SR)) / SR
    x = np.zeros_like(t)
    for f, a in ((73.42, 1.0), (110.0, 0.6), (146.83, 0.45)):   # D, A, D (tanpura-like fifth)
        for h in range(1, 7):
            x += a / h ** 1.3 * np.sin(2 * np.pi * f * h * t + h)
    x *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.25 * t)            # slow swell
    return lowpass(x, 900) * 0.12


def place(buf, sound, at):
    a = int(at * SR)
    if a >= len(buf):
        return
    b = min(a + len(sound), len(buf))
    buf[a:b] += sound[:b - a]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bpm", type=float, default=100)
    ap.add_argument("--intro-bars", type=int, default=4, help="calm bars before the drop (voice hook)")
    ap.add_argument("--drop-bars", type=int, default=5, help="bars of full drums after the drop")
    ap.add_argument("--out", default="beat.wav")
    args = ap.parse_args()

    beat = 60 / args.bpm
    bar = 4 * beat
    drop = args.intro_bars * bar
    end = drop + args.drop_bars * bar
    total = end + 3.0
    mix = np.zeros(int(total * SR))
    place(mix, drone(total), 0)

    # intro: one deep taiko per bar, riser into the drop
    for b in range(args.intro_bars):
        place(mix, taiko(0.7), b * bar)
    rise = min(2 * bar, drop)
    place(mix, riser(rise), drop - rise)

    # drop: big impact, then the groove
    place(mix, boom(1.2), drop)
    for b in range(args.drop_bars):
        t0 = drop + b * bar
        fill = (b % 4 == 3) or (b == args.drop_bars - 1)
        for k, (pos, amp) in enumerate(((0, 1.0), (1.5, 0.7), (2, 0.9), (3.5, 0.5))):
            if not (b == 0 and k == 0):      # the boom already hits beat 1 of the first bar
                place(mix, taiko(amp), t0 + pos * beat)
        for pos in (1, 3):
            place(mix, tha(0.55), t0 + pos * beat)
        for s in range(16):
            place(mix, hat(0.12 if s % 2 else 0.2), t0 + s * beat / 4)
        if fill:                              # 16th-note taiko roll on the last beat
            for s in range(4):
                place(mix, taiko(0.45 + 0.15 * s, 0.4), t0 + 3 * beat + s * beat / 4)
    place(mix, boom(1.3), end)

    mix /= np.max(np.abs(mix)) / 0.89
    fade = int(1.0 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    stereo = np.stack([mix, np.roll(mix, int(0.012 * SR)) * 0.97], axis=1)   # light widening
    with wave.open(args.out, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes((stereo * 32767).astype(np.int16).tobytes())
    print(f"{args.out}: {total:.2f}s, {args.bpm:g} BPM, drop at {drop:.2f}s, last hit at {end:.2f}s")


if __name__ == "__main__":
    main()
