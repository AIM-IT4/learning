---
name: glass-to-neon-lyrics
description: Build a 16:9 emotional lyric video whose mood changes with the song — a tilted dark-red frosted-glass lyrics card like the Apple Music lyrics screen (each word fills left to right as it is sung, next line blurred below, a shine on each line change) over a wall of giant red words, which cracks and shatters into glass shards with a red bloom; then full-screen clips with lyrics in the empty space (small caps, big Inter caps, one red script word writing itself on); then a key line cut out of black as giant letters with fire burning inside that grow until the next clip fills the screen; and a pink neon ending (duotone clips, neon words dropping onto a wet mirror floor with a splash, rain, drops on the glass, hold and fade on the last word). Also renders a 9:16 Reel. Use when the user runs /glass-to-neon-lyrics or attaches a song, its lyrics, the cover art and 4-6 clips or photos with a mood each and asks for a glass / neon / Apple-Music-style lyric video.
argument-hint: "<song mp3 (or clip)> <lyrics> <cover art> <4-6 clips/photos, each with its mood> [key line] [\"Title — Artist × Artist\"] [reel]"
---

# Glass to Neon Lyrics

Make a 1920×1080, 30 fps lyric video in **three moods that follow the song**: a cold red glass
lyrics card for the opening, warm full-screen clips for the verse, fire for the key line, and a
pink neon night for the ending. Every word lands exactly on the voice.

Reference feel: lyric videos such as "Arz Kiya Hai" (Anuv Jain × Lost Stories). Use it for mood,
pacing and type only. Every frame is drawn by our own code.

## Non-negotiable rules (every run)

1. **Everything is drawn in code.** One HTML `<canvas>` scene, rendered frame by frame in headless Chromium (Playwright), piped
   to ffmpeg. The only outside pixels are the user's clips/photos and cover art. No stock footage, no image generators: fire, rain,
   drops, shards, stars and neon are procedural. Every visual is a pure function of `t` with seeded PRNGs (mulberry32).
2. **Word timings come only from forced alignment** (torchaudio `MMS_FA` on the demucs vocal stem) with the lyrics **exactly as written**.
   Never guess or interpolate a time; re-align a bad window or ask.
3. **Show a contact sheet of stills before the full render** (each aspect ratio) and wait for the go-ahead.
4. **Ask before overwriting** any existing file (AskUserQuestion).
5. Deliver the 1920×1080 MP4 with the original audio and a 1280×720 WhatsApp copy **under 20 MB**; for a Reel also 1080×1920 + 720×1280.
6. **Every clip is used, and each source moment only once.** Say which clip goes with which lines (and why its mood fits) before building.

## Inputs

| Input | Notes |
|---|---|
| Song | Anything ffmpeg reads; a clip is fine. |
| Lyrics | Exactly as sung, every repetition. Display keeps the user's text; alignment uses a `uroman` romanized copy. Never from memory. |
| Cover art | For the card. Without it, draw a stand-in in code and say so. |
| 4–6 clips or photos | Each with the mood wanted for its part ("lonely road", "embrace under the moon", "reaching for each other"…). Own or licensed. |
| Key line | Optional: the line to burn in fire. Default: the most emotional line before the last chorus (a promise, a name, a vow). |
| Title + artists | For the card header, e.g. `Arz Kiya Hai — Anuv Jain × Lost Stories`. |

Work folder: `glass-neon/<song-slug>/` with `input/ sep/ analysis/ clips/ scene/ stills/ out/`. Ask before reusing an existing one.

## Setup (once per machine)

```bash
pip install demucs librosa soundfile torch torchaudio uroman numpy
npm i playwright        # if Playwright is already installed (globally), do NOT reinstall it or run `playwright install`
```
- `torchaudio` must provide `torchaudio.pipelines.MMS_FA` (pin `torchaudio==2.8.*` CPU wheels if needed).
- **Local fonts** in `scene/fonts/`, URLs from the Google Fonts CSS API (raw GitHub is blocked):
  `curl -sS -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Inter:wght@500;800;900&family=Great+Vibes" | grep -o 'https://fonts.gstatic.com[^)]*\.ttf'`,
  curl each, check with `file`. Inter 500/800/900 + Great Vibes. Devanagari: "Tiro Devanagari Hindi" / "Hind".
- Load a global Playwright with `createRequire(import.meta.url)` (fallback `/opt/node22/lib/node_modules/playwright`); serve the scene from
  a local `http` server (not `file://`, which taints the canvas).

---

## Step 1: Align, beats, parts and the clip map

- **Separate** (`demucs --two-stems=vocals -n htdemucs`), **force-align** every word with MMS_FA + star tokens in 30 s windows with 2 s
  context (same code as the other lyric skills: `bundle.get_model(with_star=True)`, `flat = ["*"] + words-per-line + "*"`, read spans,
  `ratio = n / emission.size(0) / SR`). Flag `score < 0.4` or > 2.5 s words; re-align that line in a ±2 s window; still bad → ask.
- **Beats** with librosa (`beat_track`, downbeats = strongest of 4 phases, RMS energy at 10 Hz) and **kicks** (low-band onset peaks,
  ≥ 0.2 s apart, above the 80th percentile) for grain/fire/neon pulses.
- **Parts**, cut in line gaps on downbeats (`[prev.end+0.15, next.start−0.3]`, nearest the middle):

| Part | Lines | Mood |
|---|---|---|
| 1 Glass card | the intro + first 2–3 lines | cold, intimate (reading the lyrics) |
| 2 Clips | one line per clip | warm, natural colour |
| Key line | one line, in fire | the climax |
| 3 Neon ending | last 2 lines | pink, rain, after the storm |

- **Clip map:** match each clip's mood to its lines and say it, e.g. *road clip → "Khwabon mein chhupaya tumko" (walking through memories)*,
  *moon embrace → "yaadon mein basaaya tumko"*, *reaching on a hill → the key line "Miloge hamein…" and neon line 6*, *the rest of the
  moon clip → neon line 7*. Every clip used; a long clip may be split into two **non-overlapping** ranges (assert it in code). The clip the
  key line grows into continues as the first neon backdrop, so its range starts inside the fire part.
- **Ranges:** pad ±0.3 s for transitions; `speed = clamp(source/duration, 0.4, 1)`; when one clip serves two parts give both the same speed;
  below 0.7 use `minterpolate=fps=30:mi_mode=mci`. Extract numbered frames per segment (`%05d` = film frame + 1), store real counts in
  `scene/counts.js`, clamp indices. `minterpolate` is slow — run it in the background.

Sample (72 s clip): card lines 0–2 (0–30.98, breathing dots over the 8.7 s intro) → crack 29.5 → shatter 30.98 → clip3 (road) line 3 →
clip1 0–5.15 s (moon) line 4 (38.62) → key line 5 in fire (46.26), grows into clip2 at 52.3–53.9 → neon (53.87): clip2 duotone line 6,
soft white flash at 61.54 → clip1 5.2–11.93 s line 7 → hold on the last word (67.57) → fade 69.3–72.

## Step 2: Part 1, the glass card (Apple-Music-style lyrics)

- **Wall behind:** the lyric words in giant Inter 900 caps (210 px 16:9 / 240 px 9:16), rows `#3f060a`/`#2e0407` on `#0d0102`, rotated −7°,
  alternate rows drifting sideways 16 px/s, the wall scrolling up 14 px/s (row index = `r + floor(scroll/lineH)`), dark radial falloff.
- **Frosted face** (offscreen, opaque, ≈1000×1250): the wall blurred (1/6-size copy with `blur(3px)`, stretched from the card's screen box),
  red tint `rgba(96,10,18,.74) → rgba(34,3,8,.86)`, top sheen, rim `rgba(255,110,110,.42)`, radius 46. Header: cover art 170 px, title
  Inter 800 46 px, artists Inter 500 31 px 62% white, "•••", a hairline.
- **During the instrumental intro:** three **breathing dots** where the first line will be (Apple Music's instrumental marker): 11–15 px dots
  pulsing in turn at ~1 Hz, fading out 0.1 s before the first word; the first lines wait dim and blurred below.
- **Left-to-right word fill:** each word is drawn dim (white 30%), then the bright copy (white + glow `rgba(255,210,210,.75)` blur 16) is
  clipped to `x … x + width·k`, with `k = clamp((t − start + 0.03) / max(0.14, end − start))`, so long held words fill slowly like karaoke:
```js
txt(g, w.d, x, y, font, { color: "#fff", alpha: 0.3 });
g.save(); g.beginPath(); g.rect(x - 4, y - px, (ww + 8) * k, px * 1.4); g.clip();
txt(g, w.d, x, y, font, { color: "#fff", glows: [["rgba(255,210,210,0.75)", 16, 0.55]] }); g.restore();
```
- Inter 800 62 px, line height 76; the current line sits at a fixed anchor and lines scroll up (easeInOutCubic 0.45 s, 0.45 s early);
  **next line blurred below** (4 px + 2.5 px per further line, max 9); past lines 42%; a **shine** band (340 px, `rgba(255,215,215,.13)`,
  `lighter`, 20°) sweeps across the face in 0.85 s on each line change.
- **3D tilt:** 8×8 triangle mesh texture-mapping (affine per triangle, clip expanded 0.6 px); `rx = 7° + 2° sin 0.3t`, `ry = −13° + 3° sin 0.21t`,
  `rz = −2.5°`, focal 1.6·max(W,H), scale 0.88·H/faceH; a soft shadow under it. The card rises in (80 px, 1.1 s) at ≈0.5 s.

## Step 3: Crack, then shatter

- Ray × ring geometry around an impact point (12 rays, rings `[0, 85, 200, 345, 530, 770, 1060, 1500]` face px, jittered): the cells are the
  shards and their edges the cracks, so it breaks where it cracked.
- **Crack** in the gap after the card's last line: two hits on beats (radius →360 px, then →1500 px), drawn on the face (red under-stroke
  5 px blur 10 + 1.8 px light line), a white glow at the impact and a 0.25 s jolt per hit.
- **Shatter** on the downbeat over ≈1.15 s from the frozen face: each shard pushes out from the impact (`(90+420r)·easeOutCubic`), flies toward
  the camera (`−D(0.18+0.72r)p^1.45`), tumbles (±2.5 rad), fades in its last 45% and is culled at the lens; far-to-near order; light edge strokes.
  Behind it: the first clip brightening, a **red bloom** (additive radial from the impact, growing to 1.4·max(W,H)) and a 4-frame red flash.

## Step 4: Part 2, clips with lyrics in the empty space

- Full-screen, natural colour (`saturate(1.06) contrast(1.04)`), **slow push-in** 1.0 → 1.075 (easeInOutSine) about the subject.
- **Never over a face:** per clip and aspect ratio choose an empty region `{x, y, w, align: left|center|right, focus}` from its frames — sky
  above the people, the gap between a moon and a horizon, or the ground below a horizon.
- Rows, **all word by word on the voice** (a line may use 3–4 rows, in sung order):
  - `S` small tracked caps (Inter 500 28/34 px, 0.36em, fade + rise) — wrap to two rows if wider than the region;
  - `B` one big Inter 800 caps row fitted to the region (max 112/118 px), blur 12→0;
  - `V` **one word in red Great Vibes** (`#ff3048`, glow `rgba(255,20,40,.95)` blur 26), fitted (max 170/190 px), that **writes itself on**:
    offscreen word + `destination-in` with a left→right gradient whose 70 px soft edge crosses it over `clamp(duration, 0.55, 1.3)` s.
- A faint dark pool behind the block; rows fade out in the part's last 0.45 s.
- **Still photos come alive:** a push-in, seeded twinkling stars (sin⁶ twinkle + glint), a shooting star (~1 s, head glow + tail) and drifting
  light (large soft additive gradients sliding 10–20 px/s). The sample adds twinkles + one shooting star to the video clips too.
- Between clips: **soft white flash** (screen `#fff6fa`) or **red burn** (moving red/orange additive radials) over a 0.2 s crossfade.

## Step 5: The key line in fire, growing into the next clip

- On black, the key line's words in **giant Inter 900 caps** (16:9: 3 rows like `MILOGE HAMEIN / TUM JAANAM / KAHIN NA KAHIN`; 9:16: 4 rows),
  each row fitted to 86% (84%) of the width. **Each word cuts in on its sung time** (scale 1.12 → 1, α over 0.22 s).
- **Fire only inside the letters:** procedural fire field (low-res 256×144 / 144×256, upscaled, `blur(1px)`):
  ```js
  const q = fbm(u*1.7, v*1.5 + t*0.55, 3), n = fbm(u*4.2 + q*2.2, v*2.4 + t*2.3, 5), m = fbm(u*9 + 3.1, v*6 + t*4.2, 3);
  let heat = 0.42 + (n - 0.47)*2.5 + (m - 0.5)*0.8 + (v - 0.5)*0.45; heat = 0.3 + 0.7*clamp(heat);  // floor keeps every letter lit
  // palette black → #280200 → #8c0e02 → #e23a04 → #ff8412 → #ffcc5c → #fff8de; +25% on kicks
  ```
  Draw fire into an offscreen canvas, draw **all** visible words into one mask canvas, then a **single** `destination-in` with the mask
  (a `destination-in` per word erases the earlier words). An orange burning rim under the letters (shadow blur 34) and rising embers.
- **Grow:** after the line's last word, scale the cut-out about an opaque pixel inside the middle letter of the biggest row from 1 → 48
  (easeInExpo, ≈1.5 s). From 40% of the grow, the inside of the letters **dissolves from fire into the next clip**, so when the letter
  covers the frame the clip fills the screen. A soft white flash on the downbeat starts part 3 on that same clip.

## Step 6: Part 3, the pink neon ending

- **Duotone clip** with its bottom on the floor line (75% H 16:9, 66.5% H 9:16): `grayscale(1) contrast(1.3) brightness(1.25)` → `multiply #ff4fa6`
  → `lighten #1e0416`, darker toward the floor (`rgba(10,0,6,0 → .78)`), slow push-in 1.0 → 1.06. A clip change inside the part sits under a soft white flash.
- **Wet floor** `#1c0414 → #040002`, pink horizon glow, the clip mirrored in rippled 3 px strips (α 0.42·(1−k)²).
- **Neon words** (Inter 800 caps, core `#ffe0f0`, glows `rgba(255,60,170,.95)` 16 px + `rgba(255,40,150,.8)` 48 px), phrases of ≤ 18 characters
  (≤ 11 in 9:16) fitted to the width: each word **drops in with a small bounce** (from 150 px, `easeOutBack(k, 1.4)`, starting 0.3 s early, unlit),
  **flickers on like a sign** when it lands (4 seeded toggles in 0.2 s, then a ±7% hum) and lands with a **splash ripple** (3 rings + 9 droplets).
  The word layer is mirrored in the floor.
- **Light rain** (2 layers of pink-white streaks) + floor ripples, and **drops on the glass**: ~34 seeded drops (6–22 px) on the lens; each
  clips a circle and draws a **flipped, shrunk patch of the frame behind it** (a lens), with a dark rim and a specular dot; a third of them slide
  slowly down with a faint trail. Drops fade in at the start of the part. **Keep the still drops out of the word band**
  (from 16% H above the floor line, 9% in 9:16, to 3% below it): a drop sitting on a neon word flips its letters and reads as a glitch.
- **On the last word, hold the frame:** `renderFrame(t)` renders `min(t, lastWord.start + 0.5)` (grain keeps moving), then fades to black from
  the end of the line to the end of the video.

## Step 7: Finishing

Grain (4 noise tiles, `overlay` 5%, +1.5% on kicks), a soft vignette (55% at the corners), fade in from black 0.5 s, audio fade in 0.5 s /
out 1.5 s with the original mix.

---

## Reel layout (9:16, 1080×1920, when asked)

Render with `?w=1080&h=1920` (`PORT = H > W`). **Safe zone:** text ≥ 230 px from the top, ≥ 400 px from the bottom, ≥ 150 px from the right.
- **Card larger:** scale 0.84·W / faceW (≈ 907 px wide vs ≈ 726 in 16:9), 24 px left of centre, at 47% H, yaw −6°. Lyric rows end left of x = 930.
- **Clips:** frames cropped 608×1080 around each subject's focus x, scaled to 1080×1920; text regions in the sky above the people (from y ≈ 250)
  or between the moon and the horizon, right-aligned regions end at x = 930; small rows wrap.
- **Key line:** 4 rows fitted to 84% of the width.
- **Neon:** floor line at 66.5% H, so the words, splashes and floor sit **above the 400 px bottom zone**; phrases ≤ 11 characters centred in
  the safe width; fewer, smaller drops on the glass.

## Build: the scene and the renderer

- `analysis/build_data.py` → `scene/data.js` (`lines, sections, segs, beats, down, kicks, transitions, meta`). `meta`: `fill: "ltr"`,
  `scriptColor`, `crack`, clip rows per line (`[["S",0,1],["B",2,3],["V",4],["S",5,6,7]]` word indices), `fireMode: "line"`, `fireRows` per
  aspect ratio, `fireInto` (segment shown inside the growing letters), `neonSegs` (`[[seg, until], …]`), `flashes`, `hold`, `dropsOnGlass`, `fadeOut`.
- `analysis/prep_clips.sh` → `clips/<ar>/<seg>/%05d.jpg` + `scene/counts.js`.
- `scene/index.html` (fonts via @font-face, `data.js`, `counts.js`, `lyric.js`); `window.ready` loads + checks every font, **then** lays out text.
  `async window.renderFrame(t)` awaits needed frames (`img.decode()`, LRU). `scene/render.mjs --w W --h H <from> <to> out.mp4` pipes JPEG frames to
  libx264 crf 16; `--stills t1,t2,… dir` writes PNGs.
- At most **2 node render workers** at once; long renders in the background; join chunks with the concat demuxer; `-nostdin` in loops.

- **Testing while frames are still extracting:** `prep_clips.sh` writes `counts.js` as it goes, so the page fails to parse until it ends.
  Point a throwaway `scene/test.html` at a hand-written `counts_test.js` for the aspect ratio that is ready and render stills with
  `render.mjs --page test.html` (delete both afterwards). Never edit a scene file while a render of it is still starting up.
- The WhatsApp budget is 18.6 decimal MB (`18.6*8*1000*1000` bits), so the copy stays under 20,000,000 bytes even when x264 overshoots by ~1%.

## Contact sheet: required before the full render

Per aspect ratio, 12 stills **into an empty folder**: card with breathing dots · a word half-filled · next line blurred + shine · cracked card ·
mid-shatter · clip 1 with the red script writing on · clip 2 · key line words cutting in with fire · letters growing into the clip · neon word dropping ·
neon splash + drops on glass · the held last frame. Tile (`tile=4x3` for 16:9, `tile=6x2` for 9:16), **look**: readable, nothing over faces,
nothing cut off, 9:16 safe zone, letters burning, no clip moment reused. Fix, then show the user with the part/clip table and **wait for approval**.

## Final render and delivery

Mux each joined video with the song (`-ss START -t D`, `afade` in 0.5 / out 1.5, aac 192k, `+faststart`) →
`out/<slug>_glassneon_169.mp4` / `_916.mp4`. WhatsApp: `VB = int(18.6*8*1000*1000/D/1000 - 96)` kbps, two-pass libx264 (unique `-passlogfile`),
`scale=1280:720` / `720:1280`, aac 96k → `_720p_whatsapp.mp4`, verify < 20 MB. ffprobe every file (resolution, fps, `-count_packets` frames,
duration, audio). Delete the extracted clip frames afterwards. Ask before overwriting `out/`.

## Final report to the user

- the part table and the clip map (clip → lines → range, speed, and the mood reason);
- output paths with size, frames, duration; contact sheet paths;
- re-aligned/confirmed words; stand-ins (cover art, fire);
- offer tweaks: the key line, the script words, text regions, neon phrase splits, hold length.
