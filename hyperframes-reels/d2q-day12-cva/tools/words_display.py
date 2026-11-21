"""Caption words with on-screen spellings, from en_words.py output for ONE continuous take.
usage: python3 tools/words_display.py voice/out/words_raw.json <name> voice/out/words.json
The script tokens are voice/lines.json's p1, p2, p3b, p4, p5, p6, p7 lines joined in order; each display word keeps
its chapter ("line") so tools/timing.py can find chapter starts (line_start_word)."""
import json, re, sys
raw = json.load(open(sys.argv[1]))[sys.argv[2]]
L = dict(json.load(open("voice/lines.json")))
order = ["p1", "p2", "p3b", "p4", "p5", "p6", "p7"]
toks, line_of = [], []
for k in order:
    for t in L[k].split(): toks.append(t); line_of.append(k)
on = raw["onsets"]; assert len(on) == len(toks), (len(on), len(toks))
def bare(t): return re.sub(r"[^\w'-]", "", t).lower()
def punct(t): m = re.search(r"[^\w'-]+$", t); return m.group(0) if m else ""
groups = [(["a", "hundred", "and", "forty-one"], "141"), (["four", "thousand", "nine", "hundred", "and", "nineteen"], "4,919"),
          (["twenty", "twenty-four"], "2024"), (["fifty", "percent"], "50%"), (["f", "r", "t", "b"], "FRTB"), (["f", "x"], "FX"),
          (["nineteen"], "19"), (["sixty-four"], "64"), (["fourteen"], "14"), (["seven"], "7"), (["var"], "VaR"), (["kupiets"], "Kupiec")]
out, i = [], 0
while i < len(toks):
    for seq, disp in groups:
        n = len(seq)
        if [bare(t) for t in toks[i:i + n]] == seq:
            out.append({"w": disp + punct(toks[i + n - 1]), "s": on[i], "line": line_of[i]}); i += n; break
    else:
        out.append({"w": toks[i], "s": on[i], "line": line_of[i]}); i += 1
for j, w in enumerate(out):
    nxt = out[j + 1]["s"] if j + 1 < len(out) else raw["end"]
    w["e"] = round(min(nxt, w["s"] + 0.9), 3); w["s"] = round(w["s"], 3)
starts = {}
for j, w in enumerate(out): starts.setdefault(w["line"], j)
json.dump({"words": out, "line_start_word": starts, "end": raw["end"],
           "note": "times in seconds from the start of voice/out/vo.wav (place the voice at film t = 0.12)"},
          open(sys.argv[3], "w"), indent=1)
print(len(out), "words; end", raw["end"]); [print(k, out[starts[k]]["s"]) for k in order]
