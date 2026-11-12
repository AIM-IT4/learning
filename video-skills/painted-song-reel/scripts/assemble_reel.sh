#!/bin/bash
# Put the reel together: intro (3.40 s) + black (0.10 s) + rotate card (1.00 s) + the music video turned 90 degrees
# clockwise (4.50 -> end), over the song from SONG0, loudness -14 LUFS.
# usage: assemble_reel.sh <work_dir> <song> <song_start_s> <out.mp4>
set -e
WD=$1; SONG=$2; S0=$3; OUT=$4
MVD=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$WD/mv.mp4")
TOTAL=$(python3 -c "print(round(4.50 + $MVD, 3))")
FO=$(python3 -c "print(round($TOTAL - 0.8, 3))")
ffmpeg -y -v info -nostats -ss "$S0" -t "$TOTAL" -i "$SONG" -af "afade=t=in:st=0:d=0.06,afade=t=out:st=$FO:d=0.8,loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json" -f null - 2> "$WD/ln.txt"
J=$(python3 - "$WD/ln.txt" <<'EOF'
import json, sys
s = open(sys.argv[1]).read(); j = json.loads(s[s.rindex("{"): s.rindex("}") + 1])
print(f"measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}")
EOF
)
ffmpeg -y -v error \
  -i "$WD/intro.mp4" -f lavfi -t 0.10 -i "color=c=black:s=1080x1920:r=30" -i "$WD/card.mp4" -i "$WD/mv.mp4" \
  -ss "$S0" -t "$TOTAL" -i "$SONG" \
  -filter_complex "[0:v]fps=30,format=yuv420p,setsar=1[a];[1:v]format=yuv420p,setsar=1[b];[2:v]fps=30,format=yuv420p,setsar=1[c];[3:v]fps=30,transpose=1,format=yuv420p,setsar=1[d];[a][b][c][d]concat=n=4:v=1:a=0[v];[4:a]afade=t=in:st=0:d=0.06,afade=t=out:st=$FO:d=0.8,loudnorm=I=-14:TP=-1.5:LRA=11:$J:linear=true,aresample=48000[au]" \
  -map "[v]" -map "[au]" -t "$TOTAL" -c:v libx264 -preset slow -crf 18 -profile:v high -level 4.2 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$OUT"
