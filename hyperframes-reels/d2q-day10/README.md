# Day 10: gamma vs theta (isometric, with a lip-synced guide)

84 s, 1080 x 1920. An isometric toy world where every element is what the voice says: the call contract, 100 share
cubes with 54 shorted, the ±2% P&L columns, the call price curve and its tangent hedge, theta peeling the call's value,
the ₹16 a day receipt, the bell curve of daily moves with the ±1.26% breakeven, the rule of 16, a simulated year of
daily P&L, three simulated vol paths, and implied against realised vol. A young trader in a blue hoodie stands on his
own tile in the lower right, lip-syncs the voiceover and reacts to it (flashcards with Δ, Γ, θ and ₹).

- `index.html` and `compositions/`: the HyperFrames build (bg, ov captions, s1–s16 scenes, `mc.html` the guide).
- `tools/timing_iso.py voice/out/timing.json` writes every DATA block, the guide's cues and its lip-sync track
  (`lips()`: loudness opens the mouth, a bright spectrum widens it, a dark one rounds it), and the root `index.html`.
- `tools/bed_iso.py` makes the music bed; `tools/stt_en.py` is the speech check.
- `work/numbers.json`: every figure on screen (Black–Scholes, S = K = 100, 20% vol, 1 year, zero rates; simulations
  with a fixed seed). `work/iso_kit.js`: the isometric drawing kit copied into each scene.
- Media (voice, music, diorama plates, fonts, sound effects) is not in this repository.

Render: `npx hyperframes@0.9.39 render . -q looks --workers 3`, then master to -14 LUFS:
`ffmpeg -i in.mp4 -c:v copy -af "volume=-1.3dB,alimiter=limit=0.89:level=false:attack=3:release=60" -c:a aac -b:a 192k out.mp4`.
