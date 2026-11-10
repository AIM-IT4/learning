# Narration for the Chhath documentary (`chhath_doc.html`)

The narration is spoken by a consented, saved voice from the private studio repo
(`d2q-private-uploads/studio/voices`, model Edge0 Audio8-TTS-Realistic-Air) and every post
carries "Voiceover generated with AI." (shown on screen during the narration). No audio is kept here.

1. Speak the passages (`lines_v2.json`; four passages under 25 s, a few words respelled for the
   voice model: रिग्वेद/रिचाओं, अर्घ, सूर्य के पुत्र कर्ण, छठी मैया, "छठ पूजा" at the end):
   `~/.cache/audio8/venv/bin/python -I studio/tools/voice_clone.py --voice manish lines_v2.json takes --seed 11`
2. Speech-check every take: `python3 score.py lines_v2.json takes` (character error rate after spelling
   normalisation plus a key-word check, with faster-whisper `medium` and `large-v3-turbo`).
   Take used: CER 6-10 % (turbo); key words heard correctly except near-misses छठ→"छट", षष्ठी→"शष्टी".
3. Timing: `python3 make_timing.py takes final` aligns the script to the recognised words letter by letter
   and writes `final/narration.wav` plus `final/timing.json` (shot cuts on sentence starts, subtitle chunks in
   standard spelling, cues for द्रौपदी / षष्ठी देवी / जीवनदान / the closing words).
4. Render: `node render_scenes.cjs chhath_doc.html x --timeline doc:90.841 --serve --timing timing.json --out render`
5. Mix (voice ~12 dB over the ducked song intro, song section after 60.11 s, two-pass loudnorm to -14 LUFS)
   and mux with ffmpeg.
