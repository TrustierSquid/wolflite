"""Core flows, run by CI on every push (see .github/workflows/ci-cd.yml).

Run locally from server/ with the virtual environment active:
    pip install pytest
    pytest
"""
import io


# ---------- Accounts ----------

def test_signup_rules(guest):
    assert guest.post("/formSubmission", data={"username": "ab", "password": "Passw0rd!x"}).status_code == 400
    assert guest.post("/formSubmission", data={"username": "valid_name", "password": "short"}).status_code == 400
    assert guest.post("/formSubmission", data={"username": "valid_name", "password": "Passw0rd!x"}).status_code == 201
    assert guest.post("/formSubmission", data={"username": "valid_name", "password": "Passw0rd!x"}).status_code == 400


def test_login_and_logout(guest, make_user):
    make_user("alice1")
    wrong = guest.post("/loginUser", data={"username": "alice1", "password": "nope"})
    assert "success" not in wrong.json
    assert guest.post("/loginUser", data={"username": "alice1", "password": "Passw0rd!x"}).json["success"]
    assert guest.get("/getUserData").json["currentUserName"] == "alice1"
    guest.post("/logout")
    assert guest.get("/getUserData").json == {"loggedIn": False}


# ---------- Guests can browse, not change things ----------

def test_guests_browse_but_cannot_post(guest):
    assert guest.get("/post/fetch").status_code == 200
    assert guest.get("/dens/list").status_code == 200
    assert guest.get("/search?q=x").status_code == 200
    assert guest.post("/dens/create", data={"name": "nope1", "description": "d"}).status_code == 401
    assert guest.get("/notifications").status_code == 401
    assert guest.get("/dm/conversations").status_code == 401
    redirect = guest.get("/create")
    assert redirect.status_code == 302 and redirect.headers["Location"].startswith("/login?next=")


# ---------- Dens and posts ----------

def test_den_post_feed(make_user, guest):
    alice, bob = make_user("alice1"), make_user("bobby1")
    den = alice.post("/dens/create", data={"name": "homelab", "description": "Servers"}).json["den"]
    assert den["isOwner"] and den["memberCount"] == 1

    # Must join to post
    post = {"postTitle": "Hello", "postContent": "World", "denId": den["id"]}
    assert bob.post("/post/create", data=post).status_code == 403
    bob.post(f"/dens/{den['id']}/join")
    assert bob.post("/post/create", data=post).status_code == 201

    feed = guest.get("/post/fetch?den=homelab").json["feed"]
    assert [item["title"] for item in feed] == ["Hello"]
    assert feed[0]["den"]["name"] == "homelab"
    assert [item["title"] for item in alice.get("/post/fetch?feed=home").json["feed"]] == ["Hello"]


def test_moderation(make_user):
    owner, mod, member = make_user("owner1"), make_user("moddy1"), make_user("member1")
    den = owner.post("/dens/create", data={"name": "homelab", "description": "d"}).json["den"]
    for client in (mod, member):
        client.post(f"/dens/{den['id']}/join")
    owner.put(f"/dens/{den['id']}/members/{mod.user_id}/role", json={"role": "moderator"})

    member.post("/post/create", data={"postTitle": "spam", "postContent": "b", "denId": den["id"]})
    post_id = member.get("/post/fetch").json["feed"][0]["id"]
    assert mod.delete(f"/post/delete/{post_id}/false").status_code == 200
    assert mod.delete(f"/dens/{den['id']}/members/{member.user_id}").status_code == 200
    assert mod.delete(f"/dens/{den['id']}/members/{owner.user_id}").status_code == 403
    assert owner.delete(f"/dens/{den['id']}", json={"confirmName": "homelab"}).status_code == 200


# ---------- Notifications ----------

def test_mentions_and_replies_notify(make_user):
    alice, bob = make_user("alice1"), make_user("bobby1")
    den = alice.post("/dens/create", data={"name": "homelab", "description": "d"}).json["den"]
    bob.post(f"/dens/{den['id']}/join")
    alice.post("/post/create", data={"postTitle": "hi @bobby1", "postContent": "b", "denId": den["id"]})
    post_id = alice.get("/post/fetch").json["feed"][0]["id"]
    bob.post("/post/postComment", json={"commentBody": "thanks", "postID": post_id, "isPoll": False})

    assert [n["type"] for n in bob.get("/notifications").json["notifications"]] == ["mention"]
    assert [n["type"] for n in alice.get("/notifications").json["notifications"]] == ["comment"]


# ---------- Direct messages ----------

def test_direct_messages(make_user):
    alice, bob, carol = make_user("alice1"), make_user("bobby1"), make_user("carol1")
    conversation = alice.post("/dm/conversations", json={"userId": bob.user_id}).json["conversation"]
    assert bob.post("/dm/conversations", json={"userId": alice.user_id}).json["conversation"]["id"] == conversation["id"]

    url = f"/dm/conversations/{conversation['id']}/messages"
    assert alice.post(url, json={"body": "hey"}).status_code == 201
    assert carol.get(url).status_code == 404  # not in it
    assert bob.get("/dm/conversations").json["unreadTotal"] == 1
    bob.put(f"/dm/conversations/{conversation['id']}/read")
    assert bob.get("/dm/conversations").json["unreadTotal"] == 0
    assert [m["body"] for m in bob.get(url).json["messages"]] == ["hey"]


# ---------- Uploads ----------

def test_chunked_upload_then_post(app, make_user):
    alice = make_user("alice1")
    den = alice.post("/dens/create", data={"name": "homelab", "description": "d"}).json["den"]
    data = b"0123456789" * 1000

    started = alice.post("/upload/start", json={"filename": "clip.mp4", "size": len(data)}).json
    upload_id = started["uploadId"]
    half = len(data) // 2
    for offset, piece in ((0, data[:half]), (half, data[half:])):
        r = alice.put(f"/upload/{upload_id}?offset={offset}", data=piece, content_type="application/octet-stream")
        assert r.status_code == 200
    assert alice.post(f"/upload/{upload_id}/finish").json == {"done": True}

    r = alice.post("/post/create", data={"postTitle": "clip", "postContent": "b", "denId": den["id"], "uploadId": upload_id})
    assert r.status_code == 201
    saved = r.json["url"].rsplit("/", 1)[1]
    with open(f"{app.config['UPLOAD_FOLDER']}/{saved}", "rb") as f:
        assert f.read() == data


def test_upload_type_and_size_limits(make_user):
    alice = make_user("alice1")
    assert alice.post("/upload/start", json={"filename": "evil.exe", "size": 10}).status_code == 400
    too_big = 10 ** 12
    assert alice.post("/upload/start", json={"filename": "huge.mp4", "size": too_big}).status_code == 413
    bad_picture = {"file": (io.BytesIO(b"x"), "not-an-image.exe")}
    assert alice.put("/post/updateProfilePicture", data=bad_picture).status_code == 400
