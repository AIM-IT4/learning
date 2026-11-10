# Narration for the Chhath documentary (`chhath_doc.html`)

The narration is spoken by a consented, saved voice from the private studio repo
(`d2q-private-uploads/studio/voices`, model Edge0 Audio8-TTS-Realistic-Air). An on-screen voice label can be
switched on with `"disclose": [from, to]` in timing.json (off in the delivered version). No audio is kept here.

1. Speak the passages (`lines_v3.json` opens with the Diwali line; `lines_v2.json` is the older version; four passages under 25 s, a few words respelled for the
   voice model: रिग्वेद/रिचाओं, अर्घ, सूर्य के पुत्र कर्ण, छठी मैया, "छठ पूजा" at the end):
   `~/.cache/audio8/venv/bin/python -I studio/tools/voice_clone.py --voice onkar lines_v3.json takes --seed 11`
   (Onkar's take ran 61 s; `ffmpeg -af atempo=1.08` per passage brings it to a normal documentary pace so part 1 fits 60 s)
2. Speech-check every take: `python3 score.py lines_v2.json takes` (character error rate after spelling
   normalisation plus a key-word check, with faster-whisper `medium` and `large-v3-turbo`).
   Take used: CER 6-10 % (turbo); key words heard correctly except near-misses छठ→"छट", षष्ठी→"शष्टी".
3. Timing: `python3 make_timing.py takes final --lines lines_v3.json --start 0.5 --gap 0.25` aligns the script to the recognised words letter by letter
   and writes `final/narration.wav` plus `final/timing.json` (shot cuts on sentence starts, subtitle chunks in
   standard spelling, cues for द्रौपदी / षष्ठी देवी / जीवनदान / the closing words).
4. Render: `node render_scenes.cjs chhath_doc.html x --timeline doc:90.841 --serve --timing timing.json --out render`
5. Mix (voice ~12 dB over the ducked song intro, song section after 60.11 s, two-pass loudnorm to -14 LUFS)
   and mux with ffmpeg.

## Human-sounding narration (current version): Gemini 2.5 Pro TTS
Following the studio playbook: whole directed takes, not line by line. Three takes (`lines_gemini.json`: T1 Diwali +
Rigveda, T2 Sita + Karna, T3 Purana + ending), each under 30 s, direction line first ("warm, unhurried documentary
narrator… never rushed"), four male candidates (Charon, Iapetus, Rasalgethi, Sadaltager), speech-checked; Charon used
(CER 1.5-7.5 %, no direction read aloud). No time-stretching: the documentary half of the music bed is two bars longer
(63.95 s) so the natural pace fits, and the WhatsApp split moves to 57.9 s.
`python3 make_timing.py takes final --lines lines_gemini.json --map '{"T1": ["p0", "p1"], "T2": ["p2"], "T3": ["p3", "p4"]}' --part1 63.951 --total 94.682`

`omni_tts.py` drives OmniVoice (k2-fsa, the engine inside VoiceStudio; Hindi; voice cloning; target duration instead
of time-stretching). It needs the VoiceStudio source on PYTHONPATH and permission to run that code; weights are CC-BY-NC.
