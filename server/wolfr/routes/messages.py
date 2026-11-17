from flask import Blueprint, g, request, jsonify
from wolfr.db import get_db
from wolfr.routes.notifications import make_snippet, notify

# Direct messages API. The /messages page (client/wolflite/src/pages/MessagesPage.tsx)
# uses it; the full contract is in docs/direct-messages-api.md.
# All endpoints need a logged in user (they are not in PUBLIC_ENDPOINTS), so g.user is set.
# All endpoints are prefixed with /dm (e.g /dm/conversations)
messages_page = Blueprint("dm", __name__, url_prefix="/dm")

MAX_MESSAGE_LENGTH = 2000
PAGE_SIZE = 50


# ---------- JSON shapes ----------

def user_json(row):
   return {"id": row["id"], "username": row["username"], "profilePic": row["filename"]}


def message_json(row):
   return {
      "id": row["id"],
      "conversationId": row["conversation_id"],
      "senderId": row["sender_id"],
      "body": row["body"],
      "created": row["created"],
   }


# One conversation from `user_id`'s point of view: the other person, the last
# message, how many of their messages you haven't read
def conversation_json(conversation_id, user_id):
   db = get_db()
   conversation = db.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
   other = db.execute(
      """
      SELECT user.id, user.username, user.filename
      FROM conversation_members
      JOIN user ON conversation_members.user_id = user.id
      WHERE conversation_members.conversation_id = ? AND conversation_members.user_id != ?
      """,
      (conversation_id, user_id),
   ).fetchone()
   last = db.execute(
      "SELECT * FROM direct_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1", (conversation_id,)
   ).fetchone()
   unread = db.execute(
      """
      SELECT COUNT(*) AS total
      FROM direct_messages
      JOIN conversation_members
         ON conversation_members.conversation_id = direct_messages.conversation_id
         AND conversation_members.user_id = ?
      WHERE direct_messages.conversation_id = ?
         AND direct_messages.sender_id != ?
         AND direct_messages.id > COALESCE(conversation_members.last_read_message_id, 0)
      """,
      (user_id, conversation_id, user_id),
   ).fetchone()["total"]

   return {
      "id": conversation["id"],
      # The other person can be gone if they deleted their account
      "otherUser": user_json(other) if other else {"id": None, "username": "Deleted user", "profilePic": None},
      "lastMessage": message_json(last) if last else None,
      "unreadCount": unread,
      "updated": conversation["updated"],
   }


# The conversation if the logged in user is in it, else None.
# (Callers answer 404 either way, so conversation ids can't be probed.)
def my_conversation(conversation_id):
   return get_db().execute(
      """
      SELECT conversations.* FROM conversations
      JOIN conversation_members ON conversation_members.conversation_id = conversations.id
      WHERE conversations.id = ? AND conversation_members.user_id = ?
      """,
      (conversation_id, g.user["id"]),
   ).fetchone()


def not_found():
   return jsonify({"error": "Conversation not found"}), 404


# ---------- Endpoints ----------

# Your conversations, most recently active first, and how many unread messages in total
@messages_page.route("/conversations", methods=["GET"])
def listConversations():
   me = g.user["id"]
   rows = get_db().execute(
      """
      SELECT conversations.id FROM conversations
      JOIN conversation_members ON conversation_members.conversation_id = conversations.id
      WHERE conversation_members.user_id = ?
      -- Newest message first. Message ids always increase, so this is exact even when
      -- several messages share the same second (the "updated" time only has seconds).
      -- Conversations without messages come last, newest first.
      ORDER BY
         COALESCE((SELECT MAX(id) FROM direct_messages WHERE conversation_id = conversations.id), 0) DESC,
         conversations.updated DESC, conversations.id DESC
      """,
      (me,),
   ).fetchall()

   conversations = [conversation_json(row["id"], me) for row in rows]
   return jsonify({
      "conversations": conversations,
      "unreadTotal": sum(c["unreadCount"] for c in conversations),
   }), 200


# The conversation between you and another user, created if it doesn't exist yet.
# Body: {"userId": 5}
@messages_page.route("/conversations", methods=["POST"])
def openConversation():
   me = g.user["id"]
   other_id = (request.get_json(silent=True) or {}).get("userId")

   if not isinstance(other_id, int) or isinstance(other_id, bool):
      return jsonify({"error": "Pick someone to message"}), 400
   if other_id == me:
      return jsonify({"error": "You can't message yourself"}), 400

   db = get_db()
   if db.execute("SELECT 1 FROM user WHERE id = ?", (other_id,)).fetchone() is None:
      return jsonify({"error": "That user doesn't exist"}), 404

   # BEGIN IMMEDIATE: two requests at once (double click, both people at the same
   # moment) can't both create a conversation for the same pair
   db.execute("BEGIN IMMEDIATE")
   try:
      existing = db.execute(
         """
         SELECT a.conversation_id AS id FROM conversation_members a
         JOIN conversation_members b ON b.conversation_id = a.conversation_id
         WHERE a.user_id = ? AND b.user_id = ?
         """,
         (me, other_id),
      ).fetchone()

      if existing:
         conversation_id = existing["id"]
      else:
         conversation_id = db.execute("INSERT INTO conversations DEFAULT VALUES").lastrowid
         db.executemany(
            "INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)",
            [(conversation_id, me), (conversation_id, other_id)],
         )
      db.commit()
   except Exception:
      db.rollback()
      raise

   return jsonify({"conversation": conversation_json(conversation_id, me)}), 200


# Messages in a conversation, oldest first.
#   (no query)       the newest PAGE_SIZE
#   ?before=<id>     the PAGE_SIZE just before that message (older history)
#   ?after=<id>      everything after that message (polling for new ones)
# hasMore: there are older messages than the first one returned
@messages_page.route("/conversations/<int:conversation_id>/messages", methods=["GET"])
def listMessages(conversation_id):
   if my_conversation(conversation_id) is None:
      return not_found()

   db = get_db()
   after = request.args.get("after", type=int)
   before = request.args.get("before", type=int)

   if after is not None:
      rows = db.execute(
         "SELECT * FROM direct_messages WHERE conversation_id = ? AND id > ? ORDER BY id",
         (conversation_id, after),
      ).fetchall()
      return jsonify({"messages": [message_json(row) for row in rows], "hasMore": False}), 200

   # Newest first with one extra row to know if there's more, then flipped to oldest first
   if before is not None:
      rows = db.execute(
         "SELECT * FROM direct_messages WHERE conversation_id = ? AND id < ? ORDER BY id DESC LIMIT ?",
         (conversation_id, before, PAGE_SIZE + 1),
      ).fetchall()
   else:
      rows = db.execute(
         "SELECT * FROM direct_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?",
         (conversation_id, PAGE_SIZE + 1),
      ).fetchall()

   has_more = len(rows) > PAGE_SIZE
   rows = list(reversed(rows[:PAGE_SIZE]))
   return jsonify({"messages": [message_json(row) for row in rows], "hasMore": has_more}), 200


# Sends a message. Body: {"body": "text"}
@messages_page.route("/conversations/<int:conversation_id>/messages", methods=["POST"])
def sendMessage(conversation_id):
   if my_conversation(conversation_id) is None:
      return not_found()

   body = str((request.get_json(silent=True) or {}).get("body") or "").strip()
   if not body:
      return jsonify({"error": "A message can't be empty"}), 400
   if len(body) > MAX_MESSAGE_LENGTH:
      return jsonify({"error": f"Messages can be at most {MAX_MESSAGE_LENGTH} characters"}), 400

   db = get_db()
   me = g.user["id"]
   message_id = db.execute(
      "INSERT INTO direct_messages (conversation_id, sender_id, body) VALUES (?, ?, ?)",
      (conversation_id, me, body),
   ).lastrowid
   message = db.execute("SELECT * FROM direct_messages WHERE id = ?", (message_id,)).fetchone()

   # Sorts the conversation to the top; sending also means you've read everything so far
   db.execute("UPDATE conversations SET updated = ? WHERE id = ?", (message["created"], conversation_id))
   db.execute(
      "UPDATE conversation_members SET last_read_message_id = ? WHERE conversation_id = ? AND user_id = ?",
      (message_id, conversation_id, me),
   )

   # Notify the other person, but only for the first message they haven't read yet,
   # so a burst of messages doesn't become a burst of notifications
   for member in db.execute(
      "SELECT user_id, last_read_message_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?",
      (conversation_id, me),
   ).fetchall():
      earlier_unread = db.execute(
         """
         SELECT 1 FROM direct_messages
         WHERE conversation_id = ? AND sender_id = ? AND id < ? AND id > COALESCE(?, 0)
         LIMIT 1
         """,
         (conversation_id, me, message_id, member["last_read_message_id"]),
      ).fetchone()
      if earlier_unread is None:
         notify(member["user_id"], "dm", actor_id=me, snippet=make_snippet(body))

   db.commit()
   return jsonify({"message": message_json(message)}), 201


# Marks everything in the conversation as read for the logged in user
@messages_page.route("/conversations/<int:conversation_id>/read", methods=["PUT"])
def markRead(conversation_id):
   if my_conversation(conversation_id) is None:
      return not_found()

   db = get_db()
   latest = db.execute(
      "SELECT MAX(id) AS id FROM direct_messages WHERE conversation_id = ?", (conversation_id,)
   ).fetchone()["id"]
   if latest is not None:
      db.execute(
         """
         UPDATE conversation_members SET last_read_message_id = ?
         WHERE conversation_id = ? AND user_id = ?
           AND COALESCE(last_read_message_id, 0) < ?
         """,
         (latest, conversation_id, g.user["id"], latest),
      )
      db.commit()

   return jsonify({"success": True}), 200
