# Day 10 "gamma vs theta" in the promo's look: scene builder brief

This rebuilds the Day 10/30 "Making Quant Easy" reel (84.0 s, 1080×1920) in the look of the Desk2Quant promo. The script and every number stay as they were.
- **The look:** light and charcoal scenes alternating, a green glow, a breathing pixel mosaic, glossy 3D prop cutouts, huge captions with a hero-word slam, and pixel wipes.
- **The voice:** one continuous male promo read. It is already recorded and timed.

**The project** is `/home/user/Films/d2q-day10/`.
- `build/compositions/bg.html` and `ov.html` (background, captions and logo bar with a "DAY 10/30" tag, wipes) are finished. **Do not edit them**, or `index.html` or `tools/`.
- You write only your scene files, `build/compositions/sN.html`. Each is a placeholder now; overwrite it, keeping its `/*DATA*/ … /*END*/` line exactly as it is (it already holds the right DUR and W).

## Read first
1. `/home/user/Films/d2q-promo/BUILD_BRIEF_v3.md`. Its sections "The contract", "Frame layout", "The plates" (standard placement), "Look tokens", "Camera", "Data rules" and "Check your work" apply here unchanged. Only the project path and the snapshot folder differ.
2. The finished promo scenes in `/home/user/Films/d2q-promo/build/compositions/` as the quality bar and as code to adapt. Patterns:
   - s1: content on a tablet screen
   - s4: a 3D-tilted dark notebook card with a canvas chart and a rolling readout
   - s6: a gauge needle
   - s9: a code editor on the laptop
   - s14: the coin flip, with the coin and pedestal split into two layers
   - s15: the comment / DM / profile CTA
3. The plates you use, in `build/assets/plates/`. Look at each one.
   - Promo plates: `p01` tablet, `p02` shield, `p05` gauge, `p08` laptop, `p12` coin.
   - New cutouts: `d01` spotlit interview chair, `d02` green up-arrow, `d03` hourglass, `d04` gold coin stacks, `d05` balance scale, `d06` desk calendar.
4. `work/numbers.json`. It holds all the numbers and arrays; **embed** what you need into the scene's script, because no fetches are allowed.

## Anchors at the standard placement
The plate is `left:-40px; top:500px; 1160×1160`, so frame = (−40 + 1.1328·px, 500 + 1.1328·py). Verify each anchor in a snapshot.

| plate | anchors (frame px) |
|---|---|
| p08 laptop (L) | screen x 222–858, y 770–1184 |
| p01 tablet (L) | screen x 279–801, y 713–1403 |
| p02 shield (D) | glyph centre (540,1008); shield x 250–830, y 717–1442 |
| p12 coin (D) | face centre ≈ (534,1058), radius ≈ 272×256; the coin and pedestal split along y 1428 plus the coin outline (see promo s14) |
| p05 gauge (D) | dial centre (540.5,1036), dial radius 283; its printed arc runs green (low, lower-left) → amber (top) → red (high, lower-right) |
| d01 chair (D) | chair x 282–798, y 951–1466; seat centre ≈ (491,1225); side table top ≈ (926,1251); the spotlight cone fills x 300–780, y 560–950 |
| d02 up-arrow (L) | arrow tip ≈ (846,725), arrow base ≈ (346,1338), pedestal top centre ≈ (427,1363) |
| d03 hourglass (D) | centre (540,1080); top bulb y 710–1047, bottom bulb y 1112–1466, glass x 345–742; base y ≈ 1515 |
| d04 coins (L) | stacks x 315–814, top y ≈ 822, pedestal top y ≈ 1321 |
| d05 scale (D) | beam y ≈ 806 (pivot x 540); left pan centre (218,1234), right pan centre (846,1234), pan half-width ≈ 137; base y ≈ 1419 |
| d06 calendar (D) | front page ≈ x 345–708, y 862–1338 (it leans back a little; the top pages curl at the upper right); rings y ≈ 725–795; pedestal y ≈ 1395–1475 |

## Numbers (from `work/numbers.json`; show only these, rounded as written)
| Quantity | Value |
|---|---|
| The call | S 100, K 100, σ 20%, T 1 year, r 0%; price 7.97 (7.9656) |
| Greeks | delta 0.54 (0.5398); gamma 0.0198 (0.019848) |
| Theta | −0.0158 a day (decay_day −0.015768); tomorrow's price 7.95 (7.9498) |
| +2% day | call +1.12, hedge −1.08, net +0.04 |
| −2% day | call −1.04, hedge +1.08, net +0.04 |
| Delta after a move | 0.58 at 102, 0.50 at 98 |
| Per 1,000 calls | rent ₹15.75 a day (the voice says "about ₹16"); a +2% day +₹23.42; a −2% day +₹24.53; a 0.5% day −₹13.33 |
| Breakeven daily move | σ/√252 = 1.26% (1.2599%); rule of 16: 20% ÷ 16 = 1.25% |
| One simulated year, 1,000 calls (`daily20`, 252 values) | `big_day_idx` (73 big days); 58 of them paid; 179 quiet days, 139 of which cost |
| Mean of 2,000 simulated years, 1,000 calls, hedged daily | 10% vol −₹3,958; 20% +₹10; 30% +₹3,964. Paths: `mcum10`, `mcum20`, `mcum30`, 253 points |
| Price curve | `curve_S` / `curve_C`, 161 points from 80 to 120 |
| Formula | daily hedged P&L ≈ ½·Γ·S²·(move² − σ²/252) |

- Label anything simulated "simulated" on screen.
- Use ₹ with Indian digit grouping as above.

## Scenes
Film windows are [start, duration]. W is scene-relative word onsets (see `work/scene_words.md` for every word with its time). **Bold** words get the caption's giant hero slam at that moment, so the scene's own beat lands on the same word.

**s1** L [0, 1.86] p08 laptop. "You know how to **delta-hedge.**" W: 0 You −0.06, 1 know 0.32, 2 how 0.6, 3 to 0.82, 4 delta-hedge 0.98.
- The hook moves from frame 1.
- On the laptop screen, a dark position panel "hedge.py":
  - "Long 1 call · Δ +0.54"
  - "Short 0.54 shares · Δ −0.54"
  - "Net Δ 0.00", which ticks to 0.00 with a green "HEDGED ✓" chip on W[4].
- Camera: fast pull-back settle, like promo s1.

**s2** D [1.86, 5.27] d01 chair. "Then the interviewer asks: your hedge is perfect, so why does your P&L still **move** every day?" W in `scene_words.md`.
- A dark glass question card floats in the spotlight above the chair (inside y 600–930).
  - A small green label "INTERVIEWER" appears on W[3] "asks:".
  - The question reveals with the voice: "Your hedge is perfect." then "Why does your P&L still move every day?".
- On "move" (W[14]), a P&L ticker chip beside the card flips through +₹23.42 → −₹13.33 → +₹24.53, labelled "daily P&L · 1,000 calls".
- Camera: settle, then a slow dramatic push toward the chair.

**s3** L [7.13, 6.9] p01 tablet. "You own a **call.** The stock is at 100, the strike is 100, volatility is 20%, and it expires in one year."
- On the tablet, a trade ticket. The header "CALL OPTION" lands on W[3].
- Rows fill in on their words: Stock 100 (W[8]), Strike 100 (W[12]), Volatility 20% (W[15]), Expiry 1 year (W[21]).
- Then a smaller row "Price 7.97 · rates 0%".
- Camera: slide-in settle from the right, then a slow push.

**s4** D [14.03, 4.95] p02 shield. "Its delta is **0.54,** so you hedge by shorting 0.54 shares."
- A big Δ glyph on the glass, drawn as SVG (D2QSans has no Greek).
- The readout "Δ = 0.54" rolls up 0.00 → 0.54 and lands on W[3].
- "SHORT 0.54 SHARES" (rose accent) slides in on W[8] "shorting".
- "NET Δ = 0 ✓" (green) lands on W[10].
- Camera: drop-in settle, then a slow push.

**s5** L [18.98, 6.9] d02 up-arrow. "Now the stock jumps **2%.** The call gains 1.12, and the hedge loses 1.08. So you're **up.**"
- The arrow punches up on W[3]–W[4], with a "STOCK +2%" chip at its tip.
- A white ledger card slides in at the lower left:
  - "Call +1.12" in green on W[8]
  - "Hedge −1.08" in rose on W[13]
  - a rule line
  - "Net +0.04 ✓" in green, bold, on W[16] "up."
- Camera: rise settle, then a slow push.

**s6** D [25.88, 4.86] p12 coin. "If the stock drops 2% instead, you're still up. You win **both** ways. Why?"
- Coin face A: "+2%" (green) with "net +0.04".
- On W[3] "drops" it flips to face B: "−2%" (rose) with "net +0.04" (green), plus small "call −1.04 · hedge +1.08".
- On W[11] "both" it spins fast through both faces and a green "BOTH WAYS ✓" stamp pops.
- On W[13] "Why?" a big glass "?" pops.
- Use promo s14's two-layer coin.
- Camera: settle, then promo s14's slow drift.

**s7** L [30.74, 8.39] no plate. A light chart card, about 920×1000, tilted in 3D (promo s4's construction, light theme). "Because the call's price is a **curve,** not a straight line. When the stock rises, delta grows. When it falls, delta shrinks. That bend is **gamma.**"
- The axes: stock price 80–120 on x, call value on y.
- The curve (`curve_S`/`curve_C`) draws on with W[6] "curve,".
- The hedge line (the tangent at 100, slope 0.54, through (100, 7.97)) draws on W[9]–W[10].
- The gap between them shades green.
- A dot slides to 102 with a steeper tangent and "Δ 0.58 at 102" (W[14]–W[16]), then to 98 with "Δ 0.50 at 98" (W[19]–W[21]).
- On W[25] "gamma." a bend bracket and "Γ = 0.0198".
- Camera: settle, then a slow push and slight orbit.

**s8** D [39.13, 4.55] d03 hourglass. "But nothing is **free.** Every day, the call loses a little value. That's **theta.**"
- Falling green sand grains run through the neck from the start (code-drawn particles, seeded).
- On W[3] "free." a tag "NOT FREE" swings in.
- On W[8] "loses" a readout "7.97 → 7.95" with "−0.0158 a day".
- On W[13] "theta." a big chip "θ = −0.0158 / day".
- Camera: settle, then a slow push into the glass.

**s9** L [43.68, 3.3] d04 coins. "On a thousand calls, it costs you about **₹16** a day."
- Chip "× 1,000 calls" on W[2].
- On W[5] "costs" a few coin shapes slide off the tallest stack and fall away.
- On W[8] a rose readout "−₹15.75 a day" with a small "≈ ₹16".
- Camera: tilt settle, then hold.

**s10** D [46.98, 5.24] p05 gauge as a daily-move meter. "So when do you actually win? When the stock moves more than **1.26%** in a day, up or down."
- Paint your own arc over the plate's printed colour band:
  - 0% → 1.26% in rose, "RENT"
  - 1.26% → 3% in green, "PAYS"
- Ticks labelled 0%, 1.26% (bold), 3%.
- The needle rests at 0.5% with "−₹13.33" from the start.
- It sweeps to the 1.26% tick on W[12] with "BREAKEVEN 1.26%" and "σ/√252".
- It swings to 2% on W[16]–W[18] with "+₹23.42 · 2% day".
- Camera: settle 0.94 → 1, then a slow push to the dial.

**s11** L [52.22, 3.96] no plate. A big glossy calculator-style light card (3D tilt, shadow). "That's 20% divided by 16. Traders call it the rule of **16.**"
- Giant type builds term by term: "20%" (W[1]), "÷ 16" (W[2]–W[4]), "= 1.25%".
- A small line "exact: 20% ÷ √252 = 1.26%" appears on W[5].
- A green "RULE OF 16" badge stamps on W[9]–W[11].
- Camera: zoom-out settle.

**s12** D [56.18, 4.95] d06 calendar. "Now simulate a **year** of daily hedging. Big days pay you, and quiet days cost you rent."
- From W[1] to W[6] the calendar's front page shows a day counter rolling "Day 1 … Day 252" (skewed slightly to sit on the page), with quick page-flip flashes.
- A strip chart of the 252 daily P&L bars (`daily20`) draws left to right in a dark glass panel below the calendar or above it, under y 560. Label it "One simulated year · 1,000 calls".
- On W[7]–W[10] the big-day bars (`big_day_idx`) flash green with "73 big days · 58 paid".
- On W[12]–W[16] the quiet-day bars flash rose with "179 quiet days · 139 cost".
- Camera: settle, then a slow push.

**s13** L [61.13, 6.4] no plate. A light chart card, tilted in 3D. "If the stock really moves 20% a year, you end up near **zero.** At 30%, you profit. At 10%, you lose."
- Three mean running-P&L paths draw on in turn:
  - `mcum20` in grey on W[5], ending at "+₹10" on W[12]
  - `mcum30` in green on W[14], ending at "+₹3,964" on W[16]
  - `mcum10` in rose on W[18], ending at "−₹3,958" on W[20]
- The x axis is days 0–252.
- Label it "Mean of 2,000 simulated years · 1,000 calls · hedged daily".
- Camera: rise settle, then a slow push.

**s14** D [67.53, 5.6] d05 balance scale. "So here's the answer: a delta-hedged call is a bet on **volatility.** Gamma **earns,** theta eats." The music drops on W[12] "Gamma".
- On W[11] two glossy weights land on the pans: left "Γ GAMMA" (green), right "Θ THETA" (rose).
- The scale stays level.
- On W[12]–W[13] the left side glows green with "earns on big moves".
- On W[14]–W[15] the right side glows rose with "eats every day".
- A small line "at the vol you paid, they balance" sits under the base.
- Camera: settle, then a slow push. Add a punch on W[12].

**s15** L [73.13, 3.01] no plate. A glossy light formula card. "If the stock moves more than the volatility you paid for, you **win.**"
- The card shows "Daily hedged P&L ≈ ½ Γ S² (move² − σ²/252)".
- "move²" highlights on W[3].
- "σ²/252" highlights on W[7]–W[10].
- On W[12] the bracket turns green with "> 0 → WIN ✓".
- Camera: quick settle.

**s16** D [76.14, 7.86] no plate. Promo s15's CTA ported to the dark theme: glass cards, green accents. "Comment GREEKS, and we'll DM you the free Greeks Cheat Sheet. Save this, share it, and follow Desk2Quant for Day 11."
- The comment box types "GREEKS" (W[0]–W[1]).
- On W[4] "DM" the DM bubble arrives: "Hey! Here's your free Greeks Cheat Sheet 🎯", with the real cover `assets/covers/greeks-cheat-sheet.jpg`.
- Pills "SAVE" (W[11]), "SHARE" (W[13]) and "FOLLOW" (W[16]) pop in turn.
- On W[17] the profile card appears: real logo, "Desk2Quant", "@desk2quant", "desk2quant.com", with no counts.
- A badge "DAY 11 →" lands on W[19]–W[20].
- Hold the full end card for the last 2 s.
- Camera: rise settle, then hold.

## Check your work
Follow the promo brief's checks. Snapshot with:

`cd /home/user/Films/d2q-day10 && HYPERFRAMES_NO_TELEMETRY=1 timeout 300 npx --yes hyperframes@0.9.39 snapshot build --at <film times> --no-end --no-browser-gpu -o /home/user/Films/d2q-day10/out/snap_<you>`

- Use film time = start + W.
- Report briefly: the files written, one line per scene, any anchor you corrected, and the snapshot folder.
- Delete everything but your final stills.
- Never mention how the film or its voice was made.
