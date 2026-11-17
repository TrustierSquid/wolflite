import sqlite3
from flask import Blueprint, g, request, jsonify, redirect, current_app
from wolfr.db import get_db, delete_uploads
from wolfr.routes.notifications import make_snippet, notify, notify_mentions
import os
import uuid

# All endpoints are prefixed with /post (e.g /post/newendpoint)
blog_page = Blueprint("post", __name__, url_prefix="/post")


# Feed of posts and polls, newest first. Works for guests too.
#   ?feed=home       posts from the dens the logged in user joined
#   ?feed=discover   posts from every den (the default)
#   ?den=<name>      posts from one den
@blog_page.route("/fetch", methods=["GET"])
def retrievePosts():
   den_name = request.args.get("den")
   if den_name:
      den = get_db().execute("SELECT id FROM dens WHERE name = ?", (den_name,)).fetchone()
      if den is None:
         return jsonify({"error": "That den doesn't exist"}), 404
      return jsonify({"feed": build_feed_items(den_ids=[den["id"]])}), 200

   if request.args.get("feed") == "home":
      if g.user is None:
         return jsonify({"error": "Log in to see your dens"}), 401
      return jsonify({"feed": build_feed_items(den_ids=joined_den_ids(g.user["id"]))}), 200

   return jsonify({"feed": build_feed_items()}), 200


# Ids of the dens a user is a member of
def joined_den_ids(user_id):
   rows = get_db().execute("SELECT den_id FROM den_members WHERE user_id = ?", (user_id,)).fetchall()
   return [row["den_id"] for row in rows]


def is_den_member(den_id, user_id):
   return get_db().execute(
      "SELECT 1 FROM den_members WHERE den_id = ? AND user_id = ?", (den_id, user_id)
   ).fetchone() is not None


# Builds posts and polls with their den, likes, comments, votes and whether the
# logged in user (if any) has stashed them. Newest first.
# Every filter is optional and they combine (AND):
#   den_ids              only items in these dens
#   author_id            only items by this user
#   post_ids / poll_ids  only these items (e.g. stashed or liked ones). Passing
#                        only one of them returns only that kind.
# Used by the feeds, den pages and profiles.
def build_feed_items(den_ids=None, author_id=None, post_ids=None, poll_ids=None):
   db = get_db()
   cursor = db.cursor()

   # Which posts / polls the logged in user has stashed, and how many users stashed each
   stashed_post_ids, stashed_poll_ids = get_stashed_ids(g.user["id"] if g.user else None)
   post_stash_counts, poll_stash_counts = get_stash_counts()

   # Dens the logged in user owns / moderates: they can delete any post and comment there
   moderated = moderated_den_ids(g.user["id"] if g.user else None)

   # (den id, user id) of every den moderator, for the "Moderator" badge on their posts
   den_moderators = {
      (row["den_id"], row["user_id"])
      for row in db.execute("SELECT den_id, user_id FROM den_members WHERE role = 'moderator'")
   }

   # WHERE clause for the posts / polls query. Only "?" placeholders go into the
   # SQL text; the values themselves are passed as parameters.
   def where_clause(table, ids):
      clauses, params = [], []
      for column, values in (("den_id", den_ids), ("id", ids)):
         if values is not None:
            values = list(values)
            # "IN (NULL)" matches nothing, for an empty list
            clauses.append(f"{table}.{column} IN ({','.join('?' * len(values)) or 'NULL'})")
            params += values
      if author_id is not None:
         clauses.append(f"{table}.author_id = ?")
         params.append(author_id)
      return ("WHERE " + " AND ".join(clauses)) if clauses else "", params

   want_posts = not (poll_ids is not None and post_ids is None)
   want_polls = not (post_ids is not None and poll_ids is None)

   posts = []
   if want_posts:
      where, params = where_clause("posts", post_ids)
      posts = cursor.execute(
         "SELECT posts.*, user.username, user.filename AS userProfilePic, "
         "dens.name AS denName, dens.image AS denImage, dens.owner_id AS denOwnerId, "
         "COUNT(likes.id) AS likeCount "
         "FROM posts "
         "JOIN user ON posts.author_id = user.id "
         "JOIN dens ON posts.den_id = dens.id "
         "LEFT JOIN likes ON likes.post_id = posts.id "
         f"{where} "
         "GROUP BY posts.id",
         params,
      ).fetchall()

   polls = []
   if want_polls:
      where, params = where_clause("polls", poll_ids)
      polls = cursor.execute(
         "SELECT polls.*, user.username, user.filename AS userProfilePic, "
         "dens.name AS denName, dens.image AS denImage, dens.owner_id AS denOwnerId, "
         "COUNT(likes.id) AS likeCount "
         "FROM polls "
         "JOIN user ON polls.author_id = user.id "
         "JOIN dens ON polls.den_id = dens.id "
         "LEFT JOIN likes ON likes.poll_id = polls.id "
         f"{where} "
         "GROUP BY polls.id",
         params,
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
      SELECT likes.post_id, likes.author_id, likes.created, user.username, user.filename AS profilePic
      FROM likes
      JOIN user ON likes.author_id = user.id
   """).fetchall()

   pollLikesMembers = cursor.execute("""
      SELECT likes.poll_id, likes.author_id, likes.created, user.username, user.filename AS profilePic
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
         "username": like["username"],
         "profilePic": like["profilePic"],
         "created": like["created"]
      })

   # map for likes (lists all users by id and username who liked a post)
   likes_by_poll = {}
   for like in pollLikesMembers:
      poll_id = like["poll_id"]

      if poll_id not in likes_by_poll:
         likes_by_poll[poll_id] = []
      likes_by_poll[poll_id].append({
         "author_id": like["author_id"],
         "username": like["username"],
         "profilePic": like["profilePic"],
         "created": like["created"]
      })


   comments = cursor.execute("""
      SELECT comments.id, comments.parent_id, comments.edited, comments.author_id, comments.post_id, comments.commentBody, comments.created, user.username, user.filename AS userProfilePic
      FROM comments
      JOIN user ON comments.author_id = user.id
   """).fetchall()

   pollComments = cursor.execute("""
      SELECT comments.id, comments.parent_id, comments.edited, comments.author_id, comments.poll_id, comments.commentBody, comments.created, user.username, user.filename AS userProfilePic
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
         "commentBody": comment["commentBody"],
         "id": comment["id"],
         "edited": comment["edited"],
         "parent_id": comment["parent_id"]
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
         "commentBody": comment["commentBody"],
         "id": comment["id"],
         "edited": comment["edited"],
         "parent_id": comment["parent_id"]
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
            "stashCount": post_stash_counts.get(row["id"], 0),
            "den": {"id": row["den_id"], "name": row["denName"], "image": row["denImage"]},
            "canModerate": row["den_id"] in moderated,
            # Posted by the den's owner (shown with a "Den Owner" badge)
            "isDenOwner": row["author_id"] == row["denOwnerId"],
            # Posted by one of the den's moderators ("Moderator" badge)
            "isDenModerator": (row["den_id"], row["author_id"]) in den_moderators
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
         "likesByPoll": likes_by_poll.get(poll["id"], []),
         "den": {"id": poll["den_id"], "name": poll["denName"], "image": poll["denImage"]},
         "canModerate": poll["den_id"] in moderated,
         # Posted by the den's owner (shown with a "Den Owner" badge)
         "isDenOwner": poll["author_id"] == poll["denOwnerId"],
         # Posted by one of the den's moderators ("Moderator" badge)
         "isDenModerator": (poll["den_id"], poll["author_id"]) in den_moderators
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


# Den roles: 'owner' (created it), 'moderator' (picked by the owner) or 'member'.
# Owners and moderators can moderate: delete posts / comments in the den and remove members.
MODERATOR_ROLES = ("owner", "moderator")


# A user's role in a den, or None if they aren't in it (or are a guest)
def den_role(den_id, user_id):
   if user_id is None:
      return None
   row = get_db().execute(
      "SELECT role FROM den_members WHERE den_id = ? AND user_id = ?", (den_id, user_id)
   ).fetchone()
   return row["role"] if row else None


def can_moderate(den_id, user_id):
   return den_role(den_id, user_id) in MODERATOR_ROLES


# Ids of the dens a user owns or moderates
def moderated_den_ids(user_id):
   if user_id is None:
      return set()
   rows = get_db().execute(
      "SELECT den_id FROM den_members WHERE user_id = ? AND role IN ('owner', 'moderator')", (user_id,)
   ).fetchall()
   return {row["den_id"] for row in rows}


# Deletes posts / polls and everything attached to them (likes, comments, votes,
# poll options, stashes). Doesn't commit. Returns the URLs of their uploaded media,
# to delete with delete_uploads() once the commit succeeded.
def delete_items(post_ids=(), poll_ids=()):
   db = get_db()
   media = []

   for post_id in post_ids:
      row = db.execute("SELECT filename FROM posts WHERE id = ?", (post_id,)).fetchone()
      if row and row["filename"]:
         media.append(row["filename"])
      for table in ("likes", "comments", "stashes"):
         db.execute(f"DELETE FROM {table} WHERE post_id = ?", (post_id,))
      db.execute("DELETE FROM posts WHERE id = ?", (post_id,))

   for poll_id in poll_ids:
      for table in ("votes", "poll_options", "likes", "comments", "stashes"):
         db.execute(f"DELETE FROM {table} WHERE poll_id = ?", (poll_id,))
      db.execute("DELETE FROM polls WHERE id = ?", (poll_id,))

   return media


# Ids of the posts and polls a user has stashed: (set of post ids, set of poll ids).
# Guests (user_id None) have stashed nothing.
def get_stashed_ids(user_id):
   if user_id is None:
      return set(), set()
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


# Permanently deletes a post / poll and everything attached to it.
# Allowed for its author, and for the owner / moderators of the den it's in.
@blog_page.route("/delete/<int:item_id>/<is_poll>", methods=["DELETE"])
def deleteItem(item_id, is_poll):
   # Table name comes from this whitelist, never from user input
   is_poll = is_poll.lower() == "true"
   table = "polls" if is_poll else "posts"

   db = get_db()
   item = db.execute(f"SELECT author_id, den_id FROM {table} WHERE id = ?", (item_id,)).fetchone()
   if item is None:
      return jsonify({"error": "Not found"}), 404
   if item["author_id"] != g.user["id"] and not can_moderate(item["den_id"], g.user["id"]):
      return jsonify({"error": "You can only delete your own posts, or posts in dens you moderate"}), 403

   media = delete_items(poll_ids=[item_id]) if is_poll else delete_items(post_ids=[item_id])
   db.commit()

   # Remove the uploaded media file too (never the shared default images)
   delete_uploads(media)

   return jsonify({"message": "Deleted"}), 200


# Checks that the logged in user can post in a den (it exists and they joined it).
# Returns an error response, or None when posting is allowed.
def den_posting_error(den_id):
   if not isinstance(den_id, int) or isinstance(den_id, bool):
      return jsonify({"error": "Pick a den to post in"}), 400
   if get_db().execute("SELECT 1 FROM dens WHERE id = ?", (den_id,)).fetchone() is None:
      return jsonify({"error": "That den doesn't exist"}), 404
   if not is_den_member(den_id, g.user["id"]):
      return jsonify({"error": "Join the den to post in it"}), 403
   return None


# Creates a new post in a den
@blog_page.route("/create", methods=["POST"])
def handleImages():
   postTitle = request.form.get("postTitle", "").strip()
   postContent = request.form.get("postContent", "").strip()
   den_id = request.form.get("denId", type=int)

   if not postTitle or not postContent:
      return jsonify({"error": "A post needs a title and a body"}), 400

   error = den_posting_error(den_id)
   if error:
      return error

   # The media file is optional. Either uploaded in pieces beforehand (uploadId,
   # see routes/uploads.py; how the site sends post media) or sent with this request.
   file_url = None
   upload_id = request.form.get("uploadId")
   file = request.files.get("file")
   if upload_id:
      from wolfr.routes.uploads import claim_upload  # (uploads.py imports this file)
      file_url, upload_error = claim_upload(upload_id, MEDIA_EXTENSIONS)
      if upload_error:
         return jsonify({"error": upload_error}), 400
   elif file and file.filename:
      file_url = save_upload(file, MEDIA_EXTENSIONS)
      if file_url is None:
         return jsonify({"error": "Invalid file"}), 400

   db = get_db()
   cursor = db.execute(
      "INSERT INTO posts (author_id, title, body, filename, den_id) VALUES (?, ?, ?, ?, ?)",
      (g.user["id"], postTitle, postContent, file_url, den_id),
   )
   # Anyone mentioned with @username gets a notification
   notify_mentions(f"{postTitle}\n{postContent}", g.user["id"], den_id, post_id=cursor.lastrowid)
   db.commit()

   return jsonify({"success": True, "url": file_url}), 201





# Creates a poll in a den
# Body: {"question": "...", "options": ["...", ...], "denId": 1}
@blog_page.route("/poll/create", methods=["POST"])
def submitPoll():
   data = request.get_json(silent=True) or {}
   question = str(data.get("question") or "").strip()
   options = [str(option).strip() for option in (data.get("options") or []) if str(option).strip()]
   den_id = data.get("denId")

   if not question:
      return jsonify({"error": "A poll needs a question"}), 400
   if len(options) < 2:
      return jsonify({"error": "A poll needs at least two options"}), 400

   error = den_posting_error(den_id)
   if error:
      return error

   db = get_db()
   cursor = db.execute(
      "INSERT INTO polls (author_id, question, den_id) VALUES (?, ?, ?)",
      (g.user["id"], question, den_id),
   )
   # Grabbing the poll id to insert the options with the corresponding poll
   poll_id = cursor.lastrowid

   for option in options:
      db.execute(
         "INSERT INTO poll_options (poll_id, option_text, users_voted) VALUES (?, ?, ?)",
         (poll_id, option, 0),
      )
   # Anyone mentioned with @username gets a notification
   notify_mentions(question, g.user["id"], den_id, poll_id=poll_id)
   db.commit()

   return jsonify({"success": True}), 201





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
            (g.user["id"], poll_ID)
         ).fetchone()

         # Delete the previous vote
         cursor.execute(
            "DELETE FROM votes WHERE user_id = ? AND poll_id = ?",
            (g.user["id"], poll_ID)
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
         """, (g.user["id"], poll_ID, option_ID))

         cursor.execute(
            "UPDATE poll_options SET users_voted = users_voted + 1 WHERE id = ?;", (option_ID,)
         )

         db.commit()


      except sqlite3.IntegrityError:
         return jsonify({"error": "Couldnt apply vote"}), 500


   return {"success": 200}





MAX_COMMENT_LENGTH = 500


# Adds a comment from the logged in user to a post or poll.
# Body: {"commentBody", "postID", "isPoll", "parentID" (optional, makes it a reply)}
@blog_page.route("/postComment", methods=["POST"])
def postComment():
   data = request.get_json(silent=True) or {}
   commentBody = str(data.get("commentBody") or "").strip()
   postID = data.get("postID")
   parentID = data.get("parentID")

   if not commentBody or postID is None:
      return jsonify({"error": "A comment needs a body and a post"}), 400
   if len(commentBody) > MAX_COMMENT_LENGTH:
      return jsonify({"error": f"Comments can be at most {MAX_COMMENT_LENGTH} characters"}), 400

   # Column name comes from this whitelist, never from user input
   column, table = ("poll_id", "polls") if data.get("isPoll") else ("post_id", "posts")

   db = get_db()

   item = db.execute(f"SELECT id, den_id, author_id FROM {table} WHERE id = ?", (postID,)).fetchone()
   if item is None:
      return jsonify({"error": "That post no longer exists"}), 404

   # Who wrote the comment being replied to (notified below)
   replied_to = None

   if parentID is not None:
      parent = db.execute(
         "SELECT id, author_id, post_id, poll_id, parent_id FROM comments WHERE id = ?", (parentID,)
      ).fetchone()
      if parent is None:
         return jsonify({"error": "The comment you replied to no longer exists"}), 404
      if str(parent[column]) != str(postID):
         return jsonify({"error": "That comment is on a different post"}), 400
      replied_to = parent["author_id"]
      # Replies are one level deep: replying to a reply joins the same thread
      parentID = parent["parent_id"] or parent["id"]

   cursor = db.execute(
      f"INSERT INTO comments (author_id, {column}, commentBody, parent_id) VALUES (?, ?, ?, ?)",
      (g.user["id"], item["id"], commentBody, parentID),
   )

   # Notifications, at most one per person for this comment (never the writer):
   #   the person whose comment was replied to   -> "replied to your comment"
   #   the post / poll's author                    -> "commented on your post"
   #   anyone mentioned with @username             -> "mentioned you in a comment"
   refs = dict(den_id=item["den_id"], comment_id=cursor.lastrowid, snippet=make_snippet(commentBody), **{column: item["id"]})
   den = db.execute("SELECT name FROM dens WHERE id = ?", (item["den_id"],)).fetchone()
   refs["den_name"] = den["name"] if den else None
   already = {g.user["id"]}
   if replied_to is not None and replied_to not in already:
      notify(replied_to, "reply", actor_id=g.user["id"], **refs)
      already.add(replied_to)
   if item["author_id"] not in already:
      notify(item["author_id"], "comment", actor_id=g.user["id"], **refs)
      already.add(item["author_id"])
   notify_mentions(commentBody, g.user["id"], item["den_id"], comment_id=cursor.lastrowid, exclude=already, **{column: item["id"]})
   db.commit()

   return jsonify({"success": True}), 200


# Loads a comment plus the post / poll it belongs to (its author_id and den_id).
# Returns (comment, item), or (None, None) if the comment doesn't exist.
# item is None if the post / poll is gone.
def find_comment(comment_id):
   db = get_db()
   comment = db.execute(
      "SELECT id, author_id, post_id, poll_id FROM comments WHERE id = ?", (comment_id,)
   ).fetchone()
   if comment is None:
      return None, None

   if comment["poll_id"] is not None:
      item = db.execute("SELECT author_id, den_id FROM polls WHERE id = ?", (comment["poll_id"],)).fetchone()
   else:
      item = db.execute("SELECT author_id, den_id FROM posts WHERE id = ?", (comment["post_id"],)).fetchone()

   return comment, item


# Edits a comment. Only the person who wrote it can edit it.
# Body: {"commentBody": "..."}
@blog_page.route("/comment/<int:comment_id>", methods=["PUT"])
def editComment(comment_id):
   comment, _ = find_comment(comment_id)
   if comment is None:
      return jsonify({"error": "Comment not found"}), 404
   if comment["author_id"] != g.user["id"]:
      return jsonify({"error": "You can only edit your own comments"}), 403

   data = request.get_json(silent=True) or {}
   commentBody = str(data.get("commentBody") or "").strip()
   if not commentBody:
      return jsonify({"error": "A comment can't be empty"}), 400
   if len(commentBody) > MAX_COMMENT_LENGTH:
      return jsonify({"error": f"Comments can be at most {MAX_COMMENT_LENGTH} characters"}), 400

   db = get_db()
   db.execute(
      "UPDATE comments SET commentBody = ?, edited = CURRENT_TIMESTAMP WHERE id = ?",
      (commentBody, comment_id),
   )
   db.commit()

   return jsonify({"success": True}), 200


# Deletes a comment (and its replies, if it starts a thread). Allowed for the person
# who wrote it, the author of the post / poll it is on (so authors can moderate
# their own posts), and the owner / moderators of the den.
@blog_page.route("/comment/<int:comment_id>", methods=["DELETE"])
def deleteComment(comment_id):
   comment, item = find_comment(comment_id)
   if comment is None:
      return jsonify({"error": "Comment not found"}), 404

   user_id = g.user["id"]
   allowed = (
      comment["author_id"] == user_id
      or (item is not None and (item["author_id"] == user_id or can_moderate(item["den_id"], user_id)))
   )
   if not allowed:
      return jsonify({"error": "You can only delete your own comments, comments on your posts, or comments in dens you moderate"}), 403

   db = get_db()
   db.execute("DELETE FROM comments WHERE id = ? OR parent_id = ?", (comment_id, comment_id))
   db.commit()

   return jsonify({"success": True}), 200
