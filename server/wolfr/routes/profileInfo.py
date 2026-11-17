import sqlite3
from flask import Blueprint, g, request, jsonify, redirect, current_app
from wolfr.db import get_db
from wolfr.routes.blog import build_feed_items, get_stashed_ids
from werkzeug.utils import secure_filename
import os
import datetime
from flask import session

# All endpoints are prefixed with /post (e.g /profileInfo/newendpoint)
profile_page = Blueprint("profileInfo", __name__, url_prefix="/profileInfo")

@profile_page.route("/fetch", methods=["GET"])
def retrieveLoggedInUserPost():
  db = get_db()
  cursor = db.cursor()

  # The profile to show: ?id=<user id>, or ?username=<name> (used by @mention links,
  # which only know the name; matched ignoring case)
  user_id = request.args.get("id", type=int)
  username = request.args.get("username", "").strip()

  if not user_id and username:
    found = cursor.execute("SELECT id FROM user WHERE username = ? COLLATE NOCASE", (username,)).fetchone()
    if found is None:
      return '', 204
    user_id = found["id"]

  if not user_id:
    return jsonify({"error": "No user id provided"}), 400


  # If the user searched in the query string does not exist, send back error
  findUser = cursor.execute(
    """
      SELECT * FROM user WHERE id = ?
    """, (user_id,)).fetchone()

  # Return user does not exist
  if findUser is None:
    return '', 204


  # Everything the user posted, in every den
  their_items = build_feed_items(author_id=user_id)

  # The stash list is private: only returned when viewing your own profile.
  # It can contain anyone's posts and polls.
  stashed_items = []
  if g.user and g.user["id"] == user_id:
    stashed_post_ids, stashed_poll_ids = get_stashed_ids(user_id)
    stashed_items = build_feed_items(post_ids=stashed_post_ids, poll_ids=stashed_poll_ids)

  # Posts the user liked
  liked_post_ids = [row["post_id"] for row in cursor.execute(
    "SELECT post_id FROM likes WHERE author_id = ? AND post_id IS NOT NULL", (user_id,)
  )]
  liked_items = build_feed_items(post_ids=liked_post_ids)

  # Details of the profile being viewed (findUser was loaded at the top)
  return jsonify({
    "allUserPosts": [item for item in their_items if not item["isPoll"]],
    "allUserPolls": [item for item in their_items if item["isPoll"]],
    "stashed": stashed_items,
    "likedPosts": liked_items,
    "userId": findUser["id"],
    "username": findUser["username"],
    "userProfilePic": findUser["filename"],
    "joinedDate": findUser["created"],
    "bio": findUser["bio"]
  }), 200






@profile_page.route('/closePoll/<int:pollToClose>', methods=['DELETE'])
def closePoll(pollToClose):
  db = get_db()
  cursor = db.cursor()

  # Only the poll's author can close it
  poll = cursor.execute("SELECT author_id FROM polls WHERE id = ?", (pollToClose,)).fetchone()
  if poll is None:
    return jsonify({"message": "Poll not found"}), 404
  if poll["author_id"] != g.user["id"]:
    return jsonify({"message": "You can only close your own polls"}), 403

  try:
    if request.method == "DELETE":

      # Schedule deletion by setting a "close_time" or "delete_at" timestamp in the polls table
      # (Assumes you have a "delete_at" column of type DATETIME in your polls table)

      days_until_close = 2  # Number of days after closing to archive the poll
      archive_at = datetime.datetime.utcnow() + datetime.timedelta(days=days_until_close)

      cursor.execute(
        """
        UPDATE polls
        SET archive_at = ?
        WHERE id = ?
        """, (archive_at, pollToClose)
      )

      archive_at_row = cursor.execute(
        "SELECT archive_at FROM polls WHERE id = ?", (pollToClose,)
      ).fetchone()
      archive_at = archive_at_row["archive_at"] if archive_at_row else None

      # If the archive date is in the past or now, archive the poll immediately
      if archive_at and datetime.datetime.strptime(archive_at.split('.')[0], "%Y-%m-%d %H:%M:%S") <= datetime.datetime.utcnow():
        cursor.execute(
          """
          UPDATE polls
          SET isArchived = 1
          WHERE id = ?
          """, (pollToClose,)
        )

      # closing the poll
      cursor.execute(
        """
        UPDATE polls
        SET isOpen = 0
        WHERE id = ?
        """, (pollToClose,)
      )

      db.commit()


    return jsonify({"message": f"Successfully closed poll {pollToClose}"}), 200
  except sqlite3.IntegrityError:
    return jsonify({"message": "Failed to close poll"}), 500




@profile_page.route('/changeUsername', methods=['PUT'])
def changeUsername():
  db = get_db()
  cursor = db.cursor()
  data = request.get_json()
  newUsername = data['newUsername'].replace(" ", "")

  if request.method == 'PUT':

    cursor.execute(
      """
      UPDATE user
      SET username = ?
      WHERE id = ?
      """, (newUsername, g.user['id'])
    )

    db.commit()


    return jsonify({"message": "Username change"}), 200

  return 200



# Removes the logged in user's profile picture (falls back to the default picture)
@profile_page.route('/deleteProfilePic', methods=['PUT'])
def deleteProfilePicture():
  db = get_db()
  db.execute("UPDATE user SET filename = null WHERE id = ?", (g.user["id"],))
  db.commit()

  return jsonify({"message": "Deleted profile picture"}), 200


# Changes the logged in user's bio
@profile_page.route('/changeBio', methods=['PUT'])
def changeBio():
  data = request.get_json(silent=True) or {}
  newBio = str(data.get("newBio") or "").strip()[:500]

  db = get_db()
  db.execute("UPDATE user SET bio = ? WHERE id = ?", (newBio, g.user["id"]))
  db.commit()

  return jsonify({"message": "Updated bio"}), 200


# Keep in sync with THEME_MODES / ACCENTS in client/wolflite/src/lib/theme.ts
THEME_MODES = {"system", "light", "dark"}
ACCENTS = {"red", "orange", "green", "teal", "blue", "purple", "pink"}


# Saves the logged in user's appearance (theme mode and accent color) to their account.
# Body: {"theme": "dark", "accent": "blue"} (either one can be left out)
@profile_page.route('/appearance', methods=['PUT'])
def saveAppearance():
  data = request.get_json(silent=True) or {}
  theme = data.get("theme", g.user["theme"])
  accent = data.get("accent", g.user["accent"])

  if theme is not None and theme not in THEME_MODES:
    return jsonify({"error": "Unknown theme"}), 400
  if accent is not None and accent not in ACCENTS:
    return jsonify({"error": "Unknown accent color"}), 400

  db = get_db()
  db.execute("UPDATE user SET theme = ?, accent = ? WHERE id = ?", (theme, accent, g.user["id"]))
  db.commit()

  return jsonify({"theme": theme, "accent": accent}), 200


# Deletes the logged in user's account and logs them out
@profile_page.route('/deleteProfile', methods=['DELETE'])
def deleteUser():
  db = get_db()
  # Their stashes would otherwise keep counting toward other posts' stash counts
  db.execute("DELETE FROM stashes WHERE user_id = ?", (g.user["id"],))
  db.execute("DELETE FROM den_members WHERE user_id = ?", (g.user["id"],))
  # Their notifications go; notifications they caused stay but no longer name them
  db.execute("DELETE FROM notifications WHERE user_id = ?", (g.user["id"],))
  db.execute("UPDATE notifications SET actor_id = NULL WHERE actor_id = ?", (g.user["id"],))
  db.execute("DELETE FROM user WHERE id = ?", (g.user["id"],))
  db.commit()

  session.clear()

  return jsonify({"message": "Deleted account"}), 200