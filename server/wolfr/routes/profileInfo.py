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
      SELECT posts.*, posts.filename AS postPic, user.filename AS profilePic
      FROM posts
      JOIN user ON posts.author_id = user.id
      WHERE user.id = ?
      """, (g.user[0],)
    ).fetchall()

    allLoggedInUserPosts = []
    for row in userPostedPosts:
      allLoggedInUserPosts.append({
      "id": row["id"],
      "author_id": row["author_id"],
      "created": row["created"],
      "title": row["title"],
      "body": row["body"],
      "postPic": row["postPic"],
      "profilePic": row["profilePic"]
      })


    return jsonify({"allUserPosts": allLoggedInUserPosts}), 200
  except sqlite3.IntegrityError:
    return jsonify({"error": "user does not exist"})