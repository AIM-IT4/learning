# "Comment RISK": Market Risk Quant Notes & Lab promo

A 53.4 s vertical reel (1080 x 1920, 24 fps) made with HyperFrames 0.9.39. The narration is the ElevenLabs "Eric" take
(`voice/out/vo.wav` = `assets/vo.wav`, 52.27 s, no pause longer than 0.36 s, placed at 0.12 s); the end card holds ~1.5 s
after it. The earlier takes (`voice/out/vo_v1_joined.wav`, `vo_v2_vox_continuous.wav`) are kept but not used. It sells the Market Risk Quant Notes & Lab
(VaR, ES, Backtesting & FRTB) in seven chapters, in the Day 11 Ripping look (`../d2q-day11-rip`) with the MadeToScale
upgrades from `BRIEF.md`. There is no presenter.

**The MadeToScale upgrades:**

- a chapter tag (● BACKTEST · 03/07) and a progress line, both at the top;
- a chapter title with its keyword in risk red;
- a spoken subtitle with red keyword pills (yellow only for "50% off");
- the blur → reveal hook (the locked answer opens into the real cover);
- proof pages in a PDF viewer.

**Rules followed:**

- No price or rupee amount appears anywhere.
- The coupon code never appears; it is shown only as a blurred "•••••" chip.
- Illustrative drawings are labelled ILLUSTRATIVE.

## Output

- `out/mr_promo.mp4`: the mastered reel (−14.0 LUFS integrated, true peak −1.9 dBTP, LRA 1.6 LU).
- `out/raw.mp4`: the unmastered render.
- `out/cover.jpg`: the cover. It is the 4.1 s hook frame, just before 02 (the blurred answer with its lock and the "Built one? Let's see" pill), with the title moved inside the profile grid's 3:4 crop (`tools/make_cover.sh`); `out/cover_3x4.jpg` is that crop.
- `out/stills/`: stills of every chapter, and of every chapter change mid-transition (`change-mid`, 0.10 s in) and as its first word lands (`change-landed`, 0.24 s in), plus `_contact-sheet-*.jpg`.
- `out/pilot/`: the checkpoint stills (from the first cut, with the joined VoxCPM voice).
- `caption.txt`: the Instagram caption.
- `dm_risk.txt`: the DM text, for the auto-DM. It holds the coupon code and is never shown on screen.

## How it is built

- **Timing:** `tools/timing.py` is the single source of truth. It reads `voice/out/words.json` (126 words; the voice is placed at 0.12 s) and the voice file's length. Chapter 07's words are found by their text (`IX`), so "we'll" or "we will" both work. From it, it writes:
  - the 7 chapter windows;
  - every composition's DATA line;
  - the subtitle pages and keyword pills;
  - the sound-effect cues, checked so that none sits on a stressed word;
  - `index.html`;
  - `work/timing.md`.
- **Layers** (code in `work/scenes/<id>.js`; `tools/compose.py <id> ...` writes `compositions/<id>.html`, inlining `work/kit.js` and `work/facts.json`):
  - `bg`: paper or the blue block, the grid, and the giant chapter number.
  - `hud`: the brand pill, the tag, the progress line and the chapter title.
  - `ov`: the subtitles. The hook's first phrase is on screen from frame 1, faint, and lights word by word.
  - `c1`–`c7`: the chapters. `c2` continues `c1`'s picture through `K.hook` to open the lock.
  - Chapters change mid-sentence (the voice has no pauses): each chapter starts 0.16 s before its first word; the old
    cards fade and lift 60 px over 0.2 s while the new ones deal in within ~0.2 s; the tag and title land on the first
    word. `K.floor()` clears every scene's pixels below y 1352–1392, so no card is ever drawn over the subtitle.
  - Something moves at least every second: the histogram is collected left to right before "VaR"; tags pop on the cover
    on "Notes" and "Lab"; a 1-of-3 dot, the ES marker and THE DESK land on their words; a spot-shock marker sweeps the FX
    chart; waiting stress slots shimmer and each lands with a ring; "vs" pops on "versus"; five dots flow from the desks
    into CAPITAL; notebook cells keep running; a shine runs along the 14/14 bar; the 07 clock turns, 50% OFF glints and
    SAVE pulses through the end hold.
- **Facts:** every product fact on screen comes from `work/facts.json`, which is the product page as quoted in the brief.
- **Sound:**
  - Voice at 1.
  - Original music bed `assets/bgm.wav` at 0.75, with a 1.2 s fade-out. It is built by `tools/bed_mr.py` and held at least 10.6 dB under the voice while it speaks, both by the template's ceiling() and by a 400 ms block check (block_ceiling()).
  - CC0 effects from `assets/sfx` at 0.045–0.11.
  - Credits are in `credits.txt`.

Rebuild:

```
python3 tools/compose.py bg hud ov c1 c2 c3 c4 c5 c6 c7
python3 tools/timing.py
~/.local/share/earshot/.venv/bin/python tools/bed_mr.py 53.4 assets/bgm.wav assets/vo.wav   # the bed (already built)
npx --yes hyperframes@0.9.39 render . -q looks --workers 3 --no-browser-gpu -o out/raw.mp4
bash tools/master.sh out/raw.mp4 out/mr_promo.mp4
bash tools/make_cover.sh 4.1
```
