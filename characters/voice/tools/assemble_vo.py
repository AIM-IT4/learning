"""Assemble per-line voice takes into the reel's voice track.

usage: python3 tools/assemble_vo.py <takes_dir> [gap_s] [tempo] [out_dir]
  <takes_dir>/NN.wav (or .mp3), one take per script line, any rate.
Writes <out_dir>/vo-raw.wav.parts/NN.wav (trimmed, 48 kHz mono) and
<out_dir>/vo.wav = parts joined by gap_s of silence, which is the
layout build.py reconstructs (LS = cumulative part durations + GAP).
Trim keeps soft edges so word onsets and final consonants are never cut.
"""
import sys, os, glob, subprocess, wave, array

src = sys.argv[1]
GAP = float(sys.argv[2]) if len(sys.argv) > 2 else 0.30
TEMPO = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
OUT = sys.argv[4] if len(sys.argv) > 4 else "assets/voice"
PARTS = f"{OUT}/vo-raw.wav.parts"
os.makedirs(PARTS, exist_ok=True)
for f in glob.glob(f"{PARTS}/*.wav"): os.remove(f)
SR = 48000

def load(p):
    with wave.open(p) as w: return array.array("h", w.readframes(w.getnframes()))

takes = sorted(glob.glob(f"{src}/[0-9][0-9].wav") + glob.glob(f"{src}/[0-9][0-9].mp3"))
out = array.array("h")
for k, t in enumerate(takes):
    tmp = f"{PARTS}/_tmp.wav"
    af = f"atempo={TEMPO}," if abs(TEMPO - 1) > 1e-6 else ""
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", t, "-af", f"{af}aresample={SR}", "-ac", "1", "-sample_fmt", "s16", tmp], check=True)
    d = load(tmp); os.remove(tmp)
    peak = max(abs(x) for x in d) or 1
    thr = peak * 10 ** (-38 / 20)          # -38 dBFS relative to the take's peak
    hot = [i for i, x in enumerate(d) if abs(x) > thr]
    a = max(hot[0] - int(0.06 * SR), 0)
    b = min(hot[-1] + int(0.14 * SR), len(d))
    seg = d[a:b]
    n = len(seg); fi, fo = int(0.01 * SR), int(0.04 * SR)
    for i in range(min(fi, n)): seg[i] = int(seg[i] * i / fi)
    for i in range(min(fo, n)): seg[n - 1 - i] = int(seg[n - 1 - i] * i / fo)
    with wave.open(f"{PARTS}/{k:02d}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(seg.tobytes())
    out.extend(seg)
    if k < len(takes) - 1: out.extend(array.array("h", [0]) * int(round(GAP * SR)))
    print(f"{k:02d} {len(seg)/SR:6.2f}s  <- {os.path.basename(t)}")
with wave.open(f"{OUT}/vo.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print(f"vo.wav {len(out)/SR:.2f}s  gap {GAP}  tempo {TEMPO}")
