"""Market Risk promo ("Comment RISK"): the music bed (copied from d2q-free10/tools/bed_free10.py). An original, light, upbeat score synthesised in numpy (tools/bed_synth.py,
copied from d2q-day11-hud: its "pop" style, C major, 112 BPM: C Am F G with pads, a sub bass, kick, clap, hats and a
plucked arpeggio; no samples). The voice ducks it with a held envelope (no pumping between words), and a ceiling keeps it
at least 10 dB under the voice wherever the voice speaks, as the two meet in the film (bed at data-volume 0.75, voice at 1
from t = 0.12): duck() and ceiling() as in d2q-day11-hud/tools/bed_hud.py, then block_ceiling(): the same rule over 400 ms
blocks, which also catches quiet word tails.
usage: ~/.local/share/earshot/.venv/bin/python tools/bed_mr.py 53.4 assets/bgm.wav [assets/vo.wav]"""
import importlib.util, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("bed_synth", os.path.join(HERE, "bed_synth.py"))
bs = importlib.util.module_from_spec(spec); spec.loader.exec_module(bs)
SR = bs.SR


def duck(mix, vo_path, at0=0.12, depth=0.45):
    """a held ducking envelope from the voice: fast attack, a 0.6 s hold, slow release; no pumping between words"""
    import soundfile as sf
    v, sr = sf.read(vo_path, always_2d=True); v = v.mean(1)
    assert sr == SR, sr
    hop = SR // 100
    rms = np.array([np.sqrt(np.mean(v[i:i + hop] ** 2)) for i in range(0, len(v) - hop, hop)])
    act = (20 * np.log10(rms + 1e-9) > -38).astype(float)
    hold = int(0.6 * 100); held = act.copy()
    for i in range(len(act)):
        if act[i]: held[i:i + hold] = 1.0
    env = np.zeros_like(held); e = 0.0
    for i, h in enumerate(held):
        e += (h - e) * (0.5 if h > e else 0.06); env[i] = e
    g = 1 - depth * np.repeat(env, hop)
    out = mix.copy(); s0 = int(at0 * SR); n = min(len(g), len(out) - s0)
    out[s0:s0 + n] *= g[:n, None]
    return out


def kweight(x):
    """BS.1770 K-weighting at 48 kHz (high shelf + RLB high-pass)"""
    from scipy.signal import lfilter
    x = lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585], x)
    return lfilter([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621], x)


def ceiling(y, vo_path, vol=0.75, at0=0.12, margin=10.0):
    """keep the score at least `margin` dB under the voice wherever the voice speaks (20 ms K-weighted frames against the
    voice's local peak level over +-120 ms; one frame of look-ahead, instant attack, 250 ms release)"""
    import soundfile as sf
    from scipy.ndimage import maximum_filter1d
    v, sr = sf.read(vo_path, always_2d=True); v = v.mean(1)
    hop = SR // 50; n = len(y) // hop
    vp = np.zeros(len(y)); s0 = int(at0 * SR); m = min(len(v), len(y) - s0); vp[s0:s0 + m] = v[:m]

    def env(x):
        x = kweight(x)[:n * hop].reshape(n, hop)
        return 10 * np.log10(np.mean(x ** 2, 1) + 1e-12)

    V = maximum_filter1d(env(vp), size=13)
    Bd = env(y.mean(1) * vol)
    red = np.where(V > -40, np.minimum(0.0, (V - margin) - Bd), 0.0)
    red = np.minimum(red, np.roll(red, -1))
    g = np.zeros(n); e = 0.0; rel = np.exp(-1 / (0.25 * 50))
    for i in range(n):
        e = red[i] if red[i] < e else red[i] + (e - red[i]) * rel
        g[i] = e
    gain = np.ones(len(y)); gain[:n * hop] = 10 ** (np.repeat(g, hop) / 20)
    return y * gain[:, None], float(g.min()), float(np.mean(g < -0.5))


def block_ceiling(y, vo_path, vol=0.75, at0=0.12, margin=10.6, blk=0.4, hop=0.05, speak=-30.0):
    """a second, stricter pass after ceiling(): over every 400 ms block (50 ms hop) in which the voice speaks (its
    K-weighted block loudness above `speak`), the score's block loudness is held at least `margin` dB under the voice's.
    ceiling() follows the voice's local peak, so a quiet, spiky word tail could still meet a loud bar of the score; this
    pass catches those. Instant attack (starting a block early), 250 ms release."""
    import soundfile as sf
    v, sr = sf.read(vo_path, always_2d=True); v = v.mean(1)
    vp = np.zeros(len(y)); s0 = int(at0 * SR); m = min(len(v), len(y) - s0); vp[s0:s0 + m] = v[:m]
    kv = kweight(vp); B, H = int(blk * SR), int(hop * SR); nh = len(y) // H + 1
    Lblk = lambda k, i: -0.691 + 10 * np.log10(np.mean(k[i:i + B] ** 2) + 1e-15)
    LV = {i: Lblk(kv, i) for i in range(0, len(y) - B, H)}
    total = np.zeros(nh)
    for _ in range(4):
        kb = kweight(y.mean(1) * vol); red = np.zeros(nh)
        for i, lv in LV.items():
            if lv <= speak:
                continue
            need = (lv - margin) - Lblk(kb, i)
            if need < 0:
                red[i // H:(i + B) // H + 1] = np.minimum(red[i // H:(i + B) // H + 1], need)
        if red.min() > -0.05:
            break
        red = np.minimum(red, np.roll(red, -2))             # start the cut a little early
        g = np.zeros(nh); e = 0.0; rel = np.exp(-1 / (0.25 / hop))
        for i in range(nh):
            e = red[i] if red[i] < e else red[i] + (e - red[i]) * rel
            g[i] = e
        total += g
        gs = np.interp(np.arange(len(y)), np.arange(nh) * H, 10 ** (g / 20))
        y = y * gs[:, None]
    return y, float(total.min())


def loud(x):
    """integrated loudness (BS.1770-style: K-weighted 400 ms blocks, 75% overlap, absolute and relative gates), LUFS"""
    k = kweight(x); blk, hop = int(0.4 * SR), int(0.1 * SR)
    z = np.array([np.mean(k[i:i + blk] ** 2) for i in range(0, len(k) - blk, hop)])
    L = -0.691 + 10 * np.log10(z + 1e-15); z = z[L > -70]
    rel = -0.691 + 10 * np.log10(np.mean(z)) - 10
    z = z[(-0.691 + 10 * np.log10(z + 1e-15)) > rel]
    return float(-0.691 + 10 * np.log10(np.mean(z)))


def check(y, vo_path, vol=0.75, at0=0.12):
    """report: the score's K-weighted level against the voice's, over the frames where the voice speaks"""
    import soundfile as sf
    v, sr = sf.read(vo_path, always_2d=True); v = v.mean(1)
    hop = SR // 50; n = len(y) // hop
    vp = np.zeros(len(y)); s0 = int(at0 * SR); m = min(len(v), len(y) - s0); vp[s0:s0 + m] = v[:m]
    kv = kweight(vp)[:n * hop].reshape(n, hop); kb = kweight(y.mean(1) * vol)[:n * hop].reshape(n, hop)
    from scipy.ndimage import maximum_filter1d
    V = maximum_filter1d(10 * np.log10(np.mean(kv ** 2, 1) + 1e-12), size=13); Bd = 10 * np.log10(np.mean(kb ** 2, 1) + 1e-12)
    sp = V > -40
    gap = (V - Bd)[sp]
    return float(np.min(gap)), float(np.percentile(gap, 5)), float(np.median(gap))


if __name__ == "__main__":
    import soundfile as sf
    sec, out = float(sys.argv[1]), sys.argv[2]
    vo = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, "..", "assets", "vo.wav")
    mono = bs.build("pop", sec, None)
    y = np.stack([mono, mono], 1)
    y = duck(y, vo)
    y = np.tanh(y * 1.5) / np.tanh(1.5)                           # a soft limit, so the score carries the film
    y = 0.92 * y / (np.abs(y).max() + 1e-9)
    # set the score's own level 14 dB under the voice (both K-weighted, gated integrated loudness), so the ceiling below
    # only catches its peaks
    v, _ = sf.read(vo, always_2d=True)
    gap = loud(v.mean(1)) - loud(y.mean(1) * 0.75)
    y = y * 10 ** ((gap - 14.0) / 20)
    y, worst, share = ceiling(y, vo, margin=10.6)          # a little over 10 dB, so the check below never dips under 10
    y, worst2 = block_ceiling(y, vo, margin=10.6)          # and the same over 400 ms blocks (quiet word tails)
    print(f"block ceiling: deepest extra cut {worst2:.1f} dB")
    lo, p5, med = check(y, vo)
    sf.write(out, y.astype(np.float32), SR)
    print(f"{out}: {sec} s, pop (C major, 112 BPM); ceiling: deepest cut {worst:.1f} dB, active {100 * share:.0f}%; "
          f"voice over score while speaking: min {lo:.1f} dB, 5th pct {p5:.1f} dB, median {med:.1f} dB")
