"""Compose compositions/<id>.html for a canvas layer from its code in work/scenes/<id>.js:
fonts + root + canvas, the DATA line (kept from the current composition; tools/timing.py writes it), the numbers and
formulas the code names (`const NUM_KEYS = [...]`, `const TEX_IDS = [...]` on their own lines: filled from
work/numbers.json and work/formulas.json, both copied unchanged from d2q-day11-hud), the shared kit (work/kit.js, global
K), then the layer's code (it defines `st`, `draw()` and may define `init()`) and its paused timeline.
usage: python3 tools/compose.py bg hud ov s1 s3 ...     (then run tools/timing.py to fill the DATA lines)"""
import json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
kit = open(os.path.join(HERE, "work/kit.js"), encoding="utf-8").read()
NUMS = json.load(open(os.path.join(HERE, "work/numbers.json"), encoding="utf-8"))
FORM = json.load(open(os.path.join(HERE, "work/formulas.json"), encoding="utf-8"))

HEAD = """<template>
  <style>
    @font-face {{ font-family: "D2QSans"; font-weight: 100 900; src: url("assets/fonts/D2QSans.ttf"); }}
    @font-face {{ font-family: "ShareTechMono"; font-weight: 400; src: url("assets/fonts/sharetechmono.woff2"); }}
    #root {{ position: absolute; inset: 0; overflow: hidden; pointer-events: none;{bg} }}
    #{s}-cv {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; }}
    .{s}-pre {{ position: absolute; left: -999px; top: 0; opacity: 0; font-size: 10px; }}
  </style>
  <div id="root" data-composition-id="{s}" data-width="1080" data-height="1920" data-layout-allow-overlap>
    <canvas id="{s}-cv" width="1080" height="1920"></canvas>
    <span class="{s}-pre" style="font-family: D2QSans; font-weight: 700;">0Aaσ</span><span class="{s}-pre" style="font-family: ShareTechMono;">0Aa</span>
  </div>
  <script>
    (function () {{
      {data}
      /*NUM*/ const NUM = {num}; /*ENDNUM*/
      /*TEX*/ const TEX = {tex}; /*ENDTEX*/
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


def names(code, key):
    m = re.search(r"^\s*const " + key + r" = (\[[^\]]*\]);\s*$", code, re.M)
    if not m:
        return [], code
    return json.loads(m.group(1).replace("'", '"')), code.replace(m.group(0), "")


for s in sys.argv[1:]:
    comp = os.path.join(HERE, "compositions", s + ".html")
    old = open(comp, encoding="utf-8").read() if os.path.exists(comp) else ""
    m = re.search(r"/\*DATA\*/.*?/\*END\*/", old, flags=re.S)
    data = m.group(0) if m else "/*DATA*/ const DUR = 1; /*END*/"
    code = open(os.path.join(HERE, "work/scenes", s + ".js"), encoding="utf-8").read()
    assert "/*DATA*/" not in code and "/*END*/" not in code and "</script" not in code
    keys, code = names(code, "NUM_KEYS")
    ids, code = names(code, "TEX_IDS")
    miss = [k for k in keys if k not in NUMS] + [i for i in ids if i not in FORM]
    assert not miss, (s, miss)
    num = json.dumps({k: NUMS[k] for k in keys}, ensure_ascii=False, separators=(",", ":"))
    tex = json.dumps({i: FORM[i] for i in ids}, ensure_ascii=False, separators=(",", ":"))
    html = HEAD.format(s=s, data=data, num=num, tex=tex, bg=" background: #f3efe6;" if s == "bg" else "") + kit + "\n" + code.rstrip() + "\n" + TAIL.format(s=s)
    open(comp, "w", encoding="utf-8").write(html)
    print(f"{s}: composed ({len(html) / 1024:.0f} KB; numbers {keys}; formulas {ids})")
