"""VoxCPM2 batch generator (CPU). One model load, many takes.
usage: python vox_gen.py jobs.json
jobs.json: {"model": "~/vox2", "threads": 4, "jobs": [
  {"out": "a.wav", "text": "...", "voice": "(description)", "seed": 1},             # designed voice
  {"out": "b.wav", "text": "...", "ref": "ref.wav", "seed": 2},                       # same timbre as ref.wav
  {"out": "c.wav", "text": "...", "ref": "ref.wav", "prompt_wav": "p.wav", "prompt_text": "...", "seed": 3}]}
Jobs whose "out" already exists are skipped, so a run can be resumed."""
import json, os, sys, time, types, importlib.machinery
import numpy as np, soundfile as sf, torch
try:
    import torchaudio  # noqa: F401
except Exception:  # torchaudio is not needed by VoxCPM2 and has no build for this torch
    m = types.ModuleType("torchaudio"); m.__spec__ = importlib.machinery.ModuleSpec("torchaudio", None)
    sys.modules["torchaudio"] = m
from voxcpm import VoxCPM

spec = json.load(open(sys.argv[1]))
torch.set_num_threads(int(spec.get("threads", 4)))
model = VoxCPM(voxcpm_model_path=os.path.expanduser(spec.get("model", "~/vox2")), enable_denoiser=False,
               optimize=False, device="cpu")
sr = model.tts_model.sample_rate
for j in spec["jobs"]:
    if os.path.exists(j["out"]):
        print("skip", j["out"]); continue
    torch.manual_seed(int(j.get("seed", 0))); np.random.seed(int(j.get("seed", 0)))
    kw = dict(cfg_value=float(j.get("cfg", 2.0)), inference_timesteps=int(j.get("steps", 10)), normalize=False)
    text = (j.get("voice", "") + j["text"]) if not j.get("ref") else j["text"]
    if j.get("ref"): kw["reference_wav_path"] = j["ref"]
    if j.get("prompt_wav"): kw["prompt_wav_path"], kw["prompt_text"] = j["prompt_wav"], j["prompt_text"]
    t0 = time.time(); wav = model.generate(text=text, **kw); dt = time.time() - t0
    os.makedirs(os.path.dirname(os.path.abspath(j["out"])), exist_ok=True)
    sf.write(j["out"], wav, sr)
    print(f"{j['out']}  {len(wav)/sr:.2f}s audio in {dt:.0f}s ({dt/(len(wav)/sr):.1f}x)", flush=True)
print("ALL_DONE")
