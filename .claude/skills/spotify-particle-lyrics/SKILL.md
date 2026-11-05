---
name: spotify-particle-lyrics
description: Build a 16:9 lyric video in four looks — a tilted deep-maroon Spotify-style lyrics card whose words light up with glow, sparks, cross glints and a riding light point; a white stipple particle portrait that breathes on the beat and morphs from one photo into a second with a staggered swirl and a flash ring (then blows apart) beside bouncing white-caps / red-serif rows; gold serif motion graphics copied from a reference reel (fast stacked words with blur in/out, a moon on a starfield, a lyric wall that turns like a cylinder); and a black-and-white music player seen through rainy glass where every drop refracts the scene. Also renders a 9:16 Reel. Use when the user runs /spotify-particle-lyrics or attaches a song (MP3 or clip), its lyrics, 1-2 photos, a Spotify logo PNG and a reference reel and asks for a Spotify + particle lyric video.
argument-hint: "<song (mp3/clip)> <lyrics> <photo 1 (artists)> [photo 2 to morph into] <Spotify logo PNG> <reference reel for the motion graphics> [\"Title — Artist × Artist\"] [reel]"
---

# Spotify Particle Lyrics

Make a 1920×1080, 30 fps lyric video that moves through **four looks**, each one a different
"screen" but all sharing one dark, warm world:

1. **Spotify card**: a tilted deep-maroon lyrics card in 3D, the sung word lighting up white.
2. **Particle portrait**: the artist's photo as 20–25k white stipple dots that breathe with the beat
   and **morph into a second photo**, with stacked lyrics on the right.
3. **Motion graphics**: gold serif lyrics in the style of the user's reference reel.
4. **Rain ending**: a blurred black-and-white music player seen through wet glass.

Reference feel: "Kalyani" (ARJN × KDS × Fifty4 × Ronn ft. Shreya Ghoshal) Spotify + particle lyric
videos. Use that and the user's reel for **style, timing and motion only**. Don't copy their footage
or artwork. Every frame is drawn by our own code.

## Non-negotiable rules (every run)

1. **Everything is drawn in code.** One HTML `<canvas>` scene is rendered frame by frame in headless
   Chromium (Playwright), and the frames are piped to ffmpeg. The only outside pixels are the user's
   photos (turned into dots), the cover image if given, and the Spotify logo PNG. No stock footage and
   no image generators. Every visual is a pure function of `t` with seeded PRNGs (mulberry32), so
   re-renders and parallel chunks are identical.
2. **Word timings come only from forced alignment** (torchaudio `MMS_FA` on the demucs vocal stem),
   using the lyrics **exactly as the user wrote them**. Never guess, eyeball or interpolate timings.
   If a word aligns badly, re-align that window or ask.
3. **Show a contact sheet of stills before the full render** (both aspect ratios if a Reel is wanted),
   then wait for the user's go-ahead.
4. **Ask before overwriting** any existing file in the work or output folder (AskUserQuestion).
5. Deliver the 1920×1080 master MP4 with the original audio (0.5 s fade in, 1.5 s fade out) and a 720p
   copy **under 20 MB** for WhatsApp. If a Reel is asked for, also 1080×1920 plus its 720×1280 WhatsApp copy.
6. **Never redraw, recolour or distort a brand logo.** Use the user's Spotify PNG as supplied. With no
   PNG, draw a neutral music-note badge in its slot and say so.

## Inputs

| Input | Notes |
|---|---|
| Song | Anything ffmpeg reads. A clip is fine; the video then covers only that clip. |
| Lyrics | Exactly as sung, with every repetition. Roman, Hindi/Urdu in Roman, or another script: the display keeps the user's text, alignment uses a `uroman` romanized copy. Never write lyrics from memory; if none are given, offer a Whisper large-v3 transcript for correction first. |
| Photo 1 | The artists (or one artist). Must be the user's photo or one they have the rights to. Prefer a well-lit face, 1000 px+. |
| Photo 2 | The photo the dots morph into (optional; without it, morph photo 1 into a mirrored, tighter crop of itself). |
| Spotify logo PNG | Drawn unaltered, aspect kept, over a **white disc** so its transparent bars read white. |
| Reference reel | For the motion-graphics section (Step 2). Without one, use this file's defaults and say so. |
| Title + artists | For the card and the player, e.g. `Kalyani — ARJN × KDS × Fifty4 × Ronn ft. Shreya Ghoshal`. |
| Cover image | Optional; otherwise draw cover art in code (gradient, moon, title in script). |

Work folder: `spotify-particle/<song-slug>/` with `input/ sep/ analysis/ refs/ scene/ stills/ out/`.
If it already exists, **ask** before reusing or overwriting.

## Setup (once per machine)

```bash
pip install demucs librosa soundfile torch torchaudio uroman opencv-python-headless scikit-image numpy
pip install rembg onnxruntime      # background removal; torchvision fallback in Step 4 if its model download is blocked
npm i playwright                   # if Playwright is already installed (even globally), do NOT run `playwright install`
```
- `torchaudio` must provide `torchaudio.pipelines.MMS_FA`. Pin `torchaudio==2.8.*` (CPU wheels from
  `https://download.pytorch.org/whl/cpu`) if a newer version has dropped it. Do not switch aligners.
- **Fonts must be local**, in `scene/fonts/`. Get the TTF URLs from the Google Fonts CSS API (raw GitHub URLs may be blocked):
  ```bash
  curl -sS -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Inter:wght@500;700;900&family=Instrument+Serif:ital@1&family=Cormorant+Garamond:ital,wght@0,600;1,500" \
    | grep -o 'https://fonts.gstatic.com[^)]*\.ttf'      # curl each; check each with `file` (TrueType)
  ```
  Inter 700 (card lyrics, player), Inter 900 (white caps rows), Instrument Serif italic (red rows),
  Cormorant Garamond 600 + italic 500 (the gold serif; swap for the reel's closest Google serif, e.g. Playfair Display).
- In the page, load fonts with `@font-face`; in `window.ready` `await document.fonts.load(...)` for every face and
  **throw if `document.fonts.check` fails**. Do all text measuring and layout **after** that.
- Playwright installed globally isn't visible to an ESM `import`: in `render.mjs` use `createRequire(import.meta.url)`
  then `require("playwright")`, falling back to the global `node_modules/playwright` path.
- **Serve the scene over a local HTTP server** inside `render.mjs` (127.0.0.1), not `file://`, or loaded images taint the canvas and `toDataURL` throws.

---

## Step 1: Listen. Separate, align, find beats and kicks, propose the sections

**1a. Separate:**
```bash
ffmpeg -i input/<song> -ac 2 -ar 44100 analysis/song.wav
demucs --two-stems=vocals -n htdemucs -o sep analysis/song.wav    # → sep/htdemucs/song/{vocals,no_vocals}.wav
```
Transcribe the last 30 s with Whisper to check for a channel promo or voice-over; end before it.

**1b. Force-align every word** with MMS_FA **and star tokens** between lines, so alaaps, ad-libs and
breaths that aren't in the lyrics don't pull words out of place:
```python
import re, torch, torchaudio, uroman as ur
from torchaudio.pipelines import MMS_FA as bundle
U = ur.Uroman(); norm = lambda w: re.sub(r"[^a-z']", "", U.romanize_string(w).lower())
SR, HOP = bundle.sample_rate, 320
wav, sr = torchaudio.load("sep/htdemucs/song/vocals.wav")
wav = torchaudio.functional.resample(wav.mean(0, keepdim=True), sr, SR); n = wav.size(1)
model = bundle.get_model(with_star=True).eval()
WIN, CTX, chunks = 30 * SR, 2 * SR, []                 # 30 s windows, 2 s context (a whole song at once would OOM)
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
Write `analysis/timeline.json` `{lines:[{i, display, start, end, words:[{display, norm, start, end, score}]}]}`.
Flag words with `score < 0.4`, sung words over 2.5 s, rap words over 1.5 s, and overlapping lines; re-align a
flagged line in its own ±2 s window with stars on both sides. If still bad, **show the table and ask**. Never patch by hand.

**1c. Beats and kicks:**
```python
import librosa, numpy as np
y, sr = librosa.load("analysis/song.wav", sr=22050)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
S = np.abs(librosa.stft(librosa.effects.percussive(y), n_fft=2048, hop_length=256))
env = librosa.onset.onset_strength(S=librosa.amplitude_to_db(S[librosa.fft_frequencies(sr=sr, n_fft=2048) < 150].sum(0)[None]), sr=sr, hop_length=256)
pk = librosa.util.peak_pick(env, pre_max=3, post_max=3, pre_avg=8, post_avg=8, delta=np.percentile(env, 80) * 0.5, wait=int(0.2 * sr / 256))
kicks = [librosa.frames_to_time(x, sr=sr, hop_length=256) for x in pk if env[x] > np.percentile(env, 80)]   # peak-pick, or every hi-hat is a "kick"
```
`downbeats` = the strongest of the 4 beat phases by onset strength. Save `energy` (RMS at 10 Hz). Save `analysis/beats.json`.

**1d. Rap or sung, and the section plan.** Per line, count vowel groups per second of the line
(`len(re.findall("[aeiou]+", word))` summed over the words ÷ line duration): above about **4.5 syllables/s it's rap**,
below it's sung. Tell the user which lines are rap and which are sung, then propose the sections:

| Section | Look | Default content |
|---|---|---|
| A | Spotify card | intro + first 1–2 lines |
| B | Particle portrait | the next 2 lines; **rap lines go here** (fast rows suit the bouncing type) |
| C | Spotify card again | one line, so the card returns |
| D | Motion graphics | the **sung** hook / melodic lines (2 lines: stack, then cylinder) |
| E | Rain player | the last line, ending on the outro |

Cut only in **line gaps**, on the downbeat nearest the gap's middle (falling back to a beat). Pick the
**morph word** (Step 4): a word about "you", a name, or the turn of the line (e.g. `tumko`, "you"). Tell the
user the section table (lines, time range, morph word) and continue; change it if they object.

## Step 2: Study the reference reel (motion-graphics style)

```bash
mkdir -p refs/mg && ffmpeg -i input/ref.mp4 -vf "fps=2,scale=480:-1" refs/mg/f_%04d.jpg
ffmpeg -i refs/mg/f_%04d.jpg -vf "tile=6x5:padding=4" refs/mg/sheet_%02d.jpg      # LOOK at every sheet
```
Write `refs/mg/notes.md`:
- **Fonts**: the closest Google Font per text style (serif, weight, italic, caps, tracking), and the size as a % of frame height.
- **Colours**: sample hex values (`ffmpeg -ss T -i ref -frames:v 1 -vf "crop=w:h:x:y,scale=1:1" -f rawvideo -pix_fmt rgb24 -`)
  for the background, the gold gradient (light top, dark bottom), dim words and glows.
- **Word timing**: does each word cut on, blur in or scale in on the beat or on the voice? How many frames? How long
  do words stay? How many are stacked at once?
- **Transitions**: flash colour and frames, blur cuts, zooms.
- **Camera moves, with fitted eases.** For each move, extract the window at full rate (`fps=30`), track it (OpenCV
  `phaseCorrelate` for translation, ECC `MOTION_AFFINE` for scale and rotation), normalize progress 0→1, and fit
  linear, sine, quad, cubic, quart, quint, expo and back (in, out, in-out) by least squares. Record the best ease and duration.

The motion-graphics parameters in `scene/data.js` (`style.mg`) come from these notes. **Without a reel**, use the
defaults in Step 6 (Cormorant Garamond, gold `#fff1c4 → #e7bf68 → #9c6a24`, words in on easeInOutCubic 0.3 s,
camera easeInOutSine) and say so in the report.

## Step 3: The Spotify card (deep maroon, tilted in 3D)

**Card face** — an offscreen canvas (16:9: 1400×1240 design px; 9:16: 1000×1500), 46 px radius:
- background `#6e1426 → #4a0a18 → #300510` (a diagonal gradient) with a soft pink sheen top-left;
- top row: **cover art** (168 px, 14 px radius, with a shadow), the **title** (Inter 700, fit to the space left of the logo),
  the **artists** (Inter 500, 72% white), and the **Spotify logo** top-right: a white disc (r 40) with the user's
  PNG drawn on it unaltered (no PNG → a maroon music-note badge as a placeholder), then a 2 px divider;
- **lyrics**: Inter 700 at 84 px (9:16: 76 px), line height 1.24, left-aligned, all lines wrapped to the card width.

**Word light-up** (per word, at its aligned start `s`):
- dark `rgba(16,1,5,0.78)` → white, with `k = easeInOutCubic((t − (s − 0.06)) / 0.32)` (crossfade the two fills);
- a soft white **glow** (shadow `rgba(255,235,240,.95)`, blur 22) that is strong on the sung word and settles to 35% over 0.7 s;
- a **burst of 9 spark particles** from random points on the word, flying up and out 40–110 px (easeOutCubic) over 0.55–0.85 s, shrinking and fading;
- **3 cross glints** (4-point stars drawn with quadratic curves, r 8–22 px, rotating a little) popping on and off over 0.45 s;
- a **light point riding along the word**: an additive radial glow (r 46) that travels from the word's left to its right edge over the word's sung duration (easeInOutSine), fading out 0.25 s after.
Lines already sung stay white at 86%.

**Blur far lines**: per row, `blur(min(6, 2.2·|line − current|) px)`. The current line is the latest whose first word starts within 0.5 s.
**Scroll** so the current line's first row sits 1.25 line heights below the lyric top, with easeInOutCubic over 0.45 s starting 0.5 s
before its first word. Fade rows out at the top and bottom edge of the lyric area so no row is ever cut in half.

**Tilt in 3D with a slow camera drift.** Canvas 2D has no perspective, so texture-map the face through a 9×9 mesh of
triangles (each an affine `drawImage` clipped to the triangle, expanded 0.6 px to hide seams):
```js
const rx = (7 + 2.2*Math.sin(0.23*t)) * DEG, ry = (−13 + 3*Math.sin(0.17*t)) * DEG, rz = −2.5 * DEG;   // the return visit tilts the other way (ry +12, rz +2)
const f = 1.7*min(W,H), dist = f*(1.02 − 0.03*Math.sin(0.11*t));   // slow dolly; centre also drifts ±1.2% of the frame
// project(u,v): rotate X, then Y, then Z; screen = centre + f·xy/(z + dist). drawTri(face, srcTri, dstTri) per half-cell.
```
Behind it: the cover art blown up with `blur(60px) brightness(0.36)`, about 26 soft maroon bokeh circles (additive), and a
blurred dark drop shadow under the card's projected outline. In the first section the card rises in (0.2–1.6 s, easeOutCubic).

## Step 4: The particle portrait (photo → dots → second photo)

**4a. Cut out each photo** (`analysis/portrait.py`): `rembg.remove` for an alpha matte. If its model can't be downloaded,
torchvision `deeplabv3_resnet101` (person = class 15), erode 2 px, Gaussian blur 3 px. Show both cutouts on the contact sheet.

**4b. Stipple 20–25k dots per photo** so faces read:
```python
g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
g = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8)).apply(g)                        # local contrast
edges = cv2.magnitude(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1))
dens = 0.7 * (g / 255.0) ** 1.3 + 0.45 * np.clip(edges / np.percentile(edges, 99), 0, 1) + 0.05
dens *= mask; dens /= dens.sum(); idx = rng.choice(dens.size, N, p=dens.ravel(), replace=False)
# jitter ±0.5 px, 2–3 relaxation passes; per dot: x, y (0–1), size 0.8–2.1 px from density, edge flag (near the matte edge)
```
Use the **same N for both photos**, then **sort both dot lists in row order** (`floor(y·60)`, then x) so dot *i* of photo 1
pairs with dot *i* of photo 2 in roughly the same area — the morph then reads as one face turning into another, not noise.
Save `analysis/dots_a.bin`, `dots_b.bin` (Float32); the scene loads them with `fetch(...).arrayBuffer()`.
Draw dots as tiny rects into **3 Path2D buckets by size**, one `fill()` per bucket, so 25k dots stay fast.

**4c. Motion** (white `#fffaf8` dots on near-black `#1c0608 → #040203`, a faint red radial glow behind the head):
- **Fly in** at the section start: from scattered seeded positions, easeOutExpo over 1.1 s, staggered by distance from the face.
- **Breathe with the beat**: on each kick, scale +1.5% about the centre and brighten +20%, decaying with τ 0.25 s; ±0.9 px idle jitter.
- **Drift**: edge dots drift outward and up with seeded speeds and fade; about 120 **red (`#ff2d23`) and white embers** rise and flicker (additive).
- **Morph on the chosen word** (start 0.3 s before it): each dot `k = easeInOutCubic((t − t0 − r·0.45) / 0.55)` with a per-dot
  random `r` (the stagger); position = lerp(A, B, k), then **swirl** it about the portrait centre by `sin(πk)·(1.4 + 1.2·r)` rad
  and push it out by `1 + 0.25·sin(πk)`. Size and edge flag switch at k = 0.5.
- **Flash ring** on the word: a white ring (red glow) expanding from 8% to 83% of the portrait height in 0.6 s (easeOutCubic),
  its width thinning 21 → 3 px, plus a 0.3 s white bloom at the centre.
- **Blow apart** in the last 1.1 s of the section: every dot flies outward from the centre (easeInCubic, staggered, slightly upward), the buckets fade.
- **No artist names on screen** in this section.

## Step 5: Right-side lyrics during the particles

- Split each line into rows of 1–2 words (≤ 11 characters). **Rows alternate**: even rows **Inter 900 white caps**
  (white glow, blur 14), odd rows **Instrument Serif italic red** `#ff3a3a` (red glow `rgba(255,30,30,.85)`, blur 22), 1.3× larger.
  Fit each row to the column width (16:9: x 55–92% of W; 9:16: below the portrait, inside the safe zone), capped at the base size.
- **Pop**: each word appears at its aligned start (−0.05 s) with scale `0.55 + 0.45·easeOutBack(d/0.32)` (overshoot c = 1.9) about its centre and α over 0.08 s.
- **Letters bounce on every beat**: draw letter by letter (prefix-width positions); each letter rises `0.07·px·beatEnv(t − j·0.025)`
  (τ 0.14 s), so the bounce ripples across the word. Start bouncing 0.3 s after the pop.
- **Each block blurs out before the next**: `blur(0 → 16 px)` and α → 0 over 0.35 s (easeInOutCubic), ending 0.2 s before the next line's first word.

## Step 6: Motion graphics in the reference style

Background `#040409` with a violet radial glow (`#1a1424`), about 500 twinkling warm stars, grain.
- **Moon on a starfield**: a cream-gold disc (`#fffaf0 → #f3dfb5 → #d9b77a`) with soft craters and a gold halo, drifting slowly;
  the camera pushes in 6% (easeInOutSine) through the first line.
- **Stacked gold words, changing fast.** Gold serif (default Cormorant Garamond 600 caps tracked 0.06em, alternating with
  italic 500 lowercase, 235 px in 16:9), filled with a vertical gold gradient and a gold glow (blur 30). Let `p = Σ easeInOutCubic((t − s + 0.12)/0.3)`
  over the line's words; word *j* sits at `rel = j − (p − 1)`:
  - `rel > 0` (arriving): below, scale `1 + 0.25·rel`, **blur `22·rel` px**, α `1 − rel`;
  - `rel = 0`: the centre, sharp;
  - `−1 ≤ rel < 0`: rises one row, shrinking to 0.42× by rel −2;
  - `rel < −1.1`: **blurs out** (`14·(−rel − 1.1)` px) and fades by rel −2.6.
  A thin gold rule with a dot underlines the stack. Fit every word to the column width.
- **Curved lyric wall that turns like a cylinder** (the next line): lay its words letter by letter on a helix around a vertical
  cylinder (radius 0.25 W; 9:16 0.36 W), each word starting `width/R + 0.32` rad after the previous and 0.5 em lower.
  Per letter at angle φ (relative to the camera's rotation): `x = cx + R·sinφ`, `y = row + R·0.16·cosφ`, draw with
  `setTransform(cosφ·f, 0, 0, f, x, y)`, `f = 0.8 + 0.25·cosφ`; skip back-facing letters (cosφ < 0.06), fade by cosφ.
  Thin gold rings (one per row) and dots on 24 meridians make the wall read; two **credit bands** (title · artist · album ·
  lyricist in small tracked caps — not lyrics) ring the top and bottom and turn at 85% speed.
  **The camera eases to each sung word**: a keyframe 0.22 s before the word, `min(0.55 s, gap)` long, easeInOutCubic on the
  rotation and the row height. Unsung letters are dim gold `#6d5428` at 28%; the sung word is the gradient with a strong glow.
  Rows far from the current one fade, so the frame never fills with clutter. After the last word, pull back 30% and keep turning slowly.
- **Each lyric appears once.** The stack words leave before the cylinder appears (crossfade 1.1 s with blur, the moon shrinking to a corner);
  never repeat a line's words as decoration — use credits or ornaments instead.

## Step 7: The rain ending (black-and-white player behind wet glass)

- **Player** (offscreen, greys only): a dark radial background; a big **cover card** (22 px radius, deep shadow, the cover in
  `grayscale(1) contrast(1.1)`); "NOW PLAYING" (Inter 700, tracked 0.2em), title, artists; a **progress bar** whose knob moves with the
  song's real time (`clip start + t`) and the times either side; play/prev/next icons; **lyric rows**: the previous line small and dim,
  the current line in Inter 700 at 74 px, each word grey `#5a5a5a` → white with a glow as it is sung (easeInOutCubic 0.3 s).
- **Through glass**: draw the player with `blur(3px)` plus a 5% grey fog and a slow 3.5% push-in. Keep the lyric rows big enough to read through the blur.
- **Water drops** (seeded, ~400 at 1080p; 60% r 3–6 px, 30% 6–12, 10% 12–22; most present at the start, the rest landing during the
  section with a 0.12 s grow). **Each drop is a tiny lens**:
  ```js
  // SB = the player drawn at 1/6 size with blur(3px)
  g.save(); g.translate(x, y); g.beginPath(); g.ellipse(0, 0, r, r*1.1, 0, 0, TAU); g.clip();
  g.save(); g.scale(-1, -1); const span = r*4.5/6;                     // flipped and minified: a lens inverts the scene behind it
  g.drawImage(SB, x/6 − span, y/6 − span, span*2, span*2, −r, −r*1.1, r*2, r*2.2); g.restore();
  // dark rim: radial gradient transparent at 0.55r → rgba(0,0,0,.55) at r; highlight: white ellipse at (−.32r, −.42r);
  // faint caustic: white 18% ellipse at the bottom
  g.restore();
  ```
- **Running drops**: about 7, starting at staggered times, sliding down with stick-slip speed
  `y = y0 + v·(τ − 0.28·sin(5τ)/5)`, wobbling a few px sideways. Each leaves a **trail** that clears the fog (clip a thin wobbling
  strip and draw the *sharp* player there) and a line of small beads; the head drop is elongated (1.25×).
- Force strict black and white at the end (`globalCompositeOperation = "saturation"` with grey), then heavier grain (8%) and the vignette.

## Step 8: Cuts, audio and finishing

- **Between sections**, alternate a **white flash** (ramps up over 0.15 s, holds 2 frames at 92%, fades over 0.33 s) and a **blur
  cut** (the frame blurred up to 28 px and scaled up to 6%, ±0.35 s around the cut, easeInOutSine). Card → particles: flash;
  particles → card: blur (after the blow-apart); card → motion graphics: flash; motion graphics → rain: blur.
- Grain (overlay 4–5%; rain 8%) and a vignette on everything; fade from black over 0.6 s and to black over the last 1.4 s.
- **Audio**: the original mix, 0.5 s fade in, 1.5 s fade out. 1920×1080, 30 fps.

---

## Reel layout (9:16, 1080×1920, when asked)

Render the same scene with `?w=1080&h=1920`; every section reads `PORT = H > W`. **Keep all text inside Instagram's safe zone**:
at least **230 px from the top, 400 px from the bottom (caption) and 150 px from the right (buttons)**.
- **Card**: a taller face (1000×1500, lyrics 76 px), scale 0.88, less yaw (×0.55), centred at 45.5% height.
- **Particles**: the portrait on top (centre 31% height, 50% of the frame tall); the rows below it from 60% height to
  `H − 400`, from x = 7% to `W − 150`.
- **Motion graphics**: the moon at the top (27% height); the stack and the cylinder centred at 55–56% height, shifted left by
  half the right margin; words fitted to `W − 60 − 150 − 40`; cylinder radius 0.36 W, letters 140 px.
- **Rain**: the cover card on top (62% of the width, from y 290), then title, bar (no icons) and the lyric rows from y 1290; the last row must end above y 1520.
- Use `U = min(W, H)` for sizes that should not grow with the long side (drop radii, glows).

## Build: the scene and the renderer

- `analysis/build_data.py` writes `scene/data.js`: `window.DATA = {lines, sections, kicks, beats, downbeats, energy, meta}`
  (`meta`: title, artists, duration, `morph` time, `transitions` list). Times are relative to the clip start.
- `scene/index.html` loads the fonts (`@font-face`), `data.js` and `scene/spot.js`. `window.ready` loads the fonts (check, abort on
  failure), the dot files and images, and runs every layout (card rows, right-side blocks, cylinder letters, player rows).
  `async window.renderFrame(t)` draws one frame.
- `scene/render.mjs` (local HTTP server, `--w/--h`, `--stills t1,t2,… dir`): frames via `canvas.toDataURL("image/jpeg", 0.96)` piped to
  `ffmpeg -f image2pipe -c:v mjpeg -i - -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30`. Usage: `node scene/render.mjs --w 1920 --h 1080 <from> <to> out.mp4`.
- Use **no more parallel render workers than the machine can spare** (on a shared 4-core machine: 1–2). Join chunks with the concat
  demuxer (`-c copy`). To fix a few seconds, re-render whole chunks — never splice onto a trimmed stream copy. Run ffmpeg with `-nostdin` in loops.

## Contact sheet: required before the full render

For each aspect ratio render about 12 stills (`--stills`):
1. the card in the intro; 2. a word lighting up with sparks, glints and the light point; 3. the card scrolled with blurred far lines;
4. the portrait with a red/white row block; 5. the portrait mid-line; 6. **mid-morph** with the flash ring; 7. the blow-apart with the
block blurring out; 8. the card's return; 9. the gold word stack with the moon; 10. the cylinder wall on a sung word; 11. the rain
player with drops; 12. a later rain frame with a running drop and lit lyric. Also show both photo cutouts.
```bash
ffmpeg -i stills/169/s_%02d.png -vf "scale=480:-1,tile=4x3:padding=8:color=0x12020a" stills/contact_169.jpg
ffmpeg -i stills/916/s_%02d.png -vf "scale=270:-1,tile=6x2:padding=8:color=0x12020a" stills/contact_916.jpg
```
**Look at the sheets yourself first** (open them, and crop full-size stills where detail matters): is every lyric readable, does the face
read in the dots, is nothing over the face, is nothing cut off, is the logo undistorted, are the Reel's texts inside the safe zone?
Fix, re-render the stills, then **show the user** with the section table. **Wait for approval.**

## Final render and delivery

```bash
D=<duration>
ffmpeg -i out/v_169.mp4 -i analysis/song.wav -map 0:v -map 1:a -t $D -af "afade=t=in:d=0.5,afade=t=out:st=$(echo "$D-1.5"|bc):d=1.5" \
  -c:v copy -c:a aac -b:a 192k -movflags +faststart out/<slug>_spotparticle_169.mp4         # for a clip of a longer song: -ss <clip start> before -i song.wav
VB=$(python3 -c "print(int(19*8*1024*1024/$D/1000 - 96))")k                                     # WhatsApp: two-pass, 19 MB budget, aac 96k
ffmpeg -y -i out/<slug>_spotparticle_169.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v $VB -pass 1 -passlogfile out/wa169 -an -f null /dev/null
ffmpeg -i out/<slug>_spotparticle_169.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v $VB -pass 2 -passlogfile out/wa169 -c:a aac -b:a 96k -movflags +faststart out/<slug>_spotparticle_169_720p_whatsapp.mp4
```
Same for 9:16 (`scale=720:1280`, its own `-passlogfile`, so parallel jobs don't clobber each other's logs). Verify each WhatsApp file is
**under 20 MB** (`stat`; if not, lower VB 10% and redo). Check every file with `ffprobe`: resolution, 30 fps, frame count
(`-count_packets`), duration, an audio stream. Before writing into `out/`, check for existing files and **ask before overwriting**.

## Final report to the user

- the rap/sung table and the section plan (lines, times, morph word);
- what the reference reel set (fonts, colours, word timing, transitions, fitted eases) — or that defaults were used;
- the paths of all MP4s with size, frames and duration, and the contact-sheet paths;
- any re-aligned or user-confirmed words; what was a placeholder (logo, cover);
- offer tweaks: morph word, section boundaries, dot count, gold font, drop density.
