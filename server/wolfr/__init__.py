import os
import re
import sqlite3
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
load_dotenv()
db_key = os.getenv("DB_KEY")

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

    # For development Only
    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",  # allow cross-site
        SESSION_COOKIE_SECURE=False      # keep False in dev if no HTTPS
    )

    app.config.from_mapping(
        # Key is used to securely sign session cookies
        SECRET_KEY=db_key,
        DATABASE=os.path.join(app.instance_path, "wolfr.sqlite"),
    )

    # Setting this config for file uploads
    app.config["UPLOAD_FOLDER"] = os.path.join(app.static_folder, "uploads")

    # ensures that the static/uploads directories exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

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

    # middleware. Having quick access to the logged in users data
    @app.before_request
    def load_user():
        db = get_db()
        cursor = db.cursor()

        # Skip auth for static files and index
        # This if statement prevents this middleware to run on endpoints where prior user is not required
        if (
            request.endpoint in ("login", "createUser", "serve_index")
            or request.path.startswith(app.static_url_path)
            or request.path.startswith("/uploads/")
            or request.endpoint == "static"
        ):
            return

        user_id = session.get("user_id")

        # if request.endpoint in these, give the session the user id, so it can be used later
        # For all endpoints except those explicitly skipped above, require login
        if user_id is None:
            g.user = None
            print("redirecting.. no session")
            return redirect("/login")
        else:
            g.user = (
                cursor.execute("SELECT * FROM user WHERE id = ?", (user_id,)).fetchone()
            )





    # Fetehes currently logged in user data (userid, picture and username. etc)
    @app.route("/getUserData", methods=(["GET"]))
    def fetchUserData():
        user_id = session.get("user_id")


        db = get_db()
        cursor = db.cursor()

        try:
            currentUser = cursor.execute(
                "SELECT username, created, filename, bio FROM user WHERE id = ?", (user_id,)
            ).fetchone()


            return jsonify({
                "currentUserName": currentUser["username"],
                "currentUserPfPicture": currentUser["filename"],
                "joinedDate": currentUser["created"],
                "bio": currentUser["bio"],
                "currentUserID": g.user[0]
            })
        except sqlite3.IntegrityError:
            return {"error": "no user here"}, 400





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

            if user is None:
                return jsonify({"message": "Username or Password Incorrect!"})

            storedhash = user[0]

            if check_password_hash(storedhash, password):

                # Creating session data
                session["user_id"] = user[1]

                return jsonify({"success": "Welcome"}), 200
            else:
                return jsonify({"message": "Incorrect password!"}), 200

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
        # Create post/poll page
        return send_from_directory(os.path.join(app.static_folder, "dist"), "settings.html")


    # Importing Database configurations
    from . import db
    db.init_app(app)

    # External Routes
    from .routes import blog
    app.register_blueprint(blog.blog_page)

    from .routes import profileInfo
    app.register_blueprint(profileInfo.profile_page)

    return app