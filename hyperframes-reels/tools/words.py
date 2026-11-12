"""Word timings of a voiceover take (faster-whisper large-v3-turbo on the file): python3 words.py take.mp3 [lang]"""
import sys, json, numpy as np, librosa
from faster_whisper import WhisperModel
f = sys.argv[1]; lang = sys.argv[2] if len(sys.argv) > 2 else "hi"
y, _ = librosa.load(f, sr=16000, mono=True)
m = WhisperModel("mobiuslabsgmbh/faster-whisper-large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=4)
segs, _ = m.transcribe(y.astype(np.float32), language=lang, word_timestamps=True, condition_on_previous_text=False, beam_size=5)
words = [[w.word.strip(), round(w.start, 2), round(w.end, 2)] for s in segs for w in (s.words or []) if w.word.strip()]
json.dump(words, open(f.rsplit(".", 1)[0] + ".words.json", "w", encoding="utf-8"), ensure_ascii=False)
print(len(y) / 16000, "s"); print(" ".join(f"{w}@{s}" for w, s, e in words))
