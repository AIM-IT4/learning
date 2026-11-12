"""shots.json for the painted 1-minute "Sochenge Tumhe Pyar" music video, made the way the reference reel is made:
one still painting per shot, moved by the camera (push, drift, roll, depth parallax), joined with zoom-blur / whip /
flash / fade transitions on the downbeats, with added effects (petals, dust, bokeh, stars, a cloud forming a heart)
and torn-paper lyric strips placed where the words are sung. MV time 0 = reel 4.50 s = song 51.937 s.
  python3 build_painted.py <paintings_dir> <out.json> [first_n]
"""
import json, sys
D, OUT = sys.argv[1], sys.argv[2]
N = int(sys.argv[3]) if len(sys.argv) > 3 else 99
F = lambda n: f"{D}/final_{n}.png"
T = [0, 3.952, 5.902, 7.783, 11.591, 13.518, 15.399, 19.23, 23.038, 26.87, 30.678, 32.582, 34.486, 36.39, 38.317,
     42.125, 45.933, 47.861, 49.765, 51.692, 53.596, 62.263]
dust = lambda n=24, a=0.8: dict(kind="dust", n=n, alpha=a)
shots = [
    # 1 "सोचेंगे तुम्हें" - Kabir in the grass at sunset; slow push toward his face, the grass parallax
    dict(img=F("hill"), z=[1.04, 1.16], c=[[0.50, 0.52], [0.52, 0.40]], par=[0, 34], d0=0.4, fx=[dust()], out="whipup", out_d=0.34),
    # 2 "प्यार" - pink clouds drift into a heart; push in
    dict(img=F("heart"), z=[1.04, 1.22], c=[[0.50, 0.55], [0.48, 0.45]], par=[-18, 0], d0=0.5, ease="in",
         overlays=[dict(kind="heart", x=900, y=300, size=470, form=1.6)], out="zoom", out_d=0.40),
    # 3 "करें के" - Naina laughing by the swing; the camera swings with her
    dict(img=F("swing"), z=[1.12, 1.22], c=[[0.62, 0.45], [0.70, 0.36]], swing=[1.4, 1.95], par=[24, 0], d0=0.45,
         fx=[dict(kind="petals", n=8, alpha=0.8)], out="whip", out_d=0.30),
    # 4 "नहीं / सोचेंगे" - Naina at her window, dreamy; push toward her face
    dict(img=F("window"), z=[1.05, 1.24], c=[[0.55, 0.48], [0.58, 0.34]], dolly=0.12, d0=0.55,
         fx=[dict(kind="petals", n=6, alpha=0.7, t_off=1.2), dust(14, 0.6)], out="zoom", out_d=0.40),
    # 5 "तुम्हें प्यार" - his face, eyes closed, smiling
    dict(img=F("hillclose"), z=[1.04, 1.14], c=[[0.52, 0.50], [0.56, 0.44]], par=[0, -18], d0=0.5, fx=[dust(18, 0.7)], out="whip", out_d=0.30),
    # 6 "करें के नहीं" - she loves me, she loves me not: the daisies, petals falling
    dict(img=F("daisy"), z=[1.06, 1.20], c=[[0.50, 0.50], [0.56, 0.44]], par=[-20, 0], d0=0.5,
         fx=[dict(kind="petals", n=14)], out="flash", out_d=0.30),
    # 7 "ये दिल बेक़रार" - he can't sleep: moonlit, the camera rolls slowly
    dict(img=F("bed"), z=[1.08, 1.22], c=[[0.62, 0.46], [0.70, 0.36]], rot=[-2.2, 2.2], grade="night", d0=0.5,
         fx=[dust(16, 0.5)], out="fade", out_d=0.45),
    # 8 "करें के नहीं" - into her eye ...
    dict(img=F("eye"), z=[1.04, 2.10], c=[[0.50, 0.52], [0.53, 0.55]], ease="in", d0=0.5, out="zoom", out_d=0.46),
    # 9 "ख़्वाबों में छुपाया तुमको" - ... into his dream: she dances among the stars
    dict(img=F("dream"), z=[1.06, 1.18], c=[[0.56, 0.46], [0.60, 0.38]], rot=[1.8, -1.8], d0=0.45,
         fx=[dict(kind="stars", n=26, area=[60, 40, 1860, 520]), dict(kind="bokeh", n=10, alpha=0.6)], out="fade", out_d=0.40),
    # 10 "यादों में बसाया तुमको" - the box of letters and roses
    dict(img=F("box"), z=[1.05, 1.18], c=[[0.48, 0.52], [0.46, 0.42]], par=[0, 20], d0=0.5, fx=[dust(22, 0.7)], out="whip", out_d=0.30),
    # 11-14 the second pass of the antara, closer: her in the dream, on the swing, the roses, at the window
    dict(img=F("dream2"), z=[1.40, 1.55], c=[[0.45, 0.32], [0.44, 0.26]], rot=[-1.5, 1.0], fx=[dict(kind="stars", n=20, area=[60, 40, 1860, 1000])], out="whip", out_d=0.30),
    dict(img=F("swing"), z=[1.45, 1.58], c=[[0.76, 0.32], [0.78, 0.28]], swing=[1.2, 1.95], fx=[dict(kind="petals", n=6, alpha=0.7)], out="whip", out_d=0.30),
    dict(img=F("box"), z=[1.50, 1.75], c=[[0.47, 0.40], [0.47, 0.36]], fx=[dust(18, 0.7)], out="whip", out_d=0.30),
    dict(img=F("window"), z=[1.60, 1.75], c=[[0.60, 0.30], [0.60, 0.26]], fx=[dust(12, 0.6)], out="zoom", out_d=0.40),
    # 15 "मिलोगे हमें तुम जानम" - she searches the crowded bazaar
    dict(img=F("bazaar"), z=[1.04, 1.18], c=[[0.50, 0.52], [0.54, 0.40]], par=[26, 0], d0=0.4, fx=[dict(kind="bokeh", n=16)], out="whipup", out_d=0.32),
    # 16 "कहीं ना कहीं" - night: he waits on his terrace ...
    dict(img=F("kterrace"), z=[1.12, 1.28], c=[[0.40, 0.45], [0.30, 0.34]], grade="night", d0=0.45,
         fx=[dict(kind="stars", n=18, area=[0, 0, 1920, 360])], out="whip", out_d=0.30),
    # 17 ... the camera whips across the lane: she is on hers
    dict(img=F("nterrace"), z=[1.10, 1.24], c=[[0.44, 0.42], [0.42, 0.30]], grade="night", d0=0.45,
         fx=[dict(kind="stars", n=14, area=[900, 0, 1920, 500])], out="flash", out_d=0.30),
    # 18 "सोचेंगे तुम्हें प्यार" - found: her face lights up
    dict(img=F("found"), z=[1.08, 1.20], c=[[0.60, 0.42], [0.64, 0.36]], d0=0.5, fx=[dict(kind="bokeh", n=14)], out="fade", out_d=0.40),
    # 19 "करें के नहीं" - he sleeps, smiling
    dict(img=F("bedcalm"), z=[1.25, 1.36], c=[[0.42, 0.40], [0.38, 0.34]], rot=[1.5, -1.5], grade="night", fx=[dust(12, 0.5)], out="whipup", out_d=0.32),
    # 20 the clouds have made their heart
    dict(img=F("heart"), z=[1.15, 1.30], c=[[0.48, 0.45], [0.47, 0.40]], overlays=[dict(kind="heart", x=930, y=380, size=520, form=0.01)],
         fx=[dict(kind="petals", n=8, alpha=0.7)], out="zoom", out_d=0.40),
    # 21 "ये दिल बेक़रार करें के नहीं" - together under the flowering tree at sunset; long slow push, end fade
    dict(img=F("sunset"), z=[1.03, 1.20], c=[[0.50, 0.52], [0.45, 0.40]], par=[0, 22], d0=0.45,
         fx=[dict(kind="petals", n=12, alpha=0.85), dict(kind="bokeh", n=10, alpha=0.6)]),
]
for k, sh in enumerate(shots):
    sh["t0"], sh["t1"] = T[k], T[k + 1]
shots = shots[:N]
strips = [
    dict(shot=8, t=23.15, text="ख़्वाबों में छुपाया तुमको", x=560, y=880, rot=3, size=60),
    dict(shot=9, t=26.95, text="यादों में बसाया तुमको", x=1360, y=860, rot=-3, size=60),
    dict(shot=14, t=38.40, text="मिलोगे हमें तुम जानम", x=500, y=230, rot=3, size=60),
    dict(shot=15, t=42.20, text="कहीं ना कहीं…", x=1300, y=820, rot=-2, size=64),
]
cfg = dict(start=0.0, end=shots[-1]["t1"], fade_in=0.14, fade_out=0.8 if N >= len(T) - 1 else None, flow_mark=False,
           shots=shots, strips=[s for s in strips if s["shot"] < len(shots)])
json.dump(cfg, open(OUT, "w"), ensure_ascii=False, indent=1)
print(len(shots), "shots", cfg["start"], "->", cfg["end"])
