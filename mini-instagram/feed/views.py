"""Views — the thin layer that turns an HTTP request into an HTTP response.

Notice how little lives here: views parse the request, call the models,
feed_service, recsys (recommendations) or moderation (comment filter), and
render a template or return JSON. Keeping logic OUT of views is what keeps a
big codebase maintainable.
"""
import math

from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from . import feed_service, moderation, recsys
from .models import Follow, Like, Post, Profile


@login_required
def feed(request):
    """The home timeline: "For you" (ranked by the model) or "Latest" (newest first)."""
    mode = "latest" if request.GET.get("mode") == "latest" else "for_you"
    if mode == "latest":
        posts, ranked = list(feed_service.home_feed(request.user, limit=20)), False
    else:
        posts, ranked = recsys.ranked_home_feed(request.user, limit=20)
    return render(request, "feed/feed.html", {
        "posts": posts,
        "title": "Home",
        "is_home": True,
        "mode": mode,
        "ranked": ranked,
        "suggestions": recsys.suggested_users(request.user),
    })


@login_required
def explore(request):
    """Recommended posts from accounts you don't follow (collaborative filtering)."""
    posts = recsys.explore_for_you(request.user)
    return render(request, "feed/feed.html", {"posts": posts, "title": "Explore", "is_explore": True})


@login_required
def profile(request, username):
    person = get_object_or_404(User, username=username)
    Profile.objects.get_or_create(user=person)  # make sure a profile row exists
    posts = feed_service.user_posts(person, request.user)
    context = {
        "person": person,
        "posts": posts,
        "post_count": Post.objects.filter(author=person).count(),
        "follower_count": Follow.objects.filter(following=person).count(),
        "following_count": Follow.objects.filter(follower=person).count(),
        "is_me": person == request.user,
        "i_follow": Follow.objects.filter(follower=request.user, following=person).exists(),
    }
    return render(request, "feed/profile.html", context)


@login_required
def upload(request):
    """Create a post. GET shows the form; POST saves it.

    Saving the ImageField writes the file under MEDIA_ROOT. That write is the
    toy version of Instagram's upload pipeline: receive bytes -> store in blob
    storage -> (async) transcode into multiple sizes -> serve via CDN.
    """
    if request.method == "POST" and request.FILES.get("image"):
        Post.objects.create(
            author=request.user,
            image=request.FILES["image"],
            caption=request.POST.get("caption", "").strip(),
        )
        return redirect("profile", username=request.user.username)
    return render(request, "feed/upload.html", {"title": "New post"})


@require_POST
@login_required
def toggle_like(request, post_id):
    """Like/unlike, returning JSON — the pattern the mobile app uses everywhere.

    The mobile app never reloads a page to like something; it POSTs to an
    endpoint like this and updates the heart from the JSON reply. Every like is
    also a training label for the ranking model the next time it is trained.
    """
    post = get_object_or_404(Post, id=post_id)
    like, created = Like.objects.get_or_create(user=request.user, post=post)
    if not created:
        like.delete()
    return JsonResponse({
        "liked": created,
        "like_count": Like.objects.filter(post=post).count(),
    })


@require_POST
@login_required
def toggle_follow(request, username):
    target = get_object_or_404(User, username=username)
    if target == request.user:
        return JsonResponse({"error": "cannot follow yourself"}, status=400)
    existing = Follow.objects.filter(follower=request.user, following=target)
    if existing.exists():
        existing.delete()
        following = False
    else:
        try:
            Follow.objects.create(follower=request.user, following=target)
            following = True
        except IntegrityError:
            following = True
    return JsonResponse({
        "following": following,
        "follower_count": Follow.objects.filter(following=target).count(),
    })


@require_POST
@login_required
def add_comment(request, post_id):
    """Every comment goes through the spam/abuse classifier on its way in."""
    post = get_object_or_404(Post, id=post_id)
    text = request.POST.get("text", "").strip()
    if text:
        moderation.create_comment(post, request.user, text[:2200])
    return redirect(request.META.get("HTTP_REFERER", "feed"))


@login_required
def api_feed(request):
    """The SAME feed, as JSON instead of HTML.

    This is the contract a phone app would call. One backend, two renderings:
    HTML for the browser, JSON for the app. Add ?mode=latest for newest-first.
    """
    if request.GET.get("mode") == "latest":
        posts, ranked = list(feed_service.home_feed(request.user, limit=20)), False
    else:
        posts, ranked = recsys.ranked_home_feed(request.user, limit=20)
    return JsonResponse({
        "ranked": ranked,
        "posts": [
            {
                "id": p.id,
                "author": p.author.username,
                "caption": p.caption,
                "image": p.image.url if p.image else None,
                "likes": p.like_count,
                "comments": p.comment_count,
                "liked_by_me": p.liked_by_me,
                "score": getattr(p, "score", None),     # model's predicted P(like), if ranked
                "created_at": p.created_at.isoformat(),
            }
            for p in posts
        ],
    })


def _pct(x):
    return 0 if x is None or math.isnan(x) else round(100 * x)


@login_required
def model_card(request):
    """'How the models work': what each model learned and how well it scores."""
    ranker = None
    loaded = recsys.load_ranker()
    if loaded:
        model, report = loaded
        weights = list(zip(model.feature_names, model.weights.tolist()))
        biggest = max(abs(w) for _, w in weights) or 1.0
        auc_rows = [{"name": "The model (all 4 features)", "auc": report.get("auc_model"),
                     "pct": _pct(report.get("auc_model")), "strong": True}]
        for name, auc in sorted(report.get("auc_baselines", {}).items(), key=lambda kv: -kv[1]):
            auc_rows.append({"name": f"{name} alone", "auc": auc, "pct": _pct(auc)})
        auc_rows.append({"name": "Coin flip", "auc": 0.5, "pct": 50})
        ranker = {
            **report,
            "positive_pct": _pct(report.get("positive_rate")),
            "auc_rows": auc_rows,
            "weights": [
                {"name": n, "help": recsys.FEATURE_HELP.get(n, ""), "weight": w,
                 "pct": round(100 * abs(w) / biggest), "positive": w >= 0}
                for n, w in sorted(weights, key=lambda nw: -abs(nw[1]))
            ],
        }

    tried = None
    text = request.GET.get("text", "").strip()[:500]
    if text:
        label, flagged, probs = moderation.classify(text)
        tried = {
            "text": text,
            "label": label,
            "hidden": flagged >= moderation.HIDE_THRESHOLD,
            "flagged_pct": _pct(flagged),
            "probs": [{"label": k, "pct": _pct(v)} for k, v in sorted(probs.items(), key=lambda kv: -kv[1])],
        }

    report = moderation.evaluate()
    report["accuracy_pct"] = _pct(report["accuracy"])
    report["rows"] = [
        {"label": label, "precision_pct": _pct(pr["precision"]), "recall_pct": _pct(pr["recall"])}
        for label, pr in report["per_class"].items()
    ]
    return render(request, "feed/models.html", {
        "title": "How the models work",
        "ranker": ranker,
        "moderation": report,
        "tried": tried,
        "threshold_pct": _pct(moderation.HIDE_THRESHOLD),
    })


def signup(request):
    """Create an account, then log in. Uses Django's built-in form."""
    if request.method == "POST":
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            Profile.objects.create(user=user)
            login(request, user)
            return redirect("feed")
    else:
        form = UserCreationForm()
    return render(request, "registration/signup.html", {"form": form})
