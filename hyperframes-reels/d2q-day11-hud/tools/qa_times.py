"""Film times worth checking for every scene, from work/scene_words.md: just after the entrance, on each hero word
and the scene's last word, and just before the exit. Prints a comma list for `hyperframes snapshot --at`.
usage: python3 tools/qa_times.py [s1 s2 ...]"""
import os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(HERE, "tools"))
import timing_hud as T  # noqa: E402

want = set(sys.argv[1:])
rows = open(os.path.join(HERE, "work/scene_words.md"), encoding="utf-8").read().strip().splitlines()
heroes = {}
k = {}
for lid, sc, toks, acc, rose, hero in T.SCRIPT:
    base = k.get(sc, 0)
    if hero: heroes.setdefault(sc, []).append(base + hero["i"])
    k[sc] = base + len(toks)
times = []
for r in rows:
    m = re.match(r"\*\*(s\d+)\*\* \[([\d.]+), ([\d.]+)\] W: (.*)", r)
    s, a, d = m.group(1), float(m.group(2)), float(m.group(3))
    if want and s not in want: continue
    W = [float(x.rsplit("@", 1)[1]) for x in m.group(4).split(" ") if "@" in x]
    pts = [0.5] + [W[i] + 0.35 for i in heroes.get(s, [])] + [d - 0.3]
    times += sorted({round(a + min(max(p, 0.3), d - 0.3), 2) for p in pts})
print(",".join(f"{t:g}" for t in times))
