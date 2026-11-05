---
name: watercolor-lyrics
description: Build a soft 16:9 watercolour lyric video — the camera pans steadily right across one long sheet of warm paper while autumn watercolour scenes of one couple paint themselves in (ink lines draw first, then the wash blooms outward), maple leaves fall, and each lyric block writes on word by word in Amatic SC beside its scene without covering faces. Also writes consistent image prompts for the scenes. Use when the user runs /watercolor-lyrics or attaches a song, its lyrics and 10-14 watercolour images of the same couple (or asks for the image prompts first).
argument-hint: "<song mp3> <lyrics> <10-14 watercolour images of the couple>  — or just <song> <lyrics> to get the image prompts first"
---

# Watercolor Lyrics

Make a soft 1920×1080, 30 fps lyric video that feels hand-painted. One long sheet of warm
textured paper slides past as the camera pans **slowly and constantly to the right**. Each
autumn watercolour scene of the same couple **paints itself in**: ink lines first, then the
wash blooming outward from the middle. A few maple leaves drift across, and the lyrics write
on in Amatic SC beside each scene, word by word on the voice.

Reference feel: lyric videos such as Ashu Shukla's "Phir Se Shuru" (Ye likho ye milega Part 7).
Use it for mood and pacing only.

## Non-negotiable rules (every run)

1. **Everything is drawn in code.** One HTML `<canvas>` scene is rendered frame by frame in headless
   Chromium (Playwright), and the frames are piped to ffmpeg. The only outside pixels are the
   user's watercolour images. The paper, ink draw-in, wash bloom, leaves and lettering are all
   code, as pure functions of time `t` with seeded PRNGs, so re-renders and parallel chunks are
   identical. The skill **never calls an image generator** and uses no stock footage. It only
   *writes prompts*, which the user takes to the tool of their choice.
2. **Word timings come only from forced alignment** (torchaudio `MMS_FA` on the demucs vocal stem),
   using the user's lyrics exactly as written. Never guess, eyeball or interpolate timings.
   (Chorus timing reuse in Step 2 is also derived from alignment; see the rules there.)
3. **Show a contact sheet of stills before the full render**, then wait for the user's go-ahead.
4. **Ask before overwriting** any existing file in the work or output folder (AskUserQuestion).
5. Deliver a 1920×1080 master MP4 with the original audio and a 720p copy **under 20 MB** for WhatsApp.

## Inputs

Collect these, and ask for anything that is missing:

| Input | Notes |
|---|---|
| Song | Anything ffmpeg reads (MP3 normally). |
| Lyrics | Exactly as sung, with every chorus repeat written out. Roman or another script: the display keeps the user's text, and alignment uses a `uroman` romanized copy. Never write lyrics from memory. |
| 10–14 watercolour images | All of the same couple in the same outfits. If the user doesn't have them yet, run **Step 1 first** and stop after giving the prompts. Continue once the images arrive, matched to scenes by filename (`scene_01.png`…) or by asking. |
| Title + artist | For the opening paper title. |

Work folder: `watercolor/<song-slug>/` with `input/ sep/ analysis/ images/ scene/ stills/ out/`.
If it already exists, **ask** before reusing or overwriting.

## Setup (once per machine)

```bash
pip install demucs librosa soundfile torch torchaudio uroman numpy opencv-python-headless scikit-image
npm i playwright           # if Playwright is already installed, do NOT reinstall the browser
```
- `torchaudio` must provide `torchaudio.pipelines.MMS_FA`. Pin `torchaudio==2.8.*` (CPU wheels from
  `https://download.pytorch.org/whl/cpu`) if a newer version has dropped it. Do not switch aligners.
- **Fonts must be local**: Amatic SC 400/700 in `scene/fonts/`. Get the TTF URLs from the Google Fonts CSS API (raw GitHub URLs may be blocked):
  `curl -sS -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Amatic+SC:wght@400;700" | grep -o 'https://fonts.gstatic.com[^)]*\.ttf'`,
  then curl each one and check with `file` that it's TrueType.
- Playwright installed globally isn't visible to an ESM `import`. Load it with `createRequire(import.meta.url)` and fall back
  to the global `node_modules/playwright` path.
- **Serve the scene over a local HTTP server** (a tiny Node static server in `render.mjs`, on `127.0.0.1`), not `file://`.
  Images loaded from `file://` taint the canvas, and then `toDataURL()` throws.

---

## Step 1: Read the lyrics, plan scenes, write image prompts

Translate the lyrics for yourself if needed and find the emotional arc. Then plan **one scene per line or
pair of lines** (10–14 scenes in total). Pair short lines; give the chorus its own scene, which every chorus repeat
re-paints. For each scene, write down:
- the line(s);
- the moment: what the couple is doing (walking under trees, sharing an umbrella, her laughing, him
  looking back, hands almost touching, a bench, a café window, an empty path…);
- the **text side**: which side of the image stays calm, so the lettering can go there.

**Write the image prompts** with one fixed character block and style block, so the couple stays consistent across scenes:
```
CHARACTERS (identical in every image): a young South Asian couple. She: shoulder-length wavy dark-brown hair,
mustard-yellow chunky knit sweater, maroon wool scarf, dark jeans, ankle boots. He: short black hair, light stubble,
brown corduroy jacket over a cream shirt, dark trousers, brown shoes. Same faces, hair and outfits in every scene.
STYLE: loose autumn watercolour illustration with fine sepia ink linework, soft wet-in-wet washes, warm palette
(ochre, rust, maroon, olive, soft teal sky), paper-white background fading out at the edges (vignetted, no hard frame),
gentle light, no text, no borders, no signature. Wide 3:2 composition with calm empty space on the <LEFT/RIGHT> side.
SCENE <n>: <what happens, where, camera distance, mood>.
```
Give the user every prompt in one list, plus tips:
- generate all scenes in one session;
- reuse the first good image as a character reference or seed;
- keep the same aspect ratio;
- reject images whose outfits drift.

If the images aren't attached yet, **stop here** and wait.

## Step 2: Listen. Separate, align, find the chorus repeats

**2a. Separate:**
```bash
ffmpeg -i input/<song> -ac 2 -ar 44100 analysis/song.wav
demucs --two-stems=vocals -n htdemucs -o sep analysis/song.wav
```
Transcribe the last 30 s with Whisper to check for a channel promo or voice-over at the end. If there is one,
end the video before it.

**2b. Force-align every word** with MMS_FA and **star tokens** between lines (they absorb hums and ad-libs):
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
spans = bundle.get_aligner()(emission, bundle.get_tokenizer()(flat))   # skip "*" spans when reading
ratio = n / emission.size(0) / SR    # start = span[0].start*ratio, end = span[-1].end*ratio, score = mean(span.score)
```
Then check it:
- Flag words with `score < 0.4` or longer than 2.5 s, and re-align those lines in their own ±2 s window
  (star tokens on both sides). A held last word often swallows a hum.
- If a vocal stretch has no words, test whether a line repeats there: add it, re-align, and keep it only if it
  fits that gap with good scores.
- If a word is still bad, **show the user and ask**.

**2c. Chorus repeats reuse the same timing:**
- Group lines whose normalized text is identical (or a run of identical lines, i.e. the chorus block).
- Confirm each repeat is really the same melody: cross-correlate chroma (`librosa.feature.chroma_cqt` on the vocal stem)
  between the instances. L2-normalize each chroma column (`librosa.util.normalize(..., norm=2, axis=0)`), so the mean column dot product is a 0–1 similarity, and require 0.8 or more.
- Pick the **reference instance** with the best mean alignment score. For every other instance, anchor at that
  instance's **own aligned first-word start**, and apply the reference's **relative word offsets**, scaled by the ratio of the
  two instances' aligned line durations. Keep the repeat's own aligned times instead wherever its own
  scores are good (≥ 0.6) and differ from the transferred ones by more than 80 ms: the singer may phrase it differently.
- The same chorus also reuses the **same layout and wipe timing pattern**, and its scene image is re-painted.
- Log which lines took transferred timing in `analysis/chorus.json`.

**2d. Beats:** `librosa.beat.beat_track` gives `beats`. They only gently time leaf gusts and bloom starts. The pan never changes speed.

## Step 3: Prepare the images (ink, wash and safe areas)

Normalize each image to a **scene height of about 780 px** (in the 1080 frame), with a slight warm grade so the set matches. Then precompute (`analysis/prep.py`):

**3a. Ink lines as ordered strokes:**
```python
import cv2, numpy as np
from skimage.morphology import skeletonize
g = cv2.cvtColor(img_fullres, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255           # trace at full resolution, then scale points down
xdog = cv2.GaussianBlur(g, (0, 0), 1.2) - 0.98 * cv2.GaussianBlur(g, (0, 0), 2.2)   # XDoG-style ink edges
ink = (xdog < np.percentile(xdog, 4.5)).astype(np.uint8)                          # RELATIVE threshold: a fixed one finds almost nothing on soft images
ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
skel = skeletonize(ink > 0)
# trace the skeleton into polylines (walk 8-connected pixels from endpoints, then from leftovers),
# simplify with cv2.approxPolyDP(ε=1.2), drop strokes shorter than 12 px,
# order the strokes from the subject's centre outward (with some top-to-bottom mixing) so it "draws" like a hand would
```
Save `images/<n>_ink.json` with polylines, the cumulative length per stroke, and the stroke widths (1.2–2.4 px, thicker
where the ink mask is wider). Keep about 300–1,500 strokes per image.

**3b. Wash reveal map** (one byte per pixel at ¼ resolution, `images/<n>_reveal.png`):
- `r = 0.75·dist(subject_centre) + 0.25·fbm_noise` (seeded fractal noise from Gaussian-blurred normal noise at 2–3 sigmas, not cubic-upscaled grids, which look blocky), normalized 0→1.
  The wash blooms **outward from the middle** with organic, wet edges.
- `subject_centre` is the centre of the face boxes (3c), or the image centre.
- Multiply in an **edge fade**, so the painting dissolves into the paper (no rectangle). Soft vignette distances near the border are pushed to 1.

**3c. Faces and safe text areas:**
- Detect faces with OpenCV (YuNet if its ONNX model can be downloaded, else Haar `haarcascade_frontalface_default` plus a
  profile cascade). Watercolour faces are often missed, so **always look at each image yourself** and add or correct the
  face boxes in `images/faces.json`.
- Also compute a **detail map** (local variance) to find calm areas.

## Step 4: One long sheet and a constant pan

- **Paper:** generate in Python a **tileable** warm paper texture, 2048×1080 (`scene/paper.jpg`):
  - base `#f2e6d0`;
  - periodic fractal noise for tooth, a few faint fibres and cold-press dimples, and a gentle tonal mottling;
  - all periodic, so tiles join invisibly.
  The canvas tiles it under the camera. Add a very subtle warm vignette on the frame.
- **Constant pan:** `cameraX(t) = v·t`. Choose `v` (px/s) so the scene spacing works:
  1. Each scene *i* is centred on screen at the middle of its lyric time: `x_i = v·mid_i`.
  2. Neighbouring scenes need `x_{i+1} − x_i ≥ width_i/2 + width_{i+1}/2 + 80 px`. Pick the
     largest comfortable `v` (about 40–90 px/s) that satisfies this for all pairs, after shrinking scene widths if needed.
     If two scenes are still too close, merge their lines into one scene (tell the user).
  3. Long instrumental gaps simply leave quiet paper with leaves. That's part of the mood.
  4. Alternate scenes high and low on the sheet (text below a high scene, above a low one). Then a block can be as wide as `2·(spacing − sceneWidth/2 − 40)` without touching the neighbouring scene.
  5. Assert in the build script that every scene finishes painting before its first word, and that no block overlaps a face box. Fail loudly.
- **Opening:** the song title and artist in Amatic SC, written on the paper at the start of the sheet, wiping on, before the first scene.
- **Ending:** the last scene finishes, the paper keeps sliding for a moment, then everything fades to warm white and black with the music.

## Step 5: Paint each scene in (ink, then bloom)

Timing per scene, keyed to the camera:
- the ink starts when the scene's left edge is at 92% of the frame width (it has just entered);
- the ink takes 1.6–2.4 s;
- the wash starts when the ink is 55% drawn and takes 2.5–3.5 s;
- the painting is complete **before its first lyric word**. If that's impossible, shift the start earlier, never the lyric.

**Ink:** draw the strokes in order with a sepia ink colour (`#3a2a20`, 85% α) and a slight wobble, so it doesn't look
plotted. Stroke *i* is drawn up to `k·length_i` as a partial polyline with round caps, and the lines darken slightly as the wash passes.

**Wash bloom** (the image itself, multiplied onto the paper):
```js
// per frame for a revealing image: threshold its ¼-res reveal map into a mask, then upscale (bilinear = soft edge)
const k = easeOutSine(washProgress);          // end at k = 1.0 so the edge fade survives (k > 1 would fill the corners)
for (let i = 0; i < map.length; i++) m.data[i*4+3] = 255 * clamp((k - map[i]) / 0.06);   // 0.06 = wet-edge softness
maskCtx.putImageData(m, 0, 0);
// compose: image → offscreen; destination-in with the upscaled mask; then
//   ctx.globalCompositeOperation = "multiply" onto the paper (the paper tooth shows through the washes)
// wet edge: draw a thin band where map ≈ k (0.02 wide) in multiply, 25% darker: the "edge darkening" of real watercolour
```
After the bloom completes, the scene stays as a static painting on the sheet, multiplied onto the paper.

**Maple leaves:** 4–8 on screen at a time.
- Draw each maple leaf as a vector path in code (5 lobes, serrated), filled with an autumn gradient (rust, ochre, maroon), with a darker vein stroke.
- They fall with sway, rotation and flip (`scaleX = cos(φ)`), in two depth layers. The near layer is larger, faster and slightly blurred.
- Their positions are in screen space, so the pan doesn't drag them. Add small gusts on a few downbeats.

## Step 6: Lyrics that write on beside each scene

- **Rows:** break any line over about 26 characters into two balanced rows at a word boundary. Don't rely on commas: they may have been stripped from the aligned words.
- **Font:** Amatic SC 700 for most text and 400 for secondary rows, ink brown `#3b2a1e`, size 64–96 px. Use 1–3 rows per block,
  with the line broken at natural phrase breaks.
- **Placement:** the lyric block belongs to its scene and lives on the sheet (it pans with it). Score candidate positions (the
  paper on the scene's text side, the scene's calm areas, above or below the scene) with
  `score = −10·overlap(face boxes, padded 30%) − 2·mean(detail) + 1·onTextSide + 0.5·onPaper`.
  Pick the best one. **A block must never overlap a face box.**
- **Word-by-word wipe on:** each word appears with a left→right clip wipe over its aligned duration
  (min 0.15 s, max 0.6 s), starting 50 ms before the word. The leading edge has a soft 12 px feathered ink bleed.
  Already-written words stay. Add a faint ink shadow (`rgba(59,42,30,0.25)`, blur 2) for a printed-on-paper feel.
- Blocks simply pan off screen with their scene. No exit animation is needed.

## Render (16:9, in chunks)

- `scene/index.html` loads `data.js` (`window.DATA = {timeline, beats, scenes, chorus, meta}`), the fonts, `paper.jpg`, and the
  images with their ink JSON and reveal maps. It exposes `window.ready`: fonts loaded and checked with `document.fonts.check`
  (abort on failure), plus layout and measuring done **after** the fonts load. It also exposes `async window.renderFrame(t)`.
- `scene/render.mjs <from> <to> <out.mp4>` starts the local static server, then renders frames with
  `canvas.toDataURL("image/jpeg", 0.96)` piped to
  `ffmpeg -f image2pipe -c:v mjpeg -i - -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30`.
  - **Long songs:** split into 4–6 chunks rendered in parallel, then join them with the concat demuxer (`-c copy`).
    Because every frame depends only on `t`, any chunk can be re-rendered on its own.
  - To fix a few seconds, re-render the whole chunk. Never splice onto a trimmed stream copy: the timestamps break.
  - `--stills t1,t2,… dir` writes PNG stills.

## Contact sheet: required before the full render

Render about 12 stills:
1. the opening title writing on;
2. scene 1 mid ink draw-in;
3. scene 1 mid wash bloom;
4. a finished scene with its lyric block half written;
5. a chorus scene;
6. the same chorus on its repeat (same layout);
7. a pan between two scenes, with leaves;
8. a busy scene, to check that the block avoids faces;
9. the brightest image;
10. the darkest image;
11. the last scene;
12. the ending.

Tile them with `ffmpeg -i stills/s_%02d.png -vf "scale=480:-1,tile=4x3:padding=8:color=0xf2e6d0" stills/contact_sheet.jpg`.
Look at the sheet yourself: no text on a face, the couple consistent, the ink readable, the paper seamless.
Then **show it to the user**, with the scene plan and the chorus timing table. **Wait for approval.**

## Final render and delivery

```bash
D=<duration>
ffmpeg -i out/video_noaudio.mp4 -i input/<song> -map 0:v -map 1:a -t $D \
  -af "afade=t=in:d=0.5,afade=t=out:st=$(echo "$D-2"|bc):d=2" -c:v copy -c:a aac -b:a 192k -movflags +faststart out/<slug>_watercolor_1080p.mp4
VB=$(python3 -c "print(int(19*8*1024*1024/$D/1000 - 96))")k      # WhatsApp: 1280×720, two-pass, 19 MB budget
ffmpeg -y -i out/<slug>_watercolor_1080p.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v $VB -pass 1 -an -f null /dev/null
ffmpeg -i out/<slug>_watercolor_1080p.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v $VB -pass 2 -c:a aac -b:a 96k -movflags +faststart out/<slug>_watercolor_720p_whatsapp.mp4
```
Verify the 720p copy is under 20 MB (`stat`). If it isn't, lower `VB` by 10% and re-encode. Paper texture compresses
poorly, so if the 720p copy shows blocking, re-encode with `-tune grain` before dropping the bitrate further.
Check both files with `ffprobe`: resolution, 30 fps, an audio stream, the duration, and the frame count (`-count_packets`).

Before writing into `out/`, check for existing files and **ask before overwriting**.

## Final report to the user

- the scene plan (lines → scene → image);
- the chorus timing table (which repeats took transferred timing and why);
- the pan speed;
- the file paths with their sizes and durations;
- any re-aligned or user-confirmed words;
- any face-box corrections you made;
- offer tweaks: block placement, pan speed, bloom speed, leaf amount.
