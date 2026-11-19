"""Reference outputs from the Python model, used by web/test_core.js to check the browser copy.

    python web/make_vectors.py --run runs/ganit-15m --out web/dist/vectors.json
    node web/test_core.js web/dist

Records token ids for sample texts, results of tool calls taken from real solutions, the logits
after one prompt, and full answers to test questions (text, final number).
"""
import argparse
import glob
import json
import os
import random
import re
import sys

import torch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import explain  # noqa: E402
import quantgen  # noqa: E402
import solve  # noqa: E402
import tools  # noqa: E402

CALL = re.compile(r"<<(.+?)=([^=<>]*)>>")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--run", required=True, help="folder with model.pt, tokenizer.json and test_*.jsonl")
    ap.add_argument("--out", required=True)
    ap.add_argument("--gens", type=int, default=30, help="full answers to record")
    a = ap.parse_args()
    model, tok = solve.load(a.run)
    for p in model.parameters():          # the browser holds the weights as 16-bit floats: match it
        p.data = p.data.half().float()
    R = random.Random(0)

    rows = []
    for f in sorted(glob.glob(os.path.join(a.run, "test_*.jsonl"))):
        with open(f) as fh:
            rows += [json.loads(line) for line in fh][:40]
    R.shuffle(rows)

    solutions = [quantgen.problem(R, "train")["solution"] for _ in range(150)] + \
                [explain.problem(R, "train")["solution"] for _ in range(150)]
    texts = [r["question"] for r in rows[:150]] + solutions[::3] + \
        ["₹1,24,000 and Rs. 5 lakh, σ = 1%: “quotes” — dashes", "<|eos|>Q: hi\nA: <think>\nGoal: x.\n</think>\n#### 1,240"]
    tokenizer = [{"text": t, "ids": tok.encode(t).ids} for t in texts]

    exprs = {m.group(1) for s in solutions for m in CALL.finditer(s)}
    gens = []
    for r in rows[:a.gens]:
        text, answer, calls, error = solve.solve(model, tok, r["question"])
        gens.append({"question": r["question"], "text": text, "answer": answer})
        exprs |= {m.group(1) for m in CALL.finditer(text)}
    tool_rows = []
    for e in sorted(exprs):
        try:
            tool_rows.append({"expr": e, "result": tools.run_tool(e)})
        except Exception:                                   # the browser must refuse it too
            tool_rows.append({"expr": e, "result": "ERROR"})

    ids = tok.encode(f"Q: {rows[0]['question']}\nA:").ids
    with torch.no_grad():
        logits = model(torch.tensor([ids]))[0, -1].tolist()
    with open(a.out, "w") as f:
        json.dump({"tokenizer": tokenizer, "tools": tool_rows, "logits": {"ids": ids, "values": logits}, "gens": gens}, f)
    print(f"{len(tokenizer)} texts, {len(tool_rows)} tool calls, {len(gens)} answers -> {a.out}")


if __name__ == "__main__":
    main()
