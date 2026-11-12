"""Listen to a song for the reel: tempo, beats, downbeats, loudness per bar, and the sung words with their times.

  python3 analyse_song.py <song file> <work_dir> [--lang hi] [--from S] [--to S]

Writes <work_dir>/song.wav (the whole song, 44.1 kHz stereo, what assemble_reel.sh takes), <work_dir>/vocals.wav (the
voice of the analysed window, separated with demucs htdemucs), <work_dir>/song.json, and prints a bar-by-bar summary
to choose the reel's section from. The words come from faster-whisper large-v3-turbo run on the voice alone (on the
full mix it misses lines and invents YouTube outros); expect spelling slips - fix the text with the real lyrics and
keep the times. --from/--to limit the slow parts (voice separation and transcription) to a window, default the first
4 minutes. --lang: hi, en, pa, ur, ta, te, bn, ... (default: detected).
"""
import argparse, json, subprocess, shutil
from pathlib import Path
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("song"); ap.add_argument("work")
ap.add_argument("--lang", default=None); ap.add_argument("--from", dest="t0", type=float, default=0.0)
ap.add_argument("--to", dest="t1", type=float, default=None)
a = ap.parse_args()
W = Path(a.work); W.mkdir(parents=True, exist_ok=True)
wav = W / "song.wav"
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", a.song, "-vn", "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le", str(wav)], check=True)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(wav)],
                           capture_output=True, text=True).stdout)
t0, t1 = a.t0, min(dur, a.t1 if a.t1 else a.t0 + 240.0)
print(f"song {dur:.1f} s; analysing the voice in {t0:.1f}-{t1:.1f} s", flush=True)

# ---------------------------------------------------------------- beats and downbeats (whole song)
import librosa
y, sr = librosa.load(str(wav), sr=22050, mono=True)
hop = 512
onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
tempo, bf = librosa.beat.beat_track(onset_envelope=onset, sr=sr, hop_length=hop, units="frames")
tempo = float(np.atleast_1d(tempo)[0]); beats = librosa.frames_to_time(bf, sr=sr, hop_length=hop)
mel = librosa.feature.melspectrogram(y=y, sr=sr, hop_length=hop, n_mels=64, fmax=8000)
low = librosa.onset.onset_strength(S=librosa.power_to_db(mel[:5]), sr=sr, hop_length=hop)   # kick / bass band
def at(env, frames): return env[np.clip(frames, 0, len(env) - 1)]
score = [at(low, bf[k::4]).mean() + 0.5 * at(onset, bf[k::4]).mean() for k in range(4)]
phase = int(np.argmax(score)); downbeats = beats[phase::4]
bar = float(np.median(np.diff(downbeats))) if len(downbeats) > 2 else 240 / max(tempo, 1)
rms = librosa.feature.rms(y=y, hop_length=hop)[0]; rt = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
def mean_between(sig, ts, a_, b_):
    m = (ts >= a_) & (ts < b_); return float(sig[m].mean()) if m.any() else 0.0
print(f"tempo {tempo:.2f} BPM, bar {bar:.3f} s, downbeat phase {phase}", flush=True)

# ---------------------------------------------------------------- the voice alone (demucs), then the words
cut, mark = W / "window.wav", W / "vocals.window"
key = f"{Path(a.song).resolve()} {t0} {t1}"
if not ((W / "vocals.wav").exists() and mark.exists() and mark.read_text() == key):    # separation is the slow part: reuse it
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t0}", "-t", f"{t1 - t0}", "-i", str(wav), "-c:a", "pcm_s16le", str(cut)], check=True)
    subprocess.run(["python3", "-m", "demucs", "--two-stems=vocals", "-n", "htdemucs", "-o", str(W / "sep"), str(cut)], check=True,
                   stdout=subprocess.DEVNULL)
    shutil.copy(W / "sep" / "htdemucs" / "window" / "vocals.wav", W / "vocals.wav"); mark.write_text(key)
    shutil.rmtree(W / "sep", ignore_errors=True); cut.unlink(missing_ok=True)
print("voice separated", flush=True)
yv, _ = librosa.load(str(W / "vocals.wav"), sr=22050, mono=True)
vr = librosa.feature.rms(y=yv, hop_length=hop)[0]; vt = librosa.frames_to_time(np.arange(len(vr)), sr=sr, hop_length=hop) + t0

from faster_whisper import WhisperModel
model = WhisperModel("mobiuslabsgmbh/faster-whisper-large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=4)
y16, _ = librosa.load(str(W / "vocals.wav"), sr=16000, mono=True)          # an array: newer PyAV breaks file decoding
y16 = y16.astype(np.float32)
LANG = [a.lang]
def transcribe(g0, g1):
    """Sung lines in song seconds g0..g1 (of the voice track): [{text, start, end, words: [[w, start, end, p]]}]."""
    seg = y16[max(0, int((g0 - t0) * 16000)): int((g1 - t0) * 16000)]
    if len(seg) < 8000: return []
    segs, info = model.transcribe(seg, language=LANG[0], word_timestamps=True, condition_on_previous_text=False, beam_size=5, vad_filter=False)
    if LANG[0] is None: LANG[0] = info.language; print(f"language {info.language} ({info.language_probability:.2f})", flush=True)
    out = []
    for s in segs:
        ws = [[w.word.strip(), round(w.start + g0, 2), round(w.end + g0, 2), round(w.probability, 2)] for w in (s.words or []) if w.word.strip()]
        if ws: out.append(dict(text=s.text.strip(), start=ws[0][1], end=ws[-1][2], words=ws))
    return out

lines = transcribe(t0, t1)
# Whisper drops a line that repeats the one before it (it stretches the last word over it instead), so: cut stretched
# words short, find bars where the voice sings but no word was heard, and listen to those again on their own.
vmax = max(1e-6, float(np.percentile(vr, 95)))
for rnd in range(3):
    for ln in lines:
        for w in ln["words"]:
            if w[2] - w[1] > max(2.5, 1.3 * bar): w[2] = round(w[1] + min(1.2, 0.6 * bar), 2)
        ln["end"] = ln["words"][-1][2]
    spans = [(w[1], w[2]) for ln in lines for w in ln["words"]]
    gaps = []
    for i in range(len(downbeats) - 1):
        b0, b1 = float(downbeats[i]), float(downbeats[i + 1])
        if b1 <= t0 or b0 >= t1: continue
        sung = mean_between(vr, vt, b0, b1) / vmax >= 0.35
        heard = any(s_ < b1 and e_ > b0 for s_, e_ in spans)
        if sung and not heard:
            if gaps and abs(gaps[-1][1] - b0) < 1e-3: gaps[-1][1] = b1
            else: gaps.append([b0, b1])
    new = [l for g0, g1 in gaps for l in transcribe(max(t0, g0 - 0.3), min(t1, g1 + 0.3))]
    new = [l for l in new if not any(abs(l["start"] - o["start"]) < 0.4 for o in lines)]
    if not new: break
    print(f"pass {rnd + 2}: {len(new)} more lines from {len(gaps)} gaps", flush=True)
    lines = sorted(lines + new, key=lambda l: l["start"])
print(f"{len(lines)} sung lines", flush=True)
info = type("I", (), {"language": LANG[0]})

# ---------------------------------------------------------------- per bar, and the summary
emax = max(1e-6, float(np.percentile(rms, 95)))
bars = []
for i in range(len(downbeats) - 1):
    b0, b1 = float(downbeats[i]), float(downbeats[i + 1])
    words = [w[0] for ln in lines for w in ln["words"] if b0 <= w[1] < b1]
    bars.append(dict(i=i, t=round(b0, 3), energy=round(mean_between(rms, rt, b0, b1) / emax, 2),
                     voice=round(mean_between(vr, vt, b0, b1) / vmax, 2) if t0 <= b0 < t1 else None, words=" ".join(words)))
out = dict(file=str(Path(a.song).resolve()), duration=round(dur, 3), bpm=round(tempo, 2), bar=round(bar, 3), window=[t0, t1],
           language=info.language, beats=[round(float(b), 3) for b in beats], downbeats=[round(float(b), 3) for b in downbeats],
           bars=bars, lines=lines)
json.dump(out, open(W / "song.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print(f"\n{'bar':>4} {'time':>7}  {'loud':<10} {'voice':<10} words")
for b in bars:
    if b["t"] < t0 - 2 * bar or b["t"] > t1 + 2 * bar: continue
    e = "#" * int(round(b["energy"] * 10)); v = "-" if b["voice"] is None else "~" * int(round(b["voice"] * 10))
    print(f"{b['i']:>4} {b['t']:7.2f}  {e:<10} {v:<10} {b['words']}")
print("\nlines:")
for ln in lines: print(f"  {ln['start']:7.2f}-{ln['end']:7.2f}  {ln['text']}")
print(f"\nwrote {W / 'song.json'}; a 1-minute reel is about {round(60 / bar)} bars.")
