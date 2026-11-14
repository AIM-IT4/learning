"""Views — the thin layer that turns an HTTP request into an HTTP response.

Notice how little lives here: views parse the request, call the model or
feed_service, and render a template or return JSON. Keeping logic OUT of views
(in models.py / feed_service.py) is what keeps a big codebase maintainable.
"""
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from . import feed_service
from .models import Comment, Follow, Like, Post, Profile


@login_required
def feed(request):
    """The home timeline."""
    posts = feed_service.home_feed(request.user, limit=20)
    return render(request, "feed/feed.html", {"posts": posts, "title": "Home"})


@login_required
def explore(request):
    posts = feed_service.explore_feed(request.user)
    return render(request, "feed/feed.html", {"posts": posts, "title": "Explore"})


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
    endpoint like this and updates the heart from the JSON reply.
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
    post = get_object_or_404(Post, id=post_id)
    text = request.POST.get("text", "").strip()
    if text:
        Comment.objects.create(post=post, author=request.user, text=text[:2200])
    return redirect(request.META.get("HTTP_REFERER", "feed"))


@login_required
def api_feed(request):
    """The SAME feed, as JSON instead of HTML.

    This is the contract a phone app would call. One backend, two renderings:
    HTML for the browser, JSON for the app. Instagram's apps talk JSON to the
    same backend the website uses.
    """
    posts = feed_service.home_feed(request.user, limit=20)
    return JsonResponse({
        "posts": [
            {
                "id": p.id,
                "author": p.author.username,
                "caption": p.caption,
                "image": p.image.url if p.image else None,
                "likes": p.like_count,
                "comments": p.comment_count,
                "liked_by_me": p.liked_by_me,
                "created_at": p.created_at.isoformat(),
            }
            for p in posts
        ]
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
