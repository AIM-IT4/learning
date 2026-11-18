"""Stage 2 data on Kaggle, CPU only (uses no GPU quota).

English from FineWeb-Edu (an open dataset of educational web pages, ODC-By licence) plus our
own quant and maths problems; our 16,384-token tokenizer learned from both; token files for
the two training stages; and the test sets. Built into a self-contained script kernel by
build_kernel.py, which fills in CODE with our source files.

Output in /kaggle/working/data2:
    tokenizer.json
    read/      train.bin, val.bin, meta.json   about 1.6B English + 0.4B problem tokens
    practice/  train.bin, val.bin, meta.json   about 0.4B tokens of fresh problems
    test_*.jsonl
"""
import base64
import json
import multiprocessing as mp
import os
import subprocess
import sys
import time
import urllib.request

CODE = {}
WORK = os.environ.get("SLM_WORK", "/kaggle/working")
TMP = os.environ.get("SLM_TMP", "/tmp/slm-data")
EN_TOKENS = float(os.environ.get("SLM_EN_TOKENS", "1.6e9"))
EN_FILES = int(os.environ.get("SLM_EN_FILES", "4"))
EN_LOCAL = os.environ.get("SLM_EN_LOCAL", "")                 # comma-separated local parquet files, for testing
SYN_READ = int(os.environ.get("SLM_SYN_READ", "1300000"))
SYN_PRACTICE = int(os.environ.get("SLM_SYN_PRACTICE", "1300000"))
VOCAB = int(os.environ.get("SLM_VOCAB", "16384"))
URL = "https://huggingface.co/datasets/HuggingFaceFW/fineweb-edu/resolve/main/sample/10BT/{:03d}_00000.parquet"

os.makedirs(f"{WORK}/slm", exist_ok=True)
for name, b64 in CODE.items():
    with open(f"{WORK}/slm/{name}", "wb") as f:
        f.write(base64.b64decode(b64))
os.chdir(f"{WORK}/slm")
sys.path.insert(0, os.getcwd())


def sh(cmd):
    print("$", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


for module, package in [("QuantLib", "QuantLib==1.44"), ("tokenizers", "tokenizers"), ("pyarrow", "pyarrow")]:
    try:
        __import__(module)
    except ImportError:
        sh([sys.executable, "-m", "pip", "install", "-q", package])

import numpy as np  # noqa: E402
import pyarrow.parquet as pq  # noqa: E402
from tokenizers import pre_tokenizers, trainers  # noqa: E402

import prepare  # noqa: E402

OUT = f"{WORK}/data2"
for d in (OUT, f"{OUT}/read", f"{OUT}/practice", TMP):
    os.makedirs(d, exist_ok=True)


def problems(seed, n):
    workers = os.cpu_count() or 2
    per = n // (workers * 8) + 1
    with mp.Pool(workers) as pool:
        chunks = pool.map(prepare.generate, [(seed + i, per, 0.15) for i in range(workers * 8)])
    return [t for c in chunks for t in c][:n]


def english_files():
    if EN_LOCAL:
        yield from EN_LOCAL.split(",")
        return
    for i in range(EN_FILES):
        path = f"{TMP}/{i:03d}.parquet"
        if not os.path.exists(path):
            t0 = time.time()
            urllib.request.urlretrieve(URL.format(i), path + ".part")
            os.replace(path + ".part", path)
            print(f"downloaded English file {i}: {os.path.getsize(path) / 1e9:.2f} GB in {time.time() - t0:.0f}s", flush=True)
        yield path
        os.remove(path)


def documents(path):
    pf = pq.ParquetFile(path)
    for g in range(pf.num_row_groups):
        yield from pf.read_row_group(g, columns=["text"]).column("text").to_pylist()


t0 = time.time()
read_syn = problems(2000, SYN_READ)
practice_syn = problems(5000, SYN_PRACTICE)
print(f"generated {len(read_syn) + len(practice_syn)} problems in {time.time() - t0:.0f}s", flush=True)

files = english_files()
first = next(files)
sample = []
for doc in documents(first):
    sample.append(doc)
    if len(sample) >= 150000:
        break
t0 = time.time()
tok = prepare.make_tokenizer()
tok.train_from_iterator(sample + read_syn[:60000], trainers.BpeTrainer(
    vocab_size=VOCAB, special_tokens=prepare.SPECIAL, min_frequency=2, initial_alphabet=pre_tokenizers.ByteLevel.alphabet()))
tok.save(f"{OUT}/tokenizer.json")
eos = tok.token_to_id(prepare.EOS)
print(f"tokenizer: {tok.get_vocab_size()} tokens in {time.time() - t0:.0f}s", flush=True)
del sample


def write(f, texts):
    n = 0
    for i in range(0, len(texts), 5000):
        encs = tok.encode_batch(texts[i:i + 5000])
        arr = np.concatenate([np.array(e.ids + [eos], dtype=np.uint16) for e in encs])
        arr.tofile(f)
        n += int(arr.size)
    return n


t0 = time.time()
counts = {"english": 0, "english_docs": 0, "problems_read": 0, "val": 0}
with open(f"{OUT}/read/train.bin", "wb") as train, open(f"{OUT}/read/val.bin", "wb") as val:
    path, val_docs, batch = first, [], []
    while path and counts["english"] < EN_TOKENS:
        for doc in documents(path):
            if len(val_docs) < 3000:
                val_docs.append(doc)
                continue
            batch.append(doc)
            if len(batch) == 5000:
                counts["english"] += write(train, batch)
                counts["english_docs"] += len(batch)
                batch = []
                if counts["english"] >= EN_TOKENS:
                    break
        print(f"English so far: {counts['english'] / 1e9:.2f}B tokens, {time.time() - t0:.0f}s", flush=True)
        path = next(files, None) if counts["english"] < EN_TOKENS else None
    if batch and counts["english"] < EN_TOKENS:
        counts["english"] += write(train, batch)
        counts["english_docs"] += len(batch)
    counts["problems_read"] = write(train, read_syn[:-2000])
    counts["val"] = write(val, val_docs) + write(val, read_syn[-2000:])
with open(f"{OUT}/practice/train.bin", "wb") as train, open(f"{OUT}/practice/val.bin", "wb") as val:
    counts["problems_practice"] = write(train, practice_syn[:-2000])
    counts["practice_val"] = write(val, practice_syn[-2000:])
for stage in ("read", "practice"):
    with open(f"{OUT}/{stage}/meta.json", "w") as f:
        json.dump({"vocab_size": tok.get_vocab_size(), "eos_id": eos, "counts": counts}, f, indent=1)
print(f"token files written in {time.time() - t0:.0f}s:", json.dumps(counts), flush=True)

seen = {t.split("\nA:")[0][3:] for t in read_syn + practice_syn}
for name, rows in prepare.test_set(7, 500).items():
    with open(f"{OUT}/test_{name}.jsonl", "w") as f:
        for r in rows:
            if r["question"] not in seen:
                f.write(json.dumps({k: r.get(k) for k in ("question", "answer", "split", "target", "family", "disguises")},
                                   ensure_ascii=False) + "\n")
print("DONE", sorted(os.listdir(OUT)), flush=True)
