"""Stage 1 on Kaggle: generate our practice problems, train our tokenizer, then train the
15M-parameter prototype on both GPUs. Built into a self-contained script kernel by
build_kernel.py, which fills in CODE with our source files.

Output (in /kaggle/working/run): model.pt, tokenizer.json, meta.json, log.jsonl,
summary.json and the test sets, ready to download and grade with solve.py.
"""
import base64
import glob
import os
import shutil
import subprocess
import sys

CODE = {}
WORK = os.environ.get("SLM_WORK", "/kaggle/working")
PROBLEMS = os.environ.get("SLM_PROBLEMS", "600000")
TOKENS = os.environ.get("SLM_TOKENS", "4e8")
SEQ = os.environ.get("SLM_SEQ", "1024")
MINUTES = os.environ.get("SLM_MINUTES", "80")

os.makedirs(f"{WORK}/slm", exist_ok=True)
for name, b64 in CODE.items():
    with open(f"{WORK}/slm/{name}", "wb") as f:
        f.write(base64.b64decode(b64))
os.chdir(f"{WORK}/slm")


def sh(cmd):
    print("$", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


try:
    import QuantLib  # noqa: F401
except ImportError:
    try:
        sh([sys.executable, "-m", "pip", "install", "-q", "QuantLib==1.44"])
    except subprocess.CalledProcessError:
        sh([sys.executable, "-m", "pip", "install", "-q", "QuantLib"])
try:
    import tokenizers  # noqa: F401
except ImportError:
    sh([sys.executable, "-m", "pip", "install", "-q", "tokenizers"])

import torch  # noqa: E402

gpus = torch.cuda.device_count()
print("GPUs:", [torch.cuda.get_device_name(i) for i in range(gpus)], flush=True)
data, run = f"{WORK}/data", f"{WORK}/run"
sh([sys.executable, "prepare.py", "--out", data, "--problems", PROBLEMS, "--test", "500", "--workers", str(os.cpu_count())])
train = ["train.py", "--data", data, "--preset", "15m", "--seq", SEQ, "--micro-batch", "32", "--grad-accum", "1",
         "--lr", "1.5e-3", "--warmup", "300", "--tokens", TOKENS, "--minutes", MINUTES, "--eval-every", "200",
         "--log-every", "50", "--save-every-min", "15", "--out", run] + (["--compile"] if gpus else [])
if gpus > 1:
    sh([sys.executable, "-m", "torch.distributed.run", "--standalone", f"--nproc_per_node={gpus}"] + train)
else:
    sh([sys.executable] + train)

for path in [f"{data}/tokenizer.json", f"{data}/meta.json"] + glob.glob(f"{data}/test_*.jsonl"):
    shutil.copy(path, run)
for path in glob.glob(f"{data}/*.bin") + [f"{run}/ckpt.pt"]:   # keep the download small
    if os.path.exists(path):
        os.remove(path)
print("DONE", sorted(os.listdir(run)), flush=True)
