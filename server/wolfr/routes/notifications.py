import re
from flask import Blueprint, g, jsonify
from wolfr.db import get_db

# Notifications for the logged in user. Types:
#   den_removed  removed from a den by its owner / a moderator
#   mention      mentioned with @username in a post, poll or comment
#   reply        someone replied to your comment
#   comment      someone commented on your post / poll
#   dm           direct messages (coming later)
# All endpoints are prefixed with /notifications.
notifications_page = Blueprint("notifications", __name__, url_prefix="/notifications")

# Newest notifications returned to the panel
MAX_RETURNED = 50
# At most this many people notified per post / comment, so one post can't spam everyone
MAX_MENTIONS = 10
SNIPPET_LENGTH = 140

# @username: same characters usernames may contain (see createUser in __init__.py).
# Not preceded by a word character, so emails (sam@example.com) don't count.
MENTION_RE = re.compile(r"(?<![\w@])@([A-Za-z0-9._-]{1,30})")


# ---------- Creating notifications (used by the other routes; they commit) ----------

def notify(user_id, type, actor_id=None, den_id=None, den_name=None,
           post_id=None, poll_id=None, comment_id=None, snippet=None):
   # Never notify people about their own actions
   if user_id is None or user_id == actor_id:
      return
   get_db().execute(
      """
      INSERT INTO notifications
         (user_id, type, actor_id, den_id, den_name, post_id, poll_id, comment_id, snippet)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      """,
      (user_id, type, actor_id, den_id, den_name, post_id, poll_id, comment_id, snippet),
   )


def make_snippet(text):
   text = " ".join(str(text or "").split())  # one line, single spaces
   return text if len(text) <= SNIPPET_LENGTH else text[: SNIPPET_LENGTH - 1].rstrip() + "…"


# Usernames mentioned in a text, in order, without duplicates (case-insensitive)
def mentioned_usernames(text):
   seen, names = set(), []
   for match in MENTION_RE.finditer(text or ""):
      # "@sam." at the end of a sentence: also try without the trailing dots
      for name in (match.group(1), match.group(1).rstrip(".")):
         key = name.lower()
         if name and key not in seen:
            seen.add(key)
            names.append(name)
   return names


# Notifies everyone mentioned with @username in `text` (once each, never the author).
# Give the post / poll / comment it was written in. `exclude`: user ids already
# notified about this text another way (e.g. "replied to your comment").
# Returns the ids notified.
def notify_mentions(text, actor_id, den_id, post_id=None, poll_id=None, comment_id=None, exclude=()):
   db = get_db()
   den = db.execute("SELECT name FROM dens WHERE id = ?", (den_id,)).fetchone() if den_id else None
   snippet = make_snippet(text)

   notified = set()
   for name in mentioned_usernames(text):
      if len(notified) >= MAX_MENTIONS:
         break
      user = db.execute("SELECT id FROM user WHERE username = ? COLLATE NOCASE", (name,)).fetchone()
      if user is None or user["id"] in notified or user["id"] == actor_id or user["id"] in exclude:
         continue
      notified.add(user["id"])
      notify(user["id"], "mention", actor_id=actor_id, den_id=den_id,
             den_name=den["name"] if den else None, post_id=post_id, poll_id=poll_id,
             comment_id=comment_id, snippet=snippet)
   return notified


# ---------- API ----------

def notification_json(row):
   return {
      "id": row["id"],
      "type": row["type"],
      "isRead": bool(row["is_read"]),
      "created": row["created"],
      "actor": {"id": row["actor_id"], "username": row["actorUsername"], "profilePic": row["actorProfilePic"]}
      if row["actorUsername"] else None,
      # The den's current name if it still exists, else the name it had
      "den": {"id": row["den_id"], "name": row["currentDenName"] or row["den_name"], "exists": row["currentDenName"] is not None}
      if row["den_id"] else None,
      "postId": row["post_id"],
      "pollId": row["poll_id"],
      "commentId": row["comment_id"],
      "snippet": row["snippet"],
   }


# The logged in user's newest notifications and how many are unread
@notifications_page.route("", methods=["GET"])
def listNotifications():
   db = get_db()
   rows = db.execute(
      """
      SELECT notifications.*, user.username AS actorUsername, user.filename AS actorProfilePic,
         dens.name AS currentDenName
      FROM notifications
      LEFT JOIN user ON notifications.actor_id = user.id
      LEFT JOIN dens ON notifications.den_id = dens.id
      WHERE notifications.user_id = ?
      ORDER BY notifications.id DESC
      LIMIT ?
      """,
      (g.user["id"], MAX_RETURNED),
   ).fetchall()
   unread = db.execute(
      "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0", (g.user["id"],)
   ).fetchone()["total"]

   return jsonify({"notifications": [notification_json(row) for row in rows], "unreadCount": unread}), 200


# Marks one of the logged in user's notifications as read
@notifications_page.route("/<int:notification_id>/read", methods=["PUT"])
def markRead(notification_id):
   db = get_db()
   cursor = db.execute(
      "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", (notification_id, g.user["id"])
   )
   db.commit()
   if cursor.rowcount == 0:
      return jsonify({"error": "Notification not found"}), 404
   return jsonify({"success": True}), 200


# Marks all of the logged in user's notifications as read
@notifications_page.route("/read", methods=["PUT"])
def markAllRead():
   db = get_db()
   db.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", (g.user["id"],))
   db.commit()
   return jsonify({"success": True}), 200


# Clears (deletes) all of the logged in user's notifications
@notifications_page.route("", methods=["DELETE"])
def clearNotifications():
   db = get_db()
   db.execute("DELETE FROM notifications WHERE user_id = ?", (g.user["id"],))
   db.commit()
   return jsonify({"success": True}), 200


# Deletes one of the logged in user's notifications
@notifications_page.route("/<int:notification_id>", methods=["DELETE"])
def deleteNotification(notification_id):
   db = get_db()
   cursor = db.execute("DELETE FROM notifications WHERE id = ? AND user_id = ?", (notification_id, g.user["id"]))
   db.commit()
   if cursor.rowcount == 0:
      return jsonify({"error": "Notification not found"}), 404
   return jsonify({"success": True}), 200
