# Krishna Ki Chetavani–style Shorts

A small tool that turns **your own images + your own voice/music + lyric timings** into a
1080×1920 YouTube Short / Instagram Reel in the "epic devotional" style of edits like
*Krishna Ki Chetavani (Rashmirathi)*.

```bash
pip install numpy pillow          # ffmpeg must also be installed
python make_demo_assets.py        # optional: placeholder images, test beat, sample lyrics in ./demo
python make_short.py --images demo/images --audio demo/audio.wav --lyrics demo/lyrics.txt \
    --title "कृष्ण की चेतावनी" --out demo_short.mp4
```

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
