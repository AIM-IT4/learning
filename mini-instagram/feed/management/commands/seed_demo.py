"""`python manage.py seed_demo` — fill the app with demo data worth learning from.

Machine learning needs data with patterns in it, so the demo users here have
*tastes*: each one loves a topic (food, travel, design or pets), follows
people with similar interests, and likes posts according to

    topic interest + how close they are to the author + how fresh the post is + luck

The models never see those hidden tastes. They have to rediscover them from
likes alone, exactly like a real recommender. All users have the password
"password123". Use --fresh to wipe existing demo data first.
"""
import io
import math
import random
from collections import defaultdict
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone
from PIL import Image, ImageDraw

from feed.models import Follow, Like, Post, Profile
from feed.moderation import create_comment

TOPICS = {
    "food":   {"colors": ((255, 140, 66), (214, 40, 57)),
               "captions": ["sunday brunch done right", "homemade and proud", "best noodles in town",
                            "tried a new recipe today", "street food crawl", "dessert first, always"]},
    "travel": {"colors": ((46, 134, 222), (16, 172, 132)),
               "captions": ["the view was worth the climb", "lost in a new city", "sunrise from the summit",
                            "island time", "golden hour by the sea", "one more stamp in the passport"]},
    "design": {"colors": ((131, 58, 180), (253, 29, 105)),
               "captions": ["new poster series", "playing with type", "colour study no. 7",
                            "late night edit", "grid experiments", "neon mood board"]},
    "pets":   {"colors": ((255, 190, 90), (120, 180, 90)),
               "captions": ["who's a good boy", "nap champion", "first day at the park",
                            "caught mid zoomies", "she owns the couch now", "treat negotiations"]},
}

# name, favourite topic, second topic, bio
USERS = [
    ("maya", "travel", "food", "chasing sunsets"),
    ("leo", "design", "travel", "type nerd, posters"),
    ("ravi", "food", "pets", "food, trains, and more food"),
    ("nina", "design", None, "design and neon"),
    ("arjun", "travel", None, "mountains over beaches"),
    ("zoe", "pets", "food", "my dog runs this account"),
    ("kai", "design", "travel", "pixels and passports"),
    ("priya", "food", "travel", "home cook, street food hunter"),
    ("omar", "travel", "pets", "backpacking, 40 countries"),
    ("lena", "pets", "design", "cats and colour palettes"),
    ("sam", "food", None, "baking every weekend"),
    ("ivy", "design", "pets", "illustrator"),
    ("tara", "pets", "travel", "rescue dogs and road trips"),
    ("felix", "food", "design", "plating is an art"),
    ("mei", "travel", "design", "maps, trains and typography"),
    ("jonas", "design", None, "brand identities"),
    ("aisha", "food", None, "spice collector"),
    ("noah", "pets", None, "three cats, zero regrets"),
    ("rosa", "travel", "food", "eating my way around the world"),
    ("dev", "design", "food", "ui designer who cooks"),
]

OK_COMMENTS = ["love this so much", "where was this taken?", "so pretty", "making me hungry",
               "need to go here", "cutest thing ever", "great colours", "wow", "beautiful", "perfect shot"]
SPAM_COMMENTS = ["get free followers fast, check my bio", "dm me for paid promo, cheap prices",
                 "win a free phone, click the link in my profile", "earn money from home, ask me how"]
TROLL_COMMENTS = ["so ugly, delete this loser", "worst photo ever, stop posting", "this is trash, nobody cares"]


def make_image(topic, rng):
    """A 600x600 'photo': a topic-coloured gradient with a simple topic symbol."""
    c1, c2 = TOPICS[topic]["colors"]

    def jitter(c):
        return tuple(max(0, min(255, v + rng.randint(-35, 35))) for v in c)

    a, b = jitter(c1), jitter(c2)
    mid = tuple((x + y) // 2 for x, y in zip(a, b))
    img = Image.new("RGB", (2, 2))
    img.putdata([a, mid, mid, b])
    img = img.resize((600, 600), Image.BILINEAR)        # smooth diagonal gradient, instantly
    d = ImageDraw.Draw(img)
    white, soft = (255, 255, 255), tuple(min(255, v + 70) for v in a)
    if topic == "food":                                  # a plate
        d.ellipse((140, 140, 460, 460), outline=white, width=16)
        d.ellipse((215, 215, 385, 385), fill=soft)
    elif topic == "travel":                              # mountains and a sun
        d.ellipse((420, 90, 520, 190), fill=(255, 226, 120))
        d.polygon([(40, 500), (240, 200), (440, 500)], fill=white)
        d.polygon([(250, 500), (420, 270), (580, 500)], fill=soft)
    elif topic == "design":                              # nested shapes
        d.polygon([(300, 110), (490, 300), (300, 490), (110, 300)], outline=white, width=14)
        d.rectangle((245, 245, 355, 355), fill=white)
    else:                                                # a paw
        d.ellipse((215, 290, 385, 450), fill=white)
        for x, y in ((165, 215), (245, 160), (335, 160), (415, 215)):
            d.ellipse((x - 38, y - 42, x + 38, y + 42), fill=white)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=82)
    return ContentFile(buf.getvalue(), name=f"{topic}_{rng.randint(0, 10**9)}.jpg")


def sigmoid(z):
    return 1 / (1 + math.exp(-z))


class Command(BaseCommand):
    help = "Create demo users with real tastes, plus posts, follows, likes and comments."

    def add_arguments(self, parser):
        parser.add_argument("--fresh", action="store_true",
                            help="Delete all non-admin users and their posts first, then reseed.")

    def handle(self, *args, fresh=False, **options):
        if fresh:
            for post in Post.objects.all():
                post.image.delete(save=False)            # remove the old photo files too
            deleted, _ = User.objects.filter(is_staff=False, is_superuser=False).delete()
            self.stdout.write(f"Wiped old demo data ({deleted} rows).")
        elif Post.objects.exists():
            self.stdout.write(self.style.WARNING(
                "Data already exists; skipping. Run `python manage.py seed_demo --fresh` to replace it."))
            return

        rng = random.Random(42)                          # same "random" data on every run
        now = timezone.now()

        # 1. Users and their hidden tastes.
        users, interest = {}, {}
        for name, primary, secondary, bio in USERS:
            user = User.objects.create_user(name, password="password123")
            Profile.objects.create(user=user, bio=bio)
            users[name] = user
            interest[user.id] = {t: 1.0 if t == primary else 0.5 if t == secondary else 0.05 for t in TOPICS}

        # 2. Follows: people with overlapping interests are more likely to follow each other.
        def overlap(a, b):
            va, vb = interest[a.id], interest[b.id]
            dot = sum(va[t] * vb[t] for t in TOPICS)
            return dot / math.sqrt(sum(v * v for v in va.values()) * sum(v * v for v in vb.values()))

        following = defaultdict(set)
        for a in users.values():
            for b in users.values():
                if a != b and rng.random() < 0.15 + 0.55 * overlap(a, b):
                    Follow.objects.create(follower=a, following=b)
                    following[a.id].add(b.id)

        # 3. Posts, spread over the last ten days, each tagged with its topic.
        posts = []                                       # (Post, topic, age in hours)
        for name, primary, secondary, _bio in USERS:
            for _ in range(rng.randint(5, 8)):
                topic = primary if secondary is None or rng.random() < 0.75 else secondary
                post = Post.objects.create(
                    author=users[name],
                    image=make_image(topic, rng),
                    caption=f"{rng.choice(TOPICS[topic]['captions'])} #{topic}",
                )
                age_hours = rng.uniform(1, 10 * 24)
                Post.objects.filter(pk=post.pk).update(created_at=now - timedelta(hours=age_hours))
                posts.append((post, topic, age_hours))

        # 4. Likes: who sees what, and the hidden rule for liking it.
        closeness = {(a, b): rng.random() for a in following for b in following[a]}
        likes = []
        for user in users.values():
            for post, topic, age_hours in posts:
                if post.author_id == user.id:
                    continue
                follows = post.author_id in following[user.id]
                if rng.random() > (0.9 if follows else 0.15):     # most posts you see are from people you follow
                    continue
                z = (-2.6 + 3.2 * interest[user.id][topic]
                     + 1.8 * closeness.get((user.id, post.author_id), 0.0)
                     + 1.2 * math.exp(-age_hours / 72))
                if rng.random() < sigmoid(z):
                    likes.append(Like(user=user, post=post))
        Like.objects.bulk_create(likes)

        # 5. Comments, all through the moderation filter. A spam bot and a troll
        #    show the filter at work: their comments arrive hidden.
        for like in rng.sample(likes, k=min(30, len(likes))):
            create_comment(like.post, like.user, rng.choice(OK_COMMENTS))
        bot = User.objects.create_user("free_followers_4u", password=None)
        troll = User.objects.create_user("grumpy_gus", password=None)
        Profile.objects.create(user=bot, bio="$$$")
        Profile.objects.create(user=troll, bio="")
        for text, (post, _t, _a) in zip(SPAM_COMMENTS, rng.sample(posts, len(SPAM_COMMENTS))):
            create_comment(post, bot, text)
        for text, (post, _t, _a) in zip(TROLL_COMMENTS, rng.sample(posts, len(TROLL_COMMENTS))):
            create_comment(post, troll, text)

        hidden = sum(1 for p, _t, _a in posts for c in p.comments.all() if c.is_hidden)
        self.stdout.write(self.style.SUCCESS(
            f"Created {len(users)} users, {len(posts)} posts, {sum(len(v) for v in following.values())} follows, "
            f"{len(likes)} likes. The comment filter hid {hidden} spam/abuse comments."))
        self.stdout.write("Next: `python manage.py train_models`, then `python manage.py runserver` "
                          "and log in as maya / password123.")
