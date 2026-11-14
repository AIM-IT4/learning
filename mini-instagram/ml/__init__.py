"""Tiny, from-scratch machine learning for mini-instagram.

Nothing in this package imports Django. These are plain algorithms you can read
and test on their own; the `feed` app turns database rows into the numbers they
expect (see feed/recsys.py and feed/moderation.py).

    logistic.py     logistic regression  -> "will this viewer like this post?" (a classifier)
    naive_bayes.py  Naive Bayes on text  -> flags spam and abusive comments (a classifier)
    similarity.py   graph + item-item CF -> "Suggested for you" and Explore (recommenders)
    metrics.py      AUC, accuracy, precision/recall, written out by hand
"""
