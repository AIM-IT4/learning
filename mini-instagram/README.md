# mini-instagram

A tiny, **runnable** Instagram-like app built to be *read*. It is written in
**Django**, the same framework Instagram actually uses, and it includes small
from-scratch versions of the **machine learning** that makes Instagram feel
like Instagram: a ranked feed, follow suggestions, Explore recommendations and
a comment spam/abuse filter.

Every file has comments pointing from the toy choice to what Instagram does at
scale. This is **not** Instagram's code (that is private). It is a clean-room
learning model of the same ideas, small enough for one person to hold in their
head and fast enough to train on a laptop CPU in about a second.

---

## Run it (about 2 minutes)

```bash
cd mini-instagram
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt                       # Django, Pillow, numpy

python manage.py migrate        # create the database (SQLite file)
python manage.py seed_demo      # 20 demo users with real tastes, posts, follows, likes
python manage.py train_models   # train the ranker + comment filter, print their scores
python manage.py runserver      # http://127.0.0.1:8000
```

Log in as **maya** / **password123** (every demo user has that password).
Open **Models** in the top bar to see what the models learned, and try the
comment filter live.

Already ran an older version? Run `python manage.py migrate`, then
`python manage.py seed_demo --fresh`, then `python manage.py train_models`.

Run the tests (25 of them, a few seconds):

```bash
python manage.py test
```

---

## How the pieces map to real Instagram

| In this repo | What it is | Real Instagram |
| --- | --- | --- |
| `feed/models.py` | `Post`, `Follow`, `Like`, `Comment` tables | The same relational data in sharded **PostgreSQL** |
| `feed/feed_service.py` | "Latest" feed, built live (fan-out on read) | Precomputed feeds in **Cassandra** (fan-out on write) |
| `feed/recsys.py` | "For you" feed: candidates, then a model ranks them | The same two stages, with deep neural networks |
| `feed/recsys.py` | "Suggested for you" (friends of friends) | Graph signals plus learned models |
| `feed/recsys.py` | Explore (item-item collaborative filtering) | Learned embeddings + nearest-neighbour search |
| `feed/moderation.py` | Comment filter (Naive Bayes) hides spam/abuse | "Hide offensive comments" + integrity classifiers |
| `annotate(like_count=…)` | Counts computed in the DB | Hot counts cached in **Memcached** |
| `Post.image` → `media/` folder | Uploaded photos on disk | **Blob storage** + **CDN**, with async transcoding |
| `views.py` | Thin HTTP layer | A huge **Django** fleet under uWSGI |
| `api_feed` (JSON) | The contract a phone app calls | The app talks **JSON** to the same backend |

---

## Machine learning: recommendations and classifiers

All four models are written from scratch in `ml/` (plain Python + numpy, no
Django), so you can read every line. `feed/recsys.py` and `feed/moderation.py`
connect them to the database.

| Model | Type | Code | What it does |
| --- | --- | --- | --- |
| Feed ranker | Classifier: logistic regression | `ml/logistic.py` | Predicts P(you like this post); "For you" sorts by it |
| Comment filter | Classifier: Naive Bayes | `ml/naive_bayes.py` | Labels comments ok / spam / abuse; hides flagged ones |
| Suggested for you | Recommender: friends of friends | `ml/similarity.py` | Ranks accounts by how many of your follows follow them |
| Explore | Recommender: item-item CF | `ml/similarity.py` | "People who liked what you liked also liked…" |

**The ranker's 4 features**, per (viewer, post): how often you like this
author (`author_affinity`), how much of what you like shares this post's
hashtag (`topic_affinity`), how popular the author is (`author_popularity`),
and how new the post is (`recency`).

**How it's measured.** The ranker uses 5-fold cross-validation and AUC, and is
compared against each feature alone. The comment filter is tested on held-out
comments with precision and recall. `train_models` prints all of it, and the
**Models** page draws it. On the demo data the ranker scores AUC ≈ 0.72,
slightly above its best single feature (0.71); the comment filter gets about
78% of unseen comments right and shows you the ones it misses. Those are
honest numbers for small data, not production quality.

**Why the demo data has "tastes".** `seed_demo` gives each user a hidden
favourite topic and closeness to some authors, then generates likes from that.
The models never see the hidden tastes: they have to rediscover them from likes,
exactly like a real recommender.

**A real ML lesson is recorded in the code.** The first version of the ranker
computed "how much you like this author" from all your likes *except this
post*. That leave-one-out trick quietly biased the training data, so the model
learned a backwards (negative) weight and scored below a coin flip. The fix,
out-of-fold features, is explained in `build_training_set()` in
`feed/recsys.py`. It is one of the most common mistakes in applied ML.

---

## Where to read, in order

1. **`feed/models.py`**: the data. Start here; everything else refers to it.
2. **`feed/feed_service.py`**: the "Latest" feed and fan-out on read vs. write.
3. **`ml/logistic.py`**, then **`feed/recsys.py`**: features, training,
   cross-validation, and the ranked feed. The heart of the ML.
4. **`ml/similarity.py`**: friends-of-friends and collaborative filtering.
5. **`ml/naive_bayes.py`** + **`feed/moderation.py`** + **`feed/comment_labels.py`**:
   the comment filter and its training data.
6. **`feed/views.py`** + **`feed/urls.py`**: how a request becomes a response.
7. **`templates/`**: the HTML, including the instant like/follow `fetch()` calls.
8. **`feed/tests.py`** and **`ml/tests.py`**: behaviour, pinned down and runnable.

## What's deliberately left out (good next steps)

- **Precomputed feeds**: add a `FeedEntry` table and push to it on every new
  post, to feel fan-out-on-write.
- **Image classification**: tagging photos needs a convolutional network; a
  small pretrained one can run on a laptop CPU.
- **Embeddings**: replace item-item CF with learned user/post vectors.
- **Impressions and timestamps**: log what each user was *shown*, so the ranker
  can use a post's own like count fairly and train on real exposures.
- **More labelled comments**: the filter's biggest weakness is its 90-example
  training set. Add examples to `feed/comment_labels.py` and retrain.
- **Caching** (Memcached/Redis), **direct messages**, **stories**, **search**,
  **Postgres** (one `DATABASES` change in `settings.py`).

## Layout

```
mini-instagram/
├── manage.py                    # command entry point
├── requirements.txt             # Django, Pillow, numpy
├── config/                      # project: settings, root urls, wsgi/asgi
├── ml/                          # the ML algorithms, from scratch (no Django)
│   ├── logistic.py              # logistic regression (feed ranker)
│   ├── naive_bayes.py           # Naive Bayes (comment filter)
│   ├── similarity.py            # friends of friends + item-item CF
│   ├── metrics.py               # AUC, accuracy, precision/recall
│   ├── tests.py                 # 10 tests
│   └── artifacts/               # trained models saved as JSON (not committed)
└── feed/                        # the app
    ├── models.py                # Post / Follow / Like / Comment / Profile
    ├── feed_service.py          # the "Latest" feed
    ├── recsys.py                # ranked feed, suggestions, Explore
    ├── moderation.py            # comment filter wiring
    ├── comment_labels.py        # labelled training comments
    ├── views.py / urls.py       # HTTP handlers and routes
    ├── admin.py                 # free backoffice at /admin
    ├── tests.py                 # 15 tests
    └── management/commands/
        ├── seed_demo.py         # demo data with hidden tastes
        └── train_models.py      # train, evaluate, save both classifiers
```
