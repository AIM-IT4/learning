---
name: reelmimic
description: ReelMimic in Claude Code. Show it a video you love (an Instagram reel, a YouTube or TikTok link, a file or a phone screen recording) plus a one-line brief, and it makes a NEW video in the same style entirely in code. It measures the reference (shots, pacing, BPM, transitions, colours, camera moves, the climax), picks the matching 2D engine (anime cel, watercolour, crayon picture book, pixel art, paper cut-out, whiteboard, vector motion graphics), and shows a plan for approval. Then it builds the video with parallel builders and fresh-eyes reviewers until every shot holds up beside the reference. Use when the user says "reelmimic", "make one like this reel", "same style as this video", "copy this reel's style", or sends a reel or video link to learn the style from.
---

# ReelMimic, run inside the chat

Source: [edenfunf/reelmimic](https://github.com/edenfunf/reelmimic) (MIT), pinned at `0eab75a`. Its core skill
`video-clone` and its engine skills (`anime-cel`, `painted-animation`, `crayon-storybook`, `pixel-art`, `paper-cutout`,
`whiteboard`, HyperFrames for vector) are installed in `~/.claude/skills/`. The original runs as a local web app whose
server sends each step to a separate agent. This skill runs the same workflow in the chat: this conversation is the
director, and the Agent tool provides the builders and reviewers. The app's hooks and web UI are not installed (see the
end of this file).

## 0. Always

- **Load `/video-clone` first** and follow `~/.claude/skills/video-clone/SKILL.md` (workflow, style routing, engine
  hand-off) and `CONTRACT.md` (file names and fields). This file only adds what the app's server enforces.
- **Project folder:** one folder per video, `~/Films/<short-name>/` unless the user names another. Inside it, use the
  contract's layout (`analysis/`, `plan.json`, `STORYBOARD.md`, `assets/`, `build/`, `out/check/`,
  `out/video.mp4`). Projects hold the reference and renders: never commit them.
- **Ground rules:**
  - Learn the technique only (pacing, framing, transitions, how the jokes land). Never reuse the reference's footage,
    characters, logos or assets.
  - Characters are original, unless they are the user's own designs (then the design is the spec) or ones the user
    names.
  - Log every outside asset with its source, author and licence in `assets/ASSETS.md`. Flag unclear licences to the
    user.
  - Lyrics come only from text the user gives. Never download commercial songs.
  - No real people and no live action. 2D only: recreate a 3D reference in 2D and say so.
- **Secrets:** API keys go in `~/.reelmimic/secrets.json`, filled in by the user. Never write or print that file; check
  it exists with `test -f`.

## 1. Intake: one short message

What the user gives: the reference, a one-line brief, and optionally their own audio, lyrics, character designs or
product photos.

Defaults when the user doesn't say:
- Length: 30 s.
- Format: 9:16 at 1080x1920 when the reference is a reel, Short or TikTok; 16:9 otherwise.
- Ask only what changes the film (the topic, whose characters). Everything else gets a sensible default and is listed
  at the plan gate.

**Getting the reference:**
- **A file or screen recording:** use it as is. `analyze.py` crops a phone's UI and black bars on its own.
- **A YouTube or other link:** `analyze.py` downloads it with yt-dlp, only to study the style.
- **Instagram:** yt-dlp is often refused (login wall, HTTP 429).
  - Never work around a login, bot check or rate limit.
  - For a single public reel, the public embed page (`https://www.instagram.com/reel/<id>/embed/captioned/`) usually
    carries the video URL and the caption: fetch it once.
  - If that needs a login too, ask the user for the file. A phone screen recording works.

## 2. Break down the reference (video-clone §1)

```bash
python3 ~/.claude/skills/video-clone/scripts/analyze.py "<file or url>" --out <project>/analysis
```

1. Read `sheet_1fps.jpg` and `sheet_scenes.jpg` yourself, together with `report.json`.
2. Write `analysis/STYLE.md`. The medium goes on the first line; the shot table comes from `shot_details`.
3. Find the climax with `clip_strip.py` (12 fps strips) and write `analysis/peaks.json`.

Report to the user in one message:
- a table (shots, mean shot length, BPM, cuts on the beat, palette, camera moves, text use)
- 3–5 keys to why it works
- where the climax is and what it relies on

## 3. Pick the style and engine (video-clone §2)

Match `STYLE.md` against `~/.claude/skills/video-clone/styles/*.md`, using the medium first and then the identifying
features. Write `analysis/route.json`, load the engine skill, and tell the user which style, which engine and why.

When no style fits, use the closest engine and write a new style file from `_TEMPLATE.md` after delivery.

## 4. The plan, then the user's approval: nothing is produced before it

Write `plan.json` and `STORYBOARD.md` as the contract describes:
- **Each shot maps to a reference shot:** `ref_shot`, `ref_what`, and a concrete `camera` spec (move, speed, fill,
  region). The mean shot length and text-card share stay within ±30% of the reference. Check the cut rate with
  `fingerprint.py plan-check`.
- **Climaxes first:** `peaks` with build-up, held breath, the hit on the beat, and the hold. Hero shots are marked.
- **Required inputs:** `required_inputs` lists only what the user alone can give (lyrics text, their own character
  designs, product photos, a logo, a voice).
- **Style frames:** 2–4 of them, led by `out/check/key_<n>_vs_ref.jpg`, the climax frame at final quality beside the
  reference's. If ours is weaker, keep working before showing it.

Show the storyboard and style frames big (SendUserFile, `display: "render"`). Then ask one question: approve, or a
note, or a swap. In the same call, ask the **quality mode**:

| mode | review rounds: cast / shots / final | what blocks | measured time for 30 s |
|---|---|---|---|
| fast | 2 / 2 / 1 | only what a viewer sees at once: a broken character, black or flash frames, an unreadable caption, a missing climax | ~80 min |
| standard | 2 / 3 / 2 | one-frame pose changes in hero shots; anything visible at normal speed | between the two |
| fine (the app's default) | 3 / 3 / 2 | every pose change checked frame by frame; each climax must beat the reference | ~170–220 min |

## 5. The production line, after approval

This chat is the director. The Agent tool provides the builders and reviewers. **Reviewers are always fresh agents.**
Give a reviewer the file paths, the checklist below and the plan, never your own verdict. A reviewer that didn't build
the work has nothing to defend.

1. **Director setup:**
   - Build the shared assets, one definition file per character, and the character sheets (front view, 8+
     expressions, the poses this film needs).
   - Split the film into segments of 2–5 shots in `build/production.json`.
   - Transfer the reference's measured camera with `motion_score.py from-ref`, then `predict` and `compile`.
   - Copy the engine skill into `build/engine/<engine>/`, so a later skill change never alters a running job.
2. **Cast gate:** for each character, a fresh reviewer checks full-resolution crops of the sheet. Fix, then re-review,
   within the mode's rounds. When all pass, run one line-up check (relative scale, how they interact). Shot reviews
   wait for this gate.
3. **Shot line:**
   - Builders work in parallel, one Agent per segment (up to 4–6 at once). Each owns only its own shot files. A change
     to a shared file goes through the director, additive only, one at a time.
   - Each finished segment goes to a fresh reviewer: 12 fps strips plus full-resolution crops.
   - Blockers go back to the same builder: continue it with SendMessage, so it keeps its context. Re-review only the
     shots that failed.
4. **Assemble:** mix and run the full render. Then run `motion_check.py` (black frames, a hard cut to black,
   accidental stills, a missing audio track) and look at a contact sheet of the whole film.
5. **Final critic:** a fresh agent.
   - First the climax duel: ours against the reference's, frame for frame, with `clip_strip.py --vs`.
   - Then the whole film: `compare.py` side by side, with per-shot scores where 4 means it holds up beside the
     reference.
   - It verifies every earlier "fixed" item first.
   - Must-fix items go to that segment's builder or to the director.
   - **Deliver only when every shot scores ≥ 4 and no climax loses to the reference.**

**Severity:**
- `blocker`: a viewer notices it at normal speed and size. Broken or floating limbs, a missing neck, seams, clipping,
  an action that reads wrong, a character that changes, unreadable text, a subject too small, flash or skipped
  frames, empty or broken frames.
- `polish`: visible only zoomed in. It is recorded and fixed along the way, never blocking.
- **A review passes when it has no blockers.** From round 2 on, a review fails only on an unfixed item, a problem a fix
  caused, or a real blocker.

**Fixes need evidence:** each fixed item goes in `fixes.json` with before and after full-resolution crops of the same
moment and region. The next reviewer checks those first, and a claimed fix that isn't one goes straight back.

**`needs_user`:** lyrics, the user's own designs and the like are not defects. Pause and ask the user to provide or
skip them; never loop on them.

**The eye checklist:** every review uses full-resolution crops, never thumbnails.
- Every limb joined, a neck present, no seams or double outlines.
- Matches the character sheet, even line weight, no clipping.
- A subject in an emotional or dialogue shot is at least 35% of the frame height.
- Captions readable at phone width: at least 4.5% of the frame height, with an outline or backing.
- No banding or flicker; every transition has its seam.
- Actions are judged only from consecutive frames, never a single still. Look for a pose change with no in-between
  frame, a teleporting prop, a hand that should move and doesn't, a stiff block rotation, or a still of over 1 s in an
  acting shot.
- Never hide a move you can't draw with a flash, a transition or a cut away.

**Efficiency (from the app's measured runs):**
- Grab every timestamp you need in one call (`hf_frames.py` for HyperFrames projects; the engine's own render flags
  otherwise).
- Run renders in the foreground with a timeout up to 600000 ms. Split long renders into resumable chunks; never leave
  a render in the background and sleep on a guess.

## 6. Deliver, then take notes

Report:
- the path, length and resolution
- one line per shot
- **honestly, what is unfinished or a stand-in**

The user's notes come as "at 0:12 the hand looks wrong". Change only those shots, re-render just those frames, and
re-encode. Add every new pitfall to the style file's "known pitfalls" section.

## The original web app (optional, not installed)

`git clone https://github.com/edenfunf/reelmimic && cd reelmimic && ./install.sh && ./start.sh` starts the app at
http://localhost:4318. It spawns Claude Code or Codex agents itself, which count against the plan. Its
`.claude/settings.json` hooks drive that app only. In a cloud session, use this skill instead.

**Before posting anything:** ReelMimic never posts by itself, and neither does this skill. Show the user the final, and
post or schedule only when the user explicitly asks.
