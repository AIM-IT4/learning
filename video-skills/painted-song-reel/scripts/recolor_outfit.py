"""Recolour one person's outfit in a painting so it matches the cast. In two-person shots the painter sometimes swaps
or changes outfit colours; fix a near-miss instead of painting it again.

  python3 recolor_outfit.py in.png out.png --side right --hues 35-95 --to black
  python3 recolor_outfit.py in.png out.png --side left --hues 18-50 --to shift:46 --value 0.8

--side   left | right | all: whose clothes, split halfway between the two faces YuNet finds
--hues   lo-hi, the OpenCV hue range (0-179) to change: green 35-95, olive / gold 18-50, red 0-10 and 170-179,
         blue 95-130, pink 140-170
--to     black (dark, keeps the gold trim, which falls outside the hue range) or shift:N (turn the hue by N)
--value  brightness factor for the changed pixels (default 1.0; black uses 0.3)
Clothes come from the segformer_b2_clothes parser (upper clothes, skirt, pants, dress, scarf); edges are feathered.
"""
import argparse
import numpy as np, cv2, torch
from PIL import Image
from transformers import SegformerForSemanticSegmentation, SegformerImageProcessor
from huggingface_hub import hf_hub_download

ap = argparse.ArgumentParser()
ap.add_argument("inp"); ap.add_argument("out")
ap.add_argument("--side", default="all", choices=["left", "right", "all"])
ap.add_argument("--hues", default="35-95"); ap.add_argument("--to", default="black"); ap.add_argument("--value", type=float, default=None)
a = ap.parse_args()
im = Image.open(a.inp).convert("RGB"); w, h = im.size
proc = SegformerImageProcessor.from_pretrained("mattmdjaga/segformer_b2_clothes")
model = SegformerForSemanticSegmentation.from_pretrained("mattmdjaga/segformer_b2_clothes").eval()
with torch.no_grad(): lo = model(**proc(images=im, return_tensors="pt")).logits
c = torch.nn.functional.interpolate(lo, size=(h, w), mode="bilinear").argmax(1)[0].numpy()
bgr = cv2.cvtColor(np.array(im), cv2.COLOR_RGB2BGR)
X = np.arange(w)[None, :].repeat(h, 0)
side = np.ones((h, w), bool)
if a.side != "all":
    det = cv2.FaceDetectorYN.create(hf_hub_download("opencv/face_detection_yunet", "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 50)
    det.setInputSize((w, h)); _, f = det.detect(bgr)
    xs = sorted(float(r[0] + r[2] / 2) for r in (f if f is not None else []))
    split = (xs[0] + xs[-1]) / 2 if len(xs) >= 2 else w / 2
    side = X > split if a.side == "right" else X <= split
hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32); H_, S_, V_ = hsv[..., 0], hsv[..., 1], hsv[..., 2]
lo_, hi_ = map(int, a.hues.split("-"))
m = np.isin(c, [4, 5, 6, 7, 17]) & side & (H_ >= lo_) & (H_ <= hi_) & (S_ > 35) & (V_ < 235)
out = hsv.copy()
if a.to == "black":
    out[..., 2] = np.where(m, V_ * (a.value or 0.3), V_); out[..., 1] = np.where(m, S_ * 0.25, S_)
else:
    n = int(a.to.split(":")[1])
    out[..., 0] = np.where(m, (H_ + n) % 180, H_); out[..., 2] = np.where(m, V_ * (a.value or 1.0), V_)
res = cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
mk = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.2)[..., None]
cv2.imwrite(a.out, (res * mk + bgr * (1 - mk)).astype(np.uint8))
print(f"recoloured {int(m.sum())} pixels -> {a.out}")
