"""One source of truth for the promo's timing: the script's caption tokens, which scene each line belongs to, and the
measured voice. Writes the DATA blocks of every composition and the root index.html (scene hosts, voice, music, sfx).

usage: python3 tools/timing.py [voice/out/timing.json]
Without a timing file it spreads each line evenly over a placeholder slot (for building before the voice exists).
timing.json (from hyperframes-reels/tools/en_vo.py): {"W": onset of every voice-script word in vo.wav, "VO_END": s}.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(HERE, "build")
VO_START = 0.15          # the voice starts this far into the film
LEAD = 0.18              # a scene cuts in this long before its first word
TAIL = 1.6               # the last frame holds this long after the last word

# (line, scene, [(caption token, voice words)], accent token indices, rose token indices, hero {i, size})
SCRIPT = [
    ("L1", "s1", [("You", 1), ("can", 1), ("derive", 1), ("the", 1), ("Black–Scholes", 2), ("model.", 1)], [4], [], None),
    ("L2", "s1", [("But", 1), ("can", 1), ("you", 1), ("hedge", 1), ("with", 1), ("it?", 1)], [3], [], {"i": 3, "size": 250}),
    ("L3", "s2", [(w, 1) for w in "If you're preparing for a quant interview, this changes how you study.".split()], [6], [], {"i": 6, "size": 170}),
    ("L4", "s3", [(w, 1) for w in "One simulated path. Hedge it five times, and the error is".split()] + [("2.32", 4)], [], [11], None),
    ("L5", "s3", [("Two", 1), ("hundred", 1), ("times:", 1), ("0.07", 4)], [3], [], {"i": 3, "size": 300}),
    ("L6", "s4", [(w, 1) for w in "Everyone memorises formulas.".split()], [], [], None),
    ("L7", "s4", [(w, 1) for w in "But formulas were never the hard part. Explaining them under pressure is.".split()], [10], [], {"i": 10, "size": 180}),
    ("L8", "s5", [("Desk2Quant", 3)] + [(w, 1) for w in "trains exactly that. Built by a practising bank quant.".split()], [0], [], {"i": 0, "size": 150}),
    ("L9", "s6", [(w, 1) for w in "First, notes with the code that runs them.".split()], [4], [], {"i": 4, "size": 260}),
    ("L10", "s7", [("Then", 1), ("the", 1), ("desk:", 1), ("Greeks,", 1), ("P&L", 3), ("explain,", 1), ("XVA,", 3), ("model", 1), ("validation.", 1)], [2], [], {"i": 2, "size": 260}),
    ("L11", "s8", [("Then", 1), ("the", 1), ("interview:", 1), ("1000+", 2), ("problems,", 1), ("with", 1), ("solutions.", 1)], [3], [], {"i": 3, "size": 260}),
    ("L12", "s9", [(w, 1) for w in "Don't know where to start?".split()] + [("10", 1)] + [(w, 1) for w in "resources are free.".split()], [8], [], {"i": 8, "size": 270}),
    ("L13", "s10", [(w, 1) for w in "Textbooks teach you the model.".split()], [4], [], {"i": 4, "size": 250}),
    ("L14", "s10", [(w, 1) for w in "The desk teaches you what breaks it.".split()], [5], [], {"i": 5, "size": 260}),
    ("L15", "s11", [("Comment", 1), ("FREE,", 1)] + [(w, 1) for w in "and we'll DM you all ten.".split()], [1], [], None),
]
SCENES = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11"]
BG = {s: ("A" if i % 2 == 0 else "B") for i, s in enumerate(SCENES)}
# placeholder slots (film seconds) used until the voice is measured
PLACE = {"L1": (0.15, 1.9), "L2": (2.1, 3.8), "L3": (4.1, 7.3), "L4": (7.6, 11.6), "L5": (11.9, 14.0), "L6": (14.7, 16.3),
         "L7": (16.5, 19.4), "L8": (19.7, 22.6), "L9": (22.9, 25.4), "L10": (25.7, 29.4), "L11": (29.7, 32.4),
         "L12": (32.7, 35.8), "L13": (36.1, 37.9), "L14": (38.3, 40.6), "L15": (41.3, 44.8)}


def onsets(timing):
    """Film-time onset of every caption token, line by line, plus the film's end."""
    out = {}
    if timing:
        W = [VO_START + w for w in timing["W"]]
        k = 0
        for lid, _, toks, *_ in SCRIPT:
            on = []
            for _, n in toks:
                on.append(round(W[k], 3)); k += n
            out[lid] = on
        assert k == len(W), f"script has {k} voice words, timing has {len(W)}"
        end = round(VO_START + timing["VO_END"] + TAIL, 2)
    else:
        for lid, _, toks, *_ in SCRIPT:
            a, b = PLACE[lid]; n = sum(c for _, c in toks); per = (b - a) / n; k = 0; on = []
            for _, c in toks:
                on.append(round(a + k * per, 3)); k += c
            out[lid] = on
        end = 45.6
    return out, end


def patch(path, data):
    s = open(path, encoding="utf-8").read()
    new, n = re.subn(r"/\*DATA\*/.*?/\*END\*/", lambda m: "/*DATA*/ " + data + " /*END*/", s, flags=re.S)
    if n != 1:
        raise SystemExit(f"{path}: expected one DATA block, found {n}")
    open(path, "w", encoding="utf-8").write(new)


def main():
    timing = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else None
    on, DUR = onsets(timing)
    # scene windows: each scene starts LEAD before its first word (the first at 0), ends where the next starts
    first = {}
    for lid, sc, *_ in SCRIPT:
        first.setdefault(sc, on[lid][0])
    starts = [0.0] + [round(first[s] - LEAD, 3) for s in SCENES[1:]]
    win = {s: (starts[i], starts[i + 1] if i + 1 < len(SCENES) else DUR) for i, s in enumerate(SCENES)}

    # background and overlay
    patch(os.path.join(BUILD, "compositions/bg.html"),
          f"const DUR = {DUR}; const SHOTS = {json.dumps([[win[s][0], BG[s]] for s in SCENES])};")
    lines = []
    for lid, sc, toks, acc, rose, hero in SCRIPT:
        lines.append({"id": lid, "tok": [t for t, _ in toks], "acc": acc, "rose": rose, "on": on[lid], "hero": hero})
    cuts = [[win[s][0], BG[s]] for s in SCENES[1:]]
    patch(os.path.join(BUILD, "compositions/ov.html"),
          f"const DUR = {DUR}; const LINES = {json.dumps(lines, ensure_ascii=False)}; const CUTS = {json.dumps(cuts)};")

    # every scene gets its own window length and its words' onsets in scene time
    for s in SCENES:
        a, b = win[s]
        W = [round(t - a, 3) for lid, sc, *_ in SCRIPT if sc == s for t in on[lid]]
        f = os.path.join(BUILD, f"compositions/{s}.html")
        if os.path.exists(f):
            patch(f, f"const DUR = {round(b - a, 3)}; const W = {json.dumps(W)};")

    # sound: a whoosh on every cut, a soft thump under every hero word, the scene cues
    sfx = [("whoosh-short", round(c - 0.18, 2), 0.6, 0.13) for c, _ in cuts]
    for lid, sc, toks, acc, rose, hero in SCRIPT:
        if hero:
            sfx.append(("impact-bass-1", round(on[lid][hero["i"]] - 0.02, 2), 0.9, 0.10))
    s3 = on["L5"]; s15 = on["L15"]
    sfx += [("ping", round(s3[3] + 0.05, 2), 1.0, 0.16), ("key-press", round(s3[0], 2), 0.4, 0.14),
            ("whoosh", round(on["L14"][0] - 0.05, 2), 0.8, 0.14), ("sparkle", round(on["L14"][0] + 0.15, 2), 1.2, 0.10),
            ("typing", round(s15[0] - 0.1, 2), 1.0, 0.12), ("pop", round(s15[4], 2), 0.5, 0.14), ("chime", round(DUR - 1.4, 2), 1.4, 0.12)]
    hosts = []
    for i, s in enumerate(SCENES):
        a, b = win[s]
        hosts.append(f'      <div id="{s}" data-composition-id="{s}" data-composition-src="compositions/{s}.html" data-start="{a}" '
                     f'data-duration="{round(b - a, 3)}" data-track-index="{2 + i}" data-track-kind="graphics" data-width="1080" '
                     f'data-height="1920" style="z-index: 1"></div>')
    auds = [f'      <audio id="vo" class="clip" src="assets/vo.wav" data-start="{VO_START}" data-track-index="20" data-volume="1"></audio>',
            f'      <audio id="bgm" class="clip" src="assets/bgm.wav" data-start="0" data-duration="{DUR}" data-track-index="21" '
            f'data-timeline-role="music" data-volume="1" data-fade-in="0.3" data-fade-out="1.5"></audio>']
    for k, (name, t, d, v) in enumerate(sorted(sfx, key=lambda x: x[1])):
        auds.append(f'      <audio id="fx{k:02d}" class="clip" src="assets/sfx/{name}.mp3" data-start="{max(0.0, t)}" data-duration="{d}" '
                    f'data-track-index="{22 + k}" data-volume="{v}"></audio>')
    have_vo = os.path.exists(os.path.join(BUILD, "assets/vo.wav")); have_bgm = os.path.exists(os.path.join(BUILD, "assets/bgm.wav"))
    if not have_vo: auds = [a for a in auds if 'id="vo"' not in a]
    if not have_bgm: auds = [a for a in auds if 'id="bgm"' not in a]
    html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #eef3f8; }}
      #root {{ position: relative; width: 100%; height: 100%; background: #eef3f8; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1920">
      <div id="bg" data-composition-id="bg" data-composition-src="compositions/bg.html" data-start="0" data-duration="{DUR}"
           data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index: 0"></div>
{chr(10).join(hosts)}
      <div id="ov" data-composition-id="ov" data-composition-src="compositions/ov.html" data-start="0" data-duration="{DUR}"
           data-track-index="14" data-track-kind="captions" data-width="1080" data-height="1920" style="z-index: 2"></div>
{chr(10).join(auds)}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""
    open(os.path.join(BUILD, "index.html"), "w", encoding="utf-8").write(html)
    print(json.dumps({"DUR": DUR, "scenes": {s: [round(win[s][0], 2), round(win[s][1] - win[s][0], 2)] for s in SCENES}}))


if __name__ == "__main__":
    main()
