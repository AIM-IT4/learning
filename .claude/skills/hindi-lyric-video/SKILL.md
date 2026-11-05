---
name: hindi-lyric-video
description: Build a soft 16:9 Hindi lyric video in Devanagari — each sung line writes itself in ink, grapheme cluster by grapheme cluster (matras and conjuncts never break, the shirorekha stays whole within a word), like handwriting on an old diary page with stains, foxing and fibres, while light rain never stops falling, inked footprints walk across the page one step per beat, the camera glides along their path at each new verse, and small ink drawings (a heart, a moon, two paths meeting, an umbrella) draw themselves on key words. Also renders a 9:16 Reel. Use when the user runs /hindi-lyric-video or attaches a Hindi song MP3 and its lyrics in Devanagari (one line per row) and asks for a Hindi / Devanagari / diary / rain lyric video.
argument-hint: "<Hindi song mp3> <lyrics in Devanagari, one line per row> [\"Title — Artist\"] [credits] [key words → drawings] [reel]"
---

# Hindi Lyric Video

Make a quiet 1920×1080, 30 fps lyric video where a Hindi song is written into an old diary
while it rains. Every line is handwritten in Devanagari ink exactly when it is sung, a little
offset from the line before; footprints walk across the paper on the beat; the camera follows
their path from verse to verse; small ink drawings bloom on the key words.

Reference feel: Hindi lyric videos such as "Barsaat" (Banjaare). Use it for **mood, pacing and
the diary feel only**. Every frame is drawn by our own code.

## Non-negotiable rules (every run)

1. **Everything is drawn in code.** One HTML `<canvas>` scene is rendered frame by frame in headless Chromium
   (Playwright), and the frames are piped to ffmpeg. Paper, stains, rain, ink, footprints and drawings are all code.
   No stock footage, no image generators. Every visual is a pure function of time `t` with seeded PRNGs (mulberry32),
   so a re-render, or any chunk rendered in parallel, is identical.
2. **Word timings come only from forced alignment** (torchaudio `MMS_FA` on the demucs vocal stem). Align a **uroman
   romanization** of the user's Devanagari words, but **always show the Devanagari** on screen. Never guess, eyeball or
   interpolate timings. If a word aligns badly, re-align that window or ask.
3. **Show a contact sheet of stills before the full render** (both aspect ratios if a Reel is asked for), then wait for the go-ahead.
4. **Ask before overwriting** any existing file in the work or output folder (AskUserQuestion).
5. Deliver a 1920×1080 master MP4 with the song as **AAC 256k**, plus a 720p copy **under 20 MB** for WhatsApp.
   If the user asks for a Reel, also a 1080×1920 master and its 720×1280 WhatsApp copy.

## Inputs

| Input | Notes |
|---|---|
| Hindi song | An MP3 (anything ffmpeg reads). A clip is fine; the video then covers only that clip. |
| Lyrics in Devanagari | One sung line per row, **with every repetition written out**, exactly as the user wrote them (keep nukta: ज़, ख़, क़, फ़). Never write lyrics from memory. If the user has none, transcribe with Whisper large-v3 (`language="hi"`) and show the cleaned Devanagari for correction first; say clearly that it was transcribed. |
| Title + artist, credits | The title is written first, in Devanagari; a Latin subtitle and the credits are optional. |
| Key words → drawings (optional) | Otherwise you choose them from the meaning (Step 5) and tell the user. |
| Reel? | Only if asked (see "Reel layout"). |

Work folder: `hindi-lyric/<song-slug>/` with `input/ sep/ analysis/ scene/ stills/ out/`. If it exists, **ask** before reusing or overwriting.

## Setup (once per machine)

```bash
pip install demucs librosa soundfile torch torchaudio uroman numpy opencv-python-headless
npm i playwright          # if Playwright is already installed, do NOT reinstall the browser (never `playwright install`)
```
- `torchaudio` must provide `torchaudio.pipelines.MMS_FA` (pin `torchaudio==2.8.*` CPU wheels if needed). Do not switch aligners.
- **Fonts must be local**, in `scene/fonts/`:
  ```bash
  curl -sS -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Tiro+Devanagari+Hindi" \
    | grep -o 'https://fonts.gstatic.com[^)]*\.ttf'      # curl each one; check with `file` that each is TrueType
  ```
  **Kalam 400** (handwritten Devanagari + Latin) for the lyrics, subtitle and credits; **Tiro Devanagari Hindi** for the title.
  "Hind" is the clean alternative if the user wants print instead of handwriting. With the old `Mozilla/4.0` user agent the API
  returns the **full** font (all scripts) — never a Latin-only subset; still assert Devanagari in `ready` (below).
- Load Playwright in `render.mjs` with `createRequire(import.meta.url)`, falling back to `/opt/node22/lib/node_modules/playwright`.
- **Serve the scene over a local HTTP server** (Node static server in `render.mjs`, `127.0.0.1`), not `file://` (the paper image would taint the canvas).

---

## Step 1: Listen. Separate, romanize, align, beats

**1a. Separate:**
```bash
ffmpeg -i input/<song>.mp3 -ac 2 -ar 44100 analysis/song.wav
demucs --two-stems=vocals -n htdemucs -o sep analysis/song.wav
```
Transcribe the last 30 s with Whisper to check for a channel promo; if there is one, end the video before it.

**1b. Romanize each Devanagari word for the aligner only:**
```python
import re, unicodedata, uroman as ur
U = ur.Uroman()
dev = [unicodedata.normalize("NFC", l.strip()) for l in open("analysis/lyrics_devanagari.txt", encoding="utf-8") if l.strip()]
norm = lambda w: re.sub(r"[^a-z']", "", U.romanize_string(w).lower())     # तुम्हें → tumhem, ख़्वाबों → khvaabom
words = [[{"d": w, "norm": norm(w)} for w in line.split()] for line in dev]  # punctuation stays on the display word
```
Drop words that normalize to empty (pure punctuation) from the alignment but keep them on screen. Keep one display word per
aligned word: **the Devanagari list and the aligned list must have the same count and order** (assert it in the build script).

**1c. Force-align** with MMS_FA and **star tokens** between lines (they absorb alaaps, "hey"s and humming):
```python
import torch, torchaudio
from torchaudio.pipelines import MMS_FA as bundle
SR, HOP = bundle.sample_rate, 320
wav, sr = torchaudio.load("sep/htdemucs/song/vocals.wav")
wav = torchaudio.functional.resample(wav.mean(0, keepdim=True), sr, SR); n = wav.size(1)
model = bundle.get_model(with_star=True).eval()
WIN, CTX, chunks = 30 * SR, 2 * SR, []                 # 30 s windows, 2 s context (the full song would OOM)
for s in range(0, n, WIN):
    a, b = max(0, s - CTX), min(n, s + WIN + CTX)
    with torch.inference_mode(): e, _ = model(wav[:, a:b])
    off, keep = (s - a) // HOP, min(WIN, n - s) // HOP
    chunks.append(e[0, off:off + keep])
emission = torch.cat(chunks)
flat = ["*"] + [x for L in words for x in [w["norm"] for w in L] + ["*"]]
spans = bundle.get_aligner()(emission, bundle.get_tokenizer()(flat))   # skip "*" spans when reading
ratio = n / emission.size(0) / SR    # start = span[0].start*ratio, end = span[-1].end*ratio, score = mean(span.score)
```
Write `analysis/timeline.json` (`lines[i].words[j] = {display (Devanagari), norm, start, end, score}`). Flag `score < 0.4` or > 2.5 s,
re-align those lines in their own ±2 s window; a long held word (प्यार over 2 s) may score low and still be right — listen first.
If a word is still bad, **show the user the table and ask**.

**If the timings already exist in another form** (e.g. a romanized timeline), map the Devanagari **by word index** inside each line, and
assert the counts match before rendering. Never re-time by hand to make them fit.

**1d. Beats:** `librosa.beat.beat_track` → `beats` (one footprint per beat). Save `analysis/beats.json` with `tempo`, `beats`, `downbeats`.

**1e. Verses and views.** Group lines into verses (2–3 lines each, a chorus block, a repeated pair). Each verse gets its own **view** of the
page; the camera glides to the next view in an **instrumental gap of ≥ 1.8 s** between lines (≈2 s, easeInOutSine). Tell the user the plan
(verse → lines → key words → drawing).

## Step 2: Old paper and rain

- **Paper tile** (`analysis/make_paper.py`, tileable 2048², periodic FFT noise so it repeats invisibly): base `#e4cea8`, tooth (σ≈1/300),
  mottling (1/14), large blotches (1/5), clipped fibre noise, faint laid lines (cos with 64 periods > 0.985). Warmer in the darks (BGR gain `1.25, 1.05, 0.9`).
- **World-space ageing** (seeded, drawn after the tile so it moves with the camera): ~26 **stains** (radial gradients, half of them coffee
  rings: darker band at 0.86–0.95 of the radius, squashed and rotated) and ~400 **foxing** spots in small clusters (`rgba(140,85,40,.12–.37)`, r 1–5.5 px).
- **Vignette:** radial `rgba(60,38,18,0.42)` at the corners, plus a 5% cool blue-grey cast for the rainy day.
- **Rain that never stops** (screen space, a pure function of `t`): ~200 streaks per 1920×1080, two depths (near: 2300 px/s, 90 px, α .30,
  1.8 px; far: 1500 px/s, 45 px, α .18, 1.1 px) — fainter than that disappears on the paper, slanted 0.2 px per px, each a dark `rgba(55,70,95)` line with a white highlight 1.2 px to its
  right; `y = (y0 + v·t) mod span`. **Drops landing on the page:** one every 0.18 s (seeded per slot index `k`, so it is deterministic): a
  splash ring expanding for 0.3 s, then a wet spot (`rgba(95,80,55,.13)` with a darker rim) that dries over 2.6 s.

## Step 3: Devanagari written in ink, grapheme by grapheme

- **Font and ink:** Kalam 400 at ~86 px (16:9) / ~84 px (9:16) — Kalam's Devanagari runs small for its size, so go bigger than for Latin —, blue-black ink `#1b2142`; **fresh ink** starts darker (`rgb(10,14,40)`) and
  dries to the ink colour over 0.9 s; a 1.5 px ink-bleed shadow at 35%.
- **Diary layout:** each line 1–2 rows (split long lines at the comma / a phrase break), left-aligned with its own indent (+40–90 px from
  the line before), a seeded tilt (±0.6°) and ±2 px baseline jitter, ~130 px apart. Shrink a row's font if it would pass the right limit (and log it).
- **Grapheme clusters, never code points:**
  ```js
  const SEG = new Intl.Segmenter("hi", { granularity: "grapheme" });
  function clusters(word) {             // a cluster that ends in virama joins the next one, so conjuncts (प्य, म्ह, ख़्व) never split
    const o = []; for (const { segment: c } of SEG.segment(word)) { if (o.length && /्$/.test(o[o.length - 1])) o[o.length - 1] += c; else o.push(c); }
    return o; }                         // "ख़्वाबों" → ["ख़्वा", "बों"], "तुम्हें" → ["तु", "म्हें"]
  ```
  (Older ICU splits after a virama; the merge makes it safe either way. Matras, nukta, anusvara and chandrabindu stay inside their cluster.)
- **Cluster edges:** `prefix[k] = measureText(first k clusters joined)` measured **after the fonts load**, made monotonic with `max`
  (a prefix ending in a half-form can measure wider than the shaped whole). The last edge is the whole word's width.
- **Reveal:** render the **whole word** (one `fillText`, so HarfBuzz shapes it and the shirorekha is one continuous line) into a small
  offscreen canvas, then `destination-in` a horizontal gradient that is opaque up to `edge − 16 px` and transparent at `edge + 2 px`,
  and draw that onto the page. `edge = lerp(prefix[i], prefix[i+1], frac)` with `i = floor(p·clusters)`; the word starts 40 ms before its
  aligned start and takes `min(max(end − start, 0.25), 0.12·clusters + 0.12)` s. A pre-base i-matra (ि) is inside its cluster, so it
  appears with its consonant, never before it. Never draw clusters one by one with separate `fillText` calls: that breaks the headline,
  the reph and the conjunct shaping.
- A **dip-pen nib** (steel gradient, slit and breather hole, dark holder, soft shadow) rides the writing edge at headline height.
- When the next line starts, the earlier lines of the same view fade to ~72%.
- **Title** (first view, top left): Tiro Devanagari Hindi ~66 px written the same way from t≈0.8 s, then a Kalam ~32 px Latin subtitle. Credits
  at the end of the last view in Kalam ~34 px (two rows in 9:16).
- In `window.ready` load and **check Devanagari coverage**: `document.fonts.load('400 40px Kalam', 'सोचेंगे')` and `document.fonts.check(…, 'सोचेंगे')`; throw if false.

## Step 4: Footprints on the beat, and the camera along the path

- **Path:** a Catmull–Rom curve through 5 seeded points per view along its lower band (16:9: y ≈ 920 in view space, points alternating
  ±50 px; 9:16: y ≈ 1460, alternating ±120 px so the steps spread out on the narrow frame), one view
  after another, plus lead-in/out. Draw it as a very faint dotted pencil guide (`rgba(27,33,66,.10)`, dash 2/9).
- **Walker:** its x moves linearly across each view while that verse plays and on through the camera glides (anchors: view start +120 px at
  t=0 → view end −160 px when the glide starts → next view +200 px when it ends …). **One footprint per beat** at `pathAtX(walkerX(beat))`,
  alternating left/right of the path (±11 px along the normal), rotated to the tangent.
- **Print:** an inked shoe (forefoot ellipse 8×5.2, heel 5.2×4.2, four toe dots, all ×1.3), mirrored for the right foot, ±14 px off the path. It stamps on in 0.1 s
  (scale 1.18→1, α 0→0.62) with a few ink spatter dots, stays, then fades to 0.22 after ~7 s, so a trail stays on the paper.
- **Camera:** each verse view is a world position; between verses ease over ~2 s; a slow ±6 px drift so it never feels frozen.

## Step 5: Story moments on key words

Pick **one key word per line** from the meaning (tell the user), draw a small ink drawing **beside its line** that starts on that word's
aligned start and draws stroke by stroke in ~1.5 s (stroke duration ∝ length, 30 px pen-lift gaps, 3.4 px round-capped ink, a small ink pool
where each stroke starts). Default ideas: प्यार → a heart (on its repeat, an arrow through the same heart), दिल / बेक़रार → a heartbeat line
under a small heart, ख़्वाब / सपना → a crescent moon with stars, याद → a little photo frame with two heads, मिलना → two dashed paths meeting
under a heart, बारिश / any rain line → an umbrella over a heart, plus an umbrella, a train, a lamp, a letter for the user's own story words.
Icons are polylines in local units (±100) scaled to the layout; keep each in the free side of its view and never over text.

## Reel layout (9:16, 1080×1920, when asked)

- Same scene with `?w=1080&h=1920`; all positions live in a per-aspect table (`L169`, `L916`): views, glide times, title, rows per line
  (`[firstWord, lastWord, x, y]`), font size, icon positions, credits, path band.
- **Instagram safe zone for all text:** ≥ 230 px from the top, ≥ 400 px from the bottom, ≥ 150 px from the right (rows end at x ≤ 925);
  the build warns when a row leaves it. Every line is split into 2 rows; ~84 px Kalam.
- Icons sit to the right of the short second rows or in the band under the text; never two icons in the same spot (check repeated key words); the footprint path runs at y≈1460 (above the caption band).
- Rain count scales with the frame area; the views glide the same way.

## Build: the scene and the renderer

- `analysis/build_data.py` → `scene/data.js`: `{lines: [{i, display, start, end, words: [{d (Devanagari), rom, s, e, sc}]}], beats, meta}` in
  video seconds, with the word-count assert and a printout `देवनागरी=roman(uroman)@time` for every word so you can eyeball the mapping.
- `scene/index.html` → `@font-face` for Kalam and Tiro, `data.js`, `hindi.js`. `window.ready` loads fonts (assert Devanagari), the paper tile,
  builds path, steps, stains, rain, lays out text and icons **after** the fonts load, and returns a summary (cluster test of a conjunct word,
  counts, layout warnings) that `render.mjs` prints — check that `ख़्वाबों` comes back as `ख़्वा|बों`.
- `scene/render.mjs --w W --h H <fromFrame> <toFrame> out.mp4` (local static server, `toDataURL("image/jpeg", 0.96)` → ffmpeg mjpeg → libx264
  crf 16, 30 fps); `--stills t1,t2,… dir` writes PNGs. 2 parallel chunks (more if the machine is free), concat demuxer `-c copy`; to fix seconds
  re-render whole chunks. In bash loops call ffmpeg with `-nostdin`.

## Contact sheet: required before the full render

For each aspect ratio ~12 stills: the title being written; a line mid-write with the nib (zoom one still to 200% on a conjunct and a
pre-base ि to check nothing breaks); a full first verse with its icons; footprints stamping on a beat; a camera glide between verses; the
second verse with the moon / photo; the paths-meeting drawing; the third verse; rain + drops on a quiet moment; the credits; the end.
Tile with `ffmpeg -i stills/<ar>/s_%02d.png -vf "scale=640:-1,tile=3x4:padding=6:color=0x2a2018" stills/contact_<ar>.jpg`.
**Look at them yourself**: every matra attached, headlines continuous, text readable over stains and rain, icons not on text, safe zones in
9:16. Then show the user with the verse table and **wait for approval**.

## Final render and delivery

```bash
D=<duration>; N=$((D*30)); HN=$((N/2))
node scene/render.mjs --w 1920 --h 1080 0 $HN out/169_a.mp4 & node scene/render.mjs --w 1920 --h 1080 $HN $N out/169_b.mp4 & wait
printf "file '169_a.mp4'\nfile '169_b.mp4'\n" > out/169.txt && ffmpeg -nostdin -f concat -safe 0 -i out/169.txt -c copy out/v_169.mp4
ffmpeg -nostdin -i out/v_169.mp4 -i input/<song>.mp3 -map 0:v -map 1:a -t $D \
  -af "afade=t=in:d=0.5,afade=t=out:st=$(echo "$D-1.5"|bc):d=1.5" -c:v copy -c:a aac -b:a 256k -movflags +faststart out/<slug>_hindi_169.mp4
VB=$(python3 -c "print(int(19*8*1024*1024/$D/1000 - 96))")k           # WhatsApp: two-pass, 19 MB budget, 96k audio
ffmpeg -nostdin -y -i out/<slug>_hindi_169.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v $VB -pass 1 -passlogfile out/wa169 -an -f null /dev/null
ffmpeg -nostdin -i out/<slug>_hindi_169.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v $VB -pass 2 -passlogfile out/wa169 -c:a aac -b:a 96k -movflags +faststart out/<slug>_hindi_169_720p_whatsapp.mp4
```
Same for 9:16 (`--w 1080 --h 1920`, `scale=720:1280`, its own `-passlogfile`). Rain and paper grain are expensive at low bitrates: if the
720p copy looks blocky, add `-tune grain` before lowering the bitrate. Verify each WhatsApp copy < 20 MB (`stat`). Paper grain and rain make two-pass x264 overshoot by ~1%, so loop until the file is < 19.5 MB decimal, multiplying `VB` by 0.9 each time. Then check
every file with `ffprobe`: resolution, 30 fps, frame count (`-count_packets`), duration, AAC audio (256 kb/s on the masters). Ask before
overwriting anything in `out/`; delete temporary chunks afterwards.

## Final report to the user

- the verse plan (verse → lines → key word → drawing) and the camera glide times;
- whether the Devanagari was supplied or transcribed (and what you corrected), and the word-count check;
- the file paths with sizes, frame counts and durations;
- weak-score / re-aligned words;
- offer tweaks: ink colour, writing speed, rain amount, footprint size, which key words get drawings.
