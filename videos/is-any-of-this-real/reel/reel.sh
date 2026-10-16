#!/bin/bash
# 16:9 master → 9:16 reel: blurred fill, centred film with soft edges, phone-size captions
V=$1; IN=$V/is-any-of-this-real.mp4; OUT=$2; shift 2
cd $V/reel
ffmpeg -v error -y "$@" -i $IN -loop 1 -i mask.png -filter_complex "
[0:v]split=2[a][b];
[b]crop=461:820:730:60,scale=270:480,gblur=sigma=16,scale=1080:1920,eq=brightness=-0.14:saturation=1.2[bg];
[a]crop=1440:820:240:60,scale=1080:615:flags=lanczos,format=yuva420p[fg0];
[1:v]format=gray,scale=1080:615[m];
[fg0][m]alphamerge[fg];
[bg][fg]overlay=0:652:shortest=1,subtitles=reel.ass:fontsdir=fonts,format=yuv420p[v]" \
 -map "[v]" -map 0:a -c:v libx264 -preset medium -crf 20 -maxrate 10M -bufsize 16M -profile:v high -level 4.2 -c:a copy -movflags +faststart -r 24 "$OUT"
