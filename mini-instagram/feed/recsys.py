"""Recommendations: the ranked "For you" feed, Explore, and "Suggested for you".

This file is the bridge between the database and the plain algorithms in ml/.
It turns rows (users, posts, likes) into numbers, calls the models, and hands
ranked results back to the views.

HOW THIS MAPS TO REAL INSTAGRAM
-------------------------------
Instagram's feed works in two stages, and so does ranked_home_feed() below:

  1. Candidate generation: collect a few hundred posts you *might* see
     (here: recent posts from accounts you follow).
  2. Ranking: score every candidate with a model that predicts how likely you
     are to engage, then sort (here: logistic regression on 4 features; at
     Instagram: large neural networks over thousands of signals, predicting
     likes, comments, shares and watch time, then combining them).
"""
import json
import math
import random
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Count
from django.utils import timezone

from ml.logistic import LogisticRegression
from ml.metrics import roc_auc
from ml.similarity import friends_of_friends, item_item_scores

from . import feed_service
from .models import Follow, Like, Post

FEATURES = ["author_affinity", "topic_affinity", "author_popularity", "recency"]
FEATURE_HELP = {
    "author_affinity": "How often you like this author's other posts",
    "topic_affinity": "How much of what you like shares this post's hashtag",
    "author_popularity": "How many likes this author's other posts get from other people",
    "recency": "How new it is",
}
RECENCY_SCALE_HOURS = 72        # recency = exp(-age / 72h): 1.0 now, ~0.37 after 3 days
HASHTAG = re.compile(r"#(\w+)")

_cache = {}


def hashtags(caption):
    return {tag.lower() for tag in HASHTAG.findall(caption or "")}


# ---------------------------------------------------------------- features --

@dataclass
class History:
    """Everything the features need, loaded into memory in two queries.

    That is fine for thousands of rows. At Instagram's scale these values come
    from precomputed feature stores, never from scanning tables per request.
    """
    likes_by_user: dict
    posts_by_author: dict
    like_count: dict
    post_author: dict
    post_time: dict
    post_tags: dict


def load_history():
    h = History(defaultdict(set), defaultdict(list), defaultdict(int), {}, {}, {})
    for pid, author, created, caption in Post.objects.values_list("id", "author_id", "created_at", "caption"):
        h.posts_by_author[author].append(pid)
        h.post_author[pid] = author
        h.post_time[pid] = created
        h.post_tags[pid] = hashtags(caption)
    for uid, pid in Like.objects.values_list("user_id", "post_id"):
        h.likes_by_user[uid].add(pid)
        h.like_count[pid] += 1
    return h


def features(viewer_id, post_id, h, now, history_posts=None):
    """Describe one (viewer, post) pair with 4 numbers.

    The viewer's own reaction to THIS post must never leak into its features,
    or the model learns to read the answer off the question.

    `history_posts` limits which posts the viewer-history features (1 and 2)
    may look at. Serving passes None: use everything you know. Training passes
    the *other fold* of posts (see build_training_set for why).
    """
    author = h.post_author.get(post_id)
    if author is None:                          # created after history was loaded
        return [0.0, 0.0, 0.0, 1.0]
    all_liked = h.likes_by_user.get(viewer_id, set())
    usable = (lambda q: q != post_id) if history_posts is None else (lambda q: q != post_id and q in history_posts)
    liked = {q for q in all_liked if usable(q)}

    # 1. How much does the viewer like this author's other posts?
    others = [q for q in h.posts_by_author[author] if usable(q)]
    author_affinity = sum(q in liked for q in others) / len(others) if others else 0.0

    # 2. How much of what the viewer likes shares this post's hashtag?
    tags = h.post_tags.get(post_id, set())
    if tags and liked:
        topic_affinity = sum(bool(h.post_tags.get(q, set()) & tags) for q in liked) / len(liked)
    else:
        topic_affinity = 0.0

    # 3. How popular is this author? Average likes on their other posts, on a
    #    log scale (1 -> 10 likes says more than 1,000 -> 1,010). It is the same
    #    number for every viewer: an author-level signal.
    #    Why not this post's own like count? It contains the very like we are
    #    trying to predict, and subtracting it biases the data the same way the
    #    leave-one-out bug did. Using it fairly needs like timestamps.
    if others:
        author_popularity = math.log1p(sum(h.like_count.get(q, 0) for q in others) / len(others))
    else:
        author_popularity = 0.0

    # 4. How fresh is it?
    age_hours = max(0.0, (now - h.post_time[post_id]).total_seconds() / 3600)
    recency = math.exp(-age_hours / RECENCY_SCALE_HOURS)

    return [author_affinity, topic_affinity, author_popularity, recency]


# ---------------------------------------------------------------- training --

def build_training_set(h=None, now=None, seed=0):
    """One row per (viewer, post by someone they follow). Label: did they like it?

    OUT-OF-FOLD FEATURES (a lesson learned the hard way)
    The first version of this code computed "how much do you like this author"
    from all of the viewer's likes *except this post* (leave-one-out). It sounds
    safe, but it quietly biases the data: for a post the viewer DID like,
    removing that like makes their affinity look lower; for a post they didn't
    like, nothing is removed. The model duly learned that high affinity means
    "won't like it": a negative weight and an AUC worse than a coin flip.

    The fix: split the posts into two folds at random. A row about a post in
    fold A computes its history features only from likes on fold-B posts, and
    vice versa. The answer can no longer leak into, or bias, the question.
    """
    h = h or load_history()
    now = now or timezone.now()
    rng = random.Random(seed)
    fold = {pid: rng.randint(0, 1) for pid in sorted(h.post_author)}
    fold_posts = {f: {pid for pid, k in fold.items() if k == f} for f in (0, 1)}

    following = defaultdict(set)
    for follower, followed in Follow.objects.values_list("follower_id", "following_id"):
        following[follower].add(followed)
    X, y = [], []
    for viewer, followed in following.items():
        for author in followed:
            for pid in h.posts_by_author.get(author, []):
                X.append(features(viewer, pid, h, now, history_posts=fold_posts[1 - fold[pid]]))
                y.append(1 if pid in h.likes_by_user.get(viewer, set()) else 0)
    return X, y


CV_FOLDS = 5


def _stratified_folds(y, k=CV_FOLDS, seed=0):
    """Deal the likes and non-likes out evenly into k folds, so every fold has both."""
    rng = random.Random(seed)
    pos = [i for i, v in enumerate(y) if v]
    neg = [i for i, v in enumerate(y) if not v]
    rng.shuffle(pos)
    rng.shuffle(neg)
    folds = [[] for _ in range(k)]
    for j, i in enumerate(pos + neg):
        folds[j % k].append(i)
    return folds


def ranker_path():
    return Path(settings.ML_ARTIFACT_DIR) / "ranker.json"


def train_ranker(seed=0):
    """Train the like-predictor, measure it with cross-validation, save it as JSON.

    The pattern every ML team follows:
      1. Measure on data the model never saw. With 5-fold cross-validation the
         pairs are split into 5 groups; each group is scored by a model trained
         on the other 4. Every pair is tested exactly once, so all the data
         counts towards the measurement, and the number is far less noisy than
         one small test split.
      2. Compare with simple baselines (one feature alone). A model that can't
         beat them isn't worth its complexity.
      3. Retrain on all the data for the version you actually serve.
    """
    X, y = build_training_set()
    if sum(y) < CV_FOLDS or len(y) - sum(y) < CV_FOLDS:
        raise ValueError("Not enough data to train: you need follows and likes. "
                         "Run `python manage.py seed_demo` first.")

    out_of_fold = [0.0] * len(y)                 # each pair's score from a model that never saw it
    for test_idx in _stratified_folds(y, seed=seed):
        held_out = set(test_idx)
        train_idx = [i for i in range(len(y)) if i not in held_out]
        fold_model = LogisticRegression().fit([X[i] for i in train_idx], [y[i] for i in train_idx])
        for i, p in zip(test_idx, fold_model.predict_proba([X[i] for i in test_idx])):
            out_of_fold[i] = float(p)

    clipped = [min(max(p, 1e-12), 1 - 1e-12) for p in out_of_fold]
    report = {
        "examples": len(y),
        "folds": CV_FOLDS,
        "positive_rate": sum(y) / len(y),
        "auc_model": roc_auc(y, out_of_fold),
        # Baselines: rank by one feature alone (no training needed).
        "auc_baselines": {name: roc_auc(y, [row[k] for row in X]) for k, name in enumerate(FEATURES)},
        "log_loss_cv": -sum(t * math.log(p) + (1 - t) * math.log(1 - p) for t, p in zip(y, clipped)) / len(y),
    }

    final = LogisticRegression().fit(X, y, feature_names=FEATURES)
    report["weights"] = dict(zip(FEATURES, final.weights.tolist()))
    report["bias"] = final.bias
    report["trained_at"] = timezone.now().isoformat()

    path = ranker_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({**final.to_dict(), "report": report}, indent=2))
    return report


def load_ranker():
    """(model, report) from ml/artifacts/ranker.json, or None if not trained yet.

    Cached in memory and reloaded automatically when the file changes, so
    re-running `train_models` takes effect without restarting the server.
    """
    path = ranker_path()
    if not path.exists():
        return None
    key = (str(path), path.stat().st_mtime)
    if _cache.get("ranker_key") != key:
        data = json.loads(path.read_text())
        _cache["ranker"] = (LogisticRegression.from_dict(data), data.get("report", {}))
        _cache["ranker_key"] = key
    return _cache["ranker"]


# ----------------------------------------------------------------- serving --

def ranked_home_feed(viewer, limit=20):
    """Stage 1: candidates (recent posts from people you follow). Stage 2: score and sort.

    Returns (posts, ranked). Each post gets a `.score`: the model's predicted
    probability that you'll like it. Without a trained model it falls back to
    newest-first and ranked is False.
    """
    loaded = load_ranker()
    h = load_history() if loaded else None
    candidates = list(feed_service.home_feed(viewer, limit=200))
    if not loaded or not candidates:
        return candidates[:limit], False

    model, _ = loaded
    now = timezone.now()
    scores = model.predict_proba([features(viewer.id, p.id, h, now) for p in candidates])
    for post, score in zip(candidates, scores):
        post.score = float(score)
    candidates.sort(key=lambda p: p.score, reverse=True)
    return candidates[:limit], True


def _follow_graph():
    following = defaultdict(set)
    for follower, followed in Follow.objects.values_list("follower_id", "following_id"):
        following[follower].add(followed)
    return following


def suggested_users(viewer, limit=5):
    """'Suggested for you': friends of friends, with a reason for each.

    Brand-new users have no friends of friends yet (the "cold start" problem),
    so the list is topped up with the most-followed accounts.
    """
    following = _follow_graph()
    popularity = dict(
        Follow.objects.values("following_id").annotate(n=Count("id")).values_list("following_id", "n")
    )
    ranked = friends_of_friends(viewer.id, following, popularity=popularity, limit=limit)
    if len(ranked) < limit:
        taken = following.get(viewer.id, set()) | {viewer.id} | {uid for uid, _ in ranked}
        for uid, _count in sorted(popularity.items(), key=lambda kv: -kv[1]):
            if len(ranked) >= limit:
                break
            if uid not in taken:
                ranked.append((uid, []))

    users = User.objects.in_bulk([uid for uid, _ in ranked])
    names = User.objects.in_bulk({m for _, mutuals in ranked for m in mutuals})
    suggestions = []
    for uid, mutuals in ranked:
        if uid not in users:
            continue
        mutual_names = [names[m].username for m in mutuals if m in names]
        if mutual_names:
            extra = len(mutual_names) - 1
            reason = f"Followed by {mutual_names[0]}" + (f" + {extra} more" if extra else "")
        else:
            reason = "Popular on mini·gram"
        suggestions.append({"user": users[uid], "reason": reason, "mutual_count": len(mutual_names)})
    return suggestions


def explore_for_you(viewer, limit=30):
    """Explore: posts from accounts you DON'T follow, picked by item-item CF.

    "People who liked what you liked also liked...". With no likes yet (cold
    start) or too few matches, it pads with the most-liked posts.
    """
    followed = set(Follow.objects.filter(follower=viewer).values_list("following_id", flat=True))
    exclude = set(Post.objects.filter(author_id__in=followed | {viewer.id}).values_list("id", flat=True))
    liked = set(Like.objects.filter(user=viewer).values_list("post_id", flat=True))

    scores = item_item_scores(Like.objects.values_list("user_id", "post_id"), viewer.id, exclude_items=exclude)
    picked = sorted(scores, key=scores.get, reverse=True)[:limit]
    reasons = {pid: "Because you liked similar posts" for pid in picked}

    if len(picked) < limit:
        popular = (
            Post.objects.exclude(id__in=exclude | liked | set(picked))
            .annotate(n=Count("likes"))
            .order_by("-n", "-created_at")
            .values_list("id", flat=True)[: limit - len(picked)]
        )
        for pid in popular:
            picked.append(pid)
            reasons[pid] = "Popular right now"

    by_id = {p.id: p for p in feed_service.annotate_for_viewer(Post.objects.filter(id__in=picked), viewer)}
    results = []
    for pid in picked:
        post = by_id.get(pid)
        if post is not None:
            post.reason = reasons[pid]
            results.append(post)
    return results
