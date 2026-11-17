import os
import re
import shutil
import sqlite3
from urllib.parse import urlencode
from dotenv import load_dotenv
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
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from wolfr.db import get_db

# loading environment variables
# load_dotenv()
env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(env_path)

# Creating the flask instance
def create_app(test_config=None):
    # server directory
    BASE_DIR = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..")
    )

    app = Flask(
        __name__,
        static_url_path="/static",
        static_folder=os.path.join(BASE_DIR, "static"),
    )

    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=True,     # HTTPS required in production
        DEBUG=False,
        TESTING=False
    )

    app.config.from_mapping(
        # Key is used to securely sign session cookies. Read when the app is
        # created (not when this module is imported), so the environment can be
        # set up first, e.g. by tests.
        SECRET_KEY=os.getenv("DB_KEY"),
        DATABASE=os.path.join(app.instance_path, "wolfr.sqlite"),
    )

    # Setting this config for file uploads
    app.config["UPLOAD_FOLDER"] = os.path.join(app.static_folder, "uploads")

    # Largest file someone can upload (photos, videos, pictures), in MB.
    # Set MAX_UPLOAD_MB in .env to change it (e.g. 200 for longer videos).
    # The browser checks files against this too (sent by /getUserData), so people
    # get a clear message instead of a failed upload.
    max_upload_mb = int(os.getenv("MAX_UPLOAD_MB") or 50)
    app.config["MAX_UPLOAD_BYTES"] = max_upload_mb * 1024 * 1024
    # Whole request body: the file plus 1 MB for the other form fields.
    # Anything bigger is rejected with a 413.
    app.config["MAX_CONTENT_LENGTH"] = app.config["MAX_UPLOAD_BYTES"] + 1024 * 1024

    # ensures that the static/uploads directories exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Default images (logo, default profile picture) live in wolfr/defaults.
    # Copy them into the uploads folder if missing (fresh dev clone or empty docker volume).
    defaults_dir = os.path.join(os.path.dirname(__file__), "defaults")
    for default_file in os.listdir(defaults_dir):
        target = os.path.join(app.config["UPLOAD_FOLDER"], default_file)
        if not os.path.exists(target):
            shutil.copy(os.path.join(defaults_dir, default_file), target)

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




    # LOGIN/CREATE USER

    # Endpoints that work without being logged in. Guests can browse (feeds, dens,
    # profiles); everything that changes something needs an account.
    # g.user is still loaded on these when someone is logged in.
    PUBLIC_ENDPOINTS = {
        # account
        "login", "createUser", "logout", "fetchUserData",
        # pages
        "serve_index", "serve_blog", "serve_profile", "serve_den",
        # reading content
        "post.retrievePosts", "profileInfo.retrieveLoggedInUserPost", "dens.listDens", "dens.getDen", "dens.listMembers", "search.search",
    }

    # HTML pages that need an account. Logged out visitors get redirected to
    # /login (and come back afterwards), while API endpoints answer with a 401
    # that the frontend turns into a "log in to continue" prompt.
    PAGE_ENDPOINTS = {"serve_create", "serve_settings", "serve_messages"}

    # middleware. Loads the logged in user into g.user for every request.
    # Routes must take the user's id from g.user["id"], NEVER from the request
    # (URL, query string or body), otherwise anyone could act as any user.
    @app.before_request
    def load_user():
        g.user = None

        if request.endpoint == "static" or request.path.startswith(app.static_url_path):
            return

        user_id = session.get("user_id")
        if user_id is not None:
            g.user = get_db().execute("SELECT * FROM user WHERE id = ?", (user_id,)).fetchone()
            # The session points at a user that no longer exists
            if g.user is None:
                session.clear()

        if g.user is None and request.endpoint not in PUBLIC_ENDPOINTS:
            if request.endpoint in PAGE_ENDPOINTS:
                return redirect("/login?" + urlencode({"next": request.full_path.rstrip("?")}))
            return jsonify({"error": "Log in to do that"}), 401


    # Fetches currently logged in user data (userid, picture and username. etc).
    # Guests get {"loggedIn": false}.
    @app.route("/getUserData", methods=(["GET"]))
    def fetchUserData():
        if g.user is None:
            return jsonify({"loggedIn": False})
        return jsonify({
            "loggedIn": True,
            "currentUserName": g.user["username"],
            "currentUserPfPicture": g.user["filename"],
            "joinedDate": g.user["created"],
            "bio": g.user["bio"],
            "currentUserID": g.user["id"],
            # Appearance saved to the account (None = never chosen)
            "theme": g.user["theme"],
            "accent": g.user["accent"],
            # Largest upload allowed, so the browser can check files before sending them
            "maxUploadBytes": app.config["MAX_UPLOAD_BYTES"]
        })


    @app.route("/logout", methods=["POST"])
    def logout():
        session.clear()
        return jsonify({"message": "Logged out"}), 200





    @app.route("/loginUser", methods=(["POST"]))
    def login():
        db = get_db()
        cursor = db.cursor()

        username = request.form["username"]
        password = request.form["password"]


        try:
            cursor.execute(
                "SELECT password, id FROM user WHERE username = ?", (username,)
            )
            user = cursor.fetchone()

            # Same message whether the username or the password is wrong, so the
            # login form can't be used to find out which usernames exist
            if user is None or not check_password_hash(user["password"], password):
                return jsonify({"message": "Username or Password Incorrect!"}), 200

            # Start a fresh session for the logged in user
            session.clear()
            session["user_id"] = user["id"]

            return jsonify({"success": "Welcome"}), 200

        except sqlite3.IntegrityError as error:
            return jsonify({"errorMessage": "Username doesnt exist"})






    # Creating a new user
    @app.route("/formSubmission", methods=(["POST"]))
    def createUser():
        db = get_db()
        cursor = db.cursor()

        # special characters
        specialPasswordCharacters = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '=', '+', '[', ']', '{', '}', '|', '\\', ':', ';', '"', "'", '<', '>', ',', '.', '?', '/']
        USERNAME_RE = re.compile(r'^[A-Za-z0-9._-]{5,30}$')  # whitelist: letters, numbers, dot, underscore, hyphen
        SPECIAL_RE = re.compile(r'[!@#\$%\^&\*\(\)\-\_\=\+\[\]\{\}\|\\:;\"\'<>,\.\?\/]')

        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        pw_hash = generate_password_hash(password)



        # Username and password sanitation
        if not USERNAME_RE.fullmatch(username):
            return jsonify({"sanitationError": "Username may only contain letters, numbers, dots, underscores, and hyphens."}), 400

        if len(username) < 5 or len(username) > 20:
            return jsonify({"sanitationError": "Username must be 5-30 Characters long."}), 400



        # Password policy
        if len(password) < 8:
            return jsonify({"sanitationError": "Password must be at least 8 characters."}), 400

        if not re.search(r'[A-Z]', password):
            return jsonify({"sanitationError": "Password must include an uppercase letter."}), 400

        if not re.search(r'[a-z]', password):
            return jsonify({"sanitationError": "Password must include a lowercase letter."}), 400

        if not re.search(r'\d', password):
            return jsonify({"sanitationError": "Password must include a digit."}), 400

        if not SPECIAL_RE.search(password):
            return jsonify({"sanitationError": "Password must include at least one special character (e.g. !@#$%)."}), 400

        if not any(char in password for char in specialPasswordCharacters):
            return jsonify({"sanitationError": "Password must contain a special character (e.g !@#$%)"})

        try:
            cursor.execute(
                "INSERT INTO user (username, password) VALUES (?, ?)",
                (username, pw_hash),
            )

            # saving changes to the db
            db.commit()

        except sqlite3.IntegrityError as error:
            return jsonify({"errorMessage": "Username already exists"}), 400

        print(f"New User Created!: {username}")
        return jsonify({"message": "Received"}), 201




    # Serving the appropriate page at the respective endpoint
    @app.route("/")
    @app.route("/login")
    def serve_index():
        # login/create user page
        return send_from_directory(os.path.join(app.static_folder, "dist"), "index.html")

    @app.route("/blog")
    def serve_blog():
        # Main Post Feed page
        return send_from_directory(os.path.join(app.static_folder, "dist"), "blog.html")

    @app.route("/profile")
    def serve_profile():
        # Profile page
        return send_from_directory(os.path.join(app.static_folder, "dist"), "profile.html")

    @app.route('/create')
    def serve_create():
        # Create post/poll page
        return send_from_directory(os.path.join(app.static_folder, "dist"), "create.html")

    @app.route('/settings')
    def serve_settings():
        # Account settings page
        return send_from_directory(os.path.join(app.static_folder, "dist"), "settings.html")

    @app.route('/den')
    def serve_den():
        # One den's page (/den?name=homelab)
        return send_from_directory(os.path.join(app.static_folder, "dist"), "den.html")

    @app.route('/messages')
    def serve_messages():
        # Direct messages page (the /dm API behind it: docs/direct-messages-api.md)
        return send_from_directory(os.path.join(app.static_folder, "dist"), "messages.html")


    # Importing Database configurations
    from . import db
    db.init_app(app)

    # External Routes
    from .routes import blog
    app.register_blueprint(blog.blog_page)

    from .routes import profileInfo
    app.register_blueprint(profileInfo.profile_page)

    from .routes import dens
    app.register_blueprint(dens.dens_page)

    from .routes import notifications
    app.register_blueprint(notifications.notifications_page)

    from .routes import search
    app.register_blueprint(search.search_page)

    from .routes import messages
    app.register_blueprint(messages.messages_page)

    from .routes import uploads
    app.register_blueprint(uploads.uploads_page)

    return app