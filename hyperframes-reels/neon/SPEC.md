# दोहरा pendulum → CHAOS — neon / synthwave style

1080×1920, 30 fps, 26.9 s. Voice: Manish (saved, consented voice; Audio8).
Look: near-black night (#04050b) with faint stars and a violet haze, a static synthwave grid floor (magenta lines to a vanishing point,
glowing horizon at y 1262), everything drawn additively ("lighter") as neon tubes: an 18 px glow, an 8 px halo and a bright core.
Type: Teko (Google Fonts, OFL) for the title, tags and captions, with CSS glow; the end sign "CHAOS" in Teko 700, magenta.
Captions: unspoken words dim slate, spoken words white with a cyan glow, the word being said lit magenta.
Music: bed_synth.py synthwave (92 bpm, pumping saw pad, arp with echoes, gated snare), riser and hit on "chaos".

Script: एक pendulum, और उसके नीचे एक और। इसे ऊपर ले जाइए, और जाने दीजिए… देखिए, ये कैसे नाचता है।
अब ऐसे सौ pendulum लीजिए। हर एक में बस एक डिग्री के हज़ारवें हिस्से का फ़र्क़। शुरू में सब एक जैसे चलते हैं…
पर जल्द ही, रास्ते अलग हो जाते हैं। इसे कहते हैं, chaos। नियम तय हैं, पर आगे का अंदाज़ा लगाना नामुमकिन।

Physics: two 1 m rods, equal masses, g = 9.81, no friction, RK4 at 1/600 s (kept every 1/120 s), computed in the page. Start angles
(2.4, 2.0) rad were picked from a scan (pend_scan in the round-5 notes) so that 100 pendulums started 0.001° apart stay within 3 px
for about 2 s and part by 30 px about 3.5 s after release, which is where "अलग" falls. One pendulum is built, lifted and let go with a
2.5 s light-painting trail; then the 100 appear fanned 0.5° apart (so you can see there are 100), close to their true 0.001° spacing
before release, swing as one white-hot line (additive overlap), fray on "अलग" and burst into a rainbow (cyan → violet → magenta →
amber) with short trails; the neon sign flickers on.
Voice: d1 seed 11 (round 5), d2 reworded as "अब ऐसे सौ pendulum लीजिए" (seed 13; "अब सौ pendulum" garbled), d3 seed 12.
