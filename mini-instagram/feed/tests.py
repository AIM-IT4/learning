"""Tests — proof the core logic works, and runnable docs of how it behaves.

Run them with:  python manage.py test
"""
import shutil
import tempfile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from . import feed_service
from .models import Follow, Like, Post

# Write any uploaded files to a throwaway temp dir during tests, so running the
# suite never litters the real media/ folder.
_TMP_MEDIA = tempfile.mkdtemp()

# A 1x1 PNG, so Post.image has real bytes without needing Pillow to draw.
PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c6360000002000154a24f5f0000000049454e44ae426082"
)


def a_post(author, caption="hi"):
    img = SimpleUploadedFile(f"{caption}.png", PNG_1PX, content_type="image/png")
    return Post.objects.create(author=author, image=img, caption=caption)


@override_settings(MEDIA_ROOT=_TMP_MEDIA)
class FeedTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(_TMP_MEDIA, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.alice = User.objects.create_user("alice", password="x")
        self.bob = User.objects.create_user("bob", password="x")
        self.carol = User.objects.create_user("carol", password="x")

    def test_home_feed_shows_followed_and_own_only(self):
        """You see your own posts and those you follow — not strangers'."""
        Follow.objects.create(follower=self.alice, following=self.bob)
        mine = a_post(self.alice, "mine")
        bobs = a_post(self.bob, "bobs")
        a_post(self.carol, "carols")  # alice does NOT follow carol

        captions = {p.caption for p in feed_service.home_feed(self.alice)}
        self.assertEqual(captions, {"mine", "bobs"})
        self.assertNotIn("carols", captions)

    def test_feed_annotations(self):
        """like_count / liked_by_me are computed correctly for the viewer."""
        post = a_post(self.bob, "p")
        Follow.objects.create(follower=self.alice, following=self.bob)
        Like.objects.create(user=self.alice, post=post)
        Like.objects.create(user=self.carol, post=post)

        feed_post = feed_service.home_feed(self.alice)[0]
        self.assertEqual(feed_post.like_count, 2)
        self.assertTrue(feed_post.liked_by_me)

    def test_toggle_like_endpoint(self):
        post = a_post(self.bob, "p")
        self.client.force_login(self.alice)

        r1 = self.client.post(f"/posts/{post.id}/like/")
        self.assertEqual(r1.json(), {"liked": True, "like_count": 1})
        r2 = self.client.post(f"/posts/{post.id}/like/")  # toggle off
        self.assertEqual(r2.json(), {"liked": False, "like_count": 0})

    def test_cannot_follow_yourself(self):
        self.client.force_login(self.alice)
        r = self.client.post("/users/alice/follow/")
        self.assertEqual(r.status_code, 400)

    def test_api_feed_returns_json(self):
        """The JSON endpoint a phone app would call returns the same feed."""
        Follow.objects.create(follower=self.alice, following=self.bob)
        a_post(self.bob, "hello")
        self.client.force_login(self.alice)

        r = self.client.get("/api/feed/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(len(data["posts"]), 1)
        self.assertEqual(data["posts"][0]["author"], "bob")
        self.assertEqual(data["posts"][0]["caption"], "hello")
