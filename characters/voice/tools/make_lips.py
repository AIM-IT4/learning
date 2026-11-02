"""Per-speaker mouth openings at 60 fps from the voice parts -> reel/lips.js.
Each line's part sits where vo.wav puts it (cumulative part durations + gap) plus the reel offset; RMS in 32 ms
windows, dB mapped to 0..1 per speaker, fast attack / slower release, and a 30 ms lead so the mouth opens before the sound."""
import sys, os, wave, array, json, math, glob
PARTS, GAP, OFF = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
who = [l.strip() for l in open('speakers.txt') if l.strip()]
FPS, SR = 60, 48000
parts = sorted(glob.glob(f'{PARTS}/[0-9][0-9].wav'))
t, segs = OFF, []
for k, p in enumerate(parts):
    with wave.open(p) as w: d = array.array('h', w.readframes(w.getnframes()))
    segs.append((t, who[k], d)); t += len(d) / SR + GAP
dur = t + 3
N = int(dur * FPS) + 1
env = {s: [0.0] * N for s in set(who)}
win = int(.032 * SR)
for t0, s, d in segs:
    for f in range(int(t0 * FPS), int((t0 + len(d) / SR) * FPS) + 2):
        c = int((f / FPS - t0 + .03) * SR)            # 30 ms lead
        a, b = max(0, c - win // 2), min(len(d), c + win // 2)
        if b <= a: continue
        rms = math.sqrt(sum(x * x for x in d[a:b]) / (b - a)) / 32768
        db = 20 * math.log10(rms + 1e-9)
        if 0 <= f < N: env[s][f] = max(env[s][f], min(1.0, max(0.0, (db + 40) / 31)))
out = {}
for s, e in env.items():
    y, o = 0.0, []
    for v in e:
        y = y + (v - y) * (.75 if v > y else .35)       # attack / release per frame
        o.append(round(y, 3))
    out[s] = o
open(os.path.join('..', 'reel', 'lips.js'), 'w').write('window.LIPS = ' + json.dumps(dict(fps=FPS, **out)) + ';\n')
print('lips', {s: len(v) for s, v in out.items()}, 'dur', round(dur, 2))
