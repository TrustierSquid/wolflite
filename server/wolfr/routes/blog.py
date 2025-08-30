import sqlite3
from flask import Blueprint, g, request, jsonify, redirect, current_app
from wolfr.db import get_db
from werkzeug.utils import secure_filename
import os

blog_page = Blueprint("post", __name__, url_prefix="/post")


# Retireves existing Posts
@blog_page.route("/fetch", methods=["GET"])
def retrievePosts():
   db = get_db()
   cursor = db.cursor()

   try:
      posts = cursor.execute(
         'SELECT * FROM posts'
         ' JOIN user ON posts.author_id = user.id'
      ).fetchall()


      results = []
      for row in posts:
         results.append({
            "id": row["id"],
            "author_id": row["author_id"],
            "created": row["created"],
            "filename": row["filename"],
            "title": row["title"],
            "body": row["body"],
            "username": row["username"]
         })


      return jsonify({"posts": results}), 200

   except sqlite3.IntegrityError:
      return jsonify({"message": "Table or column doesnt exist"})


# Allowed file extensions to be uploaded to the server
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# FILE/IMAGE UPLOAD HANDLING
def allowed_file(filename):
   return '.' in filename and \
      filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

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

         # Image handling
         file = request.files['file']

         if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            file_url = f"/static/uploads/{filename}"

            file.save(filepath)

            # Cursor for sqlite so we can make SQL commands
            cursor = db.cursor()
            cursor.execute("INSERT INTO posts (author_id, title, body, filename) VALUES (?, ?, ?, ?)", (g.user[0], postTitle, postContent, file_url))
            db.commit()


            return {"url": file_url}, 201

      except sqlite3.IntegrityError:
         return jsonify({"message": "something went wrong"})



   return {"error": "Invalid file"}, 400
