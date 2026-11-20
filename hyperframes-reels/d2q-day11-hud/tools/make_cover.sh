#!/bin/bash
# The cover: the interview-question frame of s2, with the question set large in the subtitle plate (readable in the
# profile grid's 3:4 crop) and all six data chips already docked in the rail. Copies the project to out/cover_proj,
# patches its ov.html and hud.html, snapshots one frame and saves out/cover.jpg.
# usage: bash tools/make_cover.sh [film time, default 7.1]
set -e
HERE=$(cd "$(dirname "$0")/.." && pwd); AT=${1:-7.1}
P=$HERE/out/cover_proj
rm -rf "$P"; mkdir -p "$P"
cp "$HERE"/{index.html,hyperframes.json,meta.json,package.json} "$P"/
cp -r "$HERE/compositions" "$P"/
ln -sfn "$HERE/assets" "$P/assets"
python3 - "$P" <<'EOF'
import re, sys
P = sys.argv[1]
ov = open(f"{P}/compositions/ov.html", encoding="utf-8").read()
a = "const BAND0 = 160, BAND1 = 530, MAXW = 820;"
b = re.search(r"const sizeFor = \(n\) => \([^;]*\);", ov).group(0)
assert a in ov
ov = ov.replace(a, "const BAND0 = 196, BAND1 = 596, MAXW = 900;").replace(b, "const sizeFor = (n) => 76;")
ov = ov.replace('"500 " + fs', '"600 " + fs').replace('"500 " + lay.fs', '"600 " + lay.fs')
open(f"{P}/compositions/ov.html", "w", encoding="utf-8").write(ov)
hud = open(f"{P}/compositions/hud.html", encoding="utf-8").read()
m = re.search(r"const CHIPS = (\[.*?\]\]);", hud)
chips = m.group(1)
times = [float(x) for x in re.findall(r"\[([\d.]+), \"", chips)]
for i, tm in enumerate(times):
    chips = chips.replace(f"[{tm:g}, \"", f"[{1.0 + 0.2 * i:g}, \"", 1) if f"[{tm:g}, \"" in chips else chips.replace(f"[{tm}, \"", f"[{1.0 + 0.2 * i:g}, \"", 1)
hud = hud.replace(m.group(1), chips)
open(f"{P}/compositions/hud.html", "w", encoding="utf-8").write(hud)
print("cover patches: question large, chips", re.findall(r"\[([\d.]+), \"", chips))
EOF
cd "$P" && HYPERFRAMES_NO_TELEMETRY=1 timeout 600 npx --yes hyperframes@0.9.39 snapshot . --at "$AT" --no-end --no-browser-gpu -o "$HERE/out/cover_frame" >/dev/null
python3 -c "
from PIL import Image; import glob
f=sorted(glob.glob('$HERE/out/cover_frame/frame-*.png'))[-1]
Image.open(f).convert('RGB').save('$HERE/out/cover.jpg', quality=92, optimize=True); print('cover from', f)"
