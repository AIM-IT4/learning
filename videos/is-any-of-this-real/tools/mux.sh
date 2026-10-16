#!/bin/bash
# concat rendered segments, final x264 encode, add mastered audio
V=$1; OUT=$2
cd $V/seg
ls seg*.mp4 | sort | sed "s/^/file '/; s/$/'/" > list.txt
ffmpeg -v error -y -f concat -safe 0 -i list.txt -c copy video_raw.mp4
ffmpeg -v error -y -i video_raw.mp4 -i $V/audio/mix_final.wav \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -tune film -pix_fmt yuv420p -profile:v high -level 4.2 \
  -x264-params "aq-mode=3:deblock=-1,-1" -c:a aac -b:a 320k -ar 48000 -movflags +faststart -shortest "$OUT"
ffprobe -v error -show_entries format=duration,size,bit_rate -show_entries stream=codec_name,width,height,r_frame_rate -of compact "$OUT"
