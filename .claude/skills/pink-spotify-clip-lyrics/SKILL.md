---
name: pink-spotify-clip-lyrics
description: Build a poetic 16:9 pink lyric video — a tilted 3D pink Spotify-style lyrics card, then motion graphics that follow each line's meaning (a self-drawing neon rose, knockout letters cut from the clip with a fly-through, a cinema letterbox, a dotted footstep path carrying the words, a split screen whose last words turn to dust), with the user's emotional clips playing softly behind the lyrics. Use when the user runs /pink-spotify-clip-lyrics or attaches a song, its lyrics, 1-3 video clips with start times, a cover image and a Spotify logo PNG and asks for a lyric video.
argument-hint: "<song (mp3/clip)> <lyrics> <1-3 clips + start time each> <cover image> <Spotify logo PNG> [\"Title — Artist × Artist\"] [4k]"
---

# Pink Spotify Clip Lyrics

Make a poetic 1920×1080, 30 fps lyric video in **one soft pink world**. It opens on a tilted
pink lyrics card, then each section draws a motion-graphic idea that follows what the line
*means*. The user's clips play softly behind the words. **The clip and the words must both
stay readable, and the clip is never brighter than the lyrics.**

Reference feel: lyric videos such as "Alfaaz" (Hamza Malik × Zain Zohaib). Use that for mood,
pacing and type mixing only. Every frame is drawn by our own code.

## Non-negotiable rules (every run)

1. **Everything is drawn in code.** One HTML `<canvas>` scene is rendered frame by frame in
   headless Chromium (Playwright), and the frames are piped to ffmpeg. The only outside pixels
   are the user's clips, cover image and Spotify logo PNG. No stock footage and no image
   generators. Every visual is a pure function of time `t` with seeded PRNGs, so re-renders and
   parallel chunks are identical.
2. **Word timings come only from forced alignment** (torchaudio `MMS_FA` on the demucs vocal
   stem), using the user's lyrics exactly as written. Never guess, eyeball or interpolate
   timings. If a word aligns badly, re-align that window or ask.
3. **Show a contact sheet of stills before the full render**, then wait for the user's go-ahead.
4. **Ask before overwriting** any existing file in the work or output folder (AskUserQuestion).
5. Deliver a 1920×1080 master MP4 with the original audio and a 720p copy **under 20 MB** for
   WhatsApp. If the user asks for **Instagram Reel size**, also render 1080×1920 (9:16), with its own 720×1280
   WhatsApp copy (see "Reel layout"). Make a 3840×2160 copy **only if the user asks**.

## Inputs

Collect these, and ask for anything that is missing before starting:

| Input | Notes |
|---|---|
| Song | Anything ffmpeg reads. A clip is fine, and the video then covers only that clip. |
| Lyrics | Exactly as sung, with every repetition. Roman, Urdu/Hindi in Roman, or another script: the display keeps the user's text, and alignment uses a `uroman` romanized copy. Never write lyrics from memory. If the user has none, offer a Whisper large-v3 transcription and show it for correction first. |
| 1–3 clips + start times | Emotional clips, each with the time to start from (e.g. `clip2.mp4 @ 0:12`). They must be the user's own or ones they have the rights to use. |
| Cover image | For the card's cover art. |
| Spotify logo PNG | Use the user's PNG **as supplied**: never redraw, recolour or distort it. Keep its aspect ratio and give it clear space. |
| Title + artists | For the card, e.g. `Alfaaz — Hamza Malik × Zain Zohaib`. |
| 4K? | Only if asked (see Delivery). |

Work folder: `pink-spotify/<song-slug>/` with `input/ sep/ analysis/ clips/ scene/ stills/ out/`.
If it already exists, **ask** before reusing or overwriting.

## Setup (once per machine)

```bash
pip install demucs librosa soundfile torch torchaudio uroman numpy
npm i playwright           # if Playwright is already installed, do NOT reinstall the browser
```
- `torchaudio` must provide `torchaudio.pipelines.MMS_FA`. Pin `torchaudio==2.8.*` (CPU wheels from
  `https://download.pytorch.org/whl/cpu`) if a newer version has dropped it. Do not switch aligners.
- **Fonts must be local**, in `scene/fonts/`. Get the TTF URLs from the Google Fonts CSS API (raw GitHub URLs may be blocked):
  ```bash
  curl -sS -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Inter:wght@500;800;900&family=Great+Vibes&family=Instrument+Serif:ital@0;1" \
    | grep -o 'https://fonts.gstatic.com[^)]*\.ttf'    # curl each one; check with `file` that each is TrueType
  ```
  That gives Inter 500/800/900 (card, caps, knockout), Great Vibes (pink script) and Instrument Serif italic.
- Playwright installed globally isn't visible to an ESM `import`. Load it with `createRequire(import.meta.url)`
  and fall back to the global `node_modules/playwright` path.
- **Serve the scene over a local HTTP server** (a tiny Node `http` static server inside `render.mjs`, on
  `127.0.0.1`), not `file://`. Clip frames loaded from `file://` taint the canvas, and then
  `canvas.toDataURL()` throws.

---

## Step 1: Listen, align, and propose the visual plan

**1a. Separate:**
```bash
ffmpeg -i input/<song> -ac 2 -ar 44100 analysis/song.wav
demucs --two-stems=vocals -n htdemucs -o sep analysis/song.wav
```
Transcribe the last 30 s with Whisper to check for a channel promo or voice-over at the end. If
there is one, end the video before it.

**1b. Force-align every word.** Use MMS_FA **with star tokens** between lines, so hums, alaaps
and ad-libs that aren't in the lyrics don't pull words out of place:
```python
import re, torch, torchaudio, uroman as ur
from torchaudio.pipelines import MMS_FA as bundle
U = ur.Uroman(); norm = lambda w: re.sub(r"[^a-z']", "", U.romanize_string(w).lower())
SR, HOP = bundle.sample_rate, 320
wav, sr = torchaudio.load("sep/htdemucs/song/vocals.wav")
wav = torchaudio.functional.resample(wav.mean(0, keepdim=True), sr, SR); n = wav.size(1)
model = bundle.get_model(with_star=True).eval()
WIN, CTX, chunks = 30 * SR, 2 * SR, []                 # 30 s windows, 2 s context (full song would OOM)
for s in range(0, n, WIN):
    a, b = max(0, s - CTX), min(n, s + WIN + CTX)
    with torch.inference_mode(): e, _ = model(wav[:, a:b])
    off, keep = (s - a) // HOP, min(WIN, n - s) // HOP
    chunks.append(e[0, off:off + keep])
emission = torch.cat(chunks)
flat = ["*"] + [x for L in lines for x in [w["norm"] for w in L["words"]] + ["*"]]
spans = bundle.get_aligner()(emission, bundle.get_tokenizer()(flat))   # skip "*" spans when reading
ratio = n / emission.size(0) / SR    # start = span[0].start*ratio, end = span[-1].end*ratio, score = mean(span.score)
```
Write `analysis/timeline.json`. Then check it:
- Flag words with `score < 0.4` or longer than 2.5 s. A held last word often swallows a hum, so
  re-align that line in its own ±2 s window with star tokens on both sides.
- If a vocal stretch has no words, test the hypothesis that a line repeats there: add it, re-align,
  and keep it only if it lands in that gap with good scores.
- If a word is still bad, **show the user and ask.** Never patch a time by hand.

**1c. Beats:** `librosa.beat.beat_track` gives `beats`. For `downbeats`, take the strongest of the
4 phases by onset strength. Also save `energy` (RMS at 10 Hz). Snap section cuts to downbeats
inside line gaps.

**1d. Read for meaning and propose the plan.** Translate the lyrics for yourself if needed. Then
**tell the user**:
- the story in one line;
- one **visual idea per line or pair of lines**, chosen for its meaning: `card` (opening),
  `rose` (love, beauty, longing), `clip-lyrics`, `knockout` (a strong image or statement),
  `letterbox` (a memory or story moment), `path` (walking, waiting, distance, "steps"), `kiss`/`glow`
  (kiss, love, touch), `stars` (night, dreams, wishes) and `split` (the **last line**);
- the section times (snapped to downbeats) and which clip plays behind each section.

Default order if the meaning doesn't decide it: card → rose → clip-lyrics → knockout → letterbox →
path → split. Continue after telling the user; change the plan if they object.

## Step 2: Prepare the clips (exact frames, kept soft)

- **Assign clip time without reuse.** Each section that shows a clip gets a source range starting at
  the user's start time and moving forward. Two sections never use overlapping source frames.
- **Slow to fit.** For each range, set `speed = clamp(available_source / section_duration, 0.4, 1.0)`.
  For speeds below 0.7, use motion-interpolated slow motion so it doesn't stutter.
  If the source is too short even at 0.4×, tell the user. Offer a held last frame with a slow push-in,
  or a different start time. Never loop.
- **Turn each range into numbered frames**, so film frame *f* of a section reads exactly `%05d` = *f*:
```bash
ffmpeg -ss START -t SRC_DUR -i input/clip1.mp4 -vf \
 "setpts=PTS/SPEED,minterpolate=fps=30:mi_mode=mci,fps=30,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080" \
 -frames:v NFRAMES -q:v 2 clips/<section>/%05d.jpg      # drop minterpolate when SPEED >= 0.7
```
  `NFRAMES = round(section_duration * 30)`. Check the count with `ls | wc -l`.
- **Keep them dim and soft** (the "never brighter than the lyrics" rule). In the canvas, draw each clip
  frame with `ctx.filter = "brightness(B) saturate(0.85) blur(1.5px)"`, with B 0.55–0.75 per section. Then add:
  - a **darker gradient on the text side** (plum-black `rgba(20,4,14,0.8)` → transparent across 60% of the width);
  - a faint pink wash (`globalCompositeOperation = "soft-light"`, `#ff7eb6` at 15%).
- **Verify readability.** For every clip section, measure the mean luma of the graded frame under each
  text box (sample about 10 stills). It must be ≤ 0.35 for white text, or lower than the pink text's luma by
  at least 0.4. If not, lower B for that section or strengthen its gradient. Never brighten the text instead.

## Step 3: The pink Spotify-style card (opening)

- **Card face** (offscreen canvas, about 1100×1400 design px):
  - a pink background (`#f06ea9` → `#e04f93` gradient, 40 px radius);
  - top row: **cover art** (the user's image, 120 px square, 12 px radius), the song title (Inter 800), the artists (Inter 500, 75% white), and the **user's Spotify logo PNG** top-right at 56 px height, with its aspect ratio kept;
  - **lyrics**: Inter 800 at about 64 px, line height 1.25, left-aligned, all lines of the opening section.
- **Word state:** upcoming words in dark plum at 55% (`rgba(40,0,20,0.55)`). Each word **fades to white**
  over 0.12 s at its aligned start (60–80 ms anticipation), with a soft glow
  (`shadowColor rgba(255,255,255,0.8)`, blur 18) and **3–5 spark particles** (seeded, rising 30–60 px,
  fading over 0.5 s). Lines already sung stay white.
- **Blur the lines far from the sung one:** per line, `filter = blur(min(8, 2.5·|line − current|) px)`.
  The card also scrolls so the current line sits about 40% down, with an ease-in-out of 0.4 s.
- **Tilt in 3D with a slow camera drift.** Canvas 2D has no perspective, so texture-map the card face
  through a subdivided mesh:
```js
// 3D card corners → camera → screen; draw the face through a 14×14 grid of triangles,
// each with an affine transform + clip (expand each triangle 0.6 px to hide seams)
function drawTri(g, img, s0, s1, s2, d0, d1, d2) { /* solve the affine that maps source triangle s→d, clip to d, drawImage */ }
// rotation: rx = 8° + 2°·sin(0.25t), ry = −14° + 3°·sin(0.18t), rz = −3°; distance drifts slowly; focal ≈ 1.6·H
```
  Add a soft shadow under the card, plus a blurred, darkened copy of the cover art filling the background.

## Step 4: The rose section

- **A neon pink line-art rose that draws itself stroke by stroke.** Define the rose in code as about 20–30
  Bézier strokes: a spiral bud, 5–7 petals, the stem, 2 leaves and a few thorns. Flatten each stroke to a
  polyline and precompute its length. Draw stroke *i* up to `k·length` (partial polyline, round caps) with
  glow passes (`#ff5fa2` core 3 px, `shadowColor #ff2d87` blur 14, then blur 40 at 50%).
  Stagger stroke starts on beats so the drawing breathes with the music (about 3–6 s for the full rose).
  Once drawn, it pulses gently on beats (+6% glow).
- **Stacked lyric blocks** beside the rose (the rose on one third, text on the other two thirds), each line split into
  2–4 rows that **mix three styles**:
  - **Great Vibes** script in pink (`#ff7eb6`), large, for the emotional word;
  - **Inter 800 caps**, tracked 0.18em, white;
  - **Instrument Serif italic**, white at 90%.
  Each word **blurs in** on its aligned start: `blur(14px → 0)`, α 0→1 and 10 px rise over 0.25 s.
  The previous block blurs out as the next begins.
- **Background:** a dark plum radial gradient, or the section's clip at its dimmest (B ≤ 0.55).

## Step 5: Clip sections

**5a. Spotify-style lyrics over the first clip.** Show the clip (dim and soft, Step 2). On the text side,
show 3–4 lines of Inter 800 at about 72 px: past lines white at 85%, the current line's words fading to white
as sung, upcoming lines in pink-tinted grey at 45%. Lines scroll up with an ease-in-out (0.4 s), so it
reads like Spotify lyrics without the card.

**5b. Knockout words.** Big **Inter 900** caps (fit to about 85% of the width, one to three words per line)
with **the clip showing only inside the letters**:
```js
o.fillStyle = pinkGradient; o.fillRect(0, 0, W, H);   // dark clips vanish inside letters: fill the glyphs pink first,
o.globalCompositeOperation = "screen"; o.drawImage(clipFrame, 0, 0, W, H);   // then screen the clip in (B≈1.5)
o.globalCompositeOperation = "destination-in";
o.fillText(word, x, y);                              // keeps clip pixels only inside the glyphs
ctx.fillStyle = "#14040e"; ctx.fillRect(0, 0, W, H); // dark plum around the letters
ctx.drawImage(o, 0, 0);                              // plus a thin pink outline stroke on the glyphs
```
Each word appears on its sung time: a scale 1.06→1 with α. **End with a camera fly-through:**
- pick a point inside one letter's stem (sample the glyph mask for an opaque pixel near the letter's centre);
- scale the whole frame about that point from 1 to about 60 over about 1.2 s (easeInExpo);
- once the letter covers the frame, crossfade to the full clip (normal dim grade), which continues as the next background.

## Step 6: Story sections

**6a. Cinema letterbox.**
- Black bars slide in to a 2.39:1 frame (each bar about 12% of the height, 0.8 s easeInOutCubic) over the dim clip.
- **Subtitles**: Inter 500, about 40 px, white, centred about 9% above the bottom bar, word by word on aligned times.
- **One key word per line in pink Great Vibes script**, larger and placed just above the subtitle, blurring in on its time.
- A slow push-in (scale 1.0→1.05).

**6b. Dotted footstep path.**
- Draw a gentle S-curve **dotted path** across the frame (an arc-length-sampled Bézier; dots every
  14 px; the path itself draws on over the section).
- **Footsteps** are pairs of soft ovals, alternating left and right of the path, appearing one by one as if someone walks it.
- The **lyric's letters are placed along the path**: per word, distribute its letters over the word's aligned
  duration, each at the next arc-length position, rotated to the tangent. Use Inter 800 white, with key words in
  Great Vibes pink.
- **Soft pink glow** on words like *kiss, love, pyaar, ishq, mohabbat* (and the user's own list): a radial
  `#ff5fa2` glow behind the word at 35% that blooms on its sung time and pulses on beats.
- An optional `stars` variant: seeded twinkling stars, with constellation lines that connect on each sung word.

## Step 7: The last line as a split screen

- The frame splits into two halves with a soft 2 px pink seam, sliding open from the centre (0.6 s).
- **Clip side**: the clip (dim grade), with the **first half of the line** in Instrument Serif italic white.
- **Empty side**: dark plum-black, with the **second half of the line** in Inter 800. **After each word is sung it turns to
  dust**: rasterize the word offscreen, sample about 1,500 opaque pixels into particles (seeded), and let them drift
  sideways and up with slight turbulence, shrinking and fading from white to pink to nothing over about 2.5 s.
- Hold on the empty side, then fade to black with the music.

## Step 8: Transitions, audio and finishing

- **Between sections** (on the downbeat), alternate:
  - **soft blur**: a 0.6–0.8 s crossfade while both frames blur up to 18 px at the midpoint;
  - **light leak**: 2–3 large additive pink and peach radial gradients sweeping across over 0.8 s, peaking at the cut.
- **Everywhere:** light film grain (overlay at 4%) and a soft vignette. One pink world: no other accent colours.
- **Audio:** the original song with a 0.5 s fade in and a 1.5 s fade out. No re-mix.

---

## Build: the scene and the renderer

- Work in **1920×1080 design units**. For 4K, render the same scene with `?scale=2`, which sets a 3840×2160 canvas and
  `ctx.scale(2, 2)`, with clip frames extracted at 3840×2160.
- `scene/index.html` loads `data.js` (`window.DATA = {timeline, beats, sections, clips, meta}`), the fonts, the
  cover image and the logo. It exposes `window.ready`, which loads fonts (check with `document.fonts.check`; abort
  on failure), images and the first clip frames. It also lays out every text measurement (card rows, path letters)
  **after** the fonts load.
- `async window.renderFrame(t)` awaits `img.decode()` for the needed clip frames, with a small LRU cache.
- `scene/render.mjs <from> <to> <out.mp4>` starts the local static server, then renders frames with
  `canvas.toDataURL("image/jpeg", 0.96)` piped to
  `ffmpeg -f image2pipe -c:v mjpeg -i - -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30`.
  Store each clip section's real frame count in the data and clamp the frame index to it: the slowed source can come up a frame or two short.
  In bash loops, run ffmpeg with `-nostdin`, or it swallows the loop's input.
  Render 4 parallel chunks and join them with the concat demuxer (`-c copy`). To fix a few seconds,
  **re-render whole chunks**. Never splice a re-rendered piece onto a trimmed stream copy: the timestamps break.
  `--stills t1,t2,… dir` writes PNG stills.

## Contact sheet: required before the full render

Render about 12 stills:
1. the card tilted, with a word lighting up and sparks;
2. the card a moment later (blurred far lines);
3. the rose half drawn;
4. the rose with a three-style block;
5. Spotify-style lyrics over clip 1;
6. knockout words;
7. mid fly-through;
8. letterbox with a script key word;
9. the footstep path with letters;
10. a pink glow word;
11. the split screen with dust;
12. a transition frame.

Tile them with `ffmpeg -i stills/s_%02d.png -vf "scale=480:-1,tile=4x3:padding=8:color=0x14040e" stills/contact_sheet.jpg`.
Look at the sheet yourself first: is every text readable over its clip (the luma check in Step 2), is it one
pink world, is the logo undistorted, and is no clip moment reused? Then **show it to the user** with the plan
table. **Wait for approval.**

## Reel layout (9:16, 1080×1920, when asked)

- Render the same scene with `?w=1080&h=1920`. Every section reads `PORT = H > W` and uses its own layout. **Keep all
  text inside Instagram's safe zone**: about 230 px clear at the top, 400 px at the bottom (caption) and 150 px on the
  right (buttons).
- Extract clip frames per aspect ratio: for 9:16, crop a 608×1080 window around the subject (focus x per clip)
  from the 16:9 source, then scale it to 1080×1920.
- Per section:
  - **card**: larger (scale about 0.8), with less yaw;
  - **rose**: the rose at the top, its lyric block below;
  - **Spotify-style lyrics**: lyrics at the bottom-left inside the safe zone, with the gradient from the bottom;
  - **knockout**: fit each word to 86% of the width;
  - **letterbox**: a central band about 760 px tall, with the subtitles *below* the band;
  - **path**: a vertical S-curve;
  - **split**: top and bottom (the clip on top).

## Final render and delivery

```bash
D=<duration>
ffmpeg -i out/video_noaudio.mp4 -i input/<song> -map 0:v -map 1:a -t $D \
  -af "afade=t=in:d=0.5,afade=t=out:st=$(echo "$D-1.5"|bc):d=1.5" -c:v copy -c:a aac -b:a 192k -movflags +faststart out/<slug>_pink_1080p.mp4
VB=$(python3 -c "print(int(18.6*8*1000*1000/$D/1000 - 96))")k      # WhatsApp: 1280×720, two-pass, 18.6 MB budget (decimal; x264 can overshoot ~1%)
ffmpeg -y -i out/<slug>_pink_1080p.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v $VB -pass 1 -an -f null /dev/null
ffmpeg -i out/<slug>_pink_1080p.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v $VB -pass 2 -c:a aac -b:a 96k -movflags +faststart out/<slug>_pink_720p_whatsapp.mp4
```
Verify the 720p copy is under 20,000,000 bytes (`stat`; decimal MB, as phones count). If it isn't, lower `VB` by 10% and re-encode. Check every file with
`ffprobe`: resolution, 30 fps, an audio stream, the duration, and the frame count (`-count_packets`).
For **4K** (only if asked), render with `?scale=2` and encode at `-crf 18 -preset slow`, with the same audio.

Before writing into `out/`, check for existing files and **ask before overwriting**.

## Final report to the user

- the one-line story;
- the section plan (lines → visual idea → clip range and speed);
- the file paths with their sizes and durations;
- the readability check results per clip section;
- any re-aligned or user-confirmed words;
- offer tweaks: a different idea for a line, script words, clip brightness, section boundaries.
