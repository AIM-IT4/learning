"""Top-level URL routing — the switchboard that maps a URL path to code.

A request for /feed comes in here first, then gets handed to the `feed` app's
own url file. This mirrors how a big Django codebase is organised: a thin root
router that `include()`s each app.
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import include, path

from feed import views as feed_views

urlpatterns = [
    path("admin/", admin.site.urls),

    # Authentication. Django ships login/logout for free; we only add signup.
    path("accounts/login/", auth_views.LoginView.as_view(), name="login"),
    path("accounts/logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("accounts/signup/", feed_views.signup, name="signup"),

    # Everything else lives in the feed app.
    path("", include("feed.urls")),
]

# In DEBUG, let the dev server serve uploaded photos from MEDIA_ROOT.
# In production a CDN does this; the dev server never should.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
