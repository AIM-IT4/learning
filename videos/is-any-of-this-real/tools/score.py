"""Procedural ambient score + sound design keyed to the video's cue times, mixed under the VO."""
import json, sys, wave
import numpy as np

V = sys.argv[1]
SR = 48000
cues = json.load(open(f'{V}/audio/cues.json'))
K, TRANS, DUR = cues['K'], cues['TRANS'], cues['DURATION']
N = int(DUR * SR) + SR
rng = np.random.default_rng(7)
music = np.zeros((N, 2))
sfx = np.zeros((N, 2))


def idx(t): return int(max(0, t) * SR)


def add(buf, t, sig, gain=1.0, pan=0.0):
    """place a mono or stereo signal at time t"""
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l * 1.414, sig * r * 1.414], 1)
    i = idx(t)
    if i >= N: return
    n = min(len(sig), N - i)
    buf[i:i + n] += sig[:n] * gain


def biquad_bp(x, f0, q):
    """band-pass with per-sample centre frequency array f0"""
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    w = 2 * np.pi * np.asarray(f0) / SR
    alpha = np.sin(w) / (2 * q)
    cw = np.cos(w)
    for i in range(len(x)):
        a0 = 1 + alpha[i]
        b0, b2 = alpha[i] / a0, -alpha[i] / a0
        a1, a2 = -2 * cw[i] / a0, (1 - alpha[i]) / a0
        yi = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, x[i], y1, yi
        y[i] = yi
    return y


def lowpass1(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.zeros_like(x); s = 0.0
    for i in range(len(x)):
        s = (1 - a) * x[i] + a * s; y[i] = s
    return y


def note_hz(n):
    names = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
    name, octv = n[:-1], int(n[-1])
    return 440.0 * 2 ** ((names[name] + 12 * (octv + 1) - 69) / 12)


# ───────────── pads: slow detuned additive chords ─────────────
def pad(t0, t1, notes, amp=0.05, att=2.2, rel=3.0, bright=900.0):
    n = int((t1 - t0 + rel) * SR)
    tt = np.arange(n) / SR
    hold = t1 - t0
    env = np.clip(tt / att, 0, 1) ** 1.6
    env *= np.where(tt > hold, np.exp(-(tt - hold) / (rel / 3.5)), 1.0)
    out = np.zeros((n, 2))
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * tt + rng.uniform(0, 6))
    for nn in notes:
        f = note_hz(nn)
        for k in range(1, 6):
            a = (1 / k ** 1.7) / (1 + (f * k / bright) ** 2)
            if k > 1: a *= 0.6 + 0.4 * lfo
            for ch in range(2):
                for det in (-1, 1):
                    d = 1 + det * (0.0017 + 0.0009 * ch) * (1 + 0.3 * k)
                    out[:, ch] += a * np.sin(2 * np.pi * f * k * d * tt + rng.uniform(0, 2 * np.pi))
    out *= (env * amp / max(1, len(notes) ** 0.5))[:, None]
    add(music, t0, out)


CH = [
    (0.0, K['atoms'] - 0.2, ['D3', 'A3', 'E4', 'F4']),
    (K['atoms'] - 0.6, K['never'] - 0.2, ['D3', 'F3', 'A3', 'C4', 'E4']),
    (K['never'] - 0.6, K['go'] + 0.1, ['Bb2', 'D3', 'F3', 'A3']),
    (K['go'] - 0.2, K['clouds'] - 0.2, ['G2', 'D3', 'Bb3', 'F4', 'A4']),
    (K['clouds'] - 0.8, K['color'], ['Eb3', 'G3', 'Bb3', 'D4']),
    (K['color'] - 0.1, K['brain'] - 0.3, ['A2', 'E3']),
    (K['brain'] - 0.6, K['lookup'] - 0.1, ['F2', 'C3', 'A3', 'E4']),
    (K['lookup'] - 0.3, K['edge'], ['D3', 'A3', 'F4', 'G4', 'A4']),
    (K['edge'] - 0.6, K['universe1'], ['Bb1', 'F2', 'D3', 'A3', 'E4']),
    (K['universe1'] - 0.5, K['humans'] - 0.2, ['G1', 'D2', 'Bb2', 'A3']),
    (K['humans'] - 0.6, K['pattern'], ['F2', 'C3', 'A3', 'E4', 'G4']),
    (K['pattern'] - 0.6, K['carbon'], ['C3', 'G3', 'E4', 'D4']),
    (K['carbon'] - 0.6, K['stars2'] + 0.2, ['D3', 'A3', 'F4', 'C5']),
    (K['stars2'] + 0.2, K['maybe2'], ['Bb2', 'F3', 'D4', 'A4']),
    (K['maybe2'] - 0.6, K['strangest'], ['G2', 'D3', 'Bb3', 'F4']),
    (K['strangest'] - 0.6, K['eyes'] + 0.3, ['D2', 'A2', 'E3', 'F3', 'A3', 'E4']),
    (K['open'], K['cut'], ['D2', 'A2', 'D3', 'F3', 'A3', 'E4', 'A4']),
]
for i, (a, b, ns) in enumerate(CH):
    rel = 0.6 if i == len(CH) - 2 else 3.0          # chord before "close your eyes" dies quickly
    att = 0.05 if i == len(CH) - 1 else 2.0          # final chord hits with the eye opening
    pad(a, b, ns, amp=0.075 if i != len(CH) - 1 else 0.11, att=att, rel=rel if i < len(CH) - 1 else 0.9,
        bright=650 if i in (5, 8, 9) else 1000)

# ───────────── sub drone (cut during the black "close your eyes" beat) ─────────────
tt = np.arange(N) / SR
drone = 0.06 * np.sin(2 * np.pi * 36.71 * tt) + 0.035 * np.sin(2 * np.pi * 73.42 * tt + 1)
drone *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.05 * tt)
g = np.clip(tt / 2.5, 0, 1)
g *= 1 - np.clip((tt - K['eyes'] - 0.1) / 0.5, 0, 1) * (tt < K['open'])
g *= np.where(tt > K['cut'], np.exp(-(tt - K['cut']) * 3), 1)
bh = np.exp(-((tt - (K['edge'] + K['projection']) / 2) / 6.0) ** 2) * 0.8   # deeper around the black hole
music[:, 0] += drone * g * (1 + bh); music[:, 1] += drone * g * (1 + bh)

# ───────────── shimmer grains (D minor pentatonic) ─────────────
PENT = [note_hz(n) for n in ['D5', 'F5', 'G5', 'A5', 'C6', 'D6', 'F6', 'A6']]
def density(t):
    d = 0.6
    if K['lookup'] < t < K['edge']: d = 2.6
    if K['edge'] < t < K['humans']: d = 1.2
    if K['strangest'] < t < K['eyes']: d = 1.8
    if K['eyes'] + 0.3 < t < K['open']: d = 0.0
    if t > K['cut']: d = 0
    return d
t = 0.5
while t < DUR:
    d = density(t)
    t += rng.exponential(1 / max(d, 0.05)) if d > 0 else 0.25
    if d <= 0 or t >= DUR: continue
    f = PENT[rng.integers(len(PENT))] * (2 if rng.random() < 0.15 else 1)
    n = int(SR * 2.2); x = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * x) * np.exp(-x * 2.2) * np.minimum(1, x / 0.004)
    s += 0.3 * np.sin(2 * np.pi * f * 2.01 * x) * np.exp(-x * 4)
    add(music, t, s, gain=0.016 * (0.5 + rng.random()), pan=rng.uniform(-0.8, 0.8))

# ───────────── sound design ─────────────
def boom(t, gain=0.5, f0=62, f1=28, dec=1.6):
    n = int(SR * (dec * 2.5)); x = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-x * 5)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-x / dec) * np.minimum(1, x / 0.003)
    s += 0.25 * rng.standard_normal(n) * np.exp(-x * 30)
    add(sfx, t, np.tanh(s * 1.4), gain)

def riser(t_end, dur=1.6, gain=0.12, f0=300, f1=5000, q=2.0):
    n = int(SR * dur); x = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (x / dur)
    s = biquad_bp(rng.standard_normal(n), f, q)
    s *= (x / dur) ** 2.2
    st = np.stack([s, np.roll(s, 240)], 1)
    add(sfx, t_end - dur, st, gain)

def whoosh(t_c, dur=1.0, gain=0.12, f0=200, f1=2500):
    n = int(SR * dur); x = np.arange(n) / SR
    f = f0 * (f1 / f0) ** np.sin(np.pi * x / dur)
    s = biquad_bp(rng.standard_normal(n), f, 1.4) * np.sin(np.pi * x / dur) ** 2
    pan = np.linspace(-0.7, 0.7, n)
    add(sfx, t_c - dur / 2, np.stack([s * (1 - pan), s * (1 + pan)], 1) * 0.7, gain)

def glitch(t, dur=0.4, gain=0.08):
    n = int(SR * dur); s = np.zeros(n)
    pos = 0
    while pos < n:
        L = int(SR * rng.uniform(0.008, 0.045))
        kind = rng.integers(3)
        x = np.arange(L) / SR
        if kind == 0: seg = np.sign(np.sin(2 * np.pi * rng.uniform(300, 3000) * x))
        elif kind == 1: seg = np.round(rng.standard_normal(L) * 3) / 3
        else: seg = np.zeros(L)
        s[pos:pos + L] = seg[:max(0, min(L, n - pos))]
        pos += L
    add(sfx, t, np.stack([s, np.roll(s, 90)], 1) * 0.6, gain)

def ping(t, f, gain=0.06, dec=1.4, pan=0.0):
    n = int(SR * dec * 3); x = np.arange(n) / SR
    s = (np.sin(2 * np.pi * f * x) + 0.4 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-x * 3)) * np.exp(-x / dec * 2.3)
    s *= np.minimum(1, x / 0.002)
    add(sfx, t, s, gain, pan)

def crackle(t, dur, gain=0.05, rate=180):
    n = int(SR * dur); s = np.zeros(n)
    for _ in range(int(rate * dur)):
        i = rng.integers(n); L = rng.integers(20, 160)
        s[i:i + L] += rng.standard_normal(min(L, n - i)) * np.exp(-np.arange(min(L, n - i)) / 25) * rng.uniform(0.2, 1)
    s *= np.sin(np.pi * np.arange(n) / n) ** 0.7
    add(sfx, t, np.stack([s, np.roll(s, 300)], 1), gain)

def heartbeat(t0, t1, gain=0.12, bpm=62):
    t = t0
    while t < t1:
        for dt, a in ((0, 1.0), (0.24, 0.65)):
            n = int(SR * 0.35); x = np.arange(n) / SR
            s = np.sin(2 * np.pi * (48 + 30 * np.exp(-x * 30)) * x) * np.exp(-x * 14) * a
            add(sfx, t + dt, s, gain)
        t += 60 / bpm

def breath(t, dur=2.5, gain=0.05):
    n = int(SR * dur); x = np.arange(n) / SR
    s = lowpass1(rng.standard_normal(n), 900) * np.sin(np.pi * x / dur) ** 2
    add(sfx, t, np.stack([s, np.roll(s, 500)], 1), gain)

# transitions
for tr in TRANS:
    c, d, ty = tr['at'], tr['dur'], tr['type']
    if ty == 1: riser(c, 1.4, 0.10); boom(c, 0.32)
    elif ty == 2: glitch(c - d / 2, d + 0.05, 0.10); boom(c, 0.18, 90, 40, 0.5)
    elif ty == 3: whoosh(c, 1.1, 0.16, 250, 3200)
    elif ty == 4: riser(c, 2.4, 0.08, 80, 900, 1.2); boom(c + 0.2, 0.42, 48, 22, 2.6)
    elif ty == 5: glitch(c - 0.3, 0.55, 0.07); whoosh(c, 0.8, 0.08, 600, 5000)
    elif ty == 6: pass

# moments
crackle(K['dissolve'] - 0.1, 1.9, 0.07)
boom(K['force'] + 0.05, 0.2, 80, 40, 0.6); crackle(K['force'] - 0.1, 1.2, 0.05, 260)
riser(K['seen'] + 0.03, 1.2, 0.06, 800, 7000, 3.0); ping(K['seen'] + 0.03, note_hz('A6'), 0.07, 1.6)
heartbeat(K['brain'] - 0.3, K['lookup'] - 0.3, 0.16)
glitch(K['late'] + 0.05, 0.28, 0.07)
for i, td in enumerate([K['gone'] - 0.55, K['gone'] - 0.1, K['gone'] + 0.35]):
    ping(td, note_hz(['A5', 'F5', 'D5'][i]), 0.05, 2.4, pan=[-0.6, 0.5, 0.0][i])
for i in range(26):                                     # data chirps on the horizon
    tq = K['written'] + rng.uniform(0, K['projection'] - K['written'])
    n = int(SR * 0.03); x = np.arange(n) / SR
    add(sfx, tq, np.sign(np.sin(2 * np.pi * rng.uniform(1500, 4500) * x)) * np.exp(-x * 90), 0.012, rng.uniform(-0.8, 0.8))
glitch(K['projection'] + 0.05, 0.4, 0.09)
breath(K['pattern'] - 0.3, 3.2, 0.05)
riser(K['stars2'] + 0.05, 2.6, 0.12, 120, 6000, 1.5)
boom(K['stars2'] + 0.05, 0.62, 70, 24, 2.4)
glitch(K['fake'] + 0.05, 0.3, 0.08)
riser(K['something'], 2.2, 0.05, 200, 2500, 1.0)
heartbeat(K['eyes'] + 0.4, K['open'] - 0.4, 0.13, 56)
boom(K['open'], 0.75, 58, 22, 2.8); crackle(K['open'], 0.6, 0.06, 400)
ping(K['title'], note_hz('D6'), 0.04, 2.5)
glitch(K['cut'] - 0.08, 0.32, 0.14)

# ───────────── reverb (synthetic stereo IR) ─────────────
def ir(seconds, rt60, damp):
    n = int(SR * seconds); x = np.arange(n) / SR
    out = []
    for ch in range(2):
        r = rng.standard_normal(n) * 10 ** (-3 * x / rt60)
        r = lowpass1(r, damp) * 0.6 + r * 0.4 * np.exp(-x * 3)
        r[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        out.append(r / np.sqrt(np.sum(r ** 2)))
    return np.stack(out, 1)

def convolve(x, h):
    n = len(x) + len(h)
    nfft = 1 << (n - 1).bit_length()
    y = np.zeros((len(x), 2))
    for ch in range(2):
        Y = np.fft.rfft(x[:, ch], nfft) * np.fft.rfft(h[:, ch], nfft)
        y[:, ch] = np.fft.irfft(Y, nfft)[:len(x)]
    return y

big = ir(5.0, 4.2, 2500)
wet_m = convolve(music + sfx * 0.6, big)
bus = music * 0.75 + sfx + wet_m * 0.9

# ───────────── VO: light plate reverb + mix with ducking ─────────────
w = wave.open(f'{V}/audio/vo_final.wav')
vo = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
vo = np.pad(vo, (0, max(0, N - len(vo))))[:N]
vo2 = np.stack([vo, vo], 1)
small = ir(1.6, 1.1, 5000)
vo_mix = vo2 + convolve(vo2, small) * 0.16

env = np.sqrt(lowpass1(vo ** 2, 6.0) + 1e-9)
env = env / (np.percentile(env[env > 1e-3], 90) + 1e-9)
duck = 1 - 0.42 * np.clip(env, 0, 1)
bus *= duck[:, None]

MUSIC_GAIN = float(sys.argv[2]) if len(sys.argv) > 2 else 0.9
def wr0(path, x):
    x = np.clip(x, -1, 1)
    f = wave.open(path, 'wb'); f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
    f.writeframes((x * 32767).astype(np.int16).tobytes()); f.close()
wr0(f'{V}/audio/stem_vo.wav', vo_mix[:int(DUR * SR)] * 0.5)
wr0(f'{V}/audio/stem_bus.wav', bus[:int(DUR * SR)] * MUSIC_GAIN * 0.5)
mix = vo_mix * 1.0 + bus * MUSIC_GAIN
fade = np.ones(N); tail = idx(DUR - 0.6)
fade[tail:] = np.linspace(1, 0, N - tail)
mix *= fade[:, None]
mix = mix[:int(DUR * SR)]
mix /= np.max(np.abs(mix)) * 1.05

def wr(path, x):
    x = np.clip(x, -1, 1)
    f = wave.open(path, 'wb'); f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
    f.writeframes((x * 32767).astype(np.int16).tobytes()); f.close()

wr(f'{V}/audio/mix_raw.wav', mix)
wr(f'{V}/audio/music_only.wav', (bus * 0.9)[:int(DUR * SR)] / (np.max(np.abs(bus)) + 1e-9))
print('mix written', mix.shape[0] / SR, 's')
