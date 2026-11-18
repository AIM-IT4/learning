"""v3: one source of truth for the promo's timing and look per scene. Writes the DATA blocks of bg.html, ov.html and every
scene file, and the root index.html (scene hosts, voice, music, sound effects).

usage: python3 tools/timing.py voice/out_puck/timing.json
timing.json (from hyperframes-reels/tools/en_vo.py): {"W": onset of every voice-script word in vo.wav, "VO_END": s}.
Caption lines split the spoken lines where the picture changes, so a caption token may cover several voice words
("Desk2Quant" = "Desk to Quant", "1000+" = "a thousand").
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(HERE, "build")
VO_START = 0.12          # the voice starts this far into the film
LEAD = 0.16              # a scene cuts in this long before its first word
TAIL = 2.0               # the end card holds this long after the last word (time to read the CTA)

# scenes in order: id, theme (L light / D dark, alternating like the reference), how the cut INTO it is made
SCENES = [("s1", "L", None), ("s2", "D", "stair"), ("s3", "L", "stair"), ("s4", "D", "dissolve"), ("s5", "L", "stair"),
          ("s6", "D", "stair"), ("s7", "L", "stair"), ("s8", "D", "stair"), ("s9", "L", "stair"), ("s10", "D", "stair"),
          ("s11", "L", "stair"), ("s12", "D", "stair"), ("s13", "L", "stair"), ("s14", "D", "dissolve"), ("s15", "L", "dissolve")]
THEME = {s: t for s, t, _ in SCENES}

# (caption line, scene, [(caption token, voice words)], accent token indices, rose token indices, hero {i, size})
SCRIPT = [
    ("L1", "s1", [("You", 1), ("can", 1), ("derive", 1), ("the", 1), ("Black–Scholes", 2), ("model.", 1)], [4], [], {"i": 4, "size": 150}),
    ("L2", "s2", [("But", 1), ("can", 1), ("you", 1), ("hedge", 1), ("with", 1), ("it?", 1)], [3], [], {"i": 3, "size": 260}),
    ("L3", "s3", [(w, 1) for w in "If you're preparing for a quant interview, this changes how you study.".split()], [6], [], {"i": 6, "size": 190}),
    ("L4", "s4", [(w, 1) for w in "One simulated path. Hedge it five times, and the error is".split()] + [("2.32", 4)], [], [11], None),
    ("L5", "s4", [("Two", 1), ("hundred", 1), ("times:", 1), ("0.07", 4)], [3], [], {"i": 3, "size": 300}),
    ("L6", "s5", [(w, 1) for w in "Everyone memorises formulas.".split()], [2], [], None),
    ("L7", "s6", [(w, 1) for w in "But formulas were never the hard part. Explaining them under pressure is.".split()], [3], [10], {"i": 10, "size": 200, "c": "r"}),
    ("L8a", "s7", [("Desk2Quant", 3)] + [(w, 1) for w in "trains exactly that.".split()], [0], [], {"i": 0, "size": 170}),
    ("L8b", "s8", [(w, 1) for w in "Built by a practising bank quant.".split()], [4, 5], [], None),
    ("L9", "s9", [(w, 1) for w in "First, notes with the code that runs them.".split()], [4], [], {"i": 4, "size": 270}),
    ("L10", "s10", [("Then", 1), ("the", 1), ("desk:", 1), ("Greeks,", 1), ("P&L", 3), ("explain,", 1), ("XVA,", 3), ("model", 1), ("validation.", 1)], [2], [], {"i": 2, "size": 270}),
    ("L11", "s11", [("Then", 1), ("the", 1), ("interview:", 1), ("1000+", 2), ("problems,", 1), ("with", 1), ("solutions.", 1)], [3], [], {"i": 3, "size": 270}),
    ("L12a", "s12", [(w, 1) for w in "Don't know where to start?".split()], [4], [], None),
    ("L12b", "s13", [("10", 1)] + [(w, 1) for w in "resources are free.".split()], [3], [], {"i": 3, "size": 290}),
    ("L13", "s14", [(w, 1) for w in "Textbooks teach you the model.".split()], [4], [], {"i": 4, "size": 260}),
    ("L14", "s14", [(w, 1) for w in "The desk teaches you what breaks it.".split()], [5], [], {"i": 5, "size": 270}),
    ("L15", "s15", [("Comment", 1), ("FREE,", 1)] + [(w, 1) for w in "and we'll DM you all ten.".split()], [1], [], None),
]


def onsets(timing):
    W = [VO_START + w for w in timing["W"]]
    out, k = {}, 0
    for lid, _, toks, *_ in SCRIPT:
        on = []
        for _, n in toks:
            on.append(round(W[k], 3)); k += n
        out[lid] = on
    assert k == len(W), f"script has {k} voice words, timing has {len(W)}"
    return out, round(VO_START + timing["VO_END"] + TAIL, 2)


def patch(path, data):
    s = open(path, encoding="utf-8").read()
    new, n = re.subn(r"/\*DATA\*/.*?/\*END\*/", lambda m: "/*DATA*/ " + data + " /*END*/", s, flags=re.S)
    if n != 1:
        raise SystemExit(f"{path}: expected one DATA block, found {n}")
    open(path, "w", encoding="utf-8").write(new)


def main():
    on, DUR = onsets(json.load(open(sys.argv[1])))
    first = {}
    for lid, sc, *_ in SCRIPT:
        first.setdefault(sc, on[lid][0])
    ids = [s for s, _, _ in SCENES]
    starts = [0.0] + [round(first[s] - LEAD, 3) for s in ids[1:]]
    win = {s: (starts[i], starts[i + 1] if i + 1 < len(ids) else DUR) for i, s in enumerate(ids)}

    patch(os.path.join(BUILD, "compositions/bg.html"),
          f"const DUR = {DUR}; const SHOTS = {json.dumps([[win[s][0], THEME[s]] for s in ids])};")
    lines = [{"id": lid, "tok": [t for t, _ in toks], "acc": acc, "rose": rose, "on": on[lid], "hero": hero, "theme": THEME[sc]}
             for lid, sc, toks, acc, rose, hero in SCRIPT]
    cuts = [[win[s][0], THEME[s], kind] for s, _, kind in SCENES[1:]]
    patch(os.path.join(BUILD, "compositions/ov.html"),
          f"const DUR = {DUR}; const LINES = {json.dumps(lines, ensure_ascii=False)}; const CUTS = {json.dumps(cuts)};")
    for s in ids:
        a, b = win[s]
        W = [round(t - a, 3) for lid, sc, *_ in SCRIPT if sc == s for t in on[lid]]
        f = os.path.join(BUILD, f"compositions/{s}.html")
        if os.path.exists(f):
            patch(f, f"const DUR = {round(b - a, 3)}; const W = {json.dumps(W)};")

    # sound: a whoosh on every cut (a glitchy one on the dissolves), a thump under every hero word, scene cues
    sfx = [("glitch-1" if kind == "dissolve" else "whoosh-short", round(c - 0.16, 2), 0.6, 0.12 if kind == "dissolve" else 0.13)
           for c, _, kind in cuts]
    for lid, sc, toks, acc, rose, hero in SCRIPT:
        if hero:
            sfx.append(("impact-bass-1", round(on[lid][hero["i"]] - 0.02, 2), 0.9, 0.11))
    l5, l15 = on["L5"], on["L15"]
    sfx += [("key-press", round(l5[0], 2), 0.4, 0.14), ("ping", round(l5[3] + 0.05, 2), 1.0, 0.16),
            ("whoosh", round(on["L14"][0] - 0.05, 2), 0.57, 0.14), ("sparkle", round(on["L14"][5] + 0.05, 2), 1.2, 0.10),
            ("typing", round(l15[0] - 0.1, 2), 1.0, 0.12), ("pop", round(l15[4], 2), 0.5, 0.14), ("chime", round(DUR - 1.3, 2), 1.3, 0.12)]
    # v3 picture beats: the toggle flips, the code's output, four monitors switching on, two stamps
    sfx += [("click-soft", round(on["L3"][8], 2), 0.3, 0.12), ("pop", round(on["L9"][6] - 0.02, 2), 0.5, 0.12),
            ("pop", round(on["L11"][6], 2), 0.5, 0.13), ("pop", round(on["L12a"][4], 2), 0.5, 0.13)]
    sfx += [("click", round(on["L10"][i] - 0.02, 2), 0.3, 0.10) for i in (3, 4, 6, 7)]
    hosts = [f'      <div id="{s}" data-composition-id="{s}" data-composition-src="compositions/{s}.html" data-start="{win[s][0]}" '
             f'data-duration="{round(win[s][1] - win[s][0], 3)}" data-track-index="{2 + i}" data-track-kind="graphics" data-width="1080" '
             f'data-height="1920" style="z-index: 1"></div>' for i, s in enumerate(ids)]
    auds = []
    if os.path.exists(os.path.join(BUILD, "assets/vo.wav")):
        auds.append(f'      <audio id="vo" class="clip" src="assets/vo.wav" data-start="{VO_START}" data-track-index="20" data-volume="1"></audio>')
    if os.path.exists(os.path.join(BUILD, "assets/bgm.wav")):
        auds.append(f'      <audio id="bgm" class="clip" src="assets/bgm.wav" data-start="0" data-duration="{DUR}" data-track-index="21" '
                    f'data-timeline-role="music" data-volume="1" data-fade-in="0.2" data-fade-out="1.2"></audio>')
    for k, (name, t, d, v) in enumerate(sorted(sfx, key=lambda x: x[1])):
        if os.path.exists(os.path.join(BUILD, f"assets/sfx/{name}.mp3")):
            auds.append(f'      <audio id="fx{k:02d}" class="clip" src="assets/sfx/{name}.mp3" data-start="{max(0.0, t)}" data-duration="{d}" '
                        f'data-track-index="{22 + k}" data-volume="{v}"></audio>')
    html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #eceef0; }}
      #root {{ position: relative; width: 100%; height: 100%; background: #eceef0; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1920">
      <div id="bg" data-composition-id="bg" data-composition-src="compositions/bg.html" data-start="0" data-duration="{DUR}"
           data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index: 0"></div>
{chr(10).join(hosts)}
      <div id="ov" data-composition-id="ov" data-composition-src="compositions/ov.html" data-start="0" data-duration="{DUR}"
           data-track-index="18" data-track-kind="captions" data-width="1080" data-height="1920" style="z-index: 2"></div>
{chr(10).join(auds)}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""
    open(os.path.join(BUILD, "index.html"), "w", encoding="utf-8").write(html)
    print(json.dumps({"DUR": DUR, "scenes": {s: [round(win[s][0], 2), round(win[s][1] - win[s][0], 2)] for s in ids}}))


if __name__ == "__main__":
    main()
