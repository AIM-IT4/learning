"""Benchmark on Kaggle's GPUs: our models against existing small open models, same questions.

build_kernel.py fills in CODE (our source files) and CONFIG:
    {"gpu0": ["ours:run/model.pt", "hf:..."], "gpu1": ["hf:..."], "n": 200, "gsm": 300}
"ours:" entries name a model.pt from an earlier kernel (kernel_sources); the test sets come
from the Stage 2 data kernel. Each GPU runs its own list in parallel; results are merged
into /kaggle/working/bench.json.
"""
import base64
import glob
import json
import os
import subprocess
import sys

CODE = {}
CONFIG = {}
WORK = os.environ.get("SLM_WORK", "/kaggle/working")
INPUT = os.environ.get("SLM_INPUT", "/kaggle/input")

os.makedirs(f"{WORK}/slm", exist_ok=True)
for name, b64 in CODE.items():
    with open(f"{WORK}/slm/{name}", "wb") as f:
        f.write(base64.b64decode(b64))
os.chdir(f"{WORK}/slm")


def sh(cmd, env=None):
    print("$", " ".join(cmd), flush=True)
    return subprocess.Popen(cmd, env=env)


for module, package in [("QuantLib", "QuantLib==1.44"), ("tokenizers", "tokenizers"), ("transformers", "transformers"),
                        ("datasets", "datasets")]:
    try:
        __import__(module)
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", package], check=True)


def find(rel):
    hits = sorted(glob.glob(os.path.join(INPUT, "**", rel), recursive=True), key=len)
    return hits[0] if hits else None


tests = ",".join(sorted({os.path.dirname(p) for p in glob.glob(os.path.join(INPUT, "**", "test_quant_level1.jsonl"),
                                                            recursive=True)}))
print("test sets from:", tests, flush=True)
procs, outs = [], []
for gpu, key in enumerate(["gpu0", "gpu1"]):
    models = []
    for spec in CONFIG.get(key, []):
        if spec.startswith("ours:"):
            path = find(spec[5:])
            if path is None:
                print("skipping missing model", spec, flush=True)
                continue
            models += ["--model", "ours:" + os.path.dirname(path)]
        else:
            models += ["--model", spec]
    if not models:
        continue
    out = f"{WORK}/bench_{key}.json"
    outs.append(out)
    env = dict(os.environ, CUDA_VISIBLE_DEVICES=str(gpu))
    procs.append(sh([sys.executable, "bench.py", *models, "--tests", tests, "--n", str(CONFIG["n"]),
                     "--gsm", str(CONFIG["gsm"]), "--out", out], env=env))
codes = [p.wait() for p in procs]
merged = {}
for out in outs:
    if os.path.exists(out):
        with open(out) as f:
            merged.update(json.load(f))
with open(f"{WORK}/bench.json", "w") as f:
    json.dump(merged, f, indent=1, ensure_ascii=False)
print("DONE exit codes", codes, "models", list(merged), flush=True)
