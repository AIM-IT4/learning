"""Stage 2 training on Kaggle's GPUs, one session at a time (a session stops after 12 hours).

build_kernel.py fills in CODE (our source files) and CONFIG, which lists this session's steps:
    {"steps": [{"name": "read", "data": "data2/read", "lr": 6e-4, "warmup": 1000, "minutes": 680,
                "resume": "run/ckpt.pt" or None, "init": None, "out": "run"}, ...],
     "eval": false}
Inputs come from earlier kernels (kernel_sources): the data kernel, and from the second
session on, the previous session's output, so "resume" finds its checkpoint there.
"""
import base64
import glob
import json
import os
import shutil
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


def find(rel):
    """A file or folder from this session, or from an earlier kernel under the input folder."""
    if os.path.exists(os.path.join(WORK, rel)):
        return os.path.join(WORK, rel)
    hits = sorted(glob.glob(os.path.join(INPUT, "**", rel), recursive=True), key=len)
    return hits[0] if hits else None


for module, package in [("QuantLib", "QuantLib==1.44"), ("tokenizers", "tokenizers")]:
    try:
        __import__(module)
    except ImportError:
        sh([sys.executable, "-m", "pip", "install", "-q", package])

import torch  # noqa: E402

gpus = torch.cuda.device_count()
print("GPUs:", [torch.cuda.get_device_name(i) for i in range(gpus)], "| inputs:", os.listdir(INPUT) if os.path.isdir(INPUT) else [],
      flush=True)
tokenizer = find("data2/tokenizer.json")
assert tokenizer, "the Stage 2 data kernel's output is missing"

completed = True
for st in CONFIG["steps"]:
    data = find(st["data"])
    assert data, f"missing data folder {st['data']}"
    with open(os.path.join(data, "meta.json")) as f:
        counts = json.load(f)["counts"]
    tokens = counts["english"] + counts["problems_read"] if st["name"] == "read" else counts["problems_practice"]
    out = os.path.join(WORK, st["out"])
    args = ["train.py", "--data", data, "--preset", st.get("preset", "100m"), "--seq", "1024", "--micro-batch", "8",
            "--grad-accum", str(st.get("grad_accum", 8)), "--lr", str(st["lr"]), "--warmup", str(st["warmup"]),
            "--tokens", str(tokens), "--minutes", str(st["minutes"]), "--eval-every", "500", "--eval-batches", "40",
            "--log-every", "50", "--save-every-min", "30", "--out", out, "--compile"]
    if st.get("resume"):
        ckpt = find(st["resume"])
        assert ckpt, f"missing checkpoint {st['resume']}"
        args += ["--resume-from", ckpt]
    if st.get("init"):
        weights = find(st["init"])
        assert weights, f"missing weights {st['init']}"
        args += ["--init-from", weights]
    launcher = [sys.executable, "-m", "torch.distributed.run", "--standalone", f"--nproc_per_node={gpus}"] if gpus > 1 else [sys.executable]
    sh(launcher + args)
    shutil.copy(tokenizer, out)
    with open(os.path.join(out, "summary.json")) as f:
        summary = json.load(f)
    finished = summary["tokens"] >= tokens - 2 * 8 * 1024 * 8 * max(gpus, 1)
    print(f"step {st['name']}: {summary['tokens'] / 1e9:.2f}B of {tokens / 1e9:.2f}B tokens, finished={finished}", flush=True)
    if not finished:
        completed = False
        break                                    # the next session resumes from out/ckpt.pt
    ckpt = os.path.join(out, "ckpt.pt")
    if os.path.exists(ckpt):
        os.remove(ckpt)                          # finished: keep only the weights

if CONFIG.get("eval") and not completed:
    print("not every step finished, so the tests wait for the next session", flush=True)
elif CONFIG.get("eval"):
    final = os.path.join(WORK, CONFIG["steps"][-1]["out"])
    tests = os.path.dirname(find("data2/test_quant_level1.jsonl"))
    sh([sys.executable, "solve.py", "--run", final, "--eval", tests, "--n", "500", "--out", os.path.join(final, "eval.json")])
print("DONE", {d: sorted(os.listdir(os.path.join(WORK, d))) for d in os.listdir(WORK) if d.startswith("run")}, flush=True)
