"""The reel's soundtrack: original background music and sound effects, ducked
under the voiceover and normalised to the loudness Instagram plays at.

    python mix.py --voice build/voice.mp3 --timing build/timing.json --out-dir build

Writes, into --out-dir:
    music.wav   music + effects on their own (reusable)
    mix.wav     voice + music at -14 LUFS, for the MP4
    mix.mp3     the same, for embedding in the web page

Everything is synthesised from scratch (numpy + scipy), so the music is
original and free to use. The arrangement follows the reel: a calm intro,
drums from step 1, claps and an arpeggio from step 3, a whoosh into every
scene and an impact as it lands, and a big hit on the end card.
Needs ffmpeg on PATH.
"""
import argparse
import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
BPM = 104
BEAT = 60.0 / BPM
BAR = 4 * BEAT
# Am7 - Fmaj7 - C - G, two bars each: (bass note, pad notes) as MIDI numbers.
PROGRESSION = [(45, [57, 60, 64, 67]), (41, [53, 57, 60, 64]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 67])]
BARS_PER_CHORD = 2
ARP_PATTERN = [0, 1, 2, 3, 2, 1]
# Loudness of each part relative to the pad, in dB (measured while each part is playing).
# Phone speakers barely play below ~200 Hz, so the hats, claps and arpeggio carry
# the groove there; they're mixed loud enough to be heard on a phone.
LEVELS_DB = {"pad": 0, "bass": -2, "kick": -2, "clap": -4, "hat": -7, "arp": -5, "fx": 3}
DUCK = 0.72            # while the voice speaks, the music drops to 28% (about -11 dB)
VOICE_RMS = 0.10
MUSIC_RMS = 0.045      # music bed about 7 dB under the voice between lines

rng = np.random.default_rng(7)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def filt(x, kind, f):
    return sosfilt(butter(2, f, kind, fs=SR, output="sos"), x)


def lp(x, f):
    return filt(x, "lowpass", f)


def hp(x, f):
    return filt(x, "highpass", f)


def bp(x, lo, hi):
    return filt(x, "bandpass", [lo, min(hi, SR / 2 - 200)])


def saw(f, n, phase=0.0):
    """Band-limited sawtooth (PolyBLEP), so it doesn't alias."""
    dt = f / SR
    t = (phase + dt * np.arange(n)) % 1.0
    y = 2 * t - 1
    a = t < dt
    x = t[a] / dt
    y[a] -= x + x - x * x - 1
    b = t > 1 - dt
    x = (t[b] - 1) / dt
    y[b] -= x * x + x + x + 1
    return y


def tri(f, n):
    t = (f / SR * np.arange(n)) % 1.0
    return 4 * np.abs(t - 0.5) - 1


def panned(x, p):
    """Mono -> stereo, constant power. p from -1 (left) to +1 (right); scalar or array."""
    ang = (np.asarray(p, dtype=float) + 1) * np.pi / 4
    return np.vstack([x * np.cos(ang), x * np.sin(ang)])


def place(buf, t, sig, gain=1.0):
    """Mix a mono or stereo signal into the stereo buffer at time t (seconds)."""
    if sig.ndim == 1:
        sig = np.vstack([sig, sig])
    i = int(round(t * SR))
    s0, i = max(0, -i), max(0, i)
    n = min(sig.shape[1] - s0, buf.shape[1] - i)
    if n > 0:
        buf[:, i:i + n] += gain * sig[:, s0:s0 + n]


# ------------------------------------------------------------------ instruments

def pad(notes, dur):
    n = int((dur + 0.9) * SR)
    out = np.zeros((2, n))
    for m in notes:
        for cents, p in ((-9, -0.65), (0, 0.0), (9, 0.65)):      # three detuned voices per note
            out += panned(saw(hz(m) * 2 ** (cents / 1200), n, rng.random()), p)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.5) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.3))
    return np.vstack([lp(out[0], 2400), lp(out[1], 2400)]) * env


def kick():
    t = np.arange(int(0.45 * SR)) / SR
    f = 46 + 95 * np.exp(-t / 0.032)                              # pitch drops fast: the "thump"
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2)
    click = lp(rng.standard_normal(t.size), 5000) * np.exp(-t / 0.004) * 0.35
    return np.tanh(2.0 * (body + click))


def clap():
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    env = np.zeros(n)
    for d, tau in ((0.0, 0.007), (0.011, 0.007), (0.022, 0.14)):  # three quick bursts
        m = t >= d
        env[m] += np.exp(-(t[m] - d) / tau)
    return bp(rng.standard_normal(n), 900, 5200) * env


def hat(open_=False):
    n = int((0.3 if open_ else 0.07) * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7500) * np.exp(-t / (0.1 if open_ else 0.017))


def bass(m, dur):
    n = int((dur + 0.06) * SR)
    t = np.arange(n) / SR
    f = hz(m)
    tone = np.sin(2 * np.pi * f * t) + 0.6 * np.sin(np.pi * f * t)  # note + sub-octave
    env = np.minimum(1, t / 0.006) * np.exp(-t / max(0.14, 0.8 * dur))
    return np.tanh(2.6 * tone * env)                                  # drive adds harmonics phones can play


def pluck(m):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    return lp(tri(hz(m), n) * np.exp(-t / 0.085), 3800)


def whoosh(length=0.7):
    """Noise rising through the spectrum and sweeping left to right."""
    n = int(length * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    bands = [250, 500, 1000, 2000, 4000, 8000]
    for k, c in enumerate(bands):
        mid = (k + 0.6) / len(bands) * length
        out += bp(noise, c / 1.6, c * 1.6) * np.exp(-((t - mid) / (length / 3.5)) ** 2)
    out *= (t / length) ** 2
    return panned(out / np.abs(out).max(), np.linspace(-0.7, 0.7, n))


def impact(big=False):
    n = int((1.8 if big else 0.9) * SR)
    t = np.arange(n) / SR
    f = 40 + 70 * np.exp(-t / 0.07)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.7 if big else 0.3))
    hit = lp(rng.standard_normal(n), 3000) * np.exp(-t / (0.09 if big else 0.04)) * 0.5
    return np.tanh(1.5 * (boom + hit))


# ------------------------------------------------------------------ arrangement

def active_rms(x):
    live = np.abs(x).max(axis=0) > 1e-3
    return float(np.sqrt((x[:, live] ** 2).mean())) if live.any() else 1.0


def music(timing):
    scenes = timing["scenes"]
    total = timing["total"] / 1000
    starts = [s["start"] / 1000 for s in scenes]
    last = len(scenes) - 1
    drums_on, extras_on, drums_off = starts[1], starts[min(3, last)], starts[last]
    n = int(np.ceil(total * SR))
    bus = {k: np.zeros((2, n)) for k in LEVELS_DB}

    # Chords (pad + bass) on a grid that starts at t = 0.
    for bar in range(0, int(np.ceil(total / BAR)) + 1, BARS_PER_CHORD):
        root, notes = PROGRESSION[(bar // BARS_PER_CHORD) % len(PROGRESSION)]
        t0, dur = bar * BAR, BARS_PER_CHORD * BAR
        if t0 >= drums_off:                                        # end card: one long last chord
            place(bus["pad"], t0, pad(notes, max(0.5, total - t0)))
            break
        place(bus["pad"], t0, pad(notes, dur))
        for b in range(BARS_PER_CHORD):                            # syncopated bass in 8th notes
            for step, length in ((0, 3), (3, 1), (4, 2), (6, 2)):
                t = t0 + b * BAR + step * BEAT / 2
                if drums_on - 0.01 <= t < drums_off:
                    place(bus["bass"], t, bass(root - 12 if step == 0 else root, length * BEAT / 2))

    # Drums and arpeggio, beat by beat.
    kicks = []
    for beat in range(int(total / BEAT) + 1):
        t, in_bar, bar = beat * BEAT, beat % 4, beat // 4
        if drums_on - 0.01 <= t < drums_off:
            if in_bar in (0, 2):
                place(bus["kick"], t, kick())
                kicks.append(t)
            if in_bar == 3 and bar % 2 == 1:                       # extra kick on the "and" of 4
                place(bus["kick"], t + BEAT / 2, kick(), 0.7)
                kicks.append(t + BEAT / 2)
            place(bus["hat"], t, hat(), 1.0)                       # 8th-note hats, lightly swung
            place(bus["hat"], t + BEAT / 2 + 0.06 * BEAT, hat(), 0.65)
            if in_bar == 3 and bar % 2 == 0:
                place(bus["hat"], t + BEAT / 2, hat(open_=True), 0.6)
            if t >= extras_on and in_bar in (1, 3):
                place(bus["clap"], t, clap())
        if extras_on <= t < drums_off + 2 * BAR:                   # arpeggio rides into the end card
            _, notes = PROGRESSION[(bar // BARS_PER_CHORD) % len(PROGRESSION)]
            for s in range(4):
                j = beat * 4 + s
                place(bus["arp"], t + s * BEAT / 4, panned(pluck(notes[ARP_PATTERN[j % 6]] + 12), -0.35 if s % 2 else 0.35))

    # Scene changes: a whoosh into each new scene, an impact as it lands.
    for k in range(1, len(scenes)):
        w = whoosh()
        place(bus["fx"], starts[k] - w.shape[1] / SR, w, 0.9)
        place(bus["fx"], starts[k], impact(big=(k == last)), 1.0 if k == last else 0.6)
    place(bus["fx"], 0.0, impact(), 0.5)                            # a soft hit on the first frame

    # The pad dips a little on every kick (the classic "pumping" sound).
    pump = np.ones(n)
    for kt in kicks:
        i = int(kt * SR)
        m = min(n - i, int(0.35 * SR))
        if m > 0:
            pump[i:i + m] = np.minimum(pump[i:i + m], 1 - 0.35 * np.exp(-np.arange(m) / (0.11 * SR)))
    bus["pad"] *= pump

    # Ping-pong echo on the arpeggio (dotted 8th).
    d = int(0.75 * BEAT * SR)
    echo = np.zeros_like(bus["arp"])
    for r in range(1, 4):
        if d * r < n:
            src = bus["arp"][::-1] if r % 2 else bus["arp"]           # swap left/right each repeat
            echo[:, d * r:] += 0.38 ** r * src[:, : n - d * r]
    bus["arp"] += echo

    ref = active_rms(bus["pad"])
    out = np.zeros((2, n))
    for k, x in bus.items():
        out += x * (ref / active_rms(x)) * 10 ** (LEVELS_DB[k] / 20)
    t = np.arange(n) / SR
    out *= np.minimum(1, t / 0.25) * np.clip((total - t) / 1.8, 0, 1)   # fade in, fade out
    return out


# ------------------------------------------------------------------ mixing

def load_audio(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def voice_envelope(v, n):
    """0..1 'is the voice speaking?' with a fast attack, slow release and 50 ms lookahead."""
    hop = int(0.01 * SR)
    frames = int(np.ceil(n / hop))
    padded = np.zeros(frames * hop)
    padded[: min(len(v), padded.size)] = v[: padded.size]
    rms = np.sqrt((padded.reshape(frames, hop) ** 2).mean(axis=1))
    level = np.clip(rms / (0.08 * max(rms.max(), 1e-9)), 0, 1)       # any real speech counts as "speaking"
    env, e = np.zeros(frames), 0.0
    attack, release = 1 - np.exp(-1 / 2), 1 - np.exp(-1 / 40)       # ~20 ms up, ~400 ms down (holds between words)
    for i, x in enumerate(level):
        e += (attack if x > e else release) * (x - e)
        env[i] = e
    env = np.maximum(env, np.concatenate([env[5:], np.full(5, env[-1])]))
    return np.interp(np.arange(n) / hop, np.arange(frames), env)


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x.T * 32767).astype(np.int16).tobytes())


def loudness(path):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "loudnorm=print_format=json",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    return json.loads(err[err.rindex("{"): err.rindex("}") + 1])


def normalise(src, dst, target=-14.0, peak=-1.5, lra=11):
    """Two-pass loudness normalisation to Instagram's playback level."""
    s = loudness(src)
    flt = (f"loudnorm=I={target}:TP={peak}:LRA={lra}:measured_I={s['input_i']}:measured_TP={s['input_tp']}"
           f":measured_LRA={s['input_lra']}:measured_thresh={s['input_thresh']}:offset={s['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-af", flt, "-ar", str(SR), str(dst)], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", required=True)
    ap.add_argument("--timing", required=True)
    ap.add_argument("--out-dir", default="build")
    a = ap.parse_args()
    out = Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)

    timing = json.loads(Path(a.timing).read_text())
    m = music(timing)
    n = m.shape[1]
    write_wav(out / "music.wav", m / np.abs(m).max() * 0.89)

    v = load_audio(a.voice)
    voice = np.zeros(n)
    voice[: min(n, v.size)] = v[:n]
    speaking = np.abs(voice) > 0.01
    voice *= VOICE_RMS / np.sqrt((voice[speaking] ** 2).mean())
    m *= MUSIC_RMS / np.sqrt((m ** 2).mean())
    env = voice_envelope(voice, n)
    mix = m * (1 - DUCK * env) + voice
    mix = np.tanh(mix / 0.95) * 0.95                                   # soft-clip any stray peaks
    write_wav(out / "mix_pre.wav", mix)
    normalise(out / "mix_pre.wav", out / "mix.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(out / "mix.wav"), "-b:a", "160k", str(out / "mix.mp3")],
                   check=True)
    (out / "mix_pre.wav").unlink()

    final = loudness(out / "mix.wav")
    ducked = m * (1 - DUCK * env)
    speaking, silent = env > 0.5, env < 0.05

    def level_db(x, mask):
        return 20 * np.log10(np.sqrt((x[:, mask] ** 2).mean()) / VOICE_RMS) if mask.any() else float("nan")

    print(f"wrote {out}/music.wav, mix.wav, mix.mp3 ({n / SR:.2f}s)")
    print(f"  loudness {final['input_i']} LUFS, true peak {final['input_tp']} dBTP")
    print(f"  music vs voice: {level_db(ducked, speaking):.1f} dB while speaking "
          f"({speaking.mean():.0%} of the reel), {level_db(ducked, silent):.1f} dB when the voice is silent")


if __name__ == "__main__":
    main()
