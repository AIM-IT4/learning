"""Write a project's root index.html: python3 mkindex.py <proj> <seconds> <bg> '<json list of [id, file, start, dur, vol]>' [vo_start]"""
import json, sys
proj, dur, bg, sfx = sys.argv[1], float(sys.argv[2]), sys.argv[3], json.loads(sys.argv[4]); V = float(sys.argv[5]) if len(sys.argv) > 5 else 0.3
rows = "\n".join(f'      <audio id="{i}" class="clip" src="assets/sfx/{f}.mp3" data-start="{round(s, 2)}" data-duration="{d}" data-track-index="{n + 4}" data-volume="{v}"></audio>'
                 for n, (i, f, s, d, v) in enumerate(sfx))
html = f"""<!doctype html>
<html lang="hi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: {bg}; }}
      #root {{ position: relative; width: 100%; height: 100%; background: {bg}; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{dur}" data-width="1080" data-height="1920">
      <div id="{proj}" data-composition-id="{proj}" data-composition-src="compositions/{proj}.html" data-start="0" data-duration="{dur}"
           data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1920"></div>
      <audio id="vo" class="clip" src="assets/vo.wav" data-start="{V}" data-track-index="2" data-volume="1"></audio>
      <audio id="bgm" class="clip" src="assets/bgm.wav" data-start="0" data-duration="{dur}" data-track-index="3"
             data-timeline-role="music" data-volume="1" data-fade-in="0.3" data-fade-out="1.5"></audio>
{rows}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""
open(f"{proj}/index.html", "w", encoding="utf-8").write(html); print(proj, "index:", dur, "s,", len(sfx), "sfx")
