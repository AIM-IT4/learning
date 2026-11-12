"""Write measured word onsets into the kinetic reel: patch K1/K2 in compositions/kinetic.html and (re)write index.html
with every sound effect placed on its cue. usage: python3 apply_kinetic.py <project_dir> cues.json
cues.json: {"K1": {...}, "K2": {...}, "vo_len": seconds}"""
import json, re, sys

proj, cues = sys.argv[1], json.load(open(sys.argv[2], encoding="utf-8"))
K1, K2, VO = cues["K1"], cues["K2"], cues["vo_len"]
V = 0.2
t = lambda x: round(x + V, 2)

comp = f"{proj}/compositions/kinetic.html"
src = open(comp, encoding="utf-8").read()
fmt = lambda d: "{ " + ", ".join(f"{k}: {v}" for k, v in d.items()) + " }"
src = re.sub(r"const K1 = \{[^}]*\};", f"const K1 = {fmt(K1)};", src)
src = re.sub(r"const K2 = \{[^}]*\};", f"const K2 = {fmt(K2)};", src, flags=re.S)
open(comp, "w", encoding="utf-8").write(src)

beat = (K1["par"] - K1["ek"]) / 2
end = round(max(V + VO + 2.4, t(K2["frame"]) + 3.9), 1)   # hold the last line, the counter runs 3.6 s
sfx = [  # id, file, film time, duration, volume
    ("sfx-whip1", "whoosh-short", t(K1["to"]) - 0.12, 0.6, 0.35),
    ("sfx-whip2", "whoosh-short", t(K1["bolti"]) - 0.14, 0.6, 0.3),
    ("sfx-beat1", "key-press", t(K1["ek"]), 0.45, 0.55),
    ("sfx-beat2", "key-press", t(K1["ek"]) + beat, 0.45, 0.55),
    ("sfx-beat3", "key-press", t(K1["ek"]) + 2 * beat, 0.45, 0.6),
    ("sfx-spin", "whoosh", t(K2["ghoom"]) + 0.05, 0.6, 0.3),
    ("sfx-rang", "pop", t(K2["rang"]) - 0.05, 0.72, 0.4),
    ("sfx-scatter", "glitch-1", t(K2["bikh"]) + 0.18, 0.7, 0.22),
    ("sfx-join", "pop", t(K2["jud"]), 0.72, 0.4),
    ("sfx-motion", "impact-bass-2", t(K2["motion"]) - 0.08, 1.8, 0.45),
    ("sfx-type", "typing", t(K2["code"]), 1.0, 0.35),
    ("sfx-tick", "click", t(K2["frame"]), 0.37, 0.4),
]
rows = "\n".join(
    f'      <audio id="{i}" class="clip" src="assets/sfx/{f}.mp3" data-start="{round(s, 2)}" data-duration="{d}" '
    f'data-track-index="{n + 4}" data-volume="{v}"></audio>' for n, (i, f, s, d, v) in enumerate(sfx))
html = f"""<!doctype html>
<html lang="hi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #f7f7f3; }}
      #root {{ position: relative; width: 100%; height: 100%; background: #f7f7f3; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{end}" data-width="1080" data-height="1920">
      <div id="kinetic" data-composition-id="kinetic" data-composition-src="compositions/kinetic.html" data-start="0" data-duration="{end}"
           data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1920"></div>
      <audio id="vo" class="clip" src="assets/vo.wav" data-start="{V}" data-track-index="2" data-volume="1"></audio>
      <audio id="bgm" class="clip" src="assets/bgm.wav" data-start="0" data-duration="{end}" data-track-index="3"
             data-timeline-role="music" data-volume="1" data-fade-in="0.3" data-fade-out="1.5"></audio>
{rows}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""
open(f"{proj}/index.html", "w", encoding="utf-8").write(html)
print("kinetic: length", end, "s;", len(sfx), "sfx; beat", round(beat, 3))
