"""Labelled training data for the comment filter: (comment text, label).

Real moderation models learn from millions of comments that people reported or
reviewers labelled. This is a tiny hand-written set, so treat the filter as a
demonstration of the idea, not a production-ready moderator. Add your own
examples here and re-run `python manage.py train_models` to improve it.

Labels:
  ok     normal comments
  spam   promotion, scams, "follow for follow"
  abuse  insults and harassment (kept mild here)
"""

OK = [
    "love this", "so beautiful", "where is this place?", "great shot!", "this looks delicious",
    "can't wait to visit", "amazing colours", "goals", "need this in my life", "the lighting is perfect",
    "wow just wow", "miss this place", "recipe please?", "your best one yet", "so cute omg",
    "what camera do you use?", "that view though", "happy birthday!", "beautiful work as always",
    "this made my day", "adorable", "stunning", "proud of you", "looks so peaceful", "i'm hungry now",
    "absolutely gorgeous", "love the composition", "how long did this take?", "great design",
    "such a good boy", "can we go here together?", "the colours are amazing", "obsessed with this",
    "you always find the best spots", "teach me your ways", "hope you had fun", "this is so creative",
    "my favourite post this week", "looks tasty", "so much talent",
]

SPAM = [
    "follow me for free followers", "check my bio for free followers",
    "dm me for a collab, paid promo available", "earn $500 a day from home, link in bio",
    "click the link in my bio to win a free iphone", "want more followers? visit my page",
    "crypto signals, guaranteed profit, dm now", "free giveaway, click my profile link",
    "buy cheap followers and likes at my site", "i made 10k this week, ask me how",
    "promote your page with us, dm for prices", "follow for follow? f4f", "like4like follow4follow",
    "investment opportunity, double your money, dm me", "get verified fast, message me",
    "click the link in my profile for a surprise", "gain 1000 followers instantly, link in bio",
    "send me a dm to claim your prize", "make money online fast, check bio",
    "dm me to become a brand ambassador, free products", "visit my page for amazing deals",
    "bitcoin giveaway, send a dm now", "free followers, no password needed",
    "check out my profile for exclusive offers", "limited offer, click the link in bio now",
]

ABUSE = [
    "you're so ugly", "worst photo ever, delete this", "nobody cares, loser", "this is stupid",
    "trash content, unfollow", "go away idiot", "you have no talent", "what a dumb post", "pathetic",
    "you look terrible", "stop posting, it's embarrassing", "this is garbage",
    "so cringe, delete your account", "ugly and boring", "idiot, learn to take photos",
    "lame and stupid", "you're a joke", "awful, just awful, loser", "nobody likes you",
    "shut up already", "your photos are trash", "clown", "disgusting post", "you're so annoying",
    "dumb and ugly",
]

LABELED_COMMENTS = (
    [(t, "ok") for t in OK] + [(t, "spam") for t in SPAM] + [(t, "abuse") for t in ABUSE]
)
