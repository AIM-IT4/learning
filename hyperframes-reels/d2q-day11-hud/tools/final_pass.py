"""Final assembly pass for the light HUD film:
- put the one current engine bundle (work/holohud.js) into every composition, replacing whichever HOLOHUD version a
  scene inlined;
- put the current chart kit (work/qchart.js, the QC bundle) into every scene that uses it (after the engine);
- fill each scene's TEX block with the typeset formulas it names in `const TEX_IDS = [...]` (work/formulas.json),
  and its NUM block with the work/numbers.json sections it names in `const NUM_KEYS = [...]`;
- make sure every composition declares the Fredoka face; report what changed.
usage: python3 tools/formulas.py && node tools/tex2svg.mjs && python3 tools/final_pass.py"""
import glob, json, os, re
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
kit = open(os.path.join(HERE, "work/holohud.js"), encoding="utf-8").read()
qc = open(os.path.join(HERE, "work/qchart.js"), encoding="utf-8").read()
FORM = json.load(open(os.path.join(HERE, "work/formulas.json"), encoding="utf-8"))
NUMS = json.load(open(os.path.join(HERE, "work/numbers.json"), encoding="utf-8"))
FRE = '    @font-face { font-family: "Fredoka"; font-weight: 300 700; src: url("assets/fonts/fredoka-700.woff2"); }\n'
QC_HEAD, QC_TAIL = "// QCHART: the quant chart kit", "// QCHART END\n"


def block(s, head, ret):
    a = s.index(head); r = s.index(ret, a); b = s.index("})();", r) + len("})();")
    if s[b:b + 1] == "\n": b += 1
    return a, b


for f in sorted(glob.glob(os.path.join(HERE, "compositions/*.html"))):
    s = open(f, encoding="utf-8").read()
    name = os.path.basename(f); notes = []
    if "// HOLOHUD: the Sci-fi Hologram HUD engine" in s:
        a, b = block(s, "// HOLOHUD: the Sci-fi Hologram HUD engine", "return { HOLO, HUD, MKM")
        if s[a:b] != kit:
            s = s[:a] + kit + s[b:]; notes.append("engine updated")
    if "QC." in s:
        if QC_HEAD in s:
            a = s.index(QC_HEAD); b = s.index(QC_TAIL, a) + len(QC_TAIL)
            if s[a:b] != qc:
                s = s[:a] + qc + s[b:]; notes.append("chart kit updated")
        else:
            a, b = block(s, "// HOLOHUD: the Sci-fi Hologram HUD engine", "return { HOLO, HUD, MKM")
            s = s[:b] + qc + s[b:]; notes.append("chart kit added")
    m = re.search(r"const TEX_IDS = (\[[^\]]*\]);", s)
    if m:
        ids = json.loads(m.group(1).replace("'", '"'))
        missing = [i for i in ids if i not in FORM]
        assert not missing, (name, missing)
        tex = "/*TEX*/ const TEX = " + json.dumps({i: FORM[i] for i in ids}, ensure_ascii=False) + "; /*ENDTEX*/"
        new, n = re.subn(r"/\*TEX\*/.*?/\*ENDTEX\*/", lambda _: tex, s, flags=re.S)
        assert n == 1, (name, "needs one /*TEX*/ ... /*ENDTEX*/ placeholder")
        if new != s: s = new; notes.append(f"formulas {ids}")
    m = re.search(r"const NUM_KEYS = (\[[^\]]*\]);", s)
    if m:
        keys = json.loads(m.group(1).replace("'", '"'))
        num = "/*NUM*/ const NUM = " + json.dumps({k: NUMS[k] for k in keys}, ensure_ascii=False, separators=(",", ":")) + "; /*ENDNUM*/"
        new, n = re.subn(r"/\*NUM\*/.*?/\*ENDNUM\*/", lambda _: num, s, flags=re.S)
        assert n == 1, (name, "needs one /*NUM*/ ... /*ENDNUM*/ placeholder")
        if new != s: s = new; notes.append(f"numbers {keys}")
    if name not in ("mc.html",) and 'font-family: "Fredoka"; font-weight: 300 700' not in s and "<style>" in s:
        s = s.replace("<style>\n", "<style>\n" + FRE, 1); notes.append("Fredoka face added")
    rest = s.replace(kit, "")
    n_light = rest.count('"lighter"') + rest.count("'lighter'")
    open(f, "w", encoding="utf-8").write(s)
    print(f"{name:10s} {', '.join(notes) or 'ok'}  | 'lighter' left: {n_light}")
