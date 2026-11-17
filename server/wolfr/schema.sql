DROP TABLE IF EXISTS user;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS polls;
DROP TABLE IF EXISTS poll_options;
DROP TABLE IF EXISTS votes;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS likes;
DROP TABLE IF EXISTS stashes;

CREATE TABLE user (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   username TEXT UNIQUE NOT NULL,
   password TEXT NOT NULL,
   created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   bio TEXT NULL, -- profile bio
   filename TEXT NULL, --profile picture
   profileBackground TEXT NULL --coming soon
);


CREATE TABLE posts (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   author_id INTEGER NOT NULL,
   created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   title TEXT NOT NULL,
   body TEXT NOT NULL,
   filename TEXT,
   FOREIGN KEY (author_id) REFERENCES user (id)
);


CREATE TABLE polls (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   author_id INTEGER NOT NULL,
   created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   question TEXT NOT NULL,
   isOpen BOOLEAN NOT NULL DEFAULT 1,
   archive_at DATETIME,
   isArchived BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE poll_options (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   poll_id INTEGER NOT NULL,
   option_text TEXT NOT NULL,
   users_voted INTEGER NOT NULL,
   FOREIGN KEY (poll_id) REFERENCES polls(id) on DELETE CASCADE
);

-- Votes for all polls. Contains the users that have voted for a particular poll
CREATE TABLE votes (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   user_id INTEGER NOT NULL,
   poll_id INTEGER NOT NULL,
   option_id INTEGER NOT NULL,
   created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   UNIQUE(user_id, poll_id),
   FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
   FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE
);

-- post comments
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL, --who made the comment
  poll_id INTEGER NULL, -- what poll was it on
  post_id INTEGER NULL, -- what post was it on
  commentBody TEXT NOT NULL,
  created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES user(id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);

CREATE TABLE likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL,
  poll_id INTEGER NULL,
  post_id INTEGER NULL,
  created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES user(id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  UNIQUE(author_id, poll_id, post_id)
);

-- Stashes (bookmarks): posts and polls a user saved to their stash list.
-- Personal: stashing doesn't hide or change the item for anyone else.
-- Exactly one of post_id / poll_id is set.
-- (Keep this in sync with ADDED_TABLES in db.py, which creates it on older databases.)
CREATE TABLE stashes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  post_id INTEGER NULL,
  poll_id INTEGER NULL,
  created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user(id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (poll_id) REFERENCES polls(id),
  UNIQUE(user_id, post_id),
  UNIQUE(user_id, poll_id)
);
