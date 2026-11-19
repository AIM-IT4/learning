"""Export a trained Ganit run for the in-browser chat page (web/ganit.html).

    python web/export.py --run runs/ganit-15m --out web/dist
    cp web/ganit.html web/ganit-core.js web/dist/
    cd web/dist && python -m http.server 8000      # open http://localhost:8000/ganit.html

Writes tokenizer.json, ganit15m.json (the shape and position of every weight) and all
weights as 16-bit floats in base64 text files of about 13 MB each, because the page's
host serves text files but not raw binary ones. The output layer shares its weights with
the token table, so they are stored once.
"""
import argparse
import base64
import json
import os
import shutil
import sys

import torch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model import Config  # noqa: E402

CHUNK = 9_999_999  # raw bytes per file: a multiple of 3, so every file decodes on its own


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--run", required=True, help="folder with model.pt and tokenizer.json")
    ap.add_argument("--out", required=True, help="folder to write the page's files into")
    ap.add_argument("--name", default="ganit15m", help="file name prefix")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    ck = torch.load(os.path.join(a.run, "model.pt"), map_location="cpu", weights_only=True)
    config = dict(ck["cfg"], ffn_hidden=Config(**ck["cfg"]).ffn_hidden)

    tensors, parts, offset = [], [], 0
    for name, t in ck["model"].items():
        if name == "head.weight":  # tied to tok.weight
            continue
        h = t.detach().to(torch.float16).contiguous().numpy()
        tensors.append({"name": name, "shape": list(h.shape), "offset": offset, "size": int(h.size)})
        parts.append(h.tobytes())
        offset += h.size
    raw = b"".join(parts)

    files, download = [], 0
    for i in range(0, len(raw), CHUNK):
        text = base64.b64encode(raw[i:i + CHUNK])
        name = f"{a.name}-{len(files)}.txt"
        with open(os.path.join(a.out, name), "wb") as f:
            f.write(text)
        files.append(name)
        download += len(text)

    manifest = {"config": config, "tensors": tensors, "files": files, "encoding": "base64",
                "bytes": len(raw), "download": download}
    with open(os.path.join(a.out, f"{a.name}.json"), "w") as f:
        json.dump(manifest, f)
    shutil.copy(os.path.join(a.run, "tokenizer.json"), os.path.join(a.out, "tokenizer.json"))
    params = sum(t["size"] for t in tensors)
    print(f"{params / 1e6:.1f}M weights, {len(raw) / 1e6:.1f} MB as fp16, "
          f"{download / 1e6:.1f} MB to download in {len(files)} files -> {a.out}")


if __name__ == "__main__":
    main()
