# Mahadev rap reel (AI song + AI artwork + 3D parallax)

Song: Mahadev rap (Soundverse), 2:59, 115 BPM. Not stored in the repo.

## Song map
| time | section |
|---|---|
| 0–28 s | intro chants |
| 30–72 s | rap verse ("शंख बजा… हर हर महादेव, जय जय महाकाल… डर को डर लगता है…") |
| 74–93 s | chorus 1 |
| 95–123 s | verse 2 |
| 125–141 s | chorus 2 ("हर हर महादेव, गर्जे आसमान… जब तांडव शुरू हो, थम जाए सारा जहान… मेरी यही पहचान") |
| **142.6 s** | **biggest drop**, full instrumental to the end |

## Reel: 121.71 s → 178.9 s (57.2 s)

```bash
python make_art.py generate --shots examples/mahadev_reel/art_shots.tsv --out cand            # + --seeds 44,55,66 for re-dos
python make_art.py refine --shots examples/mahadev_reel/art_shots.tsv --cand cand --out refined \
  m01=11 m03=33 m04=22 m05=66 m06=22 m07=55 m08=33 m09=22 m10=22 m11=11 m12=33 m13=11 m14=22 \
  m16=33 m17=11 m18=11 m19=22 m20=22 drop=22 outro=11          # drop_s22 = copy of m12_s22 (Nataraja in fire)
# final/: a01..a10 = m20 m03 m07 m04 m08 m06 m10 m05 m19 m09 (build-up), b01..b08 = m11 m18 m14 m13 m16 m17 m01 m12
python make_reel.py --images final --parallax --music mahadev.mp3 --music-start 121.71 --duration 57.2 \
  --drop 20.86 --outro 4.52 --intro-fx beat --cut-every 2,2,1 \
  --voice-lyrics examples/mahadev_reel/lyrics_reel.txt \
  --words "महादेव,महाकाल,शंभो,रुद्र,तांडव,भोले" --word-every 3 --sfx-volume 0.3 \
  --end-text "॥ हर हर महादेव ॥" --out mahadev_reel.mp4
```

Notes: SDXL-Turbo cannot draw a damaru (it makes an hourglass), so damaru shots were dropped.
The opening shot matters most on Instagram: start on a face, not a landscape.
