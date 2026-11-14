"""Write a round-7 reel's root index.html, every sound on its measured cue: python3 tools/mkroot_d2q.py hedge|pnl  (from hyperframes-reels/)"""
import json, os, re, subprocess, sys

proj = sys.argv[1]
s = open(f"{proj}/compositions/{proj}.html", encoding="utf-8").read()
LS = json.loads(re.search(r"const LS = (\{.*?\});", s).group(1))
W = [float(x) for x in re.search(r"const W = \[(.*?)\];", s).group(1).split(",")]
VO_END = float(re.search(r"const VO_END = ([0-9.]+);", s).group(1))
V = 0.4
T = lambda line, k: round(W[LS[line] + k] + V, 2)
END = round(VO_END + V + 3.2, 2)
if proj == "hedge":
    sfx = [["x-in", "whoosh-short", 0.0, 0.6, 0.16], ["x-rally", "whoosh-short", T("a01", 9) + 0.05, 0.6, 0.12],
           ["x-hl", "pop", T("a02", 10) + 0.25, 0.5, 0.18], ["x-s2", "click-soft", T("a03", 0) - 0.2, 0.3, 0.22],
           ["x-tan", "click-soft", T("a03", 3), 0.3, 0.18], ["x-move", "pop", T("a03", 10) + 0.1, 0.5, 0.14],
           ["x-s3", "click-soft", T("a04", 0) - 0.2, 0.3, 0.22], ["x-tok1", "pop", T("a04", 8), 0.5, 0.16], ["x-tok2", "pop", T("a04", 13), 0.5, 0.16],
           ["x-s4", "click-soft", T("a05", 0) - 0.2, 0.3, 0.22], ["x-tick", "key-press", T("a05", 4), 0.4, 0.24], ["x-net", "ping", T("a05", 18) + 0.15, 1.0, 0.14],
           ["x-s5", "whoosh-short", T("a06", 0) - 0.25, 0.6, 0.14],
           ["x-r1", "key-press", T("a06", 14), 0.4, 0.26], ["x-r2", "key-press", T("a06", 15), 0.4, 0.26], ["x-r3", "key-press", T("a06", 17), 0.4, 0.26],
           ["x-s6", "whoosh-short", T("a07", 0) - 0.25, 0.6, 0.14], ["x-200", "ping", T("a08", 11) + 0.6, 1.0, 0.18],
           ["x-s7", "click-soft", T("a09", 0) - 0.2, 0.3, 0.22]] + \
          [[f"x-bar{j}", "pop", round(T("a09", 4) + j * 0.32, 2), 0.5, 0.11] for j in range(4)] + \
          [["x-s8", "click-soft", T("a10", 0) - 0.2, 0.3, 0.22], ["x-bal", "chime", T("a10", 8) + 0.15, 1.5, 0.13],
           ["x-cta", "whoosh-short", T("a11", 0) - 0.25, 0.6, 0.16], ["x-url", "pop", T("a11", 0) + 0.45, 0.5, 0.14],
           ["x-cmt", "pop", T("a11", 0) + 0.6, 0.5, 0.15], ["x-type", "typing", T("a12", 4) - 0.56, 1.1, 0.12],
           ["x-send", "whoosh-short", T("a12", 11) + 0.35, 0.6, 0.14], ["x-end", "sparkle", round(VO_END + V + 0.3, 2), 1.5, 0.16]]
    bg = "#f7f8f3"
else:
    sfx = [["p-on", "click-soft", 0.0, 0.3, 0.2], ["p-msg", "notification", T("b01", 6) - 0.2, 1.0, 0.28], ["p-why", "pop", T("b02", 9) + 0.35, 0.5, 0.18],
           ["p-wf", "whoosh-short", T("b03", 0) - 0.3, 0.6, 0.14],
           ["p-t1", "key-press", T("b04", 4), 0.4, 0.16], ["p-b1", "pop", T("b04", 13), 0.5, 0.15],
           ["p-b2", "pop", T("b05", 8), 0.5, 0.15], ["p-t2", "key-press", T("b06", 0), 0.4, 0.16], ["p-b3", "pop", T("b06", 6), 0.5, 0.15],
           ["p-t3", "key-press", T("b07", 1), 0.4, 0.16], ["p-b4", "click-soft", T("b07", 12), 0.3, 0.24],
           ["p-sum", "ping", T("b08", 0) + 0.2, 1.0, 0.16], ["p-gap", "click", T("b09", 2), 0.36, 0.2]] + \
          [[f"p-q{j}", "pop", round(T("b10", k) + 0.1, 2), 0.5, 0.14] for j, k in enumerate((1, 4, 7))] + \
          [["p-ban", "whoosh-short", T("b11", 2) - 0.1, 0.6, 0.14], ["p-cta", "whoosh-short", T("b12", 0) - 0.3, 0.6, 0.15],
           ["p-cover", "pop", T("b12", 0) + 0.1, 0.5, 0.14], ["p-url", "pop", T("b12", 0) + 0.5, 0.5, 0.12], ["p-cmt", "pop", T("b12", 0) + 0.7, 0.5, 0.15], ["p-type", "typing", T("b13", 4) - 0.56, 1.1, 0.12],
           ["p-send", "whoosh-short", T("b13", 11) + 0.35, 0.6, 0.14], ["p-end", "chime", round(VO_END + V + 0.3, 2), 1.5, 0.16]]
    bg = "#eef3f8"
subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "mkindex.py"), proj, str(END), bg, json.dumps(sfx), str(V)], check=True)
h = open(f"{proj}/index.html", encoding="utf-8").read().replace('lang="hi"', 'lang="en"')
open(f"{proj}/index.html", "w", encoding="utf-8").write(h)
print(json.dumps({"END": END, "cta": T("a11" if proj == "hedge" else "b12", 0), "ask": T("a12" if proj == "hedge" else "b13", 0)}))
