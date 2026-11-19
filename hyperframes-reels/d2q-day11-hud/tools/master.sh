#!/bin/bash
# Master the render to -14 LUFS integrated (true peak under -1 dBTP): measure, set the gain, limit, re-measure.
# usage: bash tools/master.sh out/day11_raw.mp4 out/day11_smile.mp4
set -e
IN=$1; OUT=$2
I=$(ffmpeg -hide_banner -i "$IN" -af ebur128=framelog=quiet -f null - 2>&1 | awk '/Integrated loudness/{f=1} f&&/I:/{print $2; exit}')
G=$(python3 -c "print(round(-14.0 - ($I), 2))")
echo "measured $I LUFS -> gain $G dB"
ffmpeg -v error -y -i "$IN" -c:v copy -af "volume=${G}dB,alimiter=limit=0.89:level=false:attack=3:release=60" -c:a aac -b:a 192k -movflags +faststart "$OUT"
ffmpeg -hide_banner -i "$OUT" -af ebur128=peak=true:framelog=quiet -f null - 2>&1 | awk '/Integrated loudness/{f=1} f&&(/I:/||/Peak:/||/LRA:/){print}'
