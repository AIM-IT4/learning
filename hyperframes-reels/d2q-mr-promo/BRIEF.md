# "Comment RISK": a promo reel for the Market Risk Quant Notes & Lab (Ripping look + MadeToScale upgrades)

A ~45 s vertical reel (1080 x 1920, 24 fps, HyperFrames 0.9.39) that sells Desk2Quant's Market Risk Quant Notes & Lab
(VaR, ES, Backtesting & FRTB). The founder approved the CTA "Comment RISK for 50% off": the 50% may be SAID and SHOWN,
but the coupon code itself must never appear anywhere on screen (show it only as a blurred "•••••" chip in the DM card).
No price (no rupee amounts) anywhere. No character or presenter.

## Start from the Day 11 rebuild (the founder's standing template)
Copy the framework of `/home/user/Films/d2q-day11-rip` (read-only; never modify it): index.html structure, `work/kit.js`
(the K kit: paper/grid background, cards with spring/tilt, marker captions, stamps, counters, split-flap digits,
cursor + UI widgets, balls, formula images), `tools/compose.py`, `tools/timing.py` pattern, `tools/master.sh`.
Read its BRIEF.md and README.md first. Keep: light paper with faint grid, D2QSans (Inter Bold) for big type, Share Tech
Mono for small data, brand blue #2563eb colour blocks, hook on frame 1, one big hero per beat, something moving every
second, no large empty areas, the DESK2QUANT plate with the real logo (`../d2q-day11-hud/assets/logo.png`).

## Upgrades learned from @madetoscale2026 (apply them)
Reference sheets (third-party, study only, never copy their brand/wording): a labelled layout frame and a sheet of
16 frames from three @madetoscale2026 reels (kept outside this repository).
1. **Chapter tag + progress line at the TOP** (replaces Day 11's bottom progress strip): under the brand pill, a
   right-aligned mono tag like `● BACKTEST · 03/07` and a thin full-width line that fills chapter by chapter.
2. **Two text layers:** a short **chapter title** (bold, ~64 px, one keyword in the accent colour) at y ~170-260 that
   stays for the chapter, and the **spoken subtitle** lower down (y ~1380-1500), built word by word on the voice, with
   1-2 keywords per phrase in solid accent-colour pills (white text). Keep the bottom ~17% (y > 1600) free of
   important content (Instagram's caption and buttons sit there); fill it with soft decoration only (paper grid,
   faint giant chapter number) so it never looks empty.
3. **Accent colour for this reel: risk red #e03131** (pills, title keywords, stamps), with brand blue for colour-block
   beats and data lines, yellow #ffd43b only for the "50% OFF" moments.
4. **Blur -> reveal** once (the hook) and **proof screenshots** in phone/PDF/browser mockups (the real pages below).

## Voice and timing
`voice/out/vo.wav` (45.38 s, -16 LUFS; place it at film t = 0.12 s) and `voice/out/words.json` are READY: 126 caption
words with on-screen spellings already applied (VaR, FX, FRTB, Kupiec, 141, 4,919, 2024, 50%), each with its start/end
in vo.wav, plus `line_start_word` (chapter starts: p1 0.00, p2 4.10, p3b 10.35, p4 19.55, p5 28.62, p6 34.60, p7 39.40;
the voice ends at 45.14). Film length about 47 s (hold the end card ~1.5 s after the voice). `voice/lines.json` has the 7 lines (TTS spellings: "var" = VaR, "F X" = FX, "F R T B" =
FRTB, "Koopyets" = Kupiec; show the proper spellings on screen). One chapter per line:

| # | Chapter tag | Title (keyword in red) | Line |
|---|---|---|---|
| 01 | VAR · 01/07 | Every interview asks **VaR** | Every market risk interview asks about VaR. Can you show one you've actually built? |
| 02 | THE PACK · 02/07 | Notes **+ Lab** | This is the Market Risk Quant Notes and Lab. 141 pages, 19 modules, 64 interview answers. |
| 03 | BACKTEST · 03/07 | Project 1: **VaR & ES** | Project one: VaR and expected shortfall for a rates and FX desk, backtested over 4,919 days of real data. Kupiec, Christoffersen, traffic lights. |
| 04 | STRESS · 04/07 | Project 2: **FX options** | Project two: an FX options desk. Full revaluation against delta-gamma-vega, stressed through the financial crisis, COVID and the 2024 yen unwind. |
| 05 | FRTB · 05/07 | Project 3: **FRTB** | Project three: FRTB. Standardised versus internal models for five desks, all the way to the capital number. |
| 06 | INSIDE · 06/07 | What you **get** | You get the notes, executed notebooks, a Python risk library and fourteen regression tests. |
| 07 | 50% OFF · 07/07 | Comment **RISK** | Comment RISK, and we'll DM you fifty percent off. The code works for seven days. Save this for your next risk interview. |

## Heroes (real Desk2Quant assets only; every fact from the product page, quoted in the table above)
- **01 Hook:** an interview chat card ("Interviewer · MARKET RISK": "Walk me through a VaR model you've built.") with
  the typing dots, then the answer bubble arrives BLURRED with a lock and a pill "Built one? Let's see". Behind it, a
  big P&L histogram with a 99% VaR line and the ES tail in red (draw it in code; label it ILLUSTRATIVE).
- **02 The pack:** the real cover `/home/user/desk2quant/assets/images/covers/market-risk-quant-notes-lab.jpg`
  (1200x1200) lands big with a spring and a soft shadow; counters roll to 141 PAGES, 19 MODULES, 64 INTERVIEW Q&As
  as chips; then the contents page `/home/user/desk2quant/assets/samples/market-risk-quant/page-2.jpg` slides in
  behind it as proof.
- **03 Backtest:** a dashboard card "Walk-forward backtest · real rates & FX data" whose big number rolls to 4,919
  DAYS; three test chips tick on their words (Kupiec ✓, Christoffersen ✓, Traffic light with green/yellow/red dots);
  the real backtesting page `.../samples/market-risk-quant/page-4.jpg` (Basel traffic light) in a PDF mockup, and/or
  the notes' real figures `/home/user/d2q-private-uploads/notes-kit/src/fig/c_kupiec.png`, `fig_bt.png`.
- **04 Stress:** a toggle card "Full revaluation ⟷ Delta-gamma-vega" flipped by the cursor; stress-scenario cards stack
  in on their words: GFC 2008, COVID 2020, 2022, YEN UNWIND 2024; a red "STRESSED" stamp.
- **05 FRTB:** two big columns "SA" vs "IMA" with five desk chips under them (no capital numbers: we have none to
  quote), the components chips SBM · DRC · RRAO · PLA · IMCC · SES dealing in, and a real notes figure
  (`.../notes-kit/src/fig/c_pla_plane.png` or `c_lh_ladder.png`) as proof; end on "→ capital".
- **06 Inside:** a file grid: Notes PDF (141 pages), Executed notebooks, Python library (market · curves · instruments ·
  risk · backtest · frtb), and a test runner card ticking 14 green checks "14/14 passed".
- **07 CTA (brand-blue block):** a comment card where RISK types in and posts; a DM card from desk2quant with the cover
  thumbnail, "50% OFF" in a yellow marker, "Market Risk Quant Notes & Lab", a blurred code chip "•••••" and "valid 7
  days"; a "Send to a friend preparing for risk interviews" row; SAVE lights on "Save this"; the DESK2QUANT plate (logo,
  @desk2quant, desk2quant.com). The last frame holds.
Do not show page-1.jpg (it carries the author's past-employer line). Never show any bank or employer name.

## Sound
VO at 0.12 (volume 1). An original light, upbeat bed (reuse `../d2q-free10/tools/bed_free10.py` or
`bed_synth.py`, cut to the film length) kept >= 10 dB under the voice while it speaks (the `ceiling()` approach in
`../d2q-day11-hud/tools/bed_hud.py`). CC0 effects from `../d2q-day11-hud/assets/sfx` for stamps, counters, clicks,
the comment send; never on a stressed word. Master: `bash tools/master.sh out/raw.mp4 out/mr_promo.mp4` (-14 LUFS,
-1.5 dBTP, voice loudest).

## Checkpoint first
Build the persistent layers (brand pill, chapter tag + progress line, chapter title, subtitle) and chapters 01, 03 and
07. Snapshot 3-4 moments each into `out/pilot/`, look at every still yourself, then STOP and report. Continue only after
the go-ahead.

## Then
All chapters; stills of every chapter into `out/stills/` (check legibility, overlaps, empty areas, every number vs the
product facts above, labels, no code on screen, no price); render; master; `out/cover.jpg` (the hook frame: chat card +
title, readable in a 3:4 crop); `credits.txt`; `README.md`. Do not commit, push or post anything; report the paths.
