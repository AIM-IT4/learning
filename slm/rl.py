"""Practice with QuantLib as the judge: reinforcement learning on problems with checkable answers.

For each fresh problem the model writes several answers, using its tools as usual. An answer
whose final number is right scores 1, otherwise 0. Answers that beat their group's average
become more likely and the others less likely (a group-relative policy gradient, the core of
the method used for DeepSeek-R1). Tokens our tools wrote were not the model's choices, so they
are left out of the update. Problems come from quantgen's training split only.

    python rl.py --init runs/stage1 --out runs/stage1-rl --steps 100
    torchrun --standalone --nproc_per_node=2 rl.py --init RUN --out OUT --steps 400
"""
import argparse
import json
import os
import random
import shutil
import time
from contextlib import nullcontext

import numpy as np
import torch
import torch.distributed as dist
import torch.nn.functional as F

import quantgen
import solve


def get_args():
    p = argparse.ArgumentParser()
    p.add_argument("--init", required=True, help="folder with model.pt and tokenizer.json")
    p.add_argument("--out", required=True)
    p.add_argument("--steps", type=int, default=200)
    p.add_argument("--prompts", type=int, default=8, help="problems per step on each GPU")
    p.add_argument("--samples", type=int, default=8, help="answers written for each problem")
    p.add_argument("--temperature", type=float, default=1.0)
    p.add_argument("--lr", type=float, default=1e-5)
    p.add_argument("--max-new", type=int, default=700)
    p.add_argument("--micro", type=int, default=16, help="sequences per backward pass")
    p.add_argument("--minutes", type=float, default=0)
    p.add_argument("--seed", type=int, default=0)
    return p.parse_args()


def policy_loss(raw, tok, groups, ctx, micro, device, token_total):
    """Backward pass for one step's answers; returns the summed loss (for logging)."""
    seqs = []
    for prompt, results, rewards in groups:
        mean, std = float(np.mean(rewards)), float(np.std(rewards))
        if std < 1e-6:
            continue                                       # every answer equally good: nothing to learn
        for r, reward in zip(results, rewards):
            ids = prompt + r["ids"]
            mask = [0] * len(prompt) + [0 if tool else 1 for tool in r["from_tool"]]
            seqs.append((ids, mask, (reward - mean) / (std + 1e-4)))
    total = 0.0
    for i in range(0, len(seqs), micro):
        chunk = seqs[i:i + micro]
        L = max(len(s[0]) for s in chunk)
        ids = torch.full((len(chunk), L), tok.token_to_id("<|eos|>"), dtype=torch.long)
        mask = torch.zeros((len(chunk), L))
        for j, (s_ids, s_mask, _) in enumerate(chunk):
            ids[j, :len(s_ids)] = torch.tensor(s_ids)
            mask[j, :len(s_mask)] = torch.tensor(s_mask, dtype=torch.float)
        adv = torch.tensor([s[2] for s in chunk], device=device)
        ids, mask = ids.to(device), mask.to(device)
        with ctx:
            logits, _ = raw(ids[:, :-1], targets=ids[:, 1:])
        logp = torch.log_softmax(logits.float(), dim=-1).gather(-1, ids[:, 1:, None]).squeeze(-1)
        loss = -(adv[:, None] * logp * mask[:, 1:]).sum() / token_total
        loss.backward()
        total += float(loss.detach())
    return total, len(seqs)


def main():
    a = get_args()
    ddp = int(os.environ.get("WORLD_SIZE", "1")) > 1
    if ddp:
        dist.init_process_group("nccl")
        rank, world = dist.get_rank(), dist.get_world_size()
        torch.cuda.set_device(int(os.environ["LOCAL_RANK"]))
        device = f"cuda:{int(os.environ['LOCAL_RANK'])}"
    else:
        rank, world = 0, 1
        device = "cuda" if torch.cuda.is_available() else "cpu"
    master = rank == 0
    on_gpu = device.startswith("cuda")
    dtype = (torch.bfloat16 if torch.cuda.get_device_capability()[0] >= 8 else torch.float16) if on_gpu else torch.float32
    ctx = torch.autocast("cuda", dtype=dtype) if on_gpu else nullcontext()
    raw, tok = solve.load(a.init, device)
    opt = torch.optim.AdamW(raw.parameters(), lr=a.lr, betas=(0.9, 0.95), weight_decay=0.0)
    scaler = torch.amp.GradScaler("cuda", enabled=dtype == torch.float16) if on_gpu else None
    os.makedirs(a.out, exist_ok=True)
    log = open(os.path.join(a.out, "rl_log.jsonl"), "a") if master else None
    R = random.Random(a.seed * 1000 + rank)
    t_start = time.time()
    for step in range(1, a.steps + 1):
        if a.minutes and (time.time() - t_start) / 60 >= a.minutes:
            break
        t0 = time.time()
        raw.eval()
        groups, rewards_all, errors, lengths = [], [], 0, []
        for _ in range(a.prompts):
            prob = quantgen.problem(R, "train")
            with ctx:
                res = solve.generate_batch(raw, tok, [prob["question"]] * a.samples, max_new=a.max_new,
                                           temperature=a.temperature, device=device, seed=R.randrange(1 << 30))
            rewards = [1.0 if solve.correct(r["answer"], prob["answer"]) else 0.0 for r in res]
            groups.append((tok.encode(f"Q: {prob['question']}\nA:").ids, res, rewards))
            rewards_all += rewards
            errors += sum(1 for r in res if r["error"])
            lengths += [len(r["ids"]) for r in res]
        raw.train()
        tokens = torch.tensor([sum(sum(0 if t else 1 for t in r["from_tool"]) for _, res, rw in groups
                                   if np.std(rw) > 1e-6 for r in res)], dtype=torch.float, device=device)
        if ddp:
            dist.all_reduce(tokens)
        token_total = max(1.0, float(tokens))
        opt.zero_grad(set_to_none=False)
        for p in raw.parameters():
            if p.grad is None:
                p.grad = torch.zeros_like(p)
        # with fp16 loss scaling, dividing by a smaller total is the same as scaling the loss up
        norm = token_total / (scaler.get_scale() if scaler else 1.0)
        loss, used = policy_loss(raw, tok, groups, ctx, a.micro, device, norm)
        if ddp:
            for p in raw.parameters():
                dist.all_reduce(p.grad)
        if scaler:
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(raw.parameters(), 1.0)
            scaler.step(opt)
            scaler.update()
        else:
            torch.nn.utils.clip_grad_norm_(raw.parameters(), 1.0)
            opt.step()
        stats = torch.tensor([sum(rewards_all), len(rewards_all), errors, used], dtype=torch.float, device=device)
        if ddp:
            dist.all_reduce(stats)
        if master:
            rec = {"step": step, "reward": round(float(stats[0] / stats[1]), 4), "bad_tool_calls": int(stats[2]),
                   "answers_used": int(stats[3]), "mean_len": round(float(np.mean(lengths)), 1),
                   "sec": round(time.time() - t0, 1)}
            print(json.dumps(rec), flush=True)
            log.write(json.dumps(rec) + "\n")
            log.flush()
    if master:
        torch.save({"model": raw.state_dict(), "cfg": raw.config_dict()}, os.path.join(a.out, "model.pt"))
        shutil.copy(os.path.join(a.init, "tokenizer.json"), a.out)
        print("saved", a.out, flush=True)
    if ddp:
        dist.destroy_process_group()


if __name__ == "__main__":
    main()
