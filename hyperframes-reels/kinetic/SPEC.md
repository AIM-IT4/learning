# शब्द जब नाचते हैं — kinetic-type showreel

1080×1920, 30 fps, 21.6 s. Hindi voiceover in the founder's own cloned voice ("amit", Audio8, local).
House palette: paper #f7f7f3, ink #12221f, teal #0b7f79, yellow #ffd23f. Display type Yatra One; support Noto Sans Devanagari 700.

## Script
शब्द… जब नाचते हैं, तो कहानी खुद बोलती है। हर अक्षर, एक ताल पर।
घूमते हैं, रंग बदलते हैं, बिखरते हैं, और फिर जुड़ जाते हैं। ये है मोशन… कोड से बना, फ्रेम दर फ्रेम।

Voice: take seed 11 for line 1 and for "ये है मोशन…" (cut at the 6.3 s pause); seed 13 for
"घूमते … जुड़ जाते हैं" (seeds 11/12/14 softened घ, ब and ड़). Joined with exact offsets: 0.0 / 8.248 / 8.819 s.

## Stages (film time = voice time + 0.2 s; every move lands on a measured word onset)
1. 0.0 poster: शब्द 400 px centred (y +330, ×1.2); in the pause (1.15) it moves up; जब; नाचते हैं rises and each
   letter (and श, ब्द) hops −70 px with elastic.out, 90 ms apart; हैं pops in on its word.
2. 3.15 whip: stage 1 exits left blurred, कहानी enters from the right, बोलती है from the left; a speech bubble draws on है.
3. 5.35 हर / अक्षर (400 px); on एक-ताल-पर the three clusters अ, क्ष, र punch ×1.28 to teal in step with three metronome dots.
4. 8.45 घूमते spins 360° twice; रंग goes ink → teal → yellow while the ground floods teal, then paper;
   बिखरते breaks into four pieces, one to each corner, and they fly home on "और" to land on "जुड़".
5. 15.78 मोशन slams in (scale 2.2 → 1, blur) with a yellow highlighter stroke; the GSAP line types itself;
   "फ्रेम दर फ्रेम" with a counter that shows the real frame number of this video; a film strip runs to the end.

SFX on their actions: whooshes on the whips and spin, key presses on the three beats, pop on रंग and on जुड़,
glitch on the scatter, bass hit on मोशन, typing under the code, click on the counter.

## Rebuild
`python3 tools/join_vo.py kinetic/assets/vo.wav kinetic/vo_join.json`; `python3 tools/apply_kinetic.py kinetic kinetic/cues.json`.
