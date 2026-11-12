# Painted song reel ("Claude x song", rotate your phone)

Packaged for any song as the Claude Code skill `painted-song-reel` (`video-skills/painted-song-reel`: song analysis,
mood guide, painter with face repair, renderer, intro, assembly). This folder keeps the first reel's working files.

A ~28 s vertical (1080x1920) reel for any song, in the format of the viral "painted-style animated music video"
reels: a laptop on a dark desk with a glowing keyboard and two tiles on top ("Claude" x the song), the screen showing
the chat that made it and then a player opening on the finished video; a one-second "PLEASE ROTATE YOUR PHONE" card
whose phone, line and words turn 90 degrees clockwise; then the music video itself, made landscape (1920x1080) and
placed turned 90 degrees clockwise so it plays full screen when the phone is turned. The music video is twelve
painted stills, one per bar of the song's hook, each moved in 2.5D (camera move plus depth parallax), cut on the
downbeat with whip pans, zoom-throughs, a flash and dissolves, with petals, dust and twinkling stars, and one shot
of torn-paper lyric strips. Example: "सोचेंगे तुम्हें प्यार" (Deewana, 1992), song 0:47.4-1:15.0, 123 BPM. Original
characters and pictures; the song file is the user's and is not kept here, nor any picture or video.

Cost: 0 Flow credits (pictures only). Real character motion on a few shots is an upgrade: Flow image-to-video
from the same stills (first_frame), about 7 credits a shot with Omni 1.1 Flash (4 s) or 10 with Veo 3.1 Lite (8 s);
both come back at 720p.

## Make it
1. Song: decode, separate the voice (`python3 -m demucs --two-stems=vocals -n htdemucs` on the first two minutes),
   read the words with timings (faster-whisper large-v3-turbo, `word_timestamps=True`, `condition_on_previous_text=False`,
   on the vocal stem; the full mix only gave fragments and invented a YouTube outro), and the beats
   (`librosa.beat.beat_track`). Pick the hook: start the reel ~4.6 s before the first sung word so the intro and the
   card sit on the instrumental lead-in, and end before the next line starts.
2. Storyboard: one shot per bar (4 beats), each picture taken from the words sung over it; in `build_shots.py`
   (`BARS` = the downbeats in song seconds, `SONG0` = where the reel starts). Lyric strips go on a quiet bar.
3. Flow (`generate.json`): `flow_new_project`, the two characters from `characters` with `flow_character describe`
   (free; drawn as paintings so every shot keeps the painted look), then the 13 pictures in one `flow_generate`
   (16:9, `download_quality: upscaled` gives 2752x1536; the laptop is 9:16 with a flat green screen). About 1.5 min a
   picture. Each picture carries a small sparkle mark 113 px from its bottom-right corner; the renderers paint it out.
4. Render, from a work folder `out/`:
   - `python3 build_shots.py <stills_dir> shots.json`
   - `python3 render_mv.py shots.json out/mv.mp4` (depth maps: Depth Anything V2 Small, cached in `out/depth_cache`;
     `--still T file.png` renders one frame for checking)
   - `python3 render_card.py out/card.mp4`
   - `python3 render_intro.py <stills_dir>/scene-13.jpeg out/mv.mp4 out/intro.mp4` (the green screen is found by
     colour, framed like the original: screen 871 px wide, top edge at y 561, tiles centred at y 288)
   - `bash assemble_reel.sh out <song> 47.437 out/reel.mp4` (intro 3.40 s + black 0.10 s + card 1.00 s + the video
     turned clockwise; song faded and normalised to -14 LUFS)
   About 3 minutes on 4 CPU cores.

Fonts (OFL): Poppins Light/Medium for the card and the screen, Noto Sans Devanagari Bold for the lyric strips, Yatra
One for the song tile. `code_scenes/fonts` is not in git; `bash get_fonts.sh` fetches them there from npm.

## Painted people with a local open-source painter (`local_painter/`), the version that matches the reference

The reference reel's people never move: frame by frame, every shot is ONE still painting that stays identical while
the camera drifts, zooms and rolls, with effects composited on top (a breath cloud, floating petals, a phone glow) and
zoom-blur transitions. So the recipe is painted stills + this animator. Here the paintings come from SDXL-Turbo, an
open-source model run on this machine's CPU (bfloat16; about 20 s per option at 896x512, 45 s per 1664x960 refine on
4 Xeon cores with AMX); no Flow, no credits. Licence: sai-nc-community (non-commercial use; commercial use needs
Stability AI's licence).

1. `python3 local_painter/paint.py candidates local_painter/shots.json out/` paints 3 options per shot with a contact
   sheet each (`HF_HUB_OFFLINE=1` if the model is cached). Prompts start with the style ("Digital painting, painterly
   illustration, soft brush strokes, warm storybook colours:"), stay under CLIP's 77 tokens and say "alone" for
   one-person shots (wide frames otherwise often show the person twice). Pick by eye: discard duplicated people,
   broken hands and non-Indian settings. Without the style prefix the model paints photos.
2. `python3 local_painter/paint.py refine local_painter/shots.json out/ hill:12 hillclose:23 heart:33 swing:41
   window:101 daisy:62 bed:71 bed:72:bedcalm eye:81 dream:93 dream:92:dream2 box:116 bazaar:121 found:132
   kterrace:163 nterrace:173 sunset:152` (the picks used for "Sochenge Tumhe Pyar") -> `out/final_<name>.png`.
3. `python3 local_painter/build_painted.py out/ shots_full.json` (its camera targets now follow the v2 paintings below;
   the v1 ones are in this file's git history) (21 shots over 62.26 s: camera targets on the faces,
   night grade for the bedroom and terraces, a cloud heart that forms in the sky, petals / bokeh / stars, lyric strips
   where the words are sung), then `python3 render_mv.py shots_full.json out/mv.mp4` (about 10 min; depth maps
   cached in `REEL_CACHE`).
4. Intro on the code-drawn laptop (`code_drawn/laptop.html`; the model can't paint a flat green screen):
   `python3 render_intro.py laptop.png out/mv.mp4 out/intro.mp4 local_painter/chat.json`, the card, then
   `bash assemble_reel.sh out <song> 47.437 out/reel.mp4` -> 66.8 s, -14 LUFS.

`render_mv.py` options added for this: `flow_mark: false` (no corner-mark repair), per-shot `grade: "night"`,
`overlays: [{kind: "heart", x, y, size, form}]`, the `bokeh` effect, and the camera centre is clamped so a zoom or
roll never shows the picture's edge.

### v2: professional faces and lyrics from the first word (`local_painter/paint_pro.py`)
SDXL-Turbo's faces (eyes, noses, lips) were not clean enough. v2 paints with **DreamShaper XL Lightning**
(`Lykon/dreamshaper-xl-lightning`, an SDXL fine-tune for painterly art; licence openrail++, commercial use allowed) at
1344x768 (DPM++ 2M, 5 steps, CFG 2, a negative prompt against photo / 3D / anime / HDR looks and broken faces; about
55 s a picture on 4 cores), then a **face-detail pass** like ADetailer: the picked painting is enlarged 2x (Lanczos,
2688x1536, so the camera can push in), OpenCV's YuNet finds the faces, and each face area (2.3x the face box) is
repainted at 896-1152 px with img2img (strength 0.42), colour-matched and blended back through a feathered oval
(about 30 s a face). The DPM++ SDE Karras sampler made the paintings over-sharpened and HDR-looking, so it is not used.

1. `python3 local_painter/paint_pro.py candidates local_painter/shots_pro.json out/pro` (2 options per shot and a
   contact sheet; about 35 min for the 17 shots). The prompts begin with the style and say "alone" for one person.
   Each shot names its cast (`faces`: "K", "N", "??" for two people, "" for none) so the face pass knows whom it
   is repainting.
2. Pick one option per shot by eye (discard the ones that show the same person twice; about one shot in four does),
   then `python3 local_painter/paint_pro.py finish local_painter/shots_pro.json out/pro heart:231 heart:232:heart2
   daisy:261 eye:281 box:301 box:302:box2 hill:212 hillclose:221 swing:241 swing:242:swing2 window:251
   window:252:window2 bed:271 bedcalm:274 dream:291 dream2:294 bazaar:312 found:321 kterrace:331 nterrace:342
   sunset:351` (the picks for "Sochenge Tumhe Pyar"; `name:seed:alias` uses a second option as its own shot, so the
   repeat of the antara gets new pictures) -> `out/pro/final_<name>.png`. Faces much smaller than the main one
   (a blurred crowd) are left alone. `python3 local_painter/grid.py out/pro sheet.jpg hill swing ...` shows the
   finals with a 10% grid and the face centres, for the camera targets.
3. `python3 local_painter/build_painted.py out/pro shots_full.json`, check one frame per shot with
   `REEL_CACHE=out/depth_pro python3 render_mv.py shots_full.json out/mv.mp4 --stills 2.96,5.41,... out/stills`, then
   render (use a new depth cache when the paintings change: it is keyed by file name). On 4 cores, 4 parts side by
   side (`--from 0 --to 15.6`, `15.6-31.2`, `31.2-46.8`, `46.8-62.263`, joined with ffmpeg's concat demuxer and
   `-c copy`) take about 6 minutes instead of 15.

Lyrics: `build_painted.py` writes `captions`, one torn-paper strip per sung line from the first word to the end
(word onsets measured on the vocal stem), at the bottom of the frame. Each strip starts in faded ink and every word
darkens as it is sung (a karaoke wipe). `render_mv.py` draws them with `captions: [{t0, t1, words: [[word, t]], x, y,
rot, size}]`.

## Claude-only version, drawn in code (`code_drawn/`)
The same reel with no picture generator at all: every scene is drawn and animated with the 2D canvas (flat
illustrated style), 1:07 long (song 47.4-114.2 s: the hook twice, "ये दिल बेक़रार", "ख़्वाबों में छुपाया तुमको, यादों में
बसाया तुमको", "मिलोगे हमें तुम जानम कहीं ना कहीं", the hook and "ये दिल बेक़रार" again). `core.js` (sky, sun, clouds,
stars, Milky Way, grass, daisies, petals, motes, fireflies, torn-paper strips), `chars.js` (Kabir and Naina: heads in
profile and from the front, hands, small full figures), `scenes.js` (hill and daisy, heart of clouds, swing under the
banyan, window and dandelion, plucked petals, sleepless night under the fan, her eye with him reflected in it, the
dream, the box of photographs, the bazaar, rooftops, the sunset ending), `mv_code.html` (21 shots cut on the
downbeat, transitions: whip, zoom-through, flash, fade, dip; vignette and grain), `laptop.html` (the intro's laptop).
   - `node code_drawn/render_code.cjs code_drawn/mv_code.html out/mv.mp4` (1868 frames, about 6 minutes;
     `--shots` writes one still per shot, `--stills 1,5,9` stills at those times)
   - laptop picture: open `code_drawn/laptop.html` the same way and save `window.png()` (1536x2752, green screen)
   - `python3 render_intro.py out/laptop.png out/mv.mp4 out/intro.mp4 code_drawn/chat.json`, the card, then
     `bash assemble_reel.sh out <song> 47.437 out/reel.mp4` as above.
