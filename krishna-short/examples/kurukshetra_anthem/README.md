# Kurukshetra Anthem reel (sung AI song + public-domain paintings)

Song: `Kurukshetra_Anthem.mp3` (3:25, 85 BPM), generated from the lyrics in
`../krishna_updesh_song/SUNO_SONG.md`. Not stored in the repo.

## Song map (from bass-energy analysis + Whisper large-v3-turbo transcription)

| time | section | lines |
|---|---|---|
| 0–27.6 s | intro (humming) | |
| 27.6 s | drop 1 | |
| 38.7–48.5 s | chorus | गोविंद हरे, गोपाल हरे… |
| 52.2–74.5 s | verse 1 | रण में जब गांडीव गिरा … किस मुख से मैं विजय मनाऊँ |
| 74.5–84.4 s | pre-chorus | तब मुस्काए चक्रधारी, सुन ले बात हमारी |
| 86.9 s | drop 2 (instrumental until ~119 s) | |
| 119.7–137.8 s | | उठ पार्थ! गांडीव उठा … हट जाएगा मन का बोझ |
| 142.8–152.3 s | chorus (breakdown) | |
| **154.7 s** | **big drop** | |
| 164.8–179.9 s | verse 2 | न कोई अपना … तब-तब मैंने रूप दिखाया |
| 179.9–185.7 s | outro | धर्मक्षेत्रे कुरुक्षेत्रे… जय श्री कृष्ण |

## The reel (137.74 s → 191.54 s, 53.8 s)

```bash
python make_reel.py --images IMGS --music Kurukshetra_Anthem.mp3 --music-start 137.74 --duration 53.8 \
  --drop 16.94 --outro 8.62 --voice-lyrics examples/kurukshetra_anthem/lyrics_climax.txt \
  --words "धर्म,कर्म,सत्य,युद्ध" --words-until 26.8 --sfx-volume 0.3 \
  --end-text "॥ जय श्री कृष्ण ॥" --out kurukshetra_anthem_reel.mp4
```

IMGS: 16 shots (`i01`–`i16`, calm devotional details first, war scenes after) plus `drop.jpg`
(Vishvarupa face) and `outro.jpg` (full Vishvarupa), cut from the three paintings fetched by
`examples/kurukshetra_reel/make_it.sh`.

To transcribe another song: `pip install faster-whisper`, decode with ffmpeg to 16 kHz mono and run
`large-v3-turbo` with `vad_filter=False` (the voice filter discards singing as music).

## Cinematic version (AI artwork + 3D parallax)

```bash
python make_art.py generate --shots examples/kurukshetra_anthem/art_shots.tsv --out cand     # 54 images, ~16 min on 4 CPUs
python make_art.py refine --shots examples/kurukshetra_anthem/art_shots.tsv --cand cand --out final \
  i01=33 i02=22 i03=33 i04=22 i05=33 i06=22 drop=22 i07=33 i08=22 i09=22 i10=33 i11=11 i12=22 i13=11 \
  i14=11 i15=11 i16=11 outro=11
python make_reel.py --images final --parallax --music Kurukshetra_Anthem.mp3 --music-start 137.74 --duration 53.8 \
  --drop 16.94 --outro 8.62 --voice-lyrics examples/kurukshetra_anthem/lyrics_climax.txt \
  --words "धर्म,कर्म,सत्य,युद्ध" --words-until 26.8 --sfx-volume 0.3 --end-text "॥ जय श्री कृष्ण ॥" \
  --out kurukshetra_anthem_cinematic.mp4                                                       # ~6.5 min
```

Artwork: SDXL-Turbo (Stability AI Community License; outputs belong to you). Depth: Depth Anything V2 Small (Apache-2.0).
