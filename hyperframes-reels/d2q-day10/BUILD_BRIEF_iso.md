# Day 10 "gamma vs theta", isometric desk world: scene builder brief

This is a brand-new look for the Day 10/30 "Making Quant Easy" reel (84.0 s, 1080×1920): toy-like **isometric 3D dioramas** on floating cube platforms, in electric blue and white with warm wood and gold accents. Each idea gets its own diorama, with the real numbers built onto it.

**It must NOT look like the Desk2Quant promo.** Do not use any of these:
- the promo's dark/light alternation
- the pixel mosaic
- the green
- Bricolage-style heavy captions
- the promo's chip and card styles

The voice, script, numbers and timing are the same as the earlier Day 10 build.

**The project** is `/home/user/Films/d2q-day10/`. Work only in `build_iso/`.
- These are finished. **Do not edit them**, or `index.html`, `bg.html`, `ov.html` or `tools/`:
  - `compositions/bg.html`: a soft light-blue studio with drifting isometric cubes
  - `compositions/ov.html`: a white logo pill with "DAY 10/30", Fredoka captions where every word bounces in with a blue karaoke highlight, hero words that pop as big blue 3D stickers, and isometric tile-cascade wipes at the chapter cuts
- Write only your scene files `build_iso/compositions/sN.html`. Each placeholder already holds the right `/*DATA*/ const DUR …; const W […]; /*END*/` line; keep it exactly.

## Read first
- `/home/user/Films/d2q-promo/BUILD_BRIEF_v3.md`, sections "The contract", "Frame layout" and "Check your work". The HyperFrames rules are identical: one paused GSAP timeline, `fromTo` only, `immediateRender:false` on later tweens, no `Math.random` (seeded mulberry32), and canvas via a proxy tween. The caption zone y 150–540 stays clear.
- `/home/user/Films/d2q-day10/BUILD_BRIEF_day10.md`, the "Numbers" table. Every figure you show comes from it (or `work/numbers.json`, embedded). Label anything simulated "simulated".
- `/home/user/Films/d2q-day10/work/scene_words.md`: every word of every scene with its scene-relative onset (W index = position in that list).
- Your dioramas, `build_iso/assets/plates/iNN.png` (768×1376 RGBA cutouts). **Look at each one** and measure the surfaces you draw on.

## The look (new design system)
- **The diorama:** `<img id="sN-dio" src="assets/plates/iNN.png">` at `left:0; top:-8px; width:1080px; height:1935px` (scale 1.40625). Plate px (px, py) maps to frame (1.40625·px, 1.40625·py − 8).
- **Font:** Fredoka (rounded, playful). Copy ov.html's four `@font-face` lines. Use the stack `"Fredoka","D2QSans","JetBrains Mono",sans-serif`; the fallbacks supply ₹ and Greek. Weights 700 for everything you show, 400 only for small labels.
- **Colours:**
  - navy text #0b1b3a
  - electric blue #2563eb (edge #1e40af) and light #3b82f6 / #93c5fd / #dbeafe
  - white
  - gains and "good" in blue; losses and costs in rose #e11d48 (edge #9f1239)
  - coins gold #f59e0b
  - no green anywhere
- **Signboards** (all numbers and labels): white rounded cards (radius 22–28 px) with a thick extruded bottom edge, `box-shadow: 0 10px 0 #2563eb, 0 24px 36px rgba(30,64,175,0.22)` (rose edge for losses). Fredoka 700, navy, numbers large (40–90 px). Pills are fully rounded.
- **Motion is toy-like:**
  - Things pop in with `back.out(2.5–3)`, land with a squash (scaleY 0.85 → 1) and hop on their beat.
  - The diorama bobs gently (y ±8 px over ~3 s) and the camera pushes slowly (scale 1 → 1.04).
  - No blur-in, no glow-slams, no shockwaves; the promo used those.
- **Drawing on a diorama surface** (whiteboard, screen, display board, calendar page, phone screen, gauge dial, calculator display, signboard): an isometric view is a parallel projection, so map your flat content onto the surface with a CSS `matrix(a,b,c,d,e,f)` computed from three measured corners of that surface (top-left, top-right, bottom-left in frame px). Build the content at a convenient flat size and transform it. Keep text big enough to read after the skew (≥ 30 px before the transform for labels, larger for numbers).

## Transitions: the cube flip (your scene does its own)
Put everything inside `#sN-flip` (diorama + overlays + camera wrapper), and give `#root` `perspective: 2400px; perspective-origin: 540px 1150px`. `#sN-flip` gets `transform-origin: 540px 1150px`.

- **Entrance** (scenes s2–s6, s8–s11, s13–s15):
  `tl.fromTo("#sN-flip", { rotationY: -90, scale: 0.94 }, { rotationY: 0, scale: 1, duration: 0.36, ease: "power3.out" }, 0);`
- **Exit** (every scene except s6, s11, s15 and s16):
  `tl.fromTo("#sN-flip", { rotationY: 0 }, { rotationY: 90, duration: 0.26, ease: "power2.in", immediateRender: false }, DUR - 0.26);`
- **s7, s12, s16** start under the overlay's tile cascade. They enter with `scale 1.1 → 1` and `opacity 0 → 1` over 0.35 s instead of a flip.
- **s6, s11, s15** end under a tile cascade, so they have no exit flip.
- **s1** opens the film moving from frame 1: the diorama drops in from above (y −700 → 0, `back.out(1.6)`, about 0.6 s) and lands with a squash.

## Scenes
Film windows are [start, duration]. Bold words get the caption's sticker pop at that moment, so the scene's own beat lands on the same word. Use the W indices from `scene_words.md`.

- **s1** [0, 1.86] i01 trading desk. "You know how to **delta-hedge.**"
  - Map a position panel onto the monitor screens: "Long 1 call Δ +0.54", "Short 0.54 sh Δ −0.54", "Net Δ" rolling to 0.00.
  - A blue "HEDGED ✓" pill pops above the desk on W[4].
- **s2** [1.86, 5.27] i02 interview room. "Then the interviewer asks: your hedge is perfect, so why does your P&L still **move** every day?"
  - A white speech-bubble signboard floats above the room with a small blue "INTERVIEWER" tag (on W[3]). The question reveals word by word with the voice: "Your hedge is perfect." / "Why does your P&L still move every day?".
  - On W[14] "move", a small ticker pill near the desk flips +₹23.42 → −₹13.33 → +₹24.53, labelled "daily P&L · 1,000 calls". Rose for the negative.
- **s3** [7.13, 6.9] i03 options booth. "You own a **call.** The stock is at 100, the strike is 100, volatility is 20%, and it expires in one year."
  - On the booth's display board, mapped: "CALL OPTION" on W[3], then the rows Stock 100 (W[8]), Strike 100 (W[12]), Volatility 20% (W[15]), Expiry 1 year (W[21]), then "Price 7.97 · rates 0%".
  - A paper ticket pops out of the printer on W[3].
- **s4** [14.03, 4.95] i04 hedge garden. "Its delta is **0.54,** so you hedge by shorting 0.54 shares."
  - On the garden signboard, mapped: "Δ = 0.54" rolls up and lands on W[3].
  - The hedge wall gives a protective blue pulse on W[6] "hedge".
  - A rose pill "SHORT 0.54 SHARES" on W[8], then a blue "NET Δ = 0 ✓" pill on W[10].
- **s5** [18.98, 6.9] i05 staircase and arrow. "Now the stock jumps **2%.** The call gains 1.12, and the hedge loses 1.08. So you're **up.**"
  - The arrow hops on W[3]–W[4] with a "+2%" bubble at its tip.
  - A ledger signboard: "Call +1.12" in blue (W[8]), "Hedge −1.08" in rose (W[13]), a rule, then "Net +0.04 ✓" bold blue (W[16]).
- **s6** [25.88, 4.86] i06 seesaw with coins. "If the stock drops 2% instead, you're still up. You win **both** ways. Why?"
  - The coin on each end gets a label pill: left "+2% → +0.04", right "−2% → +0.04" (on W[3]–W[8]), with small "call −1.04 · hedge +1.08".
  - The whole seesaw rocks a few degrees each way about its pivot.
  - "BOTH WAYS ✓" pops on W[11]; a "?" bubble on W[13]. No exit flip.
- **s7** [30.74, 8.39] i07 classroom. "Because the call's price is a **curve,** not a straight line. When the stock rises, delta grows. When it falls, delta shrinks. That bend is **gamma.**"
  - Draw the chart ON the whiteboard, affine-mapped:
    - axes for stock 80–120
    - the price curve (`curve_S`/`curve_C`) drawing on with W[6]
    - the hedge line (slope 0.54 through (100, 7.97)) on W[9]–W[10]
    - the gap shaded light blue
    - "Δ 0.58 at 102" (W[14]–W[16]), "Δ 0.50 at 98" (W[19]–W[21])
    - "Γ = 0.0198" on W[25]
  - Tile-cascade entrance.
- **s8** [39.13, 4.55] i08 hourglass room. "But nothing is **free.** Every day, the call loses a little value. That's **theta.**"
  - Blue sand grains fall through the hourglass neck from the start (seeded particles).
  - A rose tag "NOT FREE" swings on W[3].
  - A signboard "CALL 7.97 → 7.95" with "−0.0158 a day" on W[8].
  - On W[13] a big pill "θ = −0.0158 / day".
- **s9** [43.68, 3.3] i09 piggy bank. "On a thousand calls, it costs you about **₹16** a day."
  - Gold coins keep spilling (code circles, seeded).
  - "× 1,000 calls" pill on W[2].
  - A rose signboard "−₹15.75 a day" with "≈ ₹16" on W[8].
- **s10** [46.98, 5.24] i10 control room with a blank gauge. "So when do you actually win? When the stock moves more than **1.26%** in a day, up or down."
  - On the gauge dial, mapped: a rose zone 0 → 1.26% "RENT" and a blue zone 1.26 → 3% "PAYS", ticks 0% / 1.26% / 3%.
  - The needle rests at 0.5% with "−₹13.33", swings to 1.26% on W[12] ("BREAKEVEN 1.26% = σ/√252"), then to 2% on W[16]–W[18] ("+₹23.42 · 2% day").
- **s11** [52.22, 3.96] i11 calculator. "That's 20% divided by 16. Traders call it the rule of **16.**"
  - The display, mapped, builds "20%" (W[1]), "÷ 16" (W[2]–W[4]), "= 1.25%".
  - The matching keys light and press as their terms are spoken.
  - A signboard "exact: 20% ÷ √252 = 1.26%" on W[5].
  - A big blue sticker-stamp "RULE OF 16" on W[9]–W[11]. No exit flip.
- **s12** [56.18, 4.95] i12 calendar office. "Now simulate a **year** of daily hedging. Big days pay you, and quiet days cost you rent."
  - The calendar page, mapped, rolls "Day 1 … Day 252" from W[1] to W[6].
  - The computer screen or a floating signboard draws the 252 daily P&L bars (`daily20`), labelled "One simulated year · 1,000 calls".
  - The 73 big days (`big_day_idx`) flash blue with "73 big days · 58 paid" (W[7]–W[10]); the quiet days flash rose with "179 quiet days · 139 cost" (W[12]–W[16]).
  - Tile-cascade entrance.
- **s13** [61.13, 6.4] i13 presentation room. "If the stock really moves 20% a year, you end up near **zero.** At 30%, you profit. At 10%, you lose."
  - On the projection screen, mapped: `mcum20` in grey ending "+₹10" on W[12], `mcum30` in blue ending "+₹3,964" on W[16], `mcum10` in rose ending "−₹3,958" on W[20].
  - Label "Mean of 2,000 simulated years · 1,000 calls · hedged daily"; x axis days 0–252.
- **s14** [67.53, 5.6] i14 balance scale. "So here's the answer: a delta-hedged call is a bet on **volatility.** Gamma **earns,** theta eats."
  - A pill "a bet on volatility" appears on W[9]–W[11].
  - Two toy blocks drop onto the pans with a bounce on W[11]: "Γ GAMMA" (blue) and "Θ THETA" (rose).
  - "earns on big moves" (blue) on W[12]–W[13]; "eats every day" (rose) on W[14]–W[15].
  - "at the vol you paid, they balance" under the platform. The music drops on W[12].
- **s15** [73.13, 3.01] i15 trophy podium. "If the stock moves more than the volatility you paid for, you **win.**"
  - A formula signboard "Daily hedged P&L ≈ ½ Γ S² (move² − σ²/252)"; "move²" highlights blue on W[3], "σ²/252" highlights rose on W[7]–W[10].
  - On W[12], confetti bursts from the trophy (seeded) and a "> 0 → WIN ✓" pill pops. No exit flip.
- **s16** [76.14, 7.86] i16 smartphone. "Comment GREEKS, and we'll DM you the free Greeks Cheat Sheet. Save this, share it, and follow Desk2Quant for Day 11."
  - On the phone screen, mapped: a comment box types "GREEKS" (W[0]–W[1]). On W[4] "DM" a DM bubble "Hey! Here's your free Greeks Cheat Sheet 🎯" arrives with the real cover `assets/covers/greeks-cheat-sheet.jpg`.
  - Above the phone, pills "SAVE" (W[11]), "SHARE" (W[13]) and "FOLLOW" (W[16]) pop in turn.
  - The profile signboard appears on W[17]: real logo, "Desk2Quant", "@desk2quant", "desk2quant.com", with no counts.
  - A "DAY 11 →" sticker lands on W[19]–W[20].
  - Hold the full end card for the last 2 s. Tile-cascade entrance.

## Check your work
Snapshot with:

`cd /home/user/Films/d2q-day10 && HYPERFRAMES_NO_TELEMETRY=1 timeout 300 npx --yes hyperframes@0.9.39 snapshot build_iso --at <film times> --no-end --no-browser-gpu -o /home/user/Films/d2q-day10/out/snap_iso_<you>`

- Check 3–5 film times per scene: right after the entrance, on the key words, and just before the exit.
- Check that:
  - nothing is above y 560
  - mapped content sits exactly on its surface
  - every number reads at phone size
  - the flip in and out works
  - the scene doesn't look like the promo
- Report briefly: the files written, one line per scene, any surface corners you measured, and the snapshot folder.
- Delete everything but your final stills.
- Never mention how the film or its voice was made.
