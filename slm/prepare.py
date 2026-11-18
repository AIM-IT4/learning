"""Build Stage 1 data: practice problems, our own tokenizer, token files and test sets.

    python prepare.py --out data/stage1 --problems 250000

Writes into --out:
    tokenizer.json        our byte-level BPE vocabulary, learned from our own problems
    train.bin, val.bin    token ids (uint16), problems separated by <|eos|>
    meta.json             vocabulary size, token counts and problem-length statistics
    test_*.jsonl          held-back test sets: quant levels 1-3, maths seen and new wording

The tokenizer splits every number into single digits and always keeps '=', '<<' and '>>'
as separate tokens, so a tool call's '=' can never be merged with the next character.
"""
import argparse
import json
import multiprocessing as mp
import os
import random
import time

import numpy as np
from tokenizers import Regex, Tokenizer, decoders, models, pre_tokenizers, trainers

import mathgen
import quantgen

EOS = "<|eos|>"
SPECIAL = [EOS, "<|pad|>", "<think>", "</think>"]


def make_tokenizer():
    tok = Tokenizer(models.BPE())
    tok.pre_tokenizer = pre_tokenizers.Sequence([
        pre_tokenizers.Split(Regex(r" ?<<| ?>>| ?="), behavior="isolated"),
        pre_tokenizers.Digits(individual_digits=True),
        pre_tokenizers.ByteLevel(add_prefix_space=False, use_regex=True),
    ])
    tok.decoder = decoders.ByteLevel()
    return tok


def generate(job):
    seed, n, maths_frac = job
    R = random.Random(seed)
    out = []
    for _ in range(n):
        if R.random() < maths_frac:
            out.append(mathgen.to_text(mathgen.problem(R, "train")))
        else:
            out.append(quantgen.to_text(quantgen.problem(R, "train")))
    return out


def test_set(seed, n):
    R = random.Random(seed)
    rows = {}
    for split in ["level1", "level2", "level3"]:
        rows[f"quant_{split}"] = [quantgen.problem(R, split) for _ in range(n)]
    rows["maths_seen"] = [mathgen.problem(R, "train") | {"split": "maths_seen"} for _ in range(n // 2)]
    rows["maths_new_wording"] = [mathgen.problem(R, "heldout") | {"split": "maths_new_wording"} for _ in range(n // 2)]
    return rows


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="data/stage1")
    p.add_argument("--problems", type=int, default=250000)
    p.add_argument("--maths-frac", type=float, default=0.15)
    p.add_argument("--vocab", type=int, default=4096)
    p.add_argument("--test", type=int, default=300, help="problems per quant test level")
    p.add_argument("--workers", type=int, default=os.cpu_count())
    a = p.parse_args()
    os.makedirs(a.out, exist_ok=True)

    t0 = time.time()
    per = a.problems // (a.workers * 8) + 1
    jobs = [(1000 + i, per, a.maths_frac) for i in range(a.workers * 8)]
    with mp.Pool(a.workers) as pool:
        texts = [t for chunk in pool.map(generate, jobs) for t in chunk][:a.problems]
    print(f"generated {len(texts)} problems in {time.time() - t0:.0f}s", flush=True)

    tests = test_set(7, a.test)
    train_q = {t.split("\nA:")[0][3:] for t in texts}
    for name, rows in tests.items():
        before = len(rows)
        rows[:] = [r for r in rows if r["question"] not in train_q]
        with open(os.path.join(a.out, f"test_{name}.jsonl"), "w") as f:
            for r in rows:
                f.write(json.dumps({k: r.get(k) for k in ("question", "answer", "split", "target", "family", "disguises")},
                                   ensure_ascii=False) + "\n")
        print(f"test_{name}: {len(rows)} problems ({before - len(rows)} dropped as duplicates of training)")

    t0 = time.time()
    tok = make_tokenizer()
    trainer = trainers.BpeTrainer(vocab_size=a.vocab, special_tokens=SPECIAL, min_frequency=2,
                                  initial_alphabet=pre_tokenizers.ByteLevel.alphabet())
    tok.train_from_iterator(texts[:60000], trainer)
    tok.save(os.path.join(a.out, "tokenizer.json"))
    eos = tok.token_to_id(EOS)
    print(f"tokenizer: {tok.get_vocab_size()} tokens in {time.time() - t0:.0f}s", flush=True)

    t0 = time.time()
    lengths, streams = [], {"train": [], "val": []}
    n_val = max(1, len(texts) // 50)
    for i in range(0, len(texts), 20000):
        batch = texts[i:i + 20000]
        for j, enc in enumerate(tok.encode_batch(batch)):
            ids = enc.ids + [eos]
            lengths.append(len(ids))
            streams["val" if i + j >= len(texts) - n_val else "train"].append(np.array(ids, dtype=np.uint16))
    counts = {}
    for split, parts in streams.items():
        arr = np.concatenate(parts)
        arr.tofile(os.path.join(a.out, f"{split}.bin"))
        counts[split] = int(arr.size)
    L = np.array(lengths)
    sample = texts[0]
    assert tok.decode(tok.encode(sample).ids, skip_special_tokens=False) == sample, "tokenizer must round-trip"
    meta = {"vocab_size": tok.get_vocab_size(), "eos_id": eos, "problems": len(texts), "tokens": counts,
            "tokens_per_problem": {"mean": round(float(L.mean()), 1), "p50": int(np.percentile(L, 50)),
                                   "p95": int(np.percentile(L, 95)), "p99": int(np.percentile(L, 99)), "max": int(L.max())},
            "maths_frac": a.maths_frac}
    with open(os.path.join(a.out, "meta.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print(f"encoded in {time.time() - t0:.0f}s:", json.dumps(meta))


if __name__ == "__main__":
    main()
