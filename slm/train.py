"""Train our GPT from random weights. Runs on a laptop CPU, one GPU, or several GPUs.

    python train.py --data data/quant --preset 15m --minutes 180 --out runs/proto
    torchrun --standalone --nproc_per_node=2 train.py --data DATA --preset 100m \\
        --tokens 2e9 --minutes 690 --out /kaggle/working/run --resume-from PREV/ckpt.pt
    python train.py --synthetic --preset 100m --minutes 3 --out runs/speed   # speed test

Long runs are split into sessions: --minutes stops a session cleanly, a checkpoint is
saved every --save-every-min minutes, and --resume / --resume-from continue the same
learning-rate schedule in the next session.
"""
import argparse
import json
import math
import os
import time
from contextlib import nullcontext

import numpy as np
import torch
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

from model import GPT, PRESETS, Config


def get_args():
    p = argparse.ArgumentParser()
    p.add_argument("--data", help="folder with train.bin, val.bin (uint16 tokens) and meta.json")
    p.add_argument("--synthetic", action="store_true", help="random tokens, for speed tests")
    p.add_argument("--vocab", type=int, default=16384, help="vocabulary size with --synthetic")
    p.add_argument("--out", default="runs/run")
    p.add_argument("--preset", default="15m", choices=sorted(PRESETS))
    p.add_argument("--seq", type=int, default=1024)
    p.add_argument("--micro-batch", type=int, default=8)
    p.add_argument("--grad-accum", type=int, default=4)
    p.add_argument("--lr", type=float, default=6e-4)
    p.add_argument("--min-lr-frac", type=float, default=0.1)
    p.add_argument("--warmup", type=int, default=500)
    p.add_argument("--tokens", type=float, default=0, help="total training tokens; sets the schedule length")
    p.add_argument("--max-steps", type=int, default=0)
    p.add_argument("--minutes", type=float, default=0, help="end this session after this many minutes")
    p.add_argument("--eval-every", type=int, default=250)
    p.add_argument("--eval-batches", type=int, default=20)
    p.add_argument("--save-every-min", type=float, default=30)
    p.add_argument("--log-every", type=int, default=10)
    p.add_argument("--resume", action="store_true", help="continue from OUT/ckpt.pt if it exists")
    p.add_argument("--resume-from", help="continue from this checkpoint file (e.g. a previous session's output)")
    p.add_argument("--compile", action="store_true", help="torch.compile the model (GPU)")
    p.add_argument("--seed", type=int, default=1337)
    return p.parse_args()


def load_checkpoint(path, device):
    try:
        return torch.load(path, map_location=device, weights_only=True)
    except TypeError:                                    # older PyTorch without weights_only
        return torch.load(path, map_location=device)


def make_optimizer(model, lr, on_gpu):
    params = [p for p in model.parameters() if p.requires_grad]
    groups = [{"params": [p for p in params if p.dim() >= 2], "weight_decay": 0.1},
              {"params": [p for p in params if p.dim() < 2], "weight_decay": 0.0}]
    try:
        return torch.optim.AdamW(groups, lr=lr, betas=(0.9, 0.95), eps=1e-8, fused=on_gpu)
    except (TypeError, RuntimeError):
        return torch.optim.AdamW(groups, lr=lr, betas=(0.9, 0.95), eps=1e-8)


def make_scaler(enabled, device_type):
    try:
        return torch.amp.GradScaler(device_type, enabled=enabled)
    except (AttributeError, TypeError):                  # PyTorch before 2.3
        return torch.cuda.amp.GradScaler(enabled=enabled)


def main():
    a = get_args()
    ddp = int(os.environ.get("WORLD_SIZE", "1")) > 1
    if ddp:
        dist.init_process_group("nccl")
        rank, world = dist.get_rank(), dist.get_world_size()
        local = int(os.environ["LOCAL_RANK"])
        torch.cuda.set_device(local)
        device = f"cuda:{local}"
    else:
        rank, world = 0, 1
        device = "cuda" if torch.cuda.is_available() else "cpu"
    master = rank == 0
    on_gpu = device.startswith("cuda")
    os.makedirs(a.out, exist_ok=True)

    # Precision: bf16 on newer GPUs, fp16 with loss scaling on older ones (T4, P100), fp32 on CPU.
    if on_gpu:
        dtype = torch.bfloat16 if torch.cuda.get_device_capability()[0] >= 8 else torch.float16
        ctx = torch.autocast("cuda", dtype=dtype)
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True
    else:
        dtype, ctx = torch.float32, nullcontext()
    scaler = make_scaler(dtype == torch.float16, "cuda" if on_gpu else "cpu")

    # Data: random windows from one long token stream, or random tokens for speed tests.
    if a.synthetic:
        vocab, arrays = a.vocab, None
    else:
        with open(os.path.join(a.data, "meta.json")) as f:
            vocab = json.load(f)["vocab_size"]
        arrays = {s: np.memmap(os.path.join(a.data, f"{s}.bin"), dtype=np.uint16, mode="r") for s in ("train", "val")}

    def get_batch(split, gen):
        if arrays is None:
            t = torch.randint(0, vocab, (a.micro_batch, a.seq + 1), generator=gen)
        else:
            data = arrays[split]
            ix = torch.randint(0, len(data) - a.seq - 1, (a.micro_batch,), generator=gen).tolist()
            t = torch.from_numpy(np.stack([data[i:i + a.seq + 1] for i in ix]).astype(np.int64))
        x, y = t[:, :-1].contiguous(), t[:, 1:].contiguous()
        if on_gpu:
            return x.pin_memory().to(device, non_blocking=True), y.pin_memory().to(device, non_blocking=True)
        return x, y

    cfg = Config(vocab_size=vocab, max_seq=a.seq, **PRESETS[a.preset])
    raw = GPT(cfg).to(device)
    opt = make_optimizer(raw, a.lr, on_gpu)
    step, tokens_seen, elapsed_before = 0, 0, 0.0
    start = a.resume_from or (os.path.join(a.out, "ckpt.pt") if a.resume else None)
    if start and os.path.exists(start):
        ck = load_checkpoint(start, device)
        raw.load_state_dict(ck["model"])
        opt.load_state_dict(ck["opt"])
        if ck.get("scaler"):
            scaler.load_state_dict(ck["scaler"])
        step, tokens_seen, elapsed_before = ck["step"], ck["tokens"], ck["elapsed"]
        if master:
            print(f"resumed from {start} at step {step} ({tokens_seen / 1e6:.0f}M tokens)", flush=True)
    model = torch.compile(raw) if a.compile else raw
    if ddp:
        model = DDP(model, device_ids=[local])

    tokens_per_step = a.micro_batch * a.grad_accum * a.seq * world
    total_steps = a.max_steps or (int(a.tokens // tokens_per_step) if a.tokens else 0)

    def lr_at(s):
        if s < a.warmup:
            return a.lr * (s + 1) / a.warmup
        if not total_steps:
            return a.lr
        frac = min(1.0, (s - a.warmup) / max(1, total_steps - a.warmup))
        return a.lr * (a.min_lr_frac + (1 - a.min_lr_frac) * 0.5 * (1 + math.cos(math.pi * frac)))

    @torch.no_grad()
    def evaluate():
        raw.eval()
        g = torch.Generator().manual_seed(999)
        losses = []
        for _ in range(a.eval_batches):
            x, y = get_batch("val", g)
            with ctx:
                losses.append(raw(x, y)[1].item())
        raw.train()
        return float(np.mean(losses))

    def save(name="ckpt.pt"):
        path = os.path.join(a.out, name)
        torch.save({"model": raw.state_dict(), "opt": opt.state_dict(), "scaler": scaler.state_dict(),
                    "step": step, "tokens": tokens_seen, "elapsed": elapsed_before + time.time() - t_session,
                    "cfg": raw.config_dict(), "args": vars(a)}, path + ".tmp")
        os.replace(path + ".tmp", path)

    if master:
        print(json.dumps({"params": raw.num_params(), "non_embedding": raw.num_params(False), "device": device,
                          "world": world, "dtype": str(dtype), "tokens_per_step": tokens_per_step,
                          "total_steps": total_steps, "compile": a.compile}), flush=True)
    log = open(os.path.join(a.out, "log.jsonl"), "a") if master else None
    gen = torch.Generator().manual_seed(a.seed + 1000 * rank + step)
    t_session = last_save = time.time()
    step_times = []
    model.train()
    while not (total_steps and step >= total_steps):
        if a.minutes and (time.time() - t_session) / 60 >= a.minutes:
            break
        lr = lr_at(step)
        for group in opt.param_groups:
            group["lr"] = lr
        t0 = time.time()
        for micro in range(a.grad_accum):
            x, y = get_batch("train", gen)
            if ddp:
                model.require_backward_grad_sync = micro == a.grad_accum - 1
            with ctx:
                loss = model(x, y)[1] / a.grad_accum
            scaler.scale(loss).backward()
        scaler.unscale_(opt)
        gnorm = torch.nn.utils.clip_grad_norm_(raw.parameters(), 1.0)
        scaler.step(opt)
        scaler.update()
        opt.zero_grad(set_to_none=True)
        if on_gpu:
            torch.cuda.synchronize()
        dt = time.time() - t0
        step += 1
        tokens_seen += tokens_per_step
        step_times.append(dt)
        if master and step % a.log_every == 0:
            rec = {"step": step, "loss": round(loss.item() * a.grad_accum, 4), "lr": round(lr, 7),
                   "gnorm": round(float(gnorm), 3), "tok_s": round(tokens_per_step / dt),
                   "tokens_m": round(tokens_seen / 1e6, 2), "min": round((time.time() - t_session) / 60, 2)}
            if arrays is not None and a.eval_every and step % a.eval_every == 0:
                rec["val_loss"] = round(evaluate(), 4)
            print(json.dumps(rec), flush=True)
            log.write(json.dumps(rec) + "\n")
            log.flush()
        if master and arrays is not None and (time.time() - last_save) / 60 >= a.save_every_min:
            save()
            last_save = time.time()

    if master:
        summary = {"steps": step, "tokens": tokens_seen, "session_min": round((time.time() - t_session) / 60, 2),
                   "params": raw.num_params(), "preset": a.preset, "world": world, "micro_batch": a.micro_batch,
                   "seq": a.seq, "compile": a.compile, "dtype": str(dtype), "device": device}
        steady = step_times[5:] if len(step_times) > 8 else step_times[1:]   # skip warm-up and compilation
        if steady:
            med = float(np.median(steady))
            summary.update(median_step_s=round(med, 4), tok_s=round(tokens_per_step / med))
        if on_gpu:
            summary.update(gpu=torch.cuda.get_device_name(), peak_mem_gb=round(torch.cuda.max_memory_allocated() / 1e9, 2))
        if arrays is not None:
            summary["val_loss"] = round(evaluate(), 4)
            save()
            torch.save({"model": raw.state_dict(), "cfg": raw.config_dict()}, os.path.join(a.out, "model.pt"))
        with open(os.path.join(a.out, "summary.json"), "w") as f:
            json.dump(summary, f, indent=1)
        print("summary", json.dumps(summary), flush=True)
    if ddp:
        dist.destroy_process_group()


if __name__ == "__main__":
    main()
