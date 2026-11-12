"""Join voice takes into one voiceover: trim each take's silent head and tail, put a gap between them,
then two-pass loudnorm to -16 LUFS / -1.5 dBTP at 48 kHz mono.
usage: python3 build_vo.py out.wav gap_s take1.wav take2.wav [...]"""
import json, subprocess, sys

out, gap, takes = sys.argv[1], float(sys.argv[2]), sys.argv[3:]
TRIM = ("silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.03,"
        "areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.08,areverse,"
        "aresample=48000,aformat=channel_layouts=mono")
parts, labels = [], []
for i, _ in enumerate(takes):
    parts.append(f"[{i}:a]{TRIM}[t{i}]")
    labels.append(f"[t{i}]")
    if i < len(takes) - 1:
        parts.append(f"aevalsrc=0:d={gap}:s=48000:c=mono[g{i}]")
        labels.append(f"[g{i}]")
chain = ";".join(parts) + ";" + "".join(labels) + f"concat=n={len(labels)}:v=0:a=1[cat]"
inputs = sum((["-i", t] for t in takes), [])
tmp = out.rsplit(".", 1)[0] + ".raw.wav"
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", chain, "-map", "[cat]", tmp], check=True)

p = subprocess.run(["ffmpeg", "-hide_banner", "-i", tmp, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                   capture_output=True, text=True)
m = json.loads(p.stderr[p.stderr.rindex("{"):])
ln = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
      f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", ln + ",aresample=48000", "-ar", "48000", "-ac", "1", out], check=True)
d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], capture_output=True, text=True).stdout.strip()
print(out, d, "s; input", m["input_i"], "LUFS")
