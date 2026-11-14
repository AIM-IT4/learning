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
| `maze/` | भूलभुलैया — one Truchet tile, random turns, a maze (card-flip waves, seamless two-colour rule) | 19.2 s | Manish | house style |
| `tess/` | चौथा आयाम — point, line, square, cube, tesseract; 4D maths drawn every frame | 24.9 s | Manish | house style, axis colours |
| `eqd/` | Equity Derivatives Quant Notes & Code — a one-take launch film over the product's real cover | 22.4 s | Manish | the product cover |
| `galton/` | गैल्टन बोर्ड — one ball explained, then 1,000 seeded coin-flip paths stack into a bell curve | 23.7 s | Manish | house style |
| `fourier/` | घूमते गोले — circles on circles (a DFT run in the page) draw a heart, then a rising chart | 22.1 s | Manish | house style, chart paper |
| `golden/` | प्रकृति का गणित — Fibonacci sums, squares, the golden spiral, 600 seeds at 137.5° make a sunflower | 26.9 s | Manish | house style |
| `montecarlo/` | बिंदुओं से π — 50,000 seeded dots in a square, a live count, π ≈ 3.139, simulated option paths | 25.1 s | Manish | house style |
| `brachisto/` | सबसे तेज़ रास्ता — line vs arc vs cycloid with real times, a rolling wheel, the tautochrone | 25.6 s | Manish | house style |
| `neon/` | दोहरा pendulum → CHAOS — 100 double pendulums 0.001° apart split on "अलग" | 26.9 s | Manish | **neon / synthwave** |
| `chalk/` | त्रिकोण का जादू — a² + b² = c² by sliding four triangles | 29.5 s | Manish | **chalkboard** |
| `paper/` | 72 का नियम — rule vs exact doubling times on a spinning front page | 30.0 s | Manish | **newspaper print** |
| `hedge/` | Delta hedging in a minute (English) — short call, delta as a slope, one simulated path hedged 5/20/200 times, error halves per 4× trades | 55.3 s | Manish (English) | **Desk2Quant product covers, alive** |
| `pnl/` | "We made $1.5 million today. Why?" (English) — P&L explain on a light desk screen: delta, gamma, vega, theta, the $50k gap | 56.2 s | Manish (English) | **light trading-desk screen** |

The shape, recursion and site reels follow prompt-motion.com entries: shape morphing through UI states and the landing page 3D scroll
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

Round 3 (maze, tess, eqd) follows three more prompt-motion.com entries: the most popular one (a looping Truchet pattern), the
wireframe cube, and the keynote-style launch film. Voice notes: this voice softens aspirated छ and भ and garbles very short lines,
so "साधारण" replaces "छोटी", "साया" replaces "परछाईं", "डिस्काउंट" replaces "छूट", English product terms are written in Latin
script, and "नया लॉन्च" is shown, not spoken. `tools/mkindex.py` writes a root index.html from a list of sound effects.

Round 4 (galton, fourier, golden) is maths you can watch: each scene is one canvas redrawn from timeline time, with every
state a pure function of that time (so a seek never reads a stale tween). `tools/patchW.py` patches the measured word onsets
(`W`, `VO_END`) into a scene. The voice still softens aspirated sounds (ख, घ) and once said "बीज" as "बीस", so takes were picked
per sentence and spliced (see each `vo_join.json`). A sound effect or a bright music bed on top of an aspirated word hides it:
no whoosh on such a word, and the Fourier and golden beds are low-passed (3.5 and 4 kHz). The scenes also use
`DejaVuSans-Bold.ttf` for φ, → ← and ↻ ↺, which the bundled fonts lack.

From round 6 on, every reel gets its own style: background, type, palette, caption treatment and music, never the house style
again. Neon (Teko, additive glow, synthwave grid, `bed_synth.py synthwave`), chalkboard (Kalam, speckle chalk and hatching,
synthesised chalk sounds, `lofi`), newspaper (Rozha One, Tiro Devanagari Hindi, UnifrakturMaguntia, Playfair Display, rubber
stamps on an ink layer, `newsreel`). The style fonts are Google Fonts (OFL), fetched by `tools/assets.sh`. `tools/tighten.py`
cuts pauses over 0.5 s down to 0.36 s and prints the cuts so measured word times can be remapped. Ideas not used yet: blueprint,
watercolour storybook, pixel-art game, paper cut-out, retro terminal, 3D product film.

Round 7 (hedge, pnl) is two one-minute English reels for Desk2Quant, in the site's light palette with the real logo and
product covers, every frame filled from top to bottom. The voice is Manish's saved reference speaking English (a test of Manish
and Onkar on four lines read both cleanly; Manish is quicker): `voice/lines_en_d2q.json` holds the English lines, one seed per
line, then `tools/en_words.py` (faster-whisper hears each take with no prompt and times every script word; three lines were
retaken: "drips" for "drifts", "explained" for "explain", and "Added up" after a pause was cut).
`tools/en_vo.py <lines> <project>/vo_spec.json <out>` cuts pauses over 0.4 s to 0.3 s (a part can keep its pause), speeds up
only if tempo is not 1, joins at −16 LUFS and writes timing.json; `tools/en_caps.py` writes the caption groups and the word
cues into the scene, and `tools/mkroot_d2q.py` writes the root with every sound on its cue. The hedge numbers come from
`tools/hedge_sim.py` (Black–Scholes, seeded GBM paths); the P&L book is illustrative and labelled so on screen.
