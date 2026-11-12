"""Paint the storyboard with DreamShaper XL Lightning (open source, openrail++) on this machine's CPU, then repaint
every face at high resolution (a face-detail pass, like ADetailer) so eyes, noses and lips come out clean.

  python3 paint_pro.py candidates <shots.json> <out_dir> [name,name]   2 options per shot at 1344x768 + a contact sheet
  python3 paint_pro.py finish <shots.json> <out_dir> name:seed[:alias] ...   2x upscale + face-detail pass on the picks -> final_<alias>.png
  python3 paint_pro.py test <shots.json> <out_dir> name:seed            one picture, timed, with and without the face pass

shots.json: {"style", "negative", "cast": {"K": ..., "N": ...}, "face": {"K": ..., "N": ...},
             "shots": {name: {"prompt": "... {K} ...", "seeds": [...], "faces": "K" | "N" | "KN" | ""}}}
finish first enlarges the painting 2x (Lanczos, 2688x1536, so the camera can push in without going soft), then finds the
faces with OpenCV's YuNet; each is cropped (2.3x the face box), repainted at 896-1152 px with img2img (strength .42),
colour-matched and blended back with a feathered oval mask. Faces beyond the shot's cast get a generic description.
"""
import json, sys, time
from pathlib import Path
import numpy as np, cv2, torch
from PIL import Image, ImageDraw
from huggingface_hub import hf_hub_download
from diffusers import AutoPipelineForText2Image, AutoPipelineForImage2Image, DPMSolverMultistepScheduler

mode, spec_f, out = sys.argv[1], sys.argv[2], Path(sys.argv[3]); out.mkdir(parents=True, exist_ok=True)
spec = json.load(open(spec_f, encoding="utf-8"))
REPO = "Lykon/dreamshaper-xl-lightning"
W, H = 1344, 768
STEPS, CFG, SAMPLER = spec.get("steps", 6), spec.get("cfg", 2.0), spec.get("sampler", "dpm")
torch.set_num_threads(4)
pipe = AutoPipelineForText2Image.from_pretrained(REPO, torch_dtype=torch.bfloat16, variant="fp16")
pipe.scheduler = (DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, algorithm_type="sde-dpmsolver++", use_karras_sigmas=True)
                  if SAMPLER == "dpm-sde-karras" else DPMSolverMultistepScheduler.from_config(pipe.scheduler.config))
pipe.set_progress_bar_config(disable=True)
i2i = AutoPipelineForImage2Image.from_pipe(pipe)
ntok = lambda s: len(pipe.tokenizer(s)["input_ids"])

def prompt(name):
    p = spec["shots"][name]["prompt"]
    for k, v in spec["cast"].items(): p = p.replace("{" + k + "}", v)
    return spec["style"] + " " + p

def paint(name, seed):
    g = torch.Generator().manual_seed(seed)
    return pipe(prompt=prompt(name), negative_prompt=spec["negative"], num_inference_steps=STEPS, guidance_scale=CFG,
                width=W, height=H, generator=g).images[0]

YUNET = cv2.FaceDetectorYN.create(hf_hub_download("opencv/face_detection_yunet", "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.55, 0.3, 50)
def faces(img):
    """Face boxes [x, y, w, h, score] in a PIL image (YuNet, run at most 1344 px wide)."""
    k = min(1.0, 1344 / img.width)
    if k < 1: img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
    a = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR); h, w = a.shape[:2]
    YUNET.setInputSize((w, h)); _, f = YUNET.detect(a)
    return [] if f is None else [[float(v) / k for v in r[:4]] + [float(r[-1])] for r in f]

def face_pass(img, who, seed, scale=1.0, closed=False):
    """Repaint each detected face (the largest two) at 896-1152 px and blend it back."""
    if not who: return img, []                          # no people in this shot: leave it alone
    img = img.copy(); found = sorted(faces(img), key=lambda r: -r[2] * r[3])
    for k, (x, y, w, h, sc) in enumerate(found[:2]):
        if w < 24 * scale or (k and (w < 0.45 * found[0][2] or sc < 0.75)): continue   # tiny, a blurred face in the
                                                                                       # crowd, or not sure it is a face
        cx, cy, side = x + w / 2, y + h * 0.45, max(w, h) * 2.3
        x0, y0 = int(max(0, cx - side / 2)), int(max(0, cy - side / 2))
        x1, y1 = int(min(img.width, cx + side / 2)), int(min(img.height, cy + side / 2))
        crop = img.crop((x0, y0, x1, y1)); cw, ch = crop.size
        tag = who[k] if k < len(who) else ""               # a passer-by is not the heroine
        desc = spec["face"].get(tag, "a young Indian person")
        eyes = ("eyes gently closed, peaceful face, long lashes on closed eyelids" if closed else    # a sleeping face stays asleep
                "symmetrical eyes with detailed irises and catchlights")
        fp = f"{spec['style']} close-up portrait of {desc}, beautiful detailed face, {eyes}, natural nose, soft natural lips, smooth skin"
        neg = spec["negative"] + (", open eyes, looking at viewer" if closed else "")
        side_ = int(min(1152, max(896, cw)) // 8 * 8)
        big = crop.resize((side_, int(side_ * ch / cw) // 8 * 8), Image.LANCZOS)
        rep = i2i(prompt=fp, negative_prompt=neg, image=big, strength=0.42, num_inference_steps=8, guidance_scale=CFG,
                  generator=torch.Generator().manual_seed(seed + 7 * k)).images[0].resize((cw, ch), Image.LANCZOS)
        a, b = np.asarray(crop).astype(np.float32), np.asarray(rep).astype(np.float32)
        b = (b - b.mean((0, 1))) / (b.std((0, 1)) + 1e-6) * a.std((0, 1)) + a.mean((0, 1))      # keep the painting's colours
        m = np.zeros((ch, cw), np.float32)
        fx, fy = (x + w / 2 - x0), (y + h / 2 - y0)
        cv2.ellipse(m, (int(fx), int(fy)), (int(w * 0.85), int(h * 1.05)), 0, 0, 360, 1.0, -1)
        m = cv2.GaussianBlur(m, (0, 0), max(4, w * 0.18))[..., None]
        img.paste(Image.fromarray(np.clip(a * (1 - m) + b * m, 0, 255).astype(np.uint8)), (x0, y0))
    return img, found

if mode == "candidates":
    only = set(sys.argv[4].split(",")) if len(sys.argv) > 4 else None
    for name, sh in spec["shots"].items():
        if only and name not in only: continue
        print(f"{name}: {ntok(prompt(name))} tokens", flush=True); ims = []
        for seed in sh["seeds"]:
            t = time.time(); f_ = out / f"{name}_{seed}.png"
            if f_.exists(): im = Image.open(f_).convert("RGB")      # already painted (a resumed run)
            else: im = paint(name, seed); im.save(f_)
            ims.append((seed, im))
            print(f"  {seed}: {time.time() - t:.0f} s, faces {len(faces(im))}", flush=True)
        sheet = Image.new("RGB", (672 * len(ims), 384 + 26), "white"); d = ImageDraw.Draw(sheet)
        for i, (seed, im) in enumerate(ims): sheet.paste(im.resize((668, 382)), (672 * i, 26)); d.text((672 * i + 6, 6), f"{name} seed {seed}", fill=(0, 0, 0))
        sheet.save(out / f"sheet_{name}.jpg", quality=88)
elif mode in ("finish", "test"):
    for pick in sys.argv[4:]:
        name, seed, *alias = pick.split(":"); seed = int(seed); alias = alias[0] if alias else name; t = time.time()
        src = out / f"{name}_{seed}.png"
        if mode == "test" or not src.exists(): paint(name, seed).save(src)
        t1 = time.time()
        im0 = Image.open(src).convert("RGB"); up = spec.get("upscale", 2.0)
        if up != 1: im0 = im0.resize((round(im0.width * up), round(im0.height * up)), Image.LANCZOS)
        sh = spec["shots"][name]
        img, found = face_pass(im0, sh.get("faces", ""), seed, up, sh.get("eyes") == "closed")
        img.save(out / f"final_{alias}.png")
        print(f"{alias} ({name}:{seed}): paint {t1 - t:.0f} s, faces {[round(f[2]) for f in found]} in {time.time() - t1:.0f} s", flush=True)
print("done", flush=True)
