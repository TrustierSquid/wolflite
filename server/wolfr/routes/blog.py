import sqlite3
from flask import Blueprint, g, request, jsonify, redirect, current_app
from wolfr.db import get_db
from werkzeug.utils import secure_filename
import os

# All endpoints are prefixed with /post (e.g /post/newendpoint)
blog_page = Blueprint("post", __name__, url_prefix="/post")


# Retireves existing Posts and polls
@blog_page.route("/fetch", methods=["GET"])
def retrievePosts():
   db = get_db()
   cursor = db.cursor()

   try:
      # selecting all regular posts
      posts = cursor.execute(
         "SELECT posts.*, user.username, user.filename AS userProfilePic, "
         "COUNT(likes.id) AS likeCount "
         "FROM posts "
         "JOIN user ON posts.author_id = user.id "
         "LEFT JOIN likes ON likes.post_id = posts.id "
         "GROUP BY posts.id "
      ).fetchall()

      # Selecting all polls
      polls = cursor.execute(
         "SELECT polls.*, user.username, user.filename AS userProfilePic, "
         "COUNT(likes.id) AS likeCount "
         "FROM polls JOIN user ON polls.author_id = user.id "
         "LEFT JOIN likes ON likes.poll_id = polls.id "
         "GROUP BY polls.id"
      ).fetchall()

      # Get votes for each poll and who voted
      votes = cursor.execute("""
         SELECT votes.poll_id, votes.option_id, votes.user_id, user.username, user.filename AS userProfilePic
         FROM votes
         JOIN user ON votes.user_id = user.id
      """).fetchall()

      # Organize votes by poll and option
      votes_by_poll = {}
      for vote in votes:
         poll_id = vote["poll_id"]
         option_id = vote["option_id"]
         user_info = {
            "user_id": vote["user_id"],
            "username": vote["username"],
            "profilePic": vote["userProfilePic"]
         }
         if poll_id not in votes_by_poll:
            votes_by_poll[poll_id] = {}
         if option_id not in votes_by_poll[poll_id]:
            votes_by_poll[poll_id][option_id] = []
         votes_by_poll[poll_id][option_id].append(user_info)

      # Get all likes per post with like author id and username
      likesMembers = cursor.execute("""
         SELECT likes.post_id, likes.author_id, user.username
         FROM likes
         JOIN user ON likes.author_id = user.id
      """).fetchall()

      pollLikesMembers = cursor.execute("""
         SELECT likes.poll_id, likes.author_id, user.username
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

      # map for likes (lists all users by id and username who liked a post)
      likes_by_poll = {}
      for like in pollLikesMembers:
         poll_id = like["poll_id"]

         if poll_id not in likes_by_poll:
            likes_by_poll[poll_id] = []
         likes_by_poll[poll_id].append({
            "author_id": like["author_id"],
            "username": like["username"]
         })


      comments = cursor.execute("""
         SELECT comments.author_id, comments.post_id, comments.commentBody, comments.created, user.username, user.filename AS userProfilePic
         FROM comments
         JOIN user ON comments.author_id = user.id
      """).fetchall()

      pollComments = cursor.execute("""
         SELECT comments.author_id, comments.poll_id, comments.commentBody, comments.created, user.username, user.filename AS userProfilePic
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

      comments_by_poll = {}
      for comment in pollComments:
         poll_id = comment["poll_id"]
         comments_by_poll.setdefault(poll_id, []).append({
            "author_id": comment["author_id"],
            "author_username": comment["username"],
            "profilePic": comment["userProfilePic"],
            "poll_id": comment["poll_id"],
            "created": comment["created"],
            "commentBody": comment["commentBody"]
         })

      # Selecting all poll options
      options = cursor.execute(
         "SELECT * FROM poll_options"
      ).fetchall()

      # Blueprint for POST results
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
               "profilePic": row["userProfilePic"],
               "likeCount": row["likeCount"],
               "likesByPost": likes_by_post.get(row["id"], []),
               "comments": comments_by_post.get(row["id"], []),
               "isPoll": False
            }
         )


      # Blueprint FOR POLLS Results
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
            "profilePic": poll["userProfilePic"],
            "isPoll": True,
            "isOpen": poll["isOpen"],
            "likeCount": poll["likeCount"],
            "comments": comments_by_poll.get(poll["id"], []),
            "whoVoted": votes_by_poll.get(poll["id"], []),
            "likesByPoll": likes_by_poll.get(poll["id"], [])
         })


         combined_results = postResults + pollResults
         # Sort by 'created' field (descending: newest first)
         combined_results.sort(key=lambda x: x["created"], reverse=True)


      return (
         jsonify(
            # {"posts": postResults, "polls": pollResults},
            {"feed": combined_results}
         ),
         200,
      )
   except sqlite3.IntegrityError:
      return jsonify({"message": "Table or column doesnt exist"})


# Allowed file extensions to be uploaded to the server
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "mp4", "mov", "avi", "webm"}


# FILE/IMAGE UPLOAD HANDLING: When a filename is passed in from the client, this checks if its a valid img file.
def allowed_file(filename):
   return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

# Update Profile Picture
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





# Adding a like to a post
@blog_page.route("/addLike/<int:user_id>/<int:item_id>/<is_poll>", methods=(["POST"]))
def addLike(user_id, item_id, is_poll):
   db = get_db()
   cursor = db.cursor()
   is_poll = is_poll.lower() == "true"

   if is_poll:
      # Check if user already liked the poll
      existing_like = cursor.execute("""
         SELECT 1 FROM likes WHERE author_id = ? AND poll_id = ?
      """, (user_id, item_id)).fetchone()

      if existing_like:
         cursor.execute("""
            DELETE FROM likes WHERE author_id = ? AND poll_id = ?
         """, (user_id, item_id))
         db.commit()
         return jsonify({"success": 200})

      if request.method == "POST":
         cursor.execute("""
            INSERT INTO likes (author_id, poll_id) VALUES (?, ?)
         """, (user_id, item_id))
         db.commit()
         return jsonify({"success": 200})

   else:
      # Check if user already liked the post
      existing_like = cursor.execute("""
         SELECT 1 FROM likes WHERE author_id = ? AND post_id = ?
      """, (user_id, item_id)).fetchone()

      if existing_like:
         cursor.execute("""
            DELETE FROM likes WHERE author_id = ? AND post_id = ?
         """, (user_id, item_id))
         db.commit()
         return jsonify({"success": 200})

      if request.method == "POST":
         cursor.execute("""
            INSERT INTO likes (author_id, post_id) VALUES (?, ?)
         """, (user_id, item_id))
         db.commit()
         return jsonify({"success": 200})

   return jsonify({"success": 200})





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





@blog_page.route("/postComment", methods=(["POST"]))
def postComment():
   db = get_db()
   cursor = db.cursor()

   if request.method == "POST":
      try:
         data = request.get_json()
         # Information about the user and the post the comment was made on
         commentBody = data["commentBody"]
         commentAuthor = data["commentAuthor"]
         postID = data["postID"]
         print(data)

         if data["isPoll"] is False:
            try:
               print("is not a poll")
               cursor.execute("""
                  INSERT INTO comments (author_id, post_id, commentBody)
                  VALUES (?, ?, ?)
               """, (commentAuthor, postID, commentBody))

               db.commit()
               return jsonify({"success": True}), 200
            except sqlite3.IntegrityError:
               print("Failed to send comment to post")

         else:
            try:
               print("is a poll")
               cursor.execute("""
                  INSERT INTO comments (author_id, poll_id, commentBody)
                  VALUES (?, ?, ?)
               """, (commentAuthor, postID, commentBody))

               db.commit()
               return jsonify({"success": True}), 200
            except sqlite3.IntegrityError:
               print("Failed to send comment to poll")

      except sqlite3.IntegrityError:
         return jsonify({"error": "failed to save comment"})

   return {"success": 200}
