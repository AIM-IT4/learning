"""Speech check: transcribe a film's mix (faster-whisper small, English) and print it by segment.
usage: python3 tools/stt_en.py <video or audio>"""
import sys, subprocess, numpy as np
from faster_whisper import WhisperModel
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", sys.argv[1], "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
audio = np.frombuffer(raw, dtype=np.float32)
m = WhisperModel("small", device="cpu", compute_type="int8")
segs, info = m.transcribe(audio, language="en", vad_filter=True)
for s in segs: print(f"{s.start:5.1f}-{s.end:5.1f} {s.text.strip()}")
