#!/bin/bash
# Render the landscape music video with render_mv.py.
#   render_parts.sh <shots.json> <out_dir> stills    one checking frame per shot (3/4 of the way in) + a contact sheet
#   render_parts.sh <shots.json> <out_dir> video     the whole MV in 4 parts side by side, joined -> <out_dir>/mv.mp4
# Depth maps are cached in <out_dir>/depth (keyed by the paintings' file names: use a new out_dir for new paintings).
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
J=$1; O=$2; MODE=${3:-video}
mkdir -p "$O"; export REEL_CACHE="${REEL_CACHE:-$O/depth}"
if [ "$MODE" = stills ]; then
  TS=$(python3 -c "
import json; c = json.load(open('$J', encoding='utf-8'))
print(','.join(f\"{s['t0'] + 0.75 * (s['t1'] - s['t0']):.2f}\" for s in c['shots']))")
  python3 "$HERE/render_mv.py" "$J" "$O/mv.mp4" --stills "$TS" "$O/stills" 2>&1 | grep -v -iE "warn|it/s\]" || true
  python3 - "$O" <<'EOF'
import glob, sys
from PIL import Image, ImageDraw
o = sys.argv[1]; fs = sorted(glob.glob(f"{o}/stills/still_*.jpg"))
cols, tw, th = 3, 640, 360
for part in range(0, len(fs), 12):
    sel = fs[part:part + 12]; rows = (len(sel) + cols - 1) // cols
    sh = Image.new("RGB", (cols * tw, rows * (th + 20)), "white"); d = ImageDraw.Draw(sh)
    for i, f in enumerate(sel):
        x, y = (i % cols) * tw, (i // cols) * (th + 20)
        sh.paste(Image.open(f).resize((tw - 4, th)), (x, y + 20)); d.text((x + 4, y + 4), f"shot {part + i + 1}: t={f.split('_')[-1][:-4]}", fill=(0, 0, 0))
    sh.save(f"{o}/stills_sheet_{part // 12 + 1}.jpg", quality=85); print(f"{o}/stills_sheet_{part // 12 + 1}.jpg")
EOF
  exit 0
fi
END=$(python3 -c "import json; print(json.load(open('$J', encoding='utf-8'))['end'])")
B=$(python3 -c "
e = $END; n = round(e * 30); q = [round(n * k / 4) / 30 for k in range(1, 4)]   # part borders on whole frames
print(' '.join(f'{x:.6f}' for x in q))")
read B1 B2 B3 <<< "$B"
A=(0 $B1 $B2 $B3); Z=($B1 $B2 $B3 $END)
python3 "$HERE/render_mv.py" "$J" "$O/mv.mp4" --still 0.5 "$O/first.png" > /dev/null 2>&1   # makes the depth maps once
for k in 0 1 2 3; do
  python3 "$HERE/render_mv.py" "$J" "$O/part$k.mp4" --from ${A[$k]} --to ${Z[$k]} > "$O/part$k.log" 2>&1 &
done
wait
for k in 0 1 2 3; do grep -q "^done" "$O/part$k.log" || { echo "part $k failed:"; tail -5 "$O/part$k.log"; exit 1; }; done
printf "file '%s'\n" "$O/part0.mp4" "$O/part1.mp4" "$O/part2.mp4" "$O/part3.mp4" > "$O/parts.txt"
ffmpeg -y -v error -f concat -safe 0 -i "$O/parts.txt" -c copy "$O/mv.mp4"
rm -f "$O"/part?.mp4 "$O/first.png"
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames,width,height -show_entries format=duration -of csv=p=0 "$O/mv.mp4"
echo "mv done: $O/mv.mp4"
