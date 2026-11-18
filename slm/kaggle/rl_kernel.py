"""Practice with QuantLib as the judge, on Kaggle's GPUs. Built by build_kernel.py, which fills
in CODE (our source files) and CONFIG: {"init": "run/model.pt", "steps": 200, "lr": 2e-5,
"prompts": 8, "samples": 8, "minutes": 45}. The starting model comes from an earlier kernel
(kernel_sources). Output in /kaggle/working/run-rl: model.pt, tokenizer.json, rl_log.jsonl.
"""
import base64
import glob
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


def sh(cmd):
    print("$", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


for module, package in [("QuantLib", "QuantLib==1.44"), ("tokenizers", "tokenizers")]:
    try:
        __import__(module)
    except ImportError:
        sh([sys.executable, "-m", "pip", "install", "-q", package])

import torch  # noqa: E402

hits = sorted(glob.glob(os.path.join(INPUT, "**", CONFIG["init"]), recursive=True), key=len)
assert hits, f"missing {CONFIG['init']} in the inputs"
init = os.path.dirname(hits[0])
gpus = torch.cuda.device_count()
args = ["rl.py", "--init", init, "--out", f"{WORK}/run-rl", "--steps", str(CONFIG["steps"]), "--lr", str(CONFIG["lr"]),
        "--prompts", str(CONFIG["prompts"]), "--samples", str(CONFIG["samples"]), "--minutes", str(CONFIG["minutes"])]
launcher = [sys.executable, "-m", "torch.distributed.run", "--standalone", f"--nproc_per_node={gpus}"] if gpus > 1 else [sys.executable]
sh(launcher + args)
print("DONE", sorted(os.listdir(f"{WORK}/run-rl")), flush=True)
