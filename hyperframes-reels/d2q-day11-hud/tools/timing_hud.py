"""Day 11 (the volatility smile), Sci-fi Hologram HUD version: one source of truth for timing and look per scene. Writes the
DATA blocks of bg.html, ov.html, mc.html and every scene file, and the root index.html (scene hosts, voice, music,
sound effects). Adapted from the Day 10 tool (d2q-day10/tools/timing_iso.py).

usage: python3 tools/timing_hud.py voice/out/timing.json
timing.json (en_vo.py): {"W": onset of every spoken word in vo.wav, "VO_END": s}. A caption token may cover several
spoken words ("20.47%" = "twenty point four seven percent", "S&P" = "S and P", "Desk2Quant" = "Desk to Quant").
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = HERE
VO_START = 0.12
LEAD = 0.16
TAIL = 2.0

# id, theme (L light / D dark), how the cut INTO it is made: cube flips, tile cascades at the chapter breaks
TILES = (7, 9, 12, 14)
SCENES = [("s1", "L", None)] + [(f"s{i}", "L", "tiles" if i in TILES else "flip") for i in range(2, 15)]
THEME = {s: t for s, t, _ in SCENES}


def W1(text):
    return [(w, 1) for w in text.split()]


# (caption line, scene, [(caption token, spoken words)], accent token indices, rose token indices, hero {i, size[, c]})
SCRIPT = [
    ("L1", "s1", W1("You know Black-Scholes uses one volatility for every option."), [5], [], {"i": 4, "size": 320}),
    ("L2a", "s2", W1("Then the interviewer asks:"), [], [], None),
    ("L2b", "s2", W1("so why does the market quote a different volatility for every strike?"), [7], [], {"i": 11, "size": 280}),
    ("L3", "s3", W1("On October") + [("19th,", 1), ("1987,", 2), ("the", 1), ("S&P", 3), ("500", 2), ("fell", 1), ("20.47%", 5)] + W1("in one day."),
     [], [7], {"i": 8, "size": 250, "c": "r"}),
    ("L4a", "s4", W1("At") + [("20%", 2)] + W1("volatility, a typical day moves") + [("1.26%.", 5)], [7], [], None),
    ("L4b", "s4", W1("So that crash was a 16-sigma day."), [], [2], {"i": 5, "size": 240, "c": "r"}),
    ("L5a", "s5", W1("If returns were normal, like Black-Scholes assumes, a day like that would never happen."), [3], [], {"i": 12, "size": 300}),
    ("L5b", "s5", W1("Not once since the Big Bang."), [], [], None),
    ("L6a", "s6", W1("But it did."), [], [], {"i": 2, "size": 320, "c": "r"}),
    ("L6b", "s6", W1("Real returns have") + [("fat tails:", 2)] + W1("crashes come far more often."), [3], [4], None),
    ("L7a", "s7", W1("And what pays in a crash?"), [], [5], None),
    ("L7b", "s7", W1("A low-strike put."), [1], [], {"i": 2, "size": 320}),
    ("L7c", "s7", W1("So traders pay more for it."), [3], [], None),
    ("L8a", "s8", W1("Put that higher price into Black-Scholes and solve for the volatility:"), [2], [], None),
    ("L8b", "s8", W1("it comes out higher."), [3], [], None),
    ("L8c", "s8", W1("That's") + [("implied volatility.", 2)], [], [], {"i": 1, "size": 170}),
    ("L9a", "s9", W1("Let's simulate it."), [], [], {"i": 1, "size": 300}),
    ("L9b", "s9", W1("A stock with") + [("15%", 2)] + W1("volatility that crashes") + [("20%", 2)] + W1("about once every") + [("10", 1)] + W1("years."),
     [3], [6, 7], None),
    ("L10", "s10", W1("Price one-month options at strikes from") + [("80", 1), ("to", 1), ("120,", 2)] + W1("on a million simulated paths."),
     [6, 8], [], {"i": 11, "size": 300}),
    ("L11a", "s11", W1("At the money, implied vol is") + [("15.6%.", 4)], [6], [], None),
    ("L11b", "s11", W1("At") + [("90,", 1), ("20.7.", 3)] + W1("At") + [("80,", 1), ("29.7.", 3)], [2], [], {"i": 5, "size": 320}),
    ("L11c", "s11", W1("One stock, one model, and the flat line bends into a smile."), [], [], {"i": 11, "size": 300}),
    ("L12a", "s12", W1("So here's the answer:"), [], [], None),
    ("L12b", "s12", W1("with normal returns and one volatility, implied vol would be flat across strikes."), [], [], {"i": 10, "size": 300}),
    ("L13", "s13", W1("Real returns have") + [("fat tails,", 2)] + W1("so low-strike puts cost more, and implied vol rises as the strike falls."),
     [3, 12], [], {"i": 12, "size": 300}),
    ("L14a", "s14", W1("Comment FORMULA, and we'll DM you the free Quant Formula Sheet."), [1], [], None),
    ("L14b", "s14", W1("Save this, share it, and follow") + [("Desk2Quant", 3)] + W1("for Day") + [("12.", 1)], [6], [], None),
]


# the guide in the lower right, D the desk quant as a bust (compositions/mc.html, built from work/guide/guide_src.js):
# (caption line, token index, beat, seconds held, hop px: always 0, he does not hop). The beats are defined there (BEAT):
# point = he turns to the chart element the voice names and his near hand comes up beside the shoulder, the index finger
# on it; show / watch = he turns his head to it and looks; talk = to the viewer; wave = the sign-off
MASCOT = [
    ("L1", 0, "hello", 1.3, 0), ("L1", 4, "showOneVol", 1.6, 0),
    ("L2a", 2, "talk", 1.2, 0), ("L2b", 4, "showQuotes", 1.5, 0), ("L2b", 11, "askYou", 1.0, 0),
    ("L3", 2, "watchChart", 2.4, 0), ("L3", 7, "pointCrash", 1.7, 0),
    ("L4a", 1, "talk", 1.2, 0), ("L4a", 4, "showBell", 1.4, 0), ("L4b", 5, "pointSigma", 1.3, 0),
    ("L5a", 3, "showNormal", 1.4, 0), ("L5a", 12, "never", 0.9, 0), ("L5b", 0, "talk", 1.5, 0),
    ("L6a", 0, "pointDid", 1.1, 0), ("L6b", 3, "showFat", 1.3, 0), ("L6b", 5, "talk", 1.4, 0),
    ("L7a", 1, "askWhat", 0.9, 0), ("L7b", 2, "pointPayoff", 1.2, 0), ("L7c", 3, "showPrice", 0.9, 0),
    ("L8a", 2, "talk", 1.2, 0), ("L8a", 7, "showSolve", 1.5, 0), ("L8c", 1, "pointRoot", 1.3, 0),
    ("L9a", 1, "pointPaths", 2.0, 0), ("L9b", 6, "pointCrashes", 1.0, 0), ("L9b", 9, "talk", 2.8, 0),
    ("L10", 6, "sweepStrikes", 1.0, 0), ("L10", 11, "showMillion", 1.1, 0),
    ("L11a", 0, "watchSmile", 1.2, 0), ("L11a", 6, "pointAtm", 1.0, 0), ("L11b", 1, "point90", 1.0, 0),
    ("L11b", 4, "point80", 1.3, 0), ("L11c", 0, "talk", 1.3, 0), ("L11c", 7, "showSmile", 0.9, 0), ("L11c", 11, "smile", 1.5, 0),
    ("L12a", 3, "pointAnswer", 1.85, 0), ("L12b", 10, "flatAcross", 1.0, 0),
    ("L13", 3, "pointTail", 1.0, 0), ("L13", 6, "pointLowK", 1.1, 0), ("L13", 12, "traceRise", 1.2, 0),
    ("L14a", 0, "pointComment", 1.2, 0), ("L14a", 4, "showSheet", 1.6, 0), ("L14b", 0, "showRows", 1.6, 0),
    ("L14b", 5, "wave", 1.9, 0),
]


# the live status line, top right, per scene
STATUS = {"s1": "MODEL \u25b8 BLACK\u2013SCHOLES \u00b7 ONE \u03c3", "s2": "QUERY \u25b8 INTERVIEW", "s3": "DATA \u25b8 S&P 500 \u00b7 19 OCT 1987",
          "s4": "CALC \u25b8 A TYPICAL DAY", "s5": "MODEL \u25b8 NORMAL CURVE", "s6": "DATA \u25b8 FAT TAILS \u00b7 ILLUSTRATIVE",
          "s7": "INSTRUMENT \u25b8 90 PUT \u00b7 1M", "s8": "SOLVER \u25b8 IMPLIED VOL", "s9": "SIM \u25b8 15% VOL + CRASHES",
          "s10": "SIM \u25b8 1,000,000 PATHS \u00b7 SEED 11", "s11": "RESULT \u25b8 IMPLIED VOL BY STRIKE",
          "s12": "ANSWER \u25b8 NORMAL \u2192 FLAT", "s13": "ANSWER \u25b8 FAT TAILS \u2192 SMILE", "s14": "END \u25b8 COMMENT FORMULA"}

# locked values docking into the chip rail: (line, token index, delay after its onset, label, value, unit)
CHIPS = [("L3", 8, 1.6, "1987 \u00b7 ONE DAY", "\u221220.47", "%"),
         ("L4b", 5, 1.0, "THE CRASH", "16.2", "\u03c3"),
         ("L5a", 12, 1.6, "NORMAL ODDS/DAY", "10\u207b\u2075\u2079", ""),
         ("L7c", 3, 0.6, "90 PUT \u00b7 PRICE", "0.090", ""),
         ("L8b", 3, 0.8, "90 PUT \u00b7 IMP VOL", "20.7", "%"),
         ("L11b", 5, 1.2, "80 STRIKE \u00b7 IMP VOL", "29.7", "%")]


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
    vo = os.path.join(BUILD, "assets/vo.wav")
    lp = lips(vo) if os.path.exists(vo) else ""
    patch(os.path.join(BUILD, "compositions/ov.html"),
          f"const DUR = {DUR}; const LINES = {json.dumps(lines, ensure_ascii=False)}; const CUTS = {json.dumps(cuts)}; "
          f"const LIPS_HZ = 60; const LIPS_T0 = {round(VO_START - 0.035, 3)}; const LIPS = {json.dumps(lp)};")
    status = [[round(win[s][0], 3), STATUS[s]] for s in ids]
    chips = [[round(on[lid][i] + d, 3), lab, val, unit] for lid, i, d, lab, val, unit in CHIPS]
    patch(os.path.join(BUILD, "compositions/hud.html"),
          f"const DUR = {DUR}; const STATUS = {json.dumps(status, ensure_ascii=False)}; const CHIPS = {json.dumps(chips, ensure_ascii=False)}; "
          f"const END = {round(win['s14'][0], 3)};")
    mcf = os.path.join(BUILD, "compositions/mc.html")
    if os.path.exists(mcf):
        cues = [[round(on[lid][i] - 0.06, 3), pose, dur, hop] for lid, i, pose, dur, hop in MASCOT]
        # the mouth leads the sound by ~2 frames, as animators do
        patch(mcf, f"const DUR = {DUR}; const CUES = {json.dumps(cues)}; const LIPS_HZ = 60; const LIPS_T0 = {round(VO_START - 0.035, 3)}; "
                   f"const LIPS = {json.dumps(lp)};")
    rows = []
    for s in ids:
        a, b = win[s]
        toks = [t for lid, sc, tk, *_ in SCRIPT if sc == s for t, _ in tk]
        Ws = [round(t - a, 3) for lid, sc, *_ in SCRIPT if sc == s for t in on[lid]]
        rows.append(f"**{s}** [{round(a, 2)}, {round(b - a, 2)}] W: " + " ".join(f"{i}:{w}@{round(x, 2)}" for i, (w, x) in enumerate(zip(toks, Ws))))
    open(os.path.join(BUILD, "work/scene_words.md"), "w", encoding="utf-8").write("\n".join(rows) + "\n")
    for s in ids:
        a, b = win[s]
        W = [round(t - a, 3) for lid, sc, *_ in SCRIPT if sc == s for t in on[lid]]
        f = os.path.join(BUILD, f"compositions/{s}.html")
        if os.path.exists(f):
            patch(f, f"const DUR = {round(b - a, 3)}; const W = {json.dumps(W)};")

    # sound: a scan sweep at every scene, a lock beep on every hero word, a click per docked chip, the glitch on "did.",
    # the smile's ignition, typing for the comment, a send on DM, the closing tone
    # (no scan sweep where a chart carries across the cut: s2, s5, s6 and s13 open on the previous scene's chart)
    # (s12 opens on s11's smile and sweeps it away on "the answer:", so its sweep sounds there)
    CARRY = {"s2", "s5", "s6", "s12", "s13"}
    sfx = [("scan", round(win[s][0] - 0.05, 2), 0.7, 0.10) for s, _, kind in SCENES[1:] if s not in CARRY]
    sfx.append(("scan", round(on["L12a"][1] - 0.05, 2), 0.7, 0.10))
    for lid, sc, toks, acc, rose, hero in SCRIPT:
        if hero:
            sfx.append(("lock", round(on[lid][hero["i"]] + 0.17, 2), 0.5, 0.12))
    for lid, i, d, *_ in CHIPS:
        sfx.append(("chip", round(on[lid][i] + d + 0.4, 2), 0.4, 0.10))
    sfx += [("glitch", round(on["L6a"][2] - 0.02, 2), 0.5, 0.14), ("ignite", round(on["L11c"][11] + 0.05, 2), 1.4, 0.12),
            ("type", round(on["L14a"][0] - 0.1, 2), 1.0, 0.10), ("send", round(on["L14a"][4], 2), 0.6, 0.12),
            ("end", round(DUR - 1.3, 2), 1.3, 0.12)]
    hosts = [f'      <div id="{s}" data-composition-id="{s}" data-composition-src="compositions/{s}.html" data-start="{win[s][0]}" '
             f'data-duration="{round(win[s][1] - win[s][0], 3)}" data-track-index="{2 + i}" data-track-kind="graphics" data-width="1080" '
             f'data-height="1920" style="z-index: 1"></div>' for i, s in enumerate(ids)]
    auds = []
    if os.path.exists(os.path.join(BUILD, "assets/vo.wav")):
        auds.append(f'      <audio id="vo" class="clip" src="assets/vo.wav" data-start="{VO_START}" data-track-index="30" data-volume="1"></audio>')
    if os.path.exists(os.path.join(BUILD, "assets/bgm.wav")):
        auds.append(f'      <audio id="bgm" class="clip" src="assets/bgm.wav" data-start="0" data-duration="{DUR}" data-track-index="31" '
                    f'data-timeline-role="music" data-volume="0.75" data-fade-in="0.2" data-fade-out="1.2"></audio>')
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
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #f4f8fe; }}
      #root {{ position: relative; width: 100%; height: 100%; background: #f4f8fe; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1920" data-fps="24">
      <div id="bg" data-composition-id="bg" data-composition-src="compositions/bg.html" data-start="0" data-duration="{DUR}"
           data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index: 0"></div>
{chr(10).join(hosts)}
      <div id="mc" data-composition-id="mc" data-composition-src="compositions/mc.html" data-start="0" data-duration="{DUR}"
           data-track-index="19" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index: 2"></div>
      <div id="hud" data-composition-id="hud" data-composition-src="compositions/hud.html" data-start="0" data-duration="{DUR}"
           data-track-index="18" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index: 3"></div>
      <div id="ov" data-composition-id="ov" data-composition-src="compositions/ov.html" data-start="0" data-duration="{DUR}"
           data-track-index="20" data-track-kind="captions" data-width="1080" data-height="1920" style="z-index: 4"></div>
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
