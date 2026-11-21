# Day 12/30 · Making Quant Easy: "CVA in 16 lines"

A 103.2 s vertical reel (1080 x 1920, 24 fps) made with HyperFrames 0.9.39, in Desk2Quant's new code-along lesson format:
a chart card on top explains one idea at a time while a light code editor below types the matching Python on the words
of the narration. The lesson prices the CVA of a 5-year, $100m receive-fixed swap in the 16 lines of
`work/cva_reel.py`: simulate the rates, take the exposure, price the default, add it up ($64,563). The narration is the
ElevenLabs "Eric" take, tightened as on the RISK promo (every pause over 0.36 s cut to 0.30 s; same words and speed):
`assets/vo.wav`, 101.10 s, placed at 0.12 s; the last word ends at film 100.70 and the call to action holds 2.5 s, to
103.2 s. The natural take and its timings are kept as `voice/out/vo_v1_natural.wav` and `words_v1_natural.json`. There
is no presenter or character. The spec is `BRIEF.md`; the framework is `../d2q-mr-promo` (read only).

**Rules followed:**

- No price, discount or code anywhere; no bank, employer or other brand name or logo; only the real logo.
- The code on screen is `work/cva_reel.py` exactly (inlined line by line; the syntax colouring keeps every character).
- Every number on screen comes from `work/numbers.json` (written by `work/numbers.py`, which runs the code) or
  `work/facts.json` (the BCBS 2011 statistic), built in code, never typed by hand.
- Simulated data is labelled "simulated", the one made-up drawing "illustrative"; the footer says "simulated rates ·
  illustrative inputs · education only · not financial advice".

## Output

- `out/day12_cva.mp4`: the mastered reel (103.2 s; -14.1 LUFS integrated, true peak -1.8 dBTP, LRA 1.8 LU; `tools/master.sh`).
- `out/raw.mp4`: the unmastered render.
- `out/cover.jpg`: the cover, the hook frame at 11.2 s, just after the 16 lines brighten and before the series card (the
  title, $64,563 with the EE hump and "↓ in 16 lines of Python", the whole brightened file with its "16 lines" badge and
  the console's `cva()` result). Everything important sits in the profile grid's 3:4
  crop, `out/cover_3x4.jpg`.
- `out/stills/`: 86 stills of every beat and cue at the tightened take's times, with `contact-sheet-1.jpg` to `-10.jpg`.
- `out/pilot/`: the checkpoint stills (before the go-ahead fixes).
- `credits.txt`: voice, data source, fonts, music and sound effects.

## Layout (Instagram-safe)

- **y 0-120:** paper only (Instagram's top overlay).
- **Brand pill** (the real logo + DESK2QUANT) centred at y 132.
- **Tag row** at y 194: MAKING QUANT EASY · DAY 12/30 left, desk2quant.com right.
- **30-day strip** y 222-240: days 1-11 ink, 12 brand blue with a soft pulse, 13-30 outlined.
- **Title** "CVA in 16 lines" ("CVA" in brand blue), baseline y 326; subtitle "What a client's default costs the bank".
- **Chart card** x 60-1020, y 384-984: white, long soft shadow, steelL border; it never moves, the lessons change inside
  it (0.3 s cross-fades and short slides).
- **Section row** y 1000-1044: the section label (left) and the agenda simulate › exposure › default › CVA (right; done
  steps ink, the current one blue and underlined, the rest steel).
- **Code card** x 60-1020, y 1056-1630: a title bar (`cva_day12.py`, `python`), 16 numbered rows (JetBrains Mono 21 px,
  29 px apart, the longest line ends at x ~885), a light syntax theme in brand colours, a brand-blue block caret,
  active rows (blueL tint + a 4 px blue bar), walk-through dimming, 3 px token underlines and a `>>>` console strip.
- **Footer** at y ~1662; below y 1690 only decoration (the paper grid, a faint giant "12").
- **Right edge:** below y 1150 nothing important passes x 960 (checked on the stills).

## The beats (film = vo + 0.12 s)

| Beat | Section | What happens |
|---|---|---|
| b01 0-11.9 | the 2008 lesson → where we're going | Frame 1: the outlined 2/3 \| 1/3 bar with a "?" in each part, the finished code at 35 %. 2/3 fills blue, 1/3 red ("actual defaults"), the "?" turns into CVA letter by letter, "the price of default risk, going up" with an illustrative spread sparkline; then the result preview ($64,563, the EE hump) while the code brightens, the "16 lines" badge pops and the console prints `cva()`. |
| b02 11.9-14.4 | series · day 12 | The code erases upward; the series card (MAKING QUANT EASY, DAY 12/30, the 30-day strip; day 12 lights on "twelve"). |
| b03 14.4-24.4 | the big picture | BANK and CLIENT, the fixed and floating legs, the client defaults, "$ owed to us" is lost, the CVA price tag, swap / FX forward / option + CVA. |
| b04 24.4-32.7 | inputs → output | Three slots fill: EXPOSURE, DEFAULT, RECOVERY (40 %); arrows into one CVA box: "one number". |
| b05 32.7-45.6 | step 1 · simulate | The deal ticket (5-year swap, $100m, we receive fixed) over the trade's payment timeline: years 0-5 with a payment dot each year, "$100m notional", and on "receive fixed" a blue arrow up ("fixed in") and a steel arrow down ("floating out") at each payment; then 40 of the 10,000 rate paths; they morph into swap values; red where rates rose, blue where they fell. |
| b06 45.6-57.3 | step 2 · exposure | The negatives collapse onto zero; "lost if they default"; the paths dim and the EE curve draws; the peak: $1.74m at 20 months. |
| b07 57.3-70.4 | step 3 · default | S = 120 bp, R = 40 %, λ = S / (1 − R) = 1.2% / 0.6 = 2% a year; the PD curve answers the year-5 "?": 9.5% by year 5. |
| b08 70.4-80.6 | step 4 · add it up | CVA = (1 − R) × Σ DF(t) × EE(t) × ΔPD(t), each term boxed as named (lanes for EE, ΔPD, DF), then the 60 monthly slices and Σ = $0 → $64,563. In the tightened take "Add it up. C V A:" runs on, so the sum builds through "C V A" and lands (with the lock) in the pause after "A:". |
| b09 80.6-85.5 | the answer | $64,563 with a yellow highlighter; ≈ $65k on a $100m 5-year swap; ≈ 1.4 bp a year on the swap rate (6.5 bp upfront). |
| b10 85.5-94.6 | interview question | Why does exposure peak a third of the way in? √t × (T − t) peaks at T/3 = 20 months. |
| b11 94.6-103.2 | recap → your turn | Four steps light with their code lines; then "Comment CVA" (the biggest type on screen), the comment sends, the notebook DM arrives; "Day 13 tomorrow". |

## Checks (on the final render and stills)

- The code on screen is `work/cva_reel.py` exactly: the inlined lines equal the file, and the syntax colouring keeps
  every character of all 16 lines.
- Motion: frame differences on `out/raw.mp4` at 12 fps find no stretch longer than 1.5 s without movement in the chart
  card, the code card or the frame.
- Layout: on all the stills, nothing dark sits right of x 960 below y 1150, and nothing below y 1690 but decoration.
- Typing: every line's window runs from a cue word to a later one and ends before the next line starts (asserted in
  `tools/timing.py`), so the typing speed follows the narration.
- Sound: the bed sits at least 10.6 dB under the voice wherever it speaks (20 ms frames and the 400 ms block check);
  the 16 effects are at least 1.5 s apart and none starts on, or runs into the onset of, a stressed word
  (`tools/timing.py` checks both, drops an optional click or tick that cannot fit a pause and reports it, and lists the
  voice level at each cue in `work/timing.md`).
- `npx --yes hyperframes@0.9.39 check`: 0 errors; the only warnings are the composition files' size (the kit is inlined
  into each layer, as in d2q-mr-promo).

## How it is built

- **Timing:** `tools/timing.py` is the single source of truth. It reads `voice/out/words.json` (315 words with their
  onsets and beats). Every time is a word's onset, an offset from one, or a silence between two words (found in
  `assets/vo.wav`), never a clock time: a cue names its word and, to pick the right occurrence, the time the brief gave
  for it in the natural take (`words_v1_natural.json`, the same 315 words). Re-timing the narration needs only a new
  `words.json` and `vo.wav`; the film length is the last word + 2.5 s. It writes:
  - every composition's DATA line: the beat windows and cues, the section row, and the code card's whole schedule
    (lines typed, active lines, walk-through dimming, token underlines, console outputs, the badge);
  - the sound-effect cues, checked: at least 1.5 s apart and never on a stressed word;
  - `index.html` and `work/timing.md` (readable, with the voice level at each effect).
- **Layers** (canvas, drawn per frame as a pure function of time; code in `work/scenes/<id>.js`; `tools/compose.py`
  writes `compositions/<id>.html`, inlining the fonts, `work/numbers.json`, `work/facts.json`, the code file and the
  kit `work/kit.js`):
  - `bg`: paper, grid, the chart card's frame, the faint "12".
  - `hud`: brand pill, tag row, 30-day strip, title, section row with the agenda, footer.
  - `code`: the editor and its console.
  - `b01`-`b11`: the beats, each inside the chart card. `b05` and `b06` draw the same simulated-paths chart
    (`K.simChart`), so the hand-over between them is invisible.
- **Sound:** the voice at 1; an original lo-fi bed (`assets/bgm.wav`, 103.2 s, `tools/bed_day12.py`) at 0.75, at least
  10.6 dB under the voice while it speaks (20 ms ceiling and 400 ms block check), faded over the last 1.5 s; 16 CC0
  effects from `assets/sfx` at 0.035-0.09.

Rebuild:

```
python3 tools/compose.py bg hud code b01 b02 b03 b04 b05 b06 b07 b08 b09 b10 b11
python3 tools/timing.py
~/.local/share/earshot/.venv/bin/python tools/bed_day12.py 103.2 assets/bgm.wav assets/vo.wav   # the bed (already built)
npx --yes hyperframes@0.9.39 snapshot . --at 0.2,6.13,11.2,13.63,46.78,55.95,80.5,94.26,101.02 --no-end --no-browser-gpu -o out/stills
npx --yes hyperframes@0.9.39 render . -q looks --workers 3 --no-browser-gpu -o out/raw.mp4
bash tools/master.sh out/raw.mp4 out/day12_cva.mp4
bash tools/make_cover.sh 11.2
```
