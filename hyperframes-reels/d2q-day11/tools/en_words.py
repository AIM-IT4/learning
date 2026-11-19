"""English takes: hear each one, compare it with the script, and time every script word.
usage: python3 en_words.py lines.json out.json name=take.wav [name=take.wav ...]

faster-whisper large-v3-turbo hears each take (no prompt, so a garbled word shows up as garbled). Its word starts get
the pause snap (a word whose span holds a pause really starts where the pause ends), then the script's words are
matched to the heard words (difflib on lower-case letters and digits). A script word with no exact match ("twenty-six"
heard as "26") takes the start of the first heard word in its block; the rest of a block is spread by letter count.
out.json: {name: {"heard", "match" (0-1), "onsets" (one per script word, s), "end" (last heard word's end), "dur"}}."""
import difflib, json, re, sys
import librosa, numpy as np
from faster_whisper import WhisperModel

lines = dict(json.load(open(sys.argv[1], encoding="utf-8")))
out = sys.argv[2]
jobs = [a.split("=", 1) for a in sys.argv[3:]]
m = WhisperModel("mobiuslabsgmbh/faster-whisper-large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=4)
norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())
res = {}
for name, f in jobs:
    y, sr = librosa.load(f, sr=16000, mono=True)
    segs, _ = m.transcribe(y.astype(np.float32), language="en", word_timestamps=True, condition_on_previous_text=False, beam_size=5)
    heard = [[w.word.strip(), float(w.start), float(w.end)] for s in segs for w in (s.words or []) if w.word.strip()]
    fr = int(0.05 * sr)
    db = np.array([20 * np.log10(np.sqrt(np.mean(y[i:i + fr] ** 2)) + 1e-9) for i in range(0, len(y) - fr, fr)])
    thr, pauses, run = db.max() - 38, [], None
    for i, d in enumerate(list(db) + [-200]):
        if d < thr: run = i if run is None else run
        else:
            if run is not None and (i - run) * 0.05 >= 0.15: pauses.append((run * 0.05, i * 0.05))
            run = None
    for k, w in enumerate(heard):
        for ps, pe in pauses:
            if k > 0 and ps < w[2] and pe > w[1] and pe < w[2]: w[1] = max(w[1], pe)
    said = lines[name].split()
    a, b = [norm(x) for x in said], [norm(x[0]) for x in heard]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    on = [None] * len(said)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1): on[i1 + k] = heard[j1 + k][1]
        elif tag == "replace":
            on[i1] = heard[j1][1]
    end = heard[-1][2] if heard else len(y) / sr
    i = 0
    while i < len(on):
        if on[i] is not None:
            i += 1; continue
        j = i
        while j < len(on) and on[j] is None: j += 1
        if i == 0:                                   # the take opens on an unmatched word: it starts with the speech
            on[0] = heard[0][1] if heard else 0.0; i = 1
            if j == 1: continue
        t0, t1 = on[i - 1], (on[j] if j < len(on) else end)
        lens = [len(said[k]) + 1 for k in range(i - 1, j)]   # words i-1 .. j-1 share [t0, t1] by letter count
        acc = 0
        for k in range(i, j):
            acc += lens[k - i]; on[k] = t0 + (t1 - t0) * acc / sum(lens)
        i = j
    res[name] = {"heard": " ".join(x[0] for x in heard), "match": round(sm.ratio(), 3), "onsets": [round(x, 3) for x in on],
                 "end": round(end, 3), "dur": round(len(y) / sr, 3)}
    print(f"{name} {res[name]['match']:.2f} | {res[name]['heard']}", flush=True)
json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
