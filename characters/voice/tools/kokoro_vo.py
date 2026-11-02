"""FEMALE voice for the cast (C, E, G): Kokoro-82M (hexgrad, Apache-2.0, runs locally on CPU), voice af_heart.

usage: PY kokoro_vo.py <takes_dir> [lines_file] [voice=af_heart] [speed=1.0] [only_lines, e.g. 0,6,9]
One take per line of lines_file -> <takes_dir>/NN.wav (24 kHz); with only_lines, just those (0-based) lines, so a
dialogue can mix voices: female lines here, male lines with chatterbox_vo.py, into the same takes_dir.
Write initialisms with dots so they are spelled out (A.I., P and L), and brand names as spoken (Desk to Quant).

Install (Python 3.13 needs the pin override and binary spaCy wheels):
  pip install --ignore-requires-python --only-binary=spacy,thinc,blis,cymem,preshed,murmurhash,srsly "kokoro==0.9.4" "misaki[en]==0.9.4" soundfile
First run downloads the model (~330 MB) and spaCy's en_core_web_sm (~13 MB).
"""
import os, sys
import numpy as np, soundfile as sf
from kokoro import KPipeline

OUT = sys.argv[1]
LINES = sys.argv[2] if len(sys.argv) > 2 else "tts_lines.txt"
VOICE = sys.argv[3] if len(sys.argv) > 3 else "af_heart"
SPEED = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
ONLY = {int(x) for x in sys.argv[5].split(",")} if len(sys.argv) > 5 and sys.argv[5] else None
os.makedirs(OUT, exist_ok=True)
pipe = KPipeline(lang_code="a" if VOICE.startswith("a") else "b", repo_id="hexgrad/Kokoro-82M")
for k, line in enumerate(l.strip() for l in open(LINES) if l.strip()):
    if ONLY is not None and k not in ONLY: continue
    audio = [r.audio.numpy() if hasattr(r.audio, "numpy") else np.asarray(r.audio) for r in pipe(line, voice=VOICE, speed=SPEED)]
    sf.write(f"{OUT}/{k:02d}.wav", np.concatenate(audio), 24000)
    print(f"{k:02d}", VOICE, line, flush=True)
