# Day 11/30 "volatility smile", rebuilt in the Ripping look (no character)

The founder's verdict on the current Day 11 (`/home/user/Films/d2q-day11-hud`, light HUD + the D bust): "not that great;
remove the character and make cool elements or graphics like getripping.com". Rebuild it here with the SAME voice, script,
timing and numbers, but a new look: Ripping's motion-graphics grammar, no presenter anywhere.

## What stays (reuse, do not regenerate)
- Voice: `../d2q-day11-hud/assets/vo.wav` placed at film t = 0.12 s. Film length 77.94 s (the end card holds to the end).
- Word timing: `../d2q-day11-hud/voice/out/timing.json` (W = film-time onsets of every spoken word) and
  `../d2q-day11-hud/work/scene_words.md` (14 beats s1-s14 as [start, duration] with word offsets from the beat start).
- Numbers: `../d2q-day11-hud/work/numbers.json` (every number on screen comes from here; never type a number by hand).
- Formulas: `../d2q-day11-hud/work/formulas.json` (MathJax SVGs, ids below; `formulas.tex.json` has their TeX).
- Data: real S&P 500 daily OHLC Sep-Oct 1987 (`numbers.json` spx1987), BS price curve + Newton steps (bscurve), 40-path
  Monte Carlo fan (fan, seed 2), terminal histogram (ends), log densities (logpdf), the smile (model.iv_pct).
- Music: `../d2q-day11-hud/assets/bgm.wav` (original score, already kept >= 10 dB under the voice). CC0 effects from
  `../d2q-day11-hud/assets/sfx` (+ `../d2q-free10/assets/sfx`); re-time them to the new cues.
- Fonts D2QSans (Inter Bold) for all big type and captions, Share Tech Mono for small data labels
  (`../d2q-free10/assets/fonts`). Real logo `../d2q-day11-hud/assets/logo.png`. Formula Sheet cover
  `../d2q-day11-hud/assets/covers/formula-sheet.png`.
- Caption: copy `../d2q-day11-hud/caption.txt` unchanged.

## Framework
Start from `/home/user/Films/d2q-free10` (the Ripping-style reel the founder approved for posting): copy its HyperFrames
structure (index.html scene hosts + audio clips + persistent layers, `tools/compose.py`, `tools/timing.py` pattern,
`tools/master.sh`, `work/kit.js` = the K kit: paper/grid background, marker-box captions, cards, stamps, counters,
springs, colour blocks). DROP its `mc` presenter layer completely. For charts, port what you need from
`../d2q-day11-hud/work/qchart.js` (axes, lines with a moving head, candles, bars, areas, tags, tex layer) but restyle it
bold (see Look). HyperFrames 0.9.39 only: `npx --yes hyperframes@0.9.39 render . -q looks --workers 3 --no-browser-gpu
-o out/raw.mp4`; stills with `npx --yes hyperframes@0.9.39 snapshot . --at <t,...> --no-end --no-browser-gpu -o <dir>`.

## The look (Ripping's grammar, light theme)
1. **Zones on every frame.** Brand pill top-centre (y 50-110): logo mark + "Desk2Quant · DAY 11/30 · MAKING QUANT EASY".
   Caption (y 150-470): the caption IS the voice, bold D2QSans 66-76 px, ink navy, built word by word on the spoken
   onsets, 2-3 lines per page, pages turn at phrase ends; 1-2 key words per page get a solid marker box (yellow #ffd43b;
   red #e5484d for crash words) that wipes in on the word. Hero (y 490-1640): ONE big hero per beat, using the full width
   (x 40-1040) now that there is no presenter. Bottom (y 1670-1860): a 5-step progress strip
   QUESTION · 1987 · FAT TAILS · SIMULATION · ANSWER (active step brand blue, done steps ticked), plus small
   "desk2quant.com". No large empty area on any frame (the founder's rule): check every still.
2. **Cool elements, not thin HUD lines.** Big white cards (radius 28, soft long shadow, slight 3D tilt that settles with a
   spring), glossy object metaphors, app-like UI (fields, toggles, sliders, buttons) driven by a mouse cursor that glides
   and clicks, stamps that slam with a tiny shake, numbers that count/roll, split-flap digits, highlighter sweeps,
   particles (balls) pouring into bins, spotlight-circle reveals. Thick strokes (6-9 px), big labels (>= 26 px, mono
   for data), brand blue #2563eb, ink #0d1526, paper #f3efe6 with faint grid, red #e5484d only for the crash/tail.
   Something moves every second; the hero changes every 2-4 s.
3. **Contrast beats**: light paper scenes, with brand-blue colour-block beats (white type, yellow markers) on s2 (the
   question), s6 ("But it did."), s12 (the answer). No dark/black scenes.
4. **Hook in frame 1**: at t = 0 the caption's first words AND the s1 hero are already on screen (no fade from empty).
5. **Labels**: real data says "REAL DATA · S&P 500 daily, Sep-Oct 1987"; simulated things say "SIMULATED" (+ seed in
   small mono); the fat-tailed curve says "illustrative: Student-t, 3 d.f." Nothing on screen about how the reel was made;
   no prices of Desk2Quant products, discounts or codes; no bank/employer names; no real people.

## Beat by beat (film times: see scene_words.md; everything lands on its spoken word)
- **s1 Hook** "You know Black-Scholes uses one volatility for every option." Hero: a big glossy volatility dial (gauge)
  whose needle springs to "σ = 20%", and a fan of five option tickets K 80 / 90 / 100 / 110 / 120 dealing out below it,
  each σ field flipping to the same "20%". Marker: "one volatility".
- **s2 Question (blue block)** "Then the interviewer asks: so why does the market quote a different volatility for every
  strike?" Hero: an interview chat card (neutral icon, no face) with a typing indicator, the question bubble typing out;
  then the five tickets' σ fields spin as split-flap digits and land on DIFFERENT values (label "illustrative quotes").
  Marker: "different volatility". This frame is also the cover (question large).
- **s3 1987** "On October 19th, 1987, the S&P 500 fell 20.47% in one day." Hero: a tear-off calendar page "MON 19 OCT
  1987" slams in; then a big white dashboard card "S&P 500 · daily" (Ripping's SaaS-card style: big number top-left)
  draws the real candles; the crash candle drops with a shake, the big number counts 0 -> -20.47% in red, stamp
  "IN ONE DAY". Marker: "20.47%".
- **s4 16σ** "At 20% volatility, a typical day moves 1.26%. So that crash was a 16-sigma day." Hero: formula card
  sigma_day, then a measuring-tape ruler of σ ticks: the typical-day band ±1.26% shaded, then the tape whips out to
  16.2σ (formula z_crash) with a rolling "16σ" in a marker box.
- **s5 Never** "If returns were normal, like Black-Scholes assumes, a day like that would never happen. Not once since
  the Big Bang." Hero: a glossy solid bell curve (the normal) with the crash point far off in the flat tail; counter to
  p_tail (1.2×10⁻⁵⁹); a universe timeline card (big_bang: 13.8 bn years × 252 = 3.5×10¹² days -> expected) and a "NEVER"
  stamp. Marker: "never happen".
- **s6 But it did (blue block)** "But it did. Real returns have fat tails: crashes come far more often." Hero: the s3
  calendar page returns with a stamp "BUT IT DID"; then normal vs fat-tailed log densities (logpdf), the fat tail lifting
  off the normal's floor, chip fat_ratio "≈97× more 4σ days". Marker: "fat tails".
- **s7 Put** "And what pays in a crash? A low-strike put. So traders pay more for it." Hero: a put ticket "PUT · K 90 ·
  1 month" with its payoff hockey stick (payoff); a crash arrow lights the payoff; a cursor clicks BUY repeatedly and the
  price tag ticks up from the one-vol price to the crash-aware price (put90.price_one_vol -> put90.price_model, "6.4×").
  Marker: "low-strike put".
- **s8 Implied vol** "Put that higher price into Black-Scholes and solve for the volatility: it comes out higher. That's
  implied volatility." Hero: a solver app card: price field 0.090 -> [Black-Scholes] -> σ; the cursor clicks SOLVE;
  Newton rows roll (bscurve.newton) to 20.7%, beside the BS price-vs-σ curve crossing the market price; "15.6% -> 20.7%
  higher". Formulas iv_def, newton. Marker: "implied volatility".
- **s9 Simulate** "Let's simulate it. A stock with 15% volatility that crashes 20% about once every 10 years." Hero: a
  simulation control panel: the cursor sets sliders σ = 15%, crash = -20%, "1 per 10 yrs" on the spoken words (formula
  model + model_par); then the 40-path fan (fan) draws out with red crash drops. Label SIMULATED.
- **s10 A million paths** "Price one-month options at strikes from 80 to 120, on a million simulated paths." Hero: a
  "1,000,000 paths" counter rolling while balls pour into the terminal-value histogram bins (ends), and nine strike
  cards 80..120 tick to "priced" (formula mc_price). Label SIMULATED.
- **s11 The smile** "At the money, implied vol is 15.6%. At 90, 20.7. At 80, 29.7. One stock, one model, and the flat
  line bends into a smile." Hero: the big smile card (IV vs strike, model.iv_pct): points pop with counters on "15.6",
  "20.7", "29.7", then the rest; a dashed flat line at 15.6% bends into the smile curve on "bends into a smile". Marker:
  "smile". Keep the smile up into s12.
- **s12 The answer (blue block)** "So here's the answer: with normal returns and one volatility, implied vol would be flat
  across strikes." Hero: "THE ANSWER" statement card, the flat line (formula flat). Marker: "flat".
- **s13** "Real returns have fat tails, so low-strike puts cost more, and implied vol rises as the strike falls." Hero: a
  three-link chain fat tails -> low-strike puts cost more -> IV rises as strike falls (each link lights on its words),
  over the smile/skew (formula skew). Marker: "rises".
- **s14 CTA** "Comment FORMULA, and we'll DM you the free Quant Formula Sheet. Save this, share it, and follow Desk2Quant
  for Day 12." Hero: a comment card where FORMULA is typed and posted, a DM card with the Formula Sheet cover, then a
  save icon lighting on "Save this", share on "share it", follow on "follow"; the DESK2QUANT plate (real logo,
  @desk2quant, desk2quant.com) and a "Day 12 →" chip. The last frame holds (no erase). Marker: "FORMULA".

## Sound
VO at 0.12 (volume 1). bgm.wav from Day 11 (0.75, fade-out 1.2 s). New CC0 effect cues on the new events (stamp hits,
flips, ticks for counters, clicks for the cursor, a soft whoosh per hero change), each 0.07-0.14 volume, never over a
stressed word. Master: `bash tools/master.sh out/raw.mp4 out/day11_rip.mp4` (-14 LUFS, -1.5 dBTP), voice loudest.

## Checkpoint first (then stop and report)
Build the persistent layers (background, brand pill, caption with marker boxes, progress strip) and three beats: s1 (hook),
s3 (1987) and s11 (smile). Snapshot each at 3-4 moments into `out/pilot/` and STOP: report the still paths and anything
uncertain. Continue with the rest only after the go-ahead.

## Then
All beats, stills of every beat into `out/stills/` (look at every one yourself: legibility, overlaps, empty areas,
numbers vs numbers.json, labels), render, master, cover (`out/cover.jpg`: the s2 question frame, question readable in
a 3:4 crop), `credits.txt` (fonts, MathJax, data source, CC0 sounds, music: original; no character credit), a short
`README.md`. Do not commit, push or post anything; report the paths.
