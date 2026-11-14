"""`python manage.py seed_demo` — fill the app with demo data to click around.

Creates a few users (all password "password123"), has them follow each other,
and generates colourful gradient images with Pillow so every post has a real
photo file. Generating those images is a tiny stand-in for Instagram's media
pipeline: make bytes -> save to storage -> reference from the Post row.
"""
import io
import random

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from PIL import Image, ImageDraw

from feed.models import Comment, Follow, Like, Post, Profile

USERS = [
    ("maya", "shoots mountains + coffee ☕"),
    ("leo", "street photography, mostly film"),
    ("ravi", "food, trains, and more food"),
    ("nina", "design · type · neon"),
]
CAPTIONS = [
    "golden hour hits different", "no filter needed", "caught this one just in time",
    "sunday mood", "the view was worth the climb", "colours of the city tonight",
    "tried something new today", "late night edit", "found this little corner",
]


def gradient_image(seed):
    """Draw a 600x600 diagonal gradient — a cheap, pretty placeholder photo."""
    rng = random.Random(seed)
    c1 = tuple(rng.randint(40, 230) for _ in range(3))
    c2 = tuple(rng.randint(40, 230) for _ in range(3))
    img = Image.new("RGB", (600, 600))
    px = img.load()
    for y in range(600):
        for x in range(0, 600, 4):           # step 4 px: fast enough, looks smooth
            t = (x + y) / 1200
            col = tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3))
            for dx in range(4):
                if x + dx < 600:
                    px[x + dx, y] = col
    ImageDraw.Draw(img).ellipse((230, 230, 370, 370), fill=tuple((c + 90) % 256 for c in c1))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=80)
    return ContentFile(buf.getvalue(), name=f"seed_{seed}.jpg")


class Command(BaseCommand):
    help = "Create demo users, posts, follows, likes and comments."

    def handle(self, *args, **options):
        if Post.objects.exists():
            self.stdout.write(self.style.WARNING("Data already exists; skipping. "
                                                 "Delete db.sqlite3 to reseed."))
            return

        users = []
        for name, bio in USERS:
            u = User.objects.create_user(name, password="password123")
            Profile.objects.create(user=u, bio=bio)
            users.append(u)
        self.stdout.write(f"Created {len(users)} users (password: password123).")

        # Everyone follows everyone else.
        for a in users:
            for b in users:
                if a != b:
                    Follow.objects.get_or_create(follower=a, following=b)

        # A handful of posts each.
        seed = 0
        posts = []
        for u in users:
            for _ in range(random.randint(2, 4)):
                seed += 1
                posts.append(Post.objects.create(
                    author=u,
                    image=gradient_image(seed),
                    caption=random.choice(CAPTIONS),
                ))
        self.stdout.write(f"Created {len(posts)} posts.")

        # Random likes and a few comments.
        for p in posts:
            for u in random.sample(users, random.randint(0, len(users))):
                Like.objects.get_or_create(user=u, post=p)
            if random.random() < 0.6:
                Comment.objects.create(
                    post=p, author=random.choice(users),
                    text=random.choice(["🔥", "love this", "where is this?", "so good", "👏👏"]),
                )

        self.stdout.write(self.style.SUCCESS(
            "Done. Run `python manage.py runserver`, open http://127.0.0.1:8000, "
            "and log in as maya / password123."
        ))
