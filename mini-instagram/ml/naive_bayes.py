"""Multinomial Naive Bayes text classifier, from scratch in plain Python.

Naive Bayes was the original spam filter, and it is still a strong baseline.
Training is just counting: how often does each word appear in "spam" comments,
in "abuse" comments, in "ok" comments? To classify a new comment, combine for
each class its prior (how common the class is) with the probability of each of
the comment's words under that class, then pick the most probable class.

"Naive" means it assumes words are independent of each other. They are not,
but the classifier works surprisingly well anyway.

Instagram's real comment and spam classifiers are deep models over text,
images, account history and behaviour. This is the small, readable version.
"""
import math
import re
from collections import Counter, defaultdict

TOKEN = re.compile(r"[a-z0-9']+")


def tokenize(text):
    """'Get FREE followers!!' -> ['get', 'free', 'followers']"""
    return TOKEN.findall(text.lower())


class NaiveBayes:
    def __init__(self, alpha=1.0):
        # Laplace smoothing: pretend every word was seen `alpha` extra times in
        # every class, so a single unseen word can't zero out a whole class.
        self.alpha = alpha
        self.doc_counts = Counter()                 # label -> number of training comments
        self.word_counts = defaultdict(Counter)     # label -> word -> count
        self.total_words = Counter()                # label -> total words seen
        self.vocab = set()

    def fit(self, texts, labels):
        for text, label in zip(texts, labels):
            self.doc_counts[label] += 1
            for word in tokenize(text):
                self.word_counts[label][word] += 1
                self.total_words[label] += 1
                self.vocab.add(word)
        return self

    @property
    def labels(self):
        return sorted(self.doc_counts)

    def _log_prob_word(self, word, label):
        return math.log((self.word_counts[label][word] + self.alpha)
                        / (self.total_words[label] + self.alpha * len(self.vocab)))

    def predict_proba(self, text):
        """Return {label: probability}. Words never seen in training are skipped."""
        words = [w for w in tokenize(text) if w in self.vocab]
        n_docs = sum(self.doc_counts.values())
        log_scores = {}
        for label in self.labels:
            score = math.log(self.doc_counts[label] / n_docs)      # the prior
            for word in words:
                score += self._log_prob_word(word, label)          # times each word's likelihood
            log_scores[label] = score
        # Turn log-scores into probabilities safely (the "log-sum-exp" trick).
        top = max(log_scores.values())
        exps = {label: math.exp(s - top) for label, s in log_scores.items()}
        total = sum(exps.values())
        return {label: v / total for label, v in exps.items()}

    def predict(self, text):
        probs = self.predict_proba(text)
        return max(probs, key=probs.get)

    def top_words(self, label, n=8):
        """The words that point most strongly to `label`: the model's 'reasons'."""
        others = [lab for lab in self.labels if lab != label]
        scored = []
        for word in self.vocab:
            if self.word_counts[label][word] < 2:
                continue                                    # ignore one-off words
            mine = self._log_prob_word(word, label)
            rest = sum(self._log_prob_word(word, o) for o in others) / len(others)
            scored.append((mine - rest, word))
        return [w for _, w in sorted(scored, reverse=True)[:n]]

    def to_dict(self):
        return {
            "type": "naive_bayes",
            "alpha": self.alpha,
            "doc_counts": dict(self.doc_counts),
            "word_counts": {label: dict(c) for label, c in self.word_counts.items()},
        }

    @classmethod
    def from_dict(cls, data):
        model = cls(alpha=data["alpha"])
        model.doc_counts = Counter(data["doc_counts"])
        for label, counts in data["word_counts"].items():
            model.word_counts[label] = Counter(counts)
            model.total_words[label] = sum(counts.values())
            model.vocab.update(counts)
        return model
