from flask import Blueprint, request, jsonify
from wolfr.db import get_db
from wolfr.routes.blog import build_feed_items
from wolfr.routes.dens import DEN_QUERY, den_json, current_user_id

# Search across dens, users and posts / polls. Works for guests.
# GET /search?q=homelab  ->  {"dens": [...], "users": [...], "posts": [...]}
search_page = Blueprint("search", __name__, url_prefix="/search")

MAX_QUERY_LENGTH = 100
MAX_DENS = 20
MAX_USERS = 20
MAX_POSTS = 50


# LIKE pattern matching `text` anywhere. % and _ in the search are matched
# literally (escaped with \), so searching "100%" doesn't match everything.
def contains_pattern(text):
   return f"%{escape_like(text)}%"


def starts_with_pattern(text):
   return f"{escape_like(text)}%"


def escape_like(text):
   return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@search_page.route("", methods=["GET"])
def search():
   query = request.args.get("q", "").strip()[:MAX_QUERY_LENGTH]
   if not query:
      return jsonify({"query": "", "dens": [], "users": [], "posts": []}), 200

   db = get_db()
   pattern = contains_pattern(query)

   # Dens by name or description, biggest first.
   # (SQLite's LIKE ignores upper / lower case for English letters.)
   den_rows = db.execute(
      DEN_QUERY
      + " WHERE dens.name LIKE ? ESCAPE '\\' OR dens.description LIKE ? ESCAPE '\\'"
      + " ORDER BY memberCount DESC, dens.name COLLATE NOCASE LIMIT ?",
      (current_user_id(), pattern, pattern, MAX_DENS),
   ).fetchall()

   # Users by username or bio. Username matches first (exact, then starts with,
   # then anywhere), then bio matches. Never returns passwords: only public fields.
   user_rows = db.execute(
      """
      SELECT id, username, filename AS profilePic, bio, created
      FROM user
      WHERE username LIKE ? ESCAPE '\\' OR bio LIKE ? ESCAPE '\\'
      ORDER BY
         CASE
            WHEN username = ? COLLATE NOCASE THEN 0
            WHEN username LIKE ? ESCAPE '\\' THEN 1
            WHEN username LIKE ? ESCAPE '\\' THEN 2
            ELSE 3
         END,
         username COLLATE NOCASE
      LIMIT ?
      """,
      (pattern, pattern, query, starts_with_pattern(query), pattern, MAX_USERS),
   ).fetchall()

   # Posts by title or body; polls by question or any of their options
   post_ids = [row["id"] for row in db.execute(
      "SELECT id FROM posts WHERE title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' ORDER BY id DESC LIMIT ?",
      (pattern, pattern, MAX_POSTS),
   )]
   poll_ids = [row["id"] for row in db.execute(
      """
      SELECT id FROM polls
      WHERE question LIKE ? ESCAPE '\\'
         OR id IN (SELECT poll_id FROM poll_options WHERE option_text LIKE ? ESCAPE '\\')
      ORDER BY id DESC LIMIT ?
      """,
      (pattern, pattern, MAX_POSTS),
   )]

   # Newest first, at most MAX_POSTS of posts and polls together
   items = build_feed_items(post_ids=post_ids, poll_ids=poll_ids)[:MAX_POSTS]

   return jsonify({
      "query": query,
      "dens": [den_json(row) for row in den_rows],
      "users": [
         {
            "id": row["id"],
            "username": row["username"],
            "profilePic": row["profilePic"],
            "bio": row["bio"],
            "joined": row["created"],
         }
         for row in user_rows
      ],
      "posts": items,
   }), 200
