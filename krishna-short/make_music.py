#!/usr/bin/env python3
"""
make_music.py - compose an ORIGINAL epic devotional backing track (everything synthesised with
numpy, no samples, nothing copyrighted) for recitation reels.

Instruments: tanpura drone, bansuri (flute) melody, string pad, choir "aah", temple bells,
shankh (conch) call before the drop, sub bass, taiko/dhol war drums, riser and impacts.
Key D minor, chords i-VI-III-VII (Dm Bb F C), the classic epic progression.

Structure (in bars of 4 beats):
  intro      1 bar   bell + tanpura + bansuri phrase
  verse      N bars  tanpura, pad, soft taiko on 1  (calm recitation)
  call       1 bar   shankh (conch) + riser, no voice  -> builds tension
  DROP       M bars  boom, war drums, bass, strings + choir, high bansuri
  outro      2 bars  final boom, choir and bell ring out

  python make_music.py --bpm 92 --verse-bars 4 --drop-bars 8 --out music.wav
Prints the bar times so the voice can be placed on the beat (see make_voiceover.py --bpm).
Needs: numpy.  Re-uses the drum sounds from make_beat.py.
"""
import argparse
import wave

import numpy as np

import make_beat as mb

SR = mb.SR
rng = np.random.default_rng(5)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def adsr(n, a, r, sustain=1.0):
    e = np.full(n, sustain)
    na, nr = min(int(a * SR), n), min(int(r * SR), n)
    e[:na] = np.linspace(0, sustain, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def saw(freq, n, detune_cents=0.0, phase=0.0):
    f = freq * 2 ** (detune_cents / 1200)
    return 2 * ((phase + f * np.arange(n) / SR) % 1.0) - 1


def bandpass_gain(f, centre, width):
    return np.exp(-0.5 * ((f - centre) / width) ** 2)


def formant(x, formants):
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = sum(a * bandpass_gain(f, c, w) for c, w, a in formants)
    return np.fft.irfft(spec * g, len(x))


def reverb(x, seconds=2.2, mix=0.3):
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * (6.9 / seconds))
    ir = mb.lowpass(ir, 6000)
    ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]
    return (1 - mix) * x + mix * wet


# ----------------------------------------------------------------------------- instruments
def tanpura_pluck(freq, seconds=4.0):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for h in range(1, 18):
        # jawari: upper harmonics bloom a little after the pluck, then fade
        bloom = (1 - np.exp(-t * (3 + h * 0.4))) * np.exp(-t * (0.9 + h * 0.08))
        x += (1 / h) * np.sin(2 * np.pi * freq * h * t + h * 0.7) * bloom
    return x * adsr(n, 0.005, 0.3)


def flute(notes, total_n, beat):
    """notes: list of (start_beat, dur_beats, midi). Sine-ish tone, vibrato, breath, glides."""
    out = np.zeros(total_n)
    prev = None
    for start, dur, m in notes:
        a = int(start * beat * SR)
        n = int(dur * beat * SR)
        if a >= total_n:
            break
        n = min(n, total_n - a)
        t = np.arange(n) / SR
        f = np.full(n, midi(m))
        if prev is not None:                      # 70 ms portamento from the previous note
            g = min(int(0.07 * SR), n)
            f[:g] = np.linspace(midi(prev), midi(m), g)
        vib = 1 + 0.006 * np.sin(2 * np.pi * 5.3 * t) * np.clip((t - 0.25) / 0.3, 0, 1)
        ph = 2 * np.pi * np.cumsum(f * vib) / SR
        tone = np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)
        breath = mb.highpass(rng.standard_normal(n), 2500) * 0.06
        out[a:a + n] += (tone + breath) * adsr(n, 0.07, min(0.15, dur * beat * 0.4))
        prev = m
    return out


def pad(chord, n, cutoff=2200):
    x = np.zeros(n)
    for m in chord:
        for d in (-8, 0, 8):
            x += saw(midi(m), n, d, rng.random())
    return mb.lowpass(x, cutoff) / (3 * len(chord))


def choir(chord, n):
    x = np.zeros(n)
    for m in chord:
        for d in (-12, -4, 4, 12):
            vib = 1 + 0.004 * np.sin(2 * np.pi * (4.8 + d / 10) * np.arange(n) / SR)
            x += 2 * ((np.cumsum(midi(m + 12) * vib) / SR + rng.random()) % 1.0) - 1
    aah = [(800, 120, 1.0), (1150, 140, 0.6), (2900, 250, 0.25), (3300, 300, 0.15)]
    return formant(x, aah) / (4 * len(chord))


def bell(freq=523.0, seconds=4.0, amp=1.0):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t * d)
            for r, a, d in ((1, 1, 1.2), (2.0, 0.5, 1.8), (2.76, 0.6, 2.5), (5.4, 0.3, 4), (8.93, 0.2, 6)))
    return amp * x * adsr(n, 0.002, 0.2)


def shankh(seconds, freq=233.1):
    """Conch call: nasal brassy tone that swells, holds and bends up at the end."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    p = t / seconds
    bend = 1 + 0.06 * np.clip((p - 0.75) / 0.25, 0, 1) ** 2 - 0.03 * np.exp(-t * 6)
    f = freq * bend * (1 + 0.003 * np.sin(2 * np.pi * 5 * t))
    ph = np.cumsum(f) / SR
    raw = 2 * (ph % 1.0) - 1 + 0.5 * np.sign(np.sin(2 * np.pi * ph))
    tone = formant(raw, [(950, 220, 1.0), (1500, 260, 0.6), (2600, 400, 0.35), (500, 150, 0.5)])
    breath = mb.highpass(rng.standard_normal(n), 1800) * 0.05
    env = np.clip(t / 0.5, 0, 1) ** 1.5 * np.clip((seconds - t) / 0.25, 0, 1)
    return (tone / (np.abs(tone).max() + 1e-9) + breath) * env


def bass_note(freq, seconds):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t)
    return x * np.exp(-t * 4) * adsr(n, 0.005, 0.05)


# ----------------------------------------------------------------------------- composition
DM, BB, F, C = (50, 53, 57), (46, 50, 53), (53, 57, 60), (48, 52, 55)
ROOT = {DM: 38, BB: 34, F: 41, C: 36}


def compose(bpm, verse_bars, drop_bars):
    beat = 60 / bpm
    bar = 4 * beat
    intro, call, outro = 1, 1, 2
    verse0 = intro
    call0 = verse0 + verse_bars
    drop0 = call0 + call
    outro0 = drop0 + drop_bars
    n_bars = outro0 + outro
    total = n_bars * bar + 2.5
    N = int(total * SR)
    L = {k: np.zeros(N) for k in ("tanpura", "pad", "choir", "flute", "bass", "drums", "fx")}

    def put(layer, sound, at):
        mb.place(L[layer], sound, at)

    # chords per bar
    verse_prog = [DM, DM, BB, C]
    drop_prog = [DM, BB, F, C]
    chords = [DM] * intro
    chords += [verse_prog[i % 4] for i in range(verse_bars)]
    chords += [C] * call
    chords += [drop_prog[i % 4] for i in range(drop_bars)]
    chords += [DM] * outro

    # tanpura: Pa Sa Sa Sa(low) on every beat, whole song
    cycle = [midi(45), midi(50), midi(50), midi(38)]
    for b in range(n_bars * 4):
        put("tanpura", tanpura_pluck(cycle[b % 4]) * 0.9, b * beat)

    # pad: soft in the verse, full from the drop; choir from the drop
    for i, ch in enumerate(chords):
        n = int(bar * SR * 1.15)
        loud = 0.8 if i < drop0 else 1.0
        put("pad", pad(ch, n, 1600 if i < drop0 else 3000) * adsr(n, 0.5 if i < drop0 else 0.05, 0.4) * loud, i * bar)
        if i >= drop0:
            hold = (outro + 1.2) if i == outro0 else 1.15
            n2 = int(bar * SR * hold)
            put("choir", choir(ch, n2) * adsr(n2, 0.25, 0.6), i * bar)

    # bansuri melody (D minor, phrased like an alaap)
    mel = [(0, 1, 69), (1, 0.5, 74), (1.5, 0.5, 72), (2, 1.5, 69), (3.5, 0.5, 67)]          # intro bar
    v = verse0 * 4
    mel += [(v + 3, 1, 69), (v + 7, 1, 72), (v + 11, 1, 70), (v + 15, 1, 67)]              # fills at line ends
    c = call0 * 4
    mel += [(c, 2, 74), (c + 2, 2, 76)]                                                    # rising into the call
    for k in range(drop_bars // 2):                                                        # high sustained line
        d = (drop0 + 2 * k) * 4
        mel += [(d, 3, [81, 82, 81, 79][k % 4]), (d + 3, 1, 77), (d + 4, 4, [77, 77, 79, 76][k % 4])]
    o = outro0 * 4
    mel += [(o, 2, 74), (o + 2, 6, 74)]
    put("flute", flute(sorted(mel), N, beat), 0)

    # bass on the drop: root on 1, the "and" of 2, and 3
    for i in range(drop0, outro0):
        r = midi(ROOT[chords[i]])
        for pos in (0, 1.5, 2, 3.5):
            put("bass", bass_note(r, beat * 0.9), i * bar + pos * beat)

    # drums
    for i in range(verse0, call0):            # light dhol groove under the verse
        put("drums", mb.taiko(0.6), i * bar)
        put("drums", mb.taiko(0.35), i * bar + 2.5 * beat)
        put("drums", mb.taiko(0.45), i * bar + 2 * beat)
        for pos in (1, 3):
            put("drums", mb.tha(0.3), i * bar + pos * beat)
        for e in range(8):
            put("drums", mb.hat(0.07 if e % 2 else 0.1), i * bar + e * beat / 2)
    put("drums", mb.taiko(0.6), call0 * bar)
    for i in range(drop0, outro0):
        t0 = i * bar
        fill = (i - drop0) % 4 == 3 or i == outro0 - 1
        for k, (pos, amp) in enumerate(((0, 1.0), (1.5, 0.7), (2, 0.9), (3.5, 0.5))):
            if not (i == drop0 and k == 0):
                put("drums", mb.taiko(amp), t0 + pos * beat)
        for pos in (1, 3):
            put("drums", mb.tha(0.55), t0 + pos * beat)
        for s in range(16):
            put("drums", mb.hat(0.11 if s % 2 else 0.18), t0 + s * beat / 4)
        if fill:
            for s in range(4):
                put("drums", mb.taiko(0.45 + 0.15 * s, 0.4), t0 + 3 * beat + s * beat / 4)

    # fx: bells, conch call + riser, impacts
    put("fx", bell(523.3, 5, 0.5), 0)
    put("fx", bell(392.0, 4, 0.25), bar * 0.5)
    put("fx", shankh(bar * 0.92) * 0.9, call0 * bar)
    put("fx", mb.riser(bar) * 0.8, call0 * bar)
    put("fx", mb.boom(1.2), drop0 * bar)
    put("fx", bell(523.3, 6, 0.45), drop0 * bar)
    put("fx", mb.boom(1.3), outro0 * bar)
    put("fx", bell(587.3, 7, 0.5), outro0 * bar)

    def norm(x):
        return x / (np.abs(x).max() + 1e-9)

    mix = (0.20 * norm(L["tanpura"]) + 0.22 * norm(reverb(L["pad"], 2.5, 0.35))
           + 0.26 * norm(reverb(L["choir"], 3.0, 0.45)) + 0.30 * norm(reverb(L["flute"], 2.2, 0.35))
           + 0.30 * norm(L["bass"]) + 0.85 * norm(reverb(L["drums"], 1.2, 0.12))
           + 0.55 * norm(reverb(L["fx"], 2.5, 0.25)))
    mix = np.tanh(1.3 * mix) / np.tanh(1.3)            # gentle saturation / glue
    mix = mix / np.abs(mix).max() * 0.89
    fade = int(1.5 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    info = dict(bpm=bpm, bar=bar, verse=verse0 * bar, call=call0 * bar, drop=drop0 * bar,
                outro=outro0 * bar, total=total)
    return mix, info


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bpm", type=float, default=92)
    ap.add_argument("--verse-bars", type=int, default=4, help="calm bars for the first lines")
    ap.add_argument("--drop-bars", type=int, default=8, help="full-energy bars after the drop")
    ap.add_argument("--out", default="music.wav")
    args = ap.parse_args()
    mix, info = compose(args.bpm, args.verse_bars, args.drop_bars)
    stereo = np.stack([mix, np.roll(mix, int(0.011 * SR)) * 0.97], axis=1)
    with wave.open(args.out, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes((stereo * 32767).astype(np.int16).tobytes())
    print(f"{args.out}: {info['total']:.2f}s at {args.bpm:g} BPM (bar = {info['bar']:.3f}s)")
    print(f"  verse starts {info['verse']:.2f}s | conch call {info['call']:.2f}s | "
          f"DROP {info['drop']:.2f}s | outro {info['outro']:.2f}s")


if __name__ == "__main__":
    main()
