# Day 11: the volatility smile (light Hologram HUD)

The same 78 s film as `d2q-day11` (same voice, script, numbers and timing), restaged as a light Sci-fi Hologram HUD,
1080 x 1920 at 24 fps. One projector pad, the HUD chrome, the subtitles and a data-chip rail stay on screen all film.
Each beat's subject is the literal thing the voice says, wireframed in deep blue on a light stage:
- the scan plane builds it in and erases it at the cut;
- target boxes lock onto each value as it is said;
- numbers roll and lock in orange, then dock in the chip rail (−20.47% · 16.2σ · 10⁻⁵⁹ · 0.090 · 20.7% · 29.7%);
- the smile ignites once into a solid hologram.

The trader guide stays in his own colours on a small pad. `TREATMENT.md` has the look decisions; `BUILD_BRIEF_hud.md`
has the scene-by-scene beats, the frame zones and the numbers table.

- **Build:** `index.html` and `compositions/` are the HyperFrames build.
  - `bg.html`: the light stage.
  - `hud.html`: the chrome, the live status line and the chip rail.
  - `ov.html`: the HUD subtitles, driven by the voice's loudness.
  - `mc.html`: the trader.
  - `s1`–`s14`: the scenes.
- **Engine:** `work/holohud.js` bundles the Lemo-Opuscar hologram-HUD engine (holo.js, hud.js, mkmodel.mjs; MIT)
  with a light mode added (`LIGHT = true`; set it to `false` for the original dark look). `work/scaffold.js` is the
  scene scaffold every scene shares: the home camera, the scan-in and scan-erase, the pad rotation in film time.
  `tools/final_pass.py` puts the current bundle and the Fredoka face into every composition.
- **Timing:** `tools/timing_hud.py voice/out/timing.json` writes every DATA block, the status line, the chips, the
  guide's cues and lip-sync track, `work/scene_words.md` and the root `index.html` (voice, music and sound effects).
- **Voice:** the `d2q-day11` take, unchanged. VoxCPM2 (Apache-2.0) speaks a narrator designed from a text description.
  Its tools are in `../d2q-day11/tools`.
- **Music:** `tools/bed_hud.py 77.94 assets/bgm.wav` makes an original synth score (synthesised, with `bed_synth.py`).
  It holds one beat of silence before "But it did." and drops on it.
- **Sound effects:** `tools/pick_sfx_hud.py` picks the CC0 sound effects by listening.
- **Checks and master:**
  - `tools/qa_times.py` lists the film times to snapshot for a review.
  - `tools/master.sh` masters the render to −14 LUFS.
- **Numbers:** `work/smile.py` writes `work/numbers.json` and asserts its checks (as in `d2q-day11`).
- **Not in this repository:** the media (voice, music, fonts, sound effects, logo and cover).

Render: `npx hyperframes@0.9.39 render . -q looks --workers 3`, then `bash tools/master.sh out/raw.mp4 out/final.mp4`.
