#!/usr/bin/env python3
"""
commons_catalog.py - list the freely licensed photos and videos in Wikimedia Commons categories
(e.g. real Chhath Puja footage), with licence, author and a small preview, so you can pick shots.

  python commons_catalog.py --out catalog.json --thumbs thumbs "Category:Chhath in Bihar" "search:Chhath Patna"
  ("search:words" runs a Commons file search instead of reading a category; "filetype:video" finds videos)

Polite by design: one API request at a time, a pause between requests, and when Commons answers
"429 too many requests" the script waits as long as the server asks (Retry-After) before trying again.
Only files under licences that allow re-use (public domain, CC0, CC BY, CC BY-SA) are kept; CC BY and
CC BY-SA need the author credited - see CREDITS in the output.
"""
import argparse
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

UA = {"User-Agent": "krishna-short-tool/1.0 (educational festival video maker; https://github.com/aim-it4/learning)"}
API = "https://commons.wikimedia.org/w/api.php"
OK_LICENCE = re.compile(r"^(public domain|pd|cc0|cc by(-sa)? [\d.]+)", re.I)
PAUSE = 2.0


def get(url, tries=8):
    for i in range(tries):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()
            time.sleep(PAUSE)
            return data
        except urllib.error.HTTPError as e:
            if e.code != 429 or i == tries - 1:
                raise
            ra = e.headers.get("Retry-After")
            wait = int(ra) + 5 if ra and ra.isdigit() else 30
            print(f"  Commons asked us to slow down, waiting {wait}s", flush=True)
            time.sleep(wait)


CACHE = None   # folder for API answers, so a re-run does not ask Commons again


def api(**params):
    params.update(format="json", formatversion="2")
    url = API + "?" + urllib.parse.urlencode(params)
    f = CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".json") if CACHE else None
    if f and f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    data = get(url)
    if f:
        f.write_bytes(data)
    return json.loads(data)


def clean(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", str(html or ""))).strip()


def files_in(cat):
    out, cont = [], {}
    while True:
        r = api(action="query", generator="categorymembers", gcmtitle=cat, gcmtype="file", gcmlimit=50,
                prop="imageinfo", iiprop="url|size|mime|extmetadata", iiurlwidth=360, **cont)
        out += r.get("query", {}).get("pages", [])
        if "continue" not in r:
            return out
        cont = {k: v for k, v in r["continue"].items()}


def search_files(q):
    out, cont = [], {}
    while len(out) < 200:
        r = api(action="query", generator="search", gsrsearch=q, gsrnamespace=6, gsrlimit=50,
                prop="imageinfo", iiprop="url|size|mime|extmetadata", iiurlwidth=360, **cont)
        out += r.get("query", {}).get("pages", [])
        if "continue" not in r:
            break
        cont = {k: v for k, v in r["continue"].items()}
    return out


def subcats(cat):
    r = api(action="query", list="categorymembers", cmtitle=cat, cmtype="subcat", cmlimit=200)
    return [m["title"] for m in r.get("query", {}).get("categorymembers", [])]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("categories", nargs="+")
    ap.add_argument("--depth", type=int, default=1, help="how many levels of sub-categories to follow")
    ap.add_argument("--out", default="catalog.json")
    ap.add_argument("--thumbs", help="also save a small preview of every file here")
    ap.add_argument("--min-width", type=int, default=1000)
    args = ap.parse_args()
    global CACHE
    CACHE = Path(args.out).with_suffix(".cache")
    CACHE.mkdir(exist_ok=True)

    seen, todo, items = set(), [(c, 0) for c in args.categories], {}
    while todo:
        cat, d = todo.pop(0)
        if cat in seen:
            continue
        seen.add(cat)
        print(f"{cat}", flush=True)
        for p in (search_files(cat[7:]) if cat.startswith("search:") else files_in(cat)):
            ii = (p.get("imageinfo") or [{}])[0]
            meta = {k: clean(v.get("value")) for k, v in (ii.get("extmetadata") or {}).items()}
            lic = meta.get("LicenseShortName", "")
            mime = ii.get("mime", "")
            if not OK_LICENCE.match(lic) or not (mime.startswith("image/") or mime.startswith("video/")):
                continue
            if mime.startswith("image/") and ii.get("width", 0) < args.min_width:
                continue
            items[p["title"]] = dict(title=p["title"], category=cat, mime=mime, width=ii.get("width"),
                                     height=ii.get("height"), duration=ii.get("duration"), url=ii.get("url"),
                                     thumb=ii.get("thumburl"), page=ii.get("descriptionurl"), licence=lic,
                                     artist=meta.get("Artist", ""), description=meta.get("ImageDescription", "")[:300],
                                     date=meta.get("DateTimeOriginal", ""))
        if d < args.depth and not cat.startswith("search:"):
            todo += [(c, d + 1) for c in subcats(cat)]
    Path(args.out).write_text(json.dumps(list(items.values()), ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(items)} usable files -> {args.out}", flush=True)
    if args.thumbs:
        t = Path(args.thumbs)
        t.mkdir(parents=True, exist_ok=True)
        for i, it in enumerate(items.values()):
            f = t / f"{i:04d}.jpg"
            if it["thumb"] and not f.exists():
                f.write_bytes(get(it["thumb"]))
        print(f"previews -> {t}", flush=True)


if __name__ == "__main__":
    main()
