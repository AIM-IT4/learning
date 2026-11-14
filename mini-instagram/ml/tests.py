"""Tests for the plain ML algorithms. No database needed.

Run with the rest of the suite:  python manage.py test
"""
import random
import unittest

from ml.logistic import LogisticRegression
from ml.metrics import accuracy, precision_recall, roc_auc
from ml.naive_bayes import NaiveBayes, tokenize
from ml.similarity import friends_of_friends, item_item_scores


class MetricsTests(unittest.TestCase):
    def test_auc_known_value(self):
        # Positives scored 0.35 and 0.8, negatives 0.1 and 0.4: 3 of 4 pairs are in the right order.
        self.assertAlmostEqual(roc_auc([0, 0, 1, 1], [0.1, 0.4, 0.35, 0.8]), 0.75)

    def test_auc_ties_and_extremes(self):
        self.assertAlmostEqual(roc_auc([0, 1], [0.5, 0.5]), 0.5)
        self.assertAlmostEqual(roc_auc([0, 1], [0.1, 0.9]), 1.0)

    def test_precision_recall(self):
        p, r = precision_recall(["a", "a", "b", "b"], ["a", "b", "a", "b"], "a")
        self.assertEqual((p, r), (0.5, 0.5))


class LogisticRegressionTests(unittest.TestCase):
    def test_learns_a_simple_rule(self):
        rng = random.Random(0)
        X = [[rng.uniform(-1, 1), rng.uniform(-1, 1)] for _ in range(300)]
        y = [1 if a + b > 0 else 0 for a, b in X]
        model = LogisticRegression().fit(X, y, feature_names=["a", "b"])
        preds = [int(p > 0.5) for p in model.predict_proba(X)]
        self.assertGreater(accuracy(y, preds), 0.95)
        self.assertTrue(all(w > 0 for w in model.weights))      # both features push towards 1

    def test_round_trips_through_json_dict(self):
        model = LogisticRegression().fit([[0.0], [1.0], [2.0], [3.0]], [0, 0, 1, 1])
        copy = LogisticRegression.from_dict(model.to_dict())
        self.assertAlmostEqual(float(model.predict_proba([[2.5]])[0]), float(copy.predict_proba([[2.5]])[0]))


class NaiveBayesTests(unittest.TestCase):
    def setUp(self):
        self.model = NaiveBayes().fit(
            ["love this photo", "so beautiful", "great shot", "free followers link in bio",
             "dm me for free promo", "click the link for free stuff"],
            ["ok", "ok", "ok", "spam", "spam", "spam"],
        )

    def test_tokenize(self):
        self.assertEqual(tokenize("Get FREE followers!!"), ["get", "free", "followers"])

    def test_classifies_obvious_cases(self):
        self.assertEqual(self.model.predict("free followers, see link"), "spam")
        self.assertEqual(self.model.predict("beautiful photo"), "ok")

    def test_probabilities_sum_to_one(self):
        self.assertAlmostEqual(sum(self.model.predict_proba("anything at all").values()), 1.0)


class SimilarityTests(unittest.TestCase):
    def test_friends_of_friends(self):
        following = {1: {2, 3}, 2: {4}, 3: {4, 5}, 4: set(), 5: set()}
        ranked = friends_of_friends(1, following)
        self.assertEqual(ranked[0], (4, [2, 3]))     # followed by both of 1's friends
        self.assertEqual(ranked[1], (5, [3]))

    def test_item_item_recommends_what_similar_people_liked(self):
        likes = [(1, "A"), (1, "B"), (2, "A"), (2, "B"), (2, "C"), (3, "D")]
        scores = item_item_scores(likes, viewer_id=1)
        self.assertIn("C", scores)          # liked by someone with the same taste
        self.assertNotIn("D", scores)       # nobody with overlapping taste liked D
        self.assertNotIn("A", scores)       # already liked


if __name__ == "__main__":
    unittest.main()
