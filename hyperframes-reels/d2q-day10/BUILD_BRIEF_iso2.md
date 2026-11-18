# Day 10 isometric, round 2: every element shows exactly what the script says

The founder liked the isometric toy style but rejected the props as loose metaphors (a hedge garden for "hedge", a piggy bank, a seesaw, a trophy, a classroom, a booth). Every element must now be the literal thing the voice is talking about: the option contract, the share cubes, the price, the P&L columns, the price curve, the bell curve of daily moves, the year of daily P&L, the paths, implied versus realised vol. Most of it is drawn **in code as 3D isometric objects from the real numbers**.

**The project** is `/home/user/Films/d2q-day10/`, build `build_iso/`. These stay exactly as they are:
- scenes s1, s2, s14 and s16 (their dioramas fit the script)
- `bg.html`, `ov.html` and `index.html`
- the voice and the music

You rewrite only your assigned scenes. Each file currently holds a round-1 version (s4 holds a kit test); overwrite it, keeping its `/*DATA*/ … /*END*/` line exactly.

## Read first
1. `/home/user/Films/d2q-day10/BUILD_BRIEF_iso.md`: the look (Fredoka, colours, signboards, toy-like motion), the cube-flip transitions and the "Check your work" section. All of it still applies, except that most scenes now draw their objects in code instead of using a diorama plate.
2. `/home/user/Films/d2q-day10/BUILD_BRIEF_day10.md`, the Numbers table, and `work/numbers.json`. Every figure comes from there; embed what you need. Label simulated things "simulated".
3. `/home/user/Films/d2q-day10/work/scene_words.md`: every word of every scene with its onset (W indices).
4. **`/home/user/Films/d2q-day10/work/iso_kit.js`.** Copy it verbatim into your scene's script. It gives you:
   - `ISO.make(g, ox, oy, u)` returning `P(x,y,z)` (world to frame px), `box(x,y,z,w,d,h,mat)`, `poly`, `shadow`, `platform(x,y,w,d)` (the floating layered white/blue platform, its top at z = 0) and `faceMatrix(tl,tr,bl,w,h)` (a CSS matrix that maps a flat DOM element onto a box face)
   - materials `ISO.MAT.{white, blue, navy, sky, rose, gold, grey, wood}`
   - Draw back to front, sorted by (x + y) then z.
   - The reference setup is `ISO.make(g, 540, 900, 48)` with `platform(0, 0, 10, 10)`. It spans x 124–956 and y 900–1450 on screen; objects rise above it, and anything above y 560 is forbidden.
5. The kept scenes (s1, s2, s14, s16) and `/home/user/Films/d2q-day10/out/snap_isoall/` stills, to match the world.

## Rules for the code-built 3D
- One full-frame `<canvas>` (1080×1920) per scene, redrawn from timeline time through a proxy tween (`onUpdate`). Everything is a pure function of t; use a seeded mulberry32 if you need randomness.
- Objects sit on the platform and are made of toy-like flat-shaded boxes (the kit's materials), with soft shadows. Animate them like toys:
  - blocks drop in with a bounce
  - columns grow with `back.out` overshoot
  - cubes lift and slide in arcs
  - things squash when they land
- The camera bobs gently (y ±8 px) and pushes slowly. Wrap the canvas and labels in `#sN-cam` inside `#sN-flip`.
- **Numbers and labels are DOM signboards** (Fredoka 700, navy, white card with the blue extruded edge, rose edge for losses) placed at projected points `P(x,y,z)`.
  - Text on a box face is a DOM element mapped with `faceMatrix`, so it sits on that face.
  - Keep labels ≥ 30 px.
- Quantities must be honest: column heights proportional to the values (say what scale you used), and counts real (100 cubes = 1 share, 54 cubes = 0.54).
- Colours: gains and "good" in blue, losses and costs in rose, neutral in white/sky/grey, coins gold. **No green.**

## Scenes
Film windows are [start, duration]. **Bold** words get the caption's sticker pop, so land your beat on the same word.

**s3** [7.13, 6.9] "You own a **call.** The stock is at 100, the strike is 100, volatility is 20%, and it expires in one year."
- A 3D **CALL OPTION contract** stands on the platform: a thick white card (box) slightly angled, with a blue header band.
- Its front face carries the contract, mapped with `faceMatrix`.
- A blue "LONG ×1" stamp thumps on W[1] "own"; "CALL OPTION" lights on W[3].
- The rows fill on their words: Stock 100 (W[8]), Strike 100 (W[12]), Volatility 20% (W[15]), Expiry 1 year (W[21]).
- Then a footer "Price 7.97 · rates 0%".
- A small "STOCK 100" price block beside the card can hop on W[8].

**s4** [14.03, 4.95] "Its delta is **0.54,** so you hedge by shorting 0.54 shares."
- **100 blue share cubes** on the platform (10×10), labelled "100 cubes = 1 share".
- On W[3] a Δ meter signboard rolls to "Δ = 0.54" and **54 cubes turn rose**.
- On W[8] "shorting" those 54 lift and arc over onto a second small "SHORT" tray platform.
- "NET Δ = 0 ✓" lands on W[10].

**s5** [18.98, 6.9] "Now the stock jumps **2%.** The call gains 1.12, and the hedge loses 1.08. So you're **up.**"
- **Left:** a 3D **price step**, a "STOCK 100" block, and on W[3]–W[4] a step block rising to "102 · +2%" (blue).
- **Right:** three **P&L columns** growing from the platform:
  - CALL +1.12 in blue, on W[8]
  - HEDGE −1.08 in rose (height for the size, a minus label), on W[13]
  - NET +0.04 as a small blue column with a ✓, on W[16]
- Scale: 1.0 = 3 units (state it in a small note).

**s6** [25.88, 4.86] "If the stock drops 2% instead, you're still up. You win **both** ways. Why?"
- The same set, other direction:
  - the price steps down 100 → "98 · −2%" (rose) on W[3]–W[4]
  - CALL −1.04 (rose), HEDGE +1.08 (blue) and NET +0.04 (blue) grow on W[5]–W[8]
- On W[11] a "BOTH WAYS · +0.04" pill pops, with a faint ghost of the +2% case's NET column beside this one.
- A "?" bubble on W[13].
- No exit flip (tiles out).

**s7** [30.74, 8.39] "Because the call's price is a **curve,** not a straight line. When the stock rises, delta grows. When it falls, delta shrinks. That bend is **gamma.**"
- A 3D **wall chart** standing on the platform: the call price curve (`curve_S` 80–120, `curve_C`) as an extruded blue ribbon, drawing on with W[6].
- The **hedge line** (tangent at 100: slope 0.54 through (100, 7.97)) as a straight white plank, laid on W[9]–W[10]; the gap between them shades sky blue.
- A gold ball rolls to 102 and its tangent steepens: "Δ 0.58 at 102" (W[14]–W[16]). Then it rolls to 98: "Δ 0.50 at 98" (W[19]–W[21]).
- On W[25] a bend bracket and "Γ = 0.0198".
- Tile-cascade entrance (no flip in), flip out.

**s8** [39.13, 4.55] "But nothing is **free.** Every day, the call loses a little value. That's **theta.**"
- A tall blue **CALL value column** labelled "7.97".
- A rose "NOT FREE" tag on W[3].
- From W[4] its top slice peels off and drops away day by day ("Day 1, Day 2, Day 3", exaggerated thickness, with a note "slice = 0.0158 a day").
- A "TOMORROW 7.95" ghost outline beside it on W[8].
- A small code-drawn hourglass beside the column, with sand running.
- On W[13] "θ = −0.0158 / day".

**s9** [43.68, 3.3] "On a thousand calls, it costs you about **₹16** a day."
- A **stack of 1,000 calls** (ten stacks of thin white ticket slabs, "× 1,000 calls" on W[2]).
- A little register box prints a **receipt** that unrolls on W[5]: "DAILY RENT" / "1,000 calls × 0.0158" / "= ₹15.75 a day", with the total in rose and "≈ ₹16" on W[8].

**s10** [46.98, 5.24] "So when do you actually win? When the stock moves more than **1.26%** in a day, up or down."
- A 3D **bell curve of daily moves** (normal density, sd 1.26%, x from −4% to +4%) as an extruded ribbon wall on the platform:
  - the middle |move| < 1.26% filled rose, "RENT"
  - the two tails filled blue, "PAYS"
- The ±1.26% boundary posts rise on W[12] with "BREAKEVEN ±1.26% = σ/√252".
- A gold marker sits on a 0.5% day with "−₹13.33" from the start, then jumps to a 2% day on W[16]–W[18] with "+₹23.42". Both are per 1,000 calls.

**s11** [52.22, 3.96] "That's 20% divided by 16. Traders call it the rule of **16.**"
- 3D **number blocks** (toy blocks, numbers mapped on their faces) drop in: "20%" (W[1]), "÷" (W[2]), "16" (W[4]), then "=" "1.25%".
- On W[5] a smaller row: "√252 = 15.87 ≈ 16", and "exact: 20% ÷ √252 = 1.26%".
- "RULE OF 16" stamps on W[9]–W[11].
- No exit flip (tiles out).

**s12** [56.18, 4.95] "Now simulate a **year** of daily hedging. Big days pay you, and quiet days cost you rent."
- A **3D calendar of the simulated year** on the platform: 12 rows (months) × 21 columns (trading days) = 252 bars from `daily20` (₹ per 1,000 calls).
  - Height ∝ |P&L|, with a stated scale and a cap.
  - Blue if positive, rose if negative.
- The bars rise day by day from W[1] to W[6], with a "Day 1 … 252" counter.
- On W[7]–W[10] the 73 big days (`big_day_idx`) pulse up with "73 big days · 58 paid".
- On W[12]–W[16] the quiet days pulse rose with "179 quiet days · 139 cost".
- Label "One simulated year · 1,000 calls". Tile-cascade entrance, flip out.

**s13** [61.13, 6.4] "If the stock really moves 20% a year, you end up near **zero.** At 30%, you profit. At 10%, you lose."
- **Three 3D ribbons** over the year on the platform (x = day 0 → 252), each in its own lane, with a raised zero plane so losses go below it. Each ends with a signboard:
  - 20% (`mcum20`) in sky/grey, ending "+₹10" on W[12]
  - 30% (`mcum30`) in blue, ending "+₹3,964" on W[16]
  - 10% (`mcum10`) in rose, ending "−₹3,958" on W[20]
- Label "Mean of 2,000 simulated years · 1,000 calls · hedged daily".

**s15** [73.13, 3.01] "If the stock moves more than the volatility you paid for, you **win.**"
- Two 3D **columns**: "VOL YOU PAID 20%" (sky) and "HOW MUCH IT MOVED 30%" (blue, taller); the second grows on W[3] "moves".
- A formula signboard "Daily hedged P&L ≈ ½ Γ S² (move² − σ²/252)".
- On W[12] "win." a "MOVED > PAID → WIN ✓" stamp, with a small "+₹3,964 · mean, simulated, 1,000 calls" and seeded confetti.
- No exit flip (tiles out).

## Report
Report the files written, one line per scene, the scales you used, and the snapshot folder (`out/snap_iso2_<you>`). Delete everything else you created. Never mention how the film or its voice was made.
