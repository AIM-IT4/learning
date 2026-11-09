#!/usr/bin/env python3
"""
make_art.py - generate cinematic 9:16 artwork for reels on a plain CPU with SDXL-Turbo
(Stability AI Community License: free for personal/non-commercial use and for commercial use
under US$1M revenue with registration; you own the outputs).

Step 1 - candidates: N versions of every shot at 512x912 (~16 s each on 4 CPU cores with AMX)
  python make_art.py generate --shots shots.tsv --out cand
Step 2 - look at the candidates, then sharpen the winners at 768x1368 (img2img)
  python make_art.py refine --shots shots.tsv --cand cand --out final i01=33 drop=22 ...

shots.tsv: one shot per line, "name<TAB>prompt" or "name<TAB>prompt<TAB>style". The style text (third column,
else --style, else STYLE) is appended to the prompt. A line "@name<TAB>text" defines a named style that the third
column can refer to as "@name"; named styles go BEFORE the prompt (the text encoder only reads ~77 tokens, so
the look must not be the part that gets cut off).
Needs: pip install torch --index-url https://download.pytorch.org/whl/cpu ; pip install diffusers transformers accelerate
"""
import argparse
import time
from pathlib import Path

STYLE = ("epic Indian mythology digital painting, cinematic lighting, dramatic glow, ultra detailed, "
         "deep blue and fire orange colours, floating embers, volumetric light")
MODEL = "stabilityai/sdxl-turbo"


def join(prompt, style):
    """style marked with ^ goes first, else after the prompt"""
    return f"{style[1:]}, {prompt}" if style.startswith("^") else f"{prompt}, {style}"


def load_shots(path, default_style=STYLE):
    """[(name, prompt, style)]; per-shot style from a 3rd column, "@key" refers to an "@key<TAB>text" line."""
    shots, named = [], {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = [x.strip() for x in line.split("\t")]
        if parts[0].startswith("@"):
            named[parts[0]] = parts[1]
            continue
        style = parts[2] if len(parts) > 2 and parts[2] else default_style
        shots.append((parts[0], parts[1], ("^" + named[style]) if style in named else style))
    return shots


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=("generate", "refine"))
    ap.add_argument("--shots", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--cand", help="refine: folder with the candidates")
    ap.add_argument("--seeds", default="11,22,33", help="generate: one candidate per seed")
    ap.add_argument("--steps", type=int, default=4)
    ap.add_argument("--style", default=STYLE, help="style text appended to prompts without their own style")
    ap.add_argument("picks", nargs="*", help="refine: name=seed for each chosen candidate")
    args = ap.parse_args()

    import torch
    from diffusers import AutoPipelineForImage2Image, AutoPipelineForText2Image
    from PIL import Image

    torch.set_num_threads(max(1, torch.get_num_threads()))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    shots = {n: (p, st) for n, p, st in load_shots(args.shots, args.style)}
    t0 = time.time()
    if args.mode == "generate":
        pipe = AutoPipelineForText2Image.from_pretrained(MODEL, torch_dtype=torch.bfloat16, variant="fp16")
        for name, (prompt, style) in shots.items():
            for seed in (int(s) for s in args.seeds.split(",")):
                f = out / f"{name}_s{seed}.png"
                if not f.exists():
                    pipe(prompt=join(prompt, style), num_inference_steps=args.steps, guidance_scale=0.0,
                         width=512, height=912, generator=torch.Generator().manual_seed(seed)).images[0].save(f)
            print(f"{name} done ({time.time()-t0:.0f}s)", flush=True)
    else:
        pipe = AutoPipelineForImage2Image.from_pretrained(MODEL, torch_dtype=torch.bfloat16, variant="fp16")
        for pick in args.picks:
            name, seed = pick.split("=")
            img = Image.open(Path(args.cand) / f"{name}_s{seed}.png").convert("RGB").resize((768, 1368), Image.LANCZOS)
            pipe(prompt=join(shots[name][0], shots[name][1]) + ", sharp focus, intricate details", image=img,
                 num_inference_steps=4, strength=0.45, guidance_scale=0.0,
                 generator=torch.Generator().manual_seed(int(seed))).images[0].save(out / f"{name}.png")
            print(f"{name} refined ({time.time()-t0:.0f}s)", flush=True)


if __name__ == "__main__":
    main()
