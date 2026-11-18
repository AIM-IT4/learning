"""The v3 music bed: an original 129 BPM electronic pulse in A minor, synthesised (no samples), shaped to the edit.
usage: python3 tools/bed129.py <seconds> <out.wav> [ov.html]
The edit points come from the caption overlay's LINES (build/compositions/ov.html, written by tools/timing.py), so the
bed follows any re-timed voice. The bar grid is anchored so a bar line lands on "Desk2Quant" (the drop after the riser).
Energy: groove from frame 1, lighter under the notebook explanation, a breakdown and riser into the product reveal,
full groove through the product, lighter on "Don't know where to start?", a half-time build into the hit on "breaks",
groove back for the CTA, a final chord.
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
BPM = 129.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
PROG = [(45, (57, 60, 64)), (41, (57, 60, 65)), (48, (60, 64, 67)), (43, (59, 62, 67))]   # Am F C G


def edit_points(ov_path, seconds):
    s = open(ov_path, encoding="utf-8").read()
    L = {x["id"]: x["on"] for x in json.loads(re.search(r"const LINES = (\[.*?\]); const CUTS", s, re.S).group(1))}
    return {"drop": L["L8a"][0],                    # "Desk2Quant"
            "breaks": L["L14"][5],                  # "breaks"
            "mid1": L["L4"][0] - 0.4,               # the notebook explanation
            "full2": L["L6"][0] - 0.4,              # "Everyone memorises formulas."
            "mid2": L["L12a"][0] - 0.4,             # "Don't know where to start?"
            "full3": L["L12b"][0] - 0.4,            # "10 resources are free."
            "half": L["L13"][0] - 0.4,              # textbooks / the desk
            "end": seconds - 1.4}


def build(seconds, P):
    G0 = P["drop"] - np.floor(P["drop"] / BAR) * BAR       # bar lines land on the drop
    def energy(t0):
        if t0 < 0.5: return "mid"                           # pickup into the hook
        if t0 < P["mid1"]: return "full"
        if t0 < P["full2"]: return "mid"
        if t0 < P["drop"] - BAR - 0.01: return "full"
        if t0 < P["drop"] - 0.01: return "break"            # one bar of breakdown + riser into the reveal
        if t0 < P["mid2"]: return "full"
        if t0 < P["full3"]: return "mid"
        if t0 < P["half"]: return "full"
        if t0 < P["breaks"]: return "half"
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
            put(dry, bs.kick(0.42), t0); put(dry, bs.impact(0.5), t0)
            put(wet, bs.pad(chord, 2.6, 0.14, 2600), t0); put(dry, bs.sub(root - 12, 2.4, 0.16), t0)
            break
        # the pad pumps on every beat (sidechain feel); a half-time bar pumps on 1 and 3 only
        p = bs.pad(chord, BAR + 0.3, 0.12 if e != "break" else 0.15, 2600); tp = np.arange(len(p)) / SR
        pump = BEAT * (2 if e == "half" else 1)
        if e != "break": p = p * (1 - 0.6 * np.exp(-((tp % pump) / 0.11)))
        put(wet, p, t0)
        for k in range(8):                                         # 8th-note bass, off in the breakdown
            if e in ("full", "mid"): put(dry, bs.bassline(root, BEAT / 2 * 0.9, 0.17 if e == "full" else 0.13), t0 + k * BEAT / 2)
            if e == "half" and k % 2 == 0: put(dry, bs.bassline(root, BEAT * 0.9, 0.14), t0 + k * BEAT / 2)
        for k in range(4):
            at = t0 + k * BEAT
            if e in ("full", "mid"): put(dry, bs.kick(0.40 if e == "full" else 0.32), at)
            if e == "half" and k in (0, 2): put(dry, bs.kick(0.36), at)
            if e == "full" and k in (1, 3): put(wet, bs.clap(0.34), at)
            if e == "half" and k == 2: put(wet, bs.clap(0.26), at)
        for k in range(16):                                        # 16th hats with an open-ish offbeat
            at = t0 + k * BEAT / 4
            if e == "full": put(dry, bs.hat(0.5 if k % 4 == 2 else 0.17, 80 if k % 4 == 2 else 110), at)
            elif e == "mid" and k % 2 == 0: put(dry, bs.hat(0.36 if k % 4 == 2 else 0.12, 100), at)
            elif e == "half" and k % 4 == 2: put(dry, bs.hat(0.3, 90), at)
        arp = [0, 1, 2, 1]
        for k in range(16):                                        # plucked arp, brighter when full
            if e == "break" and k % 2: continue
            m = chord[arp[k % 4]] + (12 if (k // 4) % 2 else 0) + 12
            put(wet, bs.pluck(m, 0.28, {"full": 0.085, "mid": 0.06, "half": 0.05, "break": 0.07}[e]), t0 + k * BEAT / 4)
        b += 1
    # risers and hits shaped to the edit
    put(dry, bs.riser(BAR, 0.5), P["drop"] - BAR)
    put(dry, bs.impact(0.5), P["drop"])
    put(dry, bs.riser(1.0, 0.42), P["breaks"] - 1.0)
    put(dry, bs.impact(0.55), P["breaks"])
    root, chord = PROG[0]; put(wet, bs.pad(chord, 1.2, 0.13, 2600), P["breaks"])
    mix = dry + bs.reverb(wet)
    mix = mix[: int(seconds * SR)]
    f = int(1.0 * SR); mix[-f:] *= np.linspace(1, 0, f) ** 1.5
    return 0.89 * mix / (np.abs(mix).max() + 1e-9), G0


if __name__ == "__main__":
    import soundfile as sf
    sec, out = float(sys.argv[1]), sys.argv[2]
    ov = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, "..", "build", "compositions", "ov.html")
    P = edit_points(ov, sec)
    y, g0 = build(sec, P)
    sf.write(out, y.astype(np.float32), SR)
    print(out, f"{sec}s, {BPM} BPM, grid origin {g0:.3f}s, drop {P['drop']:.2f}s, hit {P['breaks']:.2f}s")
