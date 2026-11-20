#!/bin/bash
# The cover: the hook frame just before 02 (3.34 s: the interview question, the blurred answer with its lock, "Built one? Let's see",
# the illustrative P&L histogram, the subtitle "Can you show one you've actually built?"), with the chapter title moved
# down inside the profile grid's 3:4 crop (y 240-1680) and the hero and subtitle moved down with it. Copies the project
# to out/cover_proj, patches hud.html (title baseline 260 -> 352), c1.html (the hook +96 px, its floor +96 px) and ov.html (subtitle +100 px),
# snapshots one frame and saves out/cover.jpg (and out/cover_3x4.jpg, the grid's crop, for checking).
# usage: bash tools/make_cover.sh [film time, default 3.34]
set -e
HERE=$(cd "$(dirname "$0")/.." && pwd); AT=${1:-3.34}
P=$HERE/out/cover_proj
rm -rf "$P"; mkdir -p "$P"
cp "$HERE"/{index.html,hyperframes.json,meta.json,package.json} "$P"/
cp -r "$HERE/compositions" "$P"/
ln -sfn "$HERE/assets" "$P/assets"
python3 - "$P" <<'EOF'
import sys
P = sys.argv[1]
def patch(name, a, b):
    p = f"{P}/compositions/{name}.html"; s = open(p, encoding="utf-8").read()
    assert s.count(a) == 1, (name, a); open(p, "w", encoding="utf-8").write(s.replace(a, b))
patch("hud", "const N = CH.length, LY = 180, TY = 142, TB = 260, TFS = 66;", "const N = CH.length, LY = 180, TY = 142, TB = 352, TFS = 66;")
patch("c1", "K.hook(g, T, Object.assign(", "g.translate(0, 96); K.hook(g, T, Object.assign(")
patch("c1", "        K.floor(g);", "        K.floor(g, 1448, 1488);")
patch("ov", "const FS = 56, LH = 76, MAXW = 880, CY = 1454, PX = 13;", "const FS = 56, LH = 76, MAXW = 880, CY = 1554, PX = 13;")
print("cover patches: title baseline 352, hook +96 px (floor at 1448), subtitle centre 1554")
EOF
rm -rf "$HERE/out/cover_frame"
cd "$P" && HYPERFRAMES_NO_TELEMETRY=1 timeout 600 npx --yes hyperframes@0.9.39 snapshot . --at "$AT" --no-end --no-browser-gpu -o "$HERE/out/cover_frame" >/dev/null
python3 -c "
from PIL import Image; import glob
f = sorted(glob.glob('$HERE/out/cover_frame/frame-*.png'))[-1]
im = Image.open(f).convert('RGB'); im.save('$HERE/out/cover.jpg', quality=92, optimize=True)
im.crop((0, 240, 1080, 1680)).save('$HERE/out/cover_3x4.jpg', quality=90, optimize=True)
print('cover from', f, im.size)"
