"""Write out/guide_test.html: a standalone page that runs the guide composition (compositions/mc.html) exactly as built,
with its real CUES and LIPS, for the character kit's tools (window.ready, window.seek(t), window.DUR, window.__probe).

usage: python3 work/guide/make_test.py
then:  cd <learning repo>/characters && node tools/moaudit.mjs <this project>/out/guide_test.html
A stand-in for the HyperFrames runtime records the composition's paused GSAP timeline and seeks it. ?bg=1 shows the
nearest film frame without the guide (out/guide_bg) behind him, for quick looks.
"""
import glob, json, os, re

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
mc = open(os.path.join(HERE, "compositions/mc.html"), encoding="utf-8").read()
svg = re.search(r"<svg id=\"mc-sv\".*?</svg>", mc, flags=re.S).group(0)
script = re.search(r"<script>(.*)</script>", mc, flags=re.S).group(1)
# test hook (this page only): expose the built gesture keys for work/guide/qa_aim.mjs
hook = 'window.__timelines["mc"] = tl;'
assert script.count(hook) == 1
script = script.replace(hook, hook + " window.__mcKeys = keys; window.__mcPose = poseAt; window.__mcHead = headK;")
dur = float(re.search(r"const DUR = ([0-9.]+);", mc).group(1))
bgs = []
for f in sorted(glob.glob(os.path.join(HERE, "out/guide_bg/frame-*-at-*s.png"))):
    m = re.search(r"-at-([0-9.]+)s\.png$", f)
    bgs.append([float(m.group(1)), "guide_bg/" + os.path.basename(f)])

page = f"""<!doctype html><html><head><meta charset="utf-8"><title>Guide test</title>
<style>html,body{{margin:0;background:#dfe5f3;width:1080px;height:1920px;overflow:hidden}}#bg{{position:absolute;left:0;top:0;width:1080px;height:1920px;display:none}}#mc-sv{{position:absolute;left:0;top:0}}</style></head><body>
<img id="bg" alt="">
{svg}
<script>
// stand-in for the HyperFrames runtime: records the paused timeline's tweens and seeks them
window.__timelines = {{}};
window.gsap = {{ timeline() {{ return {{ tw: [], fromTo(o, a, b) {{ this.tw.push([o, b]); return this; }},
  seek(t) {{ for (const [o, b] of this.tw) {{ o.t = t; if (b.onUpdate) b.onUpdate(); }} }} }}; }} }};
</script>
<script>{script}</script>
<script>
(function () {{
  const tl = window.__timelines.mc, BG = {json.dumps(bgs)}, img = document.getElementById("bg");
  const showBg = new URLSearchParams(location.search).has("bg");
  window.DUR = {dur};
  window.seek = (t) => {{
    tl.seek(t); window.__t = t;
    if (showBg && BG.length) {{ let b = BG[0]; for (const x of BG) if (Math.abs(x[0] - t) < Math.abs(b[0] - t)) b = x; img.src = b[1]; img.style.display = "block"; }}
  }};
  window.__probe = Kit.probe;
  window.ready = Promise.resolve().then(() => window.seek(0));
}})();
</script></body></html>
"""
out = os.path.join(HERE, "out/guide_test.html")
open(out, "w", encoding="utf-8").write(page)
print(out, len(page), "bytes,", len(bgs), "background frames")
