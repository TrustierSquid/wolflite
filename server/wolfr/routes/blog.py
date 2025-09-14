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
      # selecting all regular posts
      posts = cursor.execute(
         "SELECT posts.*, user.username, user.filename AS userProfilePic FROM posts JOIN user ON posts.author_id = user.id"
      ).fetchall()

      # Selecting all polls
      polls = cursor.execute(
         "SELECT polls.*, user.username, user.filename AS userProfilePic FROM polls JOIN user ON polls.author_id = user.id"
      ).fetchall()

      # Selecting all poll options
      options = cursor.execute(
         "SELECT * FROM poll_options"
      ).fetchall()

      # Blueprint for post results
      postResults = []
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
               "profilePic": row["userProfilePic"]
            }
         )


      option_map = {}
      for opt in options:
         # Fetch user IDs who voted for this option
         voters = cursor.execute(
         "SELECT user_id FROM votes WHERE option_id = ?", (opt["id"],)
         ).fetchall()
         voter_ids = [v["user_id"] for v in voters]

         option_map.setdefault(opt["poll_id"], []).append({
            "id": opt["id"],
            "option_text": opt["option_text"],
            "user_voted": opt["users_voted"],
            "voters": voter_ids,
         })

      # Selecting each poll and sending back a blueprint of each poll and their data
      pollResults = []
      for poll in polls:

         # Getting total votes for each poll
         result = cursor.execute("""
            SELECT SUM(users_voted) AS total_votes FROM poll_options WHERE poll_id = ? """, (poll["id"],)
         ).fetchone()

         total_votes = result["total_votes"] if result and result["total_votes"] is not None else 0

         pollResults.append({
            "id": poll["id"],
            "author_id": poll["author_id"],
            "created": poll["created"],
            "question": poll["question"],
            "username": poll["username"],
            # appended the blueprint of the options map
            "options": option_map.get(poll["id"], []),
            "totalVotes": total_votes,
            "profilePic": poll["userProfilePic"]
         })


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


# FILE/IMAGE UPLOAD HANDLING: When a filename is passed in from the client, this checks if its a valid img file.
def allowed_file(filename):
   return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@blog_page.route('/updateProfilePicture/<int:user_id>', methods=(["PUT"]))
def updateProfilePicture(user_id):
   db = get_db()
   cursor = db.cursor()

   if request.method == "PUT":
      try:
         if len(request.files) == 0 or None:
            return {"error": "No file uploaded"}

         file = request.files["file"]

         if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(
               current_app.config["UPLOAD_FOLDER"], filename
            )

            file_url = f"/static/uploads/{filename}"

            file.save(filepath)
            cursor.execute("""
               UPDATE user
               SET filename = ?
               WHERE id = ?
            """, (file_url, user_id))

            db.commit()

            return jsonify({"profileImg": file_url}), 201
      except sqlite3.IntegrityError:
         return jsonify({"error": "user does not exist"})



# Creates a new post
@blog_page.route("/create", methods=(["GET", "POST"]))
def handleImages():
    db = get_db()

    if request.method == "POST":
        try:
            postTitle = request.form["postTitle"]
            postContent = request.form["postContent"]

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


# Marking an answer that a user selected
@blog_page.route("/poll/userStats", methods=(['POST', "GET"]))
def trackUserFeedback():
   db = get_db()

   if request.method == "POST":
      try:
         data = request.get_json()
         poll_ID = data["pollID"]
         option_ID = data["optionID"]
         cursor = db.cursor()

         cursor.execute("""
            INSERT INTO votes (user_id, poll_id, option_id)
            VALUES (?, ?, ?)
         """, (g.user[0], poll_ID, option_ID))

         cursor.execute(
            "UPDATE poll_options SET users_voted = users_voted + 1 WHERE id = ?;", (option_ID,)
         )

         db.commit()


      except sqlite3.IntegrityError:
         return jsonify({"error": "You already voted in this poll"})


   return {"success": 200}
