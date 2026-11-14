"""The feed algorithm, kept in its own file on purpose.

This is the single most interesting part of the whole app, so it lives apart
from the views (which just handle HTTP) — the same separation a real codebase
uses to keep business logic testable.

TWO WAYS TO BUILD A FEED
------------------------
1. Fan-out on READ (what we do here):
   When you open the app, we ask "give me recent posts from everyone I follow".
   Simple, always fresh, but the work happens at read time — and reads are far
   more frequent than writes.

2. Fan-out on WRITE (closer to what Instagram does):
   When someone posts, we immediately push that post id into the precomputed
   feed of every follower (stored in Cassandra). Reads become a cheap lookup.
   The cost moves to write time, and celebrities with millions of followers get
   special handling (their posts are merged in at read time instead).

We use approach 1 because it is easy to read and correct for a small database.
The comments mark where Instagram would reach for Cassandra and Memcached.
"""
from django.contrib.auth.models import User
from django.db.models import Count, Exists, OuterRef

from .models import Follow, Like, Post


def _annotate_for_viewer(queryset, viewer):
    """Attach the numbers the UI needs to each post in one query.

    Without this you'd run extra queries per post (the classic 'N+1' problem).
    `annotate` pushes the counting into the database so the whole page is a
    couple of queries, not hundreds. At scale these counts would be cached in
    Memcached rather than counted every time.
    """
    liked = Like.objects.filter(post=OuterRef("pk"), user=viewer)
    return (
        queryset
        .select_related("author")                    # join the author in one query
        .annotate(
            like_count=Count("likes", distinct=True),
            comment_count=Count("comments", distinct=True),
            liked_by_me=Exists(liked),
        )
    )


def home_feed(viewer, limit=20, before_id=None):
    """Posts from the people `viewer` follows, plus their own, newest first.

    `before_id` enables simple pagination ("show older"): pass the id of the
    last post you saw. Instagram's feed is paginated the same way (a cursor),
    never with huge OFFSETs.
    """
    following_ids = Follow.objects.filter(follower=viewer).values_list("following_id", flat=True)
    authors = list(following_ids) + [viewer.id]      # include your own posts

    posts = Post.objects.filter(author_id__in=authors)
    if before_id:
        posts = posts.filter(id__lt=before_id)
    return _annotate_for_viewer(posts, viewer)[:limit]


def explore_feed(viewer, limit=30):
    """A naive 'explore': the most recent posts from everyone.

    The real Explore tab is a heavy machine-learning ranking problem. This is
    just 'newest globally' so you can see posts before you follow anyone.
    """
    return _annotate_for_viewer(Post.objects.all(), viewer)[:limit]


def user_posts(profile_user, viewer, limit=30):
    """All posts by one user, for their profile grid."""
    return _annotate_for_viewer(Post.objects.filter(author=profile_user), viewer)[:limit]
