"""Register models with Django's admin so you can browse/edit data at /admin.

The admin is a genuine Django superpower: a full CRUD backoffice for free.
Create a superuser with `python manage.py createsuperuser` to log in.
"""
from django.contrib import admin

from .models import Comment, Follow, Like, Post, Profile


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("id", "author", "caption", "created_at")
    list_filter = ("created_at",)
    search_fields = ("caption", "author__username")


@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ("follower", "following", "created_at")


admin.site.register(Profile)
admin.site.register(Like)
admin.site.register(Comment)
