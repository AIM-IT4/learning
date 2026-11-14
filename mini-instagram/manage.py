#!/usr/bin/env python
"""Django's command-line entry point. You run everything through this file:

    python manage.py migrate        # create the database tables
    python manage.py seed_demo      # load demo users, posts, follows
    python manage.py runserver      # start the dev web server
    python manage.py test           # run the tests
"""
import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Did you activate your virtualenv and run "
            "`pip install -r requirements.txt`?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
