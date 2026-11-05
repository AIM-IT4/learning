---
name: night-glow-lyrics
description: Build a cinematic 16:9 night-blue lyric video (glowing whites, light motes, emotional couple clips that follow each line, an Instagram-style post dive into the title, lyrics whose style changes with the music, last line dissolving into light). Use when the user runs /night-glow-lyrics or attaches a song, its lyrics, 2-4 video clips and the title + artists and asks for a lyric video.
argument-hint: "<song audio (mp3/opus/clip)> <lyrics> <2-4 video clips> \"Song Title — Artist ft. Artist\""
---

# Night Glow Lyrics

Make a 1920×1080, 30 fps lyric video that makes people *feel* the song. The look is
one night-blue world with glowing white light. Clips follow the story of each line, and
the typography changes with the music. Treat it like a music-video edit, not subtitles.

Reference feel: lyric videos such as "Dooron Dooron" (Paresh Pahuja ft. Harleen Sethi).
Use that for **mood only**. Every frame is drawn by our own code: no copied graphics,
no stock footage, no image generators.

## Non-negotiable rules (every run)

1. **Everything is drawn in code.** One HTML `<canvas>` scene is rendered frame by frame
   in headless Chromium (Playwright), and the frames are piped to ffmpeg. The only pixels
   from outside are the user's own clips. Every visual is a pure function of time `t`
   with a seeded PRNG, so a re-render is identical frame for frame.
2. **Word timings come only from forced alignment** (torchaudio `MMS_FA` on the
   demucs vocal stem). Never guess, eyeball or interpolate timings. If a word aligns
   badly, re-align that section or ask the user. Do not make a time up.
3. **Show a contact sheet of stills before the full render**, then wait for the user's go-ahead.
4. **Ask before overwriting** any existing file in the work or output folder (use AskUserQuestion).
5. Deliver **two files**: a master MP4 with the original audio, and a 720p copy **under 20 MB**
   for WhatsApp.

## Inputs

Collect these, and ask for anything that is missing before starting:

| Input | Notes |
|---|---|
| Song audio | Anything ffmpeg can read (mp3, opus, m4a, wav). A clip of the song is fine, and the video then covers only that clip. |
| Lyrics | Exactly as sung, **including every repetition**. Expand `(x2)` and chorus shorthand. Roman/Latin script is best for alignment. If the lyrics are in Devanagari or another script, keep it for display and romanize with `uroman` for alignment only. |
| 2–4 video clips | Emotional, glowing or dreamy couple clips work best. They must be the user's own or ones they have the rights to use. |
| Title + artists | e.g. `Dooron Dooron — Paresh Pahuja ft. Harleen Sethi`. |
| (optional) handle / hashtag | For the Instagram-style post. Default: a handle made from the song slug and `#<title-without-spaces>`. |

Work folder: `night-glow/<song-slug>/` in the current directory, with these subfolders:
`input/ sep/ analysis/ frames/ shots/ scene/ stills/ out/`.
If that folder already exists, **ask** before reusing or overwriting it.

## Setup (once per machine)

```bash
pip install demucs librosa soundfile "torch" "torchaudio" uroman   # torchaudio must provide pipelines.MMS_FA
# Node + Playwright + Chromium (if Playwright is already installed, do NOT reinstall the browser)
npm i playwright
ffmpeg -version   # required
```

Fonts must be local so that every render matches. Download them into `scene/fonts/`:
- `https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf` → `Inter.ttf`
- `https://github.com/google/fonts/raw/main/ofl/instrumentserif/InstrumentSerif-Italic.ttf`
- `https://github.com/google/fonts/raw/main/ofl/instrumentserif/InstrumentSerif-Regular.ttf`

If torchaudio in the environment no longer provides `torchaudio.pipelines.MMS_FA`, install
a version that does (e.g. `torchaudio==2.8.*` with the matching torch). Do not switch to
another aligner.

---

## Step 1: Listen. Separate, align, find beats, read the meaning

**1a. Normalize and separate**
```bash
ffmpeg -i input/<song> -ac 2 -ar 44100 analysis/song.wav
demucs --two-stems=vocals -n htdemucs -o sep analysis/song.wav
# → sep/htdemucs/song/vocals.wav
```

**1b. Force-align every word** (`analysis/align.py`). Normalize each lyric word for the
tokenizer: lowercase, romanized, only `a-z` and `'`. Keep a mapping back to the user's
display text, including punctuation and the original script.

```python
import json, re, torch, torchaudio
from torchaudio.pipelines import MMS_FA as bundle

SR, HOP = bundle.sample_rate, 320                     # 16 kHz, 50 emission frames / s
wav, sr = torchaudio.load("sep/htdemucs/song/vocals.wav")
wav = torchaudio.functional.resample(wav.mean(0, keepdim=True), sr, SR)
n = wav.size(1)
model = bundle.get_model(with_star=False).eval()

# Long songs: emit in 30 s windows with 2 s context each side (full-song attention would OOM)
WIN, CTX, chunks = 30 * SR, 2 * SR, []
for s in range(0, n, WIN):
    a, b = max(0, s - CTX), min(n, s + WIN + CTX)
    with torch.inference_mode():
        e, _ = model(wav[:, a:b])
    off, keep = (s - a) // HOP, (min(WIN, n - s)) // HOP
    chunks.append(e[0, off:off + keep])
emission = torch.cat(chunks)                           # (T, C) log-probs

lines = [...]          # [{ "display": "...", "words": [{"display": "Mitti", "norm": "mitti"}, ...] }, ...]
flat = [w["norm"] for L in lines for w in L["words"]]
spans = bundle.get_aligner()(emission, bundle.get_tokenizer()(flat))
ratio = n / emission.size(0) / SR
# per word: start = spans[i][0].start*ratio, end = spans[i][-1].end*ratio,
#           score = mean(span.score for span in spans[i])
```

Write `analysis/timeline.json`:
`{ duration, lines:[{i, display, start, end, words:[{display, norm, start, end, score}]}] }`.

Then check the alignment:
- Flag every word with `score < 0.4`, or a word longer than 2.5 s, or a gap that makes no sense.
  Re-align just that line's audio window (slice ±2 s, same code). If it is still bad,
  **show the user the table and ask** whether the lyrics differ from what is sung. Never patch a time by hand.
- Spot-check by listening: cut 3 random lines with `ffmpeg -ss start -to end` and
  confirm the words match.

**1c. Beats and energy** (`analysis/beats.py`):
```python
import librosa, numpy as np, json
y, sr = librosa.load("analysis/song.wav", sr=22050, mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
rms = librosa.feature.rms(y=y)[0]; t_rms = librosa.times_like(rms, sr=sr)
onset = librosa.onset.onset_strength(y=y, sr=sr)
# downbeats: of the 4 beat phases, take the one with the highest mean onset strength
```
Save `analysis/beats.json` with `tempo`, `beats`, `downbeats`, and `energy` (RMS at 10 Hz,
normalized 0–1). Mark the sections (intro, verse, pre-chorus, chorus, bridge, outro) from the energy curve and lyric repetition.

**1d. Read the lyrics for meaning.** Translate for yourself if they are not in English.
Find the emotional arc, the **key lines** (hooks, title words, lines on energy peaks or
downbeats), and the **meaning moments**: contrast pairs (e.g. *mitti* / *pari*), distance
words (e.g. *dooron dooron*), and the final line.

**Before building anything, tell the user the story in ONE line**, e.g.
"Two people who can only meet in memory: closeness slips into distance and ends as light."
List the key lines and the meaning moments you plan, then continue.

## Step 2: Watch the clips and build the shot table

**2a. Sample every clip at 2 fps** and look at every frame (use Read on the tiles):
```bash
ffmpeg -i input/clipA.mp4 -vf "fps=2,scale=384:-1" frames/clipA_%04d.jpg   # frame k ≈ t=(k-1)/2 s
ffmpeg -i frames/clipA_%04d.jpg -vf "tile=6x5:padding=4" frames/clipA_sheet_%02d.jpg
```

**2b. Write `analysis/moments.md`.** List every usable moment with an ID, clip, time range,
what happens (holding hands, looking from behind, reaching, alone, embrace, walking away,
silhouette, light flare…), the emotion, the **empty side** (left / right / top / none:
where text can sit beside the people), and the mean brightness. Measure brightness per
moment, e.g. with `signalstats`:
`ffmpeg -ss A -to B -i clip -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG" -f null -`.

**2c. Build the shot table (`analysis/shots.json`).** Map each lyric line, or a pair of
short lines, to the moment that matches its **meaning**.
```json
{ "id": "S07", "moment": "B3", "clip": "clipB.mp4", "src_in": 12.5, "src_out": 17.0, "rate": 1.0,
  "t_in": 48.20, "t_out": 52.90, "lines": [9, 10], "layout": "block|bottom|special",
  "empty_side": "left", "key_word": "pari", "entrance": "rise|slide|scale|letters",
  "grade": { "brightness": 0.82, "contrast": 1.08 }, "push": [1.0, 1.06] }
```
Rules for the shot table:
- **Never use the same moment twice.** Two shots may come from one clip, but never from overlapping time ranges.
- Cut on beats: snap each `t_in` to the nearest beat within ±0.25 s, and to a downbeat at section changes.
- If a moment is shorter than its line, slow it down (`rate` ≥ 0.5). Never loop it.
- Shot 1 must be quiet (no text). Shot 2 is the source for the Instagram post.
- If there aren't enough distinct moments, say so and propose holding longer shots with slow push-ins. Don't reuse moments.

Show the user the shot table (time, line, moment, why it fits) before building the scene.

## Step 3: One look for the whole video

**Extract each shot's frames** at 30 fps, filled to 16:9:
```bash
ffmpeg -ss SRC_IN -to SRC_OUT -i input/clipB.mp4 \
  -vf "setpts=PTS/RATE,fps=30,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080" \
  -q:v 2 shots/S07/%05d.jpg
```

**Grade (drawn in the canvas, per frame):**
1. Draw the shot frame with push-in: scale from `push[0]` to `push[1]` with easeInOutSine
   over the shot, plus `ctx.filter = brightness(b) contrast(c) saturate(0.55)` from the shot's `grade`.
2. Night blue: fill `#0b1f4a` with `globalCompositeOperation = "color"` at α≈0.6, then
   `"multiply"` with `#1a2c5c` at α≈0.25. The result keeps the luminance and makes everything blue.
3. Glowing whites (bloom): redraw the frame with `brightness(1.6) contrast(2.2) blur(18px)` and `"screen"` at α≈0.35.
4. Vignette: radial gradient from transparent to `rgba(2,6,20,0.75)`.
5. **Light motes**: about 60 soft circles (r 1–4 px, white to `#cfe0ff`, α 0.15–0.6) drifting up and sideways.
   Their positions are pure functions of `t` and a seeded `mulberry32` PRNG: no state between frames.
6. Fine film grain (seeded) at α≈0.04.

**Transitions:** crossfades of 0.6–1.0 s between shots. Both shots keep moving during
the fade. No hard cuts except one deliberate cut on a big downbeat if the song hits hard.

**Type system: one family pairing for the whole video**
- Small words: **Inter 300**, ALL CAPS, `ctx.letterSpacing = "0.32em"`, 24–34 px.
- Lyrics: **Instrument Serif italic**, 56–72 px for bottom lines and medium rows, 180–320 px for key words.
- Colour: white `#f5f8ff`. Every text draw has two passes:
  1. dark shadow underneath (`shadowColor rgba(0,4,18,0.7)`, blur 28, offsetY 4), then
  2. soft blue glow (`shadowColor rgba(120,170,255,0.85)`, blur 24, then a second pass at blur 60, α 0.5).
- Behind any text block, draw a soft radial dark scrim (`rgba(2,8,24,0.35)`) so the text always wins.
- Load fonts with `@font-face` from `scene/fonts/`. Before rendering, run
  `await document.fonts.load(...)` for each face and assert `document.fonts.check(...)`.
  If either fails, abort.

## Step 4: Opening

1. **Quiet open:** shot 1 graded, slow push-in, motes, no text, for the instrumental
   intro (until about 4 s before the first sung word, at least 3 s).
2. **Instagram-style post:** a phone-width card (about 560×860, rounded 28 px, dark
   `#0a0f1e` at 0.85 α, soft shadow) rises in at centre. Draw it generically: no official
   logos or trademarks. It contains:
   - a header with an avatar circle (gradient ring), the handle, and `•••`;
   - a square media area **playing shot 2's frames** with the same grade;
   - a row of heart, comment, share and save icons drawn with paths; the heart pops once, filled red-pink;
   - a likes count that ticks up (e.g. `24,318 likes`);
   - the caption: the handle in bold plus **a lyric line** (the first hook), then `#<hashtag>` in light blue.
3. **The dive:** ease the camera into the media area (scale until the square fills the
   frame, about 1.2 s, easeInCubic). Shot 2 is then full-frame.
4. **Title lands:** the song title in huge glowing Instrument Serif italic (letter-by-letter
   fade and rise, 40 ms stagger), with the artists below in Inter 300 tracked caps. Hold it,
   then let it fade out with a slight blur-up **before the first sung word**.

## Step 5: Lyrics that change with the music

Every word appears at its **aligned start time** (lead by 60–80 ms) and is fully visible by its end time.
Lines exit with a fade plus blur-up 0.3 s before the next line or the next cut.

**Hierarchy block** (key lines, choruses, energy peaks), placed in the shot's `empty_side`:
```
  SMALL TRACKED CAPS ROW          ← Inter 300, the words before the key word
  Key                             ← one huge Instrument Serif italic word
  medium serif italic row         ← the rest of the line
```
- Cycle entrances so that no two blocks in a row share one: **slide** (from the empty
  side, 60 px, easeOutCubic), **rise** (from 40 px below), **scale** (from 0.92 with blur
  12→0), and **letters** (per-letter fade and rise, staggered across the word's aligned duration).
- Animate the key word's entrance on the beat closest to its sung start, if within ±0.12 s.

**Bottom line** (verses, in-between lines): one centred line at y≈0.86 H, serif italic
56–64 px, revealed word by word on the aligned times. Already-sung words stay at α 1;
upcoming words at α 0.

**Mix both:** about one block for every 2–3 lines. Never more than 3 bottom lines in a
row, and never a block on two consecutive lines unless it is the chorus hook. It must never
look like captions.

## Step 6: Meaning moments (layout `special`)

- **Contrast pair** (e.g. *mitti* / *pari*): split the line into two words. The earthy
  word is grey and dusty (`#8d929c`, no glow, grain texture clipped to the glyphs, dust
  particles falling off). The other word is white and glowing, with sparkles
  (four-point stars twinkling around it, seeded). Each word lands on its own aligned time.
- **Distance words** (e.g. *dooron dooron*): the letters drift apart one by one. Their x
  offsets grow with time after being sung, with a slight blur and fading α, so the word
  physically separates.
- **Last line** (e.g. *kahan main*): rasterize the line to an offscreen canvas, sample about
  3,000 bright pixels into particles, and after the last word ends let them rise and
  scatter with bloom. The whole frame lifts to a soft blue-white glow, then fades to black.
  Every particle path is seeded and a function of `t`.

## Step 7: Light control and audio

- For every shot, check the graded frames: if the mean luma under the text area is above
  about 0.55, or highlights clip, lower `brightness` (down to 0.65) and raise `contrast`
  slightly, **per shot**, in `shots.json`. Text must always win.
- Audio: the original song, with a short fade in (0.5 s) and fade out (1.5 s). No re-mix and no loudness changes.

---

## Build: the scene and the renderer

`scene/index.html` loads `timeline.json`, `beats.json`, `shots.json` and the fonts, and exposes:
- `window.ready`, a Promise that resolves after the fonts load and the first frames decode;
- `async window.renderFrame(t)`, which draws frame `t` (seconds) onto the 1920×1080 canvas. It awaits
  `img.decode()` for the needed shot frames (keep a small LRU cache of decoded images).

`scene/render.mjs` renders a frame range and pipes it to ffmpeg:
```js
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
const [, , from, to, out] = process.argv;                 // frame numbers, output path
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto("file://" + path.resolve("scene/index.html"));
await page.evaluate(() => window.ready);
const ff = spawn("ffmpeg", ["-y", "-f", "image2pipe", "-framerate", "30", "-c:v", "png", "-i", "-",
  "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-r", "30", out],
  { stdio: ["pipe", "inherit", "inherit"] });
for (let f = +from; f < +to; f++) {
  await page.evaluate((t) => window.renderFrame(t), f / 30);
  const png = await page.screenshot({ type: "png" });
  if (!ff.stdin.write(png)) await once(ff.stdin, "drain");
}
ff.stdin.end(); await once(ff, "close"); await browser.close();
```
Use flags such as `--allow-file-access-from-files` if `fetch()` of local JSON is blocked, or
inline the JSON into the page. Render in 4–6 parallel chunks of frames and join them with the
concat demuxer (`-f concat -c copy`). This works because every frame depends only on `t`.

## Contact sheet: required before the full render

Render about 12 stills with `renderFrame` at key times: the quiet open, the post card,
mid-dive, the title, two hierarchy blocks (different entrances), two bottom lines, the
contrast pair, the distance words, the brightest shot, and the final dissolve. Then:
```bash
ffmpeg -i stills/s_%02d.png -vf "scale=640:-1,tile=4x3:padding=10:color=0x050a18" stills/contact_sheet.jpg
```
Look at it yourself first: is the text readable on every still, is the grade consistent,
and is there no reused moment? Then **show it to the user** (send or attach the image),
together with the shot table summary. **Wait for approval or changes** before the full render.

## Final render and delivery

```bash
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 analysis/song.wav)
# master: video + original audio with fades
ffmpeg -i out/video_noaudio.mp4 -i input/<song> -map 0:v -map 1:a \
  -af "afade=t=in:d=0.5,afade=t=out:st=$(echo "$D-1.5" | bc):d=1.5" \
  -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart out/<slug>_night_glow_1080p.mp4

# WhatsApp copy: 720p, < 20 MB. Two-pass with a computed bitrate (19 MB budget, 96k audio)
VB=$(python3 -c "print(int(19*8*1024*1024/$D/1000 - 96))")k
ffmpeg -y -i out/<slug>_night_glow_1080p.mp4 -vf scale=1280:720 -c:v libx264 -b:v $VB -pass 1 -an -f null /dev/null
ffmpeg -i out/<slug>_night_glow_1080p.mp4 -vf scale=1280:720 -c:v libx264 -b:v $VB -pass 2 \
  -c:a aac -b:a 96k -movflags +faststart out/<slug>_night_glow_720p_whatsapp.mp4
```
Verify that the 720p file is under 20 MB (`stat`). If it isn't, lower `VB` by 10% and re-encode.
Check both files with `ffprobe`: 1920×1080 or 1280×720, 30 fps, an audio stream, and duration ≈ song.

Before writing into `out/`, check for existing files and **ask before overwriting**.

## Final report to the user

- the one-line story;
- the paths of both MP4s with their size and duration;
- the shot table (line → moment), and which lines got blocks, bottom lines or special treatments;
- any alignment words that were re-aligned or confirmed with the user;
- offer tweaks (a different key word, a different moment for a line, a brighter or darker grade).
