"""MALE voice for the cast (A, B, D, F): Chatterbox (Resemble AI, MIT licence, runs locally on CPU), matched to the
Desk2Quant FX reel's narration.

usage: python3 chatterbox_vo.py <takes_dir> [lines_file] [seed] [only_lines, e.g. 1,2,3]
One take per line of lines_file -> <takes_dir>/NN.wav (24 kHz); with only_lines, just those (0-based) lines, so a
dialogue can mix voices: male lines here, female lines with kokoro_vo.py, into the same takes_dir. The voice
reference is 11.5 s of the FX reel's own narration (Gemini Charon, its lines 3-4: ../refs/male_ref_03.wav, _04.wav). Initialisms
are written solid (DM, PDF, CV): spaced letters ("D M") make TTS engines pause between them. Then run
tools/assemble_vo.py <takes_dir> and tools/align_words.py, which aligns against tts_lines.txt (letters spaced).
"""
import os, sys, subprocess, tempfile, torch, torchaudio as ta

OUT = sys.argv[1]
LINES = sys.argv[2] if len(sys.argv) > 2 else "tts_lines_chatterbox.txt"
SEED = int(sys.argv[3]) if len(sys.argv) > 3 else 7
FX = os.environ.get("FX_PARTS", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "refs"))
ONLY = {int(x) for x in sys.argv[4].split(",")} if len(sys.argv) > 4 and sys.argv[4] else None
os.makedirs(OUT, exist_ok=True)
ref = os.path.join(tempfile.mkdtemp(), "ref.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{FX}/male_ref_03.wav", "-i", f"{FX}/male_ref_04.wav", "-filter_complex",
                "[0]aresample=24000,apad=pad_dur=0.25[a];[1]aresample=24000[b];[a][b]concat=n=2:v=0:a=1", "-ac", "1", ref], check=True)
torch.set_num_threads(os.cpu_count() or 4)
from chatterbox.tts import ChatterboxTTS
m = ChatterboxTTS.from_pretrained(device="cuda" if torch.cuda.is_available() else "cpu")
m.prepare_conditionals(ref, exaggeration=0.45)
for k, line in enumerate(l.strip() for l in open(LINES) if l.strip()):
    if ONLY is not None and k not in ONLY: continue
    torch.manual_seed(SEED)
    w = m.generate(line, exaggeration=0.45, cfg_weight=0.5)
    ta.save(f"{OUT}/{k:02d}.wav", w, m.sr)
    print(f"{k:02d}", line, flush=True)
