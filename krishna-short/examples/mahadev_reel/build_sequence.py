#!/usr/bin/env python3
"""Order the Mahadev images to follow the song: one picture per shot, matched to the lyric being
rapped at that moment. Uses the same beat analysis and shot plan as make_reel.py, so the k-th image
lands on the k-th shot.   usage: build_sequence.py <song.mp3> <refined_dir> <out_dir>"""
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import numpy as np
import make_reel as r

TOTAL, DROP, OUTRO, INTRO_EVERY = 178.9, 28.36, 3.99, 8
SECTIONS = [(28.36, 4), (74.08, 2), (95.6, 4), (124.98, 2), (142.57, 2), (168.5, 1)]
EXTRA_DROPS = [142.57]

INTRO = ["m20", "m03", "m07", "m01", "m04", "m08", "m06"]
VERSE1 = ["v02", "m05",  "m18", "m11",  "v03", "m14",  "m09", "v04",  "v05", "m13",   # 2 per rap line
          "v10", "m16",  "v06", "m19",  "m17", "v11",  "v07", "m11",  "m18", "m14", "m12"]
VERSE2 = ["v08", "m07", "m16", "v09", "m06", "m03", "v10", "v07", "m14", "v11", "v12", "m20", "m18", "m12"]
CHORUS = ["m11", "m18", "m09", "m14", "m16", "m17", "m13", "m05", "m20", "v04", "v05", "v03"]
FINAL = ["m18", "v04", "m14", "v06", "m11", "v03", "m13", "m09", "v07", "m17", "m16", "v02",
         "m05", "m19", "v05", "v01", "v10", "m12"]
TANDAV = [(79.3, 83.5), (130.5, 134.6)]          # "जब तांडव शुरू हो" -> Nataraja


def main():
    song, src, out = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
    x = r.load_mono(song)[: int(TOTAL * 22050)]
    _, beats = r.detect_beats(x)
    drop_i = int(np.argmin(np.abs(beats - DROP)))
    shots = r.plan(beats, drop_i, TOTAL, INTRO_EVERY, [2], OUTRO, SECTIONS, EXTRA_DROPS)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    counters = {"intro": 0, "v1": 0, "c": 0, "v2": 0, "f": 0}
    seq = []
    for s in shots:
        t, kind = s["start"], s["kind"]
        if kind in ("drop", "outro"):
            continue
        if any(a <= t < b for a, b in TANDAV):
            name = "m12"
        elif t < DROP - 0.1:
            name, counters["intro"] = INTRO[counters["intro"] % len(INTRO)], counters["intro"] + 1
        elif t < 74.0:
            name, counters["v1"] = VERSE1[counters["v1"] % len(VERSE1)], counters["v1"] + 1
        elif 95.5 <= t < 124.9:
            name, counters["v2"] = VERSE2[counters["v2"] % len(VERSE2)], counters["v2"] + 1
        elif t < 142.5:
            name, counters["c"] = CHORUS[counters["c"] % len(CHORUS)], counters["c"] + 1
        else:
            name, counters["f"] = FINAL[counters["f"] % len(FINAL)], counters["f"] + 1
        seq.append((t, name))
    for k, (t, name) in enumerate(seq):
        shutil.copy(src / f"{name}.png", out / f"s{k:03d}.png")
    shutil.copy(src / "v01.png", out / "drop.png")      # first drop: the shankh blast
    shutil.copy(src / "drop.png", out / "drop2.png")    # Tandav drop: Nataraja in fire
    shutil.copy(src / "outro.png", out / "outro.png")
    print(f"{len(shots)} shots, {len(seq)} sequenced images + drop, drop2, outro")
    for t, n in seq[:8] + [("...", "")] + seq[-4:]:
        print(f"  {t if isinstance(t, str) else f'{t:6.2f}s'} {n}")


if __name__ == "__main__":
    main()
