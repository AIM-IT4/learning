"""Exports of the finished film: an HQ copy plus WhatsApp parts (each under 60 s and 16 MB), cut at the split points
assemble.py wrote into timeline.json (each in a pause between two lines).

  python3 export.py <out_dir> <name>        e.g.  python3 export.py final Chuppi_Ka_Gunah
"""
import json, subprocess, sys
from pathlib import Path

out, name = Path(sys.argv[1]), sys.argv[2]
F = out / "film.mp4"
splits = json.load(open(out / "timeline.json"))["splits"]
total = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(F)],
                             capture_output=True, text=True, check=True).stdout)
X264 = ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p"]
def run(args): subprocess.run(["ffmpeg", "-y", "-v", "error", *args], check=True)

run(["-i", str(F), *X264, "-crf", "21", "-c:a", "copy", "-movflags", "+faststart", str(out / f"{name}_HQ.mp4")])
edges = [0.0, *splits, total]
for k, (a, b) in enumerate(zip(edges, edges[1:]), 1):
    d, first, last = b - a, k == 1, k == len(edges) - 1
    vf = ([] if first else ["fade=t=in:st=0:d=0.3"]) + ([] if last else [f"fade=t=out:st={d - 0.5:.3f}:d=0.5"])
    af = ([] if first else ["afade=t=in:st=0:d=0.2"]) + ([] if last else [f"afade=t=out:st={d - 0.6:.3f}:d=0.6"])
    run(["-ss", f"{a:.3f}", "-i", str(F), "-t", f"{d:.3f}", *(["-vf", ",".join(vf)] if vf else []), *(["-af", ",".join(af)] if af else []),
         *X264, "-crf", "22", "-maxrate", "1800k", "-bufsize", "3600k", "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
         "-movflags", "+faststart", str(out / f"{name}_WhatsApp_Part{k}.mp4")])
for f in sorted(out.glob(f"{name}_*.mp4")):
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size", "-of", "csv=p=0", str(f)], capture_output=True, text=True).stdout.strip()
    print(f.name, p)
