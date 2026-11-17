import re
import sqlite3
from flask import Blueprint, g, request, jsonify
from wolfr.db import get_db, delete_uploads
from wolfr.routes.blog import save_upload, IMAGE_EXTENSIONS

# Dens are the communities of Wolflite: users create them, join them and post in them.
# All endpoints are prefixed with /dens (e.g /dens/list)
dens_page = Blueprint("dens", __name__, url_prefix="/dens")

# Den names are also their URL (/den?name=homelab), so keep them URL friendly
DEN_NAME_RE = re.compile(r"^[A-Za-z0-9_-]{3,24}$")
DEN_NAME_RULE = "Den names are 3-24 characters: letters, numbers, underscores and hyphens."
MAX_DESCRIPTION_LENGTH = 300


# Dens with their owner, member / post counts and whether the logged in user joined
DEN_QUERY = """
   SELECT dens.*, user.username AS ownerUsername,
      (SELECT COUNT(*) FROM den_members WHERE den_members.den_id = dens.id) AS memberCount,
      (SELECT COUNT(*) FROM posts WHERE posts.den_id = dens.id)
         + (SELECT COUNT(*) FROM polls WHERE polls.den_id = dens.id) AS postCount,
      EXISTS(
         SELECT 1 FROM den_members WHERE den_members.den_id = dens.id AND den_members.user_id = ?
      ) AS isMember
   FROM dens
   LEFT JOIN user ON dens.owner_id = user.id
"""


def current_user_id():
   return g.user["id"] if g.user else None


# One den as JSON, with counts and the logged in user's relationship to it
def den_json(row):
   return {
      "id": row["id"],
      "name": row["name"],
      "description": row["description"],
      "image": row["image"],
      "created": row["created"],
      "ownerId": row["owner_id"],
      "ownerUsername": row["ownerUsername"],
      "memberCount": row["memberCount"],
      "postCount": row["postCount"],
      "isMember": bool(row["isMember"]),
      "isOwner": current_user_id() is not None and row["owner_id"] == current_user_id(),
   }


def find_den(den_id):
   return get_db().execute(DEN_QUERY + " WHERE dens.id = ?", (current_user_id(), den_id)).fetchone()


# Every den, biggest first. Works for guests.
#   ?joined=true  only the dens the logged in user is a member of
@dens_page.route("/list", methods=["GET"])
def listDens():
   if request.args.get("joined") == "true":
      if g.user is None:
         return jsonify({"dens": []}), 200
      rows = get_db().execute(
         DEN_QUERY + " WHERE dens.id IN (SELECT den_id FROM den_members WHERE user_id = ?)"
         " ORDER BY dens.name COLLATE NOCASE",
         (current_user_id(), current_user_id()),
      ).fetchall()
   else:
      rows = get_db().execute(
         DEN_QUERY + " ORDER BY memberCount DESC, dens.name COLLATE NOCASE", (current_user_id(),)
      ).fetchall()

   return jsonify({"dens": [den_json(row) for row in rows]}), 200


# One den by name (case-insensitive). Works for guests.
@dens_page.route("/info/<name>", methods=["GET"])
def getDen(name):
   row = get_db().execute(DEN_QUERY + " WHERE dens.name = ?", (current_user_id(), name)).fetchone()
   if row is None:
      return jsonify({"error": "That den doesn't exist"}), 404
   return jsonify({"den": den_json(row)}), 200


# Checks a den description. Returns (description, error message or None).
def clean_description(raw):
   description = str(raw or "").strip()
   if not description:
      return description, "Describe what the den is about."
   if len(description) > MAX_DESCRIPTION_LENGTH:
      return description, f"Descriptions can be at most {MAX_DESCRIPTION_LENGTH} characters."
   return description, None


# Creates a den. The creator becomes its owner and first member.
# Form fields: name, description, file (optional den picture)
@dens_page.route("/create", methods=["POST"])
def createDen():
   name = request.form.get("name", "").strip()
   if not DEN_NAME_RE.fullmatch(name):
      return jsonify({"error": DEN_NAME_RULE}), 400

   description, error = clean_description(request.form.get("description"))
   if error:
      return jsonify({"error": error}), 400

   db = get_db()
   # Names are unique ignoring case ("Homelab" and "homelab" are the same den)
   if db.execute("SELECT 1 FROM dens WHERE name = ?", (name,)).fetchone():
      return jsonify({"error": "A den with that name already exists."}), 409

   image_url = None
   file = request.files.get("file")
   if file and file.filename:
      image_url = save_upload(file, IMAGE_EXTENSIONS)
      if image_url is None:
         return jsonify({"error": "Den pictures must be an image (png, jpg, gif, webp)"}), 400

   try:
      cursor = db.execute(
         "INSERT INTO dens (name, description, image, owner_id) VALUES (?, ?, ?, ?)",
         (name, description, image_url, g.user["id"]),
      )
      den_id = cursor.lastrowid
      db.execute(
         "INSERT INTO den_members (den_id, user_id, role) VALUES (?, ?, 'owner')", (den_id, g.user["id"])
      )
      db.commit()
   except sqlite3.IntegrityError:
      # Someone took the name between the check above and the insert
      db.rollback()
      delete_uploads([image_url])
      return jsonify({"error": "A den with that name already exists."}), 409

   return jsonify({"den": den_json(find_den(den_id))}), 201


# Edits a den's description and / or picture. Only the owner can.
# Form fields: description, file (new picture, optional), removeImage ("true" to go back to the placeholder)
@dens_page.route("/<int:den_id>", methods=["PUT"])
def editDen(den_id):
   den = find_den(den_id)
   if den is None:
      return jsonify({"error": "That den doesn't exist"}), 404
   if den["owner_id"] != g.user["id"]:
      return jsonify({"error": "Only the den's owner can edit it"}), 403

   description, error = clean_description(request.form.get("description", den["description"]))
   if error:
      return jsonify({"error": error}), 400

   image_url = den["image"]
   file = request.files.get("file")
   if file and file.filename:
      image_url = save_upload(file, IMAGE_EXTENSIONS)
      if image_url is None:
         return jsonify({"error": "Den pictures must be an image (png, jpg, gif, webp)"}), 400
   elif request.form.get("removeImage") == "true":
      image_url = None

   db = get_db()
   db.execute("UPDATE dens SET description = ?, image = ? WHERE id = ?", (description, image_url, den_id))
   db.commit()

   # The old picture is no longer used anywhere
   if image_url != den["image"]:
      delete_uploads([den["image"]])

   return jsonify({"den": den_json(find_den(den_id))}), 200


# Joins a den
@dens_page.route("/<int:den_id>/join", methods=["POST"])
def joinDen(den_id):
   if find_den(den_id) is None:
      return jsonify({"error": "That den doesn't exist"}), 404

   db = get_db()
   # OR IGNORE: joining a den you're already in is fine
   db.execute("INSERT OR IGNORE INTO den_members (den_id, user_id) VALUES (?, ?)", (den_id, g.user["id"]))
   db.commit()

   return jsonify({"den": den_json(find_den(den_id))}), 200


# Leaves a den. The owner can't leave their own den.
# Their posts stay in the den.
@dens_page.route("/<int:den_id>/join", methods=["DELETE"])
def leaveDen(den_id):
   den = find_den(den_id)
   if den is None:
      return jsonify({"error": "That den doesn't exist"}), 404
   if den["owner_id"] == g.user["id"]:
      return jsonify({"error": "You own this den, so you can't leave it"}), 400

   db = get_db()
   db.execute("DELETE FROM den_members WHERE den_id = ? AND user_id = ?", (den_id, g.user["id"]))
   db.commit()

   return jsonify({"den": den_json(find_den(den_id))}), 200
