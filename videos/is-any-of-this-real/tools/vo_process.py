"""Tighten silent gaps in the VO, time-stretch it, and remap word timestamps."""
import json, subprocess, sys, wave
import numpy as np

V = sys.argv[1]
TEMPO = 1.20          # rubberband tempo factor
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

subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{V}/audio/takeB.mp3', '-ar', str(SR), '-ac', '1', f'{V}/audio/b48.wav'], check=True)
x, sr = read_wav(f'{V}/audio/b48.wav')
words = [w for w in json.load(open(f'{V}/audio/wordsB.json'))['words']
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
sil = (db < thr) | ((db < speech - 9) & ~inword)
runs, i = [], 0
while i < fr:
    if sil[i]:
        j = i
        while j < fr and sil[j]: j += 1
        a, b = i / 100, j / 100
        if b - a >= 0.26 and a > 0.05: runs.append((a, b))
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
        newL = 0.2 + 0.38 * (L - 0.2)
    rm = L - newL
    if rm > 0.03:
        c = (a + b) / 2
        cuts.append((c - rm / 2, c + rm / 2))
print(f'{len(runs)} silent runs, removing {sum(b-a for a,b in cuts):.2f}s')

# splice with 12 ms equal-power crossfades
xf = int(0.012 * sr)
out, pos = [], 0
for a, b in cuts:
    ia, ib = int(a * sr), int(b * sr)
    out.append(x[pos:ia]); pos = ib
segs = out + [x[pos:]]
y = segs[0]
fade = np.linspace(0, 1, xf)
for s in segs[1:]:
    if len(y) > xf and len(s) > xf:
        mid = y[-xf:] * np.cos(fade * np.pi / 2) + s[:xf] * np.sin(fade * np.pi / 2)
        y = np.concatenate([y[:-xf], mid, s[xf:]])
    else:
        y = np.concatenate([y, s])

def remap(t):
    """original time -> tightened time (before tempo)."""
    shift = 0.0
    for a, b in cuts:
        if t >= b: shift += (b - a) + xf / sr
        elif t > a: shift += (t - a); break
    return t - shift

write_wav(f'{V}/audio/b_tight.wav', y, sr)
# time-stretch (pitch preserved) + VO polish
af = (f'rubberband=tempo={TEMPO}:pitchq=quality:formant=preserved,'
      'highpass=f=75,lowpass=f=14500,'
      'equalizer=f=180:t=q:w=1.0:g=1.5,equalizer=f=3500:t=q:w=1.2:g=2,'
      'deesser=i=0.35,'
      'acompressor=threshold=-24dB:ratio=2.5:attack=8:release=160:makeup=3')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{V}/audio/b_tight.wav', '-af', af,
                '-ar', str(SR), f'{V}/audio/vo_stretched.wav'], check=True)
z, _ = read_wav(f'{V}/audio/vo_stretched.wav')
z = np.concatenate([np.zeros(int(LEAD * SR)), z])
write_wav(f'{V}/audio/vo_final.wav', z, SR)

nw = [{'w': w['text'], 's': round(LEAD + remap(w['start']) / TEMPO, 3),
       'e': round(LEAD + remap(w['end']) / TEMPO, 3)} for w in words]
json.dump({'words': nw, 'vo_end': round(len(z) / SR, 3)}, open(f'{V}/audio/timeline.json', 'w'), indent=0)
print(f'VO final length {len(z)/SR:.2f}s (incl {LEAD}s lead); last word ends {nw[-1]["e"]:.2f}s')
