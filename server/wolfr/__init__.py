import os
import sqlite3
from flask import (
    Flask,
    request,
    jsonify,
    g,
    session,
    redirect,
    url_for,
    send_from_directory,
)
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from wolfr.db import get_db


# Creating the flask instance
def create_app(test_config=None):
    BASE_DIR = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..")
    )  # goes from wolfr → server
    app = Flask(
        __name__,
        static_folder=os.path.join(BASE_DIR, "static"),
        static_url_path="/client/wolflite/dist",
    )

    CORS(app, supports_credentials=True)

    # For development Only
    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",  # allow cross-site
        SESSION_COOKIE_SECURE=False      # keep False in dev if no HTTPS
    )

    app.config.from_mapping(
        SECRET_KEY="dev",
        DATABASE=os.path.join(app.instance_path, "wolfr.sqlite"),
    )

    # Setting this config for file uploads
    app.config["UPLOAD_FOLDER"] = os.path.join(app.static_folder, "uploads")

    # ensures that the static/uploads directories exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Allowed file extensions to be uploaded to the server
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}

    if test_config is None:
        # load the instance config, if it exists, when not testing
        app.config.from_pyfile("config.py", silent=True)
    else:
        # load the test config if passed in
        app.config.from_mapping(test_config)

    # ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass


    # React Router to work with browser refreshes and direct links, Flask must serve your index.html for all unknown (non-API) routes:
    @app.route("/", defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react(path):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        else:
            return send_from_directory(app.static_folder, 'index.html')




    # LOGIN/CREATE USER

    # middleware. Having quick access to the logged in users data
    @app.before_request
    def load_user():
        if request.endpoint in ("login", "formSubmission"):
            return

        user_id = session.get("user_id")

        if user_id is None:
            g.user = None
            print("redirecting.. no session")
            return jsonify({"error": "not logged in"}), 401
            # return redirect(url_for("login"))
        else:
            g.user = (
                get_db()
                .execute("SELECT * FROM user WHERE id = ?", (user_id,))
                .fetchone()
            )



    @app.route("/getUserData", methods=(["GET"]))
    def fetchUserData():
        user_id = session.get("user_id")


        db = get_db()
        cursor = db.cursor()

        try:
            currentUser = cursor.execute(
                "SELECT username, filename FROM user WHERE id = ?", (user_id,)
            ).fetchone()

            return jsonify({
                "currentUserName": currentUser['username'],
                "currentUserPfPicture": currentUser["filename"],
                "currentUserID": g.user[0]
            })
        except sqlite3.IntegrityError:
            return {"error": "no user here"}, 400





    @app.route("/loginUser", methods=(["POST"]))
    def login():
        db = get_db()

        # in order to execute SQL statements and fetch results we need a db cursor
        cursor = db.cursor()
        username = request.form["username"]
        password = request.form["password"]

        try:
            cursor.execute(
                "SELECT password, id FROM user WHERE username = ?", (username,)
            )
            user = cursor.fetchone()

            if user is None:
                return jsonify({"message": "username not found"})

            storedhash = user[0]

            if check_password_hash(storedhash, password):
                session["user_id"] = user[1]
                return jsonify({"success": "Welcome"}), 200
            else:
                return jsonify({"message": "Incorrect password"}), 200

        except sqlite3.IntegrityError as error:
            return jsonify({"errorMessage": "Username doesnt exist"})

    # Creating a new user
    @app.route("/formSubmission", methods=(["POST"]))
    def formSubmission():
        db = get_db()

        # in order to execute SQL statements and fetch results we need a db cursor
        cursor = db.cursor()
        username = request.form["username"]
        password = request.form["password"]
        pw_hash = generate_password_hash(password)

        try:
            cursor.execute(
                "INSERT INTO user (username, password) VALUES (?, ?)",
                (username, pw_hash),
            )

            # saving changes to the db
            db.commit()

        except sqlite3.IntegrityError as error:
            return jsonify({"errorMessage": "Username already exists"})

        print(f"New User Created!: {username}")
        return jsonify({"message": "Received"}), 201

    # @app.route("/login")
    # def login_page():
    #     return send_from_directory(app.static_folder, "index.html")

    from . import db
    db.init_app(app)

    from .routes import blog
    app.register_blueprint(blog.blog_page)

    from .routes import profileInfo
    app.register_blueprint(profileInfo.profile_page)

    return app
