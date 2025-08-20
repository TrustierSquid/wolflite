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
from werkzeug.security import generate_password_hash, check_password_hash
from wolfr.db import get_db


def create_app(test_config=None):
    app = Flask(__name__, static_folder="../dist", static_url_path="")

    app.config.from_mapping(
        SECRET_KEY="dev",
        DATABASE=os.path.join(app.instance_path, "wolfr.sqlite"),
    )

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

    @app.route("/")
    def init():
        return "OK", 200

    # LOGIN/CREATE USER

    # middleware. Having quick access to the logged in users data
    @app.before_request
    def load_user():
        user_id = session.get("user_id")

        if user_id is None:
            g.user = None
            print("redirecting.. no session")
        else:
            g.user = (
                get_db()
                .execute("SELECT * FROM user WHERE id = ?", (user_id,))
                .fetchone()
            )

            print(dict(g.user))

        return

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

        print(f"Received username: {username}")
        print(f"Generated hash: {pw_hash}")

        return jsonify({"message": "Received"}), 201

    from . import db

    db.init_app(app)

    from .routes import blog

    app.register_blueprint(blog.blog_page)

    return app
