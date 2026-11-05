---
name: breakup-chat-lyrics
description: Build a 16:9 heartbreak lyric video — during the instrumental intro a tilted dark-red frosted-glass music card plays out a phone-style breakup chat (your red bubble bounces in, "Read", typing dots, her grey reply), then the same card becomes a karaoke lyrics card over a wall of giant red words, cracks and shatters into glass shards with a red bloom, opens on full-screen clips with lyrics in the empty sky (small caps, big Inter caps, one pink script word that writes itself on), burns the song title in fire inside giant cut-out letters that grow to fill the screen, and ends in pink neon with rain, a wet mirror floor, a falling star and the title in neon script. Also renders a 9:16 Reel. Use when the user runs /breakup-chat-lyrics or attaches a song, its lyrics, the cover art, 3-6 clips or photos and 2-4 chat lines and asks for a breakup / chat / heartbreak lyric video.
argument-hint: "<song mp3 (or 40-60 s cut)> <lyrics> <cover art> <3-6 clips/photos + mood> <2-4 chat lines> [\"Title — Artist\"] [band/composer line] [reel]"
---

# Breakup Chat Lyrics

Make a 1920×1080, 30 fps heartbreak lyric video that tells the story twice: first as a
**text conversation** on a red glass music card while the intro plays, then through the song.
The look runs **red glass → natural-colour clips → fire → pink neon**, and every word lands
exactly on the voice.

Reference feel: breakup chat lyric videos such as "Choo Lo" (The Local Train). Use it for mood,
pacing and type only. Every frame is drawn by our own code.

## Non-negotiable rules (every run)

1. **Everything is drawn in code.** One HTML `<canvas>` scene is rendered frame by frame in headless
   Chromium (Playwright) and piped to ffmpeg. The only outside pixels are the user's clips/photos and
   cover art. No stock footage, no image generators. Fire, rain, stars, shards, the chat UI and the
   neon are all procedural. Every visual is a pure function of `t` with seeded PRNGs (mulberry32), so
   chunks rendered in parallel are identical.
2. **Word timings come only from forced alignment** (torchaudio `MMS_FA` on the demucs vocal stem),
   with the lyrics **exactly as the user wrote them**. Never guess, eyeball or interpolate a time.
3. **Show a contact sheet of stills before the full render** (each aspect ratio), then wait for the go-ahead.
4. **Ask before overwriting** any existing file in the work or output folder (AskUserQuestion).
5. Deliver the 1920×1080 master MP4 with the original audio, plus a 1280×720 copy **under 20 MB** for
   WhatsApp. If a Reel is asked for, also 1080×1920 + a 720×1280 WhatsApp copy (see "Reel layout").
6. **Chat lines are generic and anonymous.** No real names, numbers or profile photos in the chat.
   If the user's lines contain a name, ask to replace it with "you"/"her"/an initial.
7. **Use each clip moment once.** A clip may be split into non-overlapping ranges for two parts; never loop or repeat a moment.

## Inputs

| Input | Notes |
|---|---|
| Song | Anything ffmpeg reads; a 40–60 s cut is fine (the video covers only that cut). |
| Lyrics | Exactly as sung, every repetition. Display keeps the user's text; alignment uses a `uroman` romanized copy. Never write lyrics from memory; offer a Whisper large-v3 draft for the user to correct if they have none. |
| Cover art | Square image for the card. Without one, draw a stand-in in code (gradient, moon, two small silhouettes, script title) and say so. |
| 3–6 clips or photos | With the mood for each (e.g. "lonely road", "two people on a hill"). The user's own or licensed. Photos are animated (Step 5). |
| 2–4 chat lines | Your message(s) and her reply, e.g. me: "can we talk?" → her: "not tonight…". The reply is the last line. |
| Title, artist, band line | Card header and the fire title (e.g. "KUMAR SANU · NADEEM–SHRAVAN" above the title). |

Work folder: `breakup-chat/<song-slug>/` with `input/ sep/ analysis/ clips/ scene/ stills/ out/`. If it exists, **ask** before reusing it.

## Setup (once per machine)

```bash
pip install demucs librosa soundfile torch torchaudio uroman numpy
npm i playwright        # if Playwright is already installed (globally), do NOT reinstall it or run `playwright install`
```
- `torchaudio` must provide `torchaudio.pipelines.MMS_FA` (pin `torchaudio==2.8.*`, CPU wheels, if a newer one dropped it).
- **Fonts are local** in `scene/fonts/`. Get the TTF URLs from the Google Fonts CSS API (raw GitHub URLs are blocked):
  ```bash
  curl -sS -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Inter:wght@500;800;900&family=Great+Vibes" \
    | grep -o 'https://fonts.gstatic.com[^)]*\.ttf'      # curl each; `file` must say TrueType
  ```
  Inter 500 (chat, small tracked caps), 800 (card lyrics, big caps, neon words), 900 (word wall, fire letters); Great Vibes (pink script, neon title).
  For Devanagari lyrics add "Tiro Devanagari Hindi" or "Hind" (and "Kalam" for a handwritten script word).
- Playwright installed globally is invisible to an ESM `import`: load it with `createRequire(import.meta.url)` and fall back to
  `require("/opt/node22/lib/node_modules/playwright")`.
- Serve the scene from a tiny Node `http` server on 127.0.0.1 inside `render.mjs` (not `file://`: clip frames would taint the canvas and `toDataURL` throws).

---

## Step 1: Listen, align, find the intro, split into parts

**1a. Separate:** `ffmpeg -i input/<song> -ac 2 -ar 44100 analysis/song.wav`, then
`demucs --two-stems=vocals -n htdemucs -o sep analysis/song.wav`. Transcribe the last 30 s with Whisper to catch a promo/voice-over at the end; end the video before it.

**1b. Force-align every word** (MMS_FA **with star tokens** between lines, in 30 s windows with 2 s context — the full song at once runs out of memory):
```python
import re, torch, torchaudio, uroman as ur
from torchaudio.pipelines import MMS_FA as bundle
U = ur.Uroman(); norm = lambda w: re.sub(r"[^a-z']", "", U.romanize_string(w).lower())
SR, HOP = bundle.sample_rate, 320
wav, sr = torchaudio.load("sep/htdemucs/song/vocals.wav"); wav = torchaudio.functional.resample(wav.mean(0, keepdim=True), sr, SR); n = wav.size(1)
model = bundle.get_model(with_star=True).eval(); WIN, CTX, chunks = 30 * SR, 2 * SR, []
for s in range(0, n, WIN):
    a, b = max(0, s - CTX), min(n, s + WIN + CTX)
    with torch.inference_mode(): e, _ = model(wav[:, a:b])
    off, keep = (s - a) // HOP, min(WIN, n - s) // HOP; chunks.append(e[0, off:off + keep])
emission = torch.cat(chunks)
flat = ["*"] + [x for L in lines for x in [w["norm"] for w in L["words"]] + ["*"]]
spans = bundle.get_aligner()(emission, bundle.get_tokenizer()(flat))      # skip "*" spans when reading
ratio = n / emission.size(0) / SR     # start = span[0].start*ratio, end = span[-1].end*ratio, score = mean(span.score)
```
Write `analysis/timeline.json` (`lines[i].words[j].{display,start,end,score}`). Flag `score < 0.4` or words longer than 2.5 s
(a held word swallowing a hum): re-align that line alone in a ±2 s window with stars on both sides. Still bad → show the user and ask.

**1c. Beats, kicks and the intro length** (librosa):
- `librosa.beat.beat_track` → `beats`; `downbeats` = the strongest of the 4 beat phases by onset strength; `energy` = RMS at 10 Hz.
- Kicks: low band (< 150 Hz) of the percussive STFT → `onset_strength` → `librosa.util.peak_pick` (≥ 0.2 s apart, above the 80th percentile). They pulse the grain, the fire brightness and the neon hum.
- **Instrumental intro = time of the first aligned word.** The chat must fit inside it (it needs ≥ 6 s; with less, use 2 lines and no typing dots, or start the video earlier in the song).

**1d. Split into five parts.** Cut only in a **line gap on a downbeat** (the downbeat in `[prev.end+0.15, next.start−0.3]` nearest the middle; fallback a beat):

| Part | Lines | Notes |
|---|---|---|
| Chat intro | – | 0 → first word |
| Glass card | first 1–2 lines | ends with crack + shatter in the next gap |
| Clips | one line per clip | one clip (or photo) per line, never reused |
| Fire title | an instrumental break, or overlaid on one line | needs ≥ 2 s free after the line for the letters to grow |
| Pink neon | last 2 lines | then the title in neon script, fade out |

Tell the user the table (lines, times, which clip on which line and why its mood fits), then continue.
Sample (72 s clip, 30 fps): chat 0–8.72 · card lines 0–1 → shatter 23.34 · clip2 line 2 → clip1 line 3 (30.98) → clip3 line 4 (38.62)
· fire title over line 5 (46.26), letters grow in the 52.3–53.9 gap · neon lines 6–7 (53.87) on the tail of clip1 · title 69.5 · fade 70.5–72.

**1e. Clip ranges.** Give each part that shows a clip a source range; pad ±0.3 s for transitions. `speed = clamp(source / duration, 0.4, 1)`;
below 0.7 use motion-interpolated slow motion. If one clip must serve two parts (e.g. clips + neon), split it into two
**non-overlapping** ranges and assert that in code. Extract numbered frames per segment so film frame *f* is `%05d` = *f*+1:
```bash
ffmpeg -nostdin -ss SRC_IN -t SRC_DUR -i clip.mp4 -vf "setpts=PTS/SPEED,minterpolate=fps=30:mi_mode=mci,fps=30,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080" \
  -frames:v NFRAMES -q:v 3 clips/169/<seg>/%05d.jpg          # drop minterpolate when SPEED >= 0.7
```
Write the real frame counts to `scene/counts.js` and clamp the frame index (slowed sources come up 1–2 frames short).
`minterpolate` is slow (≈ 15 min for 4 segments × 2 aspect ratios on a busy 4-core box): run it in the background.

## Step 2: The chat intro on the glass card

The card (Step 3 face, about 1000×1250 design px) is already up; its body shows a phone chat:
- Centre timestamp "Today 11:47 PM" (Inter 500 26 px, 45% white).
- **Your bubble**, right-aligned: red gradient `#f2333f → #c3101f`, radius 34, a small tail, white Inter 500 46 px, padding 36, height 94.
  It **bounces in**: scale 0.35 → 1 with `easeOutBack(k, 2.2)` over 0.4 s about its tail corner, α in the first third.
- **"Read 11:48 PM"** under your last bubble (Inter 500 26 px, 55% white), fading in over 0.25 s.
- **Typing dots** in a grey bubble (`rgba(255,255,255,0.16)`, left): three 10 px dots bouncing in turn
  (`y = −8·max(0, sin(2π·1.5t − 0.9i))`), popping in with easeOutBack and out just before the reply.
- **Her reply**, left-aligned grey bubble (`rgba(255,255,255,0.18)`), **slides in** 110 px from the left (easeOutCubic 0.36 s).
- A phone input bar at the bottom ("Message" placeholder, red send circle with an arrow) so the card reads as a phone.
- **Timing, snapped to beats:** card in on the first downbeat (rise 80 px + fade, 1.1 s); messages on beats about 1.4 s apart;
  "Read" one beat later; typing for ~2.5 s; **her reply lands a beat (≈1–1.2 s) before the first sung word** so it can be read;
  then the chat **blurs away** (blur 0→18 px, α→0 over 0.45 s) and the lyrics fade in from blur 14 px as the first word arrives.

## Step 3: The glass card becomes the lyrics screen

- **Wall behind:** the clip's lyric words in giant Inter 900 caps (210 px in 16:9, 240 px in 9:16), rows alternating
  `#3f060a`/`#2e0407` on `#0d0102`, rotated −7°, rows drifting sideways in alternate directions (16 px/s) and the whole wall
  scrolling up 14 px/s (row index = `r + floor(scroll/lineH)` so rows never pop). Dark radial falloff at the edges.
- **Frosted glass face** (offscreen canvas, **opaque**, so mesh seams never show): the wall blurred (draw it into a 1/6-size canvas
  with `blur(3px)`, then stretch the part behind the card's screen box over the face), a red tint gradient
  `rgba(96,10,18,.74) → rgba(34,3,8,.86)`, a top sheen, a 2.5 px `rgba(255,110,110,.42)` rim, 46 px corner radius.
- **Header:** cover art 170 px (radius 18), title Inter 800 46 px, artist Inter 500 31 px at 62% white, a "•••" icon, a hairline divider.
- **Lyrics** (Apple-Music style): Inter 800 62 px, line height 76, wrapped to the face width. The current line's first row sits at a fixed
  anchor; lines scroll up with easeInOutCubic over 0.45 s starting 0.45 s before each line. Unsung words are white at 30%;
  **each word goes dim → bright** over 0.15 s around its aligned start (white + soft glow `rgba(255,210,210,.8)` blur 18). Past lines 42%,
  blur 1.2 px. **The next line waits blurred below** (blur 4 px, +2.5 px per further line, max 9).
- **Shine sweep on each line change:** a 340 px soft band (`rgba(255,215,215,.13)` at its centre, `lighter`), rotated 20°, crossing the face in 0.85 s.
- **3D tilt:** canvas 2D has no perspective, so texture-map the face through an 8×8 grid of triangles (each an affine transform + clip,
  expanded 0.6 px to hide seams). Pose `rx = 7° + 2° sin 0.3t`, `ry = −13° + 3° sin 0.21t`, `rz = −2.5°`, focal = 1.6·max(W,H),
  scale = 0.88·H/faceH (16:9). A blurred dark shadow quad sits under the card.
```js
function makeProj({rx, ry, rz, scl, cx, cy, f}) {           // face px (u,v) + depth w (w<0 = toward camera) → screen
  return (u, v, w = 0) => { let x = (u - FW/2)*scl, y = (v - FH/2)*scl, z = w*scl;
    [y, z] = [y*Math.cos(rx) - z*Math.sin(rx), y*Math.sin(rx) + z*Math.cos(rx)];
    [x, z] = [x*Math.cos(ry) + z*Math.sin(ry), -x*Math.sin(ry) + z*Math.cos(ry)];
    [x, y] = [x*Math.cos(rz) - y*Math.sin(rz), x*Math.sin(rz) + y*Math.cos(rz)];
    return [cx + f*x/(z + f), cy + f*y/(z + f), z + f]; }; }
```

## Step 4: Crack, then shatter into shards toward the camera

- **One geometry for both:** pick an impact point on the face (≈ 60%, 56%). Build 12 jittered radial rays × rings at radii
  `[0, 85, 200, 345, 530, 770, 1060, 1500]` (±12% radius, ±0.11 rad jitter per vertex). The ring/ray grid cells, split into
  triangles, are the **shards**; their edges are the **cracks**, so the glass breaks exactly where it cracked.
- **Crack** in the gap after the card's last line, in two hits on beats: radius 0→360 px (easeOutExpo, 0.22 s) at the first,
  then →1500 px at the midpoint to the shatter. Ray segments grow outward; ring segments appear once the crack has passed them.
  Draw them **on the face texture** (so they tilt with the card): a red under-stroke (5 px, `rgba(255,90,90,.55)`, blur 10) and a
  thin light line (1.8 px, `rgba(255,245,245,.92)`). A small white glow at the impact and a 0.25 s card jolt (±9 px) on each hit.
- **Shatter on the downbeat** (≈1.15 s): freeze the face at the cut. Per shard (seeded): in-plane push away from the impact
  `(90 + 420r)·easeOutCubic(p)`, depth toward the camera `−D·(0.18 + 0.72r)·p^1.45` (D = camera distance in face px), and
  3-axis tumble up to ±2.5 rad. Start outer shards slightly later. Project each vertex, draw the triangle with `drawTri` from the frozen
  face, stroke its edge `rgba(255,220,220,.55)`, fade it over the last 45%, cull it when it reaches the camera. Sort far to near.
- **Behind the shards:** the first clip, brightening from 45% over 0.6 s; a **red bloom** (additive radial `rgba(255,70,80,.62)` →
  `rgba(220,20,40,.36)` → 0, radius growing to 1.4·max(W,H)) from the impact, and a 4-frame red screen flash.

## Step 5: Full-screen clips with lyrics in the empty space

- **Natural colour**, full frame (`saturate(1.06) contrast(1.04)`, no blur), **slow push-in** 1.0 → 1.075 (easeInOutSine) about the subject.
- **Lyrics never cover a face.** For every clip pick an empty region per aspect ratio, after looking at its frames: sky above a person
  (top-left / top-centre), or the ground below a horizon (lower-left). Store it as `{x, y, w, align, focus}` fractions.
- Each line is 3 rows, all **word by word on the voice**:
  - `S` small tracked caps: Inter 500, 28 px (16:9) / 34 px (9:16), letter-spacing 0.36em, 92% white, fade + 10 px rise over 0.28 s.
    **Wrap it into two rows if it is wider than the region** (it is not scaled).
  - `B` one big Inter 800 caps row, fitted to the region width (max 112 / 118 px), blur 12→0 + fade over 0.26 s, soft text shadow.
  - `V` **one word in pink Great Vibes** (`#ff7eb6`, glow `rgba(255,45,135,.9)` blur 26) fitted to the region (max 170 / 190 px) that
    **writes itself on**: render it to an offscreen canvas and `destination-in` a left→right gradient whose 70 px soft edge travels
    across the word over `clamp(word duration, 0.55, 1.3)` s.
  - Choose rows by meaning: the emotional word is `V` (e.g. "beqaraar", "yaadon"), the rest in sung order.
- A faint dark radial pool (`rgba(2,4,14,.38)`) behind the text block; rows fade/blur out in the last 0.45 s of the part.
- **The frame comes alive:** seeded twinkling stars in the sky (`sin^6` twinkle with a 4-point glint) and one **shooting star**
  (head glow + 28% tail, easeOutCubic, ~1 s) per sky clip. **Still photos** get the same plus a slow push-in and drifting clouds or
  light leaks (large soft additive gradients sliding 10–20 px/s), so nothing is ever frozen.

## Step 6: The fire title inside giant cut-out letters

- On black: the band/composer line in small tracked caps above (Inter 500 24 px, 0.5em), the **song title in giant Inter 900 caps**
  (16:9: 2 rows, 9:16: 3 rows, each row fitted to 86% of the width so the block is justified), and — when it is overlaid on a sung line —
  that line in small Inter 800 tracked caps under it, each word going dim → white on its time.
- **Procedural fire** (low-res field, upscaled): a 256×144 (16:9) / 144×256 (9:16) canvas, per pixel
  ```js
  const q = fbm(u*1.7, v*1.5 + t*0.55, 3), n = fbm(u*4.2 + q*2.2, v*2.4 + t*2.3, 5), m = fbm(u*9 + 3.1, v*6 + t*4.2, 3);
  let heat = 0.42 + (n - 0.47)*2.5 + (m - 0.5)*0.8 + (v - 0.5)*0.45; heat = 0.3 + 0.7*clamp(heat);   // floor: no dead-black letters
  // palette: black → #280200 → #8c0e02 → #e23a04 → #ff8412 → #ffcc5c → #fff8de
  ```
  value-noise fbm (seeded permutation), sampled at `v + t·speed` so flames rise; upscale with smoothing + `blur(1px)`; brighten +25% on kicks.
- **Cut-out:** draw the fire into an offscreen canvas, draw **all** letters into a separate mask canvas, then **one**
  `destination-in` with the mask. (A `destination-in` per word erases the words drawn before it.) Add a burning rim: the letters
  filled `rgba(255,90,10,.5)` with an orange shadow blur 34 under the fire. Rows punch in on beats (scale 1.12 → 1).
- **Embers** everywhere: ~140 additive orange dots rising 35–105 px/s with a sideways sway and flicker.
- **Grow:** after the sung line ends, scale the whole cut-out about a point **inside** a letter (sample the glyph mask for an opaque pixel
  near the middle letter of the biggest row) from 1 to 48 with easeInExpo until the fire fills the screen; the small texts fade first.
  Cut to the neon part with a white flash on the downbeat.

## Step 7: The pink neon ending

- **Pink duotone clip** above a **wet floor** (floor line at 75% H in 16:9, 66.5% in 9:16): draw the clip with its bottom on the floor line,
  `grayscale(1) contrast(1.3) brightness(1.25)`, then `multiply` with `#ff4fa6` and `lighten` with `#1e0416` (duotone), then darker toward the
  floor (`rgba(10,0,6,0 → .78)`). A slow push-in 1.0 → 1.06.
- **Floor:** `#1c0414 → #040002`, a thin pink horizon glow, and a **mirror**: the clip area just above the floor drawn flipped in 3 px strips,
  each offset by `sin(y·0.08 + 5.5t)·(1.5 + 7k) + sin(y·0.023 − 2.1t)·3k` px, α 0.42·(1−k)².
- **Neon words:** Inter 800 caps, core `#ffe0f0`, glows `rgba(255,60,170,.95)` blur 16 and `rgba(255,40,150,.8)` blur 48. Split each line
  into phrases of ≤ 24 characters (≤ 13 in 9:16), each fitted to the width (max 128 / 112 px). Each word **drops in** from 150 px above
  (starts 0.3 s before its time, `easeOutBack(k, 1.4)`), dim like an unlit tube; when it lands it **flickers on** (4 seeded toggles in 0.2 s,
  then a ±7% 52 Hz hum) and makes a **splash**: three pink ellipse rings (ry = 0.17 rx) growing to 0.62×word width over 0.8 s plus 9 droplets
  on parabolas. The whole word layer is mirrored in the floor (α 0.5). A phrase flickers off 0.6 s before the next one drops.
- **Light rain** (two layers of thin pink-white streaks, 950 and 1500 px/s) and seeded ripples on the floor.
- **One falling star** near the end (a 1.4 s streak across the sky, pink-white).
- **Title in neon script** after the last word: Great Vibes, fitted to 80% of the width (Reel: inside the safe zone), flickering on, mirrored in the floor.
  Hold, then fade to black with the audio.

## Step 8: Transitions, grade, audio

- Between parts on the downbeat: **white flash** (screen `#fff6fa` 85%, 0.12 s in, 0.32 s out) or **red burn** (three moving additive
  radial gradients in red/orange, ±0.35 s) over a 0.2 s crossfade. Sample order: shatter → flash → burn → burn (into fire) → flash (into neon).
- **Grain** on everything (four 256 px noise tiles, `overlay` 5%, +1.5% on kicks) and a **soft vignette** (to 55% black at the corners). Fade in 0.5 s from black.
- **Audio:** the original song with a 0.5 s fade in and 1.5 s fade out. No re-mix.

---

## Reel layout (9:16, 1080×1920, when asked)

Render the same scene with `?w=1080&h=1920`; every part reads `PORT = H > W`. **Instagram safe zone:** text ≥ 230 px from the top,
≥ 400 px from the bottom (caption), ≥ 150 px from the right (buttons).
- **Card larger:** scale 0.84·W / faceW (≈ 907 px wide vs ≈ 726 px in 16:9), centred 24 px left of centre and at 47% H, yaw −6° instead of −13°.
  Check that the lyric rows end left of x = 930 and between y = 230 and 1520 including the tilt.
- **Clips:** extract frames per aspect ratio: crop a 608×1080 window around the subject (focus x per clip), scale to 1080×1920. Text regions
  move into the sky above the people (top, from y ≈ 250) or between a moon and a horizon; small tracked rows wrap.
- **Fire title:** three rows (SOCHENGE / TUMHE / PYAR) fitted to 84% of the width; the sung line wraps to two rows.
- **Neon:** floor at 66.5% H so the words, the floor and its splashes sit **above the 400 px bottom zone**; phrases ≤ 13 characters,
  centred inside the safe width; the neon title fitted to the safe width.

## Build: the scene and the renderer

- `analysis/build_data.py` → `scene/data.js`: `window.DATA = {lines, sections, segs, beats, down, kicks, transitions, meta}`, where
  `meta` holds the chat schedule, the crack window, the clip-row specs (`[["S",0,1],["V",2],["B",3,4,5]]` word indices), the title rows,
  and options (`fill: "fade"`, `scriptColor`, `fallingStar`, `endTitle`, `fadeOut`). `analysis/prep_clips.sh` → frames + `scene/counts.js`.
- `scene/index.html` loads the fonts (@font-face), `data.js`, `counts.js`, `lyric.js`. `window.ready` awaits `document.fonts.load` and
  asserts `document.fonts.check` for every face, **then** lays out everything that measures text (card rows, clip rows, fire rows, neon phrases).
- `async window.renderFrame(t)` awaits the needed clip frames (`img.decode()`, small LRU), draws the part (two parts into buffers during a
  transition), the shatter overlay, vignette, grain and fades.
- `node scene/render.mjs --w 1920 --h 1080 <from> <to> out.mp4` pipes `canvas.toDataURL("image/jpeg", .96)` frames to
  `ffmpeg -f image2pipe -c:v mjpeg -i - -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30`; `--stills t1,t2,… dir` writes PNGs.
- **At most 2 node render workers at once** (shared 4-core machine); run long renders in the background. Join chunks with the concat
  demuxer (`-c copy`); to fix seconds re-render whole chunks. In bash loops call ffmpeg with `-nostdin`.

- **Testing while frames are still extracting:** `prep_clips.sh` writes `counts.js` as it goes, so the page fails to parse until it ends.
  Point a throwaway `scene/test.html` at a hand-written `counts_test.js` for the aspect ratio that is ready and render stills with
  `render.mjs --page test.html` (delete both afterwards). Never edit a scene file while a render of it is still starting up.
- The WhatsApp budget is 18.6 decimal MB (`18.6*8*1000*1000` bits), so the copy stays under 20,000,000 bytes even when x264 overshoots by ~1%.

## Contact sheet: required before the full render

For each aspect ratio render 12 stills **into an empty folder** (old `s_13.png`… files break `tile`):
chat with your bubbles · her reply landing · karaoke card with a lit word and blurred next line · the cracked card · mid-shatter with the bloom ·
clip 1 with script writing on · clip 2 · clip 3 · fire title · letters growing · neon word landing with its splash · neon title.
```bash
ffmpeg -i stills/169/s_%02d.png -vf "scale=480:-1,tile=4x3:padding=8:color=0x0d0102" stills/contact_169.jpg
ffmpeg -i stills/916/s_%02d.png -vf "scale=300:-1,tile=6x2:padding=8:color=0x0d0102" stills/contact_916.jpg
```
Look at them yourself: is every word readable, is no text over a face, is nothing cut off, is 9:16 text inside the safe zone, do the
letters burn (no dead-black letters), is no clip moment reused? Fix, re-check, then show the user with the part table and **wait for approval**.

## Final render and delivery

```bash
# per aspect ratio, after joining the chunks into out/v_<ar>.mp4 (D = duration, START = clip start in the song)
ffmpeg -i out/v_169.mp4 -ss $START -t $D -i analysis/song.wav -map 0:v -map 1:a -t $D \
  -af "afade=t=in:d=0.5,afade=t=out:st=$(echo "$D-1.5"|bc):d=1.5" -c:v copy -c:a aac -b:a 192k -movflags +faststart out/<slug>_breakup_169.mp4
VB=$(python3 -c "print(int(18.6*8*1000*1000/$D/1000 - 96))")k        # WhatsApp: two-pass, 18.6 MB budget (decimal; x264 can overshoot ~1%), aac 96k
ffmpeg -y -i out/<slug>_breakup_169.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v $VB -pass 1 -passlogfile wa169 -an -f null /dev/null
ffmpeg -i out/<slug>_breakup_169.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v $VB -pass 2 -passlogfile wa169 -c:a aac -b:a 96k -movflags +faststart out/<slug>_breakup_169_720p_whatsapp.mp4
```
(9:16: `scale=720:1280`, its own `-passlogfile`.) Verify with ffprobe: resolution, 30 fps, frame count (`-count_packets`), duration, an audio
stream; each WhatsApp copy < 20 MB (else lower VB 10%). Delete the extracted clip-frame folders afterwards. Ask before overwriting `out/`.

## Final report to the user

- the part table (lines → part → clip range and speed), and the chat lines used;
- the output paths with size, frame count and duration; the contact sheet paths;
- any re-aligned or user-confirmed words; anything drawn as a stand-in (cover art, fire);
- offer tweaks: chat wording/timing, which word is the script word, text regions, fire title rows, neon phrase splits.
