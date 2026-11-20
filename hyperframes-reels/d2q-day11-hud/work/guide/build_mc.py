"""Build compositions/mc.html (the guide, D the desk quant) from the Desk2Quant character kit and work/guide/guide_src.js.

usage: D2Q_CHARACTERS=<learning repo>/characters python3 work/guide/build_mc.py
The kit files are inlined verbatim (they attach Hand, Cast, Motion, Gest and Kit to window). The DATA line is kept from the
current compositions/mc.html (tools/timing_hud.py rewrites it), so run timing_hud.py before or after this, in either order.
"""
import os, re

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KIT = os.environ.get("D2Q_CHARACTERS", os.path.join(HERE, "..", "..", "characters"))   # the character kit (learning repo: characters/)
FILES = ["rig/hand.js", "rig/cast.js", "rig/quants.js", "rig/motion.js", "rig/gest.js", "rig/gest2.js", "kit.js"]
MC = os.path.join(HERE, "compositions/mc.html")

data = re.search(r"/\*DATA\*/.*?/\*END\*/", open(MC, encoding="utf-8").read(), flags=re.S).group(0)
src = open(os.path.join(HERE, "work/guide/guide_src.js"), encoding="utf-8").read()
assert "/*DATA*/" not in src and "/*END*/" not in src
kit = []
for f in FILES:
    code = open(os.path.join(KIT, f), encoding="utf-8").read().rstrip()
    assert "/*DATA*/" not in code and "/*END*/" not in code and "</script" not in code
    kit.append(f"    // ---- Desk2Quant character kit: characters/{f} (verbatim)\n{code}\n")

html = f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; overflow: hidden; pointer-events: none; }}
    #mc-sv {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; }}
  </style>
  <div id="root" data-composition-id="mc" data-width="1080" data-height="1920" data-layout-allow-overlap>
    <svg id="mc-sv" width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg"></svg>
  </div>
  <script>
{"".join(kit)}
    (function () {{
      {data}
{src.rstrip()}
    }})();
  </script>
</template>
"""
open(MC, "w", encoding="utf-8").write(html)
print(MC, len(html), "bytes")
