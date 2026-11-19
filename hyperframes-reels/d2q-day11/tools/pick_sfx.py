"""Pick each sound-effect role from the CC0 uisfx packs (Real SFX's bundled library) by listening with earshot, then
copy the winners to assets/sfx/<role>.mp3 and write assets/sfx/PICKS.json.
usage: ~/.local/share/earshot/.venv/bin/python tools/pick_sfx.py"""
import json, os, shutil
from earshot import api

U = "/home/user/desk2quant/.claude/skills/real-sfx/vendor/node_modules/uisfx/sounds"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "sfx")
ROLES = {
    "pop": ("a short soft cartoon pop, a toy sticker popping onto a board",
            ["rubber/press", "rubber/snap", "rubber/reaction", "rubber/drop", "rubber/select", "soft/press", "soft/snap", "soft/bonus"]),
    "whoosh-short": ("a quick soft whoosh as a card flips over",
                     ["soft/swipe", "rubber/swipe", "studio/swipe", "minimal/swipe", "cinematic/swipe", "organic/swipe"]),
    "whoosh": ("a longer airy whoosh sweeping across the screen",
               ["cinematic/swipe", "cinematic/forward", "scifi/swipe", "dreamy/swipe", "soft/forward", "glass/swipe"]),
    "click-soft": ("a soft small click of a toy block landing",
                   ["soft/select", "soft/press", "minimal/select", "rubber/select", "studio/select", "wood/select"]),
    "ping": ("a clear bright ping, an alert",
             ["glass/notification", "soft/info", "zen/notification", "glass/info", "minimal/notification", "dreamy/notification"]),
    "key-press": ("a mechanical key press on a calculator",
                  ["mechanical/press", "mechanical/select", "mechanical/double-click", "studio/press", "minimal/press"]),
    "sparkle": ("a magical twinkly sparkle, a success reveal",
                ["dreamy/achievement", "glass/success", "glass/achievement", "dreamy/success", "arcade/bonus", "soft/achievement"]),
    "typing": ("fast typing on a phone keyboard",
               ["soft/typing", "mechanical/typing", "minimal/typing", "glass/typing", "studio/typing"]),
    "chime": ("a warm gentle closing chime",
              ["zen/complete", "glass/complete", "dreamy/complete", "soft/complete", "zen/success", "studio/complete"]),
    "thud": ("a heavy soft thud of a block dropping down",
             ["rubber/drop", "organic/drop", "soft/drop", "studio/drop", "mechanical/drop", "wood/drop"]),
}
os.makedirs(OUT, exist_ok=True)
picks = {}
for role, (query, cands) in ROLES.items():
    files = [f"{U}/{c}.mp3" for c in cands if os.path.exists(f"{U}/{c}.mp3")]
    res = api.rank(files, query)
    best = res["results"][0] if isinstance(res, dict) and "results" in res else res[0]
    path = best["path"] if isinstance(best, dict) else best
    shutil.copy(path, os.path.join(OUT, f"{role}.mp3"))
    picks[role] = {"file": os.path.relpath(path, U), "query": query, "licence": "CC0-1.0 (uisfx)"}
    print(role, "->", picks[role]["file"], flush=True)
json.dump(picks, open(os.path.join(OUT, "PICKS.json"), "w"), indent=1)
