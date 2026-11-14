"""Write caption groups and voice cues into an English scene.
usage: python3 en_caps.py scene.html lines.json caps.json [timing.json]

lines.json  [["a01", "spoken text"], ...]  (only lines named in caps.json are used, in that order)
caps.json   {"a01": "caption text | next group [spoken words=shown as]", ...}: "|" splits caption groups,
            [x y=z] shows spoken words x y as z (one highlight span); every other word is shown as spoken.
timing.json {"W": [onset of every spoken word, s], "VO_END": s}; without it, a provisional 2.6 words/s with 0.3 s gaps.

Rewrites the region between <!--CAPS--> and <!--/CAPS--> (one div.cap per group, one span per shown word, data-w =
index of its first spoken word) and between /*CUES*/ and /*END CUES*/ (LS: first word index of each line, W, VO_END)."""
import json, re, sys

scene, lines, caps = sys.argv[1], json.load(open(sys.argv[2], encoding="utf-8")), json.load(open(sys.argv[3], encoding="utf-8"))
timing = json.load(open(sys.argv[4], encoding="utf-8")) if len(sys.argv) > 4 else None
spoken = {n: t.split() for n, t in lines}
LS, html, gi, idx = {}, [], 0, 0
for name, cap in caps.items():
    LS[name] = idx
    words = spoken[name]
    for group in [g.strip() for g in cap.split("|")]:
        gi += 1; spans = []
        for m in re.finditer(r"\[([^\]=]+)=([^\]]+)\]|(\S+)", group):
            said = m.group(1).split() if m.group(1) else [m.group(3)]
            shown = m.group(2) if m.group(1) else m.group(3)
            if words[idx - LS[name]: idx - LS[name] + len(said)] != said:
                sys.exit(f"{name}: caption says {said}, script has {words[idx - LS[name]: idx - LS[name] + len(said)]}")
            spans.append(f'<span data-w="{idx}">{shown.replace("&", "&amp;")}</span>'); idx += len(said)
        html.append(f'    <div id="cap-{gi}" class="cap">{"".join(spans)}</div>')
    if idx - LS[name] != len(words):
        sys.exit(f"{name}: captions cover {idx - LS[name]} of {len(words)} words")
if timing is None:
    W, t = [], 0.0
    for name in caps:
        for w in spoken[name]:
            W.append(round(t, 2)); t += 0.15 + 0.045 * len(w)
        t += 0.3
    timing = {"W": W, "VO_END": round(t - 0.3, 2)}
assert len(timing["W"]) == idx, (len(timing["W"]), idx)
cues = (f"const LS = {json.dumps(LS)};\n      const W = [{', '.join(f'{x:.2f}' for x in timing['W'])}];\n"
        f"      const VO_END = {timing['VO_END']};")
s = open(scene, encoding="utf-8").read()
s, n1 = re.subn(r"<!--CAPS-->.*?<!--/CAPS-->", lambda _: "<!--CAPS-->\n" + "\n".join(html) + "\n    <!--/CAPS-->", s, flags=re.S)
s, n2 = re.subn(r"/\*CUES\*/.*?/\*END CUES\*/", lambda _: "/*CUES*/\n      " + cues + "\n      /*END CUES*/", s, flags=re.S)
assert n1 == 1 and n2 == 1, (n1, n2)
open(scene, "w", encoding="utf-8").write(s)
print(json.dumps({"groups": gi, "words": idx, "VO_END": timing["VO_END"], "LS": LS}))
