import sqlite3
from flask import Blueprint, g, request, jsonify, redirect, current_app
from wolfr.db import get_db
import os
import uuid

# All endpoints are prefixed with /post (e.g /post/newendpoint)
blog_page = Blueprint("post", __name__, url_prefix="/post")


# Feed: every post and poll, newest first
@blog_page.route("/fetch", methods=["GET"])
def retrievePosts():
   return jsonify({"feed": build_feed_items()}), 200


# Builds every post and poll with its likes, comments, votes and whether the
# logged in user has stashed it. Used by the feed and by the profile's stash list.
def build_feed_items():
   db = get_db()
   cursor = db.cursor()

   # Which posts / polls the logged in user has stashed, and how many users stashed each
   stashed_post_ids, stashed_poll_ids = get_stashed_ids(g.user["id"])
   post_stash_counts, poll_stash_counts = get_stash_counts()

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
            "isPoll": False,
            "isStashed": row["id"] in stashed_post_ids,
            "stashCount": post_stash_counts.get(row["id"], 0)
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
         "isStashed": poll["id"] in stashed_poll_ids,
         "stashCount": poll_stash_counts.get(poll["id"], 0),
         "likeCount": poll["likeCount"],
         "comments": comments_by_poll.get(poll["id"], []),
         "whoVoted": votes_by_poll.get(poll["id"], []),
         "likesByPoll": likes_by_poll.get(poll["id"], [])
      })

   # Newest first
   combined_results = postResults + pollResults
   combined_results.sort(key=lambda x: x["created"], reverse=True)
   return combined_results


# Allowed file extensions to be uploaded to the server
IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
VIDEO_EXTENSIONS = {"mp4", "mov", "avi", "webm"}
MEDIA_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS


def file_extension(filename):
   return filename.rsplit(".", 1)[1].lower() if "." in filename else ""


# Saves an uploaded file under a random name and returns its public URL,
# or None if the file type is not allowed.
# The original filename is never used on disk: two users uploading "photo.jpg"
# (or someone uploading "defaultUser.jpg") would otherwise overwrite each other's files.
def save_upload(file, allowed_extensions):
   extension = file_extension(file.filename or "")
   if extension not in allowed_extensions:
      return None

   filename = f"{uuid.uuid4().hex}.{extension}"
   file.save(os.path.join(current_app.config["UPLOAD_FOLDER"], filename))
   return f"/static/uploads/{filename}"


# Update the logged in user's profile picture
@blog_page.route('/updateProfilePicture', methods=["PUT"])
def updateProfilePicture():
   file = request.files.get("file")
   if file is None:
      return jsonify({"error": "No file uploaded"}), 400

   file_url = save_upload(file, IMAGE_EXTENSIONS)
   if file_url is None:
      return jsonify({"error": "Profile pictures must be an image (png, jpg, gif, webp)"}), 400

   db = get_db()
   db.execute("UPDATE user SET filename = ? WHERE id = ?", (file_url, g.user["id"]))
   db.commit()

   return jsonify({"profileImg": file_url}), 201


# Toggles the logged in user's like on a post or poll
@blog_page.route("/addLike/<int:item_id>/<is_poll>", methods=["POST"])
def addLike(item_id, is_poll):
   db = get_db()
   user_id = g.user["id"]

   # Column name comes from this whitelist, never from user input, so the f-strings below are safe
   column = "poll_id" if is_poll.lower() == "true" else "post_id"

   existing_like = db.execute(
      f"SELECT 1 FROM likes WHERE author_id = ? AND {column} = ?", (user_id, item_id)
   ).fetchone()

   if existing_like:
      db.execute(f"DELETE FROM likes WHERE author_id = ? AND {column} = ?", (user_id, item_id))
   else:
      db.execute(f"INSERT INTO likes (author_id, {column}) VALUES (?, ?)", (user_id, item_id))

   db.commit()
   return jsonify({"success": 200})


# Looks up a post or poll that the logged in user wants to change.
# Returns (table, error_response): the error is set when the item doesn't exist
# or belongs to someone else.
def find_own_item(item_id, is_poll):
   # Table name comes from this whitelist, never from user input
   table = "polls" if is_poll.lower() == "true" else "posts"

   item = get_db().execute(f"SELECT author_id FROM {table} WHERE id = ?", (item_id,)).fetchone()
   if item is None:
      return table, (jsonify({"error": "Not found"}), 404)
   if item["author_id"] != g.user["id"]:
      return table, (jsonify({"error": "You can only change your own posts"}), 403)
   return table, None


# Ids of the posts and polls a user has stashed: (set of post ids, set of poll ids)
def get_stashed_ids(user_id):
   rows = get_db().execute("SELECT post_id, poll_id FROM stashes WHERE user_id = ?", (user_id,)).fetchall()
   return (
      {row["post_id"] for row in rows if row["post_id"] is not None},
      {row["poll_id"] for row in rows if row["poll_id"] is not None},
   )


# How many users stashed each item: (dict post id -> count, dict poll id -> count)
def get_stash_counts():
   rows = get_db().execute(
      "SELECT post_id, poll_id, COUNT(*) AS total FROM stashes GROUP BY post_id, poll_id"
   ).fetchall()
   return (
      {row["post_id"]: row["total"] for row in rows if row["post_id"] is not None},
      {row["poll_id"]: row["total"] for row in rows if row["poll_id"] is not None},
   )


# Stashes (bookmarks) or unstashes any post / poll for the logged in user.
# Personal: nothing changes for the author or anyone else.
# Body: {"stashed": true | false}
@blog_page.route("/stash/<int:item_id>/<is_poll>", methods=["PUT"])
def stashItem(item_id, is_poll):
   # Table / column names come from this whitelist, never from user input
   table, column = ("polls", "poll_id") if is_poll.lower() == "true" else ("posts", "post_id")

   db = get_db()
   if db.execute(f"SELECT 1 FROM {table} WHERE id = ?", (item_id,)).fetchone() is None:
      return jsonify({"error": "Not found"}), 404

   data = request.get_json(silent=True) or {}
   stashed = bool(data.get("stashed", True))

   if stashed:
      # OR IGNORE: stashing something already stashed is fine
      db.execute(f"INSERT OR IGNORE INTO stashes (user_id, {column}) VALUES (?, ?)", (g.user["id"], item_id))
   else:
      db.execute(f"DELETE FROM stashes WHERE user_id = ? AND {column} = ?", (g.user["id"], item_id))
   db.commit()

   return jsonify({"isStashed": stashed}), 200


# Permanently deletes a post / poll and everything attached to it
@blog_page.route("/delete/<int:item_id>/<is_poll>", methods=["DELETE"])
def deleteItem(item_id, is_poll):
   table, error = find_own_item(item_id, is_poll)
   if error:
      return error

   db = get_db()
   if table == "polls":
      db.execute("DELETE FROM votes WHERE poll_id = ?", (item_id,))
      db.execute("DELETE FROM poll_options WHERE poll_id = ?", (item_id,))
      db.execute("DELETE FROM likes WHERE poll_id = ?", (item_id,))
      db.execute("DELETE FROM comments WHERE poll_id = ?", (item_id,))
      db.execute("DELETE FROM stashes WHERE poll_id = ?", (item_id,))
      media = None
   else:
      media = db.execute("SELECT filename FROM posts WHERE id = ?", (item_id,)).fetchone()["filename"]
      db.execute("DELETE FROM likes WHERE post_id = ?", (item_id,))
      db.execute("DELETE FROM comments WHERE post_id = ?", (item_id,))
      db.execute("DELETE FROM stashes WHERE post_id = ?", (item_id,))

   db.execute(f"DELETE FROM {table} WHERE id = ?", (item_id,))
   db.commit()

   # Remove the uploaded media file too (never the shared default images)
   if media and media.startswith("/static/uploads/"):
      filename = os.path.basename(media)
      defaults = os.listdir(os.path.join(os.path.dirname(os.path.dirname(__file__)), "defaults"))
      path = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
      if filename not in defaults and os.path.isfile(path):
         os.remove(path)

   return jsonify({"message": "Deleted"}), 200


# Creates a new post
@blog_page.route("/create", methods=["POST"])
def handleImages():
   postTitle = request.form.get("postTitle", "").strip()
   postContent = request.form.get("postContent", "").strip()

   if not postTitle or not postContent:
      return jsonify({"error": "A post needs a title and a body"}), 400

   # The media file is optional
   file_url = None
   file = request.files.get("file")
   if file and file.filename:
      file_url = save_upload(file, MEDIA_EXTENSIONS)
      if file_url is None:
         return jsonify({"error": "Invalid file"}), 400

   db = get_db()
   db.execute(
      "INSERT INTO posts (author_id, title, body, filename) VALUES (?, ?, ?, ?)",
      (g.user["id"], postTitle, postContent, file_url),
   )
   db.commit()

   return jsonify({"success": True, "url": file_url}), 201





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

         # The option must belong to this poll, and the poll must still be open
         valid_option = cursor.execute("""
            SELECT 1 FROM poll_options
            JOIN polls ON polls.id = poll_options.poll_id
            WHERE poll_options.id = ? AND polls.id = ? AND polls.isOpen = 1
         """, (option_ID, poll_ID)).fetchone()

         if valid_option is None:
            return jsonify({"error": "This poll is closed or the option is invalid"}), 400

         # Find if the user already voted on this poll, and delete their previous vote
         # Find the previous option the user voted for
         prev_vote = cursor.execute(
            "SELECT option_id FROM votes WHERE user_id = ? AND poll_id = ?",
            (g.user[0], poll_ID)
         ).fetchone()

         # Delete the previous vote
         cursor.execute(
            "DELETE FROM votes WHERE user_id = ? AND poll_id = ?",
            (g.user[0], poll_ID)
         )

         # Decrement users_voted for the previous option if it exists
         if prev_vote:
            cursor.execute(
               "UPDATE poll_options SET users_voted = users_voted - 1 WHERE id = ?;",
               (prev_vote["option_id"],)
            )


         cursor.execute("""
            INSERT INTO votes (user_id, poll_id, option_id)
            VALUES (?, ?, ?)
         """, (g.user[0], poll_ID, option_ID))

         cursor.execute(
            "UPDATE poll_options SET users_voted = users_voted + 1 WHERE id = ?;", (option_ID,)
         )

         db.commit()


      except sqlite3.IntegrityError:
         return jsonify({"error": "Couldnt apply vote"}), 500


   return {"success": 200}





# Adds a comment from the logged in user to a post or poll
@blog_page.route("/postComment", methods=["POST"])
def postComment():
   data = request.get_json(silent=True) or {}
   commentBody = str(data.get("commentBody") or "").strip()
   postID = data.get("postID")

   if not commentBody or postID is None:
      return jsonify({"error": "A comment needs a body and a post"}), 400

   # Column name comes from this whitelist, never from user input
   column = "poll_id" if data.get("isPoll") else "post_id"

   db = get_db()
   db.execute(
      f"INSERT INTO comments (author_id, {column}, commentBody) VALUES (?, ?, ?)",
      (g.user["id"], postID, commentBody),
   )
   db.commit()

   return jsonify({"success": True}), 200
