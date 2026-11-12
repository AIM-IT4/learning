"""Join cut voice takes with exact offsets, then two-pass loudnorm (-16 LUFS, -1.5 dBTP, 48 kHz mono).
usage: python3 join_vo.py out.wav spec.json
spec.json: {"parts": [["file.wav", cut_start_s, cut_end_s_or_null], ...], "gaps": [s, ...]}
Each part's silent head/tail is trimmed (10 ms RMS frames above -42 dBFS, 30 ms / 120 ms margins).
Prints, for each part, the offset to add to a time measured in that take to get the time in out.wav."""
import json, subprocess, sys
import librosa, numpy as np, soundfile as sf

out, spec = sys.argv[1], json.load(open(sys.argv[2], encoding="utf-8"))
SR = 48000
chunks, offsets, pos = [], [], 0
for n, (f, a, b) in enumerate(spec["parts"]):
    y, _ = librosa.load(f, sr=SR, mono=True)
    y = y[int(a * SR): int(b * SR) if b else None]
    fr = SR // 100
    db = np.array([20 * np.log10(np.sqrt(np.mean(y[i:i + fr] ** 2)) + 1e-9) for i in range(0, len(y) - fr, fr)])
    loud = np.where(db > -42)[0]
    h = max(0, loud[0] * fr - int(0.03 * SR)); t = min(len(y), (loud[-1] + 1) * fr + int(0.12 * SR))
    y = y[h:t]
    if h > 0: y[: int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))       # no click at a cut
    y[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    offsets.append(round(pos / SR - a - h / SR, 3))
    chunks.append(y); pos += len(y)
    if n < len(spec["gaps"]):
        g = np.zeros(int(spec["gaps"][n] * SR), dtype=np.float32); chunks.append(g); pos += len(g)
raw = out.rsplit(".", 1)[0] + ".raw.wav"
sf.write(raw, np.concatenate(chunks), SR)
p = subprocess.run(["ffmpeg", "-hide_banner", "-i", raw, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                   capture_output=True, text=True)
m = json.loads(p.stderr[p.stderr.rindex("{"):])
ln = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
      f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af", ln + ",aresample=48000", "-ar", "48000", "-ac", "1", out], check=True)
print(json.dumps({"out": out, "seconds": round(pos / SR, 3), "offsets": offsets, "input_lufs": m["input_i"]}))
