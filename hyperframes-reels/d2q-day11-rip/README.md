# Day 11/30: the volatility smile (Ripping look, no character)

A 77.94 s vertical reel (1080 x 1920, 24 fps) made with HyperFrames 0.9.39. It reuses Day 11's voice, script,
timing, numbers and formulas from `../d2q-day11-hud`, in a new look: marker-box captions, one big hero per beat, and
light paper with brand-blue colour blocks (s2, s6, s12). There is no presenter anywhere.

- **Output:**
  - `out/day11_rip.mp4`: the mastered reel, −14 LUFS.
  - `out/raw.mp4`: the unmastered render.
  - `out/cover.jpg`: the cover, the s2 question frame.
  - `out/stills/`: stills of every beat.
  - `out/pilot/`: the checkpoint stills.
- **Caption:** `caption.txt`, copied unchanged from Day 11.
- **Timing:** `tools/timing.py` is the single source of truth. It reads `voice/out/timing.json`, the word onsets
  copied from Day 11. From those it writes:
  - every composition's DATA line;
  - the caption pages and marker boxes;
  - the 14 beat windows;
  - the sound-effect cues;
  - the root `index.html`;
  - `work/timing.md`, a readable timing sheet.
- **Scenes:**
  - `work/scenes/<id>.js` holds each layer's code: `bg`, `hud` (brand pill and progress strip), `ov` (captions) and
    `s1`–`s14`.
  - `tools/compose.py <id> ...` writes `compositions/<id>.html`. It inlines the kit (`work/kit.js`), plus the
    sections of `work/numbers.json` and `work/formulas.json` that each scene names in `NUM_KEYS` and `TEX_IDS`.
- **Kit (`work/kit.js`, global `K`):**
  - Cards with spring and 3D-tilt poses.
  - Objects: the glossy dial, chrome pipes, option tickets with split-flap tiles, the tear-off calendar and the smile
    card (shared by s11–s13).
  - Bold chart pieces: axes, lines, areas, candles, dots.
  - Formulas drawn as recoloured MathJax SVG images.
  - Stamps, chips, counters, cursor, UI widgets and balls.
- **Numbers:** every number on screen comes from `work/numbers.json`, copied unchanged from Day 11.
- **Sound:**
  - The voice is placed at 0.12 s.
  - Music: `assets/bgm.wav` at 0.75, with a 1.2 s fade-out.
  - CC0 effects from `assets/sfx` at 0.05–0.12. No effect sits on a stressed word; `tools/timing.py` checks this.

Rebuild and render:

```
python3 tools/compose.py bg hud ov s1 s2 s3 s4 s5 s6 s7 s8 s9 s10 s11 s12 s13 s14
python3 tools/timing.py
npx --yes hyperframes@0.9.39 render . -q looks --workers 3 --no-browser-gpu -o out/raw.mp4
bash tools/master.sh out/raw.mp4 out/day11_rip.mp4
```
