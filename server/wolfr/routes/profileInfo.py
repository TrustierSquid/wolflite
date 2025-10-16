import sqlite3
from flask import Blueprint, g, request, jsonify, redirect, current_app
from wolfr.db import get_db
from werkzeug.utils import secure_filename
import os
import datetime

# All endpoints are prefixed with /post (e.g /profileInfo/newendpoint)
profile_page = Blueprint("profileInfo", __name__, url_prefix="/profileInfo")

@profile_page.route("/fetch", methods=["GET"])
def retrieveLoggedInUserPost():
  db = get_db()
  cursor = db.cursor()

  # using Query string to  search a profile by user's ID
  user_id = int(request.args.get("id"))

  if not user_id:
    return jsonify({"error": "No user id provided"}), 204


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
      SELECT comments.author_id, comments.post_id, comments.commentBody, comments.created, user.username, user.filename AS userProfilePic
      FROM comments
      JOIN user ON comments.author_id = user.id
    """).fetchall()

    pollComments = cursor.execute("""
      SELECT comments.author_id, comments.poll_id, comments.commentBody, comments.created, user.username, user.filename AS userProfilePic
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
        "commentBody": comment["commentBody"]
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
        "commentBody": comment["commentBody"]
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
        "isPoll": False
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
        "isArchived": row["isArchived"],
        "archive_at": row["archive_at"],
        "whoVoted": voters
      })

    # GET ALL POLLS THAT THE USER HAS ARCHIVED
    archivedPolls = cursor.execute(
      """
      SELECT polls.*, user.username, user.filename AS userProfilePic,
      COUNT(likes.id) AS likeCount
      FROM polls
      JOIN user ON polls.author_id = user.id
      LEFT JOIN likes ON polls.id = likes.poll_id
      WHERE user.id = ? AND polls.isArchived = 0
      GROUP BY polls.id
      """, (user_id,)
    ).fetchall()

    allArchivedPolls = []

    for row in archivedPolls:
      allArchivedPolls.append({
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
        "isArchived": row["isArchived"],
        "archive_at": row["archive_at"],
        "whoVoted": voters
      })

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
        "likesByPost": likes_by_post.get(row["id"], [])
      })


    joinedDate = None
    if allLoggedInUserPosts:
      queried_username = allLoggedInUserPosts[0]["username"]
      profilePicture = allLoggedInUserPosts[0]["profilePic"]
      # Fetch joined date from user table
      user_row = cursor.execute("SELECT created FROM user WHERE id = ?", (user_id,)).fetchone()
      joinedDate = user_row["created"] if user_row else None
    else:
      # If user has no posts, fetch username separately
      user_row = cursor.execute("SELECT username, created, filename AS profilePic FROM user WHERE id = ?", (user_id,)).fetchone()
      queried_username = user_row["username"] if user_row else None
      profilePicture = user_row["profilePic"] if user_row else None
      joinedDate = user_row["created"] if user_row else None

    return jsonify({
      "allUserPosts": allLoggedInUserPosts,
      "allUserPolls": allLoggedInUserPolls,
      "archivedPolls": allArchivedPolls,
      "likedPosts": allLikedPosts,
      "username": queried_username,
      "userProfilePic": profilePicture,
      "joinedDate": joinedDate
    }), 200

  except sqlite3.IntegrityError:
    return jsonify({"error": "user does not exist"})






@profile_page.route('/closePoll/<int:pollToClose>', methods=['DELETE'])
def closePoll(pollToClose):
  db = get_db()
  cursor = db.cursor()

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


    return jsonify({"message": "Username change endpoint called"}), 200