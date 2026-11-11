# चुप्पी का गुनाह (The Sin of Silence): two-voice story film

A 1:56 vertical (1080x1920) Hindi short. Banaras, 1975: Aditya, a poor young poet renting the rooftop room of an old
haveli, and Gauri, the daughter of the house who plays the sitar, love each other and never say it. A rich doctor's
proposal comes for her; she goes to his door one night waiting for one word, "रुको"; he stays silent and leaves for
Calcutta at dawn. Forty years later he comes back to the same ghat. An original story written in the spirit of
Dharamvir Bharati's *Gunahon Ka Devta* (pure unspoken love, sacrifice, regret); not an adaptation, since the novel is
still under copyright.

The two narrators alternate, each remembering the same moments: Gauri = Gemini 2.5 Pro TTS **Sulafat**, Aditya =
**Charon**. Pictures: 15 Google Flow clips (Veo 3.1 Lite, 9:16, 8 s, 10 credits each = 150) driven through flow-mcp.
No clips, audio or video are kept in this repo.

## Make it
1. Flow project "Chuppi Ka Gunah" (`flow_new_project`), then the two characters drawn from descriptions (free):
   `flow_character` Aditya and Gauri (the descriptions are the CHARACTER LOCK text in `generate.json`). The first
   character upload in a project can stop at Flow's "Rights to use this image" notice; it needs "I agree" once.
   Veo 3.1 Lite takes character references (Ingredients): test one shot first, it held both faces in every clip.
2. Clips: `flow_generate` with `generate.json` (shots 3-15 can go in one call after testing 1-2; numbering continues).
   Shots 12-15 show the old couple from behind, as hands, or the woman's face without a reference.
3. Voices: every line is its own take (`lines.json`: `text` is what is spoken, numbers spelled out; `sub` is the
   subtitle). Two candidates each; direction: Aditya "an old man remembering his youth and his lost love: warm, slow,
   soft, quiet regret", Gauri "a woman remembering an old love: soft, tender, slightly hushed". Speech-check with
   `code_scenes/voice/check_takes.py lines.json takes`; `picks.json` holds the takes used (L01 c1: the other take said
   "लव" for "लफ़्ज़").
4. Music: Kevin MacLeod, "Sad Trio" (incompetech.com, CC BY 4.0; not kept here), steady under the whole film:
   22 dB under the voices while they speak, 12 dB under in the pauses, 10 dB under over the end card; credited on the
   end card.
5. Assemble: `python3 assemble.py <clips_dir> lines.json <takes_dir> picks.json <music.mp3> <out>`: 0.5 s dissolves,
   each speaker levelled to -16 LUFS, lines placed on their shots (Gauri's "मैंने बस इतना कहा…" opens 1.6 s before its
   cut so the last line ends before the end card), subtitles in two colours (Gauri rose-pink, Aditya cream), title over
   the opening, the night shots Flow lit like day graded in the edit (shot 5 lamplight, shots 7-8 night), end card held
   ~4 s after the last word, loudnorm -14 LUFS. Prints a WhatsApp split inside a pause.
6. Export: `bash export.sh <out> <split>` (HQ + two WhatsApp parts under 60 s / 16 MB).

`../../flow/flow-mcp-setup.sh` installs flow-mcp in a cloud session (paste it into the environment's setup script).
