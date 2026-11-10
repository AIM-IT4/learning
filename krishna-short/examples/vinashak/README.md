# अपने ही विनाशक (Destroyers of Ourselves): 2-minute documentary

A 1:56 vertical (1080x1920) Hindi documentary on how people destroy their own home: forests, oceans and
microplastics, air, heat, wildlife, weapons, and a turn to hope at the end. The pictures are 15 Google Flow
clips (Veo 3.1 Lite, 9:16, 8 s each, 10 credits each = 150 credits) driven through flow-mcp; the narration is
Gemini 2.5 Pro TTS, voice Charon. No clips, audio or video are kept in this repo.

## Make it
1. Clips: `flow_generate` with `generate.json` (project "Vinashak"; flow-mcp opens and closes every prompt with
   a no-text clause). Clips land in `~/flow-mcp-out/Vinashak/scene-NN.mp4`. If one finishes in Flow but does
   not download, fetch it by title (`flow_download`, title "Vinashak-scene-NN"); never re-generate it, that
   spends the credits again.
2. Narration: the five passages in `lines.json` (numbers spelled out for the voice), two Charon candidates
   each, direction "grave, reflective documentary narrator; unhurried; never theatrical". Speech-check with
   `code_scenes/voice/check_takes.py lines.json takes` (the recognisers write the spoken numbers as digits,
   which inflates the letter error of passages 3 and 4; the words were right). `picks.json` = takes used.
3. Assemble: `python3 assemble.py <clips_dir> lines.json <takes_dir> picks.json <out>`: 0.5 s dissolves,
   each line cut from its take and placed on its shot (line 8 opens 0.25 s before its cut so there is a pause
   near 60 s), Hindi subtitles, sourced fact labels, title and end card (libass; keep letter spacing at 0 for
   Devanagari or the vowel signs break off), the clips' own sound levelled to -24 LUFS and kept 18 dB under
   the voice, loudnorm -14 LUFS. Prints the WhatsApp split point.
4. Export: `bash export.sh <out> <split>` (HQ copy + two WhatsApp parts under 60 s / 16 MB; if the two-pass
   encode of part 2 fails with "Incomplete MB-tree stats file", encode it single-pass with -crf 22 -maxrate 1900k).

## Sources of the on-screen facts
FAO Global Forest Resources Assessment 2020 (deforestation ~10 million ha a year, 2015-2020); Leslie et al.,
Environment International 2022 (microplastics in human blood); WHO (~6.7 million deaths a year from air
pollution); WMO (2015-2024 the ten warmest years on record); WWF Living Planet Report 2024 (-73 % average in
monitored wildlife populations, 1970-2020); SIPRI (world military spending $2.72 trillion in 2024; about
12,241 nuclear warheads in January 2025).
