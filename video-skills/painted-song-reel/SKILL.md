---
name: painted-song-reel
description: Make a painted-style animated music-video reel (9:16, Instagram / YouTube Shorts) for any song the user gives (mp3, opus, wav, m4a), like the viral "painted-style animated music video made with Claude" reels. It has a "Claude x song" laptop intro, a "please rotate your phone" card, then a sideways landscape music video. Each shot is a semi-realistic painting of original characters, moved by the camera with depth parallax, with petals / stars / rain, cuts on the downbeat and karaoke lyric strips from the first sung word. The story, palette and painting style follow the song's mood and lyrics. Runs locally on CPU with open-source models (DreamShaper XL Lightning plus a face-repair pass): no Flow, no credits. Use when the user asks for a painted reel, painted music video or "a reel like that one" for a song, sends a song and asks for this style, or says "make a painted reel for this song".
---

# Painted song reel

What comes out: one 1080x1920 MP4 of about 65-70 s, built in this order:

| Time | Part |
|---|---|
| 0-3.4 s | Laptop intro: a laptop on a dark desk with a glowing keyboard. Two tiles sit on top: "Claude" x the song. The screen shows the chat that made the reel, then a player opening on the finished video. |
| 3.4-4.5 s | Black, then the "PLEASE ROTATE YOUR PHONE" card. The card turns 90 degrees clockwise. |
| 4.5 s onwards | The music video. It is made at 1920x1080 and placed turned 90 degrees clockwise, so it fills the phone when the phone is turned. |

The music video, shot by shot:
- **Shots:** about 20, one per 1-2 bars, each ONE painted still that never changes. The camera does all the moving (push, drift, roll), plus depth parallax from a depth map.
- **Cuts:** on the downbeats, with whip pans, zoom-throughs, flashes and dissolves.
- **Effects:** petals, dust, bokeh, stars, rain, snow, fireflies or embers, colour grades, and a cloud that forms a heart.
- **Lyrics:** every sung line appears on a torn-paper strip, starting with the very first word. Each word darkens as it is sung.

This is exactly how the reference reels are made (checked frame by frame): still paintings, with only the camera and the effects moving.

Cost: nothing. Every model is open source and runs on this machine's CPU.

Time on 4 CPU cores, about 1.5 h per reel:

| Step | Time |
|---|---|
| Listen | 2 min |
| Two painted options per shot | 35-70 min |
| Face repair | 15-25 min |
| Render | 6 min |
| Intro and assembly | 5 min |

Run the long steps in the background, and tell the user what is happening at each step.

Model licences:
- DreamShaper XL Lightning: openrail++, commercial use allowed.
- Depth Anything V2 Small: Apache-2.0.
- YuNet, faster-whisper and demucs: MIT.

Rules that always apply:
- **Characters:** original characters only. Never paint a real actor, singer or other real person, even if the user asks for "the actors from the song". Offer look-alike-free characters in the same spirit.
- **The song:** it stays the user's. Do not commit it, and do not commit any painting or video, to git.
- **Instagram:** posting the reel is the user's call, and Instagram may mute copyrighted audio.

`SK=~/.claude/skills/painted-song-reel`. Work folder for one reel: `R=<scratchpad or ~/reels>/<song-slug>`.

## 0. Setup (once per machine)
`bash $SK/scripts/setup.sh`
- It checks the python packages and installs any that are missing.
- It fetches the fonts into `$SK/fonts` and draws the laptop picture into `$SK/assets/laptop.png`.
- It downloads the models into the Hugging Face cache: about 9 GB, 5-15 min the first time, about 10 s afterwards.
- Lyrics in other scripts need their fonts: `EXTRA_FONTS="noto-sans-gurmukhi" bash $SK/scripts/setup.sh fonts`. Then set `captions.font` to `$SK/fonts/NotoSansGurmukhi_700Bold.ttf` and `captions.lang` to `pa`. The same pattern works for noto-sans-tamil, -telugu, -bengali and -gujarati.
- Use `HF_HUB_OFFLINE=1` on later commands so they don't wait on the network.

## 1. Listen
`python3 $SK/scripts/analyse_song.py <song> $R --lang hi [--from 40 --to 160]`

It reads the tempo, beats and downbeats over the whole song. It separates the voice with demucs, then transcribes the words with faster-whisper on the voice alone, with each word's time. It writes:
- `$R/song.wav`
- `$R/vocals.wav`
- `$R/song.json`

It also prints a bar table (bar number, time, loudness, voice, the words sung in that bar) and the lines it heard.

Whisper drops a line that repeats the one before it. The script listens again wherever the voice sings but no word was caught, but still check the table: a bar with voice and no words is a missed line.

1. **Choose the section.** About 60-65 s (`round(60 / bar)` bars) of the best part, usually the mukhda/hook plus one antara line or the hook twice.
   - `mv0` = the downbeat just before the first sung word. The music video starts there.
   - `end` = a downbeat after a line ends.
   - The reel itself starts at `mv0 - 4.5`, so the intro and card play over the lead-in. If `mv0 < 4.5`, take a later occurrence of the hook.
2. **Fix the words.** Correct the spelling with the real lyrics (from the song itself, from your knowledge of famous songs, or ask the user to paste them) and keep the measured times. For a word the recogniser missed, place it from the voice column and the rhythm of the same line elsewhere.
3. **Name the mood** in one line, from the lyrics' meaning, tempo, energy and instruments. Example: "romantic longing, 90s Bollywood, golden hour turning to moonlit night". Then read `reference/moods.md`.

## 2. Story and look: write `$R/reel.json`
`reference/example_sochenge.json` is the complete reel that was delivered. Copy its shape.
- **Cast:** 1-2 original characters. `cast` gives the outfit first and is pasted into prompts as `{K}`/`{N}`. `face` gives a face-only description for the repair pass. Keep the outfits and hair identical in every shot.
- **Storyboard:** one shot per 1-2 bars (2-4 s each), 18-22 shots for a minute. Each picture comes from the words sung over it: show the image the line names. "ख़्वाबों में छुपाया तुमको" (hid you in my dreams), for example, became her dancing among the stars.
- **Arc:** give the cut a shape, for example meet, longing, dream or memory, search, together. End on the strongest picture, held with a slow push and a fade.
- **Repeated lines:** when a line repeats, use NEW pictures (a second option of a shot as its own alias, such as `swing:242:swing2`), not zoomed copies.
- **Look:** from the mood (`reference/moods.md`): style prefix, light words, palette, grade, effects, transitions, overlays.
- **`shots` (painting spec):**
  - `prompt` ≤ 77 CLIP tokens. The painter prints the count. Long prompts lose their end.
  - `seeds`: two of them.
  - `faces`: `"K"`, `"N"`, `"??"` (two people) or `""` (nobody).
  - `"eyes": "closed"` for sleeping or dreaming faces, so the face repair keeps them closed.
- **`cut`:** shots in order, each with:
  - `img` and `bars`, or `t1` in MV seconds.
  - `z` [start, end] and `c` [[x, y] start, [x, y] end] in 0-1 of the picture.
  - Optional: `rot`, `par`, `dolly`, `swing`, `ease`, `grade`, `fx`, `overlays`, and `out` + `out_d` (the transition into the next shot).
- **`lines`:** each line's words as `[word, song_time]`, with `end` = when the line's last word ends.
- **`captions`:** `{"y": 955, "size": 62}`. Raise `y` if faces sit low.
- **`intro`:**
  - `title`, and `tile` (the short word on the song tile).
  - `tile_rgb`: the tile's gradient, top and bottom, in the mood's colour.
  - `lines`: the chat reply shown on the laptop, 7 lines of about 65 characters, describing what was done for this song. No time claims.
  - `file_label`: `"Video · 66.8 s"`.
  - `flow_mark`: `false`.

## 3. Paint
```
cd $R && HF_HUB_OFFLINE=1 nohup python3 $SK/scripts/paint_pro.py candidates reel.json paint > paint.log 2>&1 &
```
- **Candidates:** two options per shot at 1344x768, 1-2 min each, plus `paint/sheet_<name>.jpg`. Watch `paint.log` with a Monitor. The command can be re-run after a restart, because it skips pictures already painted. `... candidates reel.json paint name1,name2` paints only those shots.
- **Look at every sheet** and reject:
  - the same person twice (about 1 shot in 4)
  - extra people in a one-person shot
  - broken hands or limbs
  - the wrong outfit or setting
  - text or watermarks
  - a face too small to read

  If both options fail, add a seed and paint that shot again.
- **Finish the picks:**
  ```
  HF_HUB_OFFLINE=1 nohup python3 $SK/scripts/paint_pro.py finish reel.json paint hill:212 swing:241 swing:242:swing2 ... > finish.log 2>&1 &
  ```
  This writes `paint/final_<alias>.png`. Each pick is enlarged 2x to 2688x1536, and every face is repainted close up at high resolution (1-1.5 min a face), colour-matched and blended back.

  Then crop a face or two, before and after, to check: eyes, nose, lips, closed eyes still closed, no face painted on a lamp. Small or doubtful second faces are skipped on purpose.

## 4. Camera, check, render
1. `python3 $SK/scripts/grid.py $R/paint $R/grid.jpg name1 name2 ...` shows the finals with a 10% grid and the face centres.
   - Aim each push so the face ends in the upper-middle of the frame: `c` end ≈ (face_x, face_y + 0.05-0.10).
   - `z` [1.04, 1.18] for wide shots, [1.10, 1.25] for closer ones, up to 2.1 for a zoom into an eye.
   - At the end of the push, a point (u, v) of the painting lands on screen at x = (u - cx)·1920·z + 960 and y = (v - cy)·1097·z + 540.
   - Place `overlays` (the heart, in screen pixels) in open sky.
2. `python3 $SK/scripts/build_reel.py $R/reel.json $R/song.json $R/paint $R/shots.json`. It prints each shot's times. A shot under 1.5 s or over 5 s means the bars are wrong.
3. `bash $SK/scripts/render_parts.sh $R/shots.json $R/mv stills`. Look at `mv/stills_sheet_*.jpg`: faces inside the frame, the lyric strip not over a face, grades, effects. Fix `reel.json` and rebuild.
4. `bash $SK/scripts/render_parts.sh $R/shots.json $R/mv video`. This renders 4 parts side by side and joins them into `mv/mv.mp4`, about 6 min for a minute.

## 5. Intro, card, song, delivery
```
python3 $SK/scripts/render_intro.py $SK/assets/laptop.png $R/mv/mv.mp4 $R/mv/intro.mp4 $R/reel.json
python3 $SK/scripts/render_card.py $R/mv/card.mp4
bash $SK/scripts/assemble_reel.sh $R/mv $R/song.wav <mv0 - 4.5> $R/master.mp4      # song faded, -14 LUFS
ffmpeg -y -v error -i $R/master.mp4 -c:v libx264 -preset slow -crf 21 -profile:v high -level 4.2 -pix_fmt yuv420p \
  -c:a copy -movflags +faststart $R/<Title>_painted_reel.mp4                        # about 50 MB a minute
```
1. Check frames at 1.0, 2.6, 3.7 and 4.8 s, and a few in the music video (`ffmpeg -ss T -i ... -frames:v 1`).
2. Check the loudness: `ffmpeg -i ... -af ebur128 -f null -` should give about -14 LUFS.
3. Send the file with SendUserFile, plus one full-size frame (turn it back with `-vf transpose=2`).
4. Tell the user what each part shows and offer to repaint any single shot (about 3 min).

## Rules learned the hard way
- **Prompts:**
  - The style prefix goes FIRST and is identical in every shot. Without it the model paints photos.
  - Say "alone" for one-person shots.
  - Two-person shots describe both people in full, with no `{K}`.
  - "no people" for empty scenes.
- **Sampler:** plain DPM++ 2M, 5 steps, CFG 2, with the negative prompt. The SDE Karras sampler makes paintings look over-sharpened and HDR.
- **Face repair:**
  - Without the 2x enlargement, a close camera push goes soft.
  - Without `"eyes": "closed"`, sleeping faces wake up.
  - Its second-face guard skips crowds and false finds (a lamp, the moon, embroidery).
- **Depth cache:** keyed by file name. A new reel needs a new `mv` folder, or `REEL_CACHE`.
- **Captions:**
  - Every line appears from its first word and leaves 0.35 s before the next. Lines never overlap.
  - Captions use the font of the lyrics' script, with raqm shaping. Check that `captions.lang` matches the script.
- **The laptop screen:** it is drawn in code (`laptop.html`). Image models cannot paint a flat green screen.
- **If the machine restarts mid-run:**
  - Re-run `candidates` (it resumes).
  - Re-run `finish` with only the picks that have no `final_*.png` yet.
  - A cold start takes about 6 min to load the painter from disk.
- **Slow machine:** if painting takes over 2 min a picture, say so, and offer a shorter reel (fewer shots, or longer shots of 2 bars).
- **Disk:** the models need about 9 GB. One reel's work files are about 1 GB. After finishing, delete the options that were not picked.

## Files
- `scripts/analyse_song.py`: tempo, downbeats, voice separation, words with times, bar table.
- `scripts/paint_pro.py`: the painter (`candidates`, `finish`, `test`) and the face repair.
- `scripts/grid.py`: the finals with a grid and face centres.
- `scripts/build_reel.py`: turns `reel.json` and `song.json` into the renderer's shot list (times from the bars, captions).
- `scripts/render_mv.py`: the still animator (camera, depth parallax, transitions, effects, grades, heart, karaoke strips).
- `scripts/render_parts.sh`: check stills, then the 4-part render.
- `scripts/render_intro.py`, `scripts/render_card.py`, `scripts/assemble_reel.sh`: intro, rotate card, and the final reel with the song.
- `scripts/laptop.html`, `scripts/make_laptop.cjs`: the code-drawn laptop with the green screen.
- `scripts/setup.sh`: packages, fonts, models, laptop.
- `reference/moods.md`: mood → look.
- `reference/example_sochenge.json`: a complete reel ("Sochenge Tumhe Pyar", 21 shots, 10 lines).
