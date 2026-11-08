#!/usr/bin/env python3
"""
make_art.py - generate cinematic 9:16 artwork for reels on a plain CPU with SDXL-Turbo
(Stability AI Community License: free for personal/non-commercial use and for commercial use
under US$1M revenue with registration; you own the outputs).

Step 1 - candidates: N versions of every shot at 512x912 (~16 s each on 4 CPU cores with AMX)
  python make_art.py generate --shots shots.tsv --out cand
Step 2 - look at the candidates, then sharpen the winners at 768x1368 (img2img)
  python make_art.py refine --shots shots.tsv --cand cand --out final i01=33 drop=22 ...

shots.tsv: one shot per line, "name<TAB>prompt". The STYLE text is appended to every prompt.
Needs: pip install torch --index-url https://download.pytorch.org/whl/cpu ; pip install diffusers transformers accelerate
"""
import argparse
import time
from pathlib import Path

STYLE = ("epic Indian mythology digital painting, cinematic lighting, dramatic glow, ultra detailed, "
         "deep blue and fire orange colours, floating embers, volumetric light")
MODEL = "stabilityai/sdxl-turbo"


def load_shots(path):
    shots = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.startswith("#"):
            name, prompt = line.split("\t", 1)
            shots.append((name.strip(), prompt.strip()))
    return shots


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=("generate", "refine"))
    ap.add_argument("--shots", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--cand", help="refine: folder with the candidates")
    ap.add_argument("--seeds", default="11,22,33", help="generate: one candidate per seed")
    ap.add_argument("--steps", type=int, default=4)
    ap.add_argument("picks", nargs="*", help="refine: name=seed for each chosen candidate")
    args = ap.parse_args()

    import torch
    from diffusers import AutoPipelineForImage2Image, AutoPipelineForText2Image
    from PIL import Image

    torch.set_num_threads(max(1, torch.get_num_threads()))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    shots = dict(load_shots(args.shots))
    t0 = time.time()
    if args.mode == "generate":
        pipe = AutoPipelineForText2Image.from_pretrained(MODEL, torch_dtype=torch.bfloat16, variant="fp16")
        for name, prompt in shots.items():
            for seed in (int(s) for s in args.seeds.split(",")):
                f = out / f"{name}_s{seed}.png"
                if not f.exists():
                    pipe(prompt=f"{prompt}, {STYLE}", num_inference_steps=args.steps, guidance_scale=0.0,
                         width=512, height=912, generator=torch.Generator().manual_seed(seed)).images[0].save(f)
            print(f"{name} done ({time.time()-t0:.0f}s)", flush=True)
    else:
        pipe = AutoPipelineForImage2Image.from_pretrained(MODEL, torch_dtype=torch.bfloat16, variant="fp16")
        for pick in args.picks:
            name, seed = pick.split("=")
            img = Image.open(Path(args.cand) / f"{name}_s{seed}.png").convert("RGB").resize((768, 1368), Image.LANCZOS)
            pipe(prompt=f"{shots[name]}, {STYLE}, sharp focus, intricate details", image=img,
                 num_inference_steps=4, strength=0.45, guidance_scale=0.0,
                 generator=torch.Generator().manual_seed(int(seed))).images[0].save(out / f"{name}.png")
            print(f"{name} refined ({time.time()-t0:.0f}s)", flush=True)


if __name__ == "__main__":
    main()
