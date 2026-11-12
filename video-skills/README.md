# Video skills for Claude Code (code-drawn animation)

This repo's `painted-song-reel` skill (below) plus 39 open-source Claude Code skills that make animated videos and music videos **entirely in code** (no image or video
generator): Claude writes the drawing code, a headless Chrome renders every frame, ffmpeg encodes the MP4.

| skill | look | source |
|---|---|---|
| `anime-cel` | TV-anime: real human rigs (turns, walk/run, hands, 19 expressions), painted skies, sunset palettes | [edenfunf/reelmimic](https://github.com/edenfunf/reelmimic) |
| `painted-animation` | hand-painted watercolour + boiling ink (p5.brush); Clawd-style characters | reelmimic (from [JohnHeibel/ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase)) |
| `paper-cutout` | paper cut-out stop motion: torn edges, shadows, jointed puppets | reelmimic |
| `crayon-storybook` | crayon / coloured-pencil picture book | reelmimic |
| `pixel-art`, `whiteboard`, `motion-graphics`, `music-to-video`, `hyperframes*`, ... | pixel games, doodle explainers, kinetic type, beat-synced lyric videos | reelmimic |
| `video-clone` | give it a reference video: it breaks the style down and routes to the right engine | reelmimic |
| `kinetic-reel` | bold kinetic-typography showreels | [tuzhechen2005/painted-animation](https://github.com/tuzhechen2005/painted-animation) |
| `music-video-reimagined` | remake a music video as a hand-painted Clawd cartoon | [am-will/music-video-reimagined](https://github.com/am-will/music-video-reimagined) |
| `animate` | cut paper, crosshatch ink, riso, sketchbook, pixel, isometric, math | [cth9191/animate](https://github.com/cth9191/animate) |

All MIT. Pinned to the commits reviewed on 2026-11-12 (scripts read for remote-code execution and data leaks: none;
the bundled media tools' telemetry is switched off by the installer with `DO_NOT_TRACK=1`).

## This repo's own skill: `painted-song-reel`
A painted-style animated music-video reel for ANY song (the format of the viral "painted-style music video made with
Claude" reels): "Claude x song" laptop intro, rotate-your-phone card, then a sideways music video of semi-realistic
paintings of original characters moved by the camera (depth parallax, petals / rain / stars, cuts on the downbeat) with
karaoke lyric strips from the first sung word. Story, palette and painting style follow the song's mood and lyrics
(`painted-song-reel/reference/moods.md`). Everything runs locally on CPU with open-source models (DreamShaper XL
Lightning + a face-repair pass, Depth Anything V2, faster-whisper, demucs): no Flow, no credits, about 1.5 hours a reel.
Ask: "make a painted reel for this song" and attach the song. Source: `painted-song-reel/` (SKILL.md, scripts,
reference); first use runs its `scripts/setup.sh` (packages, fonts, about 9 GB of models).

## Make them available

- **This machine / any running session:** `bash video-skills/install-video-skills.sh` (installs into
  `~/.claude/skills`; Claude Code lists them immediately, no restart). In another session without this repo, ask
  Claude to run that script from the AIM-IT4/learning repo (branch `ccr-713d3cac-20zpd5`).
- **Every new cloud session:** paste `video-skills/environment-setup-script.sh` into the environment's settings
  (cloud environment menu in the session title bar -> Edit -> Setup script). It installs these skills,
  painted-song-reel (fetched from this public repo) and flow-mcp.
- Requirements (already in the cloud image): Node 22, ffmpeg, Chrome. Each engine's project gets its npm packages
  when scaffolded: `bash ~/.claude/skills/<engine>/scripts/new_project.sh <dir>`.

## Which one looks most like the painted reel? (tested 2026-11-12, same scene in each)

Test: Naina (pink kameez, dupatta, bindi) and Kabir (denim jacket) on a rooftop at sunset; he holds out a daisy,
she turns, surprised, then a shy smile. Scenes in `tests/`.

| engine | humans | painted look | speed here (4 CPUs, no GPU) | verdict |
|---|---|---|---|---|
| **anime-cel** | **best**: full human rig, real faces and expressions, walk, hands | clean anime cel + painted skies, bloom | **0.17 s/frame** (1 min of video ≈ 4 min) | **use this** for character stories / romance |
| painted-animation | none built in: humans must be drawn from scratch (test figures came out crude) | **best texture**: watercolour washes, paper, ink | 30-70 s/frame (software WebGL, `--soft-gl`) | backgrounds/skies only, or with a GPU |
| paper-cutout | cute puppets (cat, girl) | paper craft | fast | kids' stories |
| crayon-storybook / animate | simple storybook figures | crayon, riso, sketchbook | fast | explainers, kids' stories |

None of them reaches the semi-realistic painted faces of the reference reel (that look comes from an AI image/video
model; anime-cel's own guide says it reads as "a clean digital TV-anime model sheet"). The closest code-only route:
anime-cel characters (with a proper salwar-kameez outfit added to the rig) over painted skies, plus a watercolour
paper finish.

**Update (same day):** the reference reel turned out to be still paintings moved by the camera with added effects
(checked frame by frame). Painted human characters like it are made in
`krishna-short/examples/painted_song_reel/local_painter/` with an open-source painter (SDXL-Turbo) running locally,
plus that folder's still animator: no Flow, no credits.

Notes: the painted engine on a machine without a GPU needs `--soft-gl`, and in `render.mjs` the page-load timeouts
raised to 0 (a first frame takes more than the default 30 s).
