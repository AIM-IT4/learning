---
name: night-city-lyrics
description: Build a dreamy 16:9 handwritten lyric video — a star of light stretches into a line and opens into a big hand-drawn eye with a starry iris while the title fades in, two eyes under a full moon glance at each other, two silhouettes walk a purple dusk hill, a night skyline's windows flicker on one by one, a cream memory page draws itself (teacups, a polaroid, two hands making a heart), and on a pink bokeh sunset the two silhouettes walk toward each other and stop close together; every lyric writes itself in warm gold script along a glowing line of light. Also renders a 9:16 Reel. Use when the user runs /night-city-lyrics or attaches a song (MP3 or clip), its lyrics and the title + artist and asks for a dreamy / night city / handwritten lyric video.
argument-hint: "<song (mp3/clip)> <lyrics> \"Title — Artist\" [reel]"
---

# Night City Lyrics

Make a dreamy 1920×1080, 30 fps lyric video in **flat silhouettes and soft gradients**. It opens on a
hand-drawn eye, tells a small love story across a dusk hill, a night city, a memory page and a sunset,
and every lyric **writes itself in warm gold script** along a thin glowing line of light that curves
through the sky like a path.

Reference feel: "Akhiyaan" (MITRAZ) night-city handwritten lyric videos, from *Ye likho ye milega*.
Use it for mood, pacing and type only. Every frame is drawn by our own code.

## Non-negotiable rules (every run)

1. **Everything is drawn in code.** One HTML `<canvas>` scene is rendered frame by frame in headless
   Chromium (Playwright), and the frames are piped to ffmpeg. No stock footage, no photos, no image
   generators. Every visual is a pure function of `t` with seeded PRNGs (mulberry32), so re-renders and
   parallel chunks are identical.
2. **Word timings come only from forced alignment** (torchaudio `MMS_FA` on the demucs vocal stem),
   using the lyrics **exactly as written**. Never guess, eyeball or interpolate timings. A word is
   written on exactly when it is sung.
3. **Show a contact sheet of stills before the full render**, then wait for the user's go-ahead.
4. **Ask before overwriting** any existing file in the work or output folder (AskUserQuestion).
5. Deliver the 1920×1080 master MP4 with the original audio (short fade in and out) and a 720p copy
   **under 20 MB** for WhatsApp. If a Reel is asked for, also 1080×1920 plus its 720×1280 WhatsApp copy.
6. **Words never cover the people** (silhouettes, eyes): they live in the empty sky or on the path.

## Inputs

| Input | Notes |
|---|---|
| Song | Anything ffmpeg reads. A clip is fine; the video then covers only that clip. |
| Lyrics | Exactly as sung, with every repetition. Roman, Hindi/Urdu in Roman, or another script: the display keeps the user's text (for Devanagari use a script that covers it, e.g. Kalam), alignment uses a `uroman` romanized copy. Never write lyrics from memory; if none are given, offer a Whisper large-v3 transcript for correction first. |
| Title + artist | For the opening title under the eye, e.g. `Akhiyaan — MITRAZ`. |
| Reel? | Whether to also render 9:16. |

Work folder: `night-city/<song-slug>/` with `input/ sep/ analysis/ scene/ stills/ out/`. If it already exists, **ask** first.

## Setup (once per machine)

```bash
pip install demucs librosa soundfile torch torchaudio uroman numpy
npm i playwright           # if Playwright is already installed (even globally), do NOT run `playwright install`
```
- `torchaudio` must provide `torchaudio.pipelines.MMS_FA`. Pin `torchaudio==2.8.*` (CPU wheels from
  `https://download.pytorch.org/whl/cpu`) if a newer version has dropped it. Do not switch aligners.
- **Fonts must be local**, in `scene/fonts/`, from the Google Fonts CSS API (raw GitHub URLs may be blocked):
  ```bash
  curl -sS -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&family=Josefin+Sans:wght@200;300" \
    | grep -o 'https://fonts.gstatic.com[^)]*\.ttf'      # curl each; check each with `file` (TrueType)
  ```
  **Dancing Script 600** for the lyrics (alternatives: Sacramento, Caveat; Kalam for Devanagari), **Josefin Sans 200/300** for the thin spaced title caps.
- Load fonts with `@font-face`; in `window.ready` `await document.fonts.load(...)` for each face and **throw if `document.fonts.check` fails**.
  Measure and lay out text only **after** that.
- In `render.mjs` load Playwright with `createRequire(import.meta.url)` and `require("playwright")`, falling back to the global
  `node_modules/playwright`. Serve the scene from a tiny local HTTP server (127.0.0.1) rather than `file://`.

---

## Step 1: Listen, align, find beats, and state the story

**1a. Separate:**
```bash
ffmpeg -i input/<song> -ac 2 -ar 44100 analysis/song.wav
demucs --two-stems=vocals -n htdemucs -o sep analysis/song.wav    # → sep/htdemucs/song/{vocals,no_vocals}.wav
```
Transcribe the last 30 s with Whisper to check for a promo or voice-over; end before it.

**1b. Force-align every word**, exactly as written, with MMS_FA **and star tokens** between lines (hums and alaaps that
aren't in the lyrics then can't pull words out of place):
```python
import re, torch, torchaudio, uroman as ur
from torchaudio.pipelines import MMS_FA as bundle
U = ur.Uroman(); norm = lambda w: re.sub(r"[^a-z']", "", U.romanize_string(w).lower())
SR, HOP = bundle.sample_rate, 320
wav, sr = torchaudio.load("sep/htdemucs/song/vocals.wav")
wav = torchaudio.functional.resample(wav.mean(0, keepdim=True), sr, SR); n = wav.size(1)
model = bundle.get_model(with_star=True).eval()
WIN, CTX, chunks = 30 * SR, 2 * SR, []                 # 30 s windows with 2 s context (a whole song at once would OOM)
for s in range(0, n, WIN):
    a, b = max(0, s - CTX), min(n, s + WIN + CTX)
    with torch.inference_mode(): e, _ = model(wav[:, a:b])
    off, keep = (s - a) // HOP, min(WIN, n - s) // HOP
    chunks.append(e[0, off:off + keep])
emission = torch.cat(chunks)
flat = ["*"] + [x for L in lines for x in [w["norm"] for w in L["words"]] + ["*"]]
spans = bundle.get_aligner()(emission, bundle.get_tokenizer()(flat))   # skip the "*" spans when reading
ratio = n / emission.size(0) / SR    # start = span[0].start*ratio, end = span[-1].end*ratio, score = mean(span.score)
```
Write `analysis/timeline.json`. Flag words with `score < 0.4` or held over 2.5 s and re-align that line in its own ±2 s
window (stars on both sides). If still bad, **show the table and ask**. Never patch a time by hand.

**1c. Beats:** `librosa.beat.beat_track` → `beats`; `downbeats` = the strongest of 4 phases by onset strength. Save `analysis/beats.json`.
Beats drive the window flicker-ons (Step 4) and scene cuts.

**1d. State the love story in one line before building** — who is missing whom, and where they meet. E.g. *"He keeps asking
himself whether to love her; he has hidden her in his dreams and memories; missing each other across a night city, they meet
on a sunset hill."* Then map lines to scenes and **tell the user the table**:

| Scene | When | Default lines |
|---|---|---|
| eye opening | the intro, before the first word | — (title) |
| two eyes under the moon | first lines | the opening line(s), the "glance" |
| dusk hill, two people walking | a longing / questioning line | 1 line |
| night city skyline | missing, dreams, nights, waiting | 1–2 lines |
| memory page (cream paper) | memories, "remember", past | 1 line |
| sunset walk-together | the chorus to the last line | the last 2 lines |

Cut between scenes on the downbeat nearest the middle of a line gap (at least 0.7 s from either line). Continue; change it if the user objects.

## Step 2: The opening (during the intro)

Black `#04030b` with stars fading in. Times below are for an ~8 s intro; scale them to the intro's length (end ≥ 0.8 s before the first word).
1. **A small star of light** (0.3–1.3 s): an additive radial glow (warm white → gold) with a twinkling cross.
2. **It stretches into a thin line** (1.5–3.0 s, easeInOutCubic) to the eye's width (16:9: 44% of W; 9:16: 78%): a gold-white
   line with a bright centre, fading at both ends, glow blur 16.
3. **It opens into a big hand-drawn eye** (3.0–4.6 s, easeInOutCubic): the lids are two quadratic curves through the line's
   ends (upper lid peak `0.30·w·open`, lower `0.19·w·open`), each stroked **twice with a small seeded jitter** (±0.6% of w) in
   cream `#f7e6bf` with a gold glow, so it looks hand-drawn; a fainter crease above. Inside: a deep navy "white", a
   **starry iris** (radius 0.2 w; radial `#3a2a7a → #6a3f9e → #c98a6a → #f2c36b` gold rim; ~34 twinkling star dots slowly
   rotating; three thin gold arc swirls), a black pupil (0.4 R) and two white catchlights. **13 lashes** along the upper lid
   (each a quadratic curling outward, longest in the middle, scaled by `open`) and 7 small lower lashes. The iris drifts left
   and right slowly; one blink (0.3 s) near the end of the intro.
4. **The title** in thin spaced caps (Josefin Sans 200, 54 px in 16:9, tracking easing from 0.8em to 0.5em) fades in beneath
   the eye (4.8–6.0 s), the artist in Josefin 300 at 45% size and 0.6em tracking under it.
5. **Two smaller eyes side by side under a full moon** (crossfade in ~0.8 s before the first word): the moon top-centre, two
   eyes (16:9: 17% of W each, 12% apart, at 70% height). On the first lines they **glance at each other**: pupils ease
   (easeInOutCubic 0.35 s) toward the other eye on the line's first word, back on its last words, again on the next line;
   each blinks at its own seeded moments.

## Step 3: The scenes (flat silhouettes and soft gradients)

Every scene: a vertical gradient sky, a slow **camera drift** (scale +3.5–4%, a slight sideways slide, easeInOutSine over the
scene), drifting warm **dust and stars** (about 80 motes, a few with tiny cross glints), grain 4.5% and a violet vignette.
Scenes **crossfade softly** over 1.2 s (easeInOutSine) centred on each cut.
- **Purple dusk hill**: sky `#1d1442 → #55306f → #b0608a → #f3a77f` with a warm glow low on the right; two rolling hill
  silhouettes (`#3d2560`, `#24123d`, `y = y0 − amp·cos((x/W − φ)·1.25π)`); **two small people walking** hand in hand along
  the near ridge (feet on the curve), 12% of the frame tall, from 28% to 52% of the width over the scene.
- **Night city skyline**: sky `#05061a → #141235 → #3a2352 → #5a2c4e`, stars, a small moon, a warm haze over the roofs.
  Three layers of seeded rectangular buildings (far `#211a45`, mid `#140f30`, near `#0a0820`), some with antennas and a
  blinking red light, drifting at different speeds (parallax). **Hundreds of tiny lit windows** (1.1% of min(W,H) wide) that
  **flicker on one by one**: each window gets a seeded on-time over the scene, snapped to the next beat; it flickers for
  0.22 s, then glows warm (`#ffc46e`, `#ffd68c`, a few `#fff0c8`) at a seeded brightness; ~8% turn off later; unlit windows are faint violet.
- **Pink-orange sunset**: sky `#3a2466 → #a24d84 → #f07a74 → #ffb07a → #ffd59a`, a low pale sun with a wide warm glow, about
  45 soft **bokeh circles** (peach, pink, butter, coral; plateau radial gradients; screen-blended, drifting up), a dark hill
  `#2a1033`, and a few large bokeh in front of everything.
- **Cream paper memory page**: a `#f3e7cf` sheet with soft seeded stains, fine noise and a brown edge vignette (precomputed once);
  **simple line drawings that draw themselves** stroke by stroke (ink `#4b3a2e`, round caps, ~3 px): **two teacups** on saucers with
  wiggling steam, **a tilted polaroid** (a small moon and hills inside, a scribbled caption) and **two hands making a heart**
  (curled fingers forming the lobes, thumbs meeting at the point). Each stroke is a polyline; draw its arc-length prefix over a
  share of ~4.4 s in order. On paper the lyrics turn darker gold `#a8701e` with a soft glow so they stay readable.

Silhouettes: reuse the night-glow `figure()` (head, hair, torso, arms, the woman's dupatta) and add a **walk cycle**: phase =
distance walked ÷ stride × π; the man's legs are two strokes swinging ±0.42 rad with a knee bend, the woman's feet step under
her swaying hem, arms swing opposite, the body bobs `|sin φ|`. Fill `#170a24`–`#1c0a24` with a warm rim glow.

## Step 4: Handwritten lyrics on a line of light

- **Font**: a handwritten script in **warm gold** (default Dancing Script 600, `#f8cf7c`, glow `rgba(255,186,90,.85)` with blur
  0.25 em; on the sunset `#fff0c4` with a stronger orange glow). 124 px in 16:9, 100 px in 9:16.
- **The path**: per scene, a cubic Bézier across the empty sky (16:9 from x 0.1 W to 0.9 W, gently S-shaped; in the sky above the
  skyline, above the moonlit eyes, high over the sunset). Sample it to an arc-length table (240 steps). If a line doesn't fit on 90%
  of the path, wrap it into 2 rows (9:16: up to 3); each row is the same curve shifted down 1.4 em (odd rows nudged right 3% W).
  Centre each row's words on its path; each word sits **on** the line at the arc position of its centre, rotated to 85% of the tangent.
- **The line of light** draws on ahead of the writing: a 2.2 px line in `rgba(255,214,140,.85)` plus a 7 px 18% halo (additive), its
  head easing (easeInOutSine) through keyframes: 0.9 s before the first word → the first word's left edge; each word's left edge at
  its start → its right edge when written; then to the path's end 0.9 s after the last word. A small glowing spark rides the head.
- **Each word writes itself on when sung**: from `s − 0.05` over `clamp(e − s, 0.3, 0.85)` s, reveal it **left to right** by clipping
  a rect in the word's rotated frame, with a **glowing nib** (a radial white-gold glow, r 0.4 em) at the reveal edge bobbing up and
  down like a pen (`sin(k·38)·0.18 em`).
- **Older words fade a little**: α = `max(0.62, 1 − 0.07 × words written since)`.
- When the next line of the same scene is due (1.1 s before its first word), the old line drifts up 24 px, blurs to 8 px and fades
  over 0.7 s, and the next path starts drawing.
- **Never over the people**: check every still; if a line would touch a silhouette or an eye, move its path higher, never the people.

## Step 5: Story beats and finish

- **The chorus walk**: on the sunset, the two silhouettes start at both sides (16:9: 10% and 90% of W) when the chorus starts
  (0.4 s before its first word) and walk toward each other with easeInOutSine, the walk cycle's amplitude following their speed so
  they slow into a stop, **arriving close together (about 0.2 of their height apart) on the last line's last word**, then reach for
  each other's hands (reach 0 → 0.55 over 1.5 s).
- **A tiny eye floats between them**: at their midpoint, 1.35 heights above the ground, bobbing slowly, with a soft pink halo; it
  opens over 1.2 s at the chorus start, looks from one to the other, and blinks once.
- Slow camera drift and dust/stars throughout; soft crossfades between scenes; nothing flashes.
- **Audio**: the original song, 0.5 s fade in, 1.5 s fade out; picture fades to black over the last 1.6 s. 1920×1080, 30 fps.

---

## Reel layout (9:16, 1080×1920, when asked)

Render the same scene with `?w=1080&h=1920`; read `PORT = H > W`. **Keep all text inside Instagram's safe zone**: at least
**230 px from the top, 400 px from the bottom and 150 px from the right**. Remember a script's ascenders reach about 0.8 em above
its baseline: keep each path's highest point ≥ 230 px + 1 em from the top.
- **Paths**: x from 0.07 W to 0.84 W; highest point at about 0.16 H (city, page, sunset) or lower; up to 3 rows of 100 px script.
- **Eye opening**: the eye 78% of W at 42% height; the title at 34 px so its tracked width stays inside the right margin.
- **Two eyes**: 33% of W each at 60% height; the moon at 12% height; the lyric rows between them.
- **Dusk**: figures 7.5% of H tall. **City**: buildings 1.4× wider, the skyline from about half height down.
- **Page**: the polaroid upper-left of centre (52% height), the hands right (66%), the cups low (80%) — drawings may sit in the
  caption zone, text may not.
- **Sunset**: ground at 78% height, walkers 11% of H tall starting at 14%/86% of W.

## Build: the scene and the renderer

- `analysis/build_data.py` writes `scene/data.js`: `window.DATA = {lines, scenes, beats, downbeats, meta}` (scenes: kind, t0, t1, lines;
  meta: title, artist, duration, story). Times are relative to the clip start.
- `scene/index.html` loads the fonts, `data.js` and `scene/nc.js`. `window.ready` checks the fonts, lays out every lyric on its paths,
  builds the city (windows with beat-snapped on-times) and the paper + drawing strokes. `async window.renderFrame(t)` draws one frame;
  during a crossfade it draws both scenes into two offscreen buffers and blends them.
- `scene/render.mjs` (local HTTP server, `--w/--h`, `--stills t1,t2,… dir`): frames via `canvas.toDataURL("image/jpeg", 0.96)` piped to
  `ffmpeg -f image2pipe -c:v mjpeg -i - -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30`.
- Use only as many parallel render workers as the machine can spare (shared 4-core machine: 1–2). Join chunks with the concat demuxer
  (`-c copy`); fix seconds by re-rendering whole chunks, never by splicing onto a trimmed stream copy. Run ffmpeg with `-nostdin` in loops.

## Contact sheet: required before the full render

Render about 12 stills per aspect ratio: 1. the star; 2. the line; 3. the eye opening; 4. the eye with the title; 5. two eyes with a
word mid-write (nib visible); 6. the eyes glancing; 7. the dusk walk with a line; 8. the city with windows coming on; 9. the city's
two-row line; 10. the memory page mid-drawing; 11. the sunset walk; 12. the two close together with the tiny eye.
```bash
ffmpeg -i stills/169/s_%02d.png -vf "scale=480:-1,tile=4x3:padding=8:color=0x0a0618" stills/contact_169.jpg
ffmpeg -i stills/916/s_%02d.png -vf "scale=270:-1,tile=6x2:padding=8:color=0x0a0618" stills/contact_916.jpg
```
**Look at them yourself first** (and crop a full-size still of the handwriting): is every word readable, is nothing over the people
or eyes, is the gold readable on the cream page, are the Reel's texts inside the safe zone? Fix, re-render, then **show the user**
with the story line and the scene table. **Wait for approval.**

## Final render and delivery

```bash
D=<duration>
ffmpeg -i out/v_169.mp4 -i analysis/song.wav -map 0:v -map 1:a -t $D -af "afade=t=in:d=0.5,afade=t=out:st=$(echo "$D-1.5"|bc):d=1.5" \
  -c:v copy -c:a aac -b:a 192k -movflags +faststart out/<slug>_nightcity_169.mp4        # for a clip of a longer song: -ss <clip start> before -i song.wav
VB=$(python3 -c "print(int(19*8*1024*1024/$D/1000 - 96))")k                                # WhatsApp: two-pass, 19 MB budget, aac 96k
ffmpeg -y -i out/<slug>_nightcity_169.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v $VB -pass 1 -passlogfile out/wa169 -an -f null /dev/null
ffmpeg -i out/<slug>_nightcity_169.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v $VB -pass 2 -passlogfile out/wa169 -c:a aac -b:a 96k -movflags +faststart out/<slug>_nightcity_169_720p_whatsapp.mp4
```
Same for 9:16 (`scale=720:1280`, its own `-passlogfile`). Verify each WhatsApp file is **under 20 MB** (`stat`; if not, lower VB 10%
and redo). Check every file with `ffprobe`: resolution, 30 fps, frame count (`-count_packets`), duration, an audio stream.
Before writing into `out/`, check for existing files and **ask before overwriting**.

## Final report to the user

- the one-line love story and the scene table (lines → scene → times);
- the paths of all MP4s with size, frames and duration, and the contact-sheet paths;
- any re-aligned or user-confirmed words;
- offer tweaks: script font, gold tone, which line gets which scene, path heights, walk timing.
