"""Compose compositions/<id>.html for a canvas layer from its code in work/scenes/<id>.js (the d2q-mr-promo pattern):
fonts + root + canvas, the DATA line (kept from the current composition; tools/timing.py writes it), the numbers
(work/numbers.json, inlined as NUM: every number on screen comes from there or from FACTS), the facts (work/facts.json,
inlined as FACTS), the code file (work/cva_reel.py, inlined line by line as CODE: the code on screen is that file), the
shared kit (work/kit.js, global K), then the layer's code (it defines `st`, `draw()` and may define `init()`) and its paused
timeline.
usage: python3 tools/compose.py bg hud code b01 b02 ...     (then run tools/timing.py to fill the DATA lines)"""
import json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
kit = open(os.path.join(HERE, "work/kit.js"), encoding="utf-8").read()
NUM = json.load(open(os.path.join(HERE, "work/numbers.json"), encoding="utf-8"))
FACTS = json.load(open(os.path.join(HERE, "work/facts.json"), encoding="utf-8"))
CODE = open(os.path.join(HERE, "work/cva_reel.py"), encoding="utf-8").read().split("\n")
while CODE and CODE[-1] == "":
    CODE.pop()
assert len(CODE) == 16, len(CODE)

# JetBrains Mono ships as two subsets per weight; one family, each subset on its unicode-range (the fontsource ranges)
LATIN = ("U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, "
         "U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD")
LATINEXT = ("U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, "
            "U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF")
FACES = "\n".join(
    f'    @font-face {{{{ font-family: "JBMono"; font-weight: {w}; src: url("assets/fonts/JetBrainsMono-{w}-{sub}.woff") format("woff"); unicode-range: {rng}; }}}}'
    for w in (400, 700) for sub, rng in (("latin", LATIN), ("latinext", LATINEXT)))

HEAD = """<template>
  <style>
    @font-face {{ font-family: "D2QSans"; font-weight: 100 900; src: url("assets/fonts/D2QSans.ttf"); }}
    @font-face {{ font-family: "D2QSym"; font-weight: 100 900; src: url("assets/fonts/DejaVuSansBold-symbols.ttf"); unicode-range: U+221D, U+2715; }}
""" + FACES + """
    #root {{ position: absolute; inset: 0; overflow: hidden; pointer-events: none;{bg} }}
    #{s}-cv {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; }}
    .{s}-pre {{ position: absolute; left: -999px; top: 0; opacity: 0; font-size: 10px; }}
  </style>
  <div id="root" data-composition-id="{s}" data-width="1080" data-height="1920" data-layout-allow-overlap>
    <canvas id="{s}-cv" width="1080" height="1920"></canvas>
    <span class="{s}-pre" style="font-family: D2QSans; font-weight: 700;">0Aa%→Σ</span><span class="{s}-pre" style="font-family: D2QSym; font-weight: 700;">∝✕</span><span class="{s}-pre" style="font-family: JBMono; font-weight: 400;">0Aa›Ā</span><span class="{s}-pre" style="font-family: JBMono; font-weight: 700;">0Aa›Ā</span>
  </div>
  <script>
    (function () {{
      {data}
      /*NUM*/ const NUM = {num}; const FACTS = {facts}; const CODE = {code}; /*ENDNUM*/
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
    m = re.search(r"/\*DATA\*/.*?/\*END\*/", old, flags=re.S)
    data = m.group(0) if m else "/*DATA*/ const DUR = 1; const T0 = 0; /*END*/"
    code = open(os.path.join(HERE, "work/scenes", s + ".js"), encoding="utf-8").read()
    assert "/*DATA*/" not in code and "/*END*/" not in code and "</script" not in code
    j = lambda v: json.dumps(v, ensure_ascii=False, separators=(",", ":"))
    html = (HEAD.format(s=s, data=data, num=j(NUM), facts=j(FACTS), code=j(CODE), bg=" background: #f3efe6;" if s == "bg" else "")
            + kit + "\n" + code.rstrip() + "\n" + TAIL.format(s=s))
    open(comp, "w", encoding="utf-8").write(html)
    print(f"{s}: composed ({len(html) / 1024:.0f} KB)")
