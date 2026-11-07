#!/usr/bin/env bash
# Rhyming recitation reel: original lyrics on the beat of an original composed track.
# Run from the krishna-short folder. Needs: ffmpeg, pip install numpy pillow piper-tts
set -euo pipefail
OUT=examples/krishna_updesh_song/build
mkdir -p "$OUT/imgs"

# 1. music: 92 BPM, intro 1 bar, verse 4 bars, conch call 1 bar, DROP 8 bars, outro 2 bars
python make_music.py --bpm 92 --verse-bars 4 --drop-bars 8 --out "$OUT/music.wav"

# 2. voice: one line per bar starting at the verse (bar 1 = 4*60/92 = 2.609 s); "~" = conch bar
python make_voiceover.py --text examples/krishna_updesh_song/poem.txt --voice rohan \
  --bpm 92 --start 2.609 --tail 6 --out-audio "$OUT/voice.wav" --out-lyrics "$OUT/lyrics.txt"

# 3. pictures: public-domain paintings + detail crops, ordered to follow the story
python fetch_commons_images.py --out "$OUT/paintings" \
  "File:Vishnu Vishvarupa.jpg" "File:Krishna Arjuna Gita.jpg" \
  "File:Sri Krishna preaching Gita Upadesh to Arjun - Unknown, Kashmir School - Google Cultural Institute.jpg"
python examples/kurukshetra_reel/crops.py "$OUT/paintings" "$OUT/crops"
C="$OUT/crops"; I="$OUT/imgs"
cp $C/10.jpg $I/01.jpg; cp $C/07.jpg $I/02.jpg; cp $C/04.jpg $I/03.jpg; cp $C/08.jpg $I/04.jpg
cp $C/03.jpg $I/05.jpg; cp $C/06.jpg $I/06.jpg; cp $C/01.jpg $I/07.jpg; cp $C/02.jpg $I/08.jpg
cp $C/09.jpg $I/09.jpg; cp $C/05.jpg $I/drop.jpg; cp $C/10.jpg $I/outro.jpg

# 4. the reel (41 s: ends 4.5 s after the outro hit at 36.5 s)
python make_reel.py --images "$I" --music "$OUT/music.wav" --duration 41 --outro 4.5 \
  --voice "$OUT/voice.wav" --voice-lyrics "$OUT/lyrics.txt" \
  --end-text "धर्मक्षेत्रे कुरुक्षेत्रे" --end-sub "॥ जय श्री कृष्ण ॥" \
  --out "$OUT/krishna_updesh_reel.mp4"
