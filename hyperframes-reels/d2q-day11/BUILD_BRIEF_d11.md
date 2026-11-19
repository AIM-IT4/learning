# Day 11 "the volatility smile", isometric toy world: scene builder brief

Day 11/30 of "Making Quant Easy" (about 85 s, 1080×1920), in **exactly the look of the Day 10 isometric reel**: toy-like
isometric 3D objects drawn in code on floating white-and-blue platforms, electric blue and white with wood and gold
accents, rose for losses, crashes and costs, **no green anywhere**. Every object is the literal thing the voice is talking
about, built in code from the real numbers below. No loose metaphors: no gardens, piggy banks, seesaws, trophies,
classrooms, seismographs or dice.

**The project** is `/home/user/Films/d2q-day11/`. You write only your own scene files `compositions/sN.html`.
- Each placeholder already holds the right `/*DATA*/ const DUR = …; const W = […]; /*END*/` line. Keep it exactly
  (tools/timing_d11.py rewrites it).
- Do not edit `index.html`, `bg.html`, `ov.html`, `mc.html`, `tools/`, `work/` or other builders' scenes.

## Read first
1. `ref/promo_BUILD_BRIEF.md`, section "The contract" (HyperFrames 0.9.39 rules: one `<template>`; ids and classes
   prefixed `sN-`; one paused GSAP timeline registered as `window.__timelines["sN"]`; `fromTo` only; `immediateRender:false`
   on later tweens of the same property; no `Math.random`/`Date`/timers, seeded mulberry32 instead; canvas redrawn from a
   proxy tween `tl.fromTo(st,{t:0},{t:DUR,duration:DUR,ease:"none",onUpdate:draw},0)`; no CSS `transform` on an element
   GSAP transforms; asset paths `assets/...`; no audio in scenes).
2. `ref/BUILD_BRIEF_iso.md`: the look (Fredoka, colours, signboards, toy motion), the cube-flip transitions and "Check
   your work". `ref/BUILD_BRIEF_iso2.md`: the rules for code-built 3D (all of it applies; every scene here is code-built,
   there are no diorama plates).
3. `work/iso_kit.js`. Copy it verbatim into your scene's script. `ISO.make(g, ox, oy, u)` gives `P(x,y,z)`, `box`, `poly`,
   `shadow`, `platform(x,y,w,d)` (top at z = 0) and `faceMatrix(tl,tr,bl,w,h)`; materials `ISO.MAT.{white, blue, navy,
   sky, rose, gold, grey, wood}`. Draw back to front, sorted by (x + y) then z. Reference setup: `ISO.make(g, 540, 900, 48)`
   with `platform(0, 0, 10, 10)` spans x 124–956, y 900–1450 on screen.
4. The finished Day 10 scenes in `ref/day10/` are the quality bar and code to adapt: s4 (100 share cubes), s5 (price step
   and P&L columns with honest scale), s7 (wall chart with a ribbon curve), s10 (bell curve wall with zones and posts),
   s11 (number blocks with text mapped on faces), s12 (252 bars rising day by day), s13 (three ribbons over a year),
   s15 (two columns and a formula board), s16 (CTA: comment, DM bubble, SAVE/SHARE/FOLLOW, profile, DAY → sticker).
   Note: s1, s2, s14 and s16 there used image plates; here everything is drawn in code.
5. `work/numbers.json` (made by `work/smile.py`). Embed what you need; no fetches.
6. `work/scene_words.md`: every word of every scene with its scene-relative onset (W index = position in the list).

## The look (same as Day 10)
- **Font:** Fredoka. Copy the four `@font-face` lines from `ref/day10/s5.html` (paths `assets/fonts/...` all exist).
  Stack `"Fredoka","D2QSans","JetBrains Mono",sans-serif`; Fredoka has no Greek, so σ comes from D2QSans, which is fine.
  Weight 700 for everything you show, 400 only for small notes. Labels at least 30 px, numbers 40–90 px.
- **Colours:** navy text #0b1b3a; electric blue #2563eb (edge #1e40af), light #3b82f6 / #93c5fd / #dbeafe; white; rose
  #e11d48 (edge #9f1239) for crashes, losses and costs; gold #f59e0b for a marker ball or coin; wood for desks. No green.
- **Signboards** (every number and label): white rounded cards (radius 22–28 px), `box-shadow: 0 10px 0 #2563eb,
  0 24px 36px rgba(30,64,175,0.22)` (rose edge for crashes/losses), Fredoka 700 navy. Pills fully rounded.
- **Toy motion:** pop-in with `back.out(2.5–3)` and a squash on landing (scaleY 0.85 → 1); columns grow with overshoot;
  blocks drop in with a bounce; cubes lift and slide in arcs; the camera bobs gently (y ±8 px over ~3 s) and pushes
  slowly (scale 1 → 1.04). No blur-ins, glow slams or shockwaves.
- **Honest quantities:** heights proportional to the values (state the scale in a small note), counts real.
- Label anything simulated "simulated" and anything illustrative "illustrative".

## Rows of strikes (s1, s2, s10, s11, s12, s13)
A row laid along an isometric axis crowds on screen (one unit along x moves only 42 px sideways). Lay a row of the
nine strikes along the screen-horizontal diagonal instead: strike i (80, 85, …, 120 → i = 0…8) at world (1 + i, 9 − i),
so every item sits on the same screen line, 83 px apart (with `ISO.make(g, 540, 900, 48)`: screen x 207 … 873, y 1140).
Columns standing there do not overlap each other; draw them in order of x. Strike labels are small camera-facing DOM
pills placed at `P(x_i + 0.6, y_i + 0.6, 0)` (just in front), ≥ 30 px text, about 70 px wide. Use the same row in every
scene that shows strikes, so the columns of s1 (flat), s11 (the smile) and s12–s13 read as the same set.

## Frame layout
- Logo pill y 40–106 and caption zone y 150–540: **nothing of yours above y 560 at any moment**, camera moves included.
- Stage y 560–1700: the platform and its signboards. Fill it: no empty bottom band. Put small notes/scale labels around
  y 1480–1680 under the platform.
- The guide (a trader on his own tile) stands in the **lower right, x 760–1060, y 1480–1920**. Keep signboards and
  important objects out of that box; left-align notes or keep them in x 60–740 when they sit below y 1480.
- Key text inside x 60–1020. Land key beats between 0.3 s and DUR − 0.25 (the cuts cover the edges).

## Transitions (your scene does its own)
Everything inside `#sN-flip` → `#sN-cam` → `#sN-bob`. `#root { perspective: 2400px; perspective-origin: 540px 1150px }`,
`#sN-flip { transform-origin: 540px 1150px }`.
- **Entrance by cube flip** (s2, s3, s4, s5, s6, s8, s10, s11, s13):
  `tl.fromTo("#sN-flip", { rotationY: -90, scale: 0.94 }, { rotationY: 0, scale: 1, duration: 0.36, ease: "power3.out" }, 0);`
- **Entrance under the tile cascade** (s7, s9, s12, s14): `scale 1.1 → 1` and `opacity 0 → 1` over 0.35 s.
- **Exit flip** (every scene except s6, s8, s11, s13 and s14):
  `tl.fromTo("#sN-flip", { rotationY: 0 }, { rotationY: 90, duration: 0.26, ease: "power2.in", immediateRender: false }, DUR - 0.26);`
  s6, s8, s11 and s13 end under a tile cascade, so they have no exit flip; s14 is the end card.
- **s1** opens the film moving from frame 1: its platform drops in from above (y −700 → 0, `back.out(1.6)`, ~0.6 s) and
  lands with a squash.

## Numbers (from `work/numbers.json`; show only these, rounded as written)
| Quantity | Value | json |
|---|---|---|
| S&P 500 closes | Fri 16 Oct 1987: 282.70; Mon 19 Oct 1987: 224.84; −57.86 points, **−20.47%** | `crash` |
| A typical day at 20% volatility | 20% ÷ √252 = **1.26%** (one standard deviation of a day) | `normal.sd_day_pct` |
| The crash in typical days | 20.47% ÷ 1.26% = **16.2σ** ("a 16-sigma day") | `normal.z` |
| Chance of a day that bad on a normal curve | **≈ 10⁻⁵⁹ a day** (log10 = −58.9) | `normal.log10_p` |
| Days that bad expected since the Big Bang (13.8 billion years × 252 days) | **≈ 4 × 10⁻⁴⁷**, i.e. none | `normal.log10_expected_since_big_bang` |
| Bell curve of daily moves | x −5%…+5%; `normal` = normal curve, sd 1.26%; `fat` = an illustrative fat-tailed curve with the same 1.26% spread (Student-t, 3 degrees of freedom) | `bell` |
| Days worse than −4σ, per year (illustrative) | normal 0.008 (about once in 125 years); fat-tailed 0.78; **about 97× more often** | `bell.per_year_*`, `bell.ratio_4sd` |
| The crash model (illustrative) | volatility **15%**, plus a **−20% crash** arriving 0.1 times a year (**about once every 10 years**); one-month options; zero rates | `model` |
| The simulation | **1,000,000 simulated paths**, seed 11; 8,171 of them had a crash | `model.paths`, `model.paths_with_crash` |
| Implied vol by strike (simulated, one month) | 80: **29.7%** · 85: 26.4% · 90: **20.7%** · 95: 16.7% · 100: **15.6%** · 105: 15.3% · 110: 15.2% · 115: 15.2% · 120: 15.1% | `model.iv_pct` |
| The 90 put | simulated price **0.090** (0.0896); at one volatility (15.6%) Black–Scholes says **0.014** (0.0140): **6.4×** more; its implied vol **20.7%** | `put90` |
| Where the simulated months end | histogram of the 1-month end price, 70–130 in bins of 2.5 (`all`), with the paths that had a crash (`crash`) | `ends` |
| One simulated path | 10 years, daily, every 5th day stored (`values`, 505 points); the crash on day 1,101: 133.76 → 107.17 | `path` |

Implied vol = the volatility that makes Black–Scholes give the option's price. Puts below strike 100, calls from 100 up.

## Scenes
Film windows [start, duration] and every word's onset are in `work/scene_words.md`. **Bold** words get the caption's
sticker pop at that moment, so land your scene's beat on the same word. W[i] = the i-th word of the scene.

- **s1** "You know Black-Scholes uses **one** volatility for every option."
  W: 0 You · 1 know · 2 Black-Scholes · 3 uses · 4 one · 5 volatility · 6 for · 7 every · 8 option.
  - Nine **option tickets** on the strike row (see "Rows of strikes"): low white slabs with a blue header band, like the
    top ticket of Day 10's s9 stacks, popping in one after another as the platform lands, each with its strike pill
    "K 80" … "K 120" (step 5) in front.
  - On W[2] a navy signboard "BLACK–SCHOLES" pops above the row.
  - On W[4] one blue **σ block** "σ 20%" drops onto the platform; over W[5]–W[8] nine identical blue **vol columns**
    grow behind the tickets, all to the same height, and a flat white plank lands across their tops: one volatility
    for every option. A small note: "one σ for every strike".
- **s2** "Then the interviewer asks: so why does the market quote a **different** volatility for every **strike?**"
  W: 0 Then · 1 the · 2 interviewer · 3 asks: · 4 so · 5 why · 6 does · 7 the · 8 market · 9 quote · 10 a · 11 different ·
  12 volatility · 13 for · 14 every · 15 strike?
  - An **interview desk** drawn in code (a wood desk, two chairs facing each other) on the platform.
  - A white speech-bubble signboard with a small blue "INTERVIEWER" tag (on W[3]); the question reveals with the voice:
    "Why a different volatility" (W[5]–W[12]) / "for every strike?" (W[13]–W[15]).
  - On W[11] the nine vol columns from s1 (smaller, on the desk or beside it) wobble up and down to unequal heights,
    each with a "?" tag. No numbers: these are not data yet.
- **s3** "On October 19th, 1987, the S&P 500 fell **20.47%** in one day."
  W: 0 On · 1 October · 2 19th, · 3 1987, · 4 the · 5 S&P · 6 500 · 7 fell · 8 20.47% · 9 in · 10 one · 11 day.
  - A **desk calendar** block shows "MON 19 OCT 1987" on its face (W[1]–W[3]).
  - Two **index columns** (height ∝ index level; note "column height ∝ S&P 500 level"): "FRI 16 OCT · 282.70" (blue) and
    "MON 19 OCT", which starts at the same height and on W[7] "fell" drops to 224.84 (rose) while the lost 57.86-point
    chunk breaks off and tumbles off the platform edge.
  - A big rose signboard "−20.47%" lands on W[8]; "in one day" pill on W[10]–W[11]. Note: "S&P 500 daily closes".
- **s4** "At 20% volatility, a typical day moves 1.26%. So that crash was a **16-sigma** day."
  W: 0 At · 1 20% · 2 volatility, · 3 a · 4 typical · 5 day · 6 moves · 7 1.26%. · 8 So · 9 that · 10 crash · 11 was ·
  12 a · 13 16-sigma · 14 day.
  - A small blue block "1 typical day = 1.26%" pops on W[7] (signboard "20% ÷ √252 = 1.26%").
  - A tall rose **crash column** "−20.47%" stands on the platform (from W[10] "crash").
  - Beside it, **16 blue blocks**, each exactly 1.26% tall, drop in one after another and stack up to the crash
    column's height (plus a thin 0.2 sliver on top), with a counter "×1 … ×16" (W[8]–W[12]). Scale note
    "height: 1 unit = 2.5%".
  - On W[13] the signboard "20.47% ÷ 1.26% = 16.2σ" lands.
- **s5** "If returns were normal, like Black-Scholes assumes, a day like that would **never** happen. Not once since the Big Bang."
  W: 0 If · 1 returns · 2 were · 3 normal, · 4 like · 5 Black-Scholes · 6 assumes, · 7 a · 8 day · 9 like · 10 that ·
  11 would · 12 never · 13 happen. · 14 Not · 15 once · 16 since · 17 the · 18 Big · 19 Bang.
  - A 3D **bell curve of daily moves** (`bell.normal`, x −5%…+5%) as an extruded blue ribbon wall on the platform (adapt
    Day 10 s10), building on W[3]; ticks −5% · −1.26% · 0 · +1.26% · +5%; label "normal curve · sd 1.26% a day".
  - A rose marker for **19 Oct 1987** sits far off the left end of the platform with a dashed line back to the curve:
    "−20.47% = 16.2σ · way off this chart" (from W[8]–W[10]).
  - On W[12] "never" a rose signboard "chance ≈ 10⁻⁵⁹ a day".
  - On W[18]–W[19] a signboard "since the Big Bang: 13.8 billion years × 252 days → expected ≈ 4 × 10⁻⁴⁷ days".
- **s6** "But it **did.** Real returns have fat tails: crashes come far more often."
  W: 0 But · 1 it · 2 did. · 3 Real · 4 returns · 5 have · 6 fat tails: · 7 crashes · 8 come · 9 far · 10 more · 11 often.
  - The rose "19 OCT 1987 · −20.47%" block slams down onto the platform's left end on W[2] with a squash and an
    "IT HAPPENED" stamp.
  - The bell curve wall stays; on W[6] a second, rose **fat-tailed curve** (`bell.fat`) rises in front of it: with the
    same spread it is taller and narrower in the middle, lower on the shoulders and higher in the far tails (beyond about
    ±2.5σ), drawn on the same honest scale. Shade the far tails rose and add a small "left tail ×10" zoom so the fatter
    tail reads. Label "illustrative: same 1.26% spread, fatter tails".
  - On W[9]–W[11] a signboard "days worse than −4σ: ×97 more often (illustrative)".
  - No exit flip (tiles out).
- **s7** "And what pays in a crash? A low-strike **put.** So traders pay more for it."
  W: 0 And · 1 what · 2 pays · 3 in · 4 a · 5 crash? · 6 A · 7 low-strike · 8 put. · 9 So · 10 traders · 11 pay · 12 more ·
  13 for · 14 it.
  - A "STOCK 100" block drops to "80 · −20%" in rose on W[5] "crash?".
  - On W[7]–W[8] a 3D **PUT contract** card stands up (thick white card with a rose header band "PUT · STRIKE 90",
    "1 month"), and beside it its **payoff** as a row of columns for stock prices 70…100: height max(90 − S, 0), zero
    above 90 and rising below it ("pays when the stock falls below 90").
  - On W[11]–W[12] two price signboards: "one volatility (15.6%): 0.014" (white) and "with crashes (simulated):
    0.090" (blue, bigger), and a "×6.4" pill.
  - Tile-cascade entrance.
- **s8** "Put that higher price into Black-Scholes and solve for the volatility: it comes out higher. That's **implied volatility.**"
  W: 0 Put · 1 that · 2 higher · 3 price · 4 into · 5 Black-Scholes · 6 and · 7 solve · 8 for · 9 the · 10 volatility: ·
  11 it · 12 comes · 13 out · 14 higher. · 15 That's · 16 implied volatility.
  - A **Black–Scholes machine**: a big navy box with "BLACK–SCHOLES" mapped on its front face and a slot on top.
  - The price block "0.090" (the 90 put's simulated price) lifts and drops into the slot on W[3]–W[4].
  - On W[7] "solve" the display on its face spins σ values and settles; on W[14] "higher" a blue **σ column**
    "20.7%" pops out beside it, next to a ghost sky column "15.6% · at the money".
  - On W[16] a signboard "implied vol = the σ that gives the market price".
  - No exit flip (tiles out).
- **s9** "Let's **simulate** it. A stock with 15% volatility that crashes 20% about once every 10 years."
  W: 0 Let's · 1 simulate · 2 it. · 3 A · 4 stock · 5 with · 6 15% · 7 volatility · 8 that · 9 crashes · 10 20% · 11 about ·
  12 once · 13 every · 14 10 · 15 years.
  - **One simulated path** (`path.values`, 10 years) as a 3D ribbon drawing on along the platform (x = years 0 → 10,
    height ∝ price), from W[1]. Label "one simulated path · illustrative model".
  - "volatility 15%" signboard on W[6]; on W[9]–W[10] the crash step (day 1,101: 133.76 → 107.17) highlights rose with
    a "−20% crash" pill; on W[12]–W[15] "about once every 10 years".
  - Tile-cascade entrance.
- **s10** "Price one-month options at strikes from 80 to 120, on a **million** simulated paths."
  W: 0 Price · 1 one-month · 2 options · 3 at · 4 strikes · 5 from · 6 80 · 7 to · 8 120, · 9 on · 10 a · 11 million ·
  12 simulated · 13 paths.
  - Nine **strike tiles** 80 … 120 along the front edge; 80 pops on W[6], 120 on W[8], the rest fill in between.
  - A counter signboard "paths: 0 → 1,000,000" rolls from W[9] to W[12].
  - Behind the tiles, the **histogram of where the million simulated months end** (`ends.all`) grows as columns, with
    the crash paths (`ends.crash`) in rose near 80. Label "1,000,000 simulated months · 8,171 with a crash"
    (height scale note).
- **s11** "At the money, implied vol is 15.6%. At 90, 20.7. At 80, **29.7.** One stock, one model, and the flat line bends into a **smile.**"
  W: 0 At · 1 the · 2 money, · 3 implied · 4 vol · 5 is · 6 15.6%. · 7 At · 8 90, · 9 20.7. · 10 At · 11 80, · 12 29.7. ·
  13 One · 14 stock, · 15 one · 16 model, · 17 and · 18 the · 19 flat · 20 line · 21 bends · 22 into · 23 a · 24 smile.
  - Nine **implied-vol columns** on strike tiles 80 … 120, height ∝ implied vol (note "height: 1 unit = 4%").
  - The 100 column grows with "15.6%" on W[6]; 90 with "20.7%" on W[9]; 80 with "29.7%" (rose-edged, the biggest) on
    W[12]; then the others grow (85, 95, 105 … 120).
  - On W[19]–W[20] a translucent flat plank at 15.6% across all nine ("one volatility").
  - On W[21]–W[24] a blue ribbon through the column tops draws on, left to right: the smile. Label "implied vol by strike ·
    simulated · 1 month".
  - No exit flip (tiles out).
- **s12** "So here's the answer: with normal returns and one volatility, implied vol would be **flat** across strikes."
  W: 0 So · 1 here's · 2 the · 3 answer: · 4 with · 5 normal · 6 returns · 7 and · 8 one · 9 volatility, · 10 implied ·
  11 vol · 12 would · 13 be · 14 flat · 15 across · 16 strikes.
  - A blue "THE ANSWER" pill on W[3].
  - Left: a small **normal bell** on its own tile ("normal returns") on W[5]–W[6]. Right: nine equal vol columns rise
    (W[8]–W[12]) and a level plank lands on them on W[14] "flat".
  - Tile-cascade entrance.
- **s13** "Real returns have fat tails, so low-strike puts cost more, and implied vol **rises** as the strike falls."
  W: 0 Real · 1 returns · 2 have · 3 fat tails, · 4 so · 5 low-strike · 6 puts · 7 cost · 8 more, · 9 and · 10 implied ·
  11 vol · 12 rises · 13 as · 14 the · 15 strike · 16 falls.
  - The same set: the small bell becomes the fat-tailed one (rose tails) on W[3].
  - The low-strike columns (80, 85, 90) rise to their simulated heights on W[7]–W[8] ("cost more"); on W[12] "rises" the
    rest settle onto the smile and the ribbon draws through their tops.
  - On W[15]–W[16] an arrow pill along the row: "strike ↓ → implied vol ↑".
  - No exit flip (tiles out).
- **s14** "Comment FORMULA, and we'll DM you the free Quant Formula Sheet. Save this, share it, and follow Desk2Quant for Day 12."
  W: 0 Comment · 1 FORMULA, · 2 and · 3 we'll · 4 DM · 5 you · 6 the · 7 free · 8 Quant · 9 Formula · 10 Sheet. · 11 Save ·
  12 this, · 13 share · 14 it, · 15 and · 16 follow · 17 Desk2Quant · 18 for · 19 Day · 20 12.
  - A **smartphone** drawn in code lying tilted on the platform (navy body, white screen face), the screen content mapped
    with `faceMatrix`: a comment box that types "FORMULA" (W[0]–W[1]); on W[4] "DM" a DM bubble "Hey! Here's your free
    Quant Formula Sheet 📐" arrives with the real cover `assets/covers/formula-sheet.png`.
  - Above it, pills "SAVE" (W[11]), "SHARE" (W[13]) and "FOLLOW" (W[16]) pop in turn.
  - The profile signboard on W[17]: the real logo `assets/logo.png`, "Desk2Quant", "@desk2quant", "desk2quant.com",
    with no counts.
  - A "DAY 12 →" sticker lands on W[19]–W[20].
  - Hold the full end card for the last 2 s. Tile-cascade entrance, no exit.

## Check your work
Snapshot with:

`cd /home/user/Films/d2q-day11 && HYPERFRAMES_NO_TELEMETRY=1 timeout 300 npx --yes hyperframes@0.9.39 snapshot . --at <film times> --no-end --no-browser-gpu -o /home/user/Films/d2q-day11/out/snap_<you>`

- Film time = the scene's start (in `work/scene_words.md`) + scene time. Check 3–5 times per scene: right after the
  entrance, on the key words, just before the exit. Look at every still.
- Check that nothing is above y 560; mapped text sits exactly on its face; every number reads at phone size; nothing
  of yours is in the guide's box (x 760–1060, y 1480–1920); the flip in and out works; the bottom of the stage is not empty.
- Report briefly: the files written, one line per scene, the scales you used, and the snapshot folder. Delete everything
  but your final stills.
- Never mention how the film or its voice was made, on screen or anywhere in the files.
