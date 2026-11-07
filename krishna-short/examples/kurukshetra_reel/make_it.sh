#!/usr/bin/env bash
# Rebuild the Gita 4.7 / Kurukshetra transition reel from scratch (run from the krishna-short folder).
# Needs: ffmpeg, pip install numpy pillow piper-tts
set -euo pipefail
OUT=examples/kurukshetra_reel/build
mkdir -p "$OUT/crops"

# 1. public-domain paintings (Vishvarupa, Krishna-Arjun chariot, Gita updesh)
python fetch_commons_images.py --out "$OUT/images" \
  "File:Vishnu Vishvarupa.jpg" \
  "File:Krishna Arjuna Gita.jpg" \
  "File:Sri Krishna preaching Gita Upadesh to Arjun - Unknown, Kashmir School - Google Cultural Institute.jpg"

# 2. ten shots: full paintings + detail crops, ordered intro -> drop -> beats -> outro
python examples/kurukshetra_reel/crops.py "$OUT/images" "$OUT/crops"

# 3. original drums (100 BPM, drop after 4 bars) and the shloka voice-over
python make_beat.py --bpm 100 --intro-bars 4 --drop-bars 5 --out "$OUT/beat.wav"
printf "यदा यदा हि धर्मस्य, ग्लानिर्भवति भारत।\n!अभ्युत्थानमधर्मस्य, तदात्मानं सृजाम्यहम्॥\n" > "$OUT/shloka.txt"
python make_voiceover.py --text "$OUT/shloka.txt" --voice rohan --lead 1.0 --tail 0.5 \
  --out-audio "$OUT/voice.wav" --out-lyrics "$OUT/voice_lyrics.txt"

# 4. the reel
python make_reel.py --images "$OUT/crops" --music "$OUT/beat.wav" \
  --voice "$OUT/voice.wav" --voice-lyrics "$OUT/voice_lyrics.txt" \
  --words "धर्म,कर्म,सत्य,युद्ध" --end-text "धर्मक्षेत्रे कुरुक्षेत्रे" --end-sub "श्रीमद्भगवद्गीता ४.७" \
  --out "$OUT/krishna_kurukshetra_reel.mp4"
