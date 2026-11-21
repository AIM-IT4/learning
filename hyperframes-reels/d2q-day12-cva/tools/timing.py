"""Day 12/30 "CVA in 16 lines" (the code-along lesson reel): one source of truth for timing (the d2q-mr-promo pattern).
Reads the narration's word onsets (voice/out/words.json: 315 words, each with its onset t in assets/vo.wav and its beat;
the voice is the tightened take, every pause over 0.36 s cut to 0.30 s, placed at film t = 0.12) and writes:
  - every composition's DATA line: the beat windows, each beat's cue times (film seconds of the spoken words), the section
    row (hud) and the code card's whole schedule (code: lines typed, active lines, walk-through dimming, token underlines,
    console outputs, the badge);
  - the root index.html (the persistent layers, one host per beat that exists, the voice, the music bed and the effects);
  - work/timing.md (readable).
Every time is a word's onset in the current take, an offset from one, or the silence between two words (found in
assets/vo.wav), so nothing is tied to a clock: re-timing the narration only needs a new words.json. A cue names its word
and, to pick the right occurrence, the time the brief gave for it in the natural take (voice/out/words_v1_natural.json:
the same 315 words); its value is always the current take's onset.
Console texts and every other number are built here or in the scenes from work/numbers.json, never typed by hand.

usage: python3 tools/timing.py
"""
import json, os, re, wave

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VO_START = 0.12            # the voice starts at film t = 0.12
HOLD = 2.5                 # the call to action holds this long after the last word
LEAD = 0.10                # a beat's scene starts this long before its first word
XO = 0.35                  # ... and stays this long into the next beat, for its exit (a 0.3 s cross-fade in the chart card)

WJ = json.load(open(os.path.join(HERE, "voice/out/words.json"), encoding="utf-8"))
W = WJ["words"]
WOLD = json.load(open(os.path.join(HERE, "voice/out/words_v1_natural.json"), encoding="utf-8"))["words"]
assert [w["w"] for w in WOLD] == [w["w"] for w in W], "the natural take and the current one must have the same words"
DUR = round(VO_START + WJ["last_word_end"] + HOLD, 1)   # the film: the voice, then the hold
NUM = json.load(open(os.path.join(HERE, "work/numbers.json"), encoding="utf-8"))
with wave.open(os.path.join(HERE, "assets/vo.wav")) as _w:
    VO_SECONDS = round(_w.getnframes() / _w.getframerate(), 2)
assert len(W) == 315 and all(W[i]["t"] < W[i + 1]["t"] for i in range(len(W) - 1))


def norm(s):
    return re.sub(r"[^a-z0-9'\-]", "", s.lower().replace("’", "'"))


def wi(word, near):
    """the index of the spoken word `word`: the occurrence whose onset in the natural take is nearest `near` (the brief's
    times were written for that take); the same index in the current take is the same word"""
    cands = [i for i, w in enumerate(WOLD) if norm(w["w"]) == norm(word)]
    i = min(cands, key=lambda i: abs(WOLD[i]["t"] - near))
    assert abs(WOLD[i]["t"] - near) < 0.6 and norm(W[i]["w"]) == norm(word), (word, near, WOLD[i])
    return i


def cue(word, near):
    """film time of the spoken word's onset in the current take"""
    return round(W[wi(word, near)]["t"] + VO_START, 3)


# the silences in the voice (10 ms frames under -45 dBFS for at least 0.12 s), in film time: where a word ends, where an
# effect can sit
def _silences():
    import numpy as _np
    with wave.open(os.path.join(HERE, "assets/vo.wav")) as w_:
        sr = w_.getframerate(); x = _np.frombuffer(w_.readframes(w_.getnframes()), dtype=_np.int16).astype(float) / 32768
    hop = sr // 100
    db = [20 * _np.log10(_np.sqrt(_np.mean(x[i:i + hop] ** 2)) + 1e-9) for i in range(0, len(x) - hop, hop)]
    out, s0 = [], None
    for i, v in enumerate(db + [0.0]):
        if v < -45 and s0 is None: s0 = i
        if v >= -45 and s0 is not None:
            if i - s0 >= 12: out.append((round(s0 / 100 + VO_START, 3), round(i / 100 + VO_START, 3)))
            s0 = None
    return out
SIL = _silences()


def pause_before(word, near):
    """film time where the silence just before the word starts (the previous word's end); the word must follow a pause"""
    t = cue(word, near)
    c = [a for a, b in SIL if b <= t + 0.12 and b >= t - 0.25]
    assert c, ("no pause before", word, near)
    return max(c)


def word_end(word, near):
    """film time where the word's sound ends: the start of the first silence after its onset, if it comes before the next
    word; otherwise the next word's onset"""
    i = wi(word, near); t = W[i]["t"] + VO_START; nxt = W[i + 1]["t"] + VO_START if i + 1 < len(W) else t + 1.0
    c = [a for a, b in SIL if t + 0.05 < a < nxt]
    return round(min(c) if c else nxt, 3)


BEATS = sorted(WJ["beats"])                                   # b01 .. b11
BEAT = {b: round(WJ["beats"][b]["start"] + VO_START, 3) for b in BEATS}   # film time of each beat's first word
# a beat's scene start: LEAD before its first word; b01 at 0 (frame 1 is complete); b02's series card arrives 0.2 s
# before "Making" (in the pause after "Python."), and the code card empties at that moment
CARD = round(cue("Making", 13.50) - 0.2, 3)
START = {b: (0.0 if b == "b01" else round(BEAT[b] - LEAD, 3)) for b in BEATS}
START["b02"] = round(CARD - LEAD, 3)
# in the tightened take "Add it up. C V A:" runs on with no pause, so b08's sum builds through "C V A" and lands in the pause
# after "A:" (with the lock); b09's big number comes in just after, on "about sixty-five thousand dollars"
LAND = round(pause_before("about", 90.70) + 0.005, 3)
START["b09"] = round(LAND + 0.1, 3)

# ---- each beat's cues (film seconds)
CUE = {
    "b01": dict(two=cue("two-thirds", 1.94), werent=cue("weren't", 3.76), defaults=cue("defaults.", 4.10),
                c=cue("C", 5.80), v=cue("V", 6.171), a=cue("A:", 6.543),
                sub=[cue(x, t) for x, t in [("the", 7.10), ("price", 7.18), ("of", 7.40), ("default", 7.52), ("risk,", 7.90),
                                             ("going", 8.50), ("up.", 8.68)]],
                by=cue("By", 9.70), sixteen=cue("sixteen", 11.34), python=cue("Python.", 12.32)),
    "b02": dict(card=CARD, making=cue("Making", 13.50), quant=cue("Quant", 13.80), easy=cue("Easy,", 14.16),
                day=cue("day", 14.78), twelve=cue("twelve.", 15.02), lift=round(cue("When", 16.40) - 0.2, 3)),
    "b03": dict(when=cue("When", 16.40), swap=cue("swap", 17.26), client=cue("client,", 17.90), bust=cue("bust", 19.46),
                owing=cue("owing", 20.04), money=cue("money.", 20.74), c=cue("C", 21.85), v=cue("V", 22.027), a=cue("A", 22.203),
                what=cue("what", 22.84), that=cue("that", 23.04), risk=cue("risk", 23.20), costs=cue("costs", 23.44),
                today=cue("today,", 23.80), every=cue("every", 24.90), derivatives=cue("derivatives", 25.18), desk=cue("desk", 25.76),
                prices=cue("prices", 26.08)),
    "b04": dict(three=cue("Three", 27.80), what=cue("what", 29.00), how1=cue("how", 30.94), how2=cue("how", 33.00),
                one=cue("One", 34.65), c=cue("C", 35.72), v=cue("V", 36.071), a=cue("A.", 36.423)),
    "b05": dict(our=cue("Our", 36.95), trade=cue("trade:", 37.32), fiveyear=cue("five-year", 38.20), hundred=cue("hundred", 39.484),
                receive=cue("receive", 41.18), we=cue("We", 42.55), simulate=cue("simulate", 42.64), paths=cue("paths", 43.78),
                rise=cue("rise,", 45.96), moves=cue("moves", 47.28), against=cue("against", 47.70), fall=cue("fall,", 49.06),
                client=cue("client", 49.96)),
    "b06": dict(exposure=cue("Exposure", 51.25), keeps=cue("keeps", 51.74), only=cue("only", 52.14), us=cue("us,", 53.52),
                because=cue("because", 54.40), lose=cue("lose", 55.26), default=cue("default.", 56.10),
                average=cue("Average", 57.35), paths=cue("paths,", 58.18), you=cue("you", 59.20), expected=cue("expected", 59.64),
                exposure2=cue("exposure.", 60.02), peaks=cue("peaks", 61.60), peakdot=round(pause_before("It", 61.50) + 0.01, 3), one=cue("one", 62.18), million=cue("million,", 62.92),
                twenty=cue("twenty", 63.24), months=cue("months", 63.56)),
    "b07": dict(next=cue("Next,", 64.46), q=round(pause_before("The", 65.90) + 0.01, 3), credit=cue("credit", 66.40), hundred=cue("hundred", 67.57),
                basis=cue("basis", 68.24), forty=cue("forty", 69.98), recovery=cue("recovery,", 70.48),
                credit2=cue("credit", 71.20), triangle=cue("triangle", 71.44), hazard=cue("hazard", 72.80), two=cue("two", 73.70),
                nine=cue("nine", 75.44), five=cue("five", 77.62)),
    "b08": dict(now=cue("Now", 78.46), combine=cue("combine", 78.88), month=cue("month", 79.80), month2=cue("month:", 80.20),
                exposure=cue("exposure,", 81.30), chance=cue("chance", 82.62), month3=cue("month,", 83.72),
                discount=cue("discount", 84.88), factor=cue("factor,", 85.24), sixty=cue("sixty", 86.52), lose=cue("lose.", 87.32),
                add=cue("Add", 88.40), up=cue("up.", 88.66), cnext=cue("C", 89.96), land=LAND),
    "b09": dict(c=cue("C", 89.96), v=cue("V", 90.171), a=cue("A:", 90.383), sixtyfive=cue("sixty-five", 90.90),
                thousand=cue("thousand", 91.507), one=cue("one", 92.66), points=cue("points", 93.84), year=cue("year", 94.32),
                rate=cue("rate.", 94.96)),
    "b10": dict(interview=cue("Interview", 95.70), peak=cue("peak", 97.52), third=cue("third", 97.98), a3=cue("a", 97.80),
                dock=round(pause_before("Early", 99.70) + 0.01, 3), early=cue("Early", 99.70), rates=cue("rates", 100.54), much=cue("much.", 101.38), near=cue("Near", 102.55),
                payments=cue("payments", 103.56), left=cue("left.", 104.04), the=cue("The", 105.20), peak2=cue("peak", 105.28),
                between=cue("between.", 105.90)),
    "b11": dict(simulate=cue("Simulate,", 106.88), exposure=cue("exposure,", 108.02), default=cue("default,", 109.30),
                add=cue("add", 110.15), comment=cue("Comment", 111.20), c=cue("C", 111.48), v=cue("V", 111.629), a=cue("A,", 111.777),
                and_=cue("and", 112.00), dm=cue("DM", 112.46), notebook=cue("notebook.", 113.06), end=round(WJ["last_word_end"] + VO_START, 3)),
}

# ---- the code card's schedule (film seconds). Lines are pre-placed at their final line numbers and typed when the
# narration reaches them: each window runs from a cue word to a later cue word (or a word's end), so the typing speed
# scales with the narration and a line always finishes before the next line starts.
L6_END = round(cue("paths", 43.78) + 0.12, 3)
L9_END = round(cue("keeps", 51.74) + 0.1, 3)
L11_END = round(cue("triangle", 71.44) + 0.36, 3)
L16 = (round(cue("times", 84.50) - 0.1, 3), round(cue("times", 86.10) - 0.1, 3))
TYPE = [  # (line, start, end)
    (1, cue("When", 16.40), cue("a", 17.08)),
    (2, cue("what", 29.00), cue("owe", 29.78)), (4, cue("owe", 29.78), cue("time,", 30.50)),
    (3, cue("and", 32.68), cue("recover.", 33.54)),
    (5, cue("where", 40.90), word_end("fixed.", 41.56)),
    (6, cue("We", 42.55), L6_END), (7, L6_END, pause_before("If", 45.60)),
    (8, cue("the", 46.90), word_end("us.", 47.96)),
    (9, cue("Exposure", 51.25), L9_END), (10, L9_END, cue("us,", 53.52)),
    (11, cue("credit", 71.20), L11_END), (12, L11_END, cue("of", 73.46)),
    (13, cue("combine", 78.88), round(cue("them,", 79.24) + 0.26, 3)),
    (14, cue("exposure,", 81.30), cue("times", 82.15)),
    (15, cue("chance", 82.62), cue("month,", 83.72)),
    (16, L16[0], L16[1]),
]
assert sorted(l for l, *_ in TYPE) == list(range(1, 17))
_ty = sorted(TYPE, key=lambda x: x[1])
for _a, _b in zip(_ty, _ty[1:]):
    assert _a[2] <= _b[1] + 1e-6, ("a typed line runs into the next one", _a, _b)
assert all(e - s_ >= 0.25 for _, s_, e in TYPE), "a typing window under 0.25 s"
ACTIVE = [  # (from, active lines, walk-through dim: the other lines drop to ~40 %)
    (cue("When", 16.40), [1], 0), (cue("what", 29.00), [2, 4], 0), (cue("and", 32.68), [3], 0),
    (cue("five-year", 38.20), [2], 0), (cue("where", 40.90), [5], 0), (cue("We", 42.55), [6, 7], 0), (cue("the", 46.90), [8], 0),
    (cue("Exposure", 51.25), [9, 10], 0), (BEAT["b07"], [], 0), (cue("credit", 71.20), [11, 12], 0),
    (BEAT["b08"], [], 0), (cue("combine", 78.88), [13], 0), (cue("exposure,", 81.30), [14], 0), (cue("chance", 82.62), [15], 0),
    (L16[0], [16], 0),
    (START["b09"], [13, 14, 15, 16], 1),
    (BEAT["b10"], [], 0), (cue("Early", 99.70), [8], 1),
    (BEAT["b11"], [5, 6, 7, 8], 1), (cue("exposure,", 108.02), [9, 10], 1), (cue("default,", 109.30), [11, 12], 1),
    (cue("add", 110.15), [13, 14, 15, 16], 1), (cue("Comment", 111.20), [], 0),
]
UL = [  # (line, exact token in that line, from, to): a 3 px brand-blue underline under the token
    (16, "np.exp(-r * t)", cue("discount", 84.88), START["b09"]),
    (16, "(1 - R)", cue("sixty", 86.52), START["b09"]),
    (16, "np.sum", cue("Add", 88.40), START["b09"]),
    (8, "dx", cue("Early", 99.70), BEAT["b11"]),
    (8, "(T - t)", cue("Near", 102.55), BEAT["b11"]),
]
cva_m, cva_usd = NUM["cva_m"], NUM["cva_usd"]
CON = [  # (from, console text or None to clear): `>>> command  →  result   # comment`
    (round(cue("sixteen", 11.34) + 0.24, 3), f">>> cva()  →  {cva_m:.4f}   # $m = ${round(cva_usd):,}"),
    (CARD, None),
    (round(cue("us.", 50.52) + 0.08, 3), f">>> v = swap_values({NUM['paths']:_})   # {NUM['paths']:,} paths × {NUM['months']} months"),
    (cue("one", 62.18) + 0.3, f">>> exposure(v).max()  →  {NUM['ee_peak_m']:.2f}   # $m, at month {round(NUM['ee_peak_t'] * 12)}"),
    (cue("five", 77.62), f">>> default_prob()[-1]  →  {NUM['pd5']:.3f}"),
    (round(START["b09"] + 0.1, 3), f">>> cva()  →  {cva_m:.4f}   # $m"),
]
SCHED = {
    "preview": 0.35,                                        # b01: the finished file at 35 % from frame 1
    "brighten": cue("sixteen", 11.34),                      # ... brightening top to bottom on "sixteen", 30 ms apart
    "erase": CARD,                                          # as the series card arrives: the lines erase upward fast, the caret goes to line 1
    "type": TYPE, "active": ACTIVE, "ul": UL, "con": CON,
    "badge": [[cue("sixteen", 11.34) + 0.08, CARD], [round(L16[1] + 0.1, 3), DUR]],
}
# the section row: (from, label, current agenda step: -1 none, 0 simulate .. 3 CVA; steps done before it)
SECT = [
    (0.0, "the 2008 lesson", -1, 0), (cue("By", 9.70), "where we're going", 3, 0), (CARD, "series · day 12", -1, 0),
    (BEAT["b03"] - 0.1, "the big picture", -1, 0), (BEAT["b04"] - 0.1, "inputs → output", -1, 0),
    (BEAT["b05"] - 0.1, "step 1 · simulate", 0, 0), (BEAT["b06"] - 0.1, "step 2 · exposure", 1, 1),
    (BEAT["b07"] - 0.1, "step 3 · default", 2, 2), (BEAT["b08"] - 0.1, "step 4 · add it up", 3, 3),
    (START["b09"], "the answer", 3, 3), (BEAT["b10"] - 0.1, "interview question", -1, 4),
    (BEAT["b11"] - 0.1, "recap", 0, 0), (cue("exposure,", 108.02) - 0.05, "recap", 1, 1), (cue("default,", 109.30) - 0.05, "recap", 2, 2),
    (cue("add", 110.15) - 0.05, "recap", 3, 3), (cue("Comment", 111.20) - 0.1, "your turn", -1, 4),
]


def windows():
    """beat -> (film start, duration, next beat's start in scene time)"""
    w = {}
    for k, b in enumerate(BEATS):
        a = START[b]
        if k < len(BEATS) - 1:
            nb = START[BEATS[k + 1]]
            w[b] = (a, round(nb + XO - a, 3), round(nb - a, 3))
        else:
            w[b] = (a, round(DUR - a, 3), round(DUR - a, 3))
    return w


def patch(path, data):
    s = open(path, encoding="utf-8").read()
    new, n = re.subn(r"/\*DATA\*/.*?/\*END\*/", lambda m: "/*DATA*/ " + data + " /*END*/", s, flags=re.S)
    if n != 1:
        raise SystemExit(f"{path}: expected one DATA block, found {n}")
    open(path, "w", encoding="utf-8").write(new)


# ---- sound effects: (file, film time, seconds, volume). CC0 (uisfx, via d2q-mr-promo/assets/sfx, PICKS.json): chip = a soft
# click as a card or chip docks, lock = a two-tone confirm (the peak marker, the answer landing), send = the comment send,
# end = the close, type = a very soft tick at the start of a typed line. Calm: at most one effect per ~1.5 s, and never on a
# stressed word: every cue sits in a pause or on an unstressed function word (checked below against the voice's words: a
# cue may not start from 0.05 s before a content word's onset until the word ends (the silence after it, or the next word;
# at most 0.6 s), and no content word may start in its first 0.24 s; the voice level at each cue is reported).
D = {"send": 0.42, "lock": 0.29, "chip": 0.29, "type": 0.13, "end": 0.68}
FUNC = set("a the of in on it is and to we we'll us they you your by or at with while that what where when how if for are "
           "its it's this that's few then because our".split())


DROPPED = []


def sfx_list():
    S = []; DROPPED.clear()
    add = lambda n, t, v, why: S.append((n, round(t, 2), D[n], v, why))
    add("chip", pause_before("They", 5.50) + 0.01, 0.06, "b01: the ? chip in the blue part (pause after 'defaults.')")
    add("chip", pause_before("By", 9.70) + 0.01, 0.05, "b01: the result preview comes in (pause before 'By')")
    add("chip", pause_before("Making", 13.50) + 0.01, 0.06, "b02: the series card arrives (pause before 'Making')")
    add("chip", CUE["b02"]["lift"] - 0.02, 0.045, "b02: the series card lifts away (pause before 'When')")
    add("chip", pause_before("C", 21.85) + 0.01, 0.06, "b03: 'lost' (pause after 'money.')")
    add("type", cue("what", 29.00), 0.035, "line 2 starts typing ('what')")
    add("type", cue("and", 32.68), 0.035, "line 3 starts typing ('and')")
    add("chip", pause_before("Our", 36.95) + 0.01, 0.06, "b04: 'one number' (pause after 'C V A.')")
    add("type", cue("where", 40.90), 0.035, "line 5 starts typing ('where')")
    add("type", cue("We", 42.55) - 0.12, 0.035, "lines 6-7 start typing (just before 'We')")
    add("type", cue("the", 46.90) - 0.1, 0.035, "line 8 starts typing (just before 'the')")
    add("chip", CUE["b06"]["because"], 0.06, "b06: 'lost if they default' ('because')")
    add("lock", CUE["b06"]["peakdot"], 0.08, "b06: the peak marker lands (pause before 'It peaks')")
    add("chip", CUE["b07"]["q"], 0.05, "b07: the year-5 '?' (pause before 'The client's')")
    add("type", L16[0] - 0.12, 0.035, "line 16 starts typing (pause before 'times')")
    add("lock", LAND, 0.08, "b08/b09: the sum lands on $64,563 (pause after 'C V A:')")
    add("chip", CUE["b10"]["dock"], 0.06, "b10: the question docks as the heading (pause before 'Early')")
    add("send", CUE["b11"]["and_"], 0.08, "b11: the comment sends ('and')")
    add("end", CUE["b11"]["end"] + 0.27, 0.09, "the close, after 'notebook.'")
    S.sort(key=lambda x: x[1])
    # the soft typing ticks are optional: one that comes within 1.5 s of another effect is dropped
    kept = []
    for e in S:
        if kept and e[1] - kept[-1][1] < 1.5:
            if e[0] == "type": continue
            if kept[-1][0] == "type": kept.pop()
        kept.append(e)
    S = kept
    # checks: spacing, stressed words, voice level at the cue
    import numpy as _np, wave as _wv
    with _wv.open(os.path.join(HERE, "assets/vo.wav")) as w_:
        sr = w_.getframerate(); x = _np.frombuffer(w_.readframes(w_.getnframes()), dtype=_np.int16).astype(float) / 32768
    def lvl(t):
        a = int((t - VO_START) * sr); seg = x[max(0, a):max(0, a) + int(0.15 * sr)]
        return -99.0 if len(seg) == 0 else round(20 * _np.log10(_np.sqrt(_np.mean(seg ** 2)) + 1e-9), 1)
    def clash(n, t, d):
        for i, w in enumerate(W):
            on = w["t"] + VO_START
            nxt = W[i + 1]["t"] + VO_START if i + 1 < len(W) else on + 0.6
            sil = [a for a, b in SIL if on + 0.05 < a < nxt]
            end = min(on + 0.6, min(sil) if sil else nxt)       # a word lasts until the silence after it or the next word
            if norm(w["w"]) not in FUNC and (on - 0.05 < t < end or t < on < t + min(d, 0.24)):
                return f"{w['w']!r} ({on:.2f})"
        return None
    out = []
    for e in S:
        c = clash(e[0], e[1], e[2])
        if c and e[0] in ("chip", "type"):
            DROPPED.append(f"  dropped {e[0]} at {e[1]}: it would sit on the stressed word {c} - {e[4]}")
            continue
        if c:
            raise SystemExit(f"effect {e[0]} at {e[1]} sits on the stressed word {c}: {e[4]}")
        out.append(e)
    S = out
    for k in range(1, len(S)):
        assert S[k][1] - S[k - 1][1] >= 1.5, ("effects closer than 1.5 s", S[k - 1], S[k])
    return S


def sfx_report():
    import numpy as _np, wave as _wv
    with _wv.open(os.path.join(HERE, "assets/vo.wav")) as w_:
        sr = w_.getframerate(); x = _np.frombuffer(w_.readframes(w_.getnframes()), dtype=_np.int16).astype(float) / 32768
    out = []
    for n, t, d, v, why in sfx_list():
        a = int((t - VO_START) * sr); seg = x[max(0, a):max(0, a) + int(0.2 * sr)]
        L = -99.0 if len(seg) == 0 else 20 * _np.log10(_np.sqrt(_np.mean(seg ** 2)) + 1e-9)
        out.append(f"  {t:7.2f} {n:5s} vol {v:.3f}  voice {L:6.1f} dBFS over the next 0.2 s  - {why}")
    return out


def tidy(v):
    """round every float in a nested structure to 3 decimals (film seconds)"""
    if isinstance(v, float):
        return round(v, 3)
    if isinstance(v, (list, tuple)):
        return [tidy(x) for x in v]
    if isinstance(v, dict):
        return {k: tidy(x) for k, x in v.items()}
    return v


def main():
    global SCHED, SECT, TYPE, ACTIVE, UL, CON
    SCHED, SECT, TYPE, ACTIVE, UL, CON = tidy(SCHED), tidy(SECT), tidy(TYPE), tidy(ACTIVE), tidy(UL), tidy(CON)
    win = windows()
    comp = lambda n: os.path.join(HERE, "compositions", n + ".html")
    j = lambda v: json.dumps(v, ensure_ascii=False)
    if os.path.exists(comp("bg")):
        patch(comp("bg"), f"const DUR = {DUR}; const T0 = 0;")
    if os.path.exists(comp("hud")):
        patch(comp("hud"), f"const DUR = {DUR}; const T0 = 0; const SECT = {j(SECT)};")
    if os.path.exists(comp("code")):
        patch(comp("code"), f"const DUR = {DUR}; const T0 = 0; const SCHED = {j(SCHED)};")
    hosts = []
    for i, b in enumerate(BEATS):
        a, d, nx = win[b]
        if not os.path.exists(comp(b)):
            continue
        patch(comp(b), f"const DUR = {d}; const T0 = {a}; const NEXT = {nx}; const CUE = {j(CUE.get(b, {}))};")
        hosts.append(f'      <div id="{b}" data-composition-id="{b}" data-composition-src="compositions/{b}.html" data-start="{a}" '
                     f'data-duration="{d}" data-track-index="{2 + i}" data-track-kind="graphics" data-width="1080" data-height="1920" '
                     f'style="z-index: 1"></div>')
    auds = [f'      <audio id="vo" class="clip" src="assets/vo.wav" data-start="{VO_START}" data-duration="{VO_SECONDS}" '
            f'data-track-index="30" data-volume="1"></audio>']
    if os.path.exists(os.path.join(HERE, "assets/bgm.wav")):
        auds.append(f'      <audio id="bgm" class="clip" src="assets/bgm.wav" data-start="0" data-duration="{DUR}" data-track-index="31" '
                    f'data-timeline-role="music" data-volume="0.75" data-fade-in="0.2" data-fade-out="1.5"></audio>')
    for k, (name, t, d, v, _why) in enumerate(sfx_list()):
        auds.append(f'      <audio id="fx{k:02d}" class="clip" src="assets/sfx/{name}.mp3" data-start="{t}" data-duration="{d}" '
                    f'data-track-index="{32 + k}" data-volume="{v}"></audio>')
    layer = lambda n, z, ti: (f'      <div id="{n}" data-composition-id="{n}" data-composition-src="compositions/{n}.html" data-start="0" '
                              f'data-duration="{DUR}"\n           data-track-index="{ti}" data-track-kind="graphics" data-width="1080" '
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
{layer("bg", 0, 1)}
{chr(10).join(hosts)}
{layer("code", 2, 17)}
{layer("hud", 3, 18)}
{chr(10).join(auds)}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""
    open(os.path.join(HERE, "index.html"), "w", encoding="utf-8").write(html)
    rows = [f"DUR {DUR}  LEAD {LEAD}  XO {XO}  voice at {VO_START} ({VO_SECONDS} s)",
            "beats (film, first word) " + " ".join(f"{b}:{BEAT[b]}" for b in BEATS)]
    for b in BEATS:
        a, d, nx = win[b]
        rows.append(f"{b}: scene film {a} - {round(a + d, 3)} (next beat at scene {nx})" + (f"  cues {j(CUE[b])}" if b in CUE else ""))
    rows.append("code typing (line, film from, to): " + j(TYPE))
    rows.append("active (film, lines, dim): " + j(ACTIVE))
    rows.append("underlines: " + j(UL))
    rows.append("console: " + j(CON))
    rows.append("sections: " + j(SECT))
    rows.append("sound effects (film time, file, volume, the voice level at the cue):")
    rows += sfx_report()
    rows += DROPPED
    open(os.path.join(HERE, "work/timing.md"), "w", encoding="utf-8").write("\n".join(rows) + "\n")
    print(json.dumps({"DUR": DUR, "scenes": {b: [win[b][0], win[b][1]] for b in BEATS if os.path.exists(comp(b))}}))


if __name__ == "__main__":
    main()
