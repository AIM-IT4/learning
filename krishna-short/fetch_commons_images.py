#!/usr/bin/env python3
"""
fetch_commons_images.py - download PUBLIC-DOMAIN artwork from Wikimedia Commons for your reels.

Every file's licence is checked through the Commons API; anything that is not marked
"Public domain" is skipped. A CREDITS.txt (title, artist, date, source page) is written
next to the images - paste it into your post caption or description.

  python fetch_commons_images.py --out reel_images            # the default Gita / Kurukshetra set
  python fetch_commons_images.py --out imgs "File:Some painting.jpg" "File:Another.jpg"

Find more: search https://commons.wikimedia.org (e.g. "Krishna Arjuna painting") and copy file titles.
"""
import argparse
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

UA = {"User-Agent": "krishna-short-tool/1.0 (educational reel maker)"}
API = "https://commons.wikimedia.org/w/api.php"

# Public-domain Indian paintings: Gita updesh at Kurukshetra, Vishvarupa, the war.
DEFAULT_SET = [
    "File:Vishnu Vishvarupa.jpg",
    "File:Krishna Arjuna Gita.jpg",
    "File:Sri Krishna preaching Gita Upadesh to Arjun - Unknown, Kashmir School - Google Cultural Institute.jpg",
    "File:Arjuna BattlesWith the Kauravas At Kuruksheta Bhagavad Gita.jpg",
    "File:Arjuna and His Charioteer Krishna Confront Karna.jpg",
    "File:BhagavadGita-19th-century-Illustrated-Sanskrit-Chapter 1.20.21.jpg",
    "File:Krishna as Envoy, by Raja Ravi Varma.jpg",
    "File:Dialogue between Krishna and Arjuna on the battlefield of Kurukshetra (6124590103).jpg",
]


def get(url, tries=5):
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        except urllib.error.HTTPError as e:  # Commons rate-limits bursts (HTTP 429)
            if e.code != 429 or i == tries - 1:
                raise
            wait = int(e.headers.get("Retry-After") or 0) or 10 * (i + 1)
            print(f"  rate limited, waiting {wait}s")
            time.sleep(wait)


def clean(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("titles", nargs="*", help="Commons file titles (default: built-in Gita set)")
    ap.add_argument("--out", default="reel_images")
    ap.add_argument("--max-width", type=int, default=1920, choices=(960, 1280, 1920, 3840),
                    help="width of the resized copy (Commons only serves these standard sizes)")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    credits = []
    for n, title in enumerate(args.titles or DEFAULT_SET, 1):
        q = urllib.parse.urlencode({
            "action": "query", "format": "json", "titles": title, "prop": "imageinfo",
            "iiprop": "url|extmetadata", "iiurlwidth": args.max_width,
            "iiextmetadatafilter": "LicenseShortName|Artist|DateTimeOriginal|ObjectName"})
        page = next(iter(json.loads(get(f"{API}?{q}"))["query"]["pages"].values()))
        if "imageinfo" not in page:
            print(f"skip (not found): {title}")
            continue
        info = page["imageinfo"][0]
        meta = {k: clean(v.get("value")) for k, v in info.get("extmetadata", {}).items()}
        licence = meta.get("LicenseShortName", "")
        if "public domain" not in licence.lower():
            print(f"skip (licence is '{licence}', not public domain): {title}")
            continue
        url = info.get("thumburl") or info["url"]
        ext = Path(urllib.parse.urlparse(url).path).suffix.lower() or ".jpg"
        dest = out / f"{n:02d}{ext}"
        if not dest.exists():
            dest.write_bytes(get(url))
        credits.append(f"{dest.name}: {meta.get('ObjectName') or title[5:]} | {meta.get('Artist', 'Unknown')} | "
                       f"{meta.get('DateTimeOriginal', 'date unknown')} | {licence} | {info['descriptionurl']}")
        print(f"ok   {dest.name}  <- {title[5:70]}")
        # write after every image so credits survive an interrupted run
        (out / "CREDITS.txt").write_text(
            "Public-domain images via Wikimedia Commons\n" + "\n".join(credits) + "\n", encoding="utf-8")
        time.sleep(3)
    print(f"{len(credits)} images + CREDITS.txt in {out}")


if __name__ == "__main__":
    main()
