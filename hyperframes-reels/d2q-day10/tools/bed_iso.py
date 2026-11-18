"""Day 10 isometric-world music bed: an original bright electro-pop groove, F major, 116 BPM (synthesised, no samples).
usage: python3 tools/bed_iso.py <seconds> <out.wav> [ov.html]
Marimba arpeggios, an octave-bouncing bass, claps on 2 and 4, a soft shaker, a little pluck melody every other bar.
The edit points come from the caption overlay's LINES (build_iso/compositions/ov.html): lighter under the set-up and the
curve, a breakdown and riser under "So here's the answer", the drop on "Gamma earns", a hit on "...you win.", a final chord.
Uses the instrument helpers of hyperframes-reels/tools/bed_synth.py."""
import importlib.util, json, os, re, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
for cand in (os.path.join(HERE, "bed_synth.py"), os.path.join(HERE, "..", "..", "tools", "bed_synth.py"),
             "/home/user/learning/hyperframes-reels/tools/bed_synth.py"):
    if os.path.exists(cand):
        spec = importlib.util.spec_from_file_location("bed_synth", cand); bs = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(bs); break
else:
    raise SystemExit("bed_synth.py not found")

SR = bs.SR
BPM = 116.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
PROG = [(41, (65, 69, 72)), (48, (64, 67, 72)), (50, (62, 65, 69)), (46, (62, 65, 70))]   # F  C  Dm  Bb
MOTIF = [0, 2, 1, 2, 0, 1, 2, 1]                                                          # chord-tone indices, 8ths
LEAD = [(0, 2, 0.5), (1.5, 1, 0.5), (2, 0, 1.0), (3.5, 2, 0.5)]                           # (beat, chord tone, beats)


def edit_points(ov_path, seconds):
    s = open(ov_path, encoding="utf-8").read()
    L = {x["id"]: x["on"] for x in json.loads(re.search(r"const LINES = (\[.*?\]); const CUTS", s, re.S).group(1))}
    return {"drop": L["L22"][0], "hit": L["L23"][-1], "mid1": L["L3a"][0] - 0.4, "full2": L["L5"][0] - 0.4,
            "mid2": L["L9"][0] - 0.4, "full3": L["L12a"][0] - 0.4, "brk": L["L21"][0] - 0.6, "half": L["L23"][0] - 0.3,
            "end": seconds - 1.4}


def build(seconds, P):
    G0 = P["drop"] - np.floor(P["drop"] / BAR) * BAR          # bar lines land on the drop
    def energy(t0):
        if t0 < 0.5: return "mid"
        if t0 < P["mid1"]: return "full"
        if t0 < P["full2"]: return "mid"
        if t0 < P["mid2"]: return "full"
        if t0 < P["full3"]: return "mid"
        if t0 < min(P["brk"], P["drop"] - BAR) - 0.01: return "full"
        if t0 < P["drop"] - 0.01: return "break"
        if t0 < P["half"]: return "full"
        if t0 < P["hit"]: return "half"
        if t0 < P["end"]: return "full"
        return "end"
    N = int((seconds + 2) * SR); dry = np.zeros(N); wet = np.zeros(N)
    def put(buf, s, at, g=1.0):
        if at < 0:
            k = int(round(-at * SR))
            if k >= len(s): return
            s, at = s[k:], 0.0
        bs.place(buf, s, at, g)
    b = -1
    while G0 + b * BAR < seconds:
        t0 = G0 + b * BAR; root, chord = PROG[b % 4]; e = energy(t0)
        if e == "end":
            put(dry, bs.kick(0.36), t0); put(wet, bs.pad(chord, 2.6, 0.13, 3200), t0); put(dry, bs.sub(root - 12, 2.4, 0.15), t0)
            for j, m in enumerate(chord): put(wet, bs.marimba(m + 12, 1.6, 0.12), t0 + 0.03 * j)
            break
        put(wet, bs.pad(chord, BAR + 0.3, 0.07 if e != "break" else 0.12, 3200), t0)       # bright, unpumped
        for k in range(8):                                                               # octave-bouncing bass
            if e in ("full", "mid"):
                m = root - 12 + (12 if k % 2 else 0)
                put(dry, bs.bassline(m, BEAT / 2 * 0.8, 0.15 if e == "full" else 0.11), t0 + k * BEAT / 2)
            elif e == "half" and k % 4 == 0:
                put(dry, bs.bassline(root - 12, BEAT * 1.6, 0.13), t0 + k * BEAT / 2)
        for k in range(4):
            at = t0 + k * BEAT
            if e == "full": put(dry, bs.kick(0.34 if k in (0, 2) else 0.26), at)
            if e == "mid" and k in (0, 2): put(dry, bs.kick(0.28), at)
            if e == "half" and k == 0: put(dry, bs.kick(0.32), at)
            if e in ("full", "mid") and k in (1, 3): put(wet, bs.clap(0.30 if e == "full" else 0.2), at)
        if e == "full": put(dry, bs.kick(0.2), t0 + 3.5 * BEAT)                         # the bouncy pickup
        for k in range(16):                                                              # soft shaker
            at = t0 + k * BEAT / 4
            if e == "full": put(dry, bs.hat(0.22 if k % 2 else 0.1, 140), at)
            elif e in ("mid", "half") and k % 2: put(dry, bs.hat(0.14, 150), at)
        for k, idx in enumerate(MOTIF):                                                  # marimba arpeggio, 8ths
            if e == "break" and k % 2: continue
            g = {"full": 0.15, "mid": 0.11, "half": 0.09, "break": 0.12}[e]
            put(wet, bs.marimba(chord[idx] + 12, 0.5, g), t0 + k * BEAT / 2)
        if e == "full" and b % 2 == 1:                                                   # pluck melody every other bar
            for beat, idx, ln in LEAD:
                put(wet, bs.pluck(chord[idx] + 24, ln * BEAT, 0.08, 0.7), t0 + beat * BEAT)
        b += 1
    rl = P["drop"] - min(P["brk"], P["drop"] - BAR)
    put(dry, bs.riser(rl, 0.42), P["drop"] - rl)
    put(dry, bs.impact(0.42), P["drop"])
    put(dry, bs.riser(0.9, 0.34), P["hit"] - 0.9)
    put(dry, bs.impact(0.45), P["hit"])
    mix = dry + bs.reverb(wet)
    mix = mix[: int(seconds * SR)]
    f = int(1.0 * SR); mix[-f:] *= np.linspace(1, 0, f) ** 1.5
    return 0.89 * mix / (np.abs(mix).max() + 1e-9), G0


if __name__ == "__main__":
    import soundfile as sf
    sec, out = float(sys.argv[1]), sys.argv[2]
    ov = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, "..", "build_iso", "compositions", "ov.html")
    P = edit_points(ov, sec)
    y, g0 = build(sec, P)
    sf.write(out, y.astype(np.float32), SR)
    print(out, f"{sec}s, {BPM} BPM, grid origin {g0:.3f}s, drop {P['drop']:.2f}s, hit {P['hit']:.2f}s")
