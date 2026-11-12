"""Contact sheet of the final paintings with a 10% grid and the faces YuNet finds (normalised centres), for setting
the camera targets in build_painted.py.   python3 grid.py <dir> <out.jpg> name name ...
"""
import sys, cv2, numpy as np
from pathlib import Path
from PIL import Image, ImageDraw
from huggingface_hub import hf_hub_download
D, OUT, names = Path(sys.argv[1]), sys.argv[2], sys.argv[3:]
Y = cv2.FaceDetectorYN.create(hf_hub_download("opencv/face_detection_yunet", "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.55, 0.3, 50)
TW, TH, cols = 640, 366, 3
rows = (len(names) + cols - 1) // cols
sheet = Image.new("RGB", (TW * cols, (TH + 22) * rows), "white"); d = ImageDraw.Draw(sheet)
for i, n in enumerate(names):
    im = Image.open(D / f"final_{n}.png").convert("RGB"); w, h = im.size
    a = cv2.cvtColor(np.array(im), cv2.COLOR_RGB2BGR); Y.setInputSize((w, h)); _, f = Y.detect(a)
    fs = [] if f is None else [r[:4] for r in f]
    t = im.resize((TW, TH)); g = ImageDraw.Draw(t)
    for k in range(1, 10):
        col = (255, 255, 0) if k == 5 else (255, 255, 255)
        g.line([(TW * k / 10, 0), (TW * k / 10, TH)], fill=col, width=1); g.line([(0, TH * k / 10), (TW, TH * k / 10)], fill=col, width=1)
        g.text((TW * k / 10 + 2, 2), f".{k}", fill=(255, 255, 255)); g.text((2, TH * k / 10 + 2), f".{k}", fill=(255, 255, 255))
    lab = []
    for (x, y, fw, fh) in fs:
        g.rectangle([x / w * TW, y / h * TH, (x + fw) / w * TW, (y + fh) / h * TH], outline=(255, 0, 0), width=2)
        lab.append(f"({(x + fw / 2) / w:.2f},{(y + fh / 2) / h:.2f}) {fw:.0f}px")
    x0, y0 = TW * (i % cols), (TH + 22) * (i // cols)
    sheet.paste(t, (x0, y0 + 22)); d.text((x0 + 4, y0 + 5), f"{n}  faces: {' '.join(lab) or '-'}", fill=(0, 0, 0))
    print(n, im.size, lab, flush=True)
sheet.save(OUT, quality=88)
