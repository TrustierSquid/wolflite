import sqlite3
from flask import Blueprint, g, request, jsonify, redirect, current_app
from wolfr.db import get_db
from wolfr.routes.blog import build_feed_items, get_stashed_ids, get_stash_counts
from werkzeug.utils import secure_filename
import os
import datetime
from flask import session

# All endpoints are prefixed with /post (e.g /profileInfo/newendpoint)
profile_page = Blueprint("profileInfo", __name__, url_prefix="/profileInfo")

@profile_page.route("/fetch", methods=["GET"])
def retrieveLoggedInUserPost():
  db = get_db()
  cursor = db.cursor()

  # using Query string to  search a profile by user's ID
  user_id = request.args.get("id", type=int)

  if not user_id:
    return jsonify({"error": "No user id provided"}), 400


  # If the user searched in the query string does not exist, send back error
  findUser = cursor.execute(
    """
      SELECT * FROM user WHERE id = ?
    """, (user_id,)).fetchone()

  # Return user does not exist
  if findUser is None:
    return '', 204


  try:
    # Querying all posts from the current logged in user, selecting both filenames
    userPostedPosts = cursor.execute(
      """
      SELECT posts.*, posts.filename AS postPic, user.filename AS profilePic, user.username,
      COUNT(likes.id) AS likeCount
      FROM posts
      JOIN user ON posts.author_id = user.id
      LEFT JOIN likes ON posts.id = likes.post_id
      WHERE user.id = ?
      GROUP BY posts.id
      """, (user_id,)
    ).fetchall()

    userPostedPolls = cursor.execute(
      """
      SELECT polls.*, user.username, user.filename AS userProfilePic,
      COUNT(likes.id) AS likeCount
      FROM polls
      JOIN user ON polls.author_id = user.id
      LEFT JOIN likes ON polls.id = likes.poll_id
      WHERE user.id = ?
      GROUP BY polls.id
      """, (user_id,)
    ).fetchall()

    # Selecting all poll options
    options = cursor.execute(
        "SELECT * FROM poll_options"
    ).fetchall()

    # Blueprint FOR POLLS Results
    option_map = {}
    for opt in options:
        # Fetch user IDs who voted for this option
        voters = cursor.execute(
        "SELECT user_id FROM votes WHERE option_id = ?", (opt["id"],)
        ).fetchall()
        voter_ids = [v["user_id"] for v in voters]

        option_map.setdefault(opt["poll_id"], []).append({
          "id": opt["id"],
          "option_text": opt["option_text"],
          "user_voted": opt["users_voted"],
          "voters": voter_ids,
        })

    comments = cursor.execute("""
      SELECT comments.id, comments.edited, comments.author_id, comments.post_id, comments.commentBody, comments.created, user.username, user.filename AS userProfilePic
      FROM comments
      JOIN user ON comments.author_id = user.id
    """).fetchall()

    pollComments = cursor.execute("""
      SELECT comments.id, comments.edited, comments.author_id, comments.poll_id, comments.commentBody, comments.created, user.username, user.filename AS userProfilePic
      FROM comments
      JOIN user ON comments.author_id = user.id
    """).fetchall()

    # Organize comments by post_id
    comments_by_post = {}
    for comment in comments:
      post_id = comment["post_id"]
      comments_by_post.setdefault(post_id, []).append({
        "author_id": comment["author_id"],
        "author_username": comment["username"],
        "profilePic": comment["userProfilePic"],
        "post_id": comment["post_id"],
        "created": comment["created"],
        "commentBody": comment["commentBody"],
        "id": comment["id"],
        "edited": comment["edited"]
      })

    # Organize comments by poll_id
    comments_by_poll = {}
    for comment in pollComments:
      poll_id = comment["poll_id"]
      comments_by_poll.setdefault(poll_id, []).append({
        "author_id": comment["author_id"],
        "author_username": comment["username"],
        "profilePic": comment["userProfilePic"],
        "poll_id": comment["poll_id"],
        "created": comment["created"],
        "commentBody": comment["commentBody"],
        "id": comment["id"],
        "edited": comment["edited"]
      })

    # Get all likes per post with like author id and username
    likesMembers = cursor.execute("""
        SELECT likes.post_id, likes.author_id, user.username
        FROM likes
        JOIN user ON likes.author_id = user.id
    """).fetchall()

    likesMembersPoll = cursor.execute(
      """
      SELECT likes.poll_id, likes.author_id, user.username
      FROM likes
      JOIN user ON likes.author_id = user.id
      """
    ).fetchall()

    # map for likes (lists all users by id and username who liked a post)
    likes_by_post = {}
    for like in likesMembers:
        post_id = like["post_id"]

        if post_id not in likes_by_post:
          likes_by_post[post_id] = []
        likes_by_post[post_id].append({
          "author_id": like["author_id"],
          "username": like["username"]
        })

    # map for likes (lists all users by id and username who liked a poll)
    likes_by_poll = {}
    for like in likesMembersPoll:
      poll_id = like["poll_id"]

      if poll_id not in likes_by_poll:
          likes_by_poll[poll_id] = []
      likes_by_poll[poll_id].append({
        "author_id": like["author_id"],
        "username": like["username"]
      })


    # Stash state is about the person VIEWING the profile: which items they stashed,
    # plus how many users stashed each item
    stashed_post_ids, stashed_poll_ids = get_stashed_ids(g.user["id"])
    post_stash_counts, poll_stash_counts = get_stash_counts()

    # Map for all of the logged in users posts
    allLoggedInUserPosts = []
    for row in userPostedPosts:
      allLoggedInUserPosts.append({
        "id": row["id"],
        "author_id": row["author_id"],
        "created": row["created"],
        "title": row["title"],
        "body": row["body"],
        "postPic": row["postPic"],
        "profilePic": row["profilePic"],
        "likeCount": row["likeCount"],
        "username": row["username"],
        "likesByPost": likes_by_post.get(row["id"], []),
        "comments": comments_by_post.get(row["id"], []),
        "isPoll": False,
        "isStashed": row["id"] in stashed_post_ids,
        "stashCount": post_stash_counts.get(row["id"], 0)
      })


    # Map for all of the logged in users poll
    allLoggedInUserPolls = []

    for row in userPostedPolls:
      # Getting total votes for each poll
      result = cursor.execute("""
        SELECT SUM(users_voted) AS total_votes FROM poll_options WHERE poll_id = ? """, (row["id"],)
      ).fetchone()

      total_votes = result["total_votes"] if result and result["total_votes"] is not None else 0

      # For each poll, get all voters with their profile pic and username
      voters_info = cursor.execute("""
        SELECT DISTINCT user.id, user.username, user.filename AS profilePic
        FROM votes
        JOIN user ON votes.user_id = user.id
        WHERE votes.poll_id = ?
      """, (row["id"],)).fetchall()
      voters = [
        {
          "id": voter["id"],
          "username": voter["username"],
          "profilePic": voter["profilePic"]
        }
        for voter in voters_info
      ]

      allLoggedInUserPolls.append({
        "id": row["id"],
        "author_id": row["author_id"],
        "created": row["created"],
        "question": row["question"],
        "username": row["username"],
        # appended the blueprint of the options map
        "options": option_map.get(row["id"], []),
        "totalVotes": total_votes,
        "profilePic": row["userProfilePic"],
        "likeCount": row["likeCount"],
        "likesByPoll": likes_by_poll.get(row["id"], []),
        "comments": comments_by_poll.get(row["id"], []),
        "isPoll": True,
        "isOpen": row["isOpen"],
        "archive_at": row["archive_at"],
        "whoVoted": voters,
        "isStashed": row["id"] in stashed_poll_ids,
        "stashCount": poll_stash_counts.get(row["id"], 0)
      })

    # The stash list is private: only returned when viewing your own profile.
    # It can contain anyone's posts and polls, so it reuses the feed builder.
    if g.user["id"] == user_id:
      stashedItems = [item for item in build_feed_items() if item["isStashed"]]
    else:
      stashedItems = []

    # FETCHING ALL POSTS THAT THE USER HAS LIKED
    likedPosts = cursor.execute(
      """
      SELECT posts.*, posts.filename AS postPic, user.username, user.filename AS profilePic,
        (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS PostLikeCount
      FROM posts
      JOIN user ON posts.author_id = user.id
      WHERE posts.id IN (
        SELECT post_id FROM likes WHERE author_id = ?
        );
      """, (user_id,)
    ).fetchall()


    allLikedPosts = []

    for row in likedPosts:
      allLikedPosts.append({
        "id": row["id"],
        "author_id": row["author_id"],
        "created": row["created"],
        "title": row["title"],
        "body": row["body"],
        "postPic": row["postPic"],
        "username": row["username"],
        "profilePic": row["profilePic"],
        "likeCount": row["PostLikeCount"],
        "isPoll": False,
        "comments": comments_by_post.get(row["id"], []),
        "likesByPost": likes_by_post.get(row["id"], []),
        "isStashed": row["id"] in stashed_post_ids,
        "stashCount": post_stash_counts.get(row["id"], 0)
      })


    # Details of the profile being viewed (findUser was loaded at the top)
    return jsonify({
      "allUserPosts": allLoggedInUserPosts,
      "allUserPolls": allLoggedInUserPolls,
      "stashed": stashedItems,
      "likedPosts": allLikedPosts,
      "userId": findUser["id"],
      "username": findUser["username"],
      "userProfilePic": findUser["filename"],
      "joinedDate": findUser["created"],
      "bio": findUser["bio"]
    }), 200

  except sqlite3.IntegrityError:
    return jsonify({"error": "user does not exist"})






@profile_page.route('/closePoll/<int:pollToClose>', methods=['DELETE'])
def closePoll(pollToClose):
  db = get_db()
  cursor = db.cursor()

  # Only the poll's author can close it
  poll = cursor.execute("SELECT author_id FROM polls WHERE id = ?", (pollToClose,)).fetchone()
  if poll is None:
    return jsonify({"message": "Poll not found"}), 404
  if poll["author_id"] != g.user["id"]:
    return jsonify({"message": "You can only close your own polls"}), 403

  try:
    if request.method == "DELETE":

      # Schedule deletion by setting a "close_time" or "delete_at" timestamp in the polls table
      # (Assumes you have a "delete_at" column of type DATETIME in your polls table)

      days_until_close = 2  # Number of days after closing to archive the poll
      archive_at = datetime.datetime.utcnow() + datetime.timedelta(days=days_until_close)

      cursor.execute(
        """
        UPDATE polls
        SET archive_at = ?
        WHERE id = ?
        """, (archive_at, pollToClose)
      )

      archive_at_row = cursor.execute(
        "SELECT archive_at FROM polls WHERE id = ?", (pollToClose,)
      ).fetchone()
      archive_at = archive_at_row["archive_at"] if archive_at_row else None

      # If the archive date is in the past or now, archive the poll immediately
      if archive_at and datetime.datetime.strptime(archive_at.split('.')[0], "%Y-%m-%d %H:%M:%S") <= datetime.datetime.utcnow():
        cursor.execute(
          """
          UPDATE polls
          SET isArchived = 1
          WHERE id = ?
          """, (pollToClose,)
        )

      # closing the poll
      cursor.execute(
        """
        UPDATE polls
        SET isOpen = 0
        WHERE id = ?
        """, (pollToClose,)
      )

      db.commit()


    return jsonify({"message": f"Successfully closed poll {pollToClose}"}), 200
  except sqlite3.IntegrityError:
    return jsonify({"message": "Failed to close poll"}), 500




@profile_page.route('/changeUsername', methods=['PUT'])
def changeUsername():
  db = get_db()
  cursor = db.cursor()
  data = request.get_json()
  newUsername = data['newUsername'].replace(" ", "")

  if request.method == 'PUT':

    cursor.execute(
      """
      UPDATE user
      SET username = ?
      WHERE id = ?
      """, (newUsername, g.user['id'])
    )

    db.commit()


    return jsonify({"message": "Username change"}), 200

  return 200



# Removes the logged in user's profile picture (falls back to the default picture)
@profile_page.route('/deleteProfilePic', methods=['PUT'])
def deleteProfilePicture():
  db = get_db()
  db.execute("UPDATE user SET filename = null WHERE id = ?", (g.user["id"],))
  db.commit()

  return jsonify({"message": "Deleted profile picture"}), 200


# Changes the logged in user's bio
@profile_page.route('/changeBio', methods=['PUT'])
def changeBio():
  data = request.get_json(silent=True) or {}
  newBio = str(data.get("newBio") or "").strip()[:500]

  db = get_db()
  db.execute("UPDATE user SET bio = ? WHERE id = ?", (newBio, g.user["id"]))
  db.commit()

  return jsonify({"message": "Updated bio"}), 200


# Deletes the logged in user's account and logs them out
@profile_page.route('/deleteProfile', methods=['DELETE'])
def deleteUser():
  db = get_db()
  # Their stashes would otherwise keep counting toward other posts' stash counts
  db.execute("DELETE FROM stashes WHERE user_id = ?", (g.user["id"],))
  db.execute("DELETE FROM user WHERE id = ?", (g.user["id"],))
  db.commit()

  session.clear()

  return jsonify({"message": "Deleted account"}), 200