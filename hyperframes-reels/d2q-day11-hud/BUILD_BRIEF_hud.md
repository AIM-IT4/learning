# Day 11 "the volatility smile", Sci-fi Hologram HUD version: scene builder brief

Day 11/30 of "Making Quant Easy" (77.94 s, 1080×1920, 24 fps) is being rebuilt in the **Sci-fi Hologram HUD** style.
The voice, script, numbers and timing are fixed; only the picture changes. Read `TREATMENT.md` (why: one projector pad,
a scan sequence of literal subjects, values that roll and lock in amber and dock into a chip rail, one solid-hologram
ignition at the smile).

**The project** is `hyperframes-reels/d2q-day11-hud/`. You write only your own scene files `compositions/sN.html`; each
placeholder holds its `/*DATA*/ const DUR = …; const W = […]; /*END*/` line: keep it exactly (a tool rewrites it).
Never edit `index.html`, `bg.html`, `hud.html`, `ov.html`, `mc.html`, `tools/`, `work/` or other builders' scenes.

`$LIB` is a local copy of the Lemo-Opuscar style library (https://github.com/lemomo-ai/lemo-opuscar).

## Read first
1. `$LIB/styles/hologram-hud/STYLE.md`: the style's fixed rules. All of it applies (§2 materials, §3 colour,
   §4 type, §5 motion, §6 camera, §8 native moves, §9 pitfalls). Do not open the demo's story; you may read its engine.
2. `compositions/s1.html`: the finished pilot. **Copy its structure verbatim**: the fonts block, the inlined engine
   (`work/holohud.js`, the HOLOHUD bundle: `HOLO` wireframe engine, `HUD` UI, `MKM` model builder; it is the library's
   MIT engine), and the scaffold block (`work/scaffold.js`: `HOME`, `camMix`, `build`, `scanState`, `P3`). Then write your
   scene in its `draw()`.
3. The engine API: `$LIB/styles/hologram-hud/DEMO.md` § "Engine reference", and the source in
   `work/holohud.js` (HUD: `plate`, `targetBox`, `leader`, `rollText`, `monoText`, `specCard`, `chip`, `marker`, `beam`,
   `glitch`, `fitFont`, `wrap`; HOLO: `Holo.draw(ctx, model, cam, {hue, scan, scanDown, explode, solid, wave, flash, focus,
   dim, gain, keep})` returns `{bbox, anchor}` per part; `drawPad`, `drawScanPlane`, `makeCamera`; MKM.Model primitives:
   `box`, `tube`, `polyTube`, `ring`, `disc`, `circle`, … see the source).
4. `work/numbers.json` (every figure; embed what you need, no fetches) and `work/scene_words.md` (every word of every
   scene with its scene-relative onset; W index = position in the scene's list).

## The rules of this film
- **One pad, no cuts.** Every scene draws the projector pad (`HOLO.drawPad`) and its subject with **its own camera, which
  is exactly `HOME` at t = 0 and at t = DUR** (ease away after ~0.15 s, ease back over the last ~0.7 s, as in s1). The
  subject **scans in** over the first 0.6 s and is **scan-erased** over the last 0.4 s (`scanState`, plus
  `HOLO.drawScanPlane` while it runs). So every cut is: subject erased, same pad, next subject scanned in.
- **Wireframe subjects only**, built in code with `MKM.Model` in world units (no `normalizeModel`: heights must stay
  proportional to the numbers). The pad's bright ring has radius 1.05; keep subjects inside it, and **no taller than
  ~1.1 units** at the scene's closest camera. Real topology: give each thing its characteristic silhouette (§9).
- **Colour**: hue 205 (ice blue) for everything; **amber (`T.acc`) only on a value at the frame it becomes true** (a
  rolled number locking), never on decoration. Near-white (`T.hi`) = heat: the scan front, a lock flash, the part that
  matters now. No green, no rose: crashes and costs read through hot white, a three-frame `HUD.glitch` (s6 only) and
  the words.
- **Type**: Rajdhani via `HUD.FONT.ui` (Light 300 for big numbers, Medium/SemiBold labels, ALL CAPS labels), Share Tech
  Mono via `HUD.FONT.mono` for micro data. Numbers monospaced (`monoText`; the decimal point is a square). σ, ⁻ and
  superscripts come from the fallback font automatically. **Every text block sits on its own dark plate** (`HUD.plate`,
  `specCard`, `chip`); text never sits on the wireframe. Labels ≥ 22 px, values ≥ 56 px.
- **Native moves, on the spoken word**: target lock (`targetBox` k 0→1 over ~0.2 s, `flash` for 3 frames on the lock),
  leader (anchor ring → diagonal → horizontal, ~0.5 s), rolling value (`rollText` / `specCard` roll, locks right to
  left, turns amber with a one-frame white flash), local explode where it explains a number. Motion is "on ones":
  everything is a pure function of t; glyph rolls step per frame (`f = Math.floor(t * 24)`).
- **The chip rail is not yours**: `hud.html` docks these values into the bottom-left rail by itself (−20.47%, 16.2σ,
  10⁻⁵⁹, 0.090, 20.7%, 29.7%). Show each value in your scene (card, roll, lock); do not draw chips.
- **Frame zones** (1080×1920): chrome and brand y 0–140 (not yours); **subtitles y 150–540 (keep clear)**; **your
  stage: y 560–1470, x 40–1040**; the chip rail x 54–760, y 1484–1690 and the guide (the trader hologram) x 760–1060,
  y 1480–1920 are not yours. Cards go beside or above the subject, never over it; leaders do not cross the subtitle band.
- Label anything simulated "SIMULATED" and illustrative "ILLUSTRATIVE" (micro type on the card or plate).
- **No CSS transforms or DOM text needed**: draw everything on your one canvas. HyperFrames contract as in s1: one paused
  GSAP timeline with a proxy tween calling `draw()`, `window.__timelines["sN"] = tl`, no `Math.random`/`Date`/timers
  (seeded hashes only), no audio, ids prefixed `sN-`.

## Numbers (from `work/numbers.json`, shown exactly as rounded here)
| Quantity | Value |
|---|---|
| S&P 500 closes | FRI 16 OCT 1987: 282.70; MON 19 OCT 1987: 224.84; −57.86 points; **−20.47%** |
| A typical day at 20% volatility | 20% ÷ √252 = **1.26%** |
| The crash in typical days | 20.47 ÷ 1.26 = **16.2σ** |
| Normal-curve chance of a day that bad | **≈ 10⁻⁵⁹ a day**; days that bad expected since the Big Bang (13.8 bn years × 252): **≈ 4 × 10⁻⁴⁷** |
| Bell curves | `bell.x` −5%…+5%; `bell.normal` (sd 1.26%); `bell.fat` (ILLUSTRATIVE Student-t, 3 df, same spread: taller and narrower in the middle, thinner shoulders, fatter far tails beyond ~±2.5σ) |
| Days worse than −4σ (illustrative) | **×97 more often** (0.008 → 0.78 a year) |
| Crash model (ILLUSTRATIVE) | **15%** volatility + a **−20%** crash 0.1 times a year (**about once every 10 years**); 1-month options; zero rates |
| Simulation | **1,000,000 simulated paths**, seed 11; **8,171** with a crash |
| Implied vol by strike (SIMULATED, 1 month) | 80: **29.7** · 85: 26.4 · 90: **20.7** · 95: 16.7 · 100: **15.6** · 105: 15.3 · 110: 15.2 · 115: 15.2 · 120: 15.1 (%) |
| The 90 put | simulated price **0.090**; one volatility (15.6%) gives **0.014**; **×6.4**; implied vol **20.7%** |
| Where the simulated months end | `ends.edges` 70–130 by 2.5, `ends.all`, `ends.crash` |
| One simulated path | `path.values` (10 years, every 5th day, 505 points), crash on day 1,101: **133.76 → 107.17** |

## Scenes (W = the scene's word index; bold = the subtitle's hero word, where your main lock should land)
- **s2** "Then the interviewer asks: so why does the market quote a different volatility for every **strike?**"
  A wireframe interview desk with two chairs facing each other (real silhouettes: legs, seat, back); a plate
  "INTERVIEWER" with the question typing in ("WHY A DIFFERENT VOLATILITY / FOR EVERY STRIKE?") on W[5]–W[15]. Beside the
  desk, s1's nine small vol columns on the strike row; on W[11] "different" they jump to uneven heights with a "?" marker
  over each (`HUD.marker`), no numbers. Target lock on the columns on W[15].
- **s3** "On October 19th, 1987, the S&P 500 fell **20.47%** in one day."
  A wireframe desk calendar (rings, pages) reading 19 OCT 1987 (a plate on its page area, not text on lines) on W[1]–W[3];
  two index columns, height ∝ level (note "HEIGHT ∝ S&P 500 LEVEL"): FRI 16 OCT 282.70 and MON 19 OCT, which drops on
  W[7] "fell" to 224.84 while the lost slab (57.86 points) explodes off along its axis and scan-erases. Spec card "S&P 500 ·
  ONE DAY" rolls −20.47 % and locks amber on W[8]. "S&P 500 DAILY CLOSES" micro note.
- **s4** "At 20% volatility, a typical day moves 1.26%. So that crash was a **16-sigma** day."
  A wireframe crash column (−20.47%, height 1 unit = 20.47/…; state the scale) and a stack building beside it of 16
  identical "typical day" blocks (1.26% each) plus a 0.2 sliver, dropping one by one with a counter "×1 … ×16.2"
  (W[8]–W[12]); a card "20% ÷ √252 = 1.26% A DAY" on W[7]; on W[13] lock the stack and roll "16.2σ" (amber).
- **s5** "If returns were normal, like Black-Scholes assumes, a day like that would **never** happen. Not once since the Big Bang."
  The normal bell (`bell.normal`) as an extruded wireframe surface (a ribbon with depth, ring-and-longitude topology)
  standing on the pad, x = daily move −5%…+5%; axis ticks on a plate; label "NORMAL CURVE · SD 1.26% A DAY". From W[8], a
  marker far off the left edge "19 OCT 1987 · −20.47% = 16.2σ · OFF THIS CHART" (use a loupe or an arrow leader to
  beyond the frame). On W[12] a card rolls "10⁻⁵⁹" (amber) "CHANCE A DAY". On W[18]–W[19] a plate "SINCE THE BIG BANG:
  13.8 BN YEARS × 252 DAYS → EXPECTED ≈ 4 × 10⁻⁴⁷".
- **s6** "But it **did.** Real returns have fat tails: crashes come far more often."
  On W[2] the biggest change: a three-frame `HUD.glitch`, and the 1987 marker block slams onto the pad's left edge, hot
  white, "IT HAPPENED". On W[6] the fat-tailed curve (`bell.fat`) scans in over the normal one on the same scale (one hot
  line for fat, the normal dimmer), with a loupe on the left tail (−5%…−3.5%, ×25) where the fat curve clearly sits above
  ("LEFT TAIL ×25"). On W[9]–W[11] a card "DAYS WORSE THAN −4σ · ×97 MORE OFTEN · ILLUSTRATIVE".
- **s7** "And what pays in a crash? A low-strike **put.** So traders pay more for it."
  A wireframe price block "STOCK 100" that drops 20% to 80 on W[5]; on W[7]–W[8] a wireframe PUT contract card (thin
  slab with a header band) "PUT · STRIKE 90 · 1 MONTH" and its payoff as columns for S = 70…100 (height max(90 − S, 0));
  on W[11]–W[12] two price cards "ONE VOLATILITY (15.6%) 0.014" and "WITH CRASHES · SIMULATED 0.090" (amber) and "×6.4".
- **s8** "Put that higher price into Black-Scholes and solve for the volatility: it comes out higher. That's **implied volatility.**"
  A wireframe solver machine (a box with a slot on top, a dial ring and a display window) "BLACK–SCHOLES SOLVER"; the
  0.090 token drops into the slot on W[3]–W[4]; on W[7] "solve" the display rolls through trial σ values (a real
  bisection: 25.0 → 17.5 → … → 20.7) and on W[14] "higher" locks "σ 20.7 %" in amber, beside a dim ghost column 15.6%
  (AT THE MONEY); on W[16] a plate "IMPLIED VOL = THE σ THAT GIVES THE MARKET PRICE".
- **s9** "Let's **simulate** it. A stock with 15% volatility that crashes 20% about once every 10 years."
  One simulated path (`path.values`) as a wireframe ribbon over 10 years drawing on (a lateral dolly along it); the crash
  step at day 1,101 goes hot white with a card "−20% CRASH · DAY 1,101: 133.76 → 107.17"; cards "VOLATILITY 15%" on
  W[6] and "ABOUT ONCE EVERY 10 YEARS" on W[12]–W[15]; "ONE SIMULATED PATH · ILLUSTRATIVE MODEL".
- **s10** "Price one-month options at strikes from 80 to 120, on a **million** simulated paths."
  Top-down plan view (the pad as a dial): nine strike tiles in a row (80…120; 80 on W[6], 120 on W[8]); a counter card
  rolls "PATHS 1,000,000" (W[9]–W[12], amber on W[11]); then crane to 3/4 as the histogram of where the million months
  end (`ends.all`, crash paths `ends.crash` hot white) grows as wireframe columns behind the tiles; "8,171 WITH A CRASH ·
  SIMULATED".
- **s11** "At the money, implied vol is 15.6%. At 90, 20.7. At 80, **29.7.** One stock, one model, and the flat line bends into a **smile.**"
  The key scene. s1's nine tickets and columns on the strike row, heights = implied vol / 4% units scaled so 29.7% fits
  (state "HEIGHT ∝ IMPLIED VOL"). Target lock + leader + rolling card for 100 → "15.6" on W[6], 90 → "20.7" on W[9],
  80 → "29.7" on W[12] (each amber on its word); the other six rise after; a flat dim beam at 15.6% on W[19]–W[20] "ONE
  VOLATILITY"; on W[21]–W[24] a hot ribbon draws through the column tops left to right, and on "smile." the whole set
  **ignites once into a solid hologram** (`solid` 0→1, a light `wave` climbing, `HUD.beam`), then settles. "IMPLIED VOL
  BY STRIKE · SIMULATED · 1 MONTH".
- **s12** "So here's the answer: with normal returns and one volatility, implied vol would be **flat** across strikes."
  A plate "THE ANSWER" on W[3]; left on the pad a small normal bell wireframe "NORMAL RETURNS" (W[5]–W[6]); the nine
  columns rise to one level (15.6%) on W[8]–W[12] and a flat beam locks across them on W[14] "flat".
- **s13** "Real returns have fat tails, so low-strike puts cost more, and implied vol **rises** as the strike falls."
  The same set: the bell turns fat-tailed on W[3]; the 80/85/90 columns rise to 29.7/26.4/20.7 on W[7]–W[8] with their
  values rolling (amber); on W[12] "rises" the smile ribbon draws through all tops; on W[15]–W[16] a plate
  "STRIKE ↓  →  IMPLIED VOL ↑".
- **s14** "Comment FORMULA, and we'll DM you the free Quant Formula Sheet. Save this, share it, and follow Desk2Quant for Day 12."
  A wireframe smartphone (rounded slab, screen inset, camera dot) on the pad; on its screen region a dark plate where
  "FORMULA" types into a comment field (W[0]–W[1]) and a DM bubble arrives on W[4] "Hey! Here's your free Quant Formula
  Sheet" with the real cover `assets/covers/formula-sheet.png` (drawn with `drawImage` on a plate: the one `keep`
  image); HUD buttons "SAVE" (W[11]), "SHARE" (W[13]), "FOLLOW" (W[16]); a profile plate on W[17] with the real logo
  `assets/logo.png` (drawImage), "DESK2QUANT", "@desk2quant", "desk2quant.com" (no counts); "DAY 12 →" locks on
  W[19]–W[20]. Hold the full end card for the last 2 s (no scan-erase at the very end: the film ends here). The chip rail
  fades out by itself when s14 starts, so the bottom-left is free for the profile plate (above y 1690).

## Check your work
`cd hyperframes-reels/d2q-day11-hud && HYPERFRAMES_NO_TELEMETRY=1 timeout 300 npx --yes hyperframes@0.9.39 snapshot . --at <film times> --no-end --no-browser-gpu -o out/snap_<you>`
(film time = the scene's start in `work/scene_words.md` + scene time). Check 4–6 times per scene: during the scan-in, on
each lock, mid-scene, and during the scan-erase. Look at every still and fix: anything in the subtitle band or the
trader's box; text not on a plate; values not amber when locked (or amber before); the pad jumping at the start or end
(must be HOME); unreadable sizes; subjects that read as generic boxes. Report the files written, one line per scene,
your scales, and the snapshot folder; keep only final contact sheets. Never mention how the film or its voice was made.
