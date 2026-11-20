"""Compose compositions/sN.html from the scene's own code in work/scenes/sN.js:
  fonts + root + canvas, the DATA line (kept from the current composition: tools/timing_hud.py maintains it),
  the scene's TEX_IDS / NUM_KEYS lines and their TEX / NUM blocks (filled from work/formulas.json and work/numbers.json),
  the HOLOHUD engine (work/holohud.js), the QC chart kit (work/qchart.js), then the scene code and its timeline.
The scene code defines `draw()` reading `st.t` (seconds into the scene) and may use `init()`; it must not register the
timeline itself. usage: python3 tools/compose.py s3 [s8 ...]   (then run tools/final_pass.py)"""
import json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
holo = open(os.path.join(HERE, "work/holohud.js"), encoding="utf-8").read()
qc = open(os.path.join(HERE, "work/qchart.js"), encoding="utf-8").read()
FORM = json.load(open(os.path.join(HERE, "work/formulas.json"), encoding="utf-8"))
NUMS = json.load(open(os.path.join(HERE, "work/numbers.json"), encoding="utf-8"))

HEAD = """<template>
  <style>
    @font-face {{ font-family: "Fredoka"; font-weight: 300 700; src: url("assets/fonts/fredoka-700.woff2"); }}
    @font-face {{ font-family: "ShareTechMono"; font-weight: 400; src: url("assets/fonts/sharetechmono.woff2"); }}
    @font-face {{ font-family: "D2QSans"; font-weight: 100 900; src: url("assets/fonts/D2QSans.ttf"); }}
    #root {{ position: absolute; inset: 0; overflow: hidden; }}
    #{s}-cv {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; }}
  </style>
  <div id="root" data-composition-id="{s}" data-width="1080" data-height="1920">
    <canvas id="{s}-cv" width="1080" height="1920"></canvas>
  </div>
  <script>
    (function () {{
      {data}
      {ids}
      {keys}
      /*TEX*/ const TEX = {tex}; /*ENDTEX*/
      /*NUM*/ const NUM = {num}; /*ENDNUM*/
"""
TAIL = """      if (typeof init === "function") init();     // before the tween: fromTo renders (and draws) at once
      const tl = gsap.timeline({{ paused: true }});
      tl.fromTo(st, {{ t: 0 }}, {{ t: DUR, duration: DUR, ease: "none", onUpdate: draw }}, 0);
      draw();
      window.__timelines["{s}"] = tl;
    }})();
  </script>
</template>
"""

for s in sys.argv[1:]:
    comp = os.path.join(HERE, "compositions", s + ".html")
    old = open(comp, encoding="utf-8").read() if os.path.exists(comp) else ""
    m = re.search(r"/\*DATA\*/.*?/\*END\*/", old)
    assert m, f"{s}: no DATA line in the current composition"
    code = open(os.path.join(HERE, "work/scenes", s + ".js"), encoding="utf-8").read()
    mi = re.search(r"^\s*const TEX_IDS = (\[[^\]]*\]);\s*$", code, re.M)
    mk = re.search(r"^\s*const NUM_KEYS = (\[[^\]]*\]);\s*$", code, re.M)
    assert mi and mk, f"{s}: the scene code must declare TEX_IDS and NUM_KEYS on their own lines"
    ids = json.loads(mi.group(1).replace("'", '"')); keys = json.loads(mk.group(1).replace("'", '"'))
    body = code.replace(mi.group(0), "").replace(mk.group(0), "")
    html = HEAD.format(s=s, data=m.group(0), ids=mi.group(0).strip(), keys=mk.group(0).strip(),
                       tex=json.dumps({i: FORM[i] for i in ids}, ensure_ascii=False),
                       num=json.dumps({k: NUMS[k] for k in keys}, ensure_ascii=False, separators=(",", ":")))
    html += holo + qc + body.rstrip() + "\n" + TAIL.format(s=s)
    open(comp, "w", encoding="utf-8").write(html)
    print(f"{s}: composed ({len(html) / 1024:.0f} KB; formulas {ids}; numbers {keys})")
