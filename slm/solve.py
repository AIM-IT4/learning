"""Ask our model a question, or grade it on the test sets, with its tools running live.

    python solve.py --run runs/stage1 --ask "Price a 6-month European call ..."
    python solve.py --run runs/stage1 --eval data/stage1 --n 200 --workers 4

While the model writes, every complete tool call (`<<expr=`) is run by tools.run_tool and
the result is fed back token by token, exactly as in the training data. Generation stops
at the end-of-problem token, at a new "Q:", or if a tool call is invalid (counted wrong).
"""
import argparse
import json
import math
import multiprocessing as mp
import os
import re
import time

import torch
from tokenizers import Tokenizer

import tools
from model import GPT, Config

ANSWER = re.compile(r"####\s*(-?[\d,]*\.?\d+)")


def load(run_dir, device="cpu"):
    path = os.path.join(run_dir, "model.pt")
    try:
        ck = torch.load(path, map_location=device, weights_only=True)
    except TypeError:
        ck = torch.load(path, map_location=device)
    model = GPT(Config(**ck["cfg"]))
    model.load_state_dict(ck["model"])
    model.eval().to(device)
    return model, Tokenizer.from_file(os.path.join(run_dir, "tokenizer.json"))


@torch.no_grad()
def solve(model, tok, question, max_new=900, device="cpu"):
    """Returns (written answer, final number or None, tool calls, error or None)."""
    ids = tok.encode(f"Q: {question}\nA:").ids
    eos = tok.token_to_id("<|eos|>")
    caches = [{} for _ in model.blocks]
    logits = model(torch.tensor([ids], device=device), caches=caches, pos=0)
    pos, out, forced, calls, error = len(ids), [], [], [], None
    while len(out) < max_new and pos < model.cfg.max_seq:
        if forced:
            nxt = forced.pop(0)
        else:
            nxt = int(logits[0, -1].argmax())
            if nxt == eos:
                break
        out.append(nxt)
        logits = model(torch.tensor([[nxt]], device=device), caches=caches, pos=pos)
        pos += 1
        if forced:
            continue
        text = tok.decode(out, skip_special_tokens=False)
        if "\nQ:" in text or re.search(r"####\s*-?[\d,]*\.?\d+\s*\n", text):
            break
        expr = tools.pending_call(text)
        if expr is not None:
            try:
                result = tools.run_tool(expr)
            except Exception as e:                                   # an invalid call counts as a wrong answer
                error = f"bad tool call <<{expr}=: {str(e)[:120]}"
                break
            calls.append(expr)
            forced = tok.encode(result).ids
    text = tok.decode(out, skip_special_tokens=False).split("\nQ:")[0]
    m = ANSWER.search(text)
    return text, (m.group(1).replace(",", "") if m else None), calls, error


def correct(pred, gold):
    try:
        p, g = float(pred), float(gold)
    except (TypeError, ValueError):
        return False
    tol = max(abs(g) * 5e-3, 1e-3 if abs(g) < 1 else 1e-2)
    return math.isfinite(p) and abs(p - g) <= tol


_MODEL = None


def _init(run_dir):
    global _MODEL
    torch.set_num_threads(1)
    _MODEL = load(run_dir)


def _grade(row):
    model, tok = _MODEL
    t0 = time.time()
    text, pred, calls, error = solve(model, tok, row["question"])
    return dict(row, output=text, pred=pred, correct=correct(pred, row["answer"]), tool_calls=len(calls),
                error=error, seconds=round(time.time() - t0, 2))


def evaluate(run_dir, data_dir, n, workers, out_path):
    files = sorted(f for f in os.listdir(data_dir) if f.startswith("test_") and f.endswith(".jsonl"))
    report = {"run": run_dir, "sets": {}}
    with mp.Pool(workers, initializer=_init, initargs=(run_dir,)) as pool:
        for name in files:
            with open(os.path.join(data_dir, name)) as f:
                rows = [json.loads(line) for line in f][:n]
            t0 = time.time()
            graded = pool.map(_grade, rows, chunksize=4)
            acc = sum(r["correct"] for r in graded) / max(1, len(graded))
            by = {}
            for r in graded:
                key = r.get("target") or r.get("family") or "all"
                by.setdefault(key, []).append(r["correct"])
            report["sets"][name[5:-6]] = {
                "n": len(graded), "accuracy": round(acc, 4), "minutes": round((time.time() - t0) / 60, 1),
                "bad_tool_calls": sum(1 for r in graded if r["error"]),
                "by_task": {k: round(sum(v) / len(v), 3) for k, v in sorted(by.items())},
                "examples_right": [r for r in graded if r["correct"]][:3],
                "examples_wrong": [r for r in graded if not r["correct"]][:5]}
            print(f"{name[5:-6]:22s} {acc:7.1%} of {len(graded)}  ({report['sets'][name[5:-6]]['minutes']} min)", flush=True)
    with open(out_path, "w") as f:
        json.dump(report, f, indent=1, ensure_ascii=False)
    return report


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--run", required=True, help="folder with model.pt and tokenizer.json")
    p.add_argument("--ask", help="a question to answer")
    p.add_argument("--eval", help="folder with test_*.jsonl files")
    p.add_argument("--n", type=int, default=200, help="problems per test set")
    p.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2)))
    p.add_argument("--out", default=None)
    a = p.parse_args()
    if a.ask:
        model, tok = load(a.run)
        text, pred, calls, error = solve(model, tok, a.ask)
        print(text)
        print(f"\n[answer: {pred} | tool calls: {len(calls)}{' | ' + error if error else ''}]")
    if a.eval:
        evaluate(a.run, a.eval, a.n, a.workers, a.out or os.path.join(a.run, "eval.json"))


if __name__ == "__main__":
    main()
