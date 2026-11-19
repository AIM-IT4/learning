# Day 11: the volatility smile (isometric, with the trader guide)

78 s, 1080 x 1920, in the Day 10 isometric toy world (`d2q-day10`). Every element is what the voice says, drawn in code
from the numbers:
- one σ for every strike;
- the S&P 500's closes either side of 19 Oct 1987 (282.70 → 224.84, −20.47%);
- the crash stacked as 16.2 typical 1.26% days;
- the normal curve's odds (≈ 10⁻⁵⁹ a day, none since the Big Bang);
- an illustrative fat-tailed curve with the same spread;
- the 90 put and its payoff, with a simulated price of 0.090 against 0.014 at one volatility;
- Black–Scholes solving that price for its implied vol (20.7%);
- one simulated path with its crash;
- where a million simulated months end;
- implied vol by strike bending into the smile (29.7% at 80, 15.6% at the money);
- the answer, and the FORMULA end card.

The trader guide is Day 10's, with new σ, ↓ and σ↑ flashcards.

- **Build:** `index.html` and `compositions/` are the HyperFrames build. `bg.html`, `ov.html` and `mc.html` come from
  d2q-day10 (DAY 11/30, new flashcards); `s1`–`s14` are new.
- **Timing:** `tools/timing_d11.py voice/out/timing.json` writes every DATA block, the guide's cues and lip-sync track,
  `work/scene_words.md` and the root `index.html` (voice, music and sound effects).
- **Voice:**
  - VoxCPM2 (Apache-2.0), on CPU, a narrator designed from a text description (`voice/pick.json`, `voice/vox_jobs.json`,
    `tools/vox_gen.py`).
  - `voice/tts_text.json` is the text as fed to the engine. "Black–Scholes" is spelled "Black-Shoals" so it is said right.
  - `tools/vo_check.py` speech-checks every take (numbers spelled out before comparing).
  - `tools/en_vo.py voice/lines_all.json voice/vo_spec.json voice/out` joins the takes and times every word.
- **Music and sound effects:** `tools/bed_d11.py` makes the music bed (synthesised, with `bed_synth.py`).
  `tools/pick_sfx.py` picks the CC0 sound effects by listening.
- **Checks:** `tools/qa_times.py` lists the film times to snapshot for a review.
- **Numbers:** `work/smile.py` writes `work/numbers.json` and asserts its checks. The model's simulation (1,000,000 paths,
  seed 11) agrees with its exact series price within 0.4 vol points at every strike.
- **Not in this repository:** the media (voice takes, music, fonts, sound effects, logo and cover).
- **Brief and caption:** `BUILD_BRIEF_d11.md` is the scene brief; `caption.txt` is the post caption.

Render: `npx hyperframes@0.9.39 render . -q looks --workers 3`. Then master to -14 LUFS, with the gain set by the
measured loudness: `ffmpeg -i in.mp4 -c:v copy -af "volume=<gain>dB,alimiter=limit=0.89:level=false:attack=3:release=60" -c:a aac -b:a 192k out.mp4`.
