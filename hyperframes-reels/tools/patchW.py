"""Patch the measured word onsets into a scene: python3 patchW.py <scene.html> <W.json>  (W.json: {"W": [...], "VO_END": s})"""
import json, re, sys
p, w = sys.argv[1], json.load(open(sys.argv[2]))
s = open(p, encoding="utf-8").read()
W = ", ".join(f"{x:.3f}".rstrip("0").rstrip(".") if x else "0.0" for x in w["W"])
s, n1 = re.subn(r"const W = \[[^\]]*\];", f"const W = [{W}];", s, count=1)
s, n2 = re.subn(r"const VO_END = [0-9.]+;", f"const VO_END = {w['VO_END']};", s, count=1)
assert n1 == 1 and n2 == 1
open(p, "w", encoding="utf-8").write(s); print(p, len(w["W"]), "words, VO_END", w["VO_END"])
