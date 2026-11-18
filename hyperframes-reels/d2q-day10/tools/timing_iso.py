"""Day 10 (gamma vs theta), isometric desk world: one source of truth for timing and look per scene. Writes the DATA
blocks of bg.html, ov.html and every scene file, and the root index.html (scene hosts, voice, music, sound effects).

usage: python3 tools/timing_day10.py voice/out/timing.json
timing.json (en_vo.py): {"W": onset of every spoken word in vo.wav, "VO_END": s}. A caption token may cover several
spoken words ("0.54" = "zero point five four", "₹16" = "sixteen rupees", "Desk2Quant" = "Desk to Quant").
The voice reads "You own a call." (the script's "Say" was not spoken), so the caption says exactly that.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(HERE, "build_iso")
VO_START = 0.12
LEAD = 0.16
TAIL = 2.0

# id, theme (L light / D dark), how the cut INTO it is made
SCENES = [("s1", "L", None)] + [(f"s{i}", "L", "tiles" if i in (7, 12, 16) else "flip") for i in range(2, 17)]   # cube flips; tile cascades at the chapter breaks
THEME = {s: t for s, t, _ in SCENES}


def W1(text):
    return [(w, 1) for w in text.split()]


# (caption line, scene, [(caption token, spoken words)], accent token indices, rose token indices, hero {i, size[, c]})
SCRIPT = [
    ("L1", "s1", W1("You know how to") + [("delta-hedge.", 2)], [4], [], {"i": 4, "size": 150}),
    ("L2a", "s2", W1("Then the interviewer asks:"), [], [], None),
    ("L2b", "s2", W1("your hedge is perfect, so why does your") + [("P&L", 3)] + W1("still move every day?"), [8], [], {"i": 10, "size": 260}),
    ("L3a", "s3", W1("You own a call."), [], [], {"i": 3, "size": 280}),
    ("L3b", "s3", W1("The stock is at") + [("100,", 2)] + W1("the strike is") + [("100,", 2)], [4, 8], [], None),
    ("L3c", "s3", W1("volatility is") + [("20%,", 2)] + W1("and it expires in one year."), [2], [], None),
    ("L4", "s4", W1("Its delta is") + [("0.54,", 4)] + W1("so you hedge by shorting") + [("0.54", 4), ("shares.", 1)], [9], [], {"i": 3, "size": 300}),
    ("L5", "s5", W1("Now the stock jumps") + [("2%.", 2)], [], [], {"i": 4, "size": 320}),
    ("L6", "s5", W1("The call gains") + [("1.12,", 4)] + W1("and the hedge loses") + [("1.08.", 4)] + W1("So you're up."), [3], [8], {"i": 11, "size": 300}),
    ("L7", "s6", W1("If the stock drops") + [("2%", 2)] + W1("instead, you're still up."), [8], [3], None),
    ("L8", "s6", W1("You win both ways. Why?"), [3], [], {"i": 2, "size": 300}),
    ("L9", "s7", W1("Because the call's price is a curve, not a straight line."), [], [], {"i": 6, "size": 280}),
    ("L10", "s7", W1("When the stock rises, delta grows. When it falls, delta shrinks."), [5], [10], None),
    ("L11", "s7", W1("That bend is gamma."), [], [], {"i": 3, "size": 280}),
    ("L12a", "s8", W1("But nothing is free."), [], [], {"i": 3, "size": 300}),
    ("L12b", "s8", W1("Every day, the call loses a little value. That's theta."), [], [4], {"i": 9, "size": 280}),
    ("L13", "s9", W1("On a thousand calls, it costs you about") + [("₹16", 2)] + W1("a day."), [], [8], {"i": 8, "size": 320, "c": "r"}),
    ("L14", "s10", W1("So when do you actually win?"), [5], [], None),
    ("L15", "s10", W1("When the stock moves more than") + [("1.26%", 5)] + W1("in a day, up or down."), [], [], {"i": 6, "size": 260}),
    ("L16", "s11", W1("That's") + [("20%", 2)] + W1("divided by") + [("16.", 1)] + W1("Traders call it the rule of") + [("16.", 1)], [9], [], {"i": 11, "size": 360}),
    ("L17", "s12", W1("Now simulate a year of daily hedging."), [], [], {"i": 3, "size": 300}),
    ("L18", "s12", W1("Big days pay you, and quiet days cost you rent."), [2], [9], None),
    ("L19", "s13", W1("If the stock really moves") + [("20%", 2)] + W1("a year, you end up near zero."), [], [], {"i": 12, "size": 300}),
    ("L20", "s13", W1("At") + [("30%,", 2)] + W1("you profit. At") + [("10%,", 2)] + W1("you lose."), [3], [7], None),
    ("L21", "s14", W1("So here's the answer: a") + [("delta-hedged", 2)] + W1("call is a bet on volatility."), [], [], {"i": 11, "size": 165}),
    ("L22", "s14", W1("Gamma earns, theta eats."), [1], [3], {"i": 1, "size": 300}),
    ("L23", "s15", W1("If the stock moves more than the volatility you paid for, you win."), [], [], {"i": 12, "size": 320}),
    ("L24", "s16", W1("Comment GREEKS, and we'll DM you the free Greeks Cheat Sheet."), [1], [], None),
    ("L25", "s16", W1("Save this, share it, and follow") + [("Desk2Quant", 3)] + W1("for Day 11."), [6], [], None),
]


# the guide in the lower right, a young trader (compositions/mc.html): (caption line, token index, pose, seconds held, hop px)
MASCOT = [
    ("L1", 4, "wave", 1.05, 0), ("L2a", 2, "look", 1.1, 0), ("L2b", 5, "think", 1.4, 0), ("L2b", 10, "ask", 1.0, 16),
    ("L3a", 3, "point", 1.3, 0), ("L3c", 8, "happy", 0.7, 0),
    ("L4", 3, "delta", 1.1, 18), ("L4", 8, "wow", 0.8, 0), ("L4", 10, "thumbs", 0.7, 0),
    ("L5", 3, "wow", 0.8, 34), ("L6", 3, "happy", 0.9, 0), ("L6", 8, "worried", 0.9, 0), ("L6", 11, "thumbs", 0.75, 14),
    ("L7", 3, "worried", 0.9, 0), ("L7", 8, "thumbs", 0.6, 0), ("L8", 2, "cheer", 0.75, 26), ("L8", 4, "shrug", 0.9, 0),
    ("L9", 6, "point", 1.2, 0), ("L10", 3, "leanR", 1.0, 0), ("L10", 8, "leanL", 1.0, 0), ("L11", 3, "gamma", 1.0, 18),
    ("L12a", 3, "worried", 1.2, 0), ("L12b", 4, "sad", 1.0, 0), ("L12b", 9, "theta", 0.95, 16), ("L13", 8, "rupee", 1.0, 12),
    ("L14", 4, "think", 1.3, 0), ("L15", 6, "point", 1.2, 0), ("L16", 4, "wow", 0.7, 0), ("L16", 11, "thumbs", 0.55, 14),
    ("L17", 3, "point", 1.2, 0), ("L18", 2, "happy", 0.9, 18), ("L18", 9, "worried", 0.8, 0), ("L19", 12, "meh", 0.8, 0),
    ("L20", 3, "thumbs", 0.8, 18), ("L20", 7, "sad", 0.5, 0), ("L21", 3, "point", 1.4, 0), ("L21", 11, "wow", 0.8, 0),
    ("L22", 1, "thumbs", 0.6, 12), ("L22", 3, "worried", 0.55, 0), ("L23", 12, "cheer", 1.1, 30),
    ("L24", 1, "point", 1.6, 0), ("L25", 0, "happy", 0.9, 12), ("L25", 5, "bye", 9.0, 0),
]


def lips(path, hz=60):
    """The guide's lip sync from the voice itself: per 1/hz s, how open the mouth is (loudness), how wide (a bright
    spectrum: ee, s) and how round (a dark one: oo, o). Three base-36 digits per frame, 0..35."""
    import numpy as np, soundfile as sf
    y, sr = sf.read(path, always_2d=True)
    x = y.mean(axis=1)
    hop, win = sr // hz, int(0.04 * sr)
    F = np.fft.rfftfreq(win, 1 / sr); band = (F > 90) & (F < 6000); hann = np.hanning(win)
    out, op = [], 0.0
    for i in range((len(x) - win) // hop):
        seg = x[i * hop:i * hop + win]
        db = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)
        tgt = min(1.0, max(0.0, (db + 32) / 22)) ** 1.3
        op += (tgt - op) * (0.65 if tgt > op else 0.38)          # quick to open, a little slower to close
        m = np.abs(np.fft.rfft(seg * hann))[band]
        cen = float((F[band] * m).sum() / (m.sum() + 1e-9))
        wide = min(1.0, max(0.0, (cen - 900) / 700)) if op > 0.08 else 0.0
        rnd = min(1.0, max(0.0, (750 - cen) / 300)) if op > 0.08 else 0.0
        out.append("".join(np.base_repr(int(round(v * 35)), 36).lower() for v in (op, wide, rnd)))
    return "".join(out)


def onsets(timing):
    W = [VO_START + w for w in timing["W"]]
    out, k = {}, 0
    for lid, _, toks, *_ in SCRIPT:
        on = []
        for _, n in toks:
            on.append(round(W[k], 3)); k += n
        out[lid] = on
    assert k == len(W), f"script has {k} spoken words, timing has {len(W)}"
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
    mcf = os.path.join(BUILD, "compositions/mc.html")
    if os.path.exists(mcf):
        cues = [[round(on[lid][i] - 0.06, 3), pose, dur, hop] for lid, i, pose, dur, hop in MASCOT]
        vo = os.path.join(BUILD, "assets/vo.wav")
        lp = lips(vo) if os.path.exists(vo) else ""
        # the mouth leads the sound by ~2 frames, as animators do
        patch(mcf, f"const DUR = {DUR}; const CUES = {json.dumps(cues)}; const LIPS_HZ = 60; const LIPS_T0 = {round(VO_START - 0.035, 3)}; "
                   f"const LIPS = {json.dumps(lp)};")
    for s in ids:
        a, b = win[s]
        W = [round(t - a, 3) for lid, sc, *_ in SCRIPT if sc == s for t in on[lid]]
        f = os.path.join(BUILD, f"compositions/{s}.html")
        if os.path.exists(f):
            patch(f, f"const DUR = {round(b - a, 3)}; const W = {json.dumps(W)};")

    # sound: a whoosh on every cut (a glitchy one on the dissolves), a thump under every hero word, picture cues
    sfx = [("whoosh" if kind == "tiles" else "whoosh-short", round(c - (0.3 if kind == "tiles" else 0.2), 2), 0.6, 0.12 if kind == "tiles" else 0.09)
           for c, _, kind in cuts]
    for lid, sc, toks, acc, rose, hero in SCRIPT:
        if hero:
            sfx.append(("pop", round(on[lid][hero["i"]] - 0.02, 2), 0.5, 0.13))
    sfx += [("click-soft", round(on["L6"][3] - 0.02, 2), 0.3, 0.12), ("click-soft", round(on["L6"][8] - 0.02, 2), 0.3, 0.12),
            ("whoosh", round(on["L7"][0] - 0.05, 2), 0.57, 0.12), ("ping", round(on["L8"][3] + 0.05, 2), 1.0, 0.12),
            ("key-press", round(on["L17"][1], 2), 0.4, 0.12), ("sparkle", round(on["L23"][12] + 0.05, 2), 1.2, 0.10),
            ("typing", round(on["L24"][0] - 0.1, 2), 1.0, 0.12), ("pop", round(on["L24"][4], 2), 0.5, 0.14),
            ("chime", round(DUR - 1.3, 2), 1.3, 0.12)]
    hosts = [f'      <div id="{s}" data-composition-id="{s}" data-composition-src="compositions/{s}.html" data-start="{win[s][0]}" '
             f'data-duration="{round(win[s][1] - win[s][0], 3)}" data-track-index="{2 + i}" data-track-kind="graphics" data-width="1080" '
             f'data-height="1920" style="z-index: 1"></div>' for i, s in enumerate(ids)]
    auds = []
    if os.path.exists(os.path.join(BUILD, "assets/vo.wav")):
        auds.append(f'      <audio id="vo" class="clip" src="assets/vo.wav" data-start="{VO_START}" data-track-index="30" data-volume="1"></audio>')
    if os.path.exists(os.path.join(BUILD, "assets/bgm.wav")):
        auds.append(f'      <audio id="bgm" class="clip" src="assets/bgm.wav" data-start="0" data-duration="{DUR}" data-track-index="31" '
                    f'data-timeline-role="music" data-volume="1" data-fade-in="0.2" data-fade-out="1.2"></audio>')
    for k, (name, t, d, v) in enumerate(sorted(sfx, key=lambda x: x[1])):
        if os.path.exists(os.path.join(BUILD, f"assets/sfx/{name}.mp3")):
            auds.append(f'      <audio id="fx{k:02d}" class="clip" src="assets/sfx/{name}.mp3" data-start="{max(0.0, t)}" data-duration="{d}" '
                        f'data-track-index="{32 + k}" data-volume="{v}"></audio>')
    html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #e7f0ff; }}
      #root {{ position: relative; width: 100%; height: 100%; background: #e7f0ff; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1920">
      <div id="bg" data-composition-id="bg" data-composition-src="compositions/bg.html" data-start="0" data-duration="{DUR}"
           data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index: 0"></div>
{chr(10).join(hosts)}
      <div id="mc" data-composition-id="mc" data-composition-src="compositions/mc.html" data-start="0" data-duration="{DUR}"
           data-track-index="19" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index: 2"></div>
      <div id="ov" data-composition-id="ov" data-composition-src="compositions/ov.html" data-start="0" data-duration="{DUR}"
           data-track-index="20" data-track-kind="captions" data-width="1080" data-height="1920" style="z-index: 3"></div>
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
