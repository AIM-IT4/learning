"""One model load, several seeds per line (same settings as studio/tools/voice_clone.py).
usage: seeds.py <voice_dir> lines.json out_dir seed [seed ...]"""
import json, os, sys, time
import soundfile as sf, torch
from transformers import AutoModel, AutoProcessor
vdir, lines, out, seeds = sys.argv[1], sys.argv[2], sys.argv[3], [int(s) for s in sys.argv[4:]]
ref, ref_text = os.path.join(vdir, "ref.wav"), open(os.path.join(vdir, "ref.txt"), encoding="utf-8").read().strip()
os.makedirs(out, exist_ok=True); torch.set_num_threads(os.cpu_count() or 4)
MODEL = os.environ.get("AUDIO8_MODEL", "/root/.cache/audio8/model")
t0 = time.time()
processor = AutoProcessor.from_pretrained(MODEL, trust_remote_code=True)
model = AutoModel.from_pretrained(MODEL, trust_remote_code=True, dtype=torch.float32).eval()
print(json.dumps({"loaded_s": round(time.time() - t0, 1)}), flush=True)
for name, text in json.load(open(lines, encoding="utf-8")):
    for seed in seeds:
        torch.manual_seed(seed)
        inputs = processor(text=[text], reference_audio=[ref], reference_text=[ref_text], return_tensors="pt")
        t1 = time.time()
        with torch.inference_mode():
            o = model.generate(**inputs, max_new_tokens=1024, temperature=0.8, top_p=0.95, top_k=50, do_sample=True, return_dict_in_generate=True)
            wav, lens = model.decode_audio(o.codes)
        audio = wav[0, : int(lens[0])].float().cpu().numpy(); sr = model.config.codec_sample_rate
        sf.write(os.path.join(out, f"{name}_s{seed}.wav"), audio, sr)
        print(json.dumps({"line": name, "seed": seed, "audio_s": round(len(audio) / sr, 2), "gen_s": round(time.time() - t1, 1)}), flush=True)
