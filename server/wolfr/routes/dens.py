import re
import sqlite3
from flask import Blueprint, g, request, jsonify
from wolfr.db import get_db, delete_uploads
from wolfr.routes.blog import save_upload, IMAGE_EXTENSIONS, MODERATOR_ROLES, delete_items
from wolfr.routes.notifications import notify

# Dens are the communities of Wolflite: users create them, join them and post in them.
# All endpoints are prefixed with /dens (e.g /dens/list)
dens_page = Blueprint("dens", __name__, url_prefix="/dens")

# Den names are also their URL (/den?name=homelab), so keep them URL friendly
DEN_NAME_RE = re.compile(r"^[A-Za-z0-9_-]{3,24}$")
DEN_NAME_RULE = "Den names are 3-24 characters: letters, numbers, underscores and hyphens."
MAX_DESCRIPTION_LENGTH = 300


# Dens with their owner, member / post counts and whether the logged in user joined
DEN_QUERY = """
   SELECT dens.*, user.username AS ownerUsername, user.filename AS ownerProfilePic,
      (SELECT COUNT(*) FROM den_members WHERE den_members.den_id = dens.id) AS memberCount,
      (SELECT COUNT(*) FROM posts WHERE posts.den_id = dens.id)
         + (SELECT COUNT(*) FROM polls WHERE polls.den_id = dens.id) AS postCount,
      (
         SELECT role FROM den_members WHERE den_members.den_id = dens.id AND den_members.user_id = ?
      ) AS myRole
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
      "ownerProfilePic": row["ownerProfilePic"],
      "memberCount": row["memberCount"],
      "postCount": row["postCount"],
      # The logged in user's role: 'owner', 'moderator', 'member', or None (not in it / guest)
      "myRole": row["myRole"],
      "isMember": row["myRole"] is not None,
      "isOwner": current_user_id() is not None and row["owner_id"] == current_user_id(),
      # Owners and moderators can delete posts / comments and remove members
      "canModerate": row["myRole"] in MODERATOR_ROLES,
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


# Everyone in a den: the owner, then moderators, then members (each in the order they joined).
# Works for guests.
@dens_page.route("/<int:den_id>/members", methods=["GET"])
def listMembers(den_id):
   if find_den(den_id) is None:
      return jsonify({"error": "That den doesn't exist"}), 404

   rows = get_db().execute(
      """
      SELECT user.id, user.username, user.filename AS profilePic,
         den_members.role, den_members.created AS joined
      FROM den_members
      JOIN user ON den_members.user_id = user.id
      WHERE den_members.den_id = ?
      ORDER BY CASE den_members.role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END,
         den_members.created, den_members.id
      """,
      (den_id,),
   ).fetchall()

   return jsonify({"members": [
      {
         "id": row["id"],
         "username": row["username"],
         "profilePic": row["profilePic"],
         "role": row["role"],
         "joined": row["joined"],
      }
      for row in rows
   ]}), 200


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


# What the logged in user can do to another member of a den. Returns an error
# response, or None when allowed.
#   owner      can remove moderators and members
#   moderator  can remove members
#   nobody     can remove the owner or themselves (leaving is separate)
def removal_error(den, target_role, target_id):
   my_role = den["myRole"]
   if my_role not in MODERATOR_ROLES:
      return jsonify({"error": "Only the den's owner and moderators can remove members"}), 403
   if target_role is None:
      return jsonify({"error": "That user isn't in this den"}), 404
   if target_id == g.user["id"]:
      return jsonify({"error": "You can't remove yourself. Leave the den instead."}), 400
   if target_role == "owner":
      return jsonify({"error": "The owner can't be removed"}), 403
   if target_role == "moderator" and my_role != "owner":
      return jsonify({"error": "Only the owner can remove moderators"}), 403
   return None


def member_role(den_id, user_id):
   row = get_db().execute(
      "SELECT role FROM den_members WHERE den_id = ? AND user_id = ?", (den_id, user_id)
   ).fetchone()
   return row["role"] if row else None


# Removes someone from a den. Their posts stay in the den.
@dens_page.route("/<int:den_id>/members/<int:user_id>", methods=["DELETE"])
def removeMember(den_id, user_id):
   den = find_den(den_id)
   if den is None:
      return jsonify({"error": "That den doesn't exist"}), 404

   error = removal_error(den, member_role(den_id, user_id), user_id)
   if error:
      return error

   db = get_db()
   db.execute("DELETE FROM den_members WHERE den_id = ? AND user_id = ?", (den_id, user_id))
   # Tell them, in their notification panel
   notify(user_id, "den_removed", actor_id=g.user["id"], den_id=den_id, den_name=den["name"])
   db.commit()

   return jsonify({"den": den_json(find_den(den_id))}), 200


# Makes a member a moderator, or a moderator a regular member. Only the owner can.
# Body: {"role": "moderator" | "member"}
@dens_page.route("/<int:den_id>/members/<int:user_id>/role", methods=["PUT"])
def changeMemberRole(den_id, user_id):
   den = find_den(den_id)
   if den is None:
      return jsonify({"error": "That den doesn't exist"}), 404
   if den["owner_id"] != g.user["id"]:
      return jsonify({"error": "Only the den's owner can choose moderators"}), 403

   role = (request.get_json(silent=True) or {}).get("role")
   if role not in ("moderator", "member"):
      return jsonify({"error": "Role must be 'moderator' or 'member'"}), 400

   current = member_role(den_id, user_id)
   if current is None:
      return jsonify({"error": "That user isn't in this den"}), 404
   if current == "owner":
      return jsonify({"error": "The owner's role can't change"}), 400

   db = get_db()
   db.execute("UPDATE den_members SET role = ? WHERE den_id = ? AND user_id = ?", (role, den_id, user_id))
   db.commit()

   return jsonify({"role": role}), 200


# Deletes a den with all of its posts and polls (and their likes, comments,
# votes, stashes and media), its members and its picture. Only the owner can.
# Body: {"confirmName": "<the den's name>"} as a safety check against accidental calls.
@dens_page.route("/<int:den_id>", methods=["DELETE"])
def deleteDen(den_id):
   den = find_den(den_id)
   if den is None:
      return jsonify({"error": "That den doesn't exist"}), 404
   if den["owner_id"] != g.user["id"]:
      return jsonify({"error": "Only the den's owner can delete it"}), 403

   confirm = str((request.get_json(silent=True) or {}).get("confirmName") or "")
   if confirm.lower() != den["name"].lower():
      return jsonify({"error": "Type the den's name to confirm"}), 400

   db = get_db()
   post_ids = [row["id"] for row in db.execute("SELECT id FROM posts WHERE den_id = ?", (den_id,))]
   poll_ids = [row["id"] for row in db.execute("SELECT id FROM polls WHERE den_id = ?", (den_id,))]
   try:
      media = delete_items(post_ids, poll_ids)
      db.execute("DELETE FROM den_members WHERE den_id = ?", (den_id,))
      db.execute("DELETE FROM dens WHERE id = ?", (den_id,))
      db.commit()
   except sqlite3.Error:
      db.rollback()
      raise

   delete_uploads(media + [den["image"]])

   return jsonify({"message": "Deleted"}), 200
