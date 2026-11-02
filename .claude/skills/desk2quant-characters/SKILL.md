---
name: desk2quant-characters
description: "Use when making a Desk2Quant explainer reel, talking reel, animation, cover or still with characters: the recurring cast A–G (aspirants A, B, C; desk quant D, researcher E, developer F, head of research G) lives in characters/ with its rig, gestures, walk, lip-sync, voices, office sets, QA and render tools. Also use when the user asks which characters exist, wants a character's voice, or wants a new character in the same style."
---

# Desk2Quant characters

The cast and the whole animation toolkit are saved in this repo under `characters/`. Reuse them instead of drawing new characters, and read `characters/README.md` first: it has the cast table, quick start, gesture rules and render commands. `characters/voice/README.md` covers voices.

## The cast

| | Gender → voice | Role |
|---|---|---|
| A | male → male voice | aspirant (orange bomber) |
| B | male → male voice | aspirant (brown jacket) |
| C | female → female voice | aspirant (plum bob, maroon vest, backpack) |
| D | male → male voice | desk quant (blue Oxford, navy gilet, lanyard, glasses) |
| E | female → female voice | quant researcher (bun, round glasses, sage sweater) |
| F | male → male voice | quant developer (beard, hoodie, headphones) |
| G | female → female voice | head of quant research (silver bob, camel blazer) |

Look at `characters/sheets/lineup.png`, `turn.png`, `faces.png` and `gestures.png` before staging.

## Working rules

1. **Start from the kit.** Copy `characters/` (or load it by relative path) into the project's page. Load `rig/hand.js, rig/cast.js, rig/quants.js, rig/motion.js, rig/gest.js, rig/gest2.js, sets/env.js, kit.js`, then build the scene with `Kit.castIn`, `Kit.talker`, `Gest.track` and `Motion.walk`. `characters/demo.html` is a working example.
2. **Voices follow gender**: C, E and G use the female voice (Kokoro `af_heart`); A, B, D and F use the male voice (Chatterbox matched to `voice/refs`). Run `voice/tools/check_voices.py` on the voiced lines before mixing; every line must print `ok`. Don't use the founder's voice, and don't use ElevenLabs output from a Free account (no commercial licence).
3. **Gestures must be professional and accurate**:
   - Point at the exact on-screen element (`pointAt` with its coordinates, arm nearest the target).
   - Present with an open palm (`presentSide` / `presentLow`), never a raised "hailing" hand.
   - One talking hand at a time; no hands on the face while speaking; no reaching over props; no long raised-arm holds.
   - See the gesture rules in the README.
4. **QA before rendering**:
   - `node tools/moaudit.mjs <page>` must report 0 flags.
   - Check stills at every gesture change (hands, faces, pointing targets).
   - Then render with `tools/render.mjs` (30 fps, 8-subframe motion blur) and mux audio at −14 LUFS / −1.5 dBTP.
5. **Desk2Quant content rules**:
   - No bank logos or employer branding.
   - No prices, discounts or coupons.
   - No framing around product bugs.
   - Never say the narration is AI.
   - Use only assets Desk2Quant owns or has rights to.
6. **Keep the kit current.** If a project improves the rig (cast.js, hand.js, gest*.js, motion.js), copy the improved files back into `characters/rig/`. Re-run `node tools/sheet.mjs` and `node tools/moaudit.mjs demo.html`, then commit.
