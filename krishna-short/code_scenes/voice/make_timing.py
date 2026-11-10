"""Turn the chosen narration takes into the documentary timing.

  python3 make_timing.py <take_dir> <out_dir> [--start 1.0] [--gap 0.45] [--part1 60.11] [--total 90.841]

Writes out_dir/narration.wav (48 kHz mono, placed on the video timeline) and out_dir/timing.json for
chhath_doc.html: shot cuts on sentence starts, subtitle chunks (display spelling) and key-word cues.
"""
import argparse, json, re, subprocess
from difflib import SequenceMatcher
from pathlib import Path
import numpy as np
from faster_whisper import WhisperModel

ap = argparse.ArgumentParser()
ap.add_argument("take_dir"); ap.add_argument("out_dir")
ap.add_argument("--lines", default=str(Path(__file__).with_name("lines_v3.json")), help="spoken script, [name, text] pairs")
ap.add_argument("--map", default=None, help='JSON: which passages each take holds, e.g. {"T1": ["p0", "p1"], ...} (default: one take per passage)')
ap.add_argument("--start", type=float, default=1.0); ap.add_argument("--gap", type=float, default=0.45)
ap.add_argument("--part1", type=float, default=60.11); ap.add_argument("--total", type=float, default=90.841)
a = ap.parse_args()
take, out = Path(a.take_dir), Path(a.out_dir); out.mkdir(parents=True, exist_ok=True)

# display text: passages -> sentences -> subtitle chunks (split at "…" where a sentence is long)
DISPLAY = {
    "p0": [["दीवाली बीत गई… अब हर बिहारी को इंतज़ार है…", "लोक आस्था के महापर्व, छठ पूजा का।"]],
    "p1": [["पर यह परंपरा शुरू कहाँ से हुई?"], ["हज़ारों साल पहले, ऋग्वेद की ऋचाओं में सूर्य की स्तुति हुई…", "और नदी में खड़े होकर अर्घ्य देने की परंपरा बनी।"]],
    "p2": [["मान्यता है कि माता सीता ने मुंगेर में गंगा तट पर छठ का व्रत किया था।"],
           ["महाभारत में सूर्यपुत्र कर्ण रोज़ कमर भर पानी में खड़े होकर अर्घ्य देते थे…", "और द्रौपदी ने भी यही व्रत रखा।"]],
    "p3": [["पुराणों में कथा है — राजा प्रियव्रत के पुत्र को षष्ठी देवी ने जीवनदान दिया।"], ["तभी से छठी मैया की पूजा होने लगी।"],
           ["देव के सूर्य मंदिर से गंगा के घाटों तक…", "बिहार ने यह परंपरा पीढ़ी दर पीढ़ी संजोकर रखी।"]],
    "p4": [["न कोई पुरोहित… न कोई मूर्ति…", "बस सूरज, जल और अटूट आस्था।"], ["चार दिन का महापर्व — छठ पूजा।"]],
}
# spoken-text anchor for the start of every display chunk
ANCHORS = {"p0": [["दीवाली", "लोक आस्था"]], "p1": [["पर यह"], ["हज़ारों", "और नदी"]], "p2": [["मान्यता"], ["महाभारत", "और द्रौपदी"]],
           "p3": [["पुराणों"], ["तभी से"], ["देव के", "बिहार ने"]], "p4": [["न कोई पुरोहित", "बस सूरज"], ["चार दिन"]]}
BIG_TYPE = {"p0", "p4"}   # shown as large on-screen words, so no subtitle
SR = 48000
def load(f, sr=SR):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()
def speech_segments(y, sr, min_gap=0.16, thr_db=-36):
    hop = int(0.01 * sr); e = np.sqrt(np.convolve(y ** 2, np.ones(hop * 2) / (hop * 2), "same"))[::hop]
    db = 20 * np.log10(e / e.max() + 1e-9); on = db > thr_db; segs, s, last = [], None, None
    for i, v in enumerate(on):
        t = i * hop / sr
        if v and s is None: s = t
        if v: last = t
        if not v and s is not None and t - last > min_gap: segs.append([s, last]); s = None
    if s is not None: segs.append([s, last])
    return [g for g in segs if g[1] - g[0] > 0.08]
def split_at_pauses(segs, n):
    """n groups from the speech segments, cut at the n-1 longest pauses."""
    if n <= 1 or len(segs) < 2: return [[segs[0][0], segs[-1][1]]]
    gaps = sorted(range(len(segs) - 1), key=lambda i: segs[i + 1][0] - segs[i][1], reverse=True)[:n - 1]
    out, s0 = [], 0
    for c in sorted(gaps) + [len(segs) - 1]: out.append([segs[s0][0], segs[c][1], s0, c]); s0 = c + 1
    return out

model = WhisperModel("mobiuslabsgmbh/faster-whisper-large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=4)
def norm(s): return re.sub(r"[^ऀ-ॿ]", "", s.replace("़", ""))

SPOKEN = dict(json.load(open(a.lines, encoding="utf-8")))
TAKES = json.loads(a.map) if a.map else {p: [p] for p in ["p0", "p1", "p2", "p3", "p4"] if p in SPOKEN}
for tk, ps in TAKES.items():   # a take that holds several passages: concatenate their display chunks and anchors
    if tk not in DISPLAY:
        DISPLAY[tk] = [sent for p in ps for sent in DISPLAY[p]]; ANCHORS[tk] = [sent for p in ps for sent in ANCHORS[p]]
        BIGS = [p in BIG_TYPE for p in ps for _ in DISPLAY[p]]
        DISPLAY[tk + "_big"] = BIGS
def n2(s): return re.sub(r"[^\u0900-\u097F]", "", s.replace("़", "").replace("ँ", "ं").replace("ॉ", "ो"))
track = np.zeros(int(a.total * SR), np.float32)
t, sentences, chunks, words, cue_t = a.start, [], [], [], {}
for name in TAKES:
    y = load(take / f"{name}.wav")
    idx = np.where(np.abs(y) > 0.01 * np.abs(y).max())[0]; lead = max(idx[0] - int(0.04 * SR), 0); y = y[lead: idx[-1] + int(0.12 * SR)]
    track[int(t * SR): int(t * SR) + len(y)] += y[: len(track) - int(t * SR)]
    y16 = load(take / f"{name}.wav", 16000)[int(lead / SR * 16000):]
    sg, _ = model.transcribe(y16, language="hi", word_timestamps=True, beam_size=5)
    ws = [[w.word.strip(), t + w.start, t + w.end] for s_ in sg for w in s_.words]
    words += [w + [name] for w in ws]
    # character-level alignment: spoken script -> recognised words
    asr, times = "", []
    for w, s0, s1 in ws:
        c = n2(w); asr += c; times += [(s0, s1)] * len(c)
    spoken = SPOKEN[name]; scr = n2(spoken)
    sm = SequenceMatcher(None, scr, asr, autojunk=False); mp = {}
    for b in sm.get_matching_blocks():
        for k in range(b.size): mp[b.a + k] = b.b + k
    def at(ci, end=False):
        keys = [k for k in mp if (k < ci if end else k >= ci)]
        if not keys: return None
        k = max(keys) if end else min(keys)
        return times[mp[k]][1 if end else 0]
    def pos(phrase, after=0):
        i = scr.find(n2(phrase), after); return i if i >= 0 else None
    starts = []
    for sent in ANCHORS[name]:
        for ph in sent: starts.append(pos(ph, starts[-1] + 1 if starts else 0))
    bounds = starts + [len(scr)]
    k = 0
    for si, sent in enumerate(ANCHORS[name]):
        for j, ph in enumerate(sent):
            c0, c1 = bounds[k], bounds[k + 1]
            ta, tb = at(c0), at(c1, end=True)
            big = DISPLAY[name + "_big"][si] if name + "_big" in DISPLAY else name in BIG_TYPE
            chunks.append([round(ta - 0.08, 2), round(tb + 0.3, 2), DISPLAY[name][si][j], "big" if big else name])
            if j == 0: sentences.append([round(ta, 2), round(tb, 2)])
            k += 1
    for key, ph, nth in [("diwali1", "दीवाली", 1), ("diwali2", "अब हर", 1), ("chhath0", "लोक आस्था", 1), ("draupadi", "द्रौपदी", 1), ("shashthi", "षष्ठी", 1), ("alive", "जीवनदान", 1), ("today2", "न कोई मूर्ति", 1), ("today3", "बस सूरज", 1)]:
        i = pos(ph)
        if i is not None and key not in cue_t: cue_t[key] = at(i)
    t += len(y) / SR + a.gap
narr_end = t - a.gap
for i, c in enumerate(chunks):
    nxt = chunks[i + 1][0] if i + 1 < len(chunks) else c[1] + 1
    c[1] = round(min(max(c[1], c[0] + 1.2), nxt - 0.02), 2)
# sentence order: 0 Diwali, 1 question, 2 Rigveda, 3 Sita, 4 Mahabharata, 5 Purana, 6 Chhathi Maiya, 7 Deo, 8 no priest, 9 four days
cues = {"diwali1": cue_t.get("diwali1"), "diwali2": cue_t.get("diwali2"), "draupadi": cue_t.get("draupadi"), "shashthi": cue_t.get("shashthi"),
        "alive": cue_t.get("alive"), "today1": sentences[8][0], "today2": cue_t.get("today2"), "today3": cue_t.get("today3"), "today4": sentences[9][0]}
S = sentences
cut = lambda x: x - 0.35
shots = [["diwali", 0, cut(cue_t["chhath0"])], ["surya", cut(cue_t["chhath0"]), cut(S[2][0])], ["vedic", cut(S[2][0]), cut(S[3][0])],
         ["sita", cut(S[3][0]), cut(S[4][0])], ["karna", cut(S[4][0]), cut(S[5][0])], ["shashthi", cut(S[5][0]), cut(S[7][0])],
         ["deo", cut(S[7][0]), cut(S[8][0])], ["today", cut(S[8][0]), a.part1]]
bar = 4 * 0.48017
shots += [[f"day{i + 1}", round(a.part1 + i * 4 * bar, 3), round(a.part1 + (i + 1) * 4 * bar, 3)] for i in range(4)]
shots = [[n, round(x, 3), round(y, 3)] for n, x, y in shots]
timing = {"shots": shots, "subs": [c[:3] for c in chunks if c[3] != "big" and c[3] not in BIG_TYPE], "cues": {k: (round(v, 2) if v is not None else None) for k, v in cues.items()},
          "disclose": None, "total": a.total}
json.dump(timing, open(out / "timing.json", "w"), ensure_ascii=False, indent=1)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", str(out / "narration.wav")], input=track.tobytes(), check=True)
json.dump(words, open(out / "words.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(timing, ensure_ascii=False, indent=1)); print("narration ends", round(narr_end, 2))
