---
name: sketch-music-video
description: Build a soft 16:9 pencil-sketch lyric video — an off-white sketchbook page with paper grain and a spiral binding, the title hand-lettered top left, one small graphite drawing per verse that draws itself stroke by stroke (slightly jittered lines, varying pressure, grainy graphite, light cross-hatching) with a pencil riding the line, and each lyric line handwritten letter by letter beside its drawing at its sung time; older lines and drawings stay on the page, faded, until the page is full and turns with a page curl. Drawings are vector strokes in code, or the user's reference sketches/photos traced to pencil strokes. Also renders a 9:16 Reel. Use when the user runs /sketch-music-video or attaches a song MP3 and its lyrics (one sung line per row) and asks for a pencil / sketchbook / hand-drawn lyric video.
argument-hint: "<song mp3> <lyrics, one sung line per row> [reference sketches/photos per verse] [\"Title — Artist\"] [reel]"
---

# Sketch Music Video

Make a quiet 1920×1080, 30 fps lyric video that looks like someone filling a sketchbook while
the song plays. Soft graphite drawings of the song's story appear one verse at a time, drawn
stroke by stroke, and each sung line is handwritten beside its drawing, letter by letter,
exactly when it is sung. Nothing flashes; the page simply fills up.

Reference feel: pencil-sketch lyric videos such as "Inaam" (Anuv Jain). Use it for **mood,
pacing and the hand-made feel only**. Every frame is drawn by our own code.

## Non-negotiable rules (every run)

1. **Everything is drawn in code.** One HTML `<canvas>` scene is rendered frame by frame in
   headless Chromium (Playwright), and the frames are piped to ffmpeg. Paper, binding, drawings,
   hatching, handwriting and the pencil are all code. The only outside pixels allowed are the
   user's own reference sketches/photos, and those are never shown: they are traced into pencil
   strokes (Step 3b). No stock footage, no image generators. Every visual is a pure function of
   time `t` with seeded PRNGs (mulberry32), so a re-render, or any chunk rendered in parallel, is identical.
2. **Word timings come only from forced alignment** (torchaudio `MMS_FA` on the demucs vocal stem),
   using the lyrics exactly as the user wrote them. Never guess, eyeball or interpolate timings.
   If a word aligns badly, re-align that window or ask.
3. **Show a contact sheet of stills before the full render** (both aspect ratios if a Reel is asked for), then wait for the go-ahead.
4. **Ask before overwriting** any existing file in the work or output folder (AskUserQuestion).
5. Deliver a 1920×1080 master MP4 with the song as **AAC 256k**, plus a 720p copy **under 20 MB** for
   WhatsApp. If the user asks for a Reel, also a 1080×1920 master and its 720×1280 WhatsApp copy.

## Inputs

| Input | Notes |
|---|---|
| Song | An MP3 (anything ffmpeg reads). A clip is fine; the video then covers only that clip. |
| Lyrics | One sung line per row, **with every repetition written out**. Roman, Devanagari or another script: the display keeps the user's text; alignment uses a `uroman` romanized copy. Never write lyrics from memory. If the user has none, offer a Whisper large-v3 transcription and show it for correction first. |
| Reference sketches/photos (optional) | One per verse/scene (`ref_<scene>.jpg`). They must be the user's own or ones they may use. Traced to strokes in Step 3b; otherwise every scene is drawn as vector strokes in code (Step 3a). |
| Title + artist | Hand-lettered at the top left of the first page. Credits (composer, film, lyricist) are written small at the end, if the user gives them. |
| Reel? | Only if asked: also render 9:16 (see "Reel layout"). |

Work folder: `sketch-video/<song-slug>/` with `input/ sep/ analysis/ scene/ stills/ out/`.
If it already exists, **ask** before reusing or overwriting.

## Setup (once per machine)

```bash
pip install demucs librosa soundfile torch torchaudio uroman numpy opencv-python-headless scikit-image
npm i playwright          # if Playwright is already installed, do NOT reinstall the browser (never `playwright install`)
```
- `torchaudio` must provide `torchaudio.pipelines.MMS_FA`. Pin `torchaudio==2.8.*` (CPU wheels from
  `https://download.pytorch.org/whl/cpu`) if a newer version dropped it. Do not switch aligners.
- **Fonts must be local**, in `scene/fonts/`. Get the TTF URLs from the Google Fonts CSS API (raw GitHub URLs may be blocked):
  ```bash
  curl -sS -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Gloria+Hallelujah" \
    | grep -o 'https://fonts.gstatic.com[^)]*\.ttf'      # curl each one; check with `file` that each is TrueType
  ```
  **Caveat 700** for the lyrics (a narrow, readable hand), **Caveat 600** for the artist, **Caveat 400** for credits,
  **Gloria Hallelujah** for the hand-lettered title. (Kalam, Shadows Into Light are fine alternatives; for Devanagari
  lyrics use **Kalam**, which covers both scripts.)
- Playwright installed globally isn't visible to an ESM `import`: in `render.mjs` use `createRequire(import.meta.url)` and fall
  back to `/opt/node22/lib/node_modules/playwright` (or the global `node_modules/playwright` path).
- **Serve the scene over a local HTTP server** (a tiny Node static server inside `render.mjs`, on `127.0.0.1`), not `file://`:
  fetched JSON and images from `file://` fail or taint the canvas.

---

## Step 1: Listen. Separate, align, find beats, read the story

**1a. Separate:**
```bash
ffmpeg -i input/<song>.mp3 -ac 2 -ar 44100 analysis/song.wav
demucs --two-stems=vocals -n htdemucs -o sep analysis/song.wav   # → sep/htdemucs/song/{vocals,no_vocals}.wav
```
Transcribe the last 30 s with Whisper to check for a channel promo or voice-over; if there is one, end the video before it.

**1b. Force-align every word** with MMS_FA and **star tokens** between lines (they absorb hums, alaaps and ad-libs):
```python
import re, torch, torchaudio, uroman as ur
from torchaudio.pipelines import MMS_FA as bundle
U = ur.Uroman(); norm = lambda w: re.sub(r"[^a-z']", "", U.romanize_string(w).lower())
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
flat = ["*"] + [x for L in lines for x in [w["norm"] for w in L["words"]] + ["*"]]
spans = bundle.get_aligner()(emission, bundle.get_tokenizer()(flat))   # skip the "*" spans when reading results
ratio = n / emission.size(0) / SR    # start = span[0].start*ratio, end = span[-1].end*ratio, score = mean(span.score)
```
Write `analysis/timeline.json`: `{lines: [{i, display, start, end, words: [{display, norm, start, end, score}]}]}`. Then check:
- flag words with `score < 0.4` or longer than 2.5 s; re-align those lines in their own ±2 s window (star tokens on both sides).
  A **long held word** (e.g. a 2 s "pyaar") often scores 0.3–0.4 and is still right: listen to it (cut ±1 s with ffmpeg) before re-aligning;
- assert in the build script that word starts are monotonic and lines don't overlap;
- if a word is still bad, **show the user the table and ask**. Never patch a time by hand.

**1c. Beats:** `librosa.beat.beat_track` → `beats`; strongest of 4 phases → `downbeats`. Save `analysis/beats.json`. Beats only
nudge timing choices (when a drawing starts, where a page turns); the drawing speed never jumps to the beat.

**1d. Read for the story and plan scenes.** Translate for yourself if needed. Group lines into **verses/scenes**: one small
drawing per verse (pairs of lines, a repeated line with its original, a chorus block). 4–6 scenes per minute of song.
For each scene write down: the lines, **what the drawing shows** (one small moment: a boy by a window, a shop counter, a room at
night, two figures far apart on a road, two figures meeting), and which page it lives on. **Tell the user the plan** (table:
scene → lines → drawing → page), then continue; change it if they object.

## Step 2: The sketchbook page

- **Paper** (generated once in `window.ready`, seeded): base `#f3f0e7`; two layers of low-frequency mottling (a tiny random
  canvas upscaled with smoothing, `multiply` at 5–7%); fine tooth (per-pixel dark speckle, α ∝ r³·34); ~260 faint fibres
  (short quadratic curves, grey α .10 or white α .35); a very light warm vignette.
- **Binding / page edge:** 16:9 is bound on the **left**, 9:16 on the **top**. Punched holes every 50 px (`#3b352e` ellipses, 9×7 px)
  are part of the page; the **spiral wire** is a separate canvas drawn on top of everything (a bezier from each hole over the edge,
  `#4a4a50` 5.5 px with a 1.6 px light highlight and a soft drop shadow). Draw 3 hairlines along the open edges for a stack of sheets.
- **Lighting:** after compositing, a radial "desk lamp" falloff (`rgba(70,55,40,.22)` at the far corner). The page sits on a dark
  desk (`#2a241e`) that only shows at the edges during a slow handheld drift: scale `1.018 ± 0.006`, ±5 px, ±0.15°, all slow sines of `t`.
- **Title** (first page, top left): Gloria Hallelujah ~58 px (16:9), written letter by letter over ~2 s from t≈0.7 s; the artist
  under it in Caveat 600 ~40 px, then a pencil underline stroke. Same pencil reveal as the lyrics (Step 4).

## Step 3: One drawing per verse, drawn stroke by stroke

Every scene lives in **local units 400×300** and is mapped to a box on its page (`[x, y, width]`, scale = width/400).
Strokes are polylines in page px; outlines draw first, hatching after.

**3a. Vector scenes in code (default).** Write each scene as a `build(b)` function with a tiny builder:
- `line(x1,y1,x2,y2,kind,overshoot)` — a slightly bowed line that **overshoots its ends by 1–3 units** (sketchers overshoot corners);
- `curve(points)` (Catmull–Rom through points), `pl(points)` (straight polyline), `rect`, `ell(cx,cy,rx,ry,kind,a0,a1)` (starts at a seeded
  angle and overlaps itself by ~0.35 rad), `heart`, `bumps` (scalloped cloud/tree crown);
- `chain([[x,y,r],…])` — **tube contours through joints** (left and right offset of a spline with interpolated radius, round end cap):
  limbs, torsos and necks for figures in any pose (sitting, walking, lying, holding hands) without stick figures;
- `hatch(polygon, angleDeg, spacing, kind, excludeCircles)` — parallel lines clipped to a polygon (rotate the polygon by −angle, sweep
  horizontal lines, pair the edge intersections, rotate back). Jitter spacing ±15%, shorten each end randomly, alternate direction,
  and cut out exclusion circles (a moon in a hatched sky, a figure in front of a hatched wall). **Cross-hatch** = a second call at another angle on the darker part.
- Stroke kinds: `o` outline (2.1 px, α .92), `d` dark accent (2.6 px, α 1), `l` light detail (1.45 px, α .58), `h` hatch (1.2 px, α .5), `hd` dark hatch for hair (1.3 px, α .82). Scale widths by `min(W,H)/1080`.

**3b. From the user's reference sketches/photos** (`analysis/prep_ref.py <image> <out.json>`): fit the image to 400×300 (cover, or
`--contain` for a sketch on white) at 4× resolution, apply CLAHE (night or low-key photos), then:
```python
xdog = cv2.GaussianBlur(g, (0, 0), 1.4) - 0.98 * cv2.GaussianBlur(g, (0, 0), 2.6)
ink = (np.abs(xdog) > np.percentile(np.abs(xdog), 95.5)).astype(np.uint8)    # RELATIVE threshold: a fixed one finds nothing on soft/dark images
skel = skeletonize(cv2.morphologyEx(ink, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)) > 0)
# trace 8-connected skeleton pixels into polylines (from endpoints first), approxPolyDP(1.5), drop < 14 px, keep the 420 longest,
# order from the subject's centre outward (+0.25·y so it also drifts top-down)
tone = cv2.resize(cv2.GaussianBlur(g, (0, 0), 6), (400, 300))
mid  = hatch_runs((tone < np.percentile(tone, 40)) & vignette, angle=50, spacing=5)    # hatching from the image's dark areas
dark = hatch_runs((tone < np.percentile(tone, 14)) & vignette, angle=-40, spacing=4)   # cross-hatch the darkest
```
`hatch_runs` walks parallel lines across the mask and emits each inside run ≥ 4 units as a stroke. The **vignette** (an irregular oval,
noise-perturbed) is essential: without it the hatching ends in a hard rectangle at the box edge. Save `{w:400,h:300,strokes:[{k,pts}]}`;
the scene loads it with `?refs=<sceneIndex>:../analysis/ref_<n>.json` and it replaces that scene's vector build. Always look at the traced
result in a still; drop or redraw a scene that doesn't read.

**3c. The graphite look** (`prepStroke` once, `drawStroke` per frame):
- resample every stroke to ~3 px steps; **jitter** perpendicular to the stroke by `A·(0.6·sin(s·f1+p1) + 0.4·sin(s·f2+p2))` with seeded
  `f1≈0.02–0.05`, `f2≈0.07–0.12`, `A≈0.3–0.7 px` (low-frequency wobble, never per-point noise);
- **pressure** along the stroke: `taper = clamp(min(u/0.12, (1−u)/0.16))^0.5`, `p = (0.35 + 0.65·taper)·(0.82 + 0.18·sin(9u + phase))`;
  draw in chunks of 4 segments, each with its own `globalAlpha = a·p` and `lineWidth = w·(0.7 + 0.4p)`, `lineCap = "butt"` (round caps darken the joins);
- a second, fainter **ghost pass** offset ~(±0.6, 0.4–0.9) px at 38% α and 60% width (the doubled line of a real pencil);
- `strokeStyle` is a **graphite pattern**: a 256 px tile of `rgb(52,52,58)` whose alpha is 0.55–1.0 random (plus a little row
  structure), so lines and letters pick up paper tooth like real graphite. Use a darker tile (`rgb(40,40,46)`, 0.62–1.0) for handwriting.

**3d. Timing and caching:**
- each scene has a drawing window `[t0, t1]` (it should start a few seconds before its first line and may keep hatching while the line
  is sung); outlines take the first 66%, hatching the rest. Inside each phase a stroke's duration ∝ its length, plus a **pen-lift gap**
  (≈20 px of travel for outlines, 8 px for hatching) between strokes;
- `t0 ≥ page shown + 0.15 s` (never draw on a page that is still turning);
- **cache** each scene in its own box-sized canvas: strokes completed so far are drawn once, in order, into the cache (if `t` goes backwards,
  clear and rebuild: same ops in the same order give identical pixels), then the cache is blitted and only the in-progress stroke is drawn live.

**3e. The pencil:** a drawn pencil (graphite tip, sharpened wood cone with a scalloped edge, faceted yellow body from a 6-stop
gradient, metal ferrule, pink eraser, blurred drop shadow), rotated ~55° so the body lies down-right of the tip. Its tip follows the
**writing head**: the handwriting edge if a word is being written, else the active stroke's head, else between strokes it travels
(eased, lifted 10 px in an arc) to the next stroke's start. Smooth it as a pure function of `t`: average the head at `t − k/45`, k = 0..9,
weighted `exp(−k/3)`; the share of samples with a head gives its presence, and as presence drops the pencil lifts away (+140, +160 px) and fades.

## Step 4: Handwritten lyrics, letter by letter

- **Rows:** each line gets 1–3 rows placed **beside its drawing** (to its right, left or under it on the same page), each row with a small
  indent, a seeded tilt (±0.5°) and a baseline wobble (±2 px per word). Caveat 700 at ~66 px (16:9) / 70 px (9:16). Shrink a row's font
  if it would cross the page's right limit, and log it. Assert in `ready` that no row's box overlaps a drawing box on its page, and print warnings.
- **Writing:** a word starts 30 ms before its aligned start and takes `clamp(end − start, 0.16, 0.075·letters + 0.1)` s.
  Progress `p` → `k = p·letters`; the clip edge is `lerp(prefix[k], prefix[k+1], frac(k))`, where `prefix[i]` is `measureText` of the
  first `i` letters (measure **after** the fonts load). Draw the whole word clipped to `x ≤ edge` (so ligatures and joins stay intact),
  then a second graphite pass offset 0.6 px at 25% α.
- **Fading:** the current line is full strength; when the next line starts, the earlier one fades to ~55% over 1 s. A drawing fades to
  ~65% when the next drawing on its page starts. Everything stays on the page, so it fills like a sketchbook.
- Credits (if given): Caveat 400 ~31 px at the bottom of the last page, written in the last 2–3 s.

## Step 5: Turning the page

Plan pages so each one ends **full** (2–3 scenes in 16:9; 1–2 in 9:16). Turn only in a **gap of ≥ 1.8 s** between lines, over ~1.4 s
(easeInOutCubic). Page curl, a pure function of the fold position:
1. render the old page and the new page into two offscreen canvases (same renderer, same `t`);
2. the fold is a line with normal `n` (16:9 `(1, 0.42)`, 9:16 `(0.36, 1)`, normalized) at distance `s`, sweeping from the open corner
   (`s = W·nx + H·ny`) to 0; draw the new page, a soft shadow band just past the fold, then the old page clipped to `dot(p,n) < s`;
3. the **flap** is the lifted part mirrored across the fold, the band `2s − L … s`: fill it with the page back (`#ddd8cc → #f7f4ec`
   toward the fold), draw the old page mirrored at 7% α for show-through (`setTransform(1−2nx², −2nxny, −2nxny, 1−2ny², 2s·nx, 2s·ny)`),
   a 2 px highlight along the fold and a shadow under the flap's free edge;
4. the spiral binding stays on top throughout.
(A slide to a fresh page — the old page eases out 110% of the width, the new one in — is the fallback if the user prefers.)

## Reel layout (9:16, 1080×1920, when asked)

- Same scene with `?w=1080&h=1920`; every layout value lives in a per-aspect table (`L169`, `L916`) — page list with flip times,
  scene boxes, title/artist position, rows per line (`[firstWord, lastWord, x, y]`), font size, credits position.
- **Instagram safe zone for every text row:** ≥ 230 px from the top, ≥ 400 px from the bottom, ≥ 150 px from the right (rows
  end at x ≤ 925). The build warns if a row leaves it. Drawings may run slightly into the bottom band, never text.
- Bound at the **top**; one drawing ~700 px wide with its lines under it, 1–2 scenes per page, so use **one page more** than 16:9
  (the sample: 3 pages vs 2). Split every line into 2–3 rows at a phrase break; lines are ~70 px.
- The page curl folds upward (`n = (0.36, 1)`); the pencil is the same size (sizes scale with `min(W,H)/1080`).

## Build: the scene and the renderer

- `analysis/build_data.py` → `scene/data.js` (`window.DATA = {lines: [{i, display, start, end, words: [{d, s, e, sc}]}], beats, downbeats, meta}`,
  times in video seconds), with asserts (monotonic words, lines inside the clip) and a list of weak-score words.
- `scene/index.html` loads the fonts (`@font-face`), `data.js` and `sketch.js`. `window.ready` awaits `document.fonts.load` for every face,
  **asserts `document.fonts.check`** (throw on failure), builds paper, binding and graphite patterns, fetches any `?refs=` JSON, prepares the
  scenes and lays out the text, then returns a summary (stroke counts per scene, drawing windows, layout warnings) that `render.mjs` prints.
- `async window.renderFrame(t)`: page (or page curl) into a buffer → binding → drift transform → pencil → lamp falloff → fade in/out.
- `scene/render.mjs --w W --h H [--q extra=query] <fromFrame> <toFrame> out.mp4` starts the local static server, renders frames with
  `canvas.toDataURL("image/jpeg", 0.96)` piped to `ffmpeg -f image2pipe -framerate 30 -c:v mjpeg -i - -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30`.
  `--stills t1,t2,… dir` writes PNGs. Render in 2 parallel chunks (or more if the machine is free), join with the concat demuxer (`-c copy`).
  To fix a few seconds, **re-render whole chunks**; never splice onto a trimmed stream copy. In bash loops call ffmpeg with `-nostdin`.

## Contact sheet: required before the full render

For each aspect ratio render ~12 stills: the title being written; the first scene's outlines mid-draw with the pencil; its hatching;
a line half written; the full first page; a page curl mid-turn; the second page's first scene with its lines; a scene traced from a
reference image (if any); a busy page with faded earlier lines; the last scene; the full last page with credits; the end.
Tile with `ffmpeg -i stills/<ar>/s_%02d.png -vf "scale=640:-1,tile=3x4:padding=6:color=0x222222" stills/contact_<ar>.jpg`.
**Look at the sheets yourself** (Read the image): text readable and never on a drawing, figures read as people, hatching inside its shapes,
the page full at each turn, safe zones respected in 9:16. Fix, re-render the stills, then show the user with the scene/page table and **wait for approval**.

## Final render and delivery

```bash
D=<duration>; N=$((D*30)); HN=$((N/2))
node scene/render.mjs --w 1920 --h 1080 0 $HN out/169_a.mp4 & node scene/render.mjs --w 1920 --h 1080 $HN $N out/169_b.mp4 & wait
printf "file '169_a.mp4'\nfile '169_b.mp4'\n" > out/169.txt && ffmpeg -nostdin -f concat -safe 0 -i out/169.txt -c copy out/v_169.mp4
ffmpeg -nostdin -i out/v_169.mp4 -i input/<song>.mp3 -map 0:v -map 1:a -t $D \
  -af "afade=t=in:d=0.5,afade=t=out:st=$(echo "$D-1.5"|bc):d=1.5" -c:v copy -c:a aac -b:a 256k -movflags +faststart out/<slug>_sketch_169.mp4
VB=$(python3 -c "print(int(18.6*8*1000*1000/$D/1000 - 96))")k          # WhatsApp: two-pass, 18.6 MB budget (decimal; x264 can overshoot ~1%), 96k audio
ffmpeg -nostdin -y -i out/<slug>_sketch_169.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v $VB -pass 1 -passlogfile out/wa169 -an -f null /dev/null
ffmpeg -nostdin -i out/<slug>_sketch_169.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v $VB -pass 2 -passlogfile out/wa169 -c:a aac -b:a 96k -movflags +faststart out/<slug>_sketch_169_720p_whatsapp.mp4
```
(For a clip of a longer song add `-ss <clipStart>` before the audio input.) Same for 9:16 with `--w 1080 --h 1920`, `scale=720:1280` and a
different `-passlogfile`. Verify each WhatsApp copy is < 20 MB (`stat`; if not, lower `VB` 10% and re-encode). Paper grain makes two-pass x264 overshoot by ~1% (a 19 MiB target came out at 20.01 MB decimal), so loop: if the file is ≥ 19.5 MB (decimal), multiply `VB` by 0.9 and run both passes again. Check every file with `ffprobe`:
resolution, 30 fps, frame count (`-count_packets`), duration, and an AAC audio stream (256 kb/s on the masters). Before writing into `out/`,
check for existing files and **ask before overwriting**. Delete temporary chunks afterwards.

## Final report to the user

- the scene plan (scene → lines → drawing → page) and the page-turn times;
- which scenes were drawn in code and which were traced from their references;
- the file paths with sizes, frame counts and durations;
- any weak-score / re-aligned words and what you checked;
- offer tweaks: drawing speed, hatching density, fade amount, row placement, page breaks, pencil on/off.
