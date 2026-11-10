"""Speak whole narration passages with OmniVoice (k2-fsa/OmniVoice, the engine behind VoiceStudio) in a
saved, consented voice from studio/voices/<name>/ (ref.wav + ref.txt). One pass per passage keeps the
prosody continuous; pacing comes from --speed or a per-passage target duration instead of time-stretching.

  python omni_tts.py --voices <studio/voices> --voice onkar halves.json out_dir [--speed 1.0] [--steps 32]
halves.json: [["name", "text", target_seconds_or_null], ...]
Needs the VoiceStudio source on PYTHONPATH (for the omnivoice package), torch, torchaudio, transformers, pydub.
Model weights: CC-BY-NC (non-commercial use).
"""
import argparse, json, os, sys, time
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--voices", required=True); ap.add_argument("--voice", required=True)
ap.add_argument("passages"); ap.add_argument("out")
ap.add_argument("--speed", type=float, default=1.0); ap.add_argument("--steps", type=int, default=32)
ap.add_argument("--seed", type=int, default=11); ap.add_argument("--threshold", type=float, default=45.0,
                help="only split a passage into chunks if it is longer than this many seconds")
a = ap.parse_args()

import torch
from omnivoice.models.omnivoice import OmniVoice
from omnivoice.utils.audio import save_audio  # noqa: E402

torch.set_num_threads(os.cpu_count() or 4)
vdir = Path(a.voices) / a.voice
ref, ref_text = str(vdir / "ref.wav"), (vdir / "ref.txt").read_text(encoding="utf-8").strip()
os.makedirs(a.out, exist_ok=True)
t0 = time.time()
model = OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map="cpu", dtype=torch.float32)
print(json.dumps({"loaded_s": round(time.time() - t0, 1)}), flush=True)
for name, text, target in json.load(open(a.passages, encoding="utf-8")):
    torch.manual_seed(a.seed)
    t1 = time.time()
    audio = model.generate(text=text, language="hi", ref_audio=ref, ref_text=ref_text, num_step=a.steps,
                           speed=a.speed, duration=target, audio_chunk_threshold=a.threshold, audio_chunk_duration=a.threshold)[0]
    save_audio(os.path.join(a.out, f"{name}.wav"), audio, model.sampling_rate)
    secs = (audio.shape[-1] if hasattr(audio, "shape") else len(audio)) / model.sampling_rate
    print(json.dumps({"passage": name, "audio_s": round(secs, 2), "gen_s": round(time.time() - t1, 1)}), flush=True)
