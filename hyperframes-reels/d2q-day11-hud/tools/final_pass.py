"""Final assembly pass for the light HUD film: put the one current engine bundle (work/holohud.js) into every
composition (replacing whichever HOLOHUD version a scene inlined), make sure every composition declares the Fredoka
face, and report what changed. usage: python3 tools/final_pass.py"""
import glob, os, re
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
kit = open(os.path.join(HERE, "work/holohud.js"), encoding="utf-8").read()
FRE = '    @font-face { font-family: "Fredoka"; font-weight: 300 700; src: url("assets/fonts/fredoka-700.woff2"); }\n'
for f in sorted(glob.glob(os.path.join(HERE, "compositions/*.html"))):
    s = open(f, encoding="utf-8").read()
    name = os.path.basename(f); notes = []
    if "// HOLOHUD: the Sci-fi Hologram HUD engine" in s:
        a = s.index("// HOLOHUD: the Sci-fi Hologram HUD engine")
        r = s.index("return { HOLO, HUD, MKM", a)
        b = s.index("})();", r) + len("})();")
        if s[b:b + 1] == "\n": b += 1
        if s[a:b] != kit:
            s = s[:a] + kit + s[b:]; notes.append("engine updated")
    if name not in ("mc.html",) and 'font-family: "Fredoka"; font-weight: 300 700' not in s and "<style>" in s:
        s = s.replace("<style>\n", "<style>\n" + FRE, 1); notes.append("Fredoka face added")
    rest = s.replace(kit, "")
    n_light = rest.count('"lighter"') + rest.count("'lighter'")
    open(f, "w", encoding="utf-8").write(s)
    print(f"{name:10s} {', '.join(notes) or 'ok'}  | 'lighter' left: {n_light}")
