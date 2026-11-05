---
name: minimal-love-lyrics
description: Build a calm, minimal 16:9 love lyric video — a dark maroon page with a soft centre glow, vignette, fine grain and a few drifting dust specks; the song title in coral script and the artist in thin spaced caps open it; each line is a stacked block (lead-in words in small white handwritten script, the one key word huge in coral serif italic, the rest in white serif) whose words blur in and rise exactly when sung and that breathes on the beat; beside it a tiny white line icon (door, sun, hearts, paper plane, clock, couple…) draws itself stroke by stroke. Also renders a 9:16 Reel. Use when the user runs /minimal-love-lyrics or attaches a song (MP3 or clip), its lyrics and the title + artist and asks for a minimal / aesthetic love lyric video.
argument-hint: "<song (mp3/clip)> <lyrics> [\"Title — Artist\"] [reel]"
---

# Minimal Love Lyrics

Make a calm, minimal 1920×1080, 30 fps love lyric video. **One dark maroon page, one block of
stacked type, one tiny white doodle.** Nothing else moves except slow dust and the breathing
block. Every word appears exactly when it is sung.

Reference feel: "Tumhare Aane Se (Ashu Shukla) minimal love lyrics" (from *Ye likho ye milega*).
Use that for mood, type mixing and pacing only. Every frame is drawn by our own code.

## Non-negotiable rules (every run)

1. **Everything is drawn in code.** One HTML `<canvas>` scene is rendered frame by frame in
   headless Chromium (Playwright), and the frames are piped to ffmpeg. No stock footage, no image
   generators, no icon packs or SVG downloads: every icon is vector strokes written in code. Every
   visual is a pure function of time `t` with seeded PRNGs (mulberry32), so re-renders and
   parallel chunks are identical.
2. **Word timings come only from forced alignment** (torchaudio `MMS_FA` on the demucs vocal
   stem), using the user's lyrics exactly as written. Never guess, eyeball or interpolate
   timings. If a word aligns badly, re-align that window or ask.
3. **Show a contact sheet of stills before the full render**, then wait for the user's go-ahead.
4. **Ask before overwriting** any existing file in the work or output folder (AskUserQuestion).
5. Deliver a 1920×1080 master MP4 with the original audio and a 720p copy **under 20 MB** for
   WhatsApp. If the user asks for an **Instagram Reel**, also render 1080×1920 (9:16) with its own
   720×1280 WhatsApp copy (see "Reel layout").

## Inputs

Collect these, and ask for anything that is missing before starting:

| Input | Notes |
|---|---|
| Song | MP3 or anything ffmpeg reads. A clip is fine, and the video then covers only that clip. |
| Lyrics | Exactly as sung, with every repetition. Roman, Hindi/Urdu in Roman, or another script: the display keeps the user's text and alignment uses a `uroman` romanized copy. Never write lyrics from memory. If the user has none, offer a Whisper large-v3 transcription and show it for correction first. |
| Title + artist | For the opening, e.g. `Tumhare Aane Se — Ashu Shukla`. Optional small third line (composer · film · year). |
| Reel? | Only if asked (or if the user says "for Instagram"). |

Work folder: `minimal-love/<song-slug>/` with `input/ sep/ analysis/ scene/ stills/ out/`.
If it already exists, **ask** before reusing or overwriting.

## Setup (once per machine)

```bash
pip install demucs librosa soundfile torch torchaudio uroman numpy
npm i playwright           # if Playwright is already installed, do NOT reinstall the browser (never `playwright install`)
```
- `torchaudio` must provide `torchaudio.pipelines.MMS_FA`. Pin `torchaudio==2.8.*` (CPU wheels from
  `https://download.pytorch.org/whl/cpu`) if a newer version has dropped it. Do not switch aligners.
- **Fonts must be local**, in `scene/fonts/`. Get the TTF URLs from the Google Fonts CSS API (raw GitHub URLs may be blocked):
  ```bash
  curl -sS -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,800&family=Great+Vibes&family=Dancing+Script:wght@500&family=Cormorant+Garamond:wght@600&family=Montserrat:wght@300" \
    | grep -o 'https://fonts.gstatic.com[^)]*\.ttf'    # curl each one; check with `file` that each is TrueType
  ```
  | Role | Font | Colour |
  |---|---|---|
  | key word | **Playfair Display Italic 800** (Abril Fatface is the alternative, but it has no true italic) | coral `#ff8a74` |
  | lead-in words | **Dancing Script 500** (small handwritten script) | white `#fbefe9` at 92% |
  | rest of the line | **Cormorant Garamond 600** (medium serif) | white at 94% |
  | title | **Great Vibes** | coral |
  | artist | **Montserrat 300**, caps, `ctx.letterSpacing` ≈ 0.45 em | white at 90% |
  For Devanagari lyrics use "Tiro Devanagari Hindi" (serif rows), "Kalam" (handwritten lead-ins) — both on Google Fonts.
- Playwright installed globally isn't visible to an ESM `import`. Load it with `createRequire(import.meta.url)`
  and fall back to `/opt/node22/lib/node_modules/playwright` (or the machine's global `node_modules`).
- **Serve the scene over a local HTTP server** (a tiny Node `http` static server inside `render.mjs`, on `127.0.0.1`), not `file://`.

---

## Step 1: Listen, align, and pick a key word + icon per line

**1a. Separate:**
```bash
ffmpeg -i input/<song> -ac 2 -ar 44100 analysis/song.wav
demucs --two-stems=vocals -n htdemucs -o sep analysis/song.wav
```
Transcribe the last 30 s with Whisper to check for a channel promo or voice-over at the end. If there is one, end the video before it.

**1b. Force-align every word.** MMS_FA **with star tokens** between lines, so hums and ad-libs that aren't in the lyrics don't pull words out of place:
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
Write `analysis/timeline.json` (`lines[i].words[j].{display,start,end,score}`). Flag words with `score < 0.4` or longer
than 2.5 s; re-align that line in its own ±2 s window with star tokens on both sides. If a word is still bad, **show the user and ask.** Never patch a time by hand.

**1c. Beats:** `librosa.beat.beat_track` → `beats`; `downbeats` = the strongest of the 4 phases by onset strength. The block breathes on `beats`.

**1d. Blocks, key words and icons** (`analysis/build_data.py` → `scene/data.js`). Translate the lyrics for yourself, then:
- **One block per sung line.** A line of more than ~6 words that has a natural half (a comma, a repeated pattern such as
  "Khwabon mein chhupaya tumko, yaadon mein basaaya tumko") becomes **two blocks**, one per half.
- **One key word per block** — the word that carries the feeling (love, restless, dreams, memories, meet…), not a
  filler. Words before it are the *lead-in*, words after it are the *rest*.
- **One small icon per block that shows that feeling** — from the library below or a new one in the same style.
  Never the same icon twice in a row. A repeated chorus line may reuse its key word but gets **a different icon variant**
  (hearts → paper plane carrying love; moon → dream cloud; heart-with-pulse → clock).
- Block timing: `in = first word − 0.45 s`, `out = next block's first word − 0.45 s` (the last block ends ~1.5 s before the video ends).

**Tell the user the plan** as a table (block · words · key word · icon) and continue; change it if they object.

## Step 2: The page

Nothing else on the page:
- base fill `#2a070d` (dark maroon);
- a **soft lighter glow in the centre**: radial gradient at the centre, `rgba(118,32,45,.85)` → `rgba(80,18,30,.45)` at 45% → transparent at `0.55·max(W,H)`;
- **strong vignette** (drawn last): radial from 32% to 100% of the half-diagonal, `rgba(10,0,3,0)` → `.45` at 60% → `rgba(6,0,2,.9)` in the corners;
- **fine film grain**: 4 seeded 256 px noise tiles, `overlay` at 6%, tile = `frame % 4`, offset seeded per frame;
- **dust**: ~16 seeded specks, radius 0.8–2.6 px, drifting slowly up (3–10 px/s) and sideways, wrapping, α twinkling 0.12–0.34.

## Step 3: Opening

- The **title** in coral **Great Vibes** (~132 px), centred: blurs in (`blur 18 → 0`, α 0→1, 14 px rise) over 1.6 s from t≈0.6 s, with a soft coral glow (`shadowBlur 30`, `rgba(255,120,95,.35)`).
- At t≈2.3 s the **artist** in **Montserrat 300 caps**, 26 px, letter-spaced 12 px, 82 px below; optional third line 15 px at 55%.
- **Both fade out with a blur** (1.1 s) so they're gone ≥ 0.5 s before the first block appears.

## Step 4: Lyric blocks (the stacked type)

Lay out each block **after the fonts load** (`wrapRows` measures every word; rows wrap at 50% of the width in 16:9):
```
 lead-in   Dancing Script 58 px, centred rows                (y += 0.9·size, then 1.12·size per extra row)
 KEY       Playfair Display Italic 800, 176 px, coral         (y += 0.92·key, or 0.72·key with no lead-in; fit to max width)
 rest      Cormorant Garamond 600, 66 px, centred rows        (y += 1.32·size, then 1.12·size per row)
```
- **Every word blurs in and rises exactly when sung:** from `start − 0.08 s` over 0.4 s,
  `a = easeOutCubic(u)`, `ctx.filter = blur((1−a)·12px)`, α = a, y offset `(1−a)·16px`. The key word takes 0.6 s,
  22 px blur and a 26 px rise, plus a coral glow (`shadowBlur 34`, `rgba(255,120,95,.35)`). Unsung words are invisible;
  word x positions come from the full row, so nothing shifts as words arrive.
- **Breathing:** scale the whole block about its centre by `1 + 0.012·beatPulse + 0.006·sin(0.9t)`, with
  `beatPulse = exp(−(t − lastBeat)/0.22)`.
- **Between blocks:** over the last 0.55 s of a block, add up to 16 px blur, fade α (easeInOut) and drift it up 10 px;
  the next block's first words blur in as it goes.

## Step 5: Icons (tiny white line doodles, drawn stroke by stroke)

- Define each icon in a **100-unit box centred on (0,0)** as an ordered list of strokes; every stroke is a polyline built
  from helpers: `line`, `arc(cx,cy,r,a0,a1)`, cubic `bez`, `poly`, `heart(cx,cy,s)` (the 16 sin³ curve), `star4` sparkle,
  `cloud(cx,cy,w,h)` (bumps as arcs), `crescent(c1,r1,c2,r2)` (circle-intersection arcs).
- **Draw by path length:** total draw time 1.9 s starting on the key word; each stroke gets time ∝ its length, with
  0.07 s pauses between strokes; `strokePartial(pts, f)` walks the polyline to `f·length`.
- Style: `lineWidth ≈ 2.6 px` (at 1080p), round caps/joins, `rgba(253,242,236,.95)`, faint glow `shadowBlur 6`. Size ~210 px in 16:9, beside the
  block (group = block + 70 px gap + icon, centred), **alternating right / left** per block, vertically on the key word.
- **A little life once drawn** (each is a transform on a stroke group):
  | icon | meaning | after drawing |
  |---|---|---|
  | thought bubble + ? | thinking, "should I" | bobs gently |
  | two hearts | love | beat-pulse +5% |
  | heart with pulse line | restless heart | trembles (seeded jitter at 12 fps) |
  | crescent moon + stars | dreams, night | stars twinkle (scale 0.8–1.05) |
  | polaroid on a pin | memories | sways about the pin |
  | dream cloud with moon + z | dreaming | bobs, stars twinkle |
  | door that swings open | welcome, letting in | panel swings about its hinge (`scale(cos a)` + slight skew) and 3 light rays appear |
  | couple holding hands + heart | meeting, together | heart floats and pulses |
  | paper plane on a dotted arc | sending love, distance | flies a Bézier arc (rotated to the tangent), leaving dots |
  | clock | waiting, time, "or not" | minute hand ticks one notch per beat |
  | sun | hope, morning, arrival | rays draw in, slow rotation |
  Add new ones in the same style (thin, ≤ 12 strokes, diary-doodle simple).
- The icon fades and blurs out with its block (blur × 0.6).

## Step 6: Transitions, audio and finishing

- Blocks blur out/in as above; no other transitions, no camera moves.
- Audio: the original song, 0.5 s fade in, 1.5 s fade out. No re-mix.
- 1920×1080 at 30 fps (1080×1920 for the Reel).

---

## Reel layout (9:16, 1080×1920, when asked)

- Render the same scene with `?w=1080&h=1920`; the scene reads `PORT = H > W`. **Keep all text inside Instagram's safe zone**:
  ≥ 230 px clear at the top, ≥ 400 px at the bottom (caption) and ≥ 150 px on the right (buttons). So the text column runs
  x = 70…930 and is centred at x ≈ 500 (not 540).
- Bigger type for the phone: lead-in 66 px, key 196 px (fit to 96% of the safe width), rest 78 px; rows wrap at the safe width.
- The block sits at ~55% of the height; the icon (~270 px) is **centred above the block**, not beside it.
- The title is fitted to 92% of the safe width.
- The page glow is centred at 47% height. Check every still: nothing in the top 230, bottom 400 or right 150 px.

## Build: the scene and the renderer

- `scene/index.html` loads the fonts (`@font-face`), `data.js` (`window.DATA = {blocks, beats, downbeats, meta}`) and `love.js`.
  It exposes `window.ready` — `document.fonts.load` each face, **assert `document.fonts.check`** (throw on failure), then lay out every
  block (text measurement only after fonts load) — and `async window.renderFrame(t)`.
- `scene/render.mjs` (local static server + Playwright): `node scene/render.mjs --w 1920 --h 1080 <fromFrame> <toFrame> out.mp4`
  pipes `canvas.toDataURL("image/jpeg", 0.96)` into `ffmpeg -f image2pipe -c:v mjpeg -i - -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30`;
  `--stills t1,t2,… dir` writes PNG stills.
- Render in 2 chunks per aspect ratio (**at most 2 node workers at once** — the machine is shared), joined with the concat demuxer (`-c copy`).
  To fix a few seconds, re-render whole chunks; never splice onto a trimmed stream copy. In bash loops call ffmpeg with `-nostdin`.

## Contact sheet: required before the full render

Render ~12 stills per aspect ratio: title in; title + artist; first key word blurring in with its icon half drawn; a full block
with the icon done; one still per icon type (hearts, pulse heart, moon, polaroid, cloud, door open, couple, plane mid-flight, clock);
one mid-transition (blurring out). Tile them:
```bash
ffmpeg -i stills/169/s_%02d.png -vf "scale=480:-1,tile=4x3:padding=8:color=0x14040e" stills/contact_169.jpg
ffmpeg -i stills/916/s_%02d.png -vf "scale=270:-1,tile=6x2:padding=8:color=0x14040e" stills/contact_916.jpg
```
**Look at them yourself** (open the images): text readable, nothing cut off, icons legible and not overlapping the type,
no icon repeated twice in a row, Reel safe zones respected. Then show them to the user with the block table and **wait for approval**.

## Final render and delivery

```bash
D=<duration>
ffmpeg -i out/v_169.mp4 -i analysis/song.wav -map 0:v -map 1:a -t $D \
  -af "afade=t=in:d=0.5,afade=t=out:st=$(echo "$D-1.5"|bc):d=1.5" -c:v copy -c:a aac -b:a 192k -movflags +faststart out/<slug>_minimallove_169.mp4
VB=$(python3 -c "print(int(19*8*1024*1024/$D/1000 - 96))")k      # WhatsApp: two-pass, 19 MB budget, 96k audio
ffmpeg -y -i out/<slug>_minimallove_169.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v $VB -pass 1 -passlogfile wa169 -an -f null /dev/null
ffmpeg -i out/<slug>_minimallove_169.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v $VB -pass 2 -passlogfile wa169 -c:a aac -b:a 96k -movflags +faststart out/<slug>_minimallove_169_720p_whatsapp.mp4
```
For the Reel use `scale=720:1280` and a different `-passlogfile`. Verify each WhatsApp copy is < 20 MB (`stat`; if not, lower `VB` by 10%).
Check every file with `ffprobe`: resolution, 30 fps, frame count (`-count_packets`), duration and an audio stream.
Before writing into `out/`, check for existing files and **ask before overwriting**.

## Final report to the user

- the block table (words → key word → icon) and times;
- the file paths with sizes, frame counts and durations;
- the contact sheet paths;
- any re-aligned or user-confirmed words;
- offer tweaks: a different key word or icon for a line, icon side, type sizes, glow strength, dust amount.
