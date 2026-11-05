---
name: ink-line-lyrics
description: Build a fast lyric video drawn as ONE glowing ink line that never breaks — on every key word the line morphs (about 0.3 s, a redraw wave with a glowing pen nib riding it) into a new one-line drawing that follows the lyric's meaning (a heart, two faces, a question mark, a heartbeat, a moon and stars, an eye with a star, a road, two figures chasing then colliding, a constellation), the camera punches and shakes on every kick, speed streaks fly on chase shots, the background tint shifts by section, and 2–3 word captions slam in with the sung word in gold plus one big keyword per line. Primary format 9:16 Instagram Reel (inside the safe area), plus a 16:9 version with keywords in the side columns. Use when the user runs /ink-line-lyrics or attaches a song MP3 and its lyrics (one sung line per row) and asks for an ink-line / one-line drawing / continuous-line lyric video or reel.
argument-hint: "<song (mp3/clip)> <lyrics, one sung line per row> [\"Title — Artist\"] [no-169]"
---

# Ink Line Lyrics

Make a fast lyric video in which **everything is one glowing ink line that never breaks.**
On every key word the line redraws itself into a new drawing that shows what is being sung,
with a bright pen nib riding the redraw wave. The camera punches on every kick. The main
deliverable is a **1080×1920 Instagram Reel**; a 1920×1080 version comes with it.

Reference feel: "Main Aur Tu" ink-line lyric video. Use it for pace, glow and motion only.
Every frame is drawn by our own code.

## Non-negotiable rules (every run)

1. **Everything is drawn in code.** One HTML `<canvas>` scene is rendered frame by frame in
   headless Chromium (Playwright), and the frames are piped to ffmpeg. No stock footage, no image
   generators, no traced images: every drawing is a polyline written in code. Every visual is a pure
   function of time `t` with seeded PRNGs (mulberry32), so re-renders and parallel chunks are identical.
2. **The line never breaks.** Each drawing is ONE continuous polyline (retracing is allowed, lifting the pen is not),
   and every frame shows exactly one line of N points.
3. **Word timings come only from forced alignment** (torchaudio `MMS_FA` on the demucs vocal stem), using the
   user's lyrics exactly as written. Never guess, eyeball or interpolate timings. If a word aligns badly, re-align that window or ask.
4. **Show a contact sheet of stills before the full render** (both aspect ratios), then wait for the user's go-ahead.
5. **Ask before overwriting** any existing file in the work or output folder (AskUserQuestion).
6. Deliver **9:16 (1080×1920) first**, and 16:9 (1920×1080): a master MP4 of each with the original audio, and a
   720p copy of each **under 20 MB** for WhatsApp (720×1280 / 1280×720). That's 4 files. Skip 16:9 only if the user says so.

## Inputs

| Input | Notes |
|---|---|
| Song | MP3 or anything ffmpeg reads. A clip is fine, and the video then covers only that clip. |
| Lyrics | **One sung line per row**, with every repetition, exactly as sung. The display keeps the user's text (captions are upper-cased Latin; Devanagari stays as written); alignment uses a `uroman` romanized copy. Never write lyrics from memory. If the user has none, offer a Whisper large-v3 transcription and show it for correction first. |
| Title + artist | Optional, for the opening slam (e.g. `Main Aur Tu — Artist`). |

Work folder: `ink-line/<song-slug>/` with `input/ sep/ analysis/ scene/ stills/ out/`. If it exists, **ask** before reusing or overwriting.

## Setup (once per machine)

```bash
pip install demucs librosa soundfile torch torchaudio uroman numpy
npm i playwright           # if Playwright is already installed, do NOT reinstall the browser (never `playwright install`)
```
- `torchaudio` must provide `torchaudio.pipelines.MMS_FA`. Pin `torchaudio==2.8.*` (CPU wheels from
  `https://download.pytorch.org/whl/cpu`) if a newer version has dropped it. Do not switch aligners.
- **Fonts must be local**, in `scene/fonts/` (raw GitHub URLs may be blocked):
  ```bash
  curl -sS -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@300;600" \
    | grep -o 'https://fonts.gstatic.com[^)]*\.ttf'    # curl each one; check with `file` that each is TrueType
  ```
  **Anton** for captions, title and the big keyword; **Inter 300** for the thin spaced artist line.
  For Devanagari captions use **Teko 600** (Latin + Devanagari).
- Playwright installed globally isn't visible to an ESM `import`: load it with `createRequire(import.meta.url)` and fall
  back to `/opt/node22/lib/node_modules/playwright` (or the machine's global `node_modules`).
- **Serve the scene over a local HTTP server** (tiny Node `http` static server inside `render.mjs` on `127.0.0.1`), not `file://`.

---

## Step 1: Listen, align, beats and kicks

**1a. Separate:**
```bash
ffmpeg -i input/<song> -ac 2 -ar 44100 analysis/song.wav
demucs --two-stems=vocals -n htdemucs -o sep analysis/song.wav
```
Transcribe the last 30 s with Whisper to check for a promo / voice-over at the end; end the video before it.

**1b. Force-align every word** with MMS_FA and **star tokens** between lines:
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
Write `analysis/timeline.json`. Flag `score < 0.4` or words longer than 2.5 s and re-align that line in a ±2 s window. Never patch by hand; ask.

**1c. Beat grid and kicks** (`analysis/build_data.py`):
```python
tempo, bt = librosa.beat.beat_track(y=y, sr=sr)          # beats; downbeats = strongest of 4 phases by onset strength
S = np.abs(librosa.stft(librosa.effects.percussive(y), n_fft=2048, hop_length=256))
env = librosa.onset.onset_strength(S=librosa.amplitude_to_db(S[librosa.fft_frequencies(sr=sr, n_fft=2048) < 150].sum(0)[None]), sr=sr, hop_length=256)
pk = librosa.util.peak_pick(env, pre_max=3, post_max=3, pre_avg=8, post_avg=8, delta=np.percentile(env, 80) * .5, wait=int(.25 * sr / 256))
kicks = [librosa.frames_to_time(x, sr=sr, hop_length=256) for x in pk if env[x] > np.percentile(env, 88)]
```
Aim for **~1–2 kicks per second**. The 80th percentile with a 0.2 s wait gave 3 per second on a Bollywood mix — far too busy
for camera punches — so raise the percentile / wait until the count is right.

## Step 2: Plan one drawing per key word

Read the lyrics for meaning, then pick **one key word per line or half line** (10–14 drawings per ~8 lines; never more than one
morph per ~1 s) and one drawing for each. Each drawing must be possible as one continuous line. Library (all in `scene/ink.js`'s `DRAW`):

| drawing | for words like | how the one line goes |
|---|---|---|
| `heart`, `heart2` (arrow through it) | love, pyaar, ishq, dil | parametric 16 sin³ heart; heart2 = feather zigzag → shaft → heart → shaft → arrowhead |
| `faces` | you, tumhein, together | back of head arc → profile (Catmull-Rom: brow, nose, lips, chin) → neck → U → mirrored profile → head arc |
| `question` | sochenge, why, should I | hook arc → stem → a tiny loop as the dot |
| `heartbeat`, `heartbeat2` | beqaraar, restless, dhadkan | flat → ECG spikes → a small heart → flat; v2 = irregular spikes that jitter at 8 Hz |
| `moon` (+ stars) | khwab, raat, chaand, dreams | crescent (outer arc, inner arc back) → swoop → pentagram star → swoop → small star → dot |
| `eyeclosed` | dreaming, hiding, chhupaya | lid arc with lashes out-and-back → swoop up → star → dot |
| `eyestar` | yaad, looking, memories | almond eye (two Béziers) → iris circle → pentagram inside → swoop to a small star |
| `constellation`, `starheart` | khwab, wishes, destiny / ending, forever | vertices joined by straight lines with a tiny loop at each star (starheart: vertices on a heart) |
| `road` | path, waiting, memories, journey | horizon → left edge to the bottom → centre line up and back → right edge up → horizon |
| `chase` | milenge, running, follow | ground → stick figure (out-and-back limbs, head loop) → ground → second figure → ground; figures bob |
| `meet` (collide) | meet, kahin, mil gaye | ground → figure reaching → hands meet → heart above → other figure → ground; burst of rays |
| `wave` / `flat` | intro / outro | a sine wave that follows the music / a short flat line that fades |

Coordinates are unit space (about ±1.3 wide, ±1 tall, y down), built with a tiny `Pen` (`to`, `poly`, `arc`, `bez`, `cr` Catmull-Rom, `heart`,
`star` = 5-point pentagram in one stroke, `dot` = tiny loop). Put the plan in `data.js` as `morphs = [{t: word.start, name, word}]` with
`wave` at t = 0 and `flat` ~1.8 s before the end. **Tell the user the plan** (time · word · drawing) and continue unless they object.

## Step 3: The morph (one polyline, N points, redraw wave, pen nib)

```js
const N = 600, MORPH = 0.34, WAVE = 0.45, LEAD = 0.06;           // morph starts LEAD s before the sung word
function resample(pts, n) { /* cumulative arc length, then n evenly spaced points by linear interpolation */ }
function align(A, B, closed) {                                    // minimise travel: try B and reverse(B);
  for (const c of [B, B.slice().reverse()])                       // closed shapes also try every 10th cyclic start point
    for (let sh = 0; sh < (closed ? N : 1); sh += 10) { /* cost = Σ|A[i] − c[(i+sh)%N]|² ; keep the best */ } }
SHAPES = morphs.map(m => resample(DRAW[m.name]().p, N));
for (k = 1..) SHAPES[k] = align(SHAPES[k-1], SHAPES[k], closed[k]);   // chain the alignment once, at load
// during a morph (u = (t − start)/MORPH in 0..1): the redraw wave sweeps from the line's start to its end
for (i) { const s = i/(N−1)·(1−WAVE), p = easeInOutCubic((u − s)/WAVE); pts[i] = lerp(A[i], B[i], p); }
front = clamp((u − WAVE/2)/(1 − WAVE))·(N−1);                     // the nib sits here, on the morphing line
```
- `A` and `B` are the **live** shapes at time t (each drawing keeps moving: a 10 fps "boil" of ±0.006 units, hearts pulse +6% on kicks,
  the chase figures bob, the restless heartbeat jitters, the intro wave follows the music), so a morph never starts from a frozen frame.
- **Line look** (warm white/gold on dark): glow pass `lineWidth 16`, `rgba(255,190,90,.22)`, `shadowBlur 34` gold; core pass
  `lineWidth 4.6`, `#fff1d6`, `shadowBlur 12`. During a morph, a **hot segment** (the 70 points behind the front) in white, width 7, blur 26.
- **Nib:** a radial gradient dot (white core → `rgba(255,240,200,.9)` → gold → 0, radius 46 px) at the front, with 7 seeded sparks flung off
  per frame. When idle it parks at the line's end and breathes. At the start the line draws on from nothing over 1.6 s with the nib leading;
  at the end it morphs to `flat` and fades.

## Step 4: The rush

- **Camera punch on every kick:** `env = Σ exp(−(t − kick)/0.13)` over the last 3 kicks (cap 1.2); scale `1 + 0.06·env` about the frame
  centre, shake `(±13, ±10) px · env` and rotate `±0.35° · env`, with directions seeded per kick. The background fill stays outside the camera
  (no edges), captions get half the shake. Background brightens 25% with `env`.
- **Speed streaks on chase shots:** while the `chase` drawing is up, ~46 seeded horizontal streaks (120–500 px, 1–3 px, α 0.14–0.44) fly
  right-to-left at 2200–4800 px/s; on the collide (`meet`) a 0.6 s radial burst of rays from the meeting point.
- **Background tint by section**, cut on the downbeat in the gap between sections, 0.8 s crossfade:
  navy `rgb(10,20,52)` → indigo `(28,18,72)` → plum `(48,14,52)` → crimson `(62,8,18)`. Radial: centre `1.9×` the tint, 50% `0.9×`, edges `0.3×`.
- Finish: vignette (`rgba(0,0,0,.75)` corners) and seeded grain (4 tiles, overlay 7%).

## Step 5: Captions and the keyword

- **Chunks of 2–3 words** per line, split at natural phrase breaks (store them per line as word-index lists; for 8 words `2/2/2/2`,
  not `3/3/2` across a comma). A chunk is on screen from its first word until the next chunk starts (or ≤ 1.2 s after the line).
- **Each word slams in on its aligned start:** scale 1.7 → 1 with `easeOutBack` over 0.13 s, α in 0.05 s. Words not yet sung are not
  shown; x positions come from the full chunk so nothing shifts. **The word being sung is gold** `#ffc94a` with a gold glow; sung words white.
  Anton caps, ~100 px in 9:16, ~84 px in 16:9, fit to the safe width.
- **One big keyword per line** (usually the morph word): Anton caps with 6 px tracking, gold outline (3 px) over a 38% gold fill with a glow;
  pops in `scale 0.4 → 1` (easeOutBack, 0.24 s), holds ~0.9 s, then grows 8%, blurs and fades over 0.9 s.
- **Opening:** title words slam in on the first kicks (last word gold); the artist in thin spaced Inter 300 caps at ~3.9 s; all fade out
  before the first sung word.

---

## Reel layout (9:16, 1080×1920) — the primary format

- Render with `?w=1080&h=1920` (`PORT = H > W`). **Instagram safe zone:** keep all text ≥ 230 px from the top, ≥ 400 px from the bottom
  and ≥ 150 px from the right. So the text column is x = 70…930, centred at x ≈ 500.
- The drawing is centred at (540, 880) with 1 unit = 430 px (it may run to the edges — it isn't text).
- The keyword sits at the top, baseline y ≈ 400 (cap top ≥ 230), fitted to the safe width.
- Captions are at baseline y ≈ 1450 (above the 1520 line), centred on the safe column.
- Check in every still: no text in the top 230, bottom 400 or right 150 px.

## 16:9 layout

- The drawing centred at (W/2, 0.45 H) with 1 unit = 320 px (so it spans ~±420 px).
- The keyword goes in a **side column**, alternating left / right per line, centred at x = 0.13 W / 0.87 W, fitted to 0.19 W, so it never
  touches the drawing.
- Captions at the bottom centre (baseline 0.885 H).

## Build: the scene and the renderer

- `scene/index.html` loads the fonts, `data.js` (`window.DATA = {lines (words, chunks, key), beats, downbeats, kicks, morphs, tints, meta}`)
  and `ink.js`. `window.ready` loads the fonts and **asserts `document.fonts.check`**, then builds and aligns the shapes and lays out the
  captions (measurement only after the fonts load). `async window.renderFrame(t)` draws one frame.
- `scene/render.mjs` (local static server + Playwright): `node scene/render.mjs --w 1080 --h 1920 <fromFrame> <toFrame> out.mp4` pipes
  `canvas.toDataURL("image/jpeg", 0.96)` into `ffmpeg -f image2pipe -c:v mjpeg -i - -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30`;
  `--stills t1,t2,… dir` writes PNG stills.
- Render 2 chunks per aspect ratio with **at most 2 node workers at once** (shared machine), join with the concat demuxer (`-c copy`).
  To fix seconds, re-render whole chunks; never splice onto a trimmed stream copy. Use `ffmpeg -nostdin` in bash loops.

## Contact sheet: required before the full render

For **each aspect ratio**, render ~12–16 stills: the intro wave with the title; each drawing settled (heart, faces, question, heartbeat,
moon, eye, constellation, road, chase with streaks, meet with burst, starheart); **one mid-morph frame showing the nib on the wave**;
a kick punch; a keyword pop; a section tint change.
```bash
ffmpeg -i stills/916/s_%02d.png -vf "scale=270:-1,tile=8x2:padding=6:color=0x05050a" stills/contact_916.jpg
ffmpeg -i stills/169/s_%02d.png -vf "scale=480:-1,tile=4x4:padding=6:color=0x05050a" stills/contact_169.jpg
```
**Look at them yourself**: does each drawing read at a glance, is it clearly one line, is caption text readable, is nothing cut off,
are the Reel safe zones clear, do 16:9 keywords stay off the drawing? Fix, then show the user with the plan table and **wait for approval**.

## Final render and delivery

```bash
D=<duration>
ffmpeg -i out/v_916.mp4 -i analysis/song.wav -map 0:v -map 1:a -t $D \
  -af "afade=t=in:d=0.5,afade=t=out:st=$(echo "$D-1.5"|bc):d=1.5" -c:v copy -c:a aac -b:a 192k -movflags +faststart out/<slug>_inkline_916.mp4
VB=$(python3 -c "print(int(18.6*8*1000*1000/$D/1000 - 96))")k      # WhatsApp: two-pass, 18.6 MB budget (decimal; x264 can overshoot ~1%), 96k audio
ffmpeg -y -i out/<slug>_inkline_916.mp4 -vf scale=720:1280 -c:v libx264 -preset slow -b:v $VB -pass 1 -passlogfile wa916 -an -f null /dev/null
ffmpeg -i out/<slug>_inkline_916.mp4 -vf scale=720:1280 -c:v libx264 -preset slow -b:v $VB -pass 2 -passlogfile wa916 -c:a aac -b:a 96k -movflags +faststart out/<slug>_inkline_916_720p_whatsapp.mp4
```
Same for 16:9 with `scale=1280:720` and its own `-passlogfile`. Verify each WhatsApp copy is < 20 MB (`stat`; else lower `VB` by 10%).
Check all 4 files with `ffprobe`: resolution, 30 fps, frame count (`-count_packets`), duration and an audio stream.
Before writing into `out/`, check for existing files and **ask before overwriting**.

## Final report to the user

- the drawing plan (time · word · drawing) and the section tints;
- the 4 file paths with sizes, frame counts and durations (9:16 first);
- the contact sheet paths;
- any re-aligned or user-confirmed words;
- offer tweaks: a different drawing for a word, morph speed, punch strength, caption size, tint per section.
