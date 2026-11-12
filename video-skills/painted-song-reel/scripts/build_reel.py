"""reel.json (+ song.json) -> shots json for render_mv.py.

  python3 build_reel.py <reel.json> <song.json> <paintings_dir> <out.json> [first_n]

Timing: MV time 0 = song second song.mv0 (a downbeat just before the first sung word); the reel itself starts 4.5 s
earlier (intro 3.4 + black 0.1 + rotate card 1.0), at song0 = mv0 - 4.5, which is what assemble_reel.sh is given.

reel.json keys used here (the painting keys - style, negative, cast, face, shots - are paint_pro.py's):
  "song":  {"mv0": 51.937, "end": 114.2}            song seconds: where the MV starts and where it ends
  "cut":   [{"img": "hill", "bars": 2, "z": [1.04, 1.18], "c": [[0.5, 0.52], [0.45, 0.4]], "par": [0, 34],
             "fx": [{"kind": "petals", "n": 12}], "out": "whipup", "out_d": 0.34, ...}, ...]
           one entry per shot, in order. "img" is the painting (paintings_dir/final_<img>.png). The shot lasts "bars"
           bars, cut on the measured downbeats of song.json; or give "t1" (MV seconds) instead. The last shot runs to
           song.end. Every other key goes to render_mv.py as is: z, c, rot, par, dolly, d0, swing, ease, grade, fx,
           overlays, out, out_d.
  "lines": [{"words": [["सोचेंगे", 52.0], ["तुम्हें", 53.4], ...], "end": 59.2}, ...]
           every sung line in the MV, each word with its onset (song seconds); shown as karaoke strips
  "captions": {"y": 955, "size": 62, "font": "/path/font.ttf", "lang": "hi"}     optional
  "grade": "warm"                                   optional, a colour grade for every shot that has none
"""
import json, sys
from pathlib import Path

reel = json.load(open(sys.argv[1], encoding="utf-8"))
song = json.load(open(sys.argv[2], encoding="utf-8")) if sys.argv[2] != "-" else {}
D, OUT = Path(sys.argv[3]).resolve(), sys.argv[4]
N = int(sys.argv[5]) if len(sys.argv) > 5 else 10 ** 6
S = reel["song"]; MV0, END = float(S["mv0"]), float(S["end"])

db = [float(x) for x in song.get("downbeats", [])]
i = min(range(len(db)), key=lambda j: abs(db[j] - MV0)) if db else 0
shots, t = [], 0.0
for k, c in enumerate(reel["cut"]):
    sh = {key: v for key, v in c.items() if key not in ("img", "bars", "t1", "note")}
    sh["img"] = str(D / f"final_{c['img']}.png")
    sh["t0"] = round(t, 3)
    if k == len(reel["cut"]) - 1:
        t1 = END - MV0
    elif "t1" in c:
        t1 = float(c["t1"])
    else:
        if not db: sys.exit("cut entries without t1 need song.json downbeats")
        i += int(c.get("bars", 1))
        if i >= len(db): sys.exit(f"shot {k} runs past the last downbeat")
        t1 = db[i] - MV0
    sh["t1"] = round(t1, 3); t = t1
    sh.setdefault("z", [1.04, 1.16]); sh.setdefault("c", [[0.5, 0.5], [0.5, 0.42]])
    shots.append(sh)
shots = shots[:N]

cap = reel.get("captions", {})
lines = reel.get("lines", [])
captions = []
for j, ln in enumerate(lines):
    t0 = ln["words"][0][1] - MV0
    nxt = lines[j + 1]["words"][0][1] - MV0 if j + 1 < len(lines) else 1e9
    end = ln.get("end", ln["words"][-1][1] + 1.2) - MV0
    captions.append(dict(t0=round(t0, 3), t1=round(min(end, nxt - 0.35), 3),
                         words=[[w, round(ts - MV0, 3)] for w, ts in ln["words"]],
                         x=960 + (24 if j % 2 else -24), y=cap.get("y", 955), rot=(1.4 if j % 2 else -1.6), size=cap.get("size", 62)))
cfg = dict(start=0.0, end=shots[-1]["t1"], fade_in=0.14, fade_out=0.8 if N >= len(reel["cut"]) else None, flow_mark=False,
           shots=shots, strips=[], captions=[c for c in captions if c["t0"] < shots[-1]["t1"]])
if cap.get("font"): cfg["caption_font"] = cap["font"]
if cap.get("lang"): cfg["caption_lang"] = cap["lang"]
if reel.get("grade"): cfg["grade"] = reel["grade"]
missing = sorted({s["img"] for s in shots if not Path(s["img"]).exists()})
if missing: print("WARNING, paintings not found:", *missing, sep="\n  ")
json.dump(cfg, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{len(shots)} shots, MV 0 -> {cfg['end']:.3f} s (song {MV0:.3f} -> {MV0 + cfg['end']:.3f}), {len(cfg['captions'])} lyric lines;",
      f"reel starts at song {MV0 - 4.5:.3f} s")
for s in shots: print(f"  {s['t0']:7.3f} - {s['t1']:7.3f}  {Path(s['img']).stem[6:]}")
