# Krishna Ki Chetavani–style Shorts

A small tool that turns **your own images + your own voice/music + lyric timings** into a
1080×1920 YouTube Short / Instagram Reel in the "epic devotional" style of edits like
*Krishna Ki Chetavani (Rashmirathi)*.

```bash
pip install numpy pillow piper-tts   # ffmpeg must also be installed
python make_demo_assets.py           # placeholder images, test beat, sample poem in ./demo

# AI Hindi voiceover + automatic lyric timings
python make_voiceover.py --text demo/poem.txt --voice rohan \
    --out-audio demo/voice.wav --out-lyrics demo/voice_lyrics.txt

python make_short.py --images demo/images --audio demo/voice.wav --music demo/audio.wav \
    --lyrics demo/voice_lyrics.txt --title "कृष्ण की चेतावनी" --out demo_short.mp4
```

## Voiceover: two ways

**A. AI voice (quick draft)** – `make_voiceover.py` uses [Piper](https://github.com/OHF-Voice/piper1-gpl),
a free offline text-to-speech engine with Hindi voices (`rohan`, `pratham` male, `priyamvada` female;
downloaded once into `./voices`). Write the poem one line per line in `poem.txt`:

```
हरि ने भीषण हुंकार किया,
अपना स्वरूप-विस्तार किया,

!हाँ, हाँ दुर्योधन! बाँध मुझे।
```

A blank line adds a longer pause; `!` marks a dramatic line (slower, louder, pause before it).
The script speaks every line, adds the "epic" effect (slightly deeper pitch, warmth, compression,
hall echo), and writes `lyrics.txt` with exact start times, so you do not have to time anything.
Options: `--speed 0.9` (slower), `--gap`, `--stanza-gap`, `--lead`, `--effect none`.

**B. Your own recitation (best result)** – record yourself, then time the lines by hand (step 5 below).
AI voices read clearly but cannot match a human's rage, pauses and build-up in this poem.

## What the script does (the "look")

| Element | How it is done |
|---|---|
| Format | 1080×1920, 30 fps, H.264 + AAC, ready to upload |
| Cuts | A new image on **every lyric line**, hard cut with a 0.13 s white "impact" flash |
| Motion | Slow Ken Burns on every image, cycling zoom-in → zoom-out → pan-up → pan-down |
| Grade | More contrast and saturation, cool shadows / warm highlights, dark vignette |
| Embers | Rising fire sparks layered on top (screen blend), loops seamlessly |
| Captions | Devanagari verse in *Tiro Devanagari Hindi* with an orange glow and a small "pop" in; title card in gold |
| Audio | Your voice track; optional background music that automatically **ducks** under the voice |

Fonts are downloaded once from Google Fonts into `./fonts` (SIL Open Font License).

## Song-style reel: rhyming lyrics on composed music

`make_music.py` composes an original devotional/epic track (tanpura, bansuri melody, strings,
choir, temple bells, shankh call, bass, dhol/taiko) with intro → verse → conch call → DROP → outro,
and prints the bar times. `make_voiceover.py --bpm` then puts **one lyric line on each bar**, so
the recitation rides the music. A line `~` is a bar of rest. Full recipe with original rhyming
lyrics: `examples/krishna_updesh_song/make_it.sh`.

The AI voice recites rhythmically but cannot *sing* a melody. For a sung version, sing
`poem.txt` yourself over `music.wav` (record on your phone with headphones on) and pass that
recording as `--voice`; everything else stays the same.

## Transition reel for Instagram (`make_reel.py`)

A beat-synced edit: calm intro with a voice hook, then a **drop** where the edit explodes into
fast cuts on the beat.

```bash
python fetch_commons_images.py --out reel_images        # public-domain Gita / Kurukshetra paintings + CREDITS.txt
python make_beat.py --bpm 100 --out beat.wav            # original war-drums track (or use your own song)
printf "यदा यदा हि धर्मस्य, ग्लानिर्भवति भारत।\n!अभ्युत्थानमधर्मस्य, तदात्मानं सृजाम्यहम्॥\n" > shloka.txt
python make_voiceover.py --text shloka.txt --lead 1.0 --tail 0.5 --out-audio voice.wav --out-lyrics voice_lyrics.txt
python make_reel.py --images reel_images --music beat.wav --voice voice.wav --voice-lyrics voice_lyrics.txt \
    --words "धर्म,कर्म,सत्य,युद्ध" --end-text "धर्मक्षेत्रे कुरुक्षेत्रे" --end-sub "श्रीमद्भगवद्गीता ४.७" \
    --out reel.mp4
```

What it does automatically:

* **Finds tempo, beats and the drop** in the music (tested on 85, 100 and 128 BPM: tempo within
  0.1 BPM, beats within ~10 ms, drop on the right beat). Override with `--bpm` / `--drop`.
* **Intro** – one shot per bar, soft `hblur` / `dissolve` transitions, voice captions.
  Keep the voice shorter than the intro so the last word lands on the drop.
* **Drop** – white flash, big zoom punch, camera shake.
* **After the drop** – cuts every 2 beats, then every beat (`--cut-every 2,1`), rotating through
  12 transitions (zoom-in, whip slides, squeeze, circle, radial, pixelize ...), each with a zoom
  punch, RGB-split glitch and a whoosh sound; big words from `--words` pop on every 2nd cut.
* **Outro** – the last 3 s (`--outro`) hold on one darkened shot with the end-card text.
* Landscape paintings sit on a blurred copy of themselves, so nothing important is cropped.
* Writes `reel.cover.jpg` (a frame just after the drop) to use as the Reel cover.

### Using a real song (e.g. "Kurukshetra Hai")

Commercial songs are copyrighted, so don't bake them into the file. Instead:

1. Get the song audio for **cutting only** (e.g. a clip from your phone) and run
   `make_reel.py --music song.mp3 --music-start 42 --duration 25 --no-music-in-output ...`
   – the edit is cut to that song's beats, but the file has only the voice and whooshes.
2. In Instagram: upload the reel → **Add audio** → search the song → choose the **same start
   time** (42 s in this example) → lower the original-audio volume if needed.

Instagram licenses its music library, so the song plays legally and the cuts line up.

## Making your own Short – step by step

1. **Pick 30–60 seconds.** Start on the strongest line so the first 2 seconds hook people
   (e.g. *"हाँ, हाँ दुर्योधन! बाँध मुझे"* or *"जब नाश मनुज पर छाता है"*). Shorts can be up to 3 min,
   but 45–60 s works best.
2. **Record the voice.** Phone in a quiet room with blankets/clothes around is fine. Recite
   slowly with **pauses before the big lines**, then hit them hard. Keep 0.5 s of silence at the start.
3. **Music (optional).** Use royalty-free epic/drone/dhol tracks (YouTube Audio Library, Pixabay
   Music) or make your own. Pass it with `--music`; it is ducked automatically under the voice.
4. **Images.** About one image per line. Vishwaroop, Kurukshetra, Krishna's anger, the chakra,
   Duryodhan's court, fire and cosmos fit this poem. Use your own art, AI-generated art you have rights
   to, or licensed stock. Portrait images (9:16) look best; others are cropped to fill.
   Name them `01.jpg`, `02.jpg` … in the order you want.
5. **Time the lyrics.** Open your voice file in Audacity (or any player that shows time), note when
   each line starts and write `lyrics.txt`:
   ```
   0:00.6 | हरि ने भीषण हुंकार किया,
   0:03.1 | अपना स्वरूप-विस्तार किया,
   ```
   Each caption stays until the next line starts. The image also changes at each line.
6. **Render.**
   ```bash
   python make_short.py --images my_images --audio my_voice.mp3 --music epic.mp3 \
       --lyrics lyrics.txt --title "कृष्ण की चेतावनी" --duration 60 --out krishna_short.mp4
   ```
7. **Upload.** Add a title with the hook line, `#Shorts #Rashmirathi #Krishna #Dinkar`, and credit
   *Ramdhari Singh Dinkar – Rashmirathi* in the description.

### Options

| Flag | Meaning |
|---|---|
| `--music FILE` | background music, ducked under `--audio` |
| `--music-volume 0.35` | music level before ducking |
| `--audio-start SEC` | skip the first SEC seconds of the audio (lyric times are counted after this) |
| `--duration SEC` | output length (default: length of `--audio`, max 180 s) |
| `--title TEXT` | gold title card for the first 3.5 s (leave out for none) |
| `--no-embers` / `--no-flash` | turn off the ember layer / white flash on cuts |

## Copyright – please read

* **Do not reuse audio or video from someone else's upload** (e.g. Agam Aggarwal's song or its
  thumbnail art). YouTube's Content ID will block or claim the Short. Use your own voice, your own or
  royalty-free music, and images you have rights to.
* *Rashmirathi* is by **Ramdhari Singh Dinkar** (died 1974). In India the text stays under copyright
  until the end of 2034, so it is not public domain yet. Reciting it with credit is very common, but
  monetised use is technically at the rights holders' discretion.
* The sample lyrics in `make_demo_assets.py` are one short stanza, quoted only to test timings.

## Notes

* Captions use ffmpeg's `ass` filter with `shaping=complex` (HarfBuzz). Without it Hindi matras
  such as ि are drawn after the consonant instead of before it. Keep letter spacing at 0 in the
  styles for the same reason.
* A 20 s demo takes about 1 minute to render on a normal laptop CPU.
