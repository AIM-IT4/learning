# Sung version – paste into Suno (suno.com → Create → Custom)

## Style of Music (paste this)

```
epic indian devotional, cinematic, powerful deep male hindi vocal, bansuri flute, tanpura drone,
orchestral strings, choir, conch shell, dhol and taiko war drums, slow tense intro, huge drop,
anthem chorus, 90 bpm, d minor
```

## Title

```
उठ पार्थ – Krishna Updesh
```

## Lyrics (paste this exactly – the [tags] tell Suno how to arrange each part)

```
[Intro: soft flute, tanpura, choir humming]
गोविंद हरे, गोपाल हरे,
जय जय प्रभु दीनदयाल हरे।

[Verse 1: low, slow, emotional]
रण में जब गांडीव गिरा,
पार्थ का मन भय से घिरा।
अपनों पर कैसे बाण चलाऊँ,
किस मुख से मैं विजय मनाऊँ?

[Pre-Chorus: drums building, conch shell]
तब मुस्काए चक्रधारी,
बोले, सुन ले बात हमारी।

[Drop: full power, war drums, shouted]
उठ पार्थ! गांडीव उठा,
सोया पौरुष आज जगा।
कर्म किए जा, फल मत सोच,
हट जाएगा मन का बोझ।

[Chorus: anthem, choir]
गोविंद हरे, गोपाल हरे,
जय जय प्रभु दीनदयाल हरे।

[Verse 2: epic, intense]
न कोई अपना, न पराया,
सब है मेरी ही माया।
जब-जब धर्म पे संकट आया,
तब-तब मैंने रूप दिखाया!

[Outro: conch shell, choir, slow]
धर्मक्षेत्रे कुरुक्षेत्रे…
जय श्री कृष्ण!
```

Lyrics are original (the "गोविंद हरे, गोपाल हरे" chant is a traditional bhajan line).

## Tips

* Generate 4–6 versions and keep the one whose voice and drop hit hardest.
* Check Suno's licence for your plan before posting – free-plan songs may not be allowed for
  commercial use; paid plans give you ownership of the output.
* Download the MP3, upload it to Google Drive (or share it here), then build the reel on it:

```bash
python make_reel.py --images examples/krishna_updesh_song/build/imgs --music suno_song.mp3 \
    --duration 60 --end-text "धर्मक्षेत्रे कुरुक्षेत्रे" --end-sub "॥ जय श्री कृष्ण ॥" --out reel.mp4
```

`make_reel.py` finds the song's tempo, beats and drop by itself, so the cuts land on the music.
