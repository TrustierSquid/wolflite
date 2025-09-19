import sqlite3
from flask import Blueprint, g, request, jsonify, redirect, current_app
from wolfr.db import get_db
from werkzeug.utils import secure_filename
import os

profile_page = Blueprint("profileInfo", __name__, url_prefix="/profileInfo")

@profile_page.route("/fetch", methods=["GET"])
def retrieveLoggedInUserPost():
  db = get_db()
  cursor = db.cursor()


  try:
    # Querying all posts from the current logged in user, selecting both filenames
    userPostedPosts = cursor.execute(
      """
      SELECT posts.*, posts.filename AS postPic, user.filename AS profilePic,
      COUNT(likes.id) AS likeCount
      FROM posts
      JOIN user ON posts.author_id = user.id
      LEFT JOIN likes ON posts.id = likes.post_id
      WHERE user.id = ?
      """, (g.user[0],)
    ).fetchall()

    # Get all likes per post with like author id and username
    likesMembers = cursor.execute("""
        SELECT likes.post_id, likes.author_id, user.username
        FROM likes
        JOIN user ON likes.author_id = user.id
    """).fetchall()

    # map for likes (lists all users by id and username who liked a post)
    likes_by_post = {}
    for like in likesMembers:
        post_id = like["post_id"]

        if post_id not in likes_by_post:
          likes_by_post[post_id] = []
        likes_by_post[post_id].append({
          "author_id": like["author_id"],
          "username": like["username"]
        })

    allLoggedInUserPosts = []
    for row in userPostedPosts:
      allLoggedInUserPosts.append({
        "id": row["id"],
        "author_id": row["author_id"],
        "created": row["created"],
        "title": row["title"],
        "body": row["body"],
        "postPic": row["postPic"],
        "profilePic": row["profilePic"],
        "likeCount": row["likeCount"],
        "likesByPost": likes_by_post.get(row["id"], [])
      })


    return jsonify({"allUserPosts": allLoggedInUserPosts}), 200
  except sqlite3.IntegrityError:
    return jsonify({"error": "user does not exist"})