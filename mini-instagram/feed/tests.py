"""Tests — proof the core logic works, and runnable docs of how it behaves.

Run them with:  python manage.py test
(The ML algorithms themselves are tested in ml/tests.py.)
"""
import shutil
import tempfile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from . import feed_service, moderation, recsys
from .models import Comment, Follow, Like, Post

# Uploaded files and trained models go to throwaway temp dirs during tests, so
# running the suite never touches the real media/ or ml/artifacts/ folders.
_TMP_MEDIA = tempfile.mkdtemp()

# A 1x1 PNG, so Post.image has real bytes without needing Pillow to draw.
PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c6360000002000154a24f5f0000000049454e44ae426082"
)


def a_post(author, caption="hi"):
    img = SimpleUploadedFile("p.png", PNG_1PX, content_type="image/png")
    return Post.objects.create(author=author, image=img, caption=caption)


class IsolatedTestCase(TestCase):
    """Each test gets its own empty ML artifact folder."""

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(_TMP_MEDIA, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self._ml_dir = tempfile.mkdtemp()
        self._ml_settings = self.settings(ML_ARTIFACT_DIR=self._ml_dir)
        self._ml_settings.enable()

    def tearDown(self):
        self._ml_settings.disable()
        shutil.rmtree(self._ml_dir, ignore_errors=True)


@override_settings(MEDIA_ROOT=_TMP_MEDIA)
class FeedTests(IsolatedTestCase):
    def setUp(self):
        super().setUp()
        self.alice = User.objects.create_user("alice", password="x")
        self.bob = User.objects.create_user("bob", password="x")
        self.carol = User.objects.create_user("carol", password="x")

    def test_home_feed_shows_followed_and_own_only(self):
        """You see your own posts and those you follow — not strangers'."""
        Follow.objects.create(follower=self.alice, following=self.bob)
        a_post(self.alice, "mine")
        a_post(self.bob, "bobs")
        a_post(self.carol, "carols")  # alice does NOT follow carol

        captions = {p.caption for p in feed_service.home_feed(self.alice)}
        self.assertEqual(captions, {"mine", "bobs"})

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

        data = self.client.get("/api/feed/").json()
        self.assertEqual(len(data["posts"]), 1)
        self.assertEqual(data["posts"][0]["author"], "bob")
        self.assertEqual(data["posts"][0]["caption"], "hello")


@override_settings(MEDIA_ROOT=_TMP_MEDIA)
class ModerationTests(IsolatedTestCase):
    def setUp(self):
        super().setUp()
        self.alice = User.objects.create_user("alice", password="x")
        self.bob = User.objects.create_user("bob", password="x")
        self.post = a_post(self.bob, "bob's photo")
        Follow.objects.create(follower=self.alice, following=self.bob)

    def comment(self, user, text):
        self.client.force_login(user)
        self.client.post(f"/posts/{self.post.id}/comment/", {"text": text})
        return Comment.objects.latest("id")

    def test_spam_comment_is_hidden(self):
        c = self.comment(self.alice, "get free followers, check the link in my bio")
        self.assertTrue(c.is_hidden)
        self.assertEqual(c.moderation_label, "spam")
        post = feed_service.home_feed(self.alice)[0]
        self.assertEqual(post.comment_count, 0)          # hidden comments aren't counted
        self.assertEqual(post.hidden_comment_count, 1)

    def test_abusive_comment_is_hidden(self):
        c = self.comment(self.alice, "you're so ugly, delete this loser")
        self.assertTrue(c.is_hidden)
        self.assertEqual(c.moderation_label, "abuse")

    def test_normal_comment_is_visible(self):
        c = self.comment(self.alice, "love this, so beautiful")
        self.assertFalse(c.is_hidden)
        self.assertEqual(c.moderation_label, "ok")

    def test_only_the_owner_is_told_about_hidden_comments(self):
        self.comment(self.alice, "dm me for paid promo, free followers")
        self.client.force_login(self.bob)                      # bob owns the post
        self.assertContains(self.client.get("/?mode=latest"), "hidden by the spam/abuse filter")
        self.client.force_login(self.alice)
        self.assertNotContains(self.client.get("/?mode=latest"), "hidden by the spam/abuse filter")

    def test_filter_reports_its_accuracy(self):
        report = moderation.evaluate()
        self.assertGreater(report["accuracy"], 0.6)
        self.assertIn("free", report["top_words"]["spam"])


@override_settings(MEDIA_ROOT=_TMP_MEDIA)
class RecommendationTests(IsolatedTestCase):
    """A small social graph with clear tastes, for the ranker and recommenders."""

    def setUp(self):
        super().setUp()
        names = ["alice", "bob", "carol", "dave", "erin"]
        self.u = {n: User.objects.create_user(n, password="x") for n in names}
        for a, b in [("alice", "bob"), ("alice", "carol"), ("bob", "carol"), ("bob", "dave"),
                     ("carol", "alice"), ("dave", "alice"), ("dave", "bob"), ("erin", "dave")]:
            Follow.objects.create(follower=self.u[a], following=self.u[b])
        self.posts = {
            "bob": [a_post(self.u["bob"], f"bob {i} #food") for i in range(4)],
            "carol": [a_post(self.u["carol"], f"carol {i} #travel") for i in range(4)],
            "dave": [a_post(self.u["dave"], f"dave {i} #pets") for i in range(3)],
            "alice": [a_post(self.u["alice"], f"alice {i} #food") for i in range(3)],
            "erin": [a_post(self.u["erin"], f"erin {i} #food") for i in range(2)],
        }
        likes = [("alice", "bob", range(4)), ("alice", "carol", [0]), ("alice", "erin", [0]),
                 ("bob", "carol", range(4)), ("carol", "alice", range(2)),
                 ("dave", "alice", range(3)), ("dave", "bob", range(2)), ("erin", "dave", range(3))]
        for liker, author, idx in likes:
            for i in idx:
                Like.objects.create(user=self.u[liker], post=self.posts[author][i])

    def test_feed_falls_back_to_newest_first_without_a_model(self):
        posts, ranked = recsys.ranked_home_feed(self.u["alice"])
        self.assertFalse(ranked)
        times = [p.created_at for p in posts]
        self.assertEqual(times, sorted(times, reverse=True))

    def test_train_then_rank(self):
        report = recsys.train_ranker()
        self.assertGreaterEqual(report["examples"], 20)
        self.assertEqual(set(report["weights"]), set(recsys.FEATURES))

        posts, ranked = recsys.ranked_home_feed(self.u["alice"])
        self.assertTrue(ranked)
        scores = [p.score for p in posts]
        self.assertTrue(all(0.0 <= s <= 1.0 for s in scores))
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_suggested_users_are_friends_of_friends(self):
        suggestions = recsys.suggested_users(self.u["alice"])
        self.assertEqual(suggestions[0]["user"], self.u["dave"])   # alice follows bob, bob follows dave
        self.assertEqual(suggestions[0]["reason"], "Followed by bob")

    def test_explore_skips_followed_accounts_and_own_posts(self):
        authors = {p.author.username for p in recsys.explore_for_you(self.u["alice"])}
        self.assertTrue(authors)
        self.assertFalse(authors & {"alice", "bob", "carol"})

    def test_models_page(self):
        self.client.force_login(self.u["alice"])
        self.assertContains(self.client.get("/models/"), "Not trained yet")
        recsys.train_ranker()
        self.assertContains(self.client.get("/models/"), "cross-validation")
        self.assertContains(self.client.get("/models/", {"text": "free followers, link in bio"}), "Verdict: <b>spam</b>")
