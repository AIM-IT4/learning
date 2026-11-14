# mini-instagram

A tiny, **runnable** Instagram-like app built to be *read*. It is written in
**Django** — the same framework Instagram actually uses — so the patterns you
learn here are the real ones, just shrunk to a size one person can hold in their
head. Every file has comments pointing from the toy choice to what Instagram
does at scale.

This is **not** Instagram's code (that is private). It is a clean-room learning
model of the same ideas.

---

## Run it (about 2 minutes)

```bash
cd mini-instagram
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt

python manage.py migrate        # create the database (SQLite file)
python manage.py seed_demo      # add demo users, posts, follows, likes
python manage.py runserver      # http://127.0.0.1:8000
```

Log in as **maya** / **password123** (or any of: leo, ravi, nina).
Create your own account with **Sign up**. Browse the admin at `/admin` after
`python manage.py createsuperuser`.

Run the tests:

```bash
python manage.py test
```

---

## How the pieces map to real Instagram

| In this repo | What it is | Real Instagram |
| --- | --- | --- |
| `config/settings.py` | Project config, SQLite | Thousands of settings; sharded **PostgreSQL** |
| `feed/models.py` | `Post`, `Follow`, `Like`, `Comment` tables | The same relational data in **PostgreSQL** |
| `feed/feed_service.py` | Builds your feed live (fan-out on **read**) | Precomputed feeds in **Cassandra** (fan-out on **write**) |
| `annotate(like_count=…)` | Counts computed in the DB | Hot counts cached in **Memcached** |
| `Post.image` → `media/` folder | Uploaded photos on disk | **Blob storage** + **CDN**, with async transcoding |
| `views.py` | Thin HTTP layer | A huge **Django** fleet under uWSGI |
| `urls.py` | Path → view routing | Same idea, across many services |
| `api_feed` (JSON) | The contract a phone app calls | The app talks **JSON** to the same backend |
| `python manage.py test` | 5 tests | Enormous CI; same `TestCase` tooling |

The 60-second visual version of this table is the reel explainer made earlier
in the chat.

---

## Where to read, in order

1. **`feed/models.py`** — the data. Start here; everything else refers to it.
2. **`feed/feed_service.py`** — the feed algorithm, and the big idea
   (fan-out on read vs. write). This is the most important file.
3. **`feed/views.py`** — how a request becomes a response.
4. **`feed/urls.py`** + **`config/urls.py`** — how URLs find those views.
5. **`templates/`** — the HTML, including the instant-like `fetch()` call.
6. **`feed/tests.py`** — behaviour, pinned down and runnable.

## What's deliberately left out (good next steps)

- **Precomputed feeds** — add a `FeedEntry` table and push to it when a post is
  created, to feel fan-out-on-write.
- **Caching** — put Memcached/Redis in front of the counts.
- **Ranking** — the feed is reverse-chronological; real feeds rank by a model.
- **Direct messages, stories, search, notifications.**
- **Postgres** — swap the `DATABASES` block (one change; see `settings.py`).

## Layout

```
mini-instagram/
├── manage.py                 # command entry point
├── requirements.txt          # Django + Pillow, nothing else
├── config/                   # project: settings, root urls, wsgi/asgi
└── feed/                     # the app
    ├── models.py             # Post / Follow / Like / Comment / Profile
    ├── feed_service.py       # the feed algorithm (read this)
    ├── views.py              # HTTP handlers
    ├── urls.py               # routes
    ├── admin.py              # free backoffice at /admin
    ├── tests.py              # 5 tests
    └── management/commands/seed_demo.py   # demo data generator
```
