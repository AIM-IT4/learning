"""Three music beds with MusicGen-small (local, CPU): python3 gen.py <out_dir>"""
import sys, time, torch, numpy as np, soundfile as sf
from huggingface_hub import snapshot_download
from transformers import AutoProcessor, MusicgenForConditionalGeneration
out = sys.argv[1]; torch.set_num_threads(4); torch.manual_seed(7)
p = snapshot_download("facebook/musicgen-small", allow_patterns=["*.json", "model.safetensors", "spiece.model", "tokenizer*"])
proc = AutoProcessor.from_pretrained(p); model = MusicgenForConditionalGeneration.from_pretrained(p).eval()
sr = model.config.audio_encoder.sampling_rate
jobs = [("chai", "warm cheerful Indian acoustic groove, light tabla and sitar, soft hand percussion, cozy morning kitchen, major key, 96 bpm", 28),
        ("compound", "calm confident cinematic underscore, soft strings and warm piano, gentle steady pulse slowly building to a hopeful lift, 92 bpm", 28),
        ("kinetic", "punchy modern electronic beat, tight kick and claps, bold sub bass, bright synth stabs, energetic and playful, 120 bpm", 24)]
for name, prompt, secs in jobs:
    t = time.time()
    inputs = proc(text=[prompt], padding=True, return_tensors="pt")
    with torch.no_grad():
        audio = model.generate(**inputs, max_new_tokens=int(secs * 50), do_sample=True, guidance_scale=3.0)
    a = audio[0, 0].numpy().astype(np.float32); a = a / max(1e-6, np.abs(a).max()) * 0.89
    sf.write(f"{out}/{name}.wav", a, sr); print(name, f"{len(a) / sr:.1f} s in {time.time() - t:.0f} s", flush=True)
print("done", flush=True)
