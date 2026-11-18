# Desk2Quant promo v3: scene builder brief

A 39 s vertical reel (1080×1920) for Desk2Quant, a site that teaches quant finance and trains people for quant interviews and desk work. v3 copies the look of a reference SaaS promo:
- glossy 3D product renders as the hero object of each shot
- light and dark scenes alternating at every cut: light #eceef0, or charcoal #12161c with a neon-green glow
- a breathing pixel mosaic in the background
- huge mixed-size captions with a giant "hero" word slam
- pixel staircase or dissolve wipes on every cut

The background, captions, logo bar and wipes are finished and live in `build/compositions/bg.html` and `ov.html`. **Do not edit them**, or `index.html` or `tools/`. You write only the scene files you are assigned: `build/compositions/sN.html`.

**Read first:**
- `build/compositions/s1.html`: the finished exemplar. Copy its structure exactly: the template, the fonts, the `#root`, the camera div, the plate `<img>`, an overlay positioned on a plate anchor, the DATA block, and `w(i)`.
- The v2 files in `build_v2/compositions/`. The finished v2 film had the same story in another style; several v3 scenes port a v2 scene's content (named below). In a port, keep the words, numbers and real covers, but restyle to the v3 palette: v2's teal `#08a9a2` becomes green, and light/dark follow the scene's theme.
- `/home/user/Films/d2q-promo/build/assets/plates/` holds `p01.png`…`p12.png`: 1024×1024 RGBA cutouts of glossy 3D props, with soft shadows and glow kept. Look at the ones you use.

## The contract (HyperFrames 0.9.39; the render breaks if you skip one)
- The scene file is one `<template>`: `<style>`, then `<div id="root" data-composition-id="sN" data-width="1080" data-height="1920">`, then `<script>`.
  - Prefix every id and class with `sN-`.
  - `#root { position:absolute; inset:0; overflow:hidden; }`, and no background: the shared bg shows through.
- Keep exactly one line `/*DATA*/ const DUR = …; const W = […]; /*END*/`. `tools/timing.py` rewrites it.
  - Fill it with the DUR and W given below.
  - Read words through `const w = (i) => Math.max(0, W.length > i ? W[i] : <fallback>)`.
- One paused GSAP timeline: `const tl = gsap.timeline({ paused: true }); … window.__timelines["sN"] = tl;`. GSAP is global.
  - Use `fromTo` only.
  - Every later tween on a property an earlier tween already set needs `immediateRender: false`.
- Everything is a pure function of timeline time.
  - Not allowed: `Date`, `Math.random` (use a seeded mulberry32 if you need randomness), timers, `repeat: -1`, `play()`.
  - Canvas drawing goes through a proxy tween: `tl.fromTo(st, {t:0}, {t:DUR, duration:DUR, ease:"none", onUpdate: draw}, 0)`.
- Do not put a CSS `transform` on an element that GSAP transforms. A `transform-origin` is fine.
- Asset paths are `assets/...` with no leading slash.
- Fonts:
  - `D2QSans` (Bricolage Grotesque, 100–900) for all UI and type
  - `JetBrains Mono` for code and maths
  - Copy both `@font-face` lines from s1.
- No audio in scene files: sound effects are placed by `timing.py`.

## Frame layout (1080×1920)
| Zone | y range | Rule |
|---|---|---|
| Logo bar | 46–106 | Keep it clear. |
| Caption zone | 150–530 | **Nothing of yours above y 560 at any moment**, camera moves included. The overlay draws the captions and the giant hero word here. |
| Stage | 560–1600 | The prop and your overlays live here. |
| Bottom | 1600–1920 | The Instagram UI covers this. Only decoration (shadows, floor glow); no text. |

- Side margins: key text inside x 60–1020.
- **Text sizes:**
  - labels ≥ 26 px
  - key words and numbers ≥ 34 px
  - a hero number on the stage: 90–200 px
  - Everything must read on a phone.
- Each cut is covered by a pixel wipe. The first ~0.26 s and the last ~0.2 s of every scene are partly hidden, so land the key beats between 0.3 s and DUR − 0.25.

## The plates
- The standard placement is `<img id="sN-plate" src="assets/plates/pNN.png">` at `left:-40px; top:500px; width:1160px; height:1160px`.
  - Scale k = 1160/1024 = 1.1328.
  - Plate pixel (px, py) maps to the frame at (−40 + 1.1328·px, 500 + 1.1328·py).
- You may move or scale a plate for a shot, but recompute the anchors.
- Anchors (plate px → frame px at the standard placement):

| plate | prop | theme | anchors (frame) |
|---|---|---|---|
| p02 | green glass shield, chrome frame, glass pedestal | D | shield x 250–830, y 717–1442; face centre (540,1032); pedestal top y≈1486 |
| p03 | black chair behind a white desk, chrome stopwatch, glass of water | L | desk top ≈ x 337–917, y 1007–1167 (3/4 view); stopwatch ≈ (1010,690) of plate → check |
| p04 | tall stack of blank white cards | L | top cards x 235–845, y 660–950; stack base y≈1544 |
| p05 | chrome pressure gauge, white dial with a green→amber→red arc, **no needle** | D | dial centre (546,1039), dial radius 283; arc runs from lower-left (green, about −135° from straight up) over the top (amber) to lower-right (red, +135°) |
| p06 | empty white pedestal with a green ring light | L | top ellipse centre (540,1166), rx 339, ry 59 |
| p07 | white toy bank with columns on a dark glass pedestal | D | building x 250–830, y 741–1354; pedestal to y≈1480 |
| p08 | silver laptop, black screen | L | screen x 223–857, y 772–1200 |
| p09 | white desk, four black monitors (2×2) | D | TL x196–530 y695–892 · TR x550–884 y695–892 · BL x196–530 y910–1100 · BR x550–884 y910–1100 |
| p10 | tall paper stack with green index tabs, binder clip | L | stack x 144–917, y 613–1547 |
| p11 | green arrow signpost (sign points right) | D | sign face x 311–798, y 727–913 (arrow tip at x≈845); post down to y≈1544 |
| p12 | thick silver coin upright on a glass pedestal | D | coin rim x 165–905, y 696–1449; face centre ≈ (526,1072), face radius ≈ 283; the pedestal is plate y > 838 (frame y > 1449) |

Verify every anchor in a snapshot. If an overlay is off its screen or face, fix the numbers.

## Look tokens
- **Light scene:**
  - text #111418, muted #5b6573, accent #16a34a, soft accent rgba(22,163,74,0.12)
  - card: #fff, border 2px #dfe4ea, radius 26px, shadow `0 30px 60px rgba(17,20,24,.12), 0 8px 18px rgba(17,20,24,.06)`
- **Dark scene:**
  - text #f4f6f7, muted #9aa4b2, accent #22c55e
  - glass card: `linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.03))`, border 1.5px rgba(255,255,255,.14), radius 26px, shadow `0 30px 70px rgba(0,0,0,.45), 0 0 60px rgba(34,197,94,.14)`
- Rose for an error or bad number: #f43f5e.
- Chips and pills: fully rounded, bold 800, chunky like the reference. Glossy (a top highlight gradient) where it helps the 3D feel.
- Nothing gets `backdrop-filter`; it is too slow to render.

## Camera: every shot settles, never two alike in a row
- Wrap everything in `#sN-cam` (`position:absolute; inset:0; transform-origin:<prop centre>`).
- The settle: a quick `expo.out`, 0.5–0.9 s, starting at 0.
- Then a hold or a slow push over the rest of the scene.
- Use the move assigned to your shot.
- A beat (impact, punch, shake) may add a short extra tween on top.

## Data rules
- Never invent data. The numbers on screen come only from this brief or the v2 file you port: 2.32, 0.07, 104.08, 1000+, 10 free.
- Label anything simulated as simulated.
- Covers are real files in `assets/covers/`.
- Never mention how the film or its voice was made.
- Every frame must be about Desk2Quant's story, not generic.

## Scenes
Film times are [start, duration]. W is scene-relative onsets in seconds. **Bold** words have the caption hero slam at that moment, so the scene's own beat must land on the same word.

**s1** L [0, 1.52] p01 tablet: done (the exemplar).

**s2** D [1.52, 1.19] p02 shield. "But can you **hedge** with it?"
- W = [0.16, 0.42, 0.52, 0.64, 0.80, 0.96]
- A big white-and-green "Δ" sits etched on the glass face (D2QSans 900, about 300 px, white with a green glow; behind it, a thin green ring).
- On "hedge" (W[3]): the shield punches (scale 1.08 yoyo), a green shockwave ring expands from the face centre, and the Δ flashes bright.
- Small chips ("Δ-hedge", "rebalance") pop either side on "with it?".
- Camera: drop-in from above (y −90→0, scale 1.12→1, expo.out 0.6), then a slow push 1→1.04.

**s3** L [2.71, 3.19] p03 interview desk. "If you're preparing for a quant **interview**, this changes how you study."
- W = [0.16,0.44,0.54,0.86,1.08,1.20,1.38,2.00,2.12,2.42,2.64,2.80]
- On "interview": a white question card slides onto the desk top (slight 3D tilt to sit on it), reading "FINAL ROUND" (small, green, tracked) and "Hedge this option." (34–40 px, 800).
- A small timer chip "00:45" counts down beside the stopwatch.
- On "changes" (W[8]): a toggle card below the desk flips its pill from "Memorise" (muted) to "Practise" (green, with a ✓).
- Port the idea from v2 `s2.html`.
- Camera: slide-in from the right (x 90→0, scale 1.08→1, expo.out 0.7), then a slow push toward the desk (1→1.05).

**s4** D [5.90, 6.37] no plate. "One simulated path. Hedge it five times, and the error is 2.32 / Two hundred times: **0.07**"
- W = [0.16,0.50,0.94,1.28,1.56,1.68,1.86,2.24,2.46,2.56,2.82,3.02, 4.16,4.313,4.62,4.90]
- Port v2 `s3.html` (the notebook: a simulated price path chart, a "rebalances" slider 5→200, the hedge-error readout 2.32 in rose → 0.07 in green, its real readings and its power-law interpolation) to a **dark glass notebook card** about 920×1000.
  - Keep the "Simulated" label.
  - The error number's final jump lands on "0.07" (W[15]).
- Make it feel 3D: perspective 1600px on a parent, the card at rotateY ≈ −10° → 0 → +4° and rotateX ≈ 4°, with a green glow under it.
- Camera: the orbit just described (expo.out settle 0.8 s, then a slow drift), plus a push 1→1.05.

**s5** L [12.27, 1.64] p04 card stack. "Everyone memorises formulas."
- W = [0.16,0.64,1.04]
- White formula chips rise out of the top of the stack, one after another, like rote cards being drilled:
  - "Δ = N(d₁)"
  - "Γ = φ(d₁)/(Sσ√T)"
  - "C − P = S − Ke^(−rT)"
  - "dS = μS dt + σS dW"
  - "Θ, ν, ρ …"
  - Use JetBrains Mono 30–34 px. Use `<sub>`/`<sup>` for subscripts and superscripts, not Unicode super/subscript letters.
- On "formulas" (W[2]): all chips burst out to float around the stack, slightly rotated.
- Camera: rise from below (y 110→0, scale 1.1→1, expo.out 0.6), then hold.

**s6** D [13.91, 3.59] p05 gauge. "But formulas were never the hard part. Explaining them under **pressure** is."
- W = [0.16,0.42,0.86,1.06,1.26,1.40,1.62,2.08,2.48,2.68,2.84,3.18]
- Draw the needle in code: a tapered dark-red/black needle about 230 px long from the dial centre, with a chrome hub disc (about 46 px) over its root, rotating about the centre.
  - From the start it rests in the green (about −112°), barely trembling.
  - On "Explaining" (W[7]) it climbs to about −20°.
  - On "pressure" (W[10]) it slams into the red (+122°, overshoot +130 then settle, with a small high-frequency jitter after).
  - The dial and the background glow tint red: overlay a red radial glow (#f43f5e) over the dial.
- On "pressure", a chip "Explain it. Live." pops below the gauge.
- Camera: settle scale 0.94→1 (0.5 s), then a slow continuous push-in toward the dial (1→1.12, power1.in), plus a short shake (a few px, 0.25 s) on "pressure".

**s7** L [17.50, 2.06] p06 pedestal. "**Desk2Quant** trains exactly that."
- W = [0.16,0.90,1.22,1.68]
- The real logo (`assets/logo.png`, 512×512, a black rounded tile with a white trend line) drops from above as a glossy 3D tile (about 300 px):
  - a top highlight
  - a thickness edge: a darker copy offset 14 px down
  - a shadow on the pedestal top
- It lands on the pedestal top centre on "Desk2Quant" (W[0]+0.05) with a squash-and-bounce. The ring light flares green and green pixel squares (like the mosaic) burst out.
- On "trains" and "exactly", three pills rise beside the tile, one per word: "Explain", "Defend", "Hedge".
- Camera: tilt settle (rotation −3°→0, scale 1.15→1, expo.out 0.7), then a hold, plus a 6 px impact shake on landing.

**s8** D [19.56, 1.72] p07 bank. "Built by a practising bank quant."
- W = [0.16,0.32,0.48,0.62,0.94,1.28]
- A dark glass name card slides up in front of the bank's pedestal (x ≈ 140–940, y ≈ 1300–1520) on "Built":
  - "Amit Kumar Jha" (44 px, 800)
  - "Practising bank quant · IIT Jodhpur" (30 px, muted, the green dot)
  - a small green pill "Founder"
- Its underline sweeps on "bank quant".
- Camera: pull-back (scale 1.2→1, expo.out 0.8), then a hold.

**s9** L [21.28, 1.86] p08 laptop. "First, notes with the **code** that runs them."
- W = [0.16,0.54,0.76,0.90,1.00,1.22,1.34,1.58]
- On the laptop screen: a dark code editor. Port v2 `s6.html`'s Python lines and its real output "Out 104.08".
  - The typing must be fast enough to finish by "runs".
  - Out pops on "runs" (W[6]).
  - Fit the code to the screen width, ≥ 22 px mono.
- On "notes" (W[1]): the real cover `assets/covers/equity-derivatives-quant-notes.jpg` (glossy card, about 300 px, slight 3D tilt) slides in at the lower left, overlapping the laptop's corner.
- Camera: whip from the left (x −140→0, blur 10px→0 over 0.35 s, expo.out), then a push 1→1.04.

**s10** D [23.14, 3.80] p09 quad monitors. "Then the **desk**: Greeks, P&L explain, XVA, model validation."
- W = [0.16,0.44,0.52,1.00,1.18,1.74,2.14,2.80,3.10]
- The four screens power on one per topic word, like a monitor switching on (a bright horizontal line opens vertically, about 0.18 s):
  - "Greeks" W[3] → TL: `assets/covers/greeks-cheat-sheet.jpg`
  - "P&L" W[4] → TR: `pnl-attribution-desk-diagnostics.jpg`
  - "XVA" W[6] → BL: `xva-calculus-lab.jpg`
  - "model" W[7] → BR: `model-validation-case-studies.jpg`
- Each screen shows its cover cropped to the screen (object-fit: cover), with a label strip at its bottom (24–28 px, 800, dark scrim): "Greeks", "P&L explain", "XVA", "Model validation".
- On "desk" (W[2]): the desk's green under-glow flares.
- Camera: settle scale 1.1→1 (expo.out 0.6), then a slow pan x +30→−30 with a push 1→1.05.

**s11** L [26.94, 2.67] p10 paper stack. "Then the interview: **1000+** problems, with solutions."
- W = [0.16,0.42,0.52,1.08,1.44,1.92,2.02]
- Sheets fly in and land on the stack (a few quick white sheets).
- On "1000+": a big counter badge beside the stack ticks 0→1000+ (the real count; land at "1000+" by W[4]).
- The real cover `assets/covers/quant-interview-problem-book.jpg` stands in front as a glossy card.
- On "solutions" (W[6]): a green "✓ Worked solution" stamp thumps onto it.
- Port the idea from v2 `s8.html`.
- Camera: tilt-up rise (y 120→0 and rotation 2°→0, expo.out 0.7), then a slow push.

**s12** D [29.61, 1.08] p11 signpost. "Don't know where to start?"
- W = [0.16,0.48,0.58,0.72,0.84]
- Two or three "?" bubbles (glass, green "?") pop around the sign on "Don't" and "know".
- On "start?" (W[4]): "START HERE" stamps onto the sign face in white D2QSans 900 (fit inside the face, about 64–74 px). The sign wiggles and the "?"s pop away.
- Camera: whip from the right (x 140→0, blur, expo.out 0.4).

**s13** L [30.69, 1.34] no plate. "10 resources are **free.**"
- W = [0.16,0.30,0.76,0.98]
- The ten free covers from v2 `s9.html`, same files in the same order, fly up and fan out in an arc like a hand of cards: glossy, 3D perspective, soft shadows, large. The fan fills x 60–1020, y 640–1400.
- A counter pill "1 … 10" counts with them.
- On "free." (W[3]): a green "FREE" ribbon stamps across the fan.
- Port v2 `s9.html` (its arc and ribbon), restyled.
- Camera: zoom-out settle (scale 1.3→1, expo.out 0.6).

**s14** D [32.03, 3.57] p12 coin. "Textbooks teach you the **model.** / The desk teaches you what **breaks** it."
- W = [0.16,0.68,0.88,1.02,1.10, 1.69,1.93,2.15,2.37,2.55,2.67,2.89]
- Port v2 `s10.html` (the coin flip: face A open-book emblem + "TEXTBOOK", flip on "The desk" to the real logo + "THE DESK", the hit on "breaks" with a coin punch, glow flash, shockwave and desk chips flung out to orbit). Keep its timing logic.
- Use the plate as the coin instead of the CSS coin:
  - Split it into two layers with the same image: the coin (clip the plate to py < 838) and the pedestal (py ≥ 838).
  - Only the coin layer squeezes on the flip (scaleX about the coin's centre).
  - The face art sits on the coin face (centre ≈ (526,1072), radius ≈ 283) and flips with it.
- The emblem and the logo face read on silver: dark ink #1f2933, green accents.
- Camera: settle y 60→0 (expo.out 0.6), then v2's slow rotation drift.

**s15** L [35.60, 3.36] no plate. "Comment FREE, and we'll DM you all ten."
- W = [0.16,0.54,0.80,0.98,1.16,1.34,1.52,1.62]
- Port v2 `s11.html` (the comment box types FREE, the DM bubble "Hey! Here are all 10 free Desk2Quant resources 🎯" on "DM", the profile card with no follower or like counts), restyled to the v3 light look.
- Bigger, chunkier and glossier, with the UI cards floating in 3D perspective with soft shadows.
- It must not imitate Instagram's branding.
- Camera: rise settle (y 80→0, scale 1.06→1), then a gentle hold.

## Check your work before you report
1. Run `cd /home/user/Films/d2q-promo && HYPERFRAMES_NO_TELEMETRY=1 timeout 300 npx --yes hyperframes@0.9.39 snapshot build --at <film times> --no-end --no-browser-gpu -o /home/user/Films/d2q-promo/out/snap_<your-name>`.
   - Use absolute `-o` paths.
   - Take 3–5 film times per scene: just after 0.3 s, on each key word, and near the end.
   - Other builders are editing other scenes at the same time. If a snapshot fails because of someone else's file, retry once after a minute.
2. Look at every still (Read the PNGs) and check:
   - nothing above y 560
   - overlays sit exactly on their anchors
   - text readable at phone size
   - the scene is moving on its first visible frame
   - the beat lands on its word
   - nothing looks generic or unfinished
3. Fix and re-snapshot until it holds up beside s1.
4. Report briefly: the files written, one line per scene on what it shows, any anchor you corrected, and the snapshot paths. Do not paste file contents. Disk is tight (about 2 GB free): delete your snapshot folders' PNGs except the final ones, and never copy the build folder.
