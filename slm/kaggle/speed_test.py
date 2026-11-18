"""Kaggle speed test for our GPT: how many training tokens per second on Kaggle's GPUs?

Built into a self-contained script kernel by build_kernel.py, which fills in CODE with our
model.py and train.py. Runs several short trainings on random tokens and writes
speed_results.json:
  1 GPU, plain PyTorch, micro-batch 8
  1 GPU, torch.compile, micro-batch 8, then 16
  all GPUs with DDP, using the fastest single-GPU setting that worked
"""
import base64
import json
import os
import subprocess
import sys
import time

CODE = {}
WORK = os.environ.get("SLM_WORK", "/kaggle/working")
PRESET = os.environ.get("SLM_PRESET", "100m")
SCALE = float(os.environ.get("SLM_SCALE", "1"))          # shrink the run times for a local dry run

os.makedirs(f"{WORK}/slm", exist_ok=True)
for name, b64 in CODE.items():
    with open(f"{WORK}/slm/{name}", "wb") as f:
        f.write(base64.b64decode(b64))
os.chdir(f"{WORK}/slm")

import torch  # noqa: E402

n_gpu = torch.cuda.device_count()
info = {"torch": torch.__version__, "cuda": torch.version.cuda,
        "gpus": [torch.cuda.get_device_name(i) for i in range(n_gpu)], "preset": PRESET}
print(json.dumps(info), flush=True)
results = {"info": info, "runs": {}}


def run(name, gpus, extra, minutes):
    out = f"{WORK}/speed/{name}"
    args = ["train.py", "--synthetic", "--preset", PRESET, "--seq", "1024", "--grad-accum", "4",
            "--log-every", "5", "--out", out, "--minutes", str(minutes * SCALE)] + extra
    if gpus > 1:
        cmd = [sys.executable, "-m", "torch.distributed.run", "--standalone", f"--nproc_per_node={gpus}"] + args
    else:
        cmd = [sys.executable] + args
    env = dict(os.environ, CUDA_VISIBLE_DEVICES=",".join(str(i) for i in range(max(gpus, 1))))
    t0 = time.time()
    p = subprocess.run(cmd, env=env, capture_output=True, text=True)
    summary = None
    if os.path.exists(f"{out}/summary.json"):
        with open(f"{out}/summary.json") as f:
            summary = json.load(f)
    log = p.stdout + p.stderr
    results["runs"][name] = {"ok": p.returncode == 0 and bool(summary and summary.get("tok_s")),
                             "summary": summary, "wall_s": round(time.time() - t0),
                             "log_tail": log[-2500:] if p.returncode else log[-400:]}
    print(name, "ok" if results["runs"][name]["ok"] else "FAILED", json.dumps(summary), flush=True)
    if p.returncode:
        print(log[-2500:], flush=True)
    with open(f"{WORK}/speed_results.json", "w") as f:
        json.dump(results, f, indent=1)


run("1gpu_eager_mb8", 1, ["--micro-batch", "8"], 2)
run("1gpu_compile_mb8", 1, ["--micro-batch", "8", "--compile"], 4)
run("1gpu_compile_mb16", 1, ["--micro-batch", "16", "--compile"], 4)

ok = [(v["summary"]["tok_s"], k) for k, v in results["runs"].items() if v["ok"]]
if n_gpu >= 2 and ok:
    best = max(ok)[1]
    extra = ["--micro-batch", "16" if best.endswith("mb16") else "8"] + (["--compile"] if "compile" in best else [])
    run(f"{n_gpu}gpu_ddp_" + best.split("_", 1)[1], n_gpu, extra, 4)

ok = {k: v["summary"]["tok_s"] for k, v in results["runs"].items() if v["ok"]}
results["best"] = max(ok.items(), key=lambda kv: kv[1]) if ok else None
with open(f"{WORK}/speed_results.json", "w") as f:
    json.dump(results, f, indent=1)
print("BEST", json.dumps(results["best"]), flush=True)
