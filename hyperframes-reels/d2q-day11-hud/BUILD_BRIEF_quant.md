# Day 11 "the volatility smile", quant-visuals rebuild: scene builder brief

The film (78 s, 1080 x 1920, 24 fps) keeps its voice, script, timing, light HUD look, subtitles, chip rail and trader.
The founder (a practising quant) rejected the previous scenes because their props (chairs, a calendar, stacked blocks,
a machine with a dial, wireframe columns on a projector pad) do not look like quant finance and do not match the
script. **Every element you draw must be the literal quant object the voice names: charts with real axes and ticks,
typeset formulas, tables, distributions, payoff diagrams, simulated paths.** No metaphors, no props, no projector pad,
no 3D wireframe objects. Think "a quant's analytics screen, in the light HUD style".

Two pilot scenes are finished and approved as the direction: read them first and match them exactly in look, sizes,
motion and code style.
- `work/scenes/s3.js`: the real S&P 500 daily candles, Sep-Oct 1987, the crash candle, -20.47% locking.
- `work/scenes/s8.js`: the Black-Scholes price of the 90 put against sigma; Newton's method finds the implied vol.
- Stills: `out/pilot_send/frame-00-at-12s.png`, `out/pilot_send/frame-01-at-37.9s.png`.

## How a scene is built
- You write ONLY `work/scenes/sN.js` for your scenes. It starts with two lines, `const TEX_IDS = [...];` (formula ids
  from `work/formulas.tex.json`) and `const NUM_KEYS = [...];` (sections of `work/numbers.json`), then defines
  `init()` (calls `QC.tex.init(...)` as the pilots do) and `draw()` reading `st.t` (seconds into the scene).
- Build it: `python3 tools/compose.py sN` writes `compositions/sN.html` (fonts, the DATA line with DUR and W, the TEX
  and NUM blocks, the HOLOHUD engine, the QC chart kit, your code, the timeline). **Never run tools/final_pass.py,
  never edit shared files** (`work/qchart.js`, `work/holohud.js`, `work/smile.py`, `work/numbers.json`,
  `tools/*`, `index.html`, `compositions/{bg,hud,ov,mc}.html`, other builders' scenes). If the kit lacks something,
  write a local helper in your scene; if you find a kit bug, work around it locally and say so in your report.
- `W[i]` = the onset (s, from the scene start) of caption token i; `DUR` = the scene length. Both come from the DATA
  line; never edit it. Use `w(i)` for timing, never hard-coded seconds for spoken beats.
- Check: `cd hyperframes-reels/d2q-day11-hud && HYPERFRAMES_NO_TELEMETRY=1 timeout 400 npx --yes hyperframes@0.9.39
  snapshot . --at <film times, comma separated> --no-end --no-browser-gpu -o out/snap_<your scenes>`, then look at
  the PNGs/contact sheets (film time = scene start + scene time). Check each scene at: just after it starts, on every
  locked value, mid-animation of each element, and 0.1 s before it ends; plus full-resolution frames for text.

## Numbers
Every number on screen comes from `NUM` (your NUM_KEYS) or from a formula in `work/formulas.tex.json` (which is
generated from numbers.json). Never type a data value by hand; format from NUM (`toFixed`). Axis ranges and tick values
are yours to choose. Label simulated or illustrative data on screen (panel `tag`: "REAL DATA", "MODEL",
"SIMULATED", "ILLUSTRATIVE"). `node -e` or python can print a section: `python3 -c "import json;
print(json.load(open('work/numbers.json'))['model'])"`.

## Frame zones (do not draw outside the stage)
- Chrome y 0-140 and the subtitle band y 150-540 belong to other layers (hud.html, ov.html).
- **Stage: x 30-1050, y 552-1478.** All your drawing lives here (`QC.STAGE`).
- Chip rail x 54-760, y 1484-1690 (hud.html adds −20.47% · 16.2σ · 10⁻⁵⁹ · 0.090 · 20.7% · 29.7% as they are said)
  and the trader x 760-1060, y 1480-1920 (mc.html). Keep clear.
- Typical layout (as in s8): a formula strip plate at y 566-708 (or taller when a formula has a fraction) and the chart
  panel below it to y ~1466; or one chart panel from y 566 to 1450 (as in s3).

## Look and motion (match the pilots)
- Colours: `T.line` blue for data, `T.hi` navy for text and axes, `T.dim` pale blue for grid and secondary labels,
  `T.acc` orange ONLY for a value at the moment it locks (when it is said) and after. Formulas: navy, with their
  `\class{acc}` parts turning orange via `lock: true` when said.
- Type: Fredoka (labels, values; `QC.text`, `QC.value`), Share Tech Mono (ticks, data, tables: `mono: true`).
  Minimum sizes: micro labels 18 px, ticks 20-22 px, body labels 24-30 px, key values 56-110 px.
- Panels: `QC.panel` with an uppercase title, a sub line of parameters and a tag; the index number is the scene
  number ("01", "02"...).
- Motion grammar: the scan-in (`QC.scanIn` + `QC.clipStage`, 0.6 s) at a scene's start and the scan-erase
  (`QC.scanOut`, last 0.4 s) at its end, exactly as the pilots, unless your brief below says the scene continues into the
  next one (then draw the same panel in the same place across the cut, with no erase or scan-in). Curves draw left to
  right with a scan head (`QC.line` `head: true`); values roll then lock (`QC.value`, `roll`); key points get a target lock
  (`QC.lock`) on the word that names them, with a 3-frame white flash (`flash: hit(t, t0)`); tags and leaders explain.
  Everything must be legible on a phone and nothing may overlap text.
- Each spoken number should be visible and locked within ~0.15 s of being said. Keep the screen busy but calm: one
  new thing per spoken phrase.

## The kit (`work/qchart.js`, global `QC`; read it, it is short)
`frame(x,y,w,h,xr,yr)` -> F with F.X(v), F.Y(v) · `panel(g,T,x,y,w,h,{open,title,sub,tag,index,frame,op})` ·
`axes(g,T,F,{k,xt,yt,xf,yf,xl,yl,grid,xAt,yAt,size,noY})` · `line(g,T,F,xs,ys,{k|x1,c,w,dash,glow,head,a})` ·
`area(g,T,F,xs,ys,{base,x0,x1,k,c,fa,a})` · `bars(g,T,F,xs,ys,{bw,base,k,c,fa,hl,a})` ·
`candles(g,T,F,{open,high,low,close},xs,{n,bw,hl,a})` · `hline/vline(g,T,F,v,{k,c,dash,label,at,size,a})` ·
`dot(g,T,x,y,{r,c,a,pulse})` · `text(g,T,s,x,y,{size,wt,c,a,align,mono,ls,roll,frame,seed,maxW})` ·
`value(g,T,s,x,y,{size,roll,frame,unit,flash,align})` -> {bb} · `tag(g,T,s,x,y,{c,a,align,size})` ·
`lock(g,T,bb,k,{pad,tag,flash})` · `leader(g,T,from,elbow,to,k)` · `scanIn/scanOut/clipStage/scanLine` ·
`tex.init(root,TEX,T)`, `tex.begin()`, `tex.show(id,{x,y,size,align,valign,k,a,lock,clip})` -> {bb}, `tex.end()` ·
`fmt`, `pow10(e)` ("10⁻⁵⁹"), `MINUS`, `clamp`, `lerp`, `eo`, `eio`. A log axis: pass log10 values, format ticks with
`pow10`. Also available: `HOLOHUD.HUD` (`glitch(ctx,W,H,amt,seed)`, `rollText`, `specCard`, `chip`...).

## Formulas available (`work/formulas.tex.json`; typeset LaTeX, sized by `size` = em in px)
bs_put, bs_d, sigma_day, z_crash, p_tail, big_bang, expected, normal_pdf, fat_ratio, payoff, iv_def, newton, model,
model_par, mc_price, flat, skew. If you need another, render it with `QC.text` for now and list it in your report.

## Reporting
When done, report: which scenes, what each shows beat by beat, the snapshot folder, anything you could not do, any
kit issues. Nothing on screen may say how the film was made.

---

## Scene specs (VO words with their W index; your scene's DUR is in its DATA line)

### s1 [film 0.00-2.91] "0 You 1 know 2 Black-Scholes 3 uses 4 one 5 volatility 6 for 7 every 8 option."
- Formula strip (two lines: `bs_put` over `bs_d`, ~40 px em): types in on "Black-Scholes"; its sigmas lock orange on
  "one volatility".
- Panel "01 · BLACK–SCHOLES · ONE σ", sub "IMPLIED VOL BY STRIKE", tag "MODEL": x strike 80-120 (ticks 80..120 by 10 or
  by 5), y implied vol 10%-35%. On "one volatility" a flat line at σ = 20% draws across; on "every option" nine dots
  (strikes 80,85,...,120) land on the line one by one; tag "σ = 20% FOR EVERY STRIKE". (20% = numbers.json
  normal.sigma_annual.)
- Continues into s2: no erase at the end.

### s2 [2.91-7.42] "0 Then 1 the 2 interviewer 3 asks: 4 so 5 why 6 does 7 the 8 market 9 quote 10 a 11 different
12 volatility 13 for 14 every 15 strike?"
- Same chart in the same place (no scan-in). The formula strip becomes an "INTERVIEW QUESTION" plate on "asks:":
  "Why a different volatility for every strike?" (Fredoka 600, ~40 px), with a "?" lock.
- On "market quote": market dots appear beside the line, then on "different" they slide from the 20% line to their own
  levels (model.iv_pct for each strike), each with a thin vertical gap line; the flat line turns dashed and is labelled
  "BLACK–SCHOLES: ONE σ"; the dots are labelled "MARKET QUOTES" with tag "ILLUSTRATIVE". Do not print the dots' values
  (they are the payoff in s11). On "strike?" lock the 80 dot (the most different) with a "?" tag.
- Scan-erase at the end.

### s4 [13.22-19.66] "0 At 1 20% 2 volatility, 3 a 4 typical 5 day 6 moves 7 1.26%. 8 So 9 that 10 crash 11 was 12 a
13 16-sigma 14 day."
- Formula strip: `sigma_day` on "20% volatility", locking 1.26% on "1.26%"; then `z_crash` on "So that crash", locking
  −16.2 on "16-sigma".
- Panel "04 · DAILY MOVES IF RETURNS WERE NORMAL", tag "MODEL": the normal density of daily moves (sd 1.26%;
  numbers.json bell, normal) on an x axis in % from −6 to +6; ±1σ band shaded and labelled on "1.26%".
- On "So that crash": the x axis zooms out to about −22%..+6% (the bell shrinks to a spike near 0); a σ ruler runs left
  along the axis in 1σ steps with a rolling count; the crash dot lands at −20.47% = −16.2σ (crash.ret_pct,
  normal.z_round) and locks on "16-sigma".
- Continues into s5 (no erase).

### s5 [19.66-25.20] "0 If 1 returns 2 were 3 normal, 4 like 5 Black-Scholes 6 assumes, 7 a 8 day 9 like 10 that
11 would 12 never 13 happen. 14 Not 15 once 16 since 17 the 18 Big 19 Bang."
- Same chart in the same place. Panel title becomes "THE NORMAL CURVE · WHAT BLACK–SCHOLES ASSUMES" on "normal...".
- An inset magnifier on the far-left tail at the crash (the curve is invisibly small there): on "never happen" the
  formula `p_tail` (P(Z ≤ −16.2) ≈ 1.2×10⁻⁵⁹) locks.
- On "Not once since the Big Bang": `big_bang` then `expected` (≈ 4×10⁻⁴⁷ days) type in and the expected count locks.
- Continues into s6 (no erase).

### s6 [25.20-29.28] "0 But 1 it 2 did. 3 Real 4 returns 5 have 6 fat tails: 7 crashes 8 come 9 far 10 more 11 often."
- "did.": the film's one 3-frame glitch (`HOLOHUD.HUD.glitch` on your canvas) and the real crash (19 Oct 1987,
  −20.47%) slams onto the chart as a dot with a tag "19 OCT 1987 · IT HAPPENED".
- "Real returns have fat tails": the y axis turns into a log scale (log10 density, numbers.json logpdf: from 10⁰ down
  to ~10⁻⁶⁰); the normal curve becomes the parabola that plunges to ~10⁻⁵⁸ at the crash; the fat-tailed curve
  (logpdf.fat, Student-t with 3 degrees of freedom, same 1.26% sd) draws on top and stays near 10⁻⁵ there; the crash dot
  sits on the fat curve (logpdf.crash_fat). Tags "NORMAL" and "FAT TAILS · ILLUSTRATIVE".
- "crashes come far more often": `fat_ratio` (≈ 97) locks, with the per-year numbers from bell (per_year_normal
  0.008 a year, per_year_fat 0.78 a year) as a small table.
- Scan-erase at the end.

### s7 [29.28-32.78] "0 And 1 what 2 pays 3 in 4 a 5 crash? 6 A 7 low-strike 8 put. 9 So 10 traders 11 pay 12 more
13 for 14 it."
- Formula strip: `payoff` on "low-strike put".
- Panel "07 · 90 PUT · PAYOFF AT EXPIRY", tag "MODEL": x S_T 60-120, y payoff 0-30; on "crash?" an arrow on the x axis
  from S0 = 100 to 80 (−20%, model.crash); on "put." the hockey stick max(90 − S_T, 0) draws, K = 90 marked; the
  payoff at 80 (= 10) locks with "PAYS 10".
- "So traders pay more for it": a compact price comparison inside the panel: "ONE σ (15.6%): 0.014" against
  "WITH CRASHES: 0.090" and "×6.4" (put90.price_one_vol, put90.price_model, put90.ratio, put90.atm_iv), 0.090 locking on
  "more". Scan-erase at the end. (s8 then starts from that market price, 0.090.)

### s9 [38.37-44.05] "0 Let's 1 simulate 2 it. 3 A 4 stock 5 with 6 15% 7 volatility 8 that 9 crashes 10 20%
11 about 12 once 13 every 14 10 15 years."
- Formula strip (two lines): `model` (dS/S = σdW − 20%dN) and `model_par` (σ = 15%, λ = 0.1 a year). The σdW part is
  emphasised on "15% volatility", the −20%dN part locks orange on "crashes 20%", λ on "once every 10 years".
- Panel "09 · SIMULATED PATHS · 10 YEARS", tag "SIMULATED": numbers.json fan (40 paths, every 5th trading day; a log
  price axis such as 25-500 reads best), the paths draw left to right on "simulate it" (thin, translucent blue), each
  crash day marked with a small orange tick (fan.crash_days: trading-day indices, /5 for the value index); on "crashes
  20%" the crash marks pulse and one path's crash is shown close (a small zoom inset or a highlighted path); on "once
  every 10 years" a counter: "24 OF 40 PATHS HAD A CRASH · 36 CRASHES IN 400 PATH-YEARS" (fan.with_crash, fan.crashes).
- Scan-erase at the end.

### s10 [44.05-48.91] "0 Price 1 one-month 2 options 3 at 4 strikes 5 from 6 80 7 to 8 120, 9 on 10 a 11 million
12 simulated 13 paths."
- Formula strip: `mc_price` on "Price one-month options".
- Panel "10 · WHERE A MILLION MONTHS END", tag "SIMULATED": the histogram of the 1-month price S_T (numbers.json ends:
  edges 70-130 by 2.5, counts all; crash counts as the accent part of each bar) on a log count axis so the crash bump
  near 80 shows; strike lines at 80, 85, ..., 120 drop in on "strikes from 80 to 120"; on "a million simulated paths"
  a rolling counter "1,000,000 PATHS · 8,171 WITH A CRASH" (model.paths, model.paths_with_crash) locks.
- Scan-erase at the end.

### s11 [48.91-58.90] "0 At 1 the 2 money, 3 implied 4 vol 5 is 6 15.6%. 7 At 8 90, 9 20.7. 10 At 11 80, 12 29.7.
13 One 14 stock, 15 one 16 model, 17 and 18 the 19 flat 20 line 21 bends 22 into 23 a 24 smile."
- Panel "11 · IMPLIED VOL BY STRIKE · 1 MONTH", tag "SIMULATED": x strike 80-120, y implied vol 10%-35%; a dashed flat
  line at the at-the-money 15.6% labelled "ONE σ". Points land and lock as said: 100 → 15.6% on "15.6%", 90 → 20.7% on
  "20.7", 80 → 29.7% on "29.7" (model.iv_pct), each with a big rolling value; the other strikes appear on "One stock, one
  model". On "the flat line bends into a smile" the flat line morphs into the curve through all nine points, and on
  "smile." the film's one solid moment: the area under the curve fills and glows, tag "THE SMILE".
- A small table (strike · MC price · implied vol, from model.rows) may fill on the right as points land.
- Scan-erase at the end.

### s12 [58.90-63.50] "0 So 1 here's 2 the 3 answer: 4 with 5 normal 6 returns 7 and 8 one 9 volatility, 10 implied
11 vol 12 would 13 be 14 flat 15 across 16 strikes."
- An "ANSWER" layout of two rows, each: a small density chart → an arrow → a small implied-vol chart.
- s12 builds the top row: "NORMAL RETURNS" (bell.normal, thin tails) on "normal returns" → "IMPLIED VOL: FLAT" (a flat
  line across strikes 80-120 at the at-the-money level) on "flat across strikes"; `flat` formula under it.
- Continues into s13 (no erase).

### s13 [63.50-69.00] "0 Real 1 returns 2 have 3 fat tails, 4 so 5 low-strike 6 puts 7 cost 8 more, 9 and 10 implied
11 vol 12 rises 13 as 14 the 15 strike 16 falls."
- The bottom row: "FAT TAILS" (bell.fat over bell.normal, tag "ILLUSTRATIVE") on "fat tails" → "IMPLIED VOL: SMILE"
  (model.iv_pct curve) with the low strikes 80-90 highlighted on "low-strike puts cost more"; an arrow along the curve
  from 120 down to 80 rising on "implied vol rises as the strike falls"; `skew` formula locks on "falls".
- Scan-erase at the end.

### s14 [69.00-77.94] the end card, rebuilt flat (read the current `compositions/s14.html` for its content and timing)
"0 Comment 1 FORMULA, 2 and 3 we'll 4 DM 5 you 6 the 7 free 8 Quant 9 Formula 10 Sheet. 11 Save 12 this, 13 share
14 it, 15 and 16 follow 17 Desk2Quant 18 for 19 Day 20 12."
- Same content as now, as flat HUD panels with no phone wireframe and no projector pad: a comment card (the desk2quant
  account, "FORMULA" typed into the comment box on "FORMULA", POSTED ✓) and a DM card "Hey! Here's your free Quant
  Formula Sheet" with the sheet's cover (`assets/covers/formula-sheet.png`, draw it with an Image loaded in init and
  only when complete); SAVE / SHARE / FOLLOW rows lighting on "Save", "share", "follow"; "NEXT · MAKING QUANT EASY ·
  DAY 12 →" on "Day 12"; the DESK2QUANT plate with the real logo (`assets/logo.png`), @desk2quant and desk2quant.com on
  "Desk2Quant". No prices. Holds to the end (no erase).
