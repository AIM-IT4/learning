# Painted song reel ("Claude x song", rotate your phone)

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
