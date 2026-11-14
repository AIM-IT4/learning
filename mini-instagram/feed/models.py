"""The data model — the heart of the app.

Each class below becomes a database table. Django's ORM turns these Python
classes into SQL, so you describe *shape and relationships* and never write
CREATE TABLE by hand.

Real-Instagram mapping:
  - These relational tables (users, posts, follows) are exactly what lives in
    Instagram's sharded PostgreSQL.
  - The *feed* itself (what each user sees) is NOT a table you query live at
    their scale — it is precomputed and stored in Cassandra. Here we compute it
    live in feed_service.py, which is fine for thousands of rows and lets you
    see the logic plainly.
"""
from django.contrib.auth.models import User
from django.db import models


class Profile(models.Model):
    """Extra fields hung off Django's built-in User (bio, avatar).

    One Profile per User (OneToOne). We reuse django.contrib.auth.User for
    login/passwords instead of reinventing authentication.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    bio = models.CharField(max_length=160, blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

    def __str__(self):
        return f"@{self.user.username}"


class Post(models.Model):
    """One photo + caption by one author."""
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="posts")
    image = models.ImageField(upload_to="posts/")
    caption = models.CharField(max_length=2200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Newest first by default, and an index on (author, created_at) because
        # "this user's posts, newest first" is the query the feed runs most.
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["author", "-created_at"])]

    def __str__(self):
        return f"Post {self.pk} by @{self.author.username}"


class Follow(models.Model):
    """A directed edge: `follower` follows `following`.

    This tiny table is the 'social graph'. At Instagram scale the graph is huge
    and lives in a specialised store, but the shape is the same: who follows whom.
    """
    follower = models.ForeignKey(User, on_delete=models.CASCADE, related_name="following_set")
    following = models.ForeignKey(User, on_delete=models.CASCADE, related_name="follower_set")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # You can't follow the same person twice.
        constraints = [
            models.UniqueConstraint(fields=["follower", "following"], name="uniq_follow"),
            models.CheckConstraint(
                condition=~models.Q(follower=models.F("following")),
                name="no_self_follow",
            ),
        ]

    def __str__(self):
        return f"@{self.follower.username} → @{self.following.username}"


class Like(models.Model):
    """A user liking a post. One row per (user, post)."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="likes")
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "post"], name="uniq_like"),
        ]


class Comment(models.Model):
    """A comment on a post."""
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="comments")
    text = models.CharField(max_length=2200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
