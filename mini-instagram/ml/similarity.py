"""Two classic recommenders. Neither needs training.

1. friends_of_friends: powers "Suggested for you - Followed by maya + 2 more".
   If many people you follow also follow someone, you probably know them.
   Plain counting over the follow graph, and still a very strong baseline.

2. item_item_scores: powers Explore, "people who liked what you liked also
   liked...". Two posts are similar if the same people liked them (cosine
   similarity between their columns in a user x post "like" matrix).

At Instagram's scale (billions of users and posts) you cannot build these
matrices. Real systems learn an *embedding* (a list of numbers) for every user
and every post, then find neighbours with approximate nearest-neighbour search.
The intuition is exactly the same as here.
"""
import numpy as np


def friends_of_friends(viewer_id, following, popularity=None, limit=5):
    """Rank accounts the viewer doesn't follow by how many of their follows follow them.

    following:  {user_id: set of user_ids they follow}
    popularity: optional {user_id: follower count}, used to break ties
    Returns [(candidate_id, [mutual_user_ids]), ...], best first.
    """
    popularity = popularity or {}
    mine = following.get(viewer_id, set())
    mutuals = {}
    for friend in mine:
        for candidate in following.get(friend, set()):
            if candidate == viewer_id or candidate in mine:
                continue
            mutuals.setdefault(candidate, []).append(friend)
    ranked = sorted(mutuals.items(),
                    key=lambda kv: (-len(kv[1]), -popularity.get(kv[0], 0), kv[0]))
    return [(candidate, sorted(ms)) for candidate, ms in ranked[:limit]]


def item_item_scores(likes, viewer_id, exclude_items=()):
    """Score posts for the viewer by how similar they are to posts they already liked.

    likes: iterable of (user_id, post_id) pairs
    Returns {post_id: score} for posts the viewer has not liked, skipping
    `exclude_items`. A higher score means "more like what you enjoy".
    """
    likes = list(likes)
    users = sorted({u for u, _ in likes})
    items = sorted({i for _, i in likes})
    if viewer_id not in users:
        return {}                                       # cold start: no likes yet
    row = {u: k for k, u in enumerate(users)}
    col = {i: k for k, i in enumerate(items)}

    matrix = np.zeros((len(users), len(items)))         # matrix[user, post] = 1 if liked
    for u, i in likes:
        matrix[row[u], col[i]] = 1.0

    norms = np.linalg.norm(matrix, axis=0)
    norms[norms == 0] = 1.0
    similarity = (matrix.T @ matrix) / np.outer(norms, norms)   # post x post cosine similarity
    np.fill_diagonal(similarity, 0.0)

    liked = matrix[row[viewer_id]]
    scores = similarity @ liked                         # add up similarity to each liked post
    exclude = set(exclude_items)
    return {
        item: float(scores[k])
        for item, k in col.items()
        if not liked[k] and item not in exclude and scores[k] > 0
    }
