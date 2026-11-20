# Day 11: the volatility smile (light HUD, quant charts)

The same 78 s film as `d2q-day11`, 1080 x 1920 at 24 fps, with the same voice, script, numbers and timing. Every beat
shows the quant object the voice names, drawn as a light-HUD analytics screen:
- the Black-Scholes formula and implied vol by strike;
- the real S&P 500 daily candles of Sep-Oct 1987;
- σ_day = 20%/√252 and a σ ruler to −16.2σ;
- the normal and fat-tailed densities on a log axis;
- the put's payoff;
- Newton's method finding the implied vol;
- a Monte Carlo fan and the histogram of a million outcomes;
- the smile.

The HUD chrome, subtitles, data-chip rail and the trader guide stay on screen throughout. `TREATMENT.md` records the
look decisions and the rebuild. `BUILD_BRIEF_quant.md` is the scene-by-scene brief: frame zones, the kit and the
numbers policy.

- **Scenes:** each scene's own code is `work/scenes/sN.js`. `tools/compose.py sN` writes `compositions/sN.html`
  from it: fonts, the DATA line, the formulas and numbers it names, the HOLOHUD engine and the chart kit.
  `tools/final_pass.py` re-syncs the engine, kit, formulas and numbers into every composition.
- **Persistent layers:**
  - `bg.html`: the light stage.
  - `hud.html`: chrome, status line, chip rail.
  - `ov.html`: HUD subtitles driven by the voice.
  - `mc.html`: the guide, D the desk quant from the Desk2Quant character kit (`characters/` in this repo), lip-synced to
    the narrator and pointing at each chart element as it is named. Built by `work/guide/build_mc.py` from
    `work/guide/guide_src.js`; `work/guide/make_test.py` writes a test page for the kit's motion audit.
- **Chart kit:** `work/qchart.js` (global `QC`) provides the pieces. `work/holohud.js` bundles the Lemo-Opuscar
  hologram-HUD engine (MIT), with a light mode added, for its plates, locks and rolling values.
  - Charts: panels, axes, curves with a scan head, areas, bars, candles, reference lines, markers, tags.
  - Values: rolling values and target locks.
  - Transitions: the scan-in and scan-erase.
  - Formulas: a layer of typeset formulas.
- **Formulas:** `tools/formulas.py` writes the TeX with every number taken from `work/numbers.json`. Then
  `NODE_PATH=<mathjax-full>/node_modules node tools/tex2svg.mjs` typesets it to SVG (`work/formulas.json`; MathJax
  3, Apache-2.0).
- **Numbers:** `work/smile.py` writes `work/numbers.json` and asserts its checks. Inputs:
  - `work/data/spx_1987.csv`: the S&P 500's daily open, high, low and close, 1 Sep - 30 Nov 1987.
  - The crash model, simulated with seed 11 (1,000,000 paths) and checked against its exact price.
  - The Black-Scholes price curve and the Newton steps.
  - A 40-path fan (seed 2).
  - The log densities.
- **Timing:** `tools/timing_hud.py voice/out/timing.json` writes every DATA block, the status line, the chips, the
  guide's cues, `work/scene_words.md` and the root `index.html` (voice, music, sound effects).
- **Voice:** the `d2q-day11` take (VoxCPM2, Apache-2.0). Its tools are in `../d2q-day11/tools`.
- **Music:** `tools/bed_hud.py 77.94 assets/bgm.wav` makes an original synth score. A ceiling keeps it at least
  10 dB under the voice while the voice speaks.
- **Sound effects:** `tools/pick_sfx_hud.py` picks CC0 effects by listening.
- **Checks and master:**
  - `tools/qa_times.py` lists the film times to snapshot.
  - `tools/master.sh` masters the render to −14 LUFS.
- **Not in this repository:** the media (voice, music, fonts, sound effects, logo, cover).

Render: `npx hyperframes@0.9.39 render . -q looks --workers 3`, then `bash tools/master.sh out/raw.mp4 out/final.mp4`.
