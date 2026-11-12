"""Write measured word onsets into the compounding reel: patch CAPS / CAP_END in compositions/compound.html and rewrite
index.html with each sound effect on its cue. usage: python3 apply_compound.py <project_dir> cues.json
cues.json: {"CAPS": [[onsets of line 1], ...5 lines], "CAP_END": [5 values], "vo_len": seconds}"""
import json, re, sys

proj, cues = sys.argv[1], json.load(open(sys.argv[2], encoding="utf-8"))
CAPS, CAP_END, VO = cues["CAPS"], cues["CAP_END"], cues["vo_len"]
V = 0.2
assert [len(c) for c in CAPS] == [8, 9, 14, 10, 8], [len(c) for c in CAPS]

comp = f"{proj}/compositions/compound.html"
src = open(comp, encoding="utf-8").read()
caps = "const CAPS = [\n" + "".join("        [" + ", ".join(str(x) for x in c) + "],\n" for c in CAPS) + "      ];"
src = re.sub(r"const CAPS = \[.*?\n      \];", lambda m: caps, src, flags=re.S)
src = re.sub(r"const CAP_END = \[[^\]]*\];", "const CAP_END = [" + ", ".join(str(x) for x in CAP_END) + "];", src)
open(comp, "w", encoding="utf-8").write(src)

W = lambda p, i: CAPS[p][i] + V
C = dict(coin=W(0, 7), rate=W(2, 1), grow=W(2, 4), payoff=W(2, 12), gain=W(3, 1), magic=W(4, 2), start=W(4, 5))
end = round(max(V + VO + 2.2, C["start"] + 0.5 + 4.0), 1)   # the disclaimer gets 4 s
sfx = [  # id, file, film time, duration, volume, offset into the file
    ("sfx-coin", "pop", C["coin"] + 0.1, 0.72, 0.45, 0),
    ("sfx-rate", "click-soft", C["rate"], 0.36, 0.5, 0),
    ("sfx-riser", "riser", C["payoff"] - 2.25, 2.5, 0.3, 1.0),   # the riser peaks 3.25 s into its file: on the payoff word
    ("sfx-hit", "impact-bass-1", C["payoff"], 1.6, 0.5, 0),
    ("sfx-gain", "pop", C["gain"], 0.72, 0.4, 0),
    ("sfx-magic", "sparkle", C["magic"], 1.6, 0.4, 0),
]
rows = "\n".join(
    f'      <audio id="{i}" class="clip" src="assets/sfx/{f}.mp3" data-start="{round(s, 2)}" data-duration="{round(d, 2)}" '
    + (f'data-media-start="{ms}" ' if ms else "") +
    f'data-track-index="{n + 4}" data-volume="{v}"></audio>' for n, (i, f, s, d, v, ms) in enumerate(sfx))
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
      <div id="compound" data-composition-id="compound" data-composition-src="compositions/compound.html" data-start="0" data-duration="{end}"
           data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1920"></div>
      <audio id="vo" class="clip" src="assets/vo.wav" data-start="{V}" data-track-index="2" data-volume="1"></audio>
      <audio id="bgm" class="clip" src="assets/bgm.wav" data-start="0" data-duration="{end}" data-track-index="3"
             data-timeline-role="music" data-volume="1" data-fade-in="0.4" data-fade-out="1.5"></audio>
{rows}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""
open(f"{proj}/index.html", "w", encoding="utf-8").write(html)
print("compound: length", end, "s; cues", {k: round(v, 2) for k, v in C.items()})
