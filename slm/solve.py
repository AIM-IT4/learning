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
def generate(model, tok, question, max_new=900, device="cpu"):
    """Write an answer step by step. Yields ("text", new_text) as the model writes,
    ("tool", expression, result) when a tool runs, and finally
    ("end", full_text, final_number_or_None, tool_calls, error_or_None)."""
    ids = tok.encode(f"Q: {question}\nA:").ids
    eos = tok.token_to_id("<|eos|>")
    caches = [{} for _ in model.blocks]
    logits = model(torch.tensor([ids], device=device), caches=caches, pos=0)
    pos, out, forced, calls, error, shown = len(ids), [], [], [], None, ""
    while len(out) < max_new and pos < model.cfg.max_seq:
        from_tool = bool(forced)
        if forced:
            nxt = forced.pop(0)
        else:
            nxt = int(logits[0, -1].argmax())
            if nxt == eos:
                break
        out.append(nxt)
        logits = model(torch.tensor([[nxt]], device=device), caches=caches, pos=pos)
        pos += 1
        text = tok.decode(out, skip_special_tokens=False)
        if from_tool:                                                # the tool event already showed this text
            if not forced:
                shown = text
            continue
        delta = text[len(shown):] if text.startswith(shown) else text
        if delta:
            yield ("text", delta)
            shown = text
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
            yield ("tool", expr, result)
    text = tok.decode(out, skip_special_tokens=False).split("\nQ:")[0]
    m = ANSWER.search(text)
    yield ("end", text, (m.group(1).replace(",", "") if m else None), calls, error)


def solve(model, tok, question, max_new=900, device="cpu"):
    """Returns (written answer, final number or None, tool calls, error or None)."""
    for event in generate(model, tok, question, max_new, device):
        if event[0] == "end":
            return event[1:]


def correct(pred, gold):
    try:
        p, g = float(pred), float(gold)
    except (TypeError, ValueError):
        return False
    tol = max(abs(g) * 5e-3, 1e-3 if abs(g) < 1 else 1e-2)
    return math.isfinite(p) and abs(p - g) <= tol


ANSWER_LINE = re.compile(r"####\s*-?[\d,]*\.?\d+\s*\n")


@torch.no_grad()
def generate_batch(model, tok, questions, max_new=900, temperature=0.0, device="cpu", seed=0):
    """Answer several questions at once; their prompts must have the same number of tokens.
    Every question gets its own tool calls. Returns one dict per question with the text,
    final answer, tool calls, error, generated token ids and which tokens our tools wrote."""
    prompts = [tok.encode(f"Q: {q}\nA:").ids for q in questions]
    assert len({len(p) for p in prompts}) == 1, "prompts must have the same number of tokens"
    B, eos = len(prompts), tok.token_to_id("<|eos|>")
    caches = [{} for _ in model.blocks]
    logits = model(torch.tensor(prompts, device=device), caches=caches, pos=0)[:, -1]
    pos = len(prompts[0])
    out, from_tool, forced = [[] for _ in range(B)], [[] for _ in range(B)], [[] for _ in range(B)]
    calls, error, done = [[] for _ in range(B)], [None] * B, [False] * B
    gen = torch.Generator(device=device).manual_seed(seed) if temperature > 0 else None
    while not all(done) and pos < model.cfg.max_seq and max(len(o) for o in out) < max_new:
        if temperature > 0:
            probs = torch.softmax(logits.float() / temperature, dim=-1)
            sampled = torch.multinomial(probs, 1, generator=gen).squeeze(1).tolist()
        else:
            sampled = logits.argmax(-1).tolist()
        step = []
        for b in range(B):
            if done[b]:
                step.append(eos)
                continue
            if forced[b]:
                t, tool = forced[b].pop(0), True
            else:
                t, tool = sampled[b], False
                if t == eos:
                    done[b] = True
                    step.append(eos)
                    continue
            out[b].append(t)
            from_tool[b].append(tool)
            step.append(t)
        logits = model(torch.tensor(step, device=device)[:, None], caches=caches, pos=pos)[:, -1]
        pos += 1
        for b in range(B):
            if done[b] or forced[b] or not out[b] or from_tool[b][-1]:
                continue
            text = tok.decode(out[b], skip_special_tokens=False)
            if "\nQ:" in text or ANSWER_LINE.search(text):
                done[b] = True
                continue
            expr = tools.pending_call(text)
            if expr is not None:
                try:
                    forced[b] = tok.encode(tools.run_tool(expr)).ids
                    calls[b].append(expr)
                except Exception as e:                               # an invalid call counts as a wrong answer
                    error[b] = f"bad tool call <<{expr}=: {str(e)[:120]}"
                    done[b] = True
    results = []
    for b in range(B):
        text = tok.decode(out[b], skip_special_tokens=False).split("\nQ:")[0]
        m = ANSWER.search(text)
        results.append({"text": text, "answer": m.group(1).replace(",", "") if m else None, "tool_calls": calls[b],
                        "error": error[b], "ids": out[b], "from_tool": from_tool[b]})
    return results


def length_batches(tok, rows, size):
    """Group questions whose prompts have the same number of tokens, so they can share a batch."""
    groups = {}
    for r in rows:
        groups.setdefault(len(tok.encode(f"Q: {r['question']}\nA:").ids), []).append(r)
    for _, rs in sorted(groups.items()):
        for i in range(0, len(rs), size):
            yield rs[i:i + size]


_MODEL = None


def _init(run_dir, device="cpu"):
    global _MODEL
    if device == "cpu":
        torch.set_num_threads(1)
    _MODEL = (*load(run_dir, device), device)


def _grade_batch(rows):
    model, tok, device = _MODEL
    t0 = time.time()
    res = generate_batch(model, tok, [r["question"] for r in rows], device=device)
    secs = round((time.time() - t0) / len(rows), 2)
    return [dict(r, output=x["text"], pred=x["answer"], correct=correct(x["answer"], r["answer"]),
                 tool_calls=len(x["tool_calls"]), error=x["error"], seconds=secs) for r, x in zip(rows, res)]


def evaluate(run_dir, data_dir, n, workers, out_path, batch=16):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    files = sorted(f for f in os.listdir(data_dir) if f.startswith("test_") and f.endswith(".jsonl"))
    tok = Tokenizer.from_file(os.path.join(run_dir, "tokenizer.json"))
    report = {"run": run_dir, "device": device, "sets": {}}
    pool = mp.Pool(workers, initializer=_init, initargs=(run_dir, "cpu")) if device == "cpu" else None
    if pool is None:
        _init(run_dir, device)
    try:
        for name in files:
            with open(os.path.join(data_dir, name)) as f:
                rows = [json.loads(line) for line in f][:n]
            t0 = time.time()
            chunks = list(length_batches(tok, rows, batch))
            graded = [r for chunk in (pool.map(_grade_batch, chunks, chunksize=1) if pool else map(_grade_batch, chunks))
                      for r in chunk]
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
    finally:
        if pool:
            pool.close()
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
