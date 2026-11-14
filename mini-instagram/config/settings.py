"""
Django settings for mini-instagram.

This is the project's control panel. Where it matters, comments point out how the
toy choice here maps to what Instagram does at scale.
"""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY: this key is fine for local learning ONLY. A real deployment loads a
# secret from the environment and never commits it.
SECRET_KEY = "dev-only-insecure-key-do-not-use-in-production"
DEBUG = True
ALLOWED_HOSTS = ["*"]  # dev convenience; a real site lists its real domains.

INSTALLED_APPS = [
    "django.contrib.admin",        # the built-in admin site (/admin)
    "django.contrib.auth",         # users, passwords, login — we reuse this
    "django.contrib.contenttypes",
    "django.contrib.sessions",     # keeps you logged in via a cookie
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "feed",                        # <-- our app: posts, follows, likes, the feed
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# -- Database ---------------------------------------------------------------
# We default to SQLite: one file, zero setup, so this runs on any laptop.
#
# Instagram runs on sharded PostgreSQL (plus Cassandra for feeds). To feel the
# real thing, install Postgres and swap the block below for:
#
#     DATABASES = {"default": {
#         "ENGINE": "django.db.backends.postgresql",
#         "NAME": "mini_instagram", "USER": "...", "PASSWORD": "...",
#         "HOST": "127.0.0.1", "PORT": "5432",
#     }}
#
# Nothing else in the code changes — that is the point of Django's ORM.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# -- Static & media ---------------------------------------------------------
# "static" = our CSS/JS. "media" = user-uploaded files (the photos).
# At Instagram's scale, uploaded media never sits on the web server like this —
# it goes to blob storage and is served through a CDN. Here it is just a folder.
STATIC_URL = "static/"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Where login/logout send you.
LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "feed"
LOGOUT_REDIRECT_URL = "login"
