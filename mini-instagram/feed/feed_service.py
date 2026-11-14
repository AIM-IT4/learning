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
from django.db.models import Count, Exists, OuterRef, Prefetch, Q

from .models import Comment, Follow, Like, Post


def annotate_for_viewer(queryset, viewer):
    """Attach the numbers the UI needs to each post in one query.

    Without this you'd run extra queries per post (the classic 'N+1' problem).
    `annotate` pushes the counting into the database so the whole page is a
    couple of queries, not hundreds. At scale these counts would be cached in
    Memcached rather than counted every time.

    Comments hidden by the moderation filter are left out of `comment_count`
    and `visible_comments`; `hidden_comment_count` tells the post's owner how
    many the filter caught.
    """
    liked = Like.objects.filter(post=OuterRef("pk"), user=viewer)
    visible = Comment.objects.filter(is_hidden=False).select_related("author")
    return (
        queryset
        .select_related("author")                    # join the author in one query
        .prefetch_related(Prefetch("comments", queryset=visible, to_attr="visible_comments"))
        .annotate(
            like_count=Count("likes", distinct=True),
            comment_count=Count("comments", filter=Q(comments__is_hidden=False), distinct=True),
            hidden_comment_count=Count("comments", filter=Q(comments__is_hidden=True), distinct=True),
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
    # Explicit order_by is required: Django ignores the model's Meta.ordering
    # in queries with aggregations (the Count()s in annotate_for_viewer).
    return annotate_for_viewer(posts, viewer).order_by("-created_at", "-id")[:limit]


def user_posts(profile_user, viewer, limit=30):
    """All posts by one user, for their profile grid."""
    posts = Post.objects.filter(author=profile_user)
    return annotate_for_viewer(posts, viewer).order_by("-created_at", "-id")[:limit]

# The ranked "For you" feed and the Explore recommender live in recsys.py.
