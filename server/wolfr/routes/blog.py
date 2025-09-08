import sqlite3
from flask import Blueprint, g, request, jsonify, redirect, current_app
from wolfr.db import get_db
from werkzeug.utils import secure_filename
import os

blog_page = Blueprint("post", __name__, url_prefix="/post")


# Retireves existing Posts and polls
@blog_page.route("/fetch", methods=["GET"])
def retrievePosts():
    db = get_db()
    cursor = db.cursor()

    try:
        posts = cursor.execute(
            "SELECT * FROM posts" " JOIN user ON posts.author_id = user.id"
        ).fetchall()

        polls = cursor.execute(
            "SELECT * FROM polls, poll_options"
            " JOIN user ON polls.author_id = user.id"
        ).fetchall()

        postResults = []
        pollResults = []
        for row in posts:
            postResults.append(
                {
                  "id": row["id"],
                  "author_id": row["author_id"],
                  "created": row["created"],
                  "filename": row["filename"],
                  "title": row["title"],
                  "body": row["body"],
                  "username": row["username"],
                }
            )

        for poll in polls:
            pollResults.append(
               {
                  "id": poll["id"],
                  "author_id": poll["author_id"],
                  "created": poll["created"],
                  "question": poll["question"],
                  "option_text": poll["option_text"],
                  "username": poll["username"],
               }
            )

        return (
            jsonify(
               {"posts": postResults, "polls": pollResults},
            ),
            200,
        )
    except sqlite3.IntegrityError:
        return jsonify({"message": "Table or column doesnt exist"})


# Allowed file extensions to be uploaded to the server
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}


# FILE/IMAGE UPLOAD HANDLING
def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# Creates a new post
@blog_page.route("/create", methods=(["GET", "POST"]))
def handleImages():
    db = get_db()

    if request.method == "POST":
        try:
            postTitle = request.form["postTitle"]
            postContent = request.form["postContent"]
            print(len(request.files))

            if postContent is None:
                postContent = None

            # If no photo was uploaded, then just post what data was given
            if len(request.files) == 0 or None:
                cursor = db.cursor()

                cursor.execute(
                    "INSERT INTO posts (author_id, title, body) VALUES (?, ?, ?)",
                    (g.user[0], postTitle, postContent),
                )
                db.commit()

                return {"success": True}, 201
            else:
                # Image handling
                file = request.files["file"]

                if file and allowed_file(file.filename):
                    filename = secure_filename(file.filename)
                    filepath = os.path.join(
                        current_app.config["UPLOAD_FOLDER"], filename
                    )
                    file_url = f"/static/uploads/{filename}"

                    file.save(filepath)

                    # Cursor for sqlite so we can make SQL commands
                    cursor = db.cursor()
                    cursor.execute(
                        "INSERT INTO posts (author_id, title, body, filename) VALUES (?, ?, ?, ?)",
                        (g.user[0], postTitle, postContent, file_url),
                    )
                    db.commit()

                    return {"url": file_url}, 201

        except sqlite3.IntegrityError:
            return jsonify({"message": "something went wrong"})

    return {"error": "Invalid file"}, 400


# User creating a poll
@blog_page.route("/poll/create", methods=(["POST"]))
def submitPoll():
    db = get_db()

    if request.method == "POST":
        try:
            # Contains the Poll Question and the poll options
            data = request.get_json()
            question = data["question"]
            options = data["options"]

            print(data)

            cursor = db.cursor()
            cursor.execute(
                "INSERT INTO polls (author_id, question) VALUES (?, ?)",
                (g.user[0], question),
            )

            # Grabbing the poll id to insert the options with the corresponding poll
            poll_id = cursor.lastrowid

            db.commit()
            for option in options:
                cursor.execute(
                    "INSERT INTO poll_options (poll_id, option_text, users_voted) VALUES (?, ?, ?)",
                    (poll_id, option, 0),
                )

            db.commit()

            return {"success": 200}
        except sqlite3.IntegrityError:
            return jsonify({"message": "something went wrong"})

    return {"success": 200}
