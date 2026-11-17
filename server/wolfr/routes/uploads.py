import json
import os
import shutil
import time
import uuid
from flask import Blueprint, current_app, g, jsonify, request
from werkzeug.exceptions import ClientDisconnected
from wolfr.routes.blog import MEDIA_EXTENSIONS, file_extension

# Chunked uploads for big files (videos up to MAX_UPLOAD_MB).
#
# Proxies in front of the app limit how big one request can be: Cloudflare's
# Free / Pro plans reject anything over 100 MB. So the browser sends a file in
# pieces (CHUNK_SIZE each), each in its own request, and the server appends them
# to a temporary file. When everything has arrived the file is moved into the
# uploads folder, and the post that uses it refers to it by its upload id.
#
#   POST   /upload/start          {"filename", "size"}   -> {"uploadId", "chunkSize"}
#   GET    /upload/<id>                                    -> {"received", "size", "done"}
#   PUT    /upload/<id>?offset=N  raw bytes of one piece   -> {"received"}
#   POST   /upload/<id>/finish                             -> {"done": true}
#   DELETE /upload/<id>                                    (cancel)
#
# Then: POST /post/create with uploadId=<id> instead of a file.
# All endpoints need a logged in user; each upload belongs to the user who started it.
uploads_page = Blueprint("uploads", __name__, url_prefix="/upload")

CHUNK_SIZE = 32 * 1024 * 1024  # 32 MB: comfortably under Cloudflare's 100 MB
# Unfinished uploads, and finished ones never used in a post, are deleted after this
STALE_AFTER_SECONDS = 24 * 60 * 60
# Read / write request bodies in blocks this big (never the whole piece in memory)
BLOCK_SIZE = 1024 * 1024


# Temporary files live in instance/upload_tmp: <id>.part (the bytes so far)
# and <id>.json (who uploads what)
def tmp_dir():
   path = os.path.join(current_app.instance_path, "upload_tmp")
   os.makedirs(path, exist_ok=True)
   return path


def part_path(upload_id):
   return os.path.join(tmp_dir(), f"{upload_id}.part")


def meta_path(upload_id):
   return os.path.join(tmp_dir(), f"{upload_id}.json")


def read_meta(upload_id):
   try:
      with open(meta_path(upload_id), encoding="utf8") as f:
         return json.load(f)
   except (OSError, ValueError):
      return None


def write_meta(upload_id, meta):
   tmp = meta_path(upload_id) + ".tmp"
   with open(tmp, "w", encoding="utf8") as f:
      json.dump(meta, f)
   os.replace(tmp, meta_path(upload_id))


def remove_upload(upload_id, meta=None, delete_final_file=False):
   for path in (part_path(upload_id), meta_path(upload_id)):
      if os.path.exists(path):
         os.remove(path)
   # A finished upload that will never be used: delete the moved file too
   if delete_final_file and meta and meta.get("filename"):
      final = os.path.join(current_app.config["UPLOAD_FOLDER"], meta["filename"])
      if os.path.isfile(final):
         os.remove(final)


def cleanup_stale():
   now = time.time()
   for name in os.listdir(tmp_dir()):
      if not name.endswith(".json"):
         continue
      upload_id = name[: -len(".json")]
      meta = read_meta(upload_id)
      if meta is None or now - meta.get("created", 0) > STALE_AFTER_SECONDS:
         remove_upload(upload_id, meta, delete_final_file=True)


def valid_id(upload_id):
   try:
      return uuid.UUID(upload_id).hex == upload_id
   except ValueError:
      return False


# The upload if it exists and belongs to the logged in user, else None.
# (Callers answer 404 either way.)
def my_upload(upload_id):
   if not valid_id(upload_id):
      return None
   meta = read_meta(upload_id)
   if meta is None or meta.get("userId") != g.user["id"]:
      return None
   return meta


def received_bytes(upload_id):
   path = part_path(upload_id)
   return os.path.getsize(path) if os.path.exists(path) else 0


def not_found():
   return jsonify({"error": "Upload not found (it may have expired). Please pick the file again."}), 404


# Starts an upload. Body: {"filename": "clip.mp4", "size": 123456789}
@uploads_page.route("/start", methods=["POST"])
def startUpload():
   cleanup_stale()

   data = request.get_json(silent=True) or {}
   filename = str(data.get("filename") or "")
   size = data.get("size")
   extension = file_extension(filename)
   max_bytes = current_app.config["MAX_UPLOAD_BYTES"]

   if extension not in MEDIA_EXTENSIONS:
      return jsonify({"error": "Only images (png, jpg, gif, webp) and videos (mp4, mov, avi, webm) can be uploaded"}), 400
   if not isinstance(size, int) or isinstance(size, bool) or size <= 0:
      return jsonify({"error": "The file is empty"}), 400
   if size > max_bytes:
      return jsonify({"error": f"That file is too large (max {max_bytes // (1024 * 1024)} MB)."}), 413

   upload_id = uuid.uuid4().hex
   open(part_path(upload_id), "wb").close()
   write_meta(upload_id, {
      "userId": g.user["id"],
      "size": size,
      "extension": extension,
      "created": time.time(),
      "done": False,
   })
   return jsonify({"uploadId": upload_id, "chunkSize": CHUNK_SIZE}), 201


# How much of the file the server has (to resume after a failure)
@uploads_page.route("/<upload_id>", methods=["GET"])
def uploadStatus(upload_id):
   meta = my_upload(upload_id)
   if meta is None:
      return not_found()
   received = meta["size"] if meta["done"] else received_bytes(upload_id)
   return jsonify({"received": received, "size": meta["size"], "done": meta["done"]}), 200


# Adds one piece. ?offset= is where the piece starts in the file; it must be
# exactly what the server has so far (a piece the server already has is accepted
# again without being written twice, so retries are safe).
@uploads_page.route("/<upload_id>", methods=["PUT"])
def uploadChunk(upload_id):
   meta = my_upload(upload_id)
   if meta is None:
      return not_found()
   if meta["done"]:
      return jsonify({"error": "This upload is already finished"}), 409

   offset = request.args.get("offset", type=int)
   length = request.content_length
   received = received_bytes(upload_id)

   if offset is None or length is None:
      return jsonify({"error": "Missing offset or length"}), 400
   if length > CHUNK_SIZE:
      return jsonify({"error": f"Pieces can be at most {CHUNK_SIZE // (1024 * 1024)} MB"}), 413
   if offset + length > meta["size"]:
      return jsonify({"error": "That's more than the file's size"}), 400

   # Already have this piece (a retry after the response got lost)
   if offset + length <= received:
      request.stream.read()  # drain it
      return jsonify({"received": received}), 200
   # Out of order: tell the browser where to continue from
   if offset != received:
      return jsonify({"error": "Wrong offset", "received": received}), 409

   written = 0
   with open(part_path(upload_id), "ab") as f:
      try:
         while written < length:
            block = request.stream.read(min(BLOCK_SIZE, length - written))
            if not block:
               break
            f.write(block)
            written += len(block)
      except ClientDisconnected:
         pass  # handled below like any incomplete piece

   # The connection dropped mid-piece: drop the partial piece so the retry starts clean
   if written != length:
      with open(part_path(upload_id), "ab") as f:
         f.truncate(offset)
      return jsonify({"error": "The piece didn't arrive completely", "received": offset}), 400

   return jsonify({"received": offset + length}), 200


# Checks everything arrived and moves the file into the uploads folder
@uploads_page.route("/<upload_id>/finish", methods=["POST"])
def finishUpload(upload_id):
   meta = my_upload(upload_id)
   if meta is None:
      return not_found()
   if meta["done"]:
      return jsonify({"done": True}), 200

   received = received_bytes(upload_id)
   if received != meta["size"]:
      return jsonify({"error": "The upload isn't complete yet", "received": received}), 409

   filename = f"{uuid.uuid4().hex}.{meta['extension']}"
   # shutil.move, not os.replace: in Docker, instance/ and the uploads folder are
   # different volumes, and a rename can't cross them
   shutil.move(part_path(upload_id), os.path.join(current_app.config["UPLOAD_FOLDER"], filename))
   meta.update({"done": True, "filename": filename})
   write_meta(upload_id, meta)
   return jsonify({"done": True}), 200


# Cancels an upload and deletes what arrived so far
@uploads_page.route("/<upload_id>", methods=["DELETE"])
def cancelUpload(upload_id):
   meta = my_upload(upload_id)
   if meta is None:
      return not_found()
   remove_upload(upload_id, meta, delete_final_file=True)
   return jsonify({"success": True}), 200


# For /post/create: turns a finished upload id into the file's public URL.
# Returns (url, error message). The upload can only be used once.
def claim_upload(upload_id, allowed_extensions):
   meta = my_upload(upload_id)
   if meta is None or not meta.get("done"):
      return None, "The upload isn't finished or has expired. Please pick the file again."
   if meta["extension"] not in allowed_extensions:
      return None, "That file type can't be used here"
   remove_upload(upload_id)  # forget the bookkeeping; the file itself stays
   return f"/static/uploads/{meta['filename']}", None
