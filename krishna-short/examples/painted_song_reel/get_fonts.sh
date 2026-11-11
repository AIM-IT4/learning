#!/bin/bash
# Fetch the reel's fonts (OFL, from the npm packages of Google Fonts) into code_scenes/fonts, which git ignores.
set -e
DEST="$(cd "$(dirname "$0")/../../code_scenes" && pwd)/fonts"; mkdir -p "$DEST"
TMP=$(mktemp -d); cd "$TMP"
npm pack @expo-google-fonts/poppins @expo-google-fonts/noto-sans-devanagari @expo-google-fonts/yatra-one --silent >/dev/null
for t in *.tgz; do tar xzf "$t"; done
for f in Poppins_300Light Poppins_500Medium NotoSansDevanagari_700Bold YatraOne_400Regular; do
  cp "$(find . -name "$f.ttf" | head -1)" "$DEST/"
done
[ -f "$DEST/YatraOne.ttf" ] || cp "$DEST/YatraOne_400Regular.ttf" "$DEST/YatraOne.ttf"
rm -rf "$TMP"; ls "$DEST"
