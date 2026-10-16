"""Tighten silent gaps in the VO, time-stretch it, and remap word timestamps."""
import json, subprocess, sys, wave
import numpy as np

V = sys.argv[1]
TAKE = sys.argv[2] if len(sys.argv) > 2 else 'takeB'   # audio/<TAKE>.mp3 + audio/words_<TAKE>.json
TEMPO = 1.0           # natural pace: no time-stretch
LEAD = 1.3            # seconds of picture before the first word
SR = 48000

def read_wav(p):
    w = wave.open(p); sr = w.getframerate(); n = w.getnframes(); ch = w.getnchannels()
    x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    return x.reshape(-1, ch).mean(1), sr

def write_wav(p, x, sr):
    x = np.clip(x, -1, 1)
    if x.ndim == 1: x = x[:, None]
    w = wave.open(p, 'wb'); w.setnchannels(x.shape[1]); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((x * 32767).astype(np.int16).tobytes()); w.close()

subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{V}/audio/{TAKE}.mp3', '-ar', str(SR), '-ac', '1', f'{V}/audio/b48.wav'], check=True)
x, sr = read_wav(f'{V}/audio/b48.wav')
words = [w for w in json.load(open(f'{V}/audio/words_{TAKE}.json'))['words']
         if not (w['text'].startswith('[') or w['text'].endswith(']'))]

hop = sr // 100
fr = len(x) // hop
db = 20 * np.log10(np.sqrt(np.mean(x[:fr * hop].reshape(fr, hop) ** 2, 1)) + 1e-9)
# smooth a little so single loud frames don't split a silence
db = np.convolve(db, np.ones(3) / 3, 'same')
speech = np.median(db[db > -60])
thr = speech - 19
print(f'speech median {speech:.1f} dB, silence thr {thr:.1f} dB')

inword = np.zeros(fr, bool)
for w in words:
    inword[int(w['start'] * 100) + 4:int(w['end'] * 100) - 2] = True
# true silence anywhere, or breathy low-level air between aligned words
sil = db < thr
runs, i = [], 0
while i < fr:
    if sil[i]:
        j = i
        while j < fr and sil[j]: j += 1
        a, b = i / 100, j / 100
        if b - a >= 1.4 and a > 0.05: runs.append((a, b))
        i = j
    else:
        i += 1

# the beat before "So maybe nothing is fake" is deliberate: keep it long
keep_long = [w for w in words if w['text'] == 'So'][0]['start']
cuts = []  # (start, end) in original seconds to remove
for a, b in runs:
    L = b - a
    if a - 0.3 < keep_long < b + 0.6:
        newL = min(L, 1.25)
    else:
        newL = 0.75 + 0.3 * (L - 0.75)
    rm = L - newL
    if rm > 0.03:
        c = (a + b) / 2
        cuts.append((c - rm / 2, c + rm / 2))
print(f'{len(runs)} silent runs, removing {sum(b-a for a,b in cuts):.2f}s')

# breathing room before scene-start words: (word, occurrence, seconds)
BREATHE = [('you', 1, 0.45), ('even', 0, 0.4), ('the', 'colors', 0.4), ('look', 1, 0.5), ('and', 'some', 0.5),
           ('and', 'you?', 0.6), ('the', 'ancients', 1.0), ('so', 0, 0.5), ('close', 0, 0.45)] if TAKE == 'takeC' else []
norm = lambda w: ''.join(ch for ch in w.lower() if ch.isalpha() or ch in "'?")
inserts = []
for wd, key, dur in BREATHE:
    for i, w in enumerate(words):
        if norm(w['text']).strip('?') != wd: continue
        if isinstance(key, int):
            if sum(1 for v in words[:i] if norm(v['text']).strip('?') == wd) != key: continue
        elif i + 1 >= len(words) or norm(words[i + 1]['text']) != key: continue
        a = words[i - 1]['end'] if i else 0.0; b = w['start']
        seg = db[int(a * 100):max(int(b * 100), int(a * 100) + 1)]
        tq = a + (int(np.argmin(seg)) / 100 if len(seg) else 0)
        inserts.append((tq, dur)); break
print('inserts', [(round(a, 2), d) for a, d in inserts])

# splice with 12 ms equal-power crossfades
xf = int(0.012 * sr)
ops = sorted([(a, b, 'cut') for a, b in cuts] + [(a, d, 'ins') for a, d in inserts])
out, pos = [], 0
for a, b, kind in ops:
    ia = int(a * sr)
    out.append(x[pos:ia])
    if kind == 'cut': pos = int(b * sr)
    else: out.append(np.zeros(int(b * sr))); pos = ia
segs = [s_ for s_ in out + [x[pos:]] if len(s_)]
y = segs[0]
fade = np.linspace(0, 1, xf)
for s in segs[1:]:
    if len(y) > xf and len(s) > xf:
        mid = y[-xf:] * np.cos(fade * np.pi / 2) + s[:xf] * np.sin(fade * np.pi / 2)
        y = np.concatenate([y[:-xf], mid, s[xf:]])
    else:
        y = np.concatenate([y, s])

def remap(t):
    """original time -> edited time (before tempo)."""
    shift = 0.0
    for a, b, kind in ops:
        if kind == 'cut':
            if t >= b: shift += (b - a) + xf / sr
            elif t > a: shift += (t - a); break
        elif t >= a: shift -= b - xf / sr
    return t - shift

write_wav(f'{V}/audio/b_tight.wav', y, sr)
# time-stretch (pitch preserved) + VO polish
af = ('highpass=f=55,'
      'acompressor=threshold=-22dB:ratio=1.8:attack=15:release=220:makeup=2')
if TEMPO != 1.0: af = f'rubberband=tempo={TEMPO}:pitchq=quality:formant=preserved,' + af
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{V}/audio/b_tight.wav', '-af', af,
                '-ar', str(SR), f'{V}/audio/vo_stretched.wav'], check=True)
z, _ = read_wav(f'{V}/audio/vo_stretched.wav')
z = np.concatenate([np.zeros(int(LEAD * SR)), z])
write_wav(f'{V}/audio/vo_final.wav', z, SR)

nw = [{'w': w['text'], 's': round(LEAD + remap(w['start']) / TEMPO, 3),
       'e': round(LEAD + remap(w['end']) / TEMPO, 3)} for w in words]
json.dump({'words': nw, 'vo_end': round(len(z) / SR, 3)}, open(f'{V}/audio/timeline.json', 'w'), indent=0)
print(f'VO final length {len(z)/SR:.2f}s (incl {LEAD}s lead); last word ends {nw[-1]["e"]:.2f}s')
