---
name: red-rap-lyrics
description: Build a fast, one-red-grade rap lyric video in 4 sections — a red glass lyrics card peeling in over a tilted wall of lyric words, neon words standing on a rainy street with ripple reflections, the rapper's photo as a white stipple particle portrait with stacked italic lyrics, and a 3D tower of words with the camera easing to every sung word — ending on a DAMN! slam. Renders 9:16 and 16:9. Use when the user runs /red-rap-lyrics or attaches a rap song, its lyrics (Devanagari is fine), a photo of the rapper and reference reels and asks for a rap lyric video.
argument-hint: "<rap song (mp3/clip)> <lyrics, Devanagari ok> <rapper photo> <reference reel per section> [swear words to mask] [\"Title — Artist ft. Artist\"]"
---

# Red Rap Lyrics

Make a fast rap lyric video in **one red grade**, with four sections that each feel like a
different camera rig but share one world: deep red-black, glowing white, red neon, grain.
Every word lands exactly on the voice.

Reference feel: rap lyric videos such as "Hola Amigo" (KR$NA ft. Seedhe Maut). Use that and
the user's reference reels for **style, timing and motion only**: fonts, sizes, colours,
eases, how words appear. Don't copy their footage, logos or artwork. Every frame is drawn by
our own code.

## Non-negotiable rules (every run)

1. **Everything is drawn in code.** One HTML `<canvas>` scene is rendered frame by frame in
   headless Chromium (Playwright), and the frames are piped to ffmpeg. The only outside
   pixels are the user's rapper photo, which is turned into particles. No stock footage and no
   image generators. Every visual is a pure function of time `t` with seeded PRNGs, so a
   re-render, or any chunk of frames rendered in parallel, is identical.
2. **Word timings come only from forced alignment** (torchaudio `MMS_FA` on the demucs vocal
   stem), using the lyrics **exactly as the user wrote them**. Never guess, eyeball or
   interpolate timings. If a word aligns badly, re-align that window or ask the user.
3. **Show a contact sheet of stills before the full render** (both aspect ratios), then wait for the user's go-ahead.
4. **Ask before overwriting** any existing file in the work or output folder (use AskUserQuestion).
5. Deliver, **for each aspect ratio** (9:16 1080×1920 and 16:9 1920×1080), a master MP4 with the
   song's audio and a 720p copy **under 20 MB** for WhatsApp. That's 4 files. The audio is
   the original mix, except that the vocals are removed under any masked swear words (step 7).

## Inputs

Collect these, and ask for anything that is missing before starting:

| Input | Notes |
|---|---|
| Rap song | Anything ffmpeg reads. A clip is fine, and the video then covers only that clip. |
| Lyrics | Exactly as written by the user, in Devanagari, Roman or mixed script, **with every repetition and ad-lib** (the final ad-lib, e.g. `DAMN!`, must be in the lyrics). The display keeps the user's script; alignment uses a romanized copy. Never write lyrics from memory. If the user can't supply them, offer a Whisper large-v3 transcription and show it for correction first. |
| Rapper photo | One clear photo of the rapper. It must be the user's photo or one they have the rights to use. Prefer a well-lit face at 1000 px or more. |
| Reference reels | One per section, 4 in total. If fewer are given, ask which section each one is for, and use this file's defaults for the rest. |
| Swear words | Optional list of words to mask and mute (step 7). |
| Title + artists | For the lyrics card. Cover art is drawn in code (step 3) unless the user supplies their own artwork. |

Work folder: `red-rap/<song-slug>/` with `input/ sep/ analysis/ refs/ scene/ stills/ out/`.
If it already exists, **ask** before reusing or overwriting.

## Setup (once per machine)

```bash
pip install demucs librosa soundfile torch torchaudio uroman opencv-python-headless numpy
pip install rembg onnxruntime   # background removal. If its model download is blocked, use the torchvision fallback in step 5
npm i playwright                # if Playwright is already installed, do NOT reinstall the browser
```
- `torchaudio` must provide `torchaudio.pipelines.MMS_FA`. Pin `torchaudio==2.8.*` (CPU wheels from
  `https://download.pytorch.org/whl/cpu`) if a newer version has dropped it. Do not switch to another aligner.
- **Fonts must be local**, in `scene/fonts/`. Fetch the TTF URLs from the Google Fonts CSS API (raw GitHub URLs may be blocked):
  ```bash
  curl -sS -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Teko:wght@300;500;700&family=Anton&family=Inter:wght@500;700" \
    | grep -o 'https://fonts.gstatic.com[^)]*\.ttf'      # curl each one; check with `file` that each is TrueType
  ```
  - **Teko** (300/500/700) covers both Latin and **Devanagari**. Use it for all Hindi text and for the stacked rows.
  - **Anton** is for big bold condensed Latin rows. For Devanagari words in those rows, fall back to Teko 700.
  - **Inter** is for card UI text.
  - Teko has no italic, so make "italic" with a skew transform (`ctx.transform(1, 0, -0.21, 1, 0, 0)`), never `font-style`.
- Playwright installed globally isn't visible to an ESM `import`. In `render.mjs`, load it with
  `createRequire(import.meta.url)` and fall back to the global `node_modules/playwright` path.

---

## Step 1: Listen. Separate, align, find beats and kicks, split into 4 sections

**1a. Separate:**
```bash
ffmpeg -i input/<song> -ac 2 -ar 44100 analysis/song.wav
demucs --two-stems=vocals -n htdemucs -o sep analysis/song.wav   # → sep/htdemucs/song/{vocals,no_vocals}.wav
```
Transcribe the last 30 s with Whisper to check for a channel promo or voice-over. If there is
one, end the video before it.

**1b. Romanize for alignment only.** The display keeps the user's text and punctuation.
```python
import re, uroman as ur
U = ur.Uroman()
def norm(word):            # Devanagari / mixed → MMS tokens (a-z and ')
    return re.sub(r"[^a-z']", "", U.romanize_string(word).lower())
```
Drop words that normalize to empty (pure punctuation or emoji) from alignment, but keep them in the display.
Numbers: spell them the way they're rapped, e.g. `100` → `sau`. Ask if unsure.

**1c. Force-align every word.** Use MMS_FA **with star tokens** between lines, so ad-libs, hype
shouts and breaths that aren't in the lyrics don't pull words out of place:
```python
import torch, torchaudio
from torchaudio.pipelines import MMS_FA as bundle
SR, HOP = bundle.sample_rate, 320
wav, sr = torchaudio.load("sep/htdemucs/song/vocals.wav")
wav = torchaudio.functional.resample(wav.mean(0, keepdim=True), sr, SR); n = wav.size(1)
model = bundle.get_model(with_star=True).eval()
WIN, CTX, chunks = 30 * SR, 2 * SR, []                 # long songs: 30 s windows, 2 s context (full song would OOM)
for s in range(0, n, WIN):
    a, b = max(0, s - CTX), min(n, s + WIN + CTX)
    with torch.inference_mode(): e, _ = model(wav[:, a:b])
    off, keep = (s - a) // HOP, min(WIN, n - s) // HOP
    chunks.append(e[0, off:off + keep])
emission = torch.cat(chunks)
flat = ["*"] + [x for L in lines for x in [w["norm"] for w in L["words"]] + ["*"]]
spans = bundle.get_aligner()(emission, bundle.get_tokenizer()(flat))   # skip the "*" spans when reading results
ratio = n / emission.size(0) / SR    # word start = span[0].start*ratio, end = span[-1].end*ratio, score = mean(span.score)
```
Write `analysis/timeline.json`:
`{lines: [{i, display, start, end, words: [{display, norm, start, end, score, swear?}]}]}`.

Checks:
- Flag words with `score < 0.4`, words longer than 1.5 s (rap words are short), and overlapping lines.
  Re-align a flagged line inside its own window (±2 s, star tokens on both sides).
- Rap is dense, so also confirm that the **gaps** between words make sense. If a whole line lands
  on an instrumental gap, the written lyrics probably differ from what's rapped there.
- If still bad, **show the user the table and ask.** Never patch a time by hand.

**1d. Beats and kicks:**
```python
import librosa, numpy as np
y, sr = librosa.load("analysis/song.wav", sr=22050)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
S = np.abs(librosa.stft(librosa.effects.percussive(y), n_fft=2048, hop_length=256))
low = S[librosa.fft_frequencies(sr=sr, n_fft=2048) < 150].sum(0)       # kick band
kick_env = librosa.onset.onset_strength(S=librosa.amplitude_to_db(low[None]), sr=sr, hop_length=256)
kicks = librosa.onset.onset_detect(onset_envelope=kick_env, sr=sr, hop_length=256, units="time", backtrack=False)
```
Save `analysis/beats.json` with `tempo`, `beats`, `downbeats`, `kicks`, and `energy` (RMS at 10 Hz).
Kicks drive the portrait's breathing, small camera shakes and grain pulses.

**1e. Split into 4 sections**, one per look:
card → street → portrait → tower. Cut only at **line boundaries that fall on a downbeat**, and
prefer energy changes or verse/hook boundaries. Aim for roughly equal lengths, but put the
densest, fastest verse in the tower section (it shows off the per-word camera), and the
last line there too (it ends on the slam). **Tell the user which lines go in each section**
(first and last line plus time range), then continue.

## Step 2: Study the reference reels

For each reel, `refs/<n>/`:
```bash
ffmpeg -i input/ref<n>.mp4 -vf "fps=2,scale=480:-1" refs/<n>/f_%04d.jpg
ffmpeg -i refs/<n>/f_%04d.jpg -vf "tile=6x5:padding=4" refs/<n>/sheet_%02d.jpg   # look at every sheet
```
Write `refs/<n>/notes.md`:
- **Fonts:** the closest Google Font for each text style (prefer Teko, Anton or Inter so the
  family stays small), its weight, and whether it's italic/skewed.
- **Sizes:** cap height as a % of frame height, tracking, line spacing, alignment and position.
- **Colours:** sampled hex values, for example `ffmpeg -ss T -i ref -frames:v 1 -vf "crop=w:h:x:y,scale=1:1" -f rawvideo -pix_fmt rgb24 -`,
  for the background, dim words, lit words, keywords and glows.
- **How words appear:** cut on, fade, flicker, scale, slide or blur, the duration in frames, and
  whether a word lights up on its own or with its line.
- **Every camera move:** its start and end, and the **exact ease**. For each move, extract that window at full
  frame rate (`fps=30`), track the motion (OpenCV `phaseCorrelate` or ECC for translation, scale and
  rotation per frame), normalize progress 0→1, and fit the curve against linear, sine,
  quad, cubic, quart, quint, expo and back (in, out and in-out). Record the best fit and its duration.
- **Transitions:** flash colour and frames, or zoom-blur strength and frames.

The section's scene parameters in `scene/data.js` (`style.s1…s4`) come from these notes.
Where a reel doesn't specify something, use the defaults below.

## Step 3: Section 1, the red glass lyrics card

- **Background:** a huge **tilted wall** of this section's lyric words, about 6–9 rows of Anton/Teko at
  180–260 px, in deep red (`#3a0508` on `#120203`). Rotate it −12°, use slight perspective (a
  `setTransform` skew), and drift it slowly (about 20 px/s diagonal) with a soft radial dark falloff.
- **Card:** dark red glass (`rgba(60,6,10,0.72)` fill, 1 px `rgba(255,90,90,0.35)` border, inner gradient,
  32 px radius, a blurred backdrop made by drawing the wall into an offscreen canvas with `blur(18px)`
  clipped to the card), with:
  - a drawn **cover art** square: a red gradient, a halftone dot pattern and the title initials. Use the user's artwork instead if supplied.
  - the song title (Inter 700), the artists (Inter 500, 60% white), a **star** icon and a **•••** icon drawn as paths;
  - the lyric area below.
- **Page-curl unfold** (about 0.9 s, ease from the reel, default easeInOutCubic):
  1. The fold line is perpendicular to the card's diagonal, starting at the bottom-right corner, and moves up and left with progress `p`.
  2. Clip the card to the half-plane already passed by the fold, so the revealed part shows its face.
  3. Draw the flap: reflect the not-yet-revealed part across the fold line (mirror transform about the
     line), clip it to the card bounds, and fill it with the card's lighter **back side**
     (`#5a0c12`→`#2a0407` gradient across the flap).
  4. Draw a soft shadow strip along the fold on the face side, and a highlight on the flap edge.
  5. At `p = 1` the flap is gone and the whole card is flat.
- **Lyrics:** about 5 visible lines in Inter 700 (or Teko 500 for Devanagari) at 44–52 px (9:16) or 40–46 px (16:9).
  - Every word starts dim red (`#6b1218`) and switches to **glowing white** (`#fff`, red-white glow) at its aligned start, with a 60–80 ms anticipation fade.
  - Lines **scroll up** with an ease-in-out so that the current line sits at the second slot. Each scroll takes about 0.35 s and starts 0.2 s before the next line's first word.

## Step 4: Section 2, the rainy red street

- **World** (all canvas primitives, a function of `t`):
  - a dark red night sky (`#0a0102`→`#2a0306`);
  - two rows of **city blocks**: rectangles with seeded lit windows (`#ff4a3a` at 10–60% α, a few flickering) and roof-edge rim light;
  - **street lamps** with sodium-red heads and **light cones** (additive gradients);
  - a wet road with a vanishing point and light streaks reflected on it;
  - **rain streaks** (thin slanted lines, 2 depth layers);
  - **splash ripples**: seeded expanding ellipses on the road, each a sum of 2 rings fading over 0.6 s.
- **Words standing on the ground.** Each line is built as 2–3 rows that sit on the road's ground line:
  1. **Row A**: big bold condensed (Anton; Teko 700 for Devanagari) in white, about 11–14% of frame height.
  2. **Row B**, plus an optional Row C: smaller **red neon** (Teko 500, `#ff2a2a`), with a glow made of two shadow passes
     (`rgba(255,40,40,.9)` blur 18 and blur 50). It **flickers on**: a seeded on/off pattern of 3–4 toggles
     in 140 ms starting at the word's aligned start, then steady with a slight 8 Hz hum (±6% α).
  - Words appear **word by word on their aligned start**: row A rises 20 px and fades in over 0.12 s; row B uses the neon flicker.
- **Reflection:** render the line block into an offscreen canvas, flip it vertically under the ground line,
  α 0.35, darkened red. Ripple it by drawing it in 3 px horizontal strips, each offset by
  `sin(y·0.09 + t·6)·(2 + 6·depth)` px. Splash ripples near a word add an extra local wobble.
- **Camera:** a slow push-in through the section (scale 1.00→1.10, from the reel's ease, default
  easeInOutSine). Add a small kick shake (±2 px, decaying over 0.15 s) on every kick.

## Step 5: Section 3, the particle portrait

**5a. Cut out the rapper** (`analysis/portrait.py`):
- Use `rembg` (`rembg.remove`) to get an alpha matte.
- If its model can't be downloaded, use torchvision `deeplabv3_resnet101` (weights from
  download.pytorch.org): person class 15 as the mask, softened with a light feather
  (erode 2 px, then Gaussian blur 3 px on the mask).
- Show the user the cutout as one of the contact-sheet stills.

**5b. Stipple 20–35k points** so the face reads:
```python
import cv2, numpy as np
img = cv2.imread("input/rapper.jpg"); g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
g = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8)).apply(g)            # local contrast
edges = cv2.magnitude(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1))
dens = 0.75 * (g / 255.0) ** 1.4 + 0.45 * np.clip(edges / np.percentile(edges, 99), 0, 1)
dens *= mask; dens /= dens.sum()                                              # white dots where it's bright or on edges
rng = np.random.default_rng(7); idx = rng.choice(dens.size, N, p=dens.ravel(), replace=False)
# jitter by ±0.5 px, then run 2–3 Lloyd-like relaxation passes (nearest-neighbour push) to avoid clumps
# store per dot: x, y (normalized), size 0.8–2.2 px from local density, brightness from g
```
Save `analysis/dots.bin` (Float32 array). The scene loads it with `fetch` and `arrayBuffer`.
Draw the dots as tiny white rects or arcs in batches by size bucket (one `fill()` per bucket) so 35k dots stay fast.

**5c. Motion:**
- **Fly in:** each dot starts at a seeded off-screen or scattered position and arrives over 0.8–1.4 s
  with easeOutExpo, staggered by distance from the face centre.
- **Breathe with the beat:** on each kick, scale dots outward from the centre by +1.5% and brighten by 20%,
  decaying over 0.25 s.
- **Drift off the edges:** dots near the matte's edge drift outward with seeded noise. Add **red and white
  embers** (about 150, additive, rising and flickering).
- **Background:** deep red-black radial glow (`#2b0306` centre → `#050001`).

**5d. Stacked italic lyrics** beside the portrait (right side in 16:9, lower third in 9:16):
- Each line is split into 2–4 rows of 1–3 words. Use Teko 500/700, skewed −12°.
- **Scale each row to a similar width**: set the font size so the row width equals the target column width,
  clamped to 0.6×–1.8× of the base size, so short rows get huge.
- All words start **dim grey** (`#5a5a5a` at 70%). At their aligned start they **flash white** (a 1-frame overshoot to
  `#fff` with a strong glow, settling in 0.15 s). **Keywords** (chosen in step 1: hooks, names, punchlines) flash **red** (`#ff2a2a`).
- The previous line's rows slide up and fade as the next line starts.

## Step 6: Section 4, the 3D word tower

**Layout** (in world units, analysis step `analysis/tower.py` → `tower.json`):
- The corner is the vertical edge at x=0, z=0. The **front face** is the plane z=0, extending to x<0. The **side face** is the plane x=0, extending to z>0.
- Stack the section's words in rows downward (y decreasing), in sung order:
  - front-face words are **right-aligned to the corner** (their right edge at x=0);
  - about every 3rd–5th word, or any word that doesn't fit, goes on the **side face**, left-aligned at the corner;
  - **key words are big** (2–3× size) and **red**, and the other words are white (Anton/Teko).
- Store for each word: `{face, x, y, size, w, color, start, end}`.

**Projection:** a simple pinhole camera in JS. For each word, build its local frame: origin, unit
x-axis along its face, unit y-axis up. Project the origin, origin+x and origin+y. Then set
`ctx.setTransform(a, b, c, d, e, f)` from the projected basis (an affine approximation is fine at
these sizes) and `fillText` at (0,0). Cull words behind the camera, sort by depth, and fade by distance.

**Camera keyframes**, one per sung word:
- `target` = the word's centre, plus `yaw` (front face about −18°, side face about +55°), `pitch` (±6° seeded),
  `roll` (±4° seeded), and `distance` (tighter for small words, wider for big key words).
- The move to each word starts 0.1 s before the word and takes `min(0.32 s, the gap to the next word)`, with the reel's ease (default easeInOutCubic).
  Interpolate target and distance linearly in eased time and the angles by shortest arc. Hold between moves with a slight drift.
- **At the end of the verse, pull back** over about 1.2 s (easeInOutQuint) to show the whole tower, slowly rotating.
- Words light up on their aligned start: dim (`#3a0a0c`) → white or red over 0.1 s, with a glow.

## Step 7: The DAMN! slam, and swear masking

**Final ad-lib slam:**
- The last aligned word (e.g. `DAMN!`) appears at its start as a **huge white condensed word** (Anton, about 30% of frame height).
- It scales 2.6→1.0 in 0.12 s (easeOutExpo), with a **shake** (seeded noise, ±24 px decaying over 0.45 s, 2° roll) and
  **red echo trails**: 5 copies behind it, scaled 1.04–1.25, red at 50%→8% α, lagging the slam by 1–5 frames.
- One red flash frame at impact. Hold, then cut to black on the music's end.

**Swear words** (only the ones the user names; match on the display text or on `norm`):
- **Display:** the first letter plus `***` (e.g. `B***`) in every section, styled like any other word.
- **Audio:** replace **only the voice** with the instrumental at that moment, so the beat keeps playing:
```python
import soundfile as sf, numpy as np
mix, sr = sf.read("analysis/song.wav"); inst, _ = sf.read("sep/htdemucs/song/no_vocals.wav")
gain = np.ones(len(mix))                               # 1 = original mix, 0 = instrumental only
for w in swears:                                       # aligned word times, ±30 ms pad, 15 ms raised-cosine ramps
    a, b = int((w["start"] - .03) * sr), int((w["end"] + .03) * sr); r = int(.015 * sr)
    gain[a:b] = 0; gain[a - r:a] = np.minimum(gain[a - r:a], np.cos(np.linspace(0, np.pi / 2, r))**2)
    gain[b:b + r] = np.minimum(gain[b:b + r], np.sin(np.linspace(0, np.pi / 2, r))**2)
out = mix * gain[:, None] + inst[:len(mix)] * (1 - gain[:, None]); sf.write("analysis/song_clean.wav", out, sr)
```
  This becomes the delivery audio. Listen to each masked spot (cut ±1 s with ffmpeg) and confirm
  the word is gone and the beat is intact.

## Step 8: Cuts, grade and finishing

- **Between sections:** use the reel's transition. Otherwise alternate:
  - a **red flash**: 2 frames of `#ff1a1a` screen-blended at 85%, then a 6-frame fade;
  - a **zoom-blur**: draw the frame 8× scaled 1.00→1.12 about the centre at 12% α each, over 6 frames, peaking on the cut).
  Put cuts on the downbeat at the section boundary.
- **On everything:**
  - a one-red grade: a final pass with `globalCompositeOperation = "color"` using `#5a0006` at 25%, but whites
    and neon must stay white or red, so apply the grade before drawing the text layers;
  - seeded **grain** (4 pre-made 256 px noise tiles, overlay at 5–7%, pulsing +2% on kicks);
  - a **vignette** (radial, `rgba(0,0,0,0.7)` at the corners).
- **Layouts:** every section has a 9:16 and a 16:9 layout in relative units (`W`, `H`, `min(W,H)`).
  The page reads `?w=1080&h=1920` or `?w=1920&h=1080`. In 9:16, stack things (portrait above, rows below;
  street words larger). In 16:9, place them side by side.

---

## Build: the scene and the renderer

- `scene/index.html` loads `data.js` (`window.DATA = {timeline, beats, sections, style, tower, meta}`),
  `dots.bin` and the fonts. It exposes `window.ready` (fonts loaded, checked with `document.fonts.check`, then
  aborts on failure; dots loaded) and `async window.renderFrame(t)`.
- `scene/render.mjs <from> <to> <out.mp4> --w W --h H` renders frames with
  `canvas.toDataURL("image/jpeg", 0.96)` piped to `ffmpeg -f image2pipe -c:v mjpeg -i - -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30`.
  Render 4 parallel chunks and join them with the concat demuxer (`-c copy`). `--stills t1,t2,… dir` writes PNG stills.

## Contact sheet: required before the full render

For **each aspect ratio**, render about 12 stills:
1. the card mid page-curl;
2. the card with a line half lit;
3. the street with neon flickering on and its reflection;
4. the street during a push-in;
5. portrait dots flying in;
6. the portrait with stacked rows, with a keyword in red;
7. the tower close on a word;
8. the tower on a side-face word;
9. the tower pulled back;
10. a red-flash or zoom-blur cut;
11. the DAMN! slam with echo trails;
12. a masked swear word, if any.

Also show the photo cutout. Tile them with
`ffmpeg -i stills/<ar>/s_%02d.png -vf "scale=480:-1,tile=4x3:padding=8:color=0x0a0102" stills/contact_<ar>.jpg`.

Look at the sheets yourself first: is the text readable, is it one red grade throughout, does the face read in the dots,
and is nothing cut off in 9:16? Then **show them to the user** with the section/line table.
**Wait for approval** before the full render.

## Final render and delivery

```bash
D=<duration>; AUD=analysis/song_clean.wav   # or analysis/song.wav if nothing is masked
ffmpeg -i out/v_<ar>.mp4 -i $AUD -map 0:v -map 1:a -t $D -af "afade=t=in:d=0.3,afade=t=out:st=$(echo "$D-1.0"|bc):d=1.0" \
  -c:v copy -c:a aac -b:a 192k -movflags +faststart out/<slug>_red_<ar>.mp4
# WhatsApp: 720p (720×1280 or 1280×720), two-pass to a 19 MB budget with 96k audio
VB=$(python3 -c "print(int(19*8*1024*1024/$D/1000 - 96))")k
```
Run the two passes with `-vf scale=720:1280` (9:16) or `scale=1280:720` (16:9) and `-b:v $VB`. Then:
- Verify each WhatsApp file is under 20 MB (`stat`). If it isn't, lower `VB` by 10% and re-encode.
- Rain and grain are expensive at low bitrates: if the 720p copy looks blocky, re-render the frames for it
  with `grain=0.5` (a scene flag) rather than lowering the bitrate further.
- Check all 4 files with `ffprobe`: size, 30 fps, an audio stream, and the duration.

Before writing into `out/`, check for existing files and **ask before overwriting**.

## Final report to the user

- the section table (lines and times per section);
- the paths of all 4 MP4s with their sizes and durations;
- what each reference reel set: fonts, colours, eases;
- the masked words and their times;
- any re-aligned or user-confirmed words;
- offer tweaks: keywords, row splits, camera distance, flicker amount, section boundaries.
