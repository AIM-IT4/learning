# Day 12/30 · Making Quant Easy: "CVA in 16 lines" (code-along lesson reel)

A ~116 s vertical reel (1080 x 1920, 24 fps, HyperFrames 0.9.39) for tonight's 9 PM IST post. New format for
Desk2Quant: a narrated **code-along lesson**. A chart card on top explains each idea while a light code editor below
types the matching Python, in sync with the narration. The founder studied this format from another creator
(@quantfinancetogo); we take the FORMAT (chart over code, code typed on the words, real numbers from a short file,
numbered series, payoff-first hook, recap) but our OWN look: Desk2Quant's light paper brand, not their dark/amber
terminal look. Reference sheets (third-party, study only, never copy their wording, colours, terminal-cursor kicker or
numbered episode-chip row): a labelled layout frame and a sheet of 12 beats from four of their reels (kept outside
this repository).

Rules: no price, discount or code anywhere; no presenter/character; never say how the narration was made; no employer or bank names;
simulated data labelled "simulated"; every number on screen comes from `work/numbers.json` (or `work/facts.json` for
the 2008 stat); the code on screen is EXACTLY `work/cva_reel.py` (16 lines, character for character).

## Inputs (all in this folder)
- Voice: `assets/vo.wav` (ElevenLabs "Eric", loudnormed, 113.87 s). Place it at film t = 0.12 s.
- Word timing: `voice/out/words.json`: every script word with its onset `t` (seconds into vo.wav) and its beat
  (b01-b11); `beats` gives each beat's start. Film time = t + 0.12. Script: `voice/lines.json`.
- Numbers: `work/numbers.json` (from `work/numbers.py`, which runs `work/cva_reel.py`): cva_usd 64563, cva_m 0.0646,
  cva_bp 6.46, running_bp 1.41, ee_peak_m 1.736 at ee_peak_t 1.667 y (20 months), lam 0.02, pd5 0.0952, the EE profile
  `ee` (60 monthly points), `pd`, `dpd`, `df`, `contrib` (60 monthly CVA contributions), `cum`, and 40 sample paths
  `rate_paths_pct` (rate moves in %) and `value_paths_m` (swap values in $m) on the 60-point grid `t`.
- Fonts: `assets/fonts/D2QSans.ttf` (Inter Bold: titles, big numbers), JetBrains Mono 400/700
  (`assets/fonts/JetBrainsMono-{400,700}-{latin,latinext}.woff`: code, tags, labels; declare both subsets with their
  unicode-range or just load latin + latinext under one family). Real logo `assets/logo.png`.
- Framework to copy (read-only, never modify): `/home/user/Films/d2q-mr-promo` (the RISK promo the founder approved):
  its index.html structure (scene hosts + audio clips + persistent layers), `work/kit.js` (the K kit: paper + grid
  background, brand pill with the real logo, white cards with long soft shadows, springs, counters, stamps, pills),
  `tools/compose.py`, `tools/timing.py` pattern (read words.json, write DATA lines + index.html + timing.md),
  `tools/master.sh`, `tools/bed_mr.py` (bed), `tools/make_cover.sh`, CC0 effects in `assets/sfx` (+ `PICKS.json`).
  Read its README.md first. Render: `npx --yes hyperframes@0.9.39 render . -q looks --workers 3 --no-browser-gpu -o
  out/raw.mp4`; stills: `npx --yes hyperframes@0.9.39 snapshot . --at <t,...> --no-end --no-browser-gpu -o <dir>`.

## Layout (1080 x 1920, Instagram-safe)
- y 0-120: paper only (Instagram's top overlay).
- **Brand pill** centred at y 132 (real logo + DESK2QUANT), as in the RISK promo.
- **Tag row y 194:** left `MAKING QUANT EASY · DAY 12/30` (JetBrains Mono 700, 24 px, ink); right `desk2quant.com`
  (mono 400, 24 px, steel).
- **30-day strip y 222-240, x 60-1020:** 30 small rounded ticks; 1-11 filled ink, 12 filled brand blue with a soft
  pulse, 13-30 outlined steelL. This is our series device (instead of numbered chips).
- **Title** centred, D2QSans 62 px, baseline ~y 326: `CVA in 16 lines` with "CVA" in brand blue. **Subtitle** y ~360,
  mono 24 px steelD: `What a client's default costs the bank`.
- **Chart card** x 60-1020, y 384-984: white, radius ~26, the kit's long soft shadow, 2 px steelL border. All lesson
  graphics live here, one idea at a time, thin clean lines, bold labels.
- **Section row y 1000-1044:** left the section label (mono 700, 28 px, brand blue, with a ● bullet), right the agenda
  `simulate › exposure › default › CVA` (mono 22 px): done steps ink, current step blue + underline, upcoming steel.
- **Code card** x 60-1020, y 1056-1630: background #fbfaf7, radius ~22, steelL border, light shadow.
  - Title bar 44 px: three muted dots, filename `cva_day12.py`, right `python` (steel).
  - 16 numbered rows (numbers 1-16 always visible, steel), line-height ~29 px, JetBrains Mono 400 ~21 px, left pad
    so the longest line (59 chars) ends before x ~900. Lines are PRE-PLACED at their final line numbers and typed
    when the narration reaches them (so lines can appear out of order).
  - Light syntax theme in brand colours: keywords (import, as, def, return) blueD bold; function names after def ink
    bold; numbers greenD; comments steel; everything else ink. Block caret in brand blue (blinks when idle).
  - Active line(s): blueL row tint + 4 px brand-blue bar at the left edge. During walk-through moments (hook, b09-b11)
    non-active lines drop to ~40 % opacity. Sub-span highlight = a 3 px brand-blue underline under the exact tokens.
  - Output console strip inside the card's bottom (y ~1582-1622, above a dashed divider): one line, mono 20 px,
    `>>> ...` results that update as functions are "run" (texts below).
- **Footer y ~1662:** `simulated rates · illustrative inputs · education only · not financial advice` (mono 19 px,
  steel, centred).
- **Below y 1690:** decoration only (paper grid, a very faint giant "12"). Keep key text left of x 960 for y > 1150
  (Instagram's buttons).

## Look
Desk2Quant brand from the kit: paper #f3efe6 with faint grid, ink #0d1526, brand blue #2563eb (exposure, rates, active
code), blueL #dbe6fd, red #e03131 (default, losses), steel greys, yellow #ffd43b only as a highlighter stroke under the
final answer. Charts: thin precise lines, light gridlines, small mono axis labels, bold labels for what matters.
Something moves at least every ~1.5 s, but calmly: this is a lesson, not a hype reel. Cross-fades and short slides
(0.25-0.35 s) between ideas inside the chart card; the frame around it never jumps.

## Beats (times = vo seconds; film = +0.12). Cue words in quotes are in words.json.
**b01 hook 0.00-13.50, section "the 2008 lesson" then "where we're going".** Frame 1 is complete (no fade from blank).
- Code card shows the whole 16-line file at ~35 % from frame 1 (the finished code).
- Chart card: heading `Counterparty credit losses, 2007-09`, source line bottom-right `Source: Basel Committee (BCBS),
  June 2011`. One wide bar split 2/3 | 1/3 (outlined grey at frame 1). "two-thirds" 1.94: the left 2/3 fills brand blue
  with a big white `2/3`. "weren't defaults" 3.76-4.10: the right 1/3 fills red, label `1/3 actual defaults`; the blue
  part shows `?`. "C V A" 5.80-6.54: `?` becomes `CVA`. "the price of default risk, going up" 7.10-8.68: sub-label
  under the blue part `the price of default risk, going up` + a small rising spread sparkline marked `illustrative`.
- "By the end of this video" 9.70: chart cross-fades to the finished result preview: the EE hump (blue area) and a big
  `$64,563` with `CVA of a 5-year swap` (section label -> "where we're going").
- "sixteen lines of Python" 11.34-12.32: the 16 lines brighten top to bottom (30 ms stagger), a `16 lines` badge pops
  in the code title bar, console shows `>>> cva()  →  0.0646   # $m = $64,563`.
**b02 series card 13.50-16.40.** At ~13.3 the code card empties (lines erase upward fast; caret on line 1) and a big
card covers the chart area: `MAKING QUANT EASY` (mono 700, blue, letter-spaced), `DAY 12/30` (D2QSans ~120 px), `CVA ·
counterparty credit risk` (mono 28 px), and a large copy of the 30-day strip where tick 12 lights on "twelve" 15.02.
At ~16.2 it lifts away and the chart card returns.
**b03 big picture 16.40-27.80.** Line 1 types at "When" 16.40. Diagram: BANK and CLIENT boxes; on "swap" 17.26 two
arrows draw: CLIENT → BANK `fixed`, BANK → CLIENT `floating`. "go bust" 19.30-19.46: CLIENT shakes, turns red, `✕
default`. "owing the bank money" 20.04-20.74: a `$ owed to us` chip on the arrow to the bank strikes through red
`lost`. "C V A is what that risk costs today" 21.85-23.80: a price tag on the bank side `CVA = what that risk costs
today`. "every derivatives desk prices it in" 24.90-26.68: three chips `swap + CVA`, `FX forward + CVA`, `option +
CVA`.
**b04 inputs → output 27.80-36.95.** Three input cards appear on their words: "what the client could owe us over
time" 29.00-30.50 `EXPOSURE · what they could owe us, over time` (mini blue hump) and code lines 2 and 4 type; "how
likely they are to default" 30.94-32.22 `DEFAULT · how likely` (mini red rising curve); "how much we'd recover"
32.68-33.54 `RECOVERY · how much we get back` (40 % ring) and code line 3 types. "One output: the C V A" 34.65-36.42:
arrows into a `CVA` box → `one number`.
**b05 simulate 36.95-51.25.** Trade chips on their words: `5-year swap` 38.20, `$100m` 39.48, `we receive fixed`
41.18 (line 2 goes active at 38.20; line 5 types 40.90-41.56). "We simulate ten thousand paths for rates" 42.55-44.40:
axes (x years 0-5, y `rate move, %`), the 40 `rate_paths_pct` draw left to right over ~1.6 s, tag `10,000 simulated
paths (40 shown)`; lines 6-7 type ~42.6-45.4. "If rates rise, the swap moves against us" 45.60-47.96: the same 40 paths
morph into `value_paths_m` (y `swap value, $m`), negative parts tint red on "against" 47.70 with label `rates up → we
owe the client`; line 8 types 46.9-48.4. "If they fall, the client owes us" 48.80-50.52: positive parts tint blue,
label `rates down → client owes us`. Console ~50.6: `>>> v = swap_values(10_000)   # 10,000 paths × 60 months`.
**b06 exposure 51.25-64.46.** "Exposure keeps only what the client owes us" 51.25-53.52: negative parts collapse to
zero; lines 9-10 type. "because that's what we lose if they default" 54.40-56.10: label `lost if they default` by
the positive area. "Average it over the paths, and you get the expected exposure" 57.35-60.02: paths dim to ~15 %,
y-axis eases to 0-2.0 ($m) and the bold blue EE curve (`ee`) draws left to right, label `expected exposure EE(t)`.
"It peaks at about one point seven million, twenty months in" 61.50-63.86: peak dot + dashed drop line at 20 months,
label `$1.74m at 20 months`; console `>>> exposure(v).max()  →  1.74   # $m, at month 20`.
**b07 default 64.46-78.46.** "Next, default." clears to a PD panel (x years 0-5, y 0-12 %). Chips: `credit spread
S = 120 bp` on "credit spread" 66.40; `recovery R = 40%` on "forty percent recovery" 69.98-70.48. "credit triangle"
71.20-71.44: formula `λ = S / (1 − R)` (lines 11-12 type 71.2-73.4); "two percent a year" 73.70-74.32: `= 1.2% / 0.6 =
2% a year`. "nine and a half percent chance of default in five years" 75.44-77.88: the red PD curve (`pd`) draws, end
label `9.5% by year 5`; console `>>> default_prob()[-1]  →  0.095`.
**b08 add it up 78.46-89.96.** "Now combine them, month by month" 78.46-80.20: formula across the card top:
`CVA = (1 − R) × Σ DF(t) × EE(t) × ΔPD(t)`; line 13 types ~78.9. Term boxes + code sub-spans on their words:
"exposure" 81.30 box EE(t) (blue) + line 14 types; "chance they default that month" 82.62-83.72 box ΔPD(t) (red) +
line 15 types; line 16 types ~84.4-86.0; "discount factor" 84.88 box DF(t) + underline `np.exp(-r * t)`; "sixty
percent we lose" 86.52-87.32 box (1 − R) `= 60%` + underline `(1 - R)`; "Add it up" 88.40: box Σ + underline
`np.sum`, and the 60 monthly `contrib` bars build left to right under the formula while a counter runs `Σ = $0 →
$64,563` (from `cum`, in $).
**b09 the answer 89.96-95.70.** Big `$64,563` (D2QSans ~150 px, yellow highlighter stroke) with `≈ $65k on a $100m
5-year swap`; console `>>> cva()  →  0.0646   # $m`. "one point four basis points a year on the swap rate"
92.66-94.96: chip `≈ 1.4 bp a year on the swap rate`, small steel `(6.5 bp of notional upfront)`. Lines 13-16
active, others ~40 %.
**b10 interview 95.70-106.88.** "Interview favourite" 95.70: an `INTERVIEW Q` card (white, blue left border) with
`Why does exposure peak a third of the way in?` (D2QSans ~40 px); ~98.9 it docks as the chart heading. "Early on,
rates haven't moved much" 99.70-101.38: dashed blue curve `how far rates can move ∝ √t`; underline `dx` in line 8
(active). "Near the end, few payments are left" 102.55-104.04: steel line `payments left ∝ (T − t)`; underline
`(T - t)` in line 8. "The peak sits in between" 105.20-105.90: their product draws as the bold blue hump with the peak
marker at T/3 = 20 months and chip `EE(t) ∝ (T − t)·√t → peak at T/3`.
**b11 recap + CTA 106.88-113.36, end hold to film 116.0.** Four chips light in order with their code lines active:
`simulate` 106.88 (lines 5-8), `exposure` 108.02 (9-10), `default` 109.30 (11-12), `add it up` 110.15 (13-16).
"Comment C V A" 111.20-111.78: the chips give way to a CTA card: a comment field where `CVA` types and sends (~112.0),
then a DM bubble `cva_day12.ipynb · here's your notebook` with a notebook icon; text `Comment CVA → we'll DM you the
notebook`; small `Day 13 tomorrow` from ~113.4. Hold and breathe (gentle pulses) to the end.

## Sound
VO at film 0.12, volume 1. An original calm, focused bed (lo-fi study feel; adapt `../d2q-mr-promo/tools/bed_mr.py`
to 116.0 s) kept >= 10.6 dB under the voice while it speaks (its ceiling() + block check), 1.5 s fade-out. CC0 effects
from `../d2q-mr-promo/assets/sfx` at low level: `chip` for cards/chips docking, `lock` for the peak marker and the
answer stamp, `send` for the comment send, `end` at the end hold; optional very soft `type` ticks only at the start of
a typed line. Never on a stressed word; at most one effect per ~1.5 s. Credits in `credits.txt` (sounds, fonts).
Master: `bash tools/master.sh out/raw.mp4 out/day12_cva.mp4` (-14 LUFS, -1.5 dBTP).

## Checkpoint first
Build the persistent layers (background, brand pill, tag row, 30-day strip, title, section row, code card engine with
typing, active lines, sub-span underlines and console, footer) plus beats b01, b02, b06 and b08. Snapshot film times
0.2, 2.6, 6.7, 11.9, 15.2, 52.5, 60.4, 63.2, 82.9, 89.2 into `out/pilot/`, look at every still yourself (legibility,
overlaps, the code exactly as `work/cva_reel.py`, right-edge rule, nothing important below y 1640), then STOP and
report. Continue only after the go-ahead.

## Then
All beats; stills of every beat and every cue into `out/stills/` (+ a contact sheet), check them yourself; render;
master; `out/cover.jpg` from the hook frame at film ~12.2 s (title + code + `$64,563`, readable in a 3:4 crop);
`credits.txt`; `README.md` (what it is, layout, how it is built, rebuild commands). Do not commit, push or post
anything; report the paths and anything you could not do.
