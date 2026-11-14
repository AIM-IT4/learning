# Instagram architecture reel

A 57-second vertical (1080×1920) explainer reel: tap → CDN edge → load
balancer → Django → Postgres / Cassandra / Memcached → blob storage → ML
ranking. It is built as a web page, then rendered to MP4 frame by frame.

Everything on screen is a pure function of one clock, the voiceover's playback
time. That keeps voice, captions and animation in sync in the browser, and
lets the renderer draw exact frames instead of screen-recording.

| File | What it does |
| --- | --- |
| `ig-reel.template.html` | The reel: scenes, captions, animation engine. Narration lives in the `VO` list |
| `build.py` | Builds the page; with `--voice`, embeds the audio and times every scene to it |
| `render_reel.js` | Renders the page to 30fps 1080×1920 JPEG frames (Playwright) |

## Make the reel

You need Python 3, Node.js with Playwright (`npm i playwright && npx playwright install chromium`),
and ffmpeg.

```bash
# 1. Get the exact narration text and record it (e.g. ElevenLabs, voice "Pradeep").
python build.py --print-script

# 2. Build the page with the voice. Scenes snap to the voice's real sentence pauses.
python build.py --voice voice.mp3          # writes build/ig-reel.html

# 3. Render frames, then encode the MP4 with the voice.
node render_reel.js "$PWD/build/ig-reel.html" frames 30
ffmpeg -framerate 30 -i frames/f%05d.jpg -i voice.mp3 -map 0:v -map 1:a \
       -c:v libx264 -crf 19 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart reel.mp4
```

Without `--voice` you get estimated timings, and the page's 🔇 button reads the
captions with the device's built-in voice instead.

## Change it

- **Words:** edit the `VO` list in the template. `|` marks a caption change and
  `*word*` highlights a word. The voice reads it without either mark. Re-record
  the voice after changing words.
- **Things that react to a word:** add `data-cue="word"` to an element and it
  animates when the narration reaches that word (the database cylinders and ML
  cards use this).
- **Safe zone:** captions sit at about 72% of the height, clear of the bottom
  ~18% where Instagram overlays its own buttons and caption.
