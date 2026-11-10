#!/bin/bash
# Exports of the finished film: full HQ copy plus two WhatsApp parts (each under 60 s and 16 MB).
# usage: export.sh <out_dir> <split_seconds>
set -e
OUT=$1; SPLIT=$2; F=$OUT/film.mp4
TOTAL=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$F")
ffmpeg -y -v error -i "$F" -c:v libx264 -preset slow -crf 21 -profile:v high -level 4.1 -pix_fmt yuv420p -c:a copy -movflags +faststart "$OUT/Apne_Hi_Vinashak_HQ.mp4"
X="-c:v libx264 -preset slow -b:v 1900k -maxrate 3000k -bufsize 4000k -profile:v high -level 4.1 -pix_fmt yuv420p"
cd "$OUT"
D1=$SPLIT; D2=$(python3 -c "print(round($TOTAL - $SPLIT, 3))")
ffmpeg -y -v error -t $D1 -i "$F" -vf "fade=t=out:st=$(python3 -c "print($D1-0.5)"):d=0.5" $X -pass 1 -passlogfile wa1 -an -f null /dev/null
ffmpeg -y -v error -t $D1 -i "$F" -vf "fade=t=out:st=$(python3 -c "print($D1-0.5)"):d=0.5" -af "afade=t=out:st=$(python3 -c "print($D1-0.6)"):d=0.6" $X -pass 2 -passlogfile wa1 -c:a aac -b:a 128k -ar 44100 -movflags +faststart Apne_Hi_Vinashak_WhatsApp_Part1.mp4
ffmpeg -y -v error -ss $SPLIT -t $D2 -i "$F" -vf "fade=t=in:st=0:d=0.3" $X -pass 1 -passlogfile wa2 -an -f null /dev/null
ffmpeg -y -v error -ss $SPLIT -t $D2 -i "$F" -vf "fade=t=in:st=0:d=0.3" -af "afade=t=in:st=0:d=0.2" $X -pass 2 -passlogfile wa2 -c:a aac -b:a 128k -ar 44100 -movflags +faststart Apne_Hi_Vinashak_WhatsApp_Part2.mp4
rm -f wa1*.log* wa2*.log*
for f in Apne_Hi_Vinashak_*.mp4; do echo "$f $(ffprobe -v error -show_entries format=duration,size -of csv=p=0 $f)"; done
