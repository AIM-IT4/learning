"""Exact word timings for the reel by forced alignment (wav2vec2 CTC through torchaudio).

usage: python3 tools/align_words.py [parts_dir] [gap_s] [out.json]
Each per-line take (vo-raw.wav.parts/NN.wav, as assemble_vo.py writes them) is aligned to the words
actually spoken (tts_lines.txt), and those spans are mapped onto the words shown on screen
(script.txt): "678" takes the span of "six hundred and seventy-eight", "Desk2Quant" the span of
"Desk to Quant". Absolute time = line start (cumulative take durations + gap, the layout of vo.wav)
+ time inside the take. Whisper only estimates word times; this pins them to the audio frames (20 ms).
"""
import sys, json, re, difflib, wave
import torch, torchaudio

PARTS = sys.argv[1] if len(sys.argv) > 1 else "assets/voice/vo-raw.wav.parts"
GAP = float(sys.argv[2]) if len(sys.argv) > 2 else 0.30
OUT = sys.argv[3] if len(sys.argv) > 3 else "assets/voice/words.json"
SPOKEN = [l.strip() for l in open("tts_lines.txt") if l.strip()]
SHOWN = [l.strip() for l in open("script.txt") if l.strip()]
assert len(SPOKEN) == len(SHOWN), "tts_lines.txt and script.txt must have the same lines"
nz = lambda x: re.sub(r"[^a-z0-9]", "", x.lower())

B = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
model = B.get_model().eval()
IDX = {c: i for i, c in enumerate(B.get_labels())}

def spoken_words(line):
    """Letters and apostrophes only; hyphens split words, dots inside initialisms are dropped (U.S. -> US)."""
    out = []
    for raw in line.split():
        for part in raw.split("-"):
            w = re.sub(r"[^A-Za-z']", "", part).upper().strip("'")
            if w: out.append(w)
    return out

def align(path, ws):
    wav, sr = torchaudio.load(path)
    wav = torchaudio.functional.resample(wav.mean(0, keepdim=True), sr, B.sample_rate)
    with torch.inference_mode():
        em, _ = model(wav)
    em = torch.log_softmax(em, dim=-1)
    toks, owner = [], []
    for k, w in enumerate(ws):
        if k: toks.append(IDX["|"]); owner.append(None)
        for ch in w: toks.append(IDX[ch]); owner.append(k)
    ali, sc = torchaudio.functional.forced_align(em, torch.tensor([toks], dtype=torch.int32), blank=0)
    spans = torchaudio.functional.merge_tokens(ali[0], sc[0].exp())
    assert len(spans) == len(toks), (path, len(spans), len(toks))
    sec = wav.shape[1] / em.shape[1] / B.sample_rate
    st, en = [None] * len(ws), [None] * len(ws)
    for sp, k in zip(spans, owner):
        if k is None: continue
        st[k] = sp.start * sec if st[k] is None else st[k]
        en[k] = sp.end * sec
    return list(zip(st, en))

def dur(p):
    with wave.open(p) as w: return w.getnframes() / w.getframerate()

words, t0 = [], 0.0
for li, (spk, shw) in enumerate(zip(SPOKEN, SHOWN)):
    part = f"{PARTS}/{li:02d}.wav"
    sw = spoken_words(spk); times = align(part, sw)
    dw = shw.split()
    sm = difflib.SequenceMatcher(None, [nz(x) for x in dw], [nz(x) for x in sw], autojunk=False)
    out = [None] * len(dw)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1): out[i1 + k] = times[j1 + k]
        elif tag == "replace":
            n, m = i2 - i1, j2 - j1
            for k in range(n):
                a = j1 + (k * m) // n; b = max(a, j1 + ((k + 1) * m) // n - 1)
                out[i1 + k] = (times[a][0], times[b][1])
    for k in range(len(dw)):       # a shown word nobody speaks sits at the end of the word before it
        if out[k] is None: out[k] = (out[k - 1][1], out[k - 1][1]) if k else (times[0][0], times[0][0])
    for x, (s, e) in zip(dw, out):
        words.append({"text": x, "start": round(t0 + s, 3), "end": round(t0 + e, 3), "line": li})
    t0 += dur(part) + GAP
json.dump(words, open(OUT, "w"), indent=1)
print(f"{len(words)} words aligned across {len(SHOWN)} lines -> {OUT}")
