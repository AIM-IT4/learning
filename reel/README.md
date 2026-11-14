# Instagram architecture reel

A 57-second vertical (1080×1920) explainer reel: tap → CDN edge → load
balancer → Django → Postgres / Cassandra / Memcached → blob storage → ML
ranking. It is built as a web page, then rendered to MP4 frame by frame.

Everything on screen is a pure function of one clock, the voiceover's playback
time. That keeps voice, captions and animation in sync in the browser, and
lets the renderer draw exact frames instead of screen-recording.

| File | What it does |
| --- | --- |
| `ig-reel.template.html` | The reel: scenes, captions, animated background, animation engine. Narration lives in the `VO` list |
| `build.py` | Builds the page; with `--voice`, times every scene to the voice's pauses and embeds the audio |
| `mix.py` | Original background music + whoosh/impact effects, ducked under the voice, at -14 LUFS |
| `tts_standin.py` | A stand-in voiceover from an open-source neural voice (Kokoro), when ElevenLabs isn't available |
| `render_reel.js` | Renders the page to 30fps 1080×1920 JPEG frames (Playwright) |

## Make the reel

You need Python 3 with `numpy scipy`, Node.js with Playwright
(`npm i playwright && npx playwright install chromium`), and ffmpeg.

```bash
# 1. The voice. Either record the exact narration (e.g. ElevenLabs, voice "Pradeep"):
python build.py --print-script            # the text to paste into ElevenLabs; save as build/voice.mp3
#    ...or make a stand-in locally (pip install kokoro-onnx; model files: see tts_standin.py):
python tts_standin.py --model kokoro-v1.0.onnx --voices voices-v1.0.bin --out build/voice.mp3

# 2. Time the reel to the voice (writes build/timing.json).
python build.py --voice build/voice.mp3

# 3. Music + effects, mixed with the voice (writes build/music.wav, mix.wav, mix.mp3).
python mix.py --voice build/voice.mp3 --timing build/timing.json --out-dir build

# 4. The page with voice + music embedded, then frames, then the MP4.
python build.py --voice build/voice.mp3 --audio build/mix.mp3      # writes build/ig-reel.html
node render_reel.js "$PWD/build/ig-reel.html" frames 30
ffmpeg -framerate 30 -i frames/f%05d.jpg -i build/mix.wav -map 0:v -map 1:a -shortest \
       -c:v libx264 -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart reel.mp4
```

Without `--voice` you get estimated timings, and the page's 🔇 button reads the
captions with the device's built-in voice instead.

**The music** is synthesised from scratch in `mix.py` (no samples, no licences
needed): Am7–Fmaj7–C–G at 104 BPM. It starts calm, drums come in at step 1,
claps and an arpeggio at step 3, every scene change gets a whoosh and an impact,
and the end card gets a big hit. While the voice speaks the music drops about
17 dB, and it rises in the pauses. Change `BPM`, `PROGRESSION` or `LEVELS_DB` to
restyle it.

## Change it

- **Words:** edit the `VO` list in the template. `|` marks a caption change and
  `*word*` highlights a word. The voice reads it without either mark. Re-record
  the voice after changing words.
- **Things that react to a word:** add `data-cue="word"` to an element and it
  animates when the narration reaches that word (the database cylinders and ML
  cards use this).
- **Safe zone:** captions sit at about 72% of the height, clear of the bottom
  ~18% where Instagram overlays its own buttons and caption.
