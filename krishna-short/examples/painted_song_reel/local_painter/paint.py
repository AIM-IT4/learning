"""Paint the storyboard with SDXL-Turbo on this machine's CPU (bfloat16; the model is open source, cached locally).

  python3 paint.py candidates <shots.json> <out_dir>            3 options per shot at 896x512 + a contact sheet each
  python3 paint.py refine <shots.json> <out_dir> name:seed[:alias] ...  the chosen options, refined at 1664x960
shots.json: {"style": "...", "cast": {"K": "...", "N": "..."}, "shots": {"name": {"prompt": "... {K} ...", "seeds": [..]}}}
Prompts stay under CLIP's 77 tokens; the refine pass (img2img, strength .3) adds detail without changing the picture.
"""
import json, sys, time, torch
from pathlib import Path
from PIL import Image, ImageDraw
from diffusers import AutoPipelineForText2Image, AutoPipelineForImage2Image

mode, spec_f, out = sys.argv[1], sys.argv[2], Path(sys.argv[3]); out.mkdir(parents=True, exist_ok=True)
spec = json.load(open(spec_f, encoding="utf-8"))
def prompt(name):
    p = spec["shots"][name]["prompt"]
    for k, v in spec["cast"].items(): p = p.replace("{" + k + "}", v)
    return spec["style"] + " " + p
torch.set_num_threads(4)
pipe = AutoPipelineForText2Image.from_pretrained("stabilityai/sdxl-turbo", torch_dtype=torch.bfloat16, variant="fp16")
pipe.set_progress_bar_config(disable=True)
ntok = lambda s: len(pipe.tokenizer(s)["input_ids"])

if mode == "candidates":
    only = set(sys.argv[4].split(",")) if len(sys.argv) > 4 else None
    for name, sh in spec["shots"].items():
        if only and name not in only: continue
        p = prompt(name); print(f"{name}: {ntok(p)} tokens", flush=True)
        ims = []
        for seed in sh["seeds"]:
            t = time.time()
            im = pipe(prompt=p, num_inference_steps=4, guidance_scale=0.0, width=896, height=512, generator=torch.Generator().manual_seed(seed)).images[0]
            im.save(out / f"{name}_{seed}.png"); ims.append((seed, im)); print(f"  {seed}: {time.time() - t:.0f} s", flush=True)
        sheet = Image.new("RGB", (448 * len(ims), 256 + 28), "white"); d = ImageDraw.Draw(sheet)
        for i, (seed, im) in enumerate(ims): sheet.paste(im.resize((444, 254)), (448 * i, 28)); d.text((448 * i + 6, 6), f"{name} seed {seed}", fill=(0, 0, 0))
        sheet.save(out / f"sheet_{name}.jpg", quality=88)
else:
    refine = AutoPipelineForImage2Image.from_pipe(pipe)
    for pick in sys.argv[4:]:
        name, seed, *alias = pick.split(":"); seed = int(seed); t = time.time(); alias = alias[0] if alias else name
        base = Image.open(out / f"{name}_{seed}.png").convert("RGB")
        im = refine(prompt=prompt(name), image=base.resize((1664, 960), Image.LANCZOS), strength=0.3, num_inference_steps=4, guidance_scale=0.0,
                    generator=torch.Generator().manual_seed(seed)).images[0]
        im.save(out / f"final_{alias}.png"); print(f"{alias} ({name}:{seed}) refined in {time.time() - t:.0f} s", flush=True)
print("done", flush=True)
