"""Comment moderation: a Naive Bayes classifier decides whether a comment looks
like spam or abuse.

This is the toy version of Instagram's "Hide offensive comments" and spam
filtering. Flagged comments are never silently deleted: they are kept but
hidden from everyone except the post's owner, who can see that the filter
caught something. Every comment is created through `create_comment()` below,
so nothing skips the filter.
"""
import json
from pathlib import Path

from django.conf import settings

from ml.metrics import accuracy, confusion_matrix, precision_recall
from ml.naive_bayes import NaiveBayes

from .comment_labels import LABELED_COMMENTS
from .models import Comment

LABELS = ("ok", "spam", "abuse")
HIDE_THRESHOLD = 0.70      # hide a comment when P(spam) + P(abuse) is at least this

_cache = {}


def filter_path():
    return Path(settings.ML_ARTIFACT_DIR) / "comment_filter.json"


def train_filter(examples=LABELED_COMMENTS):
    return NaiveBayes().fit([text for text, _ in examples], [label for _, label in examples])


def save_filter(model):
    path = filter_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(model.to_dict(), indent=1))
    return path


def get_filter():
    """The trained filter: loaded from ml/artifacts/ if saved, else trained in memory.

    Training takes milliseconds, so the app works even before you run
    `train_models`. The cache reloads automatically when the file changes.
    """
    path = filter_path()
    key = (str(path), path.stat().st_mtime if path.exists() else None)
    if _cache.get("key") != key:
        if path.exists():
            _cache["model"] = NaiveBayes.from_dict(json.loads(path.read_text()))
        else:
            _cache["model"] = train_filter()
        _cache["key"] = key
    return _cache["model"]


def classify(text):
    """Return (most likely label, P(spam or abuse), {label: probability})."""
    probs = get_filter().predict_proba(text)
    flagged = probs.get("spam", 0.0) + probs.get("abuse", 0.0)
    return max(probs, key=probs.get), flagged, probs


def create_comment(post, author, text):
    """The one place comments are created, so every comment passes the filter."""
    label, flagged, _ = classify(text)
    return Comment.objects.create(
        post=post,
        author=author,
        text=text,
        is_hidden=flagged >= HIDE_THRESHOLD,
        moderation_label=label,
        moderation_score=round(flagged, 4),
    )


def evaluate():
    """How good is the filter? Hold out every 4th example, train on the rest, measure.

    Testing on examples the model never saw is the only honest measurement.
    Scoring a model on its own training data mostly measures its memory.
    """
    train = [x for i, x in enumerate(LABELED_COMMENTS) if i % 4]
    test = [x for i, x in enumerate(LABELED_COMMENTS) if not i % 4]
    model = train_filter(train)
    y_true = [label for _, label in test]
    y_pred = [model.predict(text) for text, _ in test]
    per_class = {}
    for label in LABELS:
        precision, recall = precision_recall(y_true, y_pred, label)
        per_class[label] = {"precision": precision, "recall": recall}
    full = train_filter()
    return {
        "examples": len(LABELED_COMMENTS),
        "train": len(train),
        "test": len(test),
        "accuracy": accuracy(y_true, y_pred),
        "per_class": per_class,
        "confusion": confusion_matrix(y_true, y_pred, LABELS),
        "top_words": {label: full.top_words(label) for label in ("spam", "abuse")},
        "misses": [
            {"text": text, "true": t, "pred": p}
            for (text, t), p in zip(test, y_pred) if t != p
        ],
    }
