"""Write shots.json for "Sochenge Tumhe Pyar" (reel seconds; the reel starts at song 47.437 s).

The music video runs 4.50 -> 27.54 s: twelve shots, one per bar (4 beats at 123 BPM), cut on the downbeat.
  python3 build_shots.py <stills_dir> <out.json> [N]   (N: only the first N shots, for test renders)
"""
import json, sys
D, OUT = sys.argv[1], sys.argv[2]
N = int(sys.argv[3]) if len(sys.argv) > 3 else 99
SONG0 = 47.437
BARS = [52.057, 54.008, 55.889, 57.839, 59.72, 61.624, 63.528, 65.455, 67.336, 69.263, 71.167, 73.071, 74.975]  # downbeats (song s)
cuts = [round(b - SONG0, 3) for b in BARS]
cuts[0] = 4.50                                       # the video fades in just before the first sung word
S = lambda n: f"{D}/scene-{n:02d}.jpeg"
shots = [
    # 1 "सोचेंगे तुम्हें" - Kabir on the hill, daisy in hand; the camera drifts up toward the sky
    dict(img=S(1), z=[1.06, 1.17], c=[[0.43, 0.56], [0.40, 0.44]], par=[0, 46], d0=0.35, fx=[dict(kind="dust", n=26, alpha=0.8)],
         out="whipup", out_d=0.34),
    # 2 "प्यार" - the clouds make a heart; push in and fly through it
    dict(img=S(2), z=[1.04, 1.22], c=[[0.50, 0.52], [0.50, 0.47]], par=[-24, 0], d0=0.5, ease="in", out="zoom", out_d=0.40),
    # 3 "करें के" - Naina laughing on the swing; the camera swings with her
    dict(img=S(3), z=[1.13, 1.19], c=[[0.58, 0.53], [0.61, 0.50]], swing=[1.7, 1.95], par=[30, 0], d0=0.45, out="whip", out_d=0.30),
    # 4 "नहीं" - he plucks a petal: loves me, loves me not
    dict(img=S(4), z=[1.07, 1.22], c=[[0.55, 0.52], [0.63, 0.62]], par=[0, -22], d0=0.5,
         fx=[dict(kind="petals", n=12)], out="fade", out_d=0.42),
    # 5 "सोचेंगे तुम्हें" - now she is the one thinking, at her window
    dict(img=S(5), z=[1.05, 1.24], c=[[0.52, 0.52], [0.52, 0.50]], dolly=0.16, d0=0.55,
         fx=[dict(kind="petals", n=6, alpha=0.7, t_off=1.9)], out="zoom", out_d=0.40),
    # 6 "प्यार करें" - on the phone, twisting the cord
    dict(img=S(6), z=[1.12, 1.16], c=[[0.44, 0.52], [0.56, 0.50]], par=[-30, 0], d0=0.5, ease="linear", out="whip", out_d=0.30),
    # 7 "के नहीं" - the other end of the call: Kabir in the phone booth
    dict(img=S(7), z=[1.06, 1.20], c=[[0.50, 0.52], [0.50, 0.46]], dolly=0.10, d0=0.5, out="flash", out_d=0.30),
    # 8 the line on torn paper over her diary
    dict(img=S(8), z=[1.10, 1.18], c=[[0.50, 0.50], [0.52, 0.50]], rot=[-2.0, 1.5], d0=0.5, out="whipdown", out_d=0.32),
    # 9 "ये दिल बेक़रार" - he cannot sleep
    dict(img=S(9), z=[1.10, 1.26], c=[[0.50, 0.46], [0.50, 0.40]], rot=[-3.0, 3.0], d0=0.5, ease="linear", out="zoom", out_d=0.40),
    # 10 rooftops under the stars
    dict(img=S(10), z=[1.04, 1.13], c=[[0.50, 0.55], [0.50, 0.52]], par=[0, 24], d0=0.4,
         fx=[dict(kind="stars", n=26, area=[60, 40, 1860, 420])], out="fade", out_d=0.40),
    # 11 "करें के" - one petal left
    dict(img=S(11), z=[1.06, 1.20], c=[[0.52, 0.50], [0.46, 0.45]], dolly=0.08, d0=0.5, fx=[dict(kind="dust", n=30)],
         out="fade", out_d=0.36),
    # 12 "नहीं" - her eyes smile behind the dupatta
    dict(img=S(12), z=[1.05, 1.18], c=[[0.50, 0.48], [0.52, 0.42]], d0=0.5, fx=[dict(kind="dust", n=34)]),
]
for k, sh in enumerate(shots):
    sh["t0"], sh["t1"] = cuts[k], cuts[k + 1]
shots = shots[:N]
strips = [
    dict(shot=7, t=cuts[7] + 0.12, text="सोचेंगे तुम्हें", x=610, y=320, rot=4, size=60),
    dict(shot=7, t=cuts[7] + 0.60, text="प्यार करें", x=1260, y=530, rot=-3, size=60),
    dict(shot=7, t=cuts[7] + 1.08, text="के नहीं…", x=740, y=745, rot=2, size=60),
]
cfg = dict(start=cuts[0], end=shots[-1]["t1"], fade_in=0.14, fade_out=0.5 if N >= len(cuts) - 1 else None,
           shots=shots, strips=[s for s in strips if s["shot"] < len(shots)])
json.dump(cfg, open(OUT, "w"), ensure_ascii=False, indent=1)
print(len(shots), "shots", cfg["start"], "->", cfg["end"])
