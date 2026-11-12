#!/bin/bash
# Installs the code-drawn animation / music-video skills for Claude Code into ~/.claude/skills (user level, so every
# project and every session on this machine sees them). Sources are pinned to the commits reviewed on 2026-11-12;
# re-running updates in place. Usage:  bash install-video-skills.sh        (CLAUDE_SKILLS_DIR=... to install elsewhere)
#
#   edenfunf/reelmimic              MIT  36 skills: anime-cel, paper-cutout, painted-animation (watercolour),
#                                         crayon-storybook, pixel-art, whiteboard, motion-graphics, video-clone
#                                         (reference video -> style -> engine), music-to-video, hyperframes*, ...
#   tuzhechen2005/painted-animation MIT  kinetic-reel (its painted-animation is the same engine as reelmimic's)
#   am-will/music-video-reimagined  MIT  music-video-reimagined (remake a music video as a hand-painted cartoon)
#   cth9191/animate                 MIT  animate (procedural animation: cut paper, ink, riso, sketchbook, pixel, ...)
#
# Not installed: reelmimic's .claude/settings.json hooks (they drive its own app) and Joker-chichi/claude-mv-skill
# (a copy of painted-animation with extra intake rules). Telemetry of the bundled media tools is switched off.
set -e
DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
fetch() {   # owner/repo  commit  dir
  git init -q "$TMP/$3"
  git -C "$TMP/$3" remote add origin "https://github.com/$1"
  GIT_LFS_SKIP_SMUDGE=1 git -C "$TMP/$3" fetch -q --depth 1 origin "$2"
  git -C "$TMP/$3" -c advice.detachedHead=false checkout -q FETCH_HEAD
}
fetch edenfunf/reelmimic              74fc0c507242c64f215b88b2408bcdbacef3bcd0 reelmimic
fetch tuzhechen2005/painted-animation 59744a69c7b916cfbe4c4ec84006b0c2f5e2fde1 painted
fetch am-will/music-video-reimagined  7d6b7b22caf08c6e330e1abb869953d8e4f2cc1a reimagined
fetch cth9191/animate                 7e5eb56feb2dd573f890e1b7b34748af43d58263 animate

mkdir -p "$DEST"
put() { rm -rf "$DEST/$2"; cp -r "$1" "$DEST/$2"; }
n=0
for s in "$TMP"/reelmimic/.claude/skills/*/; do put "$s" "$(basename "$s")"; n=$((n + 1)); done
cp "$TMP/reelmimic/requirements.txt" "$DEST/video-clone/requirements-reelmimic.txt"
put "$TMP/painted/skills/kinetic-reel" kinetic-reel
put "$TMP/reimagined/skills/music-video-reimagined" music-video-reimagined
put "$TMP/animate/plugins/animate/skills/animate" animate
n=$((n + 3))
# the reelmimic docs give project-relative paths (.claude/skills/...); point them at the user-level install
find "$DEST" -name '*.md' -path '*skills*' -print0 | xargs -0 sed -i -E 's#([ `"(])\.claude/skills/#\1~/.claude/skills/#g'

# telemetry off for the HyperFrames / media-use / Remotion tools these skills call
python3 - <<'EOF'
import json, os
p = os.path.expanduser("~/.claude/settings.json")
s = json.load(open(p)) if os.path.exists(p) else {}
s.setdefault("env", {}).update({"DO_NOT_TRACK": "1", "HYPERFRAMES_NO_TELEMETRY": "1", "REMOTION_TELEMETRY_DISABLED": "1"})
os.makedirs(os.path.dirname(p), exist_ok=True)
json.dump(s, open(p, "w"), indent=2)
EOF
echo "installed $n video skills into $DEST"
