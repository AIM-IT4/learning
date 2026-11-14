"""URL routes for the feed app. Each line maps a path to a view function."""
from django.urls import path

from . import views

urlpatterns = [
    path("", views.feed, name="feed"),
    path("explore/", views.explore, name="explore"),
    path("new/", views.upload, name="upload"),

    # Actions the UI calls (mostly JSON).
    path("posts/<int:post_id>/like/", views.toggle_like, name="toggle_like"),
    path("posts/<int:post_id>/comment/", views.add_comment, name="add_comment"),
    path("users/<str:username>/follow/", views.toggle_follow, name="toggle_follow"),

    # A JSON version of the feed — the "API" a phone app would hit.
    path("api/feed/", views.api_feed, name="api_feed"),

    # What the ML models learned, plus a box to try the comment filter.
    path("models/", views.model_card, name="model_card"),

    # Keep the profile route last: it matches a bare /<username>.
    path("<str:username>/", views.profile, name="profile"),
]
