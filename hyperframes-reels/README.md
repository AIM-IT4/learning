# HyperFrames reels with a Hindi voiceover (1080×1920, 20–30 s)

Three vertical example reels made with [HyperFrames](https://hyperframes.heygen.com) 0.9.39: HTML + GSAP compositions
rendered frame by frame to MP4. Each folder is a HyperFrames project (`index.html` root + one scene in `compositions/`)
with a `SPEC.md` that gives the script, the palette and every shot as a number.

| folder | reel | length | voice | look |
| --- | --- | --- | --- | --- |
| `chai/` | मसाला चाय — the recipe in 25 s | 25.0 s | ElevenLabs `eleven_v4`, Hindi | risograph spice packet (turmeric, chai brown, chilli red) |
| `compound/` | कंपाउंडिंग का जादू — ₹5,000/month for 20 years | 26.4 s | the founder's consented, saved voice | house reel style: paper, ink, teal, yellow highlight |
| `kinetic/` | शब्द जब नाचते हैं — kinetic-type showreel | 21.6 s | the founder's consented, saved voice | house reel style, Yatra One display type |
| `shape/` | एक शेप, छह काम — one shape morphs through six UI jobs, an oversized cursor clicks each | 20.0 s | Manish (consented, saved voice) | house style, dot-grid canvas |
| `recur/` | रिकर्शन, तीन अंदाज़ में — code + call stack, nesting dolls, a Droste tunnel | 29.5 s | Manish | house style, three genres |
| `site3d/` | Desk2Quant laid flat — the live site in 3D, a camera glides over its real words | 28.5 s | Manish | the site itself, captured and stitched |

The last three follow prompt-motion.com entries: shape morphing through UI states and the landing page 3D scroll
(@twoclipping), and recursion explained in genres (@emollick). Their music beds are synthesised by `tools/bed_synth.py`
(numpy, no samples). The site reel's page comes from `tools/site_capture/` (screen-by-screen capture of the live site, stitched,
cut into tiles) and its highlight boxes from the same script's word measurements; every claim on screen is on the live page.

The founder's voice is spoken locally by Edge0 Audio8-TTS-Realistic-Air from the saved, consented reference in the
private studio repo (`d2q-private-uploads/studio/voices`). No audio, fonts or renders are kept here (see `.gitignore`).

## Make one again

1. Assets: `tools/assets.sh` copies the fonts (from `video-skills/painted-song-reel/fonts`) and the sound effects
   (from the HyperFrames `media-use` skill) into each project's `assets/`.
2. Music beds: `python3 tools/music_gen.py <dir>` (MusicGen-small on CPU, seed 7), then
   `ffmpeg -i bed.wav -af loudnorm=I=-30:TP=-2 -ar 48000 -ac 1 <project>/assets/bgm.wav` (kinetic: `I=-27`).
3. Voice (lines in `voice/lines.json`; the voice model reads Hindi with an English reference, so speech-check every take):
   - `~/.cache/audio8/venv/bin/python -I studio/tools/voice_clone.py --voice amit voice/lines.json takes --seed 11`
     (run from the private studio repo); `tools/voice_seeds.py` renders one line with several seeds in one model load.
   - Check each take: `python3 tools/words.py take.wav hi` (faster-whisper large-v3-turbo word times) and
     `python3 tools/sil.py take.wav` (pauses). Whisper starts a word too early when it follows a pause: the word's real
     onset is the end of the pause inside its span (confirm by transcribing a crop that starts at the pause end).
   - Join: compound `python3 tools/build_vo.py compound/assets/vo.wav 0.45 takes/c1.wav takes/c2.wav`;
     kinetic `python3 tools/join_vo.py kinetic/assets/vo.wav kinetic/vo_join.json` (prints each part's exact offset).
     Both normalise the voice to −16 LUFS / −1.5 dBTP.
4. Cues: put the measured onsets in `<project>/cues.json`, then `python3 tools/apply_compound.py compound compound/cues.json`
   or `python3 tools/apply_kinetic.py kinetic kinetic/cues.json`: they patch the timing constants in the scene and rewrite
   `index.html` with every sound effect on its cue and the right length.
5. `npx hyperframes@0.9.39 check --json`, `npx hyperframes@0.9.39 snapshot --at …`, then
   `npx hyperframes@0.9.39 render -o renders/<name>.mp4 -q delivery` (run it in the foreground or as a tracked
   background job; a detached render is cancelled when its parent exits; it needs ~1 GB free disk).
6. The render masters at about −12.5 LUFS; trim the audio to about −14 LUFS for Reels and Shorts:
   `ffmpeg -i in.mp4 -map 0 -c:v copy -af volume=-1.5dB -c:a aac -b:a 192k -movflags +faststart out.mp4`.
