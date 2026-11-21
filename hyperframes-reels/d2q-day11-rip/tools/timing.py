"""Day 11/30 "volatility smile", Ripping look (no character): one source of truth for timing. Reads the Day 11 word
timing (voice/out/timing.json: W = onset of every spoken word in vo.wav, copied unchanged from d2q-day11-hud) and writes
the DATA blocks of every composition (bg, hud, ov, s1-s14) and the root index.html (scene hosts, the persistent layers,
the voice, the music and the sound effects), plus a readable work/timing.md.

usage: python3 tools/timing.py
"""
import json, os, re

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VO_START = 0.12            # the voice starts at film t = 0.12
DUR = 77.94                # the film (the voice ends at 75.94; the end card holds)
LEAD = 0.16                # a beat starts this long before its first word (as in d2q-day11-hud)
XO = 0.36                  # a scene stays this long into the next beat, for its exit

TJ = json.load(open(os.path.join(HERE, "voice/out/timing.json")))
WA = [round(VO_START + w, 3) for w in TJ["W"]]           # film time of every spoken word's onset
assert len(WA) == 254, len(WA)

# the 14 beats: (id, first spoken word, theme L light paper / B brand-blue colour block, progress step 0..4)
STEPS = ["QUESTION", "1987", "FAT TAILS", "SIMULATION", "ANSWER"]
BEATS = [("s1", 0, "L", 0), ("s2", 9, "B", 0), ("s3", 25, "L", 1), ("s4", 45, "L", 1), ("s5", 65, "L", 1),
         ("s6", 85, "B", 2), ("s7", 98, "L", 2), ("s8", 113, "L", 2), ("s9", 131, "L", 3), ("s10", 149, "L", 3),
         ("s11", 164, "L", 3), ("s12", 196, "B", 4), ("s13", 213, "L", 4), ("s14", 231, "L", 4)]
B = [0.0] + [round(WA[w] - LEAD, 3) for _, w, _, _ in BEATS[1:]]
THEME = [th for _, _, th, _ in BEATS]
STEP = [sp for _, _, _, sp in BEATS]

# the caption pages: the caption IS the voice, built word by word. A token is (text, spoken word index); multi-word
# tokens ("20.47%" = "twenty point four seven percent") take the onset of their first spoken word. mark = token spans
# [a, b] (yellow) or [a, b, "r"] (red, the crash words) that get a solid marker box; br = token indices that start a new
# line; pre = how many tokens are already on screen at t = 0 (the hook).
P = lambda *tk: [(tk[i], tk[i + 1]) for i in range(0, len(tk), 2)]
PAGES = [
    dict(tok=P("You", 0, "know", 1, "Black-Scholes", 2, "uses", 3, "one", 4, "volatility", 5, "for", 6, "every", 7, "option.", 8),
         mark=[[4, 5]], pre=9, br=[3, 6]),
    dict(tok=P("Then", 9, "the", 10, "interviewer", 11, "asks:", 12), mark=[[2, 2]]),
    dict(tok=P("so", 13, "why", 14, "does", 15, "the", 16, "market", 17, "quote", 18, "a", 19, "different", 20,
               "volatility", 21, "for", 22, "every", 23, "strike?", 24), mark=[[7, 8]]),
    dict(tok=P("On", 25, "October", 26, "19th,", 27, "1987,", 28, "the", 30, "S&P", 31, "500", 34, "fell", 36, "20.47%", 37,
               "in", 42, "one", 43, "day.", 44), mark=[[8, 8, "r"]], br=[4, 9]),
    dict(tok=P("At", 45, "20%", 46, "volatility,", 48, "a", 49, "typical", 50, "day", 51, "moves", 52, "1.26%.", 53), mark=[[7, 7]]),
    dict(tok=P("So", 58, "that", 59, "crash", 60, "was", 61, "a", 62, "16-sigma", 63, "day.", 64), mark=[[5, 5, "r"]]),
    dict(tok=P("If", 65, "returns", 66, "were", 67, "normal,", 68, "like", 69, "Black-Scholes", 70, "assumes,", 71), mark=[[3, 3]]),
    dict(tok=P("a", 72, "day", 73, "like", 74, "that", 75, "would", 76, "never", 77, "happen.", 78), mark=[[5, 6]]),
    dict(tok=P("Not", 79, "once", 80, "since", 81, "the", 82, "Big", 83, "Bang.", 84), mark=[[4, 5]]),
    dict(tok=P("But", 85, "it", 86, "did.", 87), mark=[[2, 2]]),
    dict(tok=P("Real", 88, "returns", 89, "have", 90, "fat tails:", 91, "crashes", 93, "come", 94, "far", 95, "more", 96,
               "often.", 97), mark=[[3, 3]]),
    dict(tok=P("And", 98, "what", 99, "pays", 100, "in", 101, "a", 102, "crash?", 103, "A", 104, "low-strike", 105, "put.", 106),
         mark=[[5, 5, "r"], [7, 8]], br=[6]),
    dict(tok=P("So", 107, "traders", 108, "pay", 109, "more", 110, "for", 111, "it.", 112), mark=[[2, 3]]),
    dict(tok=P("Put", 113, "that", 114, "higher", 115, "price", 116, "into", 117, "Black-Scholes", 118, "and", 119, "solve", 120,
               "for", 121, "the", 122, "volatility:", 123), mark=[[2, 3]]),
    dict(tok=P("it", 124, "comes", 125, "out", 126, "higher.", 127, "That's", 128, "implied volatility.", 129), mark=[[5, 5]], br=[4]),
    dict(tok=P("Let's", 131, "simulate", 132, "it.", 133), mark=[[1, 1]]),
    dict(tok=P("A", 134, "stock", 135, "with", 136, "15%", 137, "volatility", 139, "that", 140, "crashes", 141, "20%", 142,
               "about", 144, "once", 145, "every", 146, "10", 147, "years.", 148), mark=[[3, 3], [6, 7, "r"]]),
    dict(tok=P("Price", 149, "one-month", 150, "options", 151, "at", 152, "strikes", 153, "from", 154, "80", 155, "to", 156,
               "120,", 157, "on", 159, "a", 160, "million", 161, "simulated", 162, "paths.", 163), mark=[[6, 8], [11, 11]]),
    dict(tok=P("At", 164, "the", 165, "money,", 166, "implied", 167, "vol", 168, "is", 169, "15.6%.", 170), mark=[[6, 6]]),
    dict(tok=P("At", 174, "90,", 175, "20.7.", 176, "At", 179, "80,", 180, "29.7.", 181), mark=[[2, 2], [5, 5]], br=[3]),
    dict(tok=P("One", 184, "stock,", 185, "one", 186, "model,", 187, "and", 188, "the", 189, "flat", 190, "line", 191,
               "bends", 192, "into", 193, "a", 194, "smile.", 195), mark=[[11, 11]], br=[4]),
    dict(tok=P("So", 196, "here's", 197, "the", 198, "answer:", 199), mark=[[3, 3]]),
    dict(tok=P("with", 200, "normal", 201, "returns", 202, "and", 203, "one", 204, "volatility,", 205, "implied", 206, "vol", 207,
               "would", 208, "be", 209, "flat", 210, "across", 211, "strikes.", 212), mark=[[10, 10]]),
    dict(tok=P("Real", 213, "returns", 214, "have", 215, "fat tails,", 216, "so", 218, "low-strike", 219, "puts", 220,
               "cost", 221, "more,", 222), mark=[[3, 3]]),
    dict(tok=P("and", 223, "implied", 224, "vol", 225, "rises", 226, "as", 227, "the", 228, "strike", 229, "falls.", 230), mark=[[3, 3]]),
    dict(tok=P("Comment", 231, "FORMULA,", 232, "and", 233, "we'll", 234, "DM", 235, "you", 236, "the", 237, "free", 238,
               "Quant", 239, "Formula", 240, "Sheet.", 241), mark=[[1, 1]]),
    dict(tok=P("Save", 242, "this,", 243, "share", 244, "it,", 245, "and", 246, "follow", 247, "Desk2Quant", 248, "for", 251,
               "Day", 252, "12.", 253), mark=[[0, 1]]),
]


def pages():
    out = []
    for p in PAGES:
        tok = [{"s": s, "on": WA[wi], "w": wi} for s, wi in p["tok"]]
        pre = p.get("pre", 0)
        start = 0.0 if pre else round(tok[0]["on"] - 0.04, 3)
        out.append({"start": start, "pre": pre, "tok": tok, "br": p.get("br", []),
                    "mark": [[m[0], m[1], m[2] if len(m) > 2 else "y"] for m in p.get("mark", [])]})
    # every spoken word is on some page, once, in order
    seen = [t["w"] for p in out for t in p["tok"]]
    assert seen == sorted(seen) and len(set(seen)) == len(seen), seen
    return out


def patch(path, data):
    s = open(path, encoding="utf-8").read()
    new, n = re.subn(r"/\*DATA\*/.*?/\*END\*/", lambda m: "/*DATA*/ " + data + " /*END*/", s, flags=re.S)
    if n != 1:
        raise SystemExit(f"{path}: expected one DATA block, found {n}")
    open(path, "w", encoding="utf-8").write(new)


def windows():
    """scene id -> (film start, duration, next beat in scene time)"""
    w = {}
    for k, (s, *_) in enumerate(BEATS):
        a = B[k]
        if k < len(BEATS) - 1:
            w[s] = (a, round(B[k + 1] + XO - a, 3), round(B[k + 1] - a, 3))
        else:
            w[s] = (a, round(DUR - a, 3), round(DUR - a, 3))
    return w


# the sound effects: (file, film time, seconds, volume). CC0 (uisfx via d2q-day11-hud/assets/sfx, PICKS.json): send = a
# soft whoosh as a hero arrives, lock = a stamp or a lock landing, chip = a click (cursor, chip, counter landing), type =
# a paper flick (tickets dealt, tiles and cards flipping), glitch = the crash candle, ignite = the smile, end = the close.
# Cues follow the scenes' own beat times; any cue that would sound over a stressed word moves just past it or is dropped.
STRESSED = [4, 5, 20, 21, 37, 38, 39, 40, 41, 53, 54, 55, 56, 57, 63, 77, 78, 87, 91, 92, 105, 109, 110, 115, 116, 129, 130,
            137, 138, 141, 142, 143, 147, 155, 157, 158, 161, 170, 171, 172, 173, 176, 177, 178, 181, 182, 183, 190, 195, 199, 210,
            216, 217, 226, 232, 242, 252, 253]


def sfx_list():
    W = WA
    S = []
    add = lambda n, t, d, v: S.append((n, t, d, v))
    D = {"send": 0.42, "lock": 0.29, "chip": 0.29, "type": 0.13, "glitch": 0.42, "ignite": 1.54, "end": 0.68}
    # s1: the tickets dealt; the dial locks after "volatility"; the light reaches each ticket and its tiles flip; the chip
    for i in range(5): add("type", W[2] - 0.06 + 0.075 * i, D["type"], 0.07)
    add("lock", W[6] + 0.01, D["lock"], 0.09)
    for i in range(5): add("type", 2.12 + 0.07 * i, D["type"], 0.06)
    add("chip", W[7] + 0.12, D["chip"], 0.08)
    # s2: the chat card; the tiles widen; the quotes land (after "volatility")
    add("send", B[1] + 0.1, D["send"], 0.10)
    add("type", W[17] - 0.04, D["type"], 0.07)
    add("chip", W[22] + 0.02, D["chip"], 0.09)
    # s3: the calendar slams; the page tears off; the crash candle drops; the count lands; IN ONE DAY
    add("lock", W[25] + 0.06, D["lock"], 0.12)
    add("send", W[30] - 0.3, D["send"], 0.10)
    add("glitch", W[36] - 0.12, D["glitch"], 0.09)
    add("lock", W[42] + 0.07, D["lock"], 0.12)
    # s4: the formula card; the tape comes out; the band's label; the card flips; the marker lands at 16σ
    add("send", B[3] + 0.04, D["send"], 0.10)
    for j in range(3): add("type", B[3] + 0.6 + 0.1 * j, D["type"], 0.06)
    add("type", W[58] - 0.02, D["type"], 0.08)
    add("lock", W[64] + 0.02, D["lock"], 0.11)
    # s5: the bell card; the bell rises; the crash dot; the odds panel flips twice
    add("send", B[4] + 0.04, D["send"], 0.10)
    add("chip", W[68] + 0.1, D["chip"], 0.07)
    add("chip", W[73] - 0.06, D["chip"], 0.08)
    add("type", W[76] - 0.06, D["type"], 0.08)
    add("type", W[79] - 0.02, D["type"], 0.08)
    # s6: the page slams; the chart card (after "did"); the tail lifts; the 97x chip
    add("lock", W[85] + 0.08, D["lock"], 0.12)
    add("send", W[88] - 0.02, D["send"], 0.10)
    add("chip", W[93], D["chip"], 0.09)
    # s7: the ticket card; the payoff lights; BUY clicks (off the stressed "pay more"); the ratio
    add("send", B[6] + 0.05, D["send"], 0.10)
    add("chip", W[103] + 0.2, D["chip"], 0.08)
    add("chip", W[108] + 0.02, D["chip"], 0.09)
    add("chip", W[111], D["chip"], 0.09)
    add("lock", W[112] - 0.05, D["lock"], 0.10)
    # s8: the solver; the price flows in; SOLVE; Newton's rows; the answer locks
    add("send", B[7] + 0.05, D["send"], 0.10)
    add("send", W[117] + 0.0, D["send"], 0.07)
    add("chip", W[120] + 0.02, D["chip"], 0.10)
    for i in range(5): add("type", W[120] + 0.14 + 0.24 * i, D["type"], 0.06)
    add("lock", W[125] - 0.1, D["lock"], 0.10)
    # s9: the panel; each slider lands (just after its spoken value)
    add("send", B[8] + 0.05, D["send"], 0.10)
    add("chip", W[139] + 0.02, D["chip"], 0.09)
    add("chip", W[144] + 0.02, D["chip"], 0.09)
    add("chip", W[148] + 0.34, D["chip"], 0.09)
    # s10: the card; balls ticking into the bins; the counter lands; the strikes priced
    add("send", B[9] + 0.05, D["send"], 0.10)
    for tt in (44.62, 44.95, 45.3, 45.6, 46.22, 46.85):
        add("type", tt, D["type"], 0.05)
    add("chip", W[162] + 0.03, D["chip"], 0.09)
    add("lock", W[163] + 0.05, D["lock"], 0.09)
    # s11: the card; the money point pops; 90 and 80 lock (after their numbers); ONE MODEL; the bend; the smile shimmer
    add("send", B[10] + 0.02, D["send"], 0.10)
    add("chip", W[169] - 0.1, D["chip"], 0.08)
    add("chip", W[179] + 0.01, D["chip"], 0.08)
    add("lock", W[184] - 0.02, D["lock"], 0.08)
    add("chip", W[186] + 0.02, D["chip"], 0.07)
    add("send", W[192] - 0.06, D["send"], 0.08)
    add("ignite", W[195] + 0.48, D["ignite"], 0.10)
    # s12: the flip to THE ANSWER (before "answer"); the switches; the flat line lands; the card turns away
    add("type", W[199] - 0.15, D["type"], 0.09)
    add("chip", W[201] + 0.21, D["chip"], 0.08)
    add("chip", W[204] + 0.21, D["chip"], 0.08)
    add("lock", W[212] + 0.2, D["lock"], 0.09)
    add("type", B[12] + 0.12, D["type"], 0.08)
    # s13: the second link; the trace ends
    add("chip", W[219] - 0.04, D["chip"], 0.08)
    add("chip", W[230] + 0.3, D["chip"], 0.07)
    # s14: the cards; posted; the DM; FREE; save, share, follow; Day 12; the close
    add("send", B[13] + 0.04, D["send"], 0.10)
    add("send", W[233] + 0.04, D["send"], 0.10)
    add("chip", W[235] - 0.08, D["chip"], 0.09)
    add("chip", W[238], D["chip"], 0.07)
    add("lock", W[243], D["lock"], 0.08)
    add("chip", W[244] - 0.02, D["chip"], 0.08)
    add("chip", W[247] - 0.02, D["chip"], 0.08)
    add("lock", W[253] + 0.44, D["lock"], 0.09)
    add("end", DUR - 0.7, D["end"], 0.10)
    out = sorted([(n, round(max(0.0, t), 2), d, v) for n, t, d, v in S], key=lambda x: x[1])
    # the check: no cue sounds over a stressed word (its onset to the next word's onset)
    for n, t, d, v in out:
        for i in STRESSED:
            a, b = WA[i], (WA[i + 1] if i + 1 < len(WA) else WA[i] + 0.5)
            if t < b - 0.02 and t + min(d, 0.25) > a + 0.02:
                print(f"  note: {n} at {t} meets stressed word {i} ({a}-{b})")
    return out


def main():
    PG = pages()
    win = windows()
    comp = lambda n: os.path.join(HERE, "compositions", n + ".html")
    common = f"const DUR = {DUR}; const B = {json.dumps(B)}; const THEME = {json.dumps(THEME)};"
    if os.path.exists(comp("bg")):
        patch(comp("bg"), common + f" const STEP = {json.dumps(STEP)};")
    if os.path.exists(comp("hud")):
        patch(comp("hud"), common + f" const STEP = {json.dumps(STEP)}; const STEPS = {json.dumps(STEPS)}; const WA = {json.dumps(WA)};")
    if os.path.exists(comp("ov")):
        patch(comp("ov"), common + f" const PAGES = {json.dumps(PG, ensure_ascii=False)};")
    for k, (s, *_) in enumerate(BEATS):
        a, d, nx = win[s]
        if os.path.exists(comp(s)):
            patch(comp(s), f"const DUR = {d}; const T0 = {a}; const NEXT = {nx}; const KB = {k}; const B = {json.dumps(B)}; "
                           f"const THEME = {json.dumps(THEME)}; const WA = {json.dumps(WA)};")
    hosts = []
    for i, (s, *_) in enumerate(BEATS):
        if not os.path.exists(comp(s)):
            continue
        a, d, nx = win[s]
        hosts.append(f'      <div id="{s}" data-composition-id="{s}" data-composition-src="compositions/{s}.html" data-start="{a}" '
                     f'data-duration="{d}" data-track-index="{2 + i}" data-track-kind="graphics" data-width="1080" data-height="1920" '
                     f'style="z-index: 1"></div>')
    auds = [f'      <audio id="vo" class="clip" src="assets/vo.wav" data-start="{VO_START}" data-duration="{TJ['seconds']}" '
            f'data-track-index="30" data-volume="1"></audio>',
            f'      <audio id="bgm" class="clip" src="assets/bgm.wav" data-start="0" data-duration="{DUR}" data-track-index="31" '
            f'data-timeline-role="music" data-volume="0.75" data-fade-in="0.2" data-fade-out="1.2"></audio>']
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
    rows = [f"DUR {DUR}  XO {XO}", "beats " + " ".join(f"{s}:{B[k]}" for k, (s, *_) in enumerate(BEATS))]
    for s, (a, d, nx) in win.items():
        rows.append(f"{s}: film {a} - {round(a + d, 3)} (next beat at scene {nx}; theme {THEME[int(s[1:]) - 1]}, step {STEPS[STEP[int(s[1:]) - 1]]})")
    for k, p in enumerate(PG):
        rows.append(f"page {k} @{p['start']}: " + " ".join(f"{t['s']}@{t['on']}" for t in p["tok"]) + f"  mark {p['mark']}")
    open(os.path.join(HERE, "work/timing.md"), "w", encoding="utf-8").write("\n".join(rows) + "\n")
    print(json.dumps({"DUR": DUR, "B": B, "scenes": {s: [a, d] for s, (a, d, _) in win.items()}}))


if __name__ == "__main__":
    main()
