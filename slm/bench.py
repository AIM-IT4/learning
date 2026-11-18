"""Benchmark our models against existing small open models on the same questions.

Two conditions for the existing models, so the comparison is fair both ways:
    own    each model answers in its own way (its chat format, step by step, no tools)
    tools  each model gets our tools (calculator + QuantLib), taught with three worked
           examples in our format; results are written back while it writes, exactly as
           for our model
Our models always use their tools. An answer is right if its final number is within 0.5%
of the true answer (a percentage like "6.14%" also counts for 0.0614).

    python bench.py --model ours:runs/stage1 --model hf:HuggingFaceTB/SmolLM2-135M-Instruct \\
        --tests runs/stage1 --n 200 --gsm 300 --out bench.json
"""
import argparse
import json
import math
import os
import random
import re
import time
from contextlib import nullcontext

import torch

import quantexam
import quantgen
import solve
import tools

SETS = ["quant_level1", "quant_level2", "quant_level3", "quant_exam", "maths_seen", "maths_new_wording", "gsm8k"]
NUM = re.compile(r"-?\d[\d,]*\.?\d*")
SYSTEM = "You are an expert in quantitative finance and mathematics."
INSTRUCT = ("\n\nSolve the problem step by step. Write rates and volatilities as decimals (0.05 for 5%). "
            "On the last line, give the final answer as a single number in the form: #### <number>")


def matches(pred, gold):
    if solve.correct(pred, gold):
        return True
    try:
        p, g = float(pred), float(gold)
    except (TypeError, ValueError):
        return False
    return abs(g) < 1 and solve.correct(p / 100, g)


def final_number(text):
    text = text.split("</think>")[-1]
    m = re.search(r"####\s*[$₹]?\s*(-?[\d,]*\.?\d+)", text)
    if m:
        return m.group(1).replace(",", "")
    m = re.search(r"\\boxed\{([^{}]*)\}", text)
    if m and NUM.findall(m.group(1)):
        return NUM.findall(m.group(1))[-1].replace(",", "").rstrip(".")
    nums = NUM.findall(text)
    return nums[-1].replace(",", "").rstrip(".") if nums else None


def load_sets(tests_dirs, n, gsm):
    """Test sets from one or more folders. With several folders (one per training run), keep only
    questions present in all of them, so no model is tested on a question from its training data."""
    sets = {}
    dirs = tests_dirs.split(",")
    for name in SETS[:3] + SETS[4:6]:
        lists = []
        for d in dirs:
            path = os.path.join(d, f"test_{name}.jsonl")
            if os.path.exists(path):
                with open(path) as f:
                    lists.append([json.loads(line) for line in f])
        if lists:
            keep = set.intersection(*[{r["question"] for r in rows} for rows in lists])
            sets[name] = [r for r in lists[0] if r["question"] in keep][:n]
    sets["quant_exam"] = quantexam.rows()
    if gsm:
        from datasets import load_dataset
        ds = load_dataset("openai/gsm8k", "main", split="test").select(range(gsm))
        sets["gsm8k"] = [{"question": r["question"], "answer": r["answer"].split("####")[-1].strip().replace(",", ""),
                          "target": "gsm8k"} for r in ds]
    return {k: sets[k] for k in SETS if k in sets}


def few_shot_prefix():
    """Three worked examples in our format, from the training generator (fixed, never test items)."""
    R = random.Random(123)
    picks = [quantgen.problem(R, "train", target=t) for t in ("option_price", "bond_price", "var")]
    return "\n\n".join(quantgen.to_text(p) for p in picks) + "\n\n"


# ------------------------------------------------------------------ our models

def run_ours(run_dir, rows, device, batch):
    model, tok = solve.load(run_dir, device)
    ctx = torch.autocast("cuda", dtype=torch.float16) if device.startswith("cuda") else nullcontext()
    out = {}
    for chunk in solve.length_batches(tok, rows, batch):
        with ctx:
            res = solve.generate_batch(model, tok, [r["question"] for r in chunk], device=device)
        for r, x in zip(chunk, res):
            out[id(r)] = (x["answer"], x["text"])
    return [out[id(r)] for r in rows], {"params": model.num_params()}


# ------------------------------------------------------------------ existing models

def load_hf(name, device):
    from transformers import AutoModelForCausalLM, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(name)
    tok.padding_side = "left"
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    dtype = torch.float16 if device.startswith("cuda") else torch.float32
    model = AutoModelForCausalLM.from_pretrained(name, dtype=dtype).to(device).eval()
    return model, tok


@torch.no_grad()
def run_hf_own(model, tok, name, rows, device, batch, max_new):
    thinking = "Qwen3" in name
    kw = {"enable_thinking": True} if thinking else {}
    prompts = [tok.apply_chat_template([{"role": "system", "content": SYSTEM},
                                        {"role": "user", "content": r["question"] + INSTRUCT}],
                                       tokenize=False, add_generation_prompt=True, **kw) for r in rows]
    order = sorted(range(len(rows)), key=lambda i: len(prompts[i]))
    texts = [None] * len(rows)
    for i in range(0, len(order), batch):
        idx = order[i:i + batch]
        enc = tok([prompts[j] for j in idx], return_tensors="pt", padding=True, add_special_tokens=False).to(device)
        out = model.generate(**enc, max_new_tokens=max_new, do_sample=False, pad_token_id=tok.pad_token_id)
        for k, j in enumerate(idx):
            texts[j] = tok.decode(out[k][enc["input_ids"].shape[1]:], skip_special_tokens=True)
    return [(final_number(t), t) for t in texts]


@torch.no_grad()
def hf_generate_tools(model, tok, prompts, device, max_new=700):
    """Our tool loop for a Hugging Face model: left padding, one step at a time for the whole batch."""
    enc = tok(prompts, return_tensors="pt", padding=True, add_special_tokens=False).to(device)
    attn = enc["attention_mask"]
    pos = (attn.cumsum(-1) - 1).clamp(min=0)
    out = model(input_ids=enc["input_ids"], attention_mask=attn, position_ids=pos, use_cache=True)
    past, logits = out.past_key_values, out.logits[:, -1]
    nxt_pos = attn.sum(-1, keepdim=True)
    B = len(prompts)
    gen, forced, done, error = [[] for _ in range(B)], [[] for _ in range(B)], [False] * B, [None] * B
    last_tool = [False] * B
    eos = tok.eos_token_id
    for _ in range(max_new):
        greedy = logits.argmax(-1).tolist()
        step = []
        for b in range(B):
            if done[b]:
                step.append(tok.pad_token_id)
                continue
            if forced[b]:
                t, last_tool[b] = forced[b].pop(0), True
            else:
                t, last_tool[b] = greedy[b], False
                if t == eos:
                    done[b] = True
                    step.append(tok.pad_token_id)
                    continue
            gen[b].append(t)
            step.append(t)
        if all(done):
            break
        attn = torch.cat([attn, torch.ones((B, 1), dtype=attn.dtype, device=device)], dim=1)
        out = model(input_ids=torch.tensor(step, device=device)[:, None], attention_mask=attn, position_ids=nxt_pos,
                    past_key_values=past, use_cache=True)
        past, logits = out.past_key_values, out.logits[:, -1]
        nxt_pos = nxt_pos + 1
        for b in range(B):
            if done[b] or forced[b] or last_tool[b]:
                continue
            text = tok.decode(gen[b], skip_special_tokens=True)
            if "\nQ:" in text or solve.ANSWER_LINE.search(text):
                done[b] = True
                continue
            expr = tools.pending_call(text)
            if expr is not None:
                try:
                    forced[b] = tok.encode(tools.run_tool(expr), add_special_tokens=False)
                except Exception as e:
                    error[b] = str(e)[:100]
                    done[b] = True
    texts = [tok.decode(g, skip_special_tokens=True).split("\nQ:")[0] for g in gen]
    return texts, error


def run_hf_tools(model, tok, rows, device, batch):
    prefix = few_shot_prefix()
    prompts = [prefix + f"Q: {r['question']}\nA:" for r in rows]
    order = sorted(range(len(rows)), key=lambda i: len(prompts[i]))
    results = [None] * len(rows)
    for i in range(0, len(order), batch):
        idx = order[i:i + batch]
        texts, errors = hf_generate_tools(model, tok, [prompts[j] for j in idx], device)
        for k, j in enumerate(idx):
            m = solve.ANSWER.search(texts[k])
            results[j] = (m.group(1).replace(",", "") if m else None, texts[k])
    return results


# ------------------------------------------------------------------ main

def score(name, cond, sets, answers_for, report):
    for set_name, rows in sets.items():
        t0 = time.time()
        res = answers_for(rows)
        secs = (time.time() - t0) / max(1, len(rows))
        right = [matches(p, r["answer"]) for (p, _), r in zip(res, rows)]
        entry = {"n": len(rows), "accuracy": round(sum(right) / max(1, len(rows)), 4), "sec_per_problem": round(secs, 2),
                 "examples": [{"question": r["question"], "answer": r["answer"], "pred": p, "output": t[:1500], "right": ok}
                              for (p, t), r, ok in list(zip(res, rows, right))[:4]]}
        if set_name == "quant_exam":
            for flag in (True, False):
                sel = [ok for ok, r in zip(right, rows) if r["practised"] == flag]
                entry["practised" if flag else "new_tasks"] = round(sum(sel) / max(1, len(sel)), 4)
        report.setdefault(name, {}).setdefault(cond, {})[set_name] = entry
        print(f"{name:42s} {cond:5s} {set_name:18s} {entry['accuracy']:7.1%}  ({secs:.2f} s each)", flush=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--model", action="append", required=True, help="ours:RUN_DIR or hf:HUGGINGFACE_NAME")
    p.add_argument("--tests", required=True, help="folder(s) with test_*.jsonl, comma-separated")
    p.add_argument("--n", type=int, default=200, help="problems per generated test set")
    p.add_argument("--gsm", type=int, default=300, help="GSM8K test problems (0 to skip)")
    p.add_argument("--conditions", default="own,tools")
    p.add_argument("--tool-sets", default="quant_level1,quant_level2,quant_level3,quant_exam")
    p.add_argument("--batch", type=int, default=16)
    p.add_argument("--max-new", type=int, default=768)
    p.add_argument("--out", default="bench.json")
    a = p.parse_args()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    sets = load_sets(a.tests, a.n, a.gsm)
    report = json.load(open(a.out)) if os.path.exists(a.out) else {}
    for spec in a.model:
        kind, name = spec.split(":", 1)
        if kind == "ours":
            label = "ours/" + os.path.basename(os.path.normpath(name))
            model_info = {}

            def answers(rows, name=name):
                res, info = run_ours(name, rows, device, a.batch)
                model_info.update(info)
                return res
            score(label, "tools", sets, answers, report)
            report[label]["params"] = model_info.get("params")
        else:
            model, tok = load_hf(name, device)
            label = name
            if "own" in a.conditions:
                max_new = a.max_new * 2 if "Qwen3" in name else a.max_new
                score(label, "own", sets, lambda rows: run_hf_own(model, tok, name, rows, device, a.batch, max_new), report)
            if "tools" in a.conditions:
                tool_sets = {k: v for k, v in sets.items() if k in a.tool_sets.split(",")}
                score(label, "tools", tool_sets, lambda rows: run_hf_tools(model, tok, rows, device, a.batch), report)
            report[label]["params"] = sum(p.numel() for p in model.parameters())
            del model
            if device.startswith("cuda"):
                torch.cuda.empty_cache()
        with open(a.out, "w") as f:
            json.dump(report, f, indent=1, ensure_ascii=False)
    print("saved", a.out)


if __name__ == "__main__":
    main()
