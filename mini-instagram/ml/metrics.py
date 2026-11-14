"""Evaluation metrics, written out by hand so nothing is a black box.

A model is only as good as the way you measure it. Two kinds of number matter here:

  * AUC (for the feed ranker): pick one post the viewer liked and one they
    didn't. How often does the model score the liked one higher?
    0.5 = coin flip, 1.0 = perfect. Ranking is about ORDER, so AUC fits.
  * Precision / recall (for the comment filter): of the comments we hid, how
    many deserved it (precision)? Of the comments that deserved hiding, how
    many did we catch (recall)? Hiding a real comment annoys people; missing
    spam lets it through. A filter has to balance both.
"""
import numpy as np


def roc_auc(y_true, scores):
    """Area under the ROC curve, via the rank (Mann-Whitney U) formula.

    Tied scores share the average of their ranks, so a constant score gives
    exactly 0.5. Returns NaN when only one class is present (AUC is undefined).
    """
    y = np.asarray(y_true).astype(bool)
    s = np.asarray(scores, dtype=float)
    n_pos = int(y.sum())
    n_neg = len(y) - n_pos
    if n_pos == 0 or n_neg == 0:
        return float("nan")

    order = np.argsort(s, kind="mergesort")
    sorted_s = s[order]
    ranks = np.empty(len(s))
    i = 0
    while i < len(s):                                 # walk runs of equal scores
        j = i
        while j + 1 < len(s) and sorted_s[j + 1] == sorted_s[i]:
            j += 1
        ranks[order[i:j + 1]] = (i + j + 2) / 2.0     # average 1-based rank of the run
        i = j + 1
    return float((ranks[y].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def accuracy(y_true, y_pred):
    pairs = list(zip(y_true, y_pred))
    return sum(t == p for t, p in pairs) / len(pairs) if pairs else float("nan")


def precision_recall(y_true, y_pred, label):
    """Precision and recall for one class label."""
    tp = fp = fn = 0
    for t, p in zip(y_true, y_pred):
        if p == label and t == label:
            tp += 1
        elif p == label:
            fp += 1
        elif t == label:
            fn += 1
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    return precision, recall


def confusion_matrix(y_true, y_pred, labels):
    """counts[true_label][predicted_label]."""
    counts = {t: {p: 0 for p in labels} for t in labels}
    for t, p in zip(y_true, y_pred):
        counts[t][p] += 1
    return counts
