"""Day 11 (Hologram HUD) music: an original synth score on a grid, A minor, 112 BPM, stereo, synthesised in numpy.
Palette (STYLE.md §7): a saw arpeggio with ping-pong delay (scooped 1-4 kHz for the voice), a square pulse, an 8th bass,
synth hats and claps, detuned saw pads. Density follows the information (edit points from the caption overlay's LINES):
- light under the hook (pulse, pad, a thin arpeggio);
- the groove under the 1987 facts;
- ONE BEAT OF TRUE DIGITAL SILENCE before "did.", then the drop on "did." (808 glide + wide saw chord);
- half-time under the key idea (the put and the solver);
- a layer added per bar through the simulation, a lift on "smile.";
- a breakdown under "So here's the answer", the groove back on "Real returns have fat tails";
- a decelerating outro and a final chord.
The voice ducks it with a held envelope (no pumping between words).
usage: python3 tools/bed_hud.py <seconds> <out.wav> [ov.html] [vo.wav]"""
import importlib.util, json, os, re, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("bed_synth", os.path.join(HERE, "bed_synth.py"))
bs = importlib.util.module_from_spec(spec); spec.loader.exec_module(bs)
SR = bs.SR
BPM = 112.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
PROG = [(45, (57, 60, 64)), (41, (53, 57, 60)), (48, (55, 60, 64)), (43, (55, 59, 62))]   # Am F C G
ARP = [0, 1, 2, 1, 2, 0, 1, 2]                                                        # chord-tone indices, 8ths


def edit_points(ov_path, seconds):
    s = open(ov_path, encoding="utf-8").read()
    L = {x["id"]: x["on"] for x in json.loads(re.search(r"const LINES = (\[.*?\]); const CUTS", s, re.S).group(1))}
    return {"groove": L["L3"][0] - 0.3, "drop": L["L6a"][2], "half": L["L7a"][0] - 0.3, "build": L["L9a"][0] - 0.3,
            "lift": L["L11c"][11], "brk": L["L12a"][0] - 0.4, "full": L["L13"][0], "outro": L["L14a"][0] - 0.2,
            "end": seconds - 1.6}


def saw_st(m, dur, g, cut, detune=0.0):
    """a band-limited saw (additive), optional detune, through a gentle low-pass; returns mono"""
    n = int(dur * SR); t = np.arange(n) / SR; f0 = bs.hz(m) * (2 ** (detune / 1200))
    x = np.zeros(n)
    for k in range(1, int(min(cut * 1.5, 12000) / f0) + 1):
        x += np.sin(2 * np.pi * k * f0 * t) / k
    env = np.minimum(1, t / 0.006) * np.exp(-t / max(0.05, dur * 0.55))
    return bs.lp(x * env * g * 0.35, cut)


def pingpong(x, delay, fb=0.42, n_rep=4):
    """stereo ping-pong echo of a mono signal"""
    d = int(delay * SR); L = np.zeros(len(x) + d * (n_rep + 1)); R = np.zeros_like(L)
    L[:len(x)] += x; R[:len(x)] += x
    for k in range(1, n_rep + 1):
        tgt = R if k % 2 else L
        tgt[k * d:k * d + len(x)] += x * (fb ** k)
    return L, R


def glide808(m0, m1, dur, g):
    n = int(dur * SR); t = np.arange(n) / SR
    f = bs.hz(m0) + (bs.hz(m1) - bs.hz(m0)) * np.minimum(1, t / 0.18)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.25 * np.tanh(3 * np.sin(ph))
    return x * np.exp(-t / (dur * 0.5)) * np.minimum(1, t / 0.004) * g


def build(seconds, P):
    G0 = P["drop"] - np.floor(P["drop"] / BAR) * BAR            # bar lines land on the drop
    N = int((seconds + 3) * SR)
    Lb, Rb = np.zeros(N), np.zeros(N)

    def put(sig, at, g=1.0, pan=0.0):
        if at < 0:
            k = int(round(-at * SR))
            if k >= len(sig): return
            sig, at = sig[k:], 0.0
        i = int(at * SR); n = min(len(sig), N - i)
        if n <= 0: return
        Lb[i:i + n] += sig[:n] * g * (1 - max(0, pan)); Rb[i:i + n] += sig[:n] * g * (1 + min(0, pan))

    def put2(L, R, at, g=1.0):
        if at < 0:
            k = int(round(-at * SR))
            if k >= len(L): return
            L, R, at = L[k:], R[k:], 0.0
        i = int(at * SR); n = min(len(L), N - i)
        if n > 0: Lb[i:i + n] += L[:n] * g; Rb[i:i + n] += R[:n] * g

    def section(t0):
        if t0 < P["groove"]: return "light"
        if t0 < P["drop"]: return "groove"
        if t0 < P["half"]: return "groove"
        if t0 < P["build"]: return "half"
        if t0 < P["lift"]: return "build"
        if t0 < P["brk"]: return "groove"
        if t0 < P["full"]: return "break"
        if t0 < P["outro"]: return "groove"
        if t0 < P["end"]: return "outro"
        return "end"

    sil0, sil1 = P["drop"] - BEAT, P["drop"]                    # one beat of true digital silence before "did."
    b = -int(np.ceil(G0 / BAR))
    while G0 + b * BAR < seconds + BAR:
        t0 = G0 + b * BAR; root, chord = PROG[b % 4]; sec = section(t0 + 0.01)
        nb = max(0, int((t0 - P["build"]) / BAR)) if sec == "build" else 0
        if sec == "end":
            for j, m in enumerate(chord): put(saw_st(m, 3.4, 0.22, 2200, -7) + saw_st(m, 3.4, 0.22, 2200, 7), t0, 0.9, (j - 1) * 0.4)
            put(bs.sub(root - 12, 3.0, 0.3), t0)
            break
        # detuned saw pad, every section
        padg = {"light": 0.10, "groove": 0.08, "half": 0.11, "build": 0.09, "break": 0.13, "outro": 0.10}[sec]
        for j, m in enumerate(chord):
            put(saw_st(m, BAR + 0.25, padg, 1500, -9) + saw_st(m, BAR + 0.25, padg, 1500, 9), t0, 1.0, (j - 1) * 0.5)
        # 8th bass
        if sec in ("groove", "build") or (sec == "outro"):
            for k in range(8):
                if sec == "outro" and k % 2: continue
                put(bs.bassline(root - 12 + (12 if k % 4 == 3 else 0), BEAT / 2 * 0.85, 0.16), t0 + k * BEAT / 2)
        elif sec == "half":
            put(bs.bassline(root - 12, BEAT * 1.8, 0.15), t0); put(bs.bassline(root - 12, BEAT * 1.8, 0.13), t0 + 2 * BEAT)
        # drums
        for k in range(4):
            at = t0 + k * BEAT
            if sec == "groove" or (sec == "build" and nb >= 1):
                put(bs.kick(0.34 if k in (0, 2) else 0.0), at) if k in (0, 2) else None
                if k in (1, 3): put(bs.clap(0.26), at, 1.0, 0.1)
            elif sec == "half":
                if k == 0: put(bs.kick(0.32), at)
                if k == 2: put(bs.clap(0.24), at)
            elif sec == "light" and k == 0: put(bs.kick(0.18), at)
        for k in range(16):                                      # synth hats
            at = t0 + k * BEAT / 4
            if sec == "groove" or (sec == "build" and nb >= 2): put(bs.hat(0.16 if k % 2 else 0.07, 160), at, 1.0, 0.3)
            elif sec in ("half", "outro") and k % 4 == 2: put(bs.hat(0.12, 150), at, 1.0, 0.3)
        # square pulse: steady 8ths on the root, two octaves up, quiet
        if sec in ("light", "groove", "build", "half"):
            for k in range(8):
                put(bs.square(root + 24, BEAT / 2 * 0.5, 0.035 if sec != "light" else 0.045, 2600), t0 + k * BEAT / 2, 1.0, -0.2)
        # the saw arpeggio with ping-pong delay (scooped for the voice)
        if sec in ("light", "groove", "build", "outro") and not (sec == "build" and nb < 0):
            g_arp = {"light": 0.07, "groove": 0.09, "build": 0.06 + 0.012 * min(nb, 4), "outro": 0.06}[sec]
            step = 2 if sec == "outro" else 1
            for k in range(0, 8, step):
                m = chord[ARP[k]] + 12
                x = saw_st(m, BEAT / 2 * 0.9, g_arp, 3000)
                x = x - 0.6 * bs.bp(x, 1000, 4000)              # scoop the voice band
                L, R = pingpong(x, BEAT * 0.75, 0.38, 3)
                put2(L, R, t0 + k * BEAT / 2)
        b += 1
    # the drop on "did.": an 808 glide and a wide saw chord; the riser and impact on "smile."; a riser into "Real returns"
    put(glide808(57, 33, 1.6, 0.55), P["drop"])
    for j, m in enumerate((57, 60, 64, 69)):
        put(saw_st(m, 1.4, 0.2, 2600, -12) + saw_st(m, 1.4, 0.2, 2600, 12), P["drop"], 1.0, (j - 1.5) * 0.5)
    put(bs.impact(0.42), P["drop"])
    put(bs.riser(1.6, 0.30), P["lift"] - 1.6); put(bs.impact(0.36), P["lift"])
    rl = P["full"] - P["brk"]; put(bs.riser(rl, 0.28), P["brk"])
    # true digital silence: nothing at all for one beat before the drop
    i0, i1 = int(sil0 * SR), int(sil1 * SR)
    Lb[i0:i1] = 0.0; Rb[i0:i1] = 0.0
    wetL, wetR = bs.reverb(Lb, 1.6, 0.18), bs.reverb(Rb, 1.6, 0.18)
    mix = np.stack([wetL[:int(seconds * SR)], wetR[:int(seconds * SR)]], 1)
    mix[i0:i1] = 0.0
    f = int(1.2 * SR); mix[-f:] *= (np.linspace(1, 0, f) ** 1.5)[:, None]
    return 0.89 * mix / (np.abs(mix).max() + 1e-9), (i0, i1), G0


def duck(mix, vo_path, at0=0.12, depth=0.45):
    """a held ducking envelope from the voice: fast attack, a 0.6 s hold, slow release; no pumping between words"""
    import soundfile as sf
    v, sr = sf.read(vo_path, always_2d=True); v = v.mean(1)
    if sr != SR:
        import librosa
        v = librosa.resample(v, orig_sr=sr, target_sr=SR)
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
    """BS.1770 K-weighting at 48 kHz (high shelf + RLB high-pass), so the level check hears roughly as loudness does"""
    from scipy.signal import lfilter
    assert SR == 48000, SR
    x = lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585], x)
    return lfilter([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621], x)


def ceiling(y, vo_path, vol=0.75, at0=0.12, margin=10.0):
    """Keep the score at least `margin` dB under the voice wherever the voice speaks, as the two meet in the film (score
    at data-volume `vol`, voice at 1 from `at0`). Feed-forward on 20 ms K-weighted frames, against the voice's local
    peak level (max over +-120 ms, so it follows syllables, not every consonant); one frame of look-ahead, instant
    attack, 250 ms release. It only acts where the score would crowd the voice (the drop on "did.", the lift on
    "smile.", hot groove bars); the gaps between lines keep their level."""
    import soundfile as sf
    from scipy.ndimage import maximum_filter1d
    v, sr = sf.read(vo_path, always_2d=True); v = v.mean(1)
    if sr != SR:
        import librosa
        v = librosa.resample(v, orig_sr=sr, target_sr=SR)
    hop = SR // 50; n = len(y) // hop
    vp = np.zeros(len(y)); s0 = int(at0 * SR); m = min(len(v), len(y) - s0); vp[s0:s0 + m] = v[:m]

    def env(x):
        x = kweight(x)[:n * hop].reshape(n, hop)
        return 10 * np.log10(np.mean(x ** 2, 1) + 1e-12)

    V = maximum_filter1d(env(vp), size=13)
    B = env(y.mean(1) * vol)
    red = np.where(V > -40, np.minimum(0.0, (V - margin) - B), 0.0)
    red = np.minimum(red, np.roll(red, -1))                     # one frame of look-ahead
    g = np.zeros(n); e = 0.0; rel = np.exp(-1 / (0.25 * 50))
    for i in range(n):
        e = red[i] if red[i] < e else red[i] + (e - red[i]) * rel
        g[i] = e
    gain = np.ones(len(y)); gain[:n * hop] = 10 ** (np.repeat(g, hop) / 20)
    return y * gain[:, None], float(g.min()), float(np.mean(g < -0.5))


if __name__ == "__main__":
    import soundfile as sf
    sec, out = float(sys.argv[1]), sys.argv[2]
    ov = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, "..", "compositions", "ov.html")
    vo = sys.argv[4] if len(sys.argv) > 4 else os.path.join(HERE, "..", "assets", "vo.wav")
    P = edit_points(ov, sec)
    y, (i0, i1), g0 = build(sec, P)
    if os.path.exists(vo):
        y = duck(y, vo)
    y = np.tanh(y * 1.7) / np.tanh(1.7)                         # +4.6 dB with a soft limit, so the score carries the film
    y = 0.92 * y / (np.abs(y).max() + 1e-9)
    if os.path.exists(vo):                                      # the voice stays the loudest sound (bgm data-volume 0.75)
        y, worst, share = ceiling(y, vo)
        print(f"ceiling: deepest cut {worst:.1f} dB, active {100 * share:.0f}% of the film")
    y[i0:i1] = 0.0                                              # the beat of true digital silence stays true
    sf.write(out, y.astype(np.float32), SR)
    print(out, f"{sec}s, {BPM} BPM, grid origin {g0:.3f}s, silence {i0 / SR:.2f}-{i1 / SR:.2f}s, drop {P['drop']:.2f}s, lift {P['lift']:.2f}s")
