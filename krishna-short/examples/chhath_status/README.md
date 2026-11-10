# Chhath Puja WhatsApp status (60 s, 1080×1920)

A calm festival status: Madhubani paintings and photo-real Bihar ghats (Patna, Darbhanga,
Muzaffarpur, Kosi) cut on the bars of the song, with sun rays, floating embers, a Madhubani
border, and Hindi greetings and place names.

Opening (0–11.5 s, before the singing starts): the night after Diwali, "दीवाली बीत गई… अब हर
बिहारी को इंतज़ार है…", then a flash to the Madhubani sun with "छठ महापर्व – लोक आस्था का चार
दिवसीय महापर्व" and the 2026 dates sliding in one by one (13 नवंबर नहाय-खाय, 14 खरना,
15 संध्या अर्घ्य, 16 उषा अर्घ्य). Change the `Row` captions in `storyboard.json` for another year.

Song: "Jode Jode Phalwa" (Chhath geet, 124.95 BPM). Only use a song you have permission to use.
The song is **not** stored in this repo.

## Song map (seconds in the song)
| song time | video time | what |
|---|---|---|
| 17.98 | 0.0 | window starts on a beat (bar = 1.921 s) |
| ~30.0 | ~12.0 | first sung line |
| ~37.8 | ~19.8 | hook "जोड़े जोड़े फलवा" |
| ~49.6 / ~59.4 | ~31.6 / ~41.4 | "जल बीच खाड़ा" |
| ~70 | ~52 | instrumental interlude → calm ending |
| 77.98 | 60.0 | end (2.5 s fade-out) |

## Make it

```bash
# 1. artwork (SDXL-Turbo on CPU, ~16 s per candidate)
python make_art.py generate --shots examples/chhath_status/art_shots.tsv --out cand --seeds 11,22
python make_art.py refine --shots examples/chhath_status/art_shots.tsv --cand cand --out refined \
  md_surya=22 sun_river=22 patna_ghat=22 patna_sil=22 soop_close=22 md_offering=22 darbhanga_wall=11 \
  darbhanga_pond=11 md_arghya=22 muz_litchi=11 muz_ghat=11 kosi_night=11 patna_night=11 diyas_water=22 \
  sunrise_arghya=11 md_ghat=11
# optional: 2x upscale of refined/ into final/ (RealESRGAN x2), otherwise use refined/ directly

# 2. the video (parallax + compositing, ~15-25 min on 4 CPU cores the first time)
ffmpeg -i song.opus -ar 48000 song.wav
python make_festival.py examples/chhath_status/storyboard.json --images final --music song.wav \
  --fonts fonts_dir --work work --out chhath_status.mp4

# 3. WhatsApp copy (status limit 16 MB): 2-pass x264 at ~1.8 Mbit/s
ffmpeg -y -i chhath_status.mp4 -c:v libx264 -preset slow -b:v 1800k -pass 1 -an -f null /dev/null
ffmpeg -y -i chhath_status.mp4 -c:v libx264 -preset slow -b:v 1800k -pass 2 -c:a aac -b:a 128k \
  -movflags +faststart chhath_status_whatsapp.mp4
```

`fonts_dir` needs Yatra One, Tiro Devanagari Hindi and Noto Sans Devanagari (Google Fonts, OFL).

## storyboard.json
* `start` / `duration` – the window in the song; `bpm` and `beat0` put every cut on a bar line.
* `shots` – `img`, `bars` (length in bars), `fx` (xfade transition into the shot), `move`
  (camera: in / out / up / down), `parallax: true` for photos (2.5D depth move), `kind`
  (`beat` = small zoom punch on the cut, `outro` = darker, softer shot so the end text reads).
  The last shot always runs to the end of the video.
* `rays` / `frame` – time spans for the sun rays and the Madhubani border.
* `captions` – `t`, `end`, `style` (Pre, PreSub, Title, TitleSub, Days, Loc, Ritual, Hook, End, EndSub) and
  `text`; `pos` = [x, y] places a caption's centre (it drifts up into place). `Banner` draws a
  soft maroon panel (`box` = x, y, w, h; `alpha` 00 solid … FF clear, default 38) behind a block of text; `Row` is a schedule line
  (`y`, `date`, `text`, optional `x` = [date x, name x]) that slides in from the left.

WhatsApp covers the top ~200 px and bottom ~250 px of a status with its own buttons, so all
text stays between those.

## Real-photo version with a Hindi voiceover (`storyboard_real.json`)

Same song cut, cuts and captions, but every picture is a real, freely licensed photo from Wikimedia
Commons (Patna Gandhi Ghat, Darbhanga Raj, the Mithila painting at Darbhanga Junction, Chaudhary
Pokhar ghat in Madhubani, Muzaffarpur lychee gardens and a village ghat, Bhagalpur's Barani ghat, kosi,
arghya ...), and an AI Hindi male voice speaks the opening while the song dips under it.

```bash
python commons_catalog.py --out catalog.json --thumbs thumbs "Category:Chhath in Bihar" "search:Chhath ghat" \
  "search:Chhath arghya" "search:Diwali diya"
python commons_catalog.py --out catalog2.json --thumbs thumbs2 "search:Gandhi Ghat Patna" "search:Darbhanga Raj" \
  "search:Muzaffarpur" "search:Mithila painting"
python commons_fetch.py catalog.json --out media --max-width 1920 340 3 10 4 67 48 71 32 291 35 7 13 31 332 46 70
python commons_fetch.py catalog2.json --out media --max-width 1920 9 13 37 352 93 94
printf "दीवाली बीत गई…\nअब हर बिहारी को इंतज़ार है…\nलोक आस्था के महापर्व, छठ का!\n" > vo.txt
python make_voiceover.py --text vo.txt --voice rohan --lead 0.3 --gap 0.3 --tail 0.6 --out-audio voice.wav --out-lyrics vo.txt.times
python make_festival.py examples/chhath_status/storyboard_real.json --images media --music song.wav --voice voice.wav \
  --fonts fonts_dir --out chhath_status_real.mp4
```

Catalogue numbers depend on what Commons returns on the day; check the previews and `media/CREDITS.txt`.
Most photos are CC BY-SA: the last seconds carry a small credit line; paste `media/CREDITS.txt` into the post.
Commons may answer "429 too many requests" for original files from shared cloud servers; its resized copies
(`--max-width 1920`) usually still come through.
