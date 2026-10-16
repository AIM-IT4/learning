# Is Any Of This Real?

An 86-second philosophical short about reality as Māyā. Each scene is a metaphor: dissolving matter, the space between atoms, matter as a rumour, the brain's story, stars as memories, the universe as a projection, the self as a passing pattern, and a cosmic eye that asks who is watching.

* **Voice:** ElevenLabs `eleven_v4`, voice "Connery – Deep & Immersive Documentary", at natural pace with no time-stretch. Word timings come from ElevenLabs Scribe alignment.
* **Picture:** procedural WebGL2 shaders and particle systems (no stock footage), rendered deterministically frame by frame in headless Chromium.
* **Sound:** a procedural ambient score and sound design (numpy), ducked under the VO and mastered to -15 LUFS.

Output: `is-any-of-this-real.mp4`, 1920×1080, 24 fps, H.264 with AAC 320k audio.

## Script

> Everything around you feels solid. Certain. Real.
> But look closer… and it begins to dissolve.
> You have never touched anything. Not the ground. Not the people you love. Only the space between.
> Even matter is a rumor. Nothing is fixed… until something looks.
> The colors. The sounds. This voice. Your brain paints all of it… alone, in total darkness. You have never seen the world. Only a story about it.
> Look up. Even the stars are memories. Some of them died… long before you were born.
> And some physicists suspect this entire universe… may be a projection. A dream… with rules.
> And you? Your atoms come and go. Your thoughts come and go. The person you were ten years ago… is gone.
> The ancients called it Maya. Not that the world is false… but that it is not what it seems.
> So if everything is fake… why is something still noticing?
> Close your eyes. The world disappears. But you don't.
> Now ask yourself… who is watching?

## Pipeline

| Step | File | What it does |
|---|---|---|
| 1 | `tools/vo_process.py` | Adds breathing room at scene changes, applies a light polish (high-pass and gentle compression), and remaps the word timestamps into `audio/timeline.json`. |
| 2 | `web/timeline.js` | Maps each spoken word to a cue (scene cuts, effects, callouts), so the picture follows the voice. |
| 3 | `web/scenes1.js`, `web/scenes2.js` | The 8 scenes, each a pure function of `t`: GLSL raymarching, volumetrics, a Schwarzschild lensing black hole, and particle morphs. |
| 4 | `web/main.js`, `web/overlay.js` | Transitions (zoom-through, glitch, whip, lens swirl, pixel dissolve, flash), bloom pyramid, ACES tone mapping and grain, word-synced captions, and the माया title. |
| 5 | `tools/score.py` | Pads, sub drone, shimmer grains, risers, booms, glitches and a heartbeat on the cue times, with convolution reverb, sidechain ducking and the final mix. |
| 6 | `tools/render_all.sh`, `tools/mux.sh` | Captures the frames, encodes the segments, concatenates them, and does the final encode with the mastered audio. |

Preview any moment: `node tools/still.mjs <outdir> 12.5 57.0 ...` (needs Playwright with Chromium).
