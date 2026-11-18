"""The v3 music bed: an original 129 BPM electronic pulse in A minor, synthesised (no samples), shaped to the edit.
usage: python3 tools/bed129.py <seconds> <out.wav>
The bar grid is anchored so a bar line lands on "Desk2Quant" (the drop after the riser); "pressure" falls on a beat.
Energy: groove from frame 1, lighter under the notebook explanation, a breakdown and riser into the product reveal,
full groove through the product, a half-time build into the hit on "breaks", groove back for the CTA, a final chord.
Uses the instrument helpers of hyperframes-reels/tools/bed_synth.py."""
import importlib.util, os, sys
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
DROP = 17.66            # "Desk2Quant"
BREAKS = 34.70          # "breaks": the hit
CTA = 35.60             # the call to action starts
G0 = DROP - 9 * BAR     # bar 0 starts here; bar -1 is a pickup that starts before the film
PROG = [(45, (57, 60, 64)), (41, (57, 60, 65)), (48, (60, 64, 67)), (43, (59, 62, 67))]   # Am F C G


def energy(b):
    t0 = G0 + b * BAR
    if t0 < 0.5: return "mid"                     # pickup into the hook
    if t0 < 6.4: return "full"                    # the hook and the interview line
    if t0 < 12.0: return "mid"                    # the notebook explanation: leave room for the numbers
    if t0 < 15.7: return "full"
    if t0 < DROP - 0.01: return "break"           # breakdown + riser into the reveal
    if t0 < 28.7: return "full"                   # the product: drop
    if t0 < 30.6: return "mid"                    # "Don't know where to start?"
    if t0 < 32.4: return "full"                   # "10 resources are free"
    if t0 < BREAKS: return "half"                 # textbooks / the desk: half-time build
    if t0 < 38.0: return "full"                   # after the hit: the CTA
    return "end"


def build(seconds):
    N = int((seconds + 2) * SR); dry = np.zeros(N); wet = np.zeros(N)
    def put(buf, s, at, g=1.0):
        if at < 0:
            k = int(round(-at * SR))
            if k >= len(s): return
            s, at = s[k:], 0.0
        bs.place(buf, s, at, g)
    b = -1
    while G0 + b * BAR < seconds:
        t0 = G0 + b * BAR; root, chord = PROG[b % 4]; e = energy(b)
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
    put(dry, bs.riser(DROP - (G0 + 8 * BAR), 0.5), G0 + 8 * BAR)
    put(dry, bs.impact(0.5), DROP)
    put(dry, bs.riser(1.0, 0.42), BREAKS - 1.0)
    put(dry, bs.impact(0.55), BREAKS)
    root, chord = PROG[0]; put(wet, bs.pad(chord, 1.2, 0.13, 2600), BREAKS)
    mix = dry + bs.reverb(wet)
    mix = mix[: int(seconds * SR)]
    f = int(1.0 * SR); mix[-f:] *= np.linspace(1, 0, f) ** 1.5
    return 0.89 * mix / (np.abs(mix).max() + 1e-9)


if __name__ == "__main__":
    import soundfile as sf
    sec, out = float(sys.argv[1]), sys.argv[2]
    sf.write(out, build(sec).astype(np.float32), SR)
    print(out, f"{sec}s, {BPM} BPM, grid origin {G0:.3f}s, beat {BEAT:.4f}s")
