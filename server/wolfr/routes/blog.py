import sqlite3
from flask import Blueprint, g, request, jsonify
from wolfr.db import get_db

blog_page = Blueprint("post", __name__, url_prefix="/post")

# Creates a new post
@blog_page.route("/create", methods=["POST"])
def createPost():
    db = get_db()
    cursor = db.cursor()

    postTitle = request.form["postTitle"]
    postContent = request.form["postContent"]

    try:
        cursor.execute(
            "INSERT INTO posts (author_id, title, body) VALUES (?, ?, ?)",
            (g.user[0], postTitle, postContent),
        )

        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"message": "something went wrong"})

    return "Post sent", 200


# Retireves existing Posts
@blog_page.route("/fetch", methods=["GET"])
def retrievePosts():
   db = get_db()
   cursor = db.cursor()

   try:
      posts = cursor.execute(
         'SELECT * FROM posts'
         ' JOIN user ON posts.author_id = user.id'
      ).fetchall()



      results = []
      for row in posts:
         results.append({
            "id": row["id"],
            "author_id": row["author_id"],
            "created": row["created"],
            "title": row["title"],
            "body": row["body"],
            "username": row["username"]
         })

      return jsonify({"posts": results}), 200

   except sqlite3.IntegrityError:
      return jsonify({"message": "Table or column doesnt exist"})