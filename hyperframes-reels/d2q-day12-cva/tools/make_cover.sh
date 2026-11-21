#!/bin/bash
# The cover: the hook frame just after the 16 lines brighten and before the series card (film 11.2 s in the tightened
# take: "sixteen" at 10.32, the series card at 11.88): the title "CVA in 16 lines", the finished result ($64,563, "CVA of
# a 5-year swap", the simulated EE hump, "↓ in 16 lines of Python") in the chart card, and the whole 16-line file
# brightened in the code card with the "16 lines" badge and the console's cva() result. Everything important sits inside the profile grid's 3:4 crop
# (y 240-1680), so the frame is used as it is. Saves out/cover.jpg and out/cover_3x4.jpg (the crop).
# usage: bash tools/make_cover.sh [film time, default 11.2]   (adapted from d2q-mr-promo/tools/make_cover.sh)
set -e
HERE=$(cd "$(dirname "$0")/.." && pwd); AT=${1:-11.2}
rm -rf "$HERE/out/cover_frame"
cd "$HERE" && HYPERFRAMES_NO_TELEMETRY=1 timeout 600 npx --yes hyperframes@0.9.39 snapshot . --at "$AT" --no-end --no-browser-gpu -o "$HERE/out/cover_frame" >/dev/null
python3 -c "
from PIL import Image; import glob
f = sorted(glob.glob('$HERE/out/cover_frame/frame-*.png'))[-1]
im = Image.open(f).convert('RGB'); im.save('$HERE/out/cover.jpg', quality=92, optimize=True)
im.crop((0, 240, 1080, 1680)).save('$HERE/out/cover_3x4.jpg', quality=90, optimize=True)
print('cover from', f, im.size)"
chmod 644 "$HERE"/out/cover_frame/* "$HERE"/out/cover.jpg "$HERE"/out/cover_3x4.jpg
