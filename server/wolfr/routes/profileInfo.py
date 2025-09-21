import sqlite3
from flask import Blueprint, g, request, jsonify, redirect, current_app
from wolfr.db import get_db
from werkzeug.utils import secure_filename
import os

profile_page = Blueprint("profileInfo", __name__, url_prefix="/profileInfo")

@profile_page.route("/fetch", methods=["GET"])
def retrieveLoggedInUserPost():
  user_id = request.args.get("id")
  print(f"{user_id}'s profile")

  if not user_id:
    return jsonify({"error": "No user id provided"}), 400

  db = get_db()
  cursor = db.cursor()


  try:
    # Querying all posts from the current logged in user, selecting both filenames
    userPostedPosts = cursor.execute(
      """
      SELECT posts.*, posts.filename AS postPic, user.filename AS profilePic, user.username,
      COUNT(likes.id) AS likeCount
      FROM posts
      JOIN user ON posts.author_id = user.id
      LEFT JOIN likes ON posts.id = likes.post_id
      WHERE user.id = ?
      GROUP BY posts.id
      """, (user_id,)
    ).fetchall()

    comments = cursor.execute("""
      SELECT comments.author_id, comments.post_id, comments.commentBody, comments.created, user.username, user.filename AS userProfilePic
      FROM comments
      JOIN user ON comments.author_id = user.id
    """).fetchall()

      # Organize comments by post_id
    comments_by_post = {}
    for comment in comments:
      post_id = comment["post_id"]
      comments_by_post.setdefault(post_id, []).append({
        "author_id": comment["author_id"],
        "author_username": comment["username"],
        "profilePic": comment["userProfilePic"],
        "post_id": comment["post_id"],
        "created": comment["created"],
        "commentBody": comment["commentBody"]
      })

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
        "username": row["username"],
        "likesByPost": likes_by_post.get(row["id"], []),
        "comments": comments_by_post.get(row["id"], [])
      })


    if allLoggedInUserPosts:
      queried_username = allLoggedInUserPosts[0]["username"]
      profilePicture = allLoggedInUserPosts[0]["profilePic"]
    else:
      # If user has no posts, fetch username separately
      user_row = cursor.execute("SELECT username, filename AS profilePic FROM user WHERE id = ?", (user_id,)).fetchone()
      queried_username = user_row["username"] if user_row else None
      profilePicture = user_row["profilePic"] if user_row else None

    return jsonify({
      "allUserPosts": allLoggedInUserPosts,
      "username": queried_username,
      "userProfilePic": profilePicture
    }), 200

  except sqlite3.IntegrityError:
    return jsonify({"error": "user does not exist"})