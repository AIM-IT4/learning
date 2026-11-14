"""`python manage.py train_models` — train both classifiers, show how good they are, save them.

1. The feed ranker (logistic regression), trained on everyone's likes.
2. The comment filter (Naive Bayes), trained on feed/comment_labels.py.

Both are saved as readable JSON in ml/artifacts/. Open the files: a trained
model is just numbers. The running app reloads them automatically.
"""
from django.core.management.base import BaseCommand

from feed import moderation, recsys


class Command(BaseCommand):
    help = "Train the feed ranker and the comment filter, report their accuracy, and save them."

    def handle(self, *args, **options):
        out, style = self.stdout, self.style

        out.write(style.MIGRATE_HEADING("\n1/2  Feed ranker: logistic regression predicting 'will they like it?'"))
        try:
            r = recsys.train_ranker()
        except ValueError as exc:
            out.write(style.WARNING(f"  Skipped: {exc}"))
        else:
            out.write(f"  Data:  {r['examples']} viewer-post pairs, {r['positive_rate']:.0%} liked")
            out.write(f"  AUC with {r['folds']}-fold cross-validation, every pair scored by a model "
                      "that never saw it (0.5 = coin flip, 1.0 = perfect):")
            out.write(style.SUCCESS(f"    {'the model':<22} {r['auc_model']:.3f}"))
            for name, auc in sorted(r["auc_baselines"].items(), key=lambda kv: -kv[1]):
                out.write(f"    {name + ' alone':<22} {auc:.3f}")
            out.write("  Learned weights (standardised; bigger = pushes a post up the feed):")
            for name, w in sorted(r["weights"].items(), key=lambda kv: -abs(kv[1])):
                out.write(f"    {name:<18} {w:+.2f}   {recsys.FEATURE_HELP[name]}")
            out.write(f"  Saved {recsys.ranker_path()}")

        out.write(style.MIGRATE_HEADING("\n2/2  Comment filter: Naive Bayes, labels ok / spam / abuse"))
        rep = moderation.evaluate()
        out.write(f"  Data:  {rep['examples']} labelled comments (trained on {rep['train']}, "
                  f"tested on {rep['test']} unseen)")
        out.write(style.SUCCESS(f"  Accuracy on unseen comments: {rep['accuracy']:.0%}"))
        for label, pr in rep["per_class"].items():
            out.write(f"    {label:<6} precision {pr['precision']:.0%}   recall {pr['recall']:.0%}")
        for label, words in rep["top_words"].items():
            out.write(f"  Words that most suggest {label}: {', '.join(words)}")
        for miss in rep["misses"]:
            out.write(f"  Missed: \"{miss['text']}\" is {miss['true']}, guessed {miss['pred']}")
        path = moderation.save_filter(moderation.train_filter())
        out.write(f"  Saved {path}")

        out.write(style.SUCCESS("\nDone. Open the app's 'Models' page to see the same numbers as charts."))
