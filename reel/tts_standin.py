"""Stand-in voiceover from an open-source neural voice (Kokoro), running on the CPU.

Used when the ElevenLabs "Pradeep" voice isn't available. Each scene's line is
spoken separately and joined with a short pause, so scene changes fall on
clean gaps that build.py can find.

    python tts_standin.py --model kokoro-v1.0.onnx --voices voices-v1.0.bin --out build/voice.mp3
    python tts_standin.py --model ... --voices ... --list      # show available voices

Needs: pip install kokoro-onnx, plus the two model files from
https://github.com/thewh1teagle/kokoro-onnx/releases (tag model-files-v1.0), and ffmpeg.
"""
import argparse
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import narration_lines  # noqa: E402

# How a few words should be *said*. The captions keep the real spelling.
SAY = {
    r"\bCDN\b": "C D N",
    r"\bDjango\b": "Jango",
    r"\bMemcached\b": "Mem-cashed",
    r"\bPostgres\b": "Post-gres",
    r"\bkilometres\b": "kilometers",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--voices", required=True)
    ap.add_argument("--voice", default="am_michael")
    ap.add_argument("--speed", type=float, default=1.08)
    ap.add_argument("--gap", type=float, default=0.42, help="seconds of silence between scenes")
    ap.add_argument("--out", default="build/voice.mp3")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()

    from kokoro_onnx import Kokoro
    kokoro = Kokoro(a.model, a.voices)
    if a.list:
        print(" ".join(sorted(kokoro.get_voices())))
        return

    sr, pieces = 24000, []
    for line in narration_lines():
        text = line
        for pattern, spoken in SAY.items():
            text = re.sub(pattern, spoken, text)
        samples, sr = kokoro.create(text, voice=a.voice, speed=a.speed, lang="en-us")
        pieces += [np.asarray(samples, dtype=np.float32), np.zeros(int(a.gap * sr), np.float32)]
    audio = np.concatenate([np.zeros(int(0.2 * sr), np.float32), *pieces[:-1], np.zeros(int(0.3 * sr), np.float32)])
    audio = audio / max(1e-6, float(np.abs(audio).max())) * 0.89

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    wav = out.with_suffix(".wav")
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((audio * 32767).astype(np.int16).tobytes())
    if out.suffix == ".mp3":
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-b:a", "160k", str(out)], check=True)
    print(f"wrote {out}: {len(audio) / sr:.1f}s, voice {a.voice}, speed {a.speed}")


if __name__ == "__main__":
    main()
