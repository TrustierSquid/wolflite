import os

import pytest

os.environ.setdefault("DB_KEY", "test-secret-key")

from wolfr import create_app  # noqa: E402  (DB_KEY must be set before the app loads)
from wolfr.db import init_db  # noqa: E402

PASSWORD = "Passw0rd!x"


@pytest.fixture
def app(tmp_path):
    """A fresh app with its own empty database and uploads folder for each test."""
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    app = create_app({
        "TESTING": True,
        "DATABASE": str(tmp_path / "test.sqlite"),
        "UPLOAD_FOLDER": str(uploads),
        "SESSION_COOKIE_SECURE": False,  # the test client doesn't use https
    })
    app.instance_path = str(tmp_path / "instance")
    with app.app_context():
        init_db()
    return app


@pytest.fixture
def guest(app):
    return app.test_client()


@pytest.fixture
def make_user(app):
    """make_user("alice1") -> a test client logged in as a new user (with .user_id)."""
    def make(username):
        client = app.test_client()
        created = client.post("/formSubmission", data={"username": username, "password": PASSWORD})
        assert created.status_code == 201, created.json
        logged_in = client.post("/loginUser", data={"username": username, "password": PASSWORD})
        assert logged_in.json.get("success"), logged_in.json
        client.user_id = client.get("/getUserData").json["currentUserID"]
        return client
    return make
