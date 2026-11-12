# भूलभुलैया — Truchet tiles (after prompt-motion.com's most popular entry, a looping Truchet pattern)

1080×1920, 30 fps, 20 s. Voice: Manish (saved, consented voice; Audio8). House palette: paper, ink, teal, yellow.

Script: एक साधारण सी टाइल। इसमें बस दो मोड़ हैं। इसे सीधा रखिए, या घुमा दीजिए। अब ऐसी सैकड़ों टाइल्स बिछाइए, हर एक को बेतरतीब
घुमाकर… और देखिए, एक भूलभुलैया बन गई! एक नियम, दो विकल्प, और अनगिनत डिज़ाइन।

The tile: two quarter-circle turns (corners TL+BR, or turned: TR+BL). 13×23 tiles of 84 px, tile (6, 11) at the centre (540, 960).
Colour rule that is always seamless: the corner pieces of tile (i, j) take colour (i + j + o) % 2, the band between them the other.
Beats: one tile 480 px wide (frame 0) → its two turns light on "दो मोड़" → the pair A (straight) / B (turned) → "सैकड़ों": the floor
is laid outward from the centre (all straight: fish scales) as the camera pulls back → "बेतरतीब": a radial wave of card flips (squash
flat, swap unseen, open mirrored — the mirror of a tile is the turned tile) → "भूलभुलैया": teal floods in → three new seeded rolls on
"एक नियम / दो विकल्प / अनगिनत डिज़ाइन". Seeded PRNG (mulberry32), so every render is identical. Bed: bed_synth.py tiles (104 bpm).
