import sqlite3
from flask import Blueprint, g, request, jsonify, session
from wolfr.db import get_db
from datetime import datetime

blog_page = Blueprint("post", __name__, url_prefix="/post")


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
