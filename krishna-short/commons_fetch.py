#!/usr/bin/env python3
"""
commons_fetch.py - download chosen files from a commons_catalog.py catalogue, one at a time, and write
CREDITS.txt (title, author, licence, source page) for the post caption / end card.

  python commons_fetch.py catalog.json --out media 3 4 7 10 466        # catalogue indices
  python commons_fetch.py catalog.json --out media "File:Chatt Ghat.jpg"

Photos wider than --max-width come as Commons' own resized copy (standard sizes only), videos as the original.
Waits whenever Commons answers 429 (Retry-After), so it is slow but polite.
"""
import argparse
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

UA = {"User-Agent": "krishna-short-tool/1.0 (educational festival video maker; https://github.com/aim-it4/learning)"}


def get(url, tries=10):
    for i in range(tries):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300).read()
            time.sleep(3)
            return data
        except urllib.error.HTTPError as e:
            if e.code != 429 or i == tries - 1:
                raise
            ra = e.headers.get("Retry-After")
            wait = int(ra) + 5 if ra and ra.isdigit() else 60
            print(f"  Commons asked us to slow down, waiting {wait}s", flush=True)
            time.sleep(wait)


def safe_name(title):
    stem = re.sub(r"[^\w.-]+", "_", title.split(":", 1)[1]).strip("_")
    return stem[:80]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("catalog")
    ap.add_argument("picks", nargs="+", help="catalogue indices or File: titles")
    ap.add_argument("--out", default="media")
    ap.add_argument("--max-width", type=int, default=3840, choices=(1280, 1920, 3840))
    args = ap.parse_args()

    items = json.loads(Path(args.catalog).read_text(encoding="utf-8"))
    by_title = {x["title"]: x for x in items}
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    cfile = out / "credits.json"            # credits of every file fetched into this folder so far
    credits = json.loads(cfile.read_text(encoding="utf-8")) if cfile.exists() else {}
    for p in args.picks:
        x = items[int(p)] if p.isdigit() else by_title[p]
        ext = Path(x["url"].split("?")[0]).suffix.lower()
        f = out / f"{p if p.isdigit() else 'f'}_{safe_name(x['title'])}"
        f = f.with_suffix(".jpg" if ext in (".jpeg", ".jpg") else ext)
        url = x["url"].split("?")[0]
        if x["mime"].startswith("image/") and x["width"] > args.max_width and x.get("thumb"):
            url = re.sub(r"/\d+px-", f"/{args.max_width}px-", x["thumb"].split("?")[0])
        if not f.exists():
            print(f"{p}: {x['title']}", flush=True)
            f.write_bytes(get(url))
        credits[f.name] = f"{f.name}\n  {x['title'][5:]} - {x['artist'] or 'unknown'} - {x['licence']}\n  {x['page']}"
    cfile.write_text(json.dumps(credits, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "CREDITS.txt").write_text("Photos and videos from Wikimedia Commons (free licences):\n\n" +
                                     "\n".join(credits.values()) + "\n", encoding="utf-8")
    print(f"{len(credits)} files -> {out}", flush=True)


if __name__ == "__main__":
    main()
