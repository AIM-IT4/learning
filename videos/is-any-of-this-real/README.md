# Is Any Of This Real?

A 94-second philosophical short with a whispered narration. It moves through dissolving matter, the empty atom, quantum fields, perception, dead stars, the holographic black hole, borrowed atoms, and a cosmic eye.

* **Voice:** ElevenLabs `eleven_v4`, voice "Corvin – Velvety & Intimate" (whisper). Word timings come from ElevenLabs Scribe alignment.
* **Picture:** procedural WebGL2 shaders and particle systems (no stock footage), rendered deterministically frame by frame in headless Chromium.
* **Sound:** a procedural ambient score and sound design (numpy), ducked under the VO and mastered to -15 LUFS.

Output: `is-any-of-this-real.mp4`, 1920×1080, 30 fps, H.264 with AAC 320k audio.

## Script

> Look closely… at anything. And it begins to dissolve.
> You are made of atoms. And every atom… is almost entirely empty space. You have never truly touched anything. What you feel… is a force, pushing back.
> Go deeper… and even matter disappears. Particles aren't tiny balls. They're ripples… in invisible fields. Clouds of probability… waiting to be seen.
> Color isn't out there. Sound isn't out there. Your brain paints them… in total darkness, inside your skull. And it shows you the world… a moment too late.
> Look up. Some of those stars… are already gone. You're seeing ghosts… made of light.
> At the edge of a black hole, physics whispers something stranger. That everything inside… could be written on its surface. As if our entire universe… is a projection.
> Humans. Animals. Every living thing… is a pattern, borrowing atoms… then giving them back. The carbon in you… was forged in dying stars.
> So maybe nothing is fake. Maybe it's just… not what it seems. And the strangest part? The universe built something… that can wonder about it.
> Close your eyes. Now ask yourself… who is watching?

## Pipeline

| Step | File | What it does |
|---|---|---|
| 1 | `tools/vo_process.py` | Tightens silent gaps, applies a pitch-preserving 1.2× rubberband stretch plus EQ, de-essing and compression, and remaps the word timestamps into `audio/timeline.json`. |
| 2 | `web/timeline.js` | Derives every cue (scene cuts, effects, callouts) from the spoken words, so the picture follows the voice. |
| 3 | `web/scenes1.js`, `web/scenes2.js` | The 8 scenes, each a pure function of `t`: GLSL raymarching, volumetrics, a Schwarzschild lensing black hole, and particle morphs. |
| 4 | `web/main.js`, `web/overlay.js` | Transitions (zoom-through, glitch, whip, lens swirl, pixel dissolve, flash), bloom pyramid, ACES tone mapping and grain, and word-synced captions. |
| 5 | `tools/score.py` | Pads, sub drone, shimmer grains, risers, booms, glitches and a heartbeat on the cue times, with convolution reverb, sidechain ducking and the final mix. |
| 6 | `tools/render_all.sh`, `tools/mux.sh` | Captures the frames, encodes the segments, concatenates them, and does the final encode with the mastered audio. |

Preview any moment: `node tools/still.mjs <outdir> 12.5 57.0 ...` (needs Playwright with Chromium).
