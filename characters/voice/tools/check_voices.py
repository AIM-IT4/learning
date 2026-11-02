"""Guard against miscast voices: median pitch of every voiced line vs the speaking character's gender.

usage: python3 check_voices.py <parts_dir> [speakers_file=speakers.txt]
<parts_dir>/NN.wav is one line per file (as assemble_vo.py writes them); speakers_file has one cast letter per line.
Female lines should sit around 170-255 Hz median, male lines around 85-160 Hz. Exits non-zero on a mismatch.
"""
import sys, glob, torch, torchaudio as ta

GENDER = {'A': 'male', 'B': 'male', 'C': 'female', 'D': 'male', 'E': 'female', 'F': 'male', 'G': 'female'}
parts = sorted(glob.glob(f'{sys.argv[1]}/[0-9][0-9].wav'))
who = [l.strip() for l in open(sys.argv[2] if len(sys.argv) > 2 else 'speakers.txt') if l.strip()]
bad = 0
for k, p in enumerate(parts):
    w, sr = ta.load(p); f0 = ta.functional.detect_pitch_frequency(ta.functional.resample(w.mean(0, keepdim=True), sr, 16000), 16000)
    v = f0[(f0 > 60) & (f0 < 450)]; m = float(v.median()) if v.numel() else 0.0
    g = GENDER.get(who[k], '?'); ok = (m >= 170) if g == "female" else (m <= 160) if g == "male" else True
    bad += not ok
    print(f'{k:02d} {who[k]} {g:6s} median f0 {m:5.0f} Hz  {"ok" if ok else "MISCAST: wrong-gender voice"}')
sys.exit(1 if bad else 0)
