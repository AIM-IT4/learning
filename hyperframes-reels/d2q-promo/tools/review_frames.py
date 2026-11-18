"""Snapshot times for reviewing scenes at the real voice timing, and a labelled sheet per scene.
usage: python3 tools/review_frames.py times s4 s5 s6          -> prints the film times to snapshot (comma list)
       python3 tools/review_frames.py sheet <snapdir> s4 s5 s6 -> out/check/shots/<scene>_review.jpg with the words spoken
The times: scene start + 0.12, every line start, every hero word + 0.1 (the slam), the midpoints, and scene end - 0.12."""
import glob, json, os, re, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(HERE, "build")


def load():
    ov = open(os.path.join(B, "compositions/ov.html"), encoding="utf-8").read()
    lines = json.loads(re.search(r"const LINES = (\[.*?\]); const CUTS", ov, re.S).group(1))
    idx = open(os.path.join(B, "index.html"), encoding="utf-8").read()
    win = {m.group(1): (float(m.group(2)), float(m.group(3))) for m in
           re.finditer(r'<div id="(s\d+)" [^>]*data-start="([\d.]+)" data-duration="([\d.]+)"', idx)}
    return lines, win


def times_for(scene, lines, win):
    a, d = win[scene]; b = a + d
    sc_lines = [L for L in lines if a - 0.3 <= L["on"][0] < b]
    ts = [a + 0.12, b - 0.12]
    for L in sc_lines:
        ts.append(L["on"][0] + 0.05)
        if L.get("hero"): ts.append(L["on"][L["hero"]["i"]] + 0.12)
        ts.append(L["on"][len(L["on"]) // 2] + 0.1)
    ts = sorted(set(round(min(max(t, a + 0.05), b - 0.05), 2) for t in ts))
    out = []
    for t in ts:
        if not out or t - out[-1] > 0.25: out.append(t)
    return out


def said(t, lines):
    for L in lines:
        if L["on"][0] - 0.1 <= t <= L["on"][-1] + 1.2:
            k = sum(1 for o in L["on"] if o <= t)
            return " ".join(L["tok"][:k]) + "  ‖ " + " ".join(L["tok"][k:])
    return "(between lines)"


def main():
    lines, win = load()
    if sys.argv[1] == "times":
        print(",".join(str(t) for s in sys.argv[2:] for t in times_for(s, lines, win)))
        return
    snap = sys.argv[2]
    F = ImageFont.truetype(os.path.join(B, "assets/fonts/Inter.ttf"), 26)
    os.makedirs(os.path.join(HERE, "out/check/shots"), exist_ok=True)
    pngs = {float(re.search(r"at-([\d.]+)s", p).group(1)): p for p in glob.glob(os.path.join(snap, "*.png"))}
    for s in sys.argv[3:]:
        ts = [t for t in times_for(s, lines, win) if any(abs(t - k) < 0.011 for k in pngs)]
        ims = []
        for t in ts:
            k = min(pngs, key=lambda x: abs(x - t))
            im = Image.open(pngs[k]).convert("RGB").resize((432, 768), Image.LANCZOS)
            c = Image.new("RGB", (432, 868), (15, 23, 42)); c.paste(im, (0, 100)); d = ImageDraw.Draw(c)
            d.text((10, 8), f"{s}  t={t:.2f}s", font=F, fill=(103, 214, 207))
            words = said(t, lines); d.text((10, 44), words[:34], font=F, fill=(226, 232, 240)); d.text((10, 72), words[34:68], font=F, fill=(226, 232, 240))
            ims.append(c)
        if not ims: continue
        sheet = Image.new("RGB", (432 * len(ims) + 8 * (len(ims) - 1), 868), (255, 255, 255))
        for i, im in enumerate(ims): sheet.paste(im, (i * 440, 0))
        out = os.path.join(HERE, f"out/check/shots/{s}_review.jpg"); sheet.save(out, quality=88)
        print(out, len(ims), "frames:", ", ".join(f"{t:.2f}" for t in ts))


if __name__ == "__main__":
    main()
