"""Market Risk promo ("Comment RISK"): one source of truth for timing (the d2q-day11-rip pattern). Reads the caption words
(voice/out/words.json: 126 or 127 words with their on-screen spellings and start/end in vo.wav) and writes the DATA blocks of
every composition (bg, hud, ov, c1-c7) and the root index.html (scene hosts, the persistent layers, the voice, the music
and the sound effects), plus a readable work/timing.md.

usage: python3 tools/timing.py
"""
import json, os, re

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VO_START = 0.12            # the voice starts at film t = 0.12
DUR = 53.4                 # the film: the voice (ElevenLabs "Eric") ends at 51.90; the end card holds ~1.5 s
LEAD = 0.16                # a chapter starts this long before its first word
XO = 0.36                  # a scene stays this long into the next chapter, for its exit

WJ = json.load(open(os.path.join(HERE, "voice/out/words.json"), encoding="utf-8"))
WORDS = [w["w"] for w in WJ["words"]]
WA = [round(VO_START + w["s"], 3) for w in WJ["words"]]          # film time of every spoken word's onset
WE = [round(VO_START + w["e"], 3) for w in WJ["words"]]          # ... and its end
NW = len(WA)
assert NW in (126, 127), NW   # 127 when the take says "we will", 126 for "we'll"
import wave as _wave         # the length of the voice file itself (assets/vo.wav = voice/out/vo.wav)
with _wave.open(os.path.join(HERE, "assets/vo.wav")) as _w:
    VO_SECONDS = round(_w.getnframes() / _w.getframerate(), 2)
assert VO_START + WJ["end"] + 1.4 < DUR


def ix(word, start=105):
    """the index of the first spoken word `word` (as shown on screen) at or after `start`: chapter 07's words are found by
    their text, so a take that says "we will" instead of "we'll" moves them without breaking anything"""
    for i in range(start, NW):
        if WORDS[i] == word:
            return i
    raise SystemExit(f"word {word!r} not found after {start}")


# chapter 07's words
IX = {"RISK": ix("RISK,"), "and": ix("and"), "DM": ix("DM"), "P50": ix("50%"), "off": ix("off."), "The": ix("The"),
      "code": ix("code"), "seven": ix("7"), "days": ix("days."), "Save": ix("Save"), "this": ix("this"),
      "next": ix("next"), "last": NW - 1}

# the 7 chapters: (scene id, first word, theme L light paper / B brand-blue colour block, tag, title tokens [text, key])
CH = [("c1", 0, "L", "VAR", [["The", 0], ["VaR", 1], ["question", 0]]),
      ("c2", 14, "L", "THE PACK", [["Notes", 0], ["+ Lab", 1]]),
      ("c3", 30, "L", "BACKTEST", [["Project 1:", 0], ["VaR & ES", 1]]),
      ("c4", 53, "L", "STRESS", [["Project 2:", 0], ["FX options", 1]]),
      ("c5", 74, "L", "FRTB", [["Project 3:", 0], ["FRTB", 1]]),
      ("c6", 91, "L", "INSIDE", [["What you", 0], ["get", 1]]),
      ("c7", 105, "B", "50% OFF", [["Comment", 0], ["RISK", 1]])]
assert [c[1] for c in CH] == [WJ["line_start_word"][k] for k in ["p1", "p2", "p3b", "p4", "p5", "p6", "p7"]]
B = [0.0] + [round(WA[w] - LEAD, 3) for _, w, *_ in CH[1:]]
THEME = [th for _, _, th, *_ in CH]

# the spoken subtitle, built word by word: pages of consecutive words (first, last), the keyword pills (red; "y" =
# yellow, only for the 50% OFF moment) and forced line breaks (word indices that start a new line)
PAGES = [
    (0, 6, [6]),                      # Every market risk interview asks about VaR.
    (7, 13, [13]),                    # Can you show one you've actually built?
    (14, 22, [20, 22]),               # This is the Market Risk Quant Notes and Lab.
    (23, 26, [23, 25]),               # 141 pages, 19 modules,
    (27, 29, [27]),                   # 64 interview answers.
    (30, 35, [32, 34, 35], [32]),     # Project one. / VaR and expected shortfall
    (36, 41, [38, 40]),               # for a rates and FX desk,
    (42, 48, [44, 45]),               # backtested over 4,919 days of real data.
    (49, 52, [49, 50]),               # Kupiec, Christoffersen, traffic lights.
    (53, 58, [56, 57]),               # Project two: an FX options desk.
    (59, 62, [60, 62]),               # Full revaluation against delta-gamma-vega,
    (63, 67, [63]),                   # stressed through the financial crisis,
    (68, 73, [68, 71]),               # COVID and the 2024 yen unwind.
    (74, 76, [76]),                   # Project three: FRTB.
    (77, 83, [77, 79]),               # Standardised versus internal models for five desks,
    (84, 90, [89]),                   # all the way to the capital number.
    (91, 96, [94, 96]),               # You get the notes, executed notebooks,
    (97, 104, [98, 102]),             # a Python risk library and 14 regression tests.
    (105, IX["off"], [IX["RISK"], (IX["P50"], "y"), (IX["off"], "y")], [IX["and"]]),   # Comment RISK, / and we'll DM you 50% off.
    (IX["The"], IX["days"], [IX["seven"], IX["days"]]),                                 # The code works for 7 days.
    (IX["Save"], IX["last"], [IX["Save"], IX["this"]]),                                 # Save this for your next risk interview.
]


def pages():
    out = []
    for p in PAGES:
        a, b, keys = p[0], p[1], p[2]
        br = p[3] if len(p) > 3 else []
        kmap = {}
        for k in keys:
            i, kind = (k, "r") if isinstance(k, int) else k
            assert a <= i <= b, (p, i)
            kmap[i] = kind
        tok = [{"s": WORDS[i], "on": WA[i], "w": i, "k": kmap.get(i, "")} for i in range(a, b + 1)]
        # the hook's first phrase is on screen from frame 1, faint, each word lighting up as it is spoken ("pre")
        out.append({"start": 0.0 if a == 0 else round(WA[a] - 0.05, 3), "pre": 1 if a == 0 else 0, "tok": tok, "br": [i - a for i in br]})
    seen = [t["w"] for p in out for t in p["tok"]]
    assert seen == list(range(NW)), "every spoken word is on some page, once, in order"
    return out


def patch(path, data):
    s = open(path, encoding="utf-8").read()
    new, n = re.subn(r"/\*DATA\*/.*?/\*END\*/", lambda m: "/*DATA*/ " + data + " /*END*/", s, flags=re.S)
    if n != 1:
        raise SystemExit(f"{path}: expected one DATA block, found {n}")
    open(path, "w", encoding="utf-8").write(new)


def windows():
    """scene id -> (film start, duration, next chapter in scene time)"""
    w = {}
    for k, (s, *_) in enumerate(CH):
        a = B[k]
        if k < len(CH) - 1:
            w[s] = (a, round(B[k + 1] + XO - a, 3), round(B[k + 1] - a, 3))
        else:
            w[s] = (a, round(DUR - a, 3), round(DUR - a, 3))
    return w


# the sound effects: (file, film time, seconds, volume). CC0 (uisfx via d2q-day11-hud/assets/sfx, PICKS.json): send = a
# soft whoosh as a card or page arrives, lock = a two-tone confirm (the lock, a stamp, a total landing), chip = a soft click
# (a cursor or a card landing), type = a short tick (tiles lighting, counters, ticks), end = the close. A cue never sounds
# over a stressed word: the stressed words are the subtitle's keyword pills, each from its onset for at most 0.55 s
# (checked below; a cue that meets one is reported). Several land just before or after their picture for that reason.
STRESSED = sorted(i for p in PAGES for i in [k if isinstance(k, int) else k[0] for k in p[2]])
D = {"send": 0.42, "lock": 0.29, "chip": 0.29, "type": 0.13, "end": 0.68}


def sfx_list():
    W = WA
    S = []
    add = lambda n, t, v: S.append((n, t, D[n], v))
    # c1: the VaR line drops; typing dots; the locked answer
    add("type", W[6] - 0.14, 0.06)
    add("type", W[7] - 0.02, 0.05); add("type", W[7] + 0.12, 0.045)
    add("lock", W[11] + 0.12, 0.08)
    # c2: the lock opens (the click waits for "built?" to end); the cover flies out; 141 lands; the contents page slides
    # in; the red frame on "answers"
    add("chip", W[14], 0.07)
    add("send", B[1] + 0.56, 0.09)
    add("chip", WE[23] - 0.04, 0.07)
    add("send", W[26], 0.07)
    add("chip", W[29] - 0.04, 0.07)
    # c3: the project card; the tiles and the desk light (each just before its word); the dashboard; the count lands;
    # DAYS; REAL DATA; the proof; the traffic light's three dots
    add("send", B[2] + 0.1, 0.08)
    add("type", W[32] - 0.14, 0.06)            # (ES lights between two stressed words, "VaR" and "expected": no cue)
    add("type", W[38] - 0.16, 0.06); add("type", W[40] - 0.12, 0.06)
    add("send", W[42] - 0.22, 0.08)
    add("type", WE[44] - 0.32, 0.05); add("type", WE[44] - 0.19, 0.05)
    add("type", W[45] - 0.16, 0.06)
    add("lock", W[47] - 0.03, 0.10)
    add("send", W[49] - 0.36, 0.08)
    for j in range(3): add("type", W[51] + 0.03 + 0.14 * j, 0.06)
    # c4: the pricer; the two clicks; STRESSED; the scenario cards
    add("send", B[3] + 0.12, 0.08)
    add("type", W[59] - 0.06, 0.07)
    add("type", W[61] + 0.1, 0.07)
    add("lock", W[64], 0.11)
    add("type", W[66] - 0.04, 0.06); add("type", W[68] - 0.16, 0.06); add("type", W[70] - 0.04, 0.06)
    # c5: the cards; SA; IMA; the five desks; CAPITAL
    add("send", B[4] + 0.12, 0.08)
    add("type", W[79] - 0.16, 0.06)            # (SA lights between two stressed words, "FRTB." and "Standardised": no cue)
    for j in range(3): add("type", W[82] - 0.02 + 0.12 * j, 0.05)
    add("lock", W[89] - 0.3, 0.09)
    # c6: the notes; the notebooks; the library and its modules; the checks; the full suite
    add("send", B[5] + 0.12, 0.07)
    add("type", W[94] - 0.16, 0.06); add("chip", W[95], 0.07); add("type", W[99] + 0.02, 0.05); add("type", W[100] + 0.04, 0.05)
    for j in range(3): add("type", WE[102] + 0.02 + 0.14 * j, 0.05)
    add("lock", W[104] + 0.02, 0.09)
    # c7: the blue block; posted; the DM; the code chip; valid 7 days; the send row; the close
    add("send", B[6] - 0.08, 0.07)            # (before "Comment" starts: a louder whoosh masked its soft onset)
    add("send", W[107] + 0.02, 0.08)
    add("chip", W[IX["DM"]] + 0.06, 0.08)
    add("lock", W[IX["code"]] - 0.02, 0.09)
    add("type", W[IX["seven"]] - 0.16, 0.06)
    add("chip", W[IX["next"]] - 0.02, 0.07)
    add("end", WE[IX["last"]] + 0.34, 0.10)
    out = sorted([(n, round(max(0.0, t), 2), d, v) for n, t, d, v in S], key=lambda x: x[1])
    for n, t, d, v in out:
        for i in STRESSED:
            a, b = WA[i], min(WE[i], WA[i] + 0.55)
            if t < b - 0.02 and t + min(d, 0.25) > a + 0.02:
                print(f"  note: {n} at {t} meets stressed word {i} {WORDS[i]} ({a}-{b})")
    return out


def main():
    PG = pages()
    win = windows()
    comp = lambda n: os.path.join(HERE, "compositions", n + ".html")
    common = f"const DUR = {DUR}; const B = {json.dumps(B)}; const THEME = {json.dumps(THEME)};"
    chs = [{"tag": tag, "title": title} for _, _, _, tag, title in CH]
    if os.path.exists(comp("bg")):
        patch(comp("bg"), common)
    if os.path.exists(comp("hud")):
        patch(comp("hud"), common + f" const CH = {json.dumps(chs, ensure_ascii=False)};")
    if os.path.exists(comp("ov")):
        patch(comp("ov"), common + f" const PAGES = {json.dumps(PG, ensure_ascii=False)};")
    for k, (s, *_) in enumerate(CH):
        a, d, nx = win[s]
        if os.path.exists(comp(s)):
            patch(comp(s), f"const DUR = {d}; const T0 = {a}; const NEXT = {nx}; const KB = {k}; const B = {json.dumps(B)}; "
                           f"const THEME = {json.dumps(THEME)}; const WA = {json.dumps(WA)}; const WE = {json.dumps(WE)}; "
                           f"const IX = {json.dumps(IX)};")
    hosts = []
    for i, (s, *_) in enumerate(CH):
        if not os.path.exists(comp(s)):
            continue
        a, d, nx = win[s]
        hosts.append(f'      <div id="{s}" data-composition-id="{s}" data-composition-src="compositions/{s}.html" data-start="{a}" '
                     f'data-duration="{d}" data-track-index="{2 + i}" data-track-kind="graphics" data-width="1080" data-height="1920" '
                     f'style="z-index: 1"></div>')
    auds = [f'      <audio id="vo" class="clip" src="assets/vo.wav" data-start="{VO_START}" data-duration="{VO_SECONDS}" '
            f'data-track-index="30" data-volume="1"></audio>']
    if os.path.exists(os.path.join(HERE, "assets/bgm.wav")):
        auds.append(f'      <audio id="bgm" class="clip" src="assets/bgm.wav" data-start="0" data-duration="{DUR}" data-track-index="31" '
                    f'data-timeline-role="music" data-volume="0.75" data-fade-in="0.2" data-fade-out="1.2"></audio>')
    for k, (name, t, d, v) in enumerate(sfx_list()):
        auds.append(f'      <audio id="fx{k:02d}" class="clip" src="assets/sfx/{name}.mp3" data-start="{t}" data-duration="{d}" '
                    f'data-track-index="{32 + k}" data-volume="{v}"></audio>')
    layer = lambda n, z, kind, ti: (f'      <div id="{n}" data-composition-id="{n}" data-composition-src="compositions/{n}.html" data-start="0" '
                                    f'data-duration="{DUR}"\n           data-track-index="{ti}" data-track-kind="{kind}" data-width="1080" '
                                    f'data-height="1920" style="z-index: {z}"></div>')
    html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #f3efe6; }}
      #root {{ position: relative; width: 100%; height: 100%; background: #f3efe6; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1920" data-fps="24">
{layer("bg", 0, "graphics", 1)}
{chr(10).join(hosts)}
{layer("hud", 3, "graphics", 18)}
{layer("ov", 4, "captions", 20)}
{chr(10).join(auds)}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""
    open(os.path.join(HERE, "index.html"), "w", encoding="utf-8").write(html)
    rows = [f"DUR {DUR}  XO {XO}  LEAD {LEAD}", "chapters " + " ".join(f"{s}:{B[k]}" for k, (s, *_) in enumerate(CH))]
    for k, (s, (a, d, nx)) in enumerate(win.items()):
        rows.append(f"{s}: film {a} - {round(a + d, 3)} (next chapter at scene {nx}; theme {THEME[k]}; tag {CH[k][3]} · {k + 1:02d}/07)")
    for k, p in enumerate(PG):
        rows.append(f"page {k} @{p['start']}: " + " ".join(f"{t['s']}{'[' + t['k'] + ']' if t['k'] else ''}@{t['on']}" for t in p["tok"]))
    open(os.path.join(HERE, "work/timing.md"), "w", encoding="utf-8").write("\n".join(rows) + "\n")
    print(json.dumps({"DUR": DUR, "B": B, "scenes": {s: [a, d] for s, (a, d, _) in win.items()}}))


if __name__ == "__main__":
    main()
