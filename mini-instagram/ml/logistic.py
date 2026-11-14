"""Logistic regression, from scratch with numpy.

The job: given a (viewer, post) pair described by a few numbers ("features"),
predict the probability that the viewer likes the post. Sort the feed by that
probability and you have a ranked feed. It is a classifier (like / no like)
used as a ranker.

Instagram's real rankers are large neural networks that predict many actions
(like, comment, share, watch time...) from thousands of signals. Logistic
regression is the same idea at its smallest: a weighted sum of features,
squashed into a probability. Its weights are readable, which makes it the best
model to learn on. In production you would use
sklearn.linear_model.LogisticRegression instead of writing the loop yourself.
"""
import numpy as np


def sigmoid(z):
    """Squash any number into (0, 1). Clipping avoids overflow in exp()."""
    return 1.0 / (1.0 + np.exp(-np.clip(z, -30.0, 30.0)))


class LogisticRegression:
    """Binary classifier: p(y = 1 | x) = sigmoid(w . x + b)."""

    def __init__(self, learning_rate=0.5, epochs=800, l2=0.001):
        self.learning_rate = learning_rate
        self.epochs = epochs
        self.l2 = l2                      # a small penalty that stops weights growing huge
        self.weights = None
        self.bias = 0.0
        self.mean = None
        self.std = None
        self.feature_names = []

    def _standardize(self, X):
        return (X - self.mean) / self.std

    def fit(self, X, y, feature_names=None):
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=float)

        # Put every feature on the same scale (mean 0, std 1). Without this, a
        # feature measured in big numbers would dominate the gradient, and the
        # learned weights could not be compared with each other.
        self.mean = X.mean(axis=0)
        self.std = X.std(axis=0)
        self.std[self.std == 0] = 1.0
        Xs = self._standardize(X)

        n, d = Xs.shape
        self.weights = np.zeros(d)
        self.bias = 0.0
        # Batch gradient descent on the log-loss: nudge every weight in the
        # direction that brings the predicted probabilities closer to the labels.
        for _ in range(self.epochs):
            p = sigmoid(Xs @ self.weights + self.bias)
            error = p - y                                   # how wrong each prediction is
            grad_w = Xs.T @ error / n + self.l2 * self.weights
            grad_b = error.mean()
            self.weights -= self.learning_rate * grad_w
            self.bias -= self.learning_rate * grad_b

        self.feature_names = list(feature_names) if feature_names else [f"x{i}" for i in range(d)]
        return self

    def predict_proba(self, X):
        X = np.atleast_2d(np.asarray(X, dtype=float))
        return sigmoid(self._standardize(X) @ self.weights + self.bias)

    def log_loss(self, X, y):
        p = np.clip(self.predict_proba(X), 1e-12, 1 - 1e-12)
        y = np.asarray(y, dtype=float)
        return float(-(y * np.log(p) + (1 - y) * np.log(1 - p)).mean())

    def to_dict(self):
        """Everything needed to rebuild the model, as plain JSON-friendly data."""
        return {
            "type": "logistic_regression",
            "feature_names": self.feature_names,
            "weights": self.weights.tolist(),
            "bias": float(self.bias),
            "mean": self.mean.tolist(),
            "std": self.std.tolist(),
        }

    @classmethod
    def from_dict(cls, data):
        model = cls()
        model.feature_names = list(data["feature_names"])
        model.weights = np.array(data["weights"], dtype=float)
        model.bias = float(data["bias"])
        model.mean = np.array(data["mean"], dtype=float)
        model.std = np.array(data["std"], dtype=float)
        return model
