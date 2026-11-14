"""WSGI entry point — how a production web server (gunicorn, uWSGI) talks to Django.

Instagram famously runs Django under uWSGI across a huge fleet of servers. This
one line is the same contract, just never used during `runserver`.
"""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
application = get_wsgi_application()
