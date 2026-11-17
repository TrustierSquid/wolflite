DROP TABLE IF EXISTS user;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS polls;
DROP TABLE IF EXISTS poll_options;
DROP TABLE IF EXISTS votes;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS likes;
DROP TABLE IF EXISTS stashes;
DROP TABLE IF EXISTS den_members;
DROP TABLE IF EXISTS dens;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS direct_messages;
DROP TABLE IF EXISTS conversation_members;
DROP TABLE IF EXISTS conversations;

CREATE TABLE user (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   username TEXT UNIQUE NOT NULL,
   password TEXT NOT NULL,
   created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   bio TEXT NULL, -- profile bio
   filename TEXT NULL, --profile picture
   profileBackground TEXT NULL, --coming soon
   theme TEXT NULL, -- appearance: 'system' | 'light' | 'dark' (NULL = never chosen)
   accent TEXT NULL -- appearance: accent color id, e.g. 'red' (NULL = never chosen)
);


-- Dens: communities that users create and join. Every post and poll belongs to one.
-- (Keep dens / den_members in sync with ADDED_TABLES in db.py, which creates them on older databases.)
CREATE TABLE dens (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   name TEXT UNIQUE NOT NULL COLLATE NOCASE, -- shown as the den's name and used in its URL (/den?name=...)
   description TEXT NOT NULL DEFAULT '',
   image TEXT NULL, -- den picture (NULL = letter placeholder)
   owner_id INTEGER NOT NULL, -- who created it
   created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   FOREIGN KEY (owner_id) REFERENCES user(id)
);

-- Who joined which den. The owner is a member too (role 'owner').
CREATE TABLE den_members (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   den_id INTEGER NOT NULL,
   user_id INTEGER NOT NULL,
   role TEXT NOT NULL DEFAULT 'member', -- 'owner' or 'member'
   created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   FOREIGN KEY (den_id) REFERENCES dens(id),
   FOREIGN KEY (user_id) REFERENCES user(id),
   UNIQUE(den_id, user_id)
);


CREATE TABLE posts (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   author_id INTEGER NOT NULL,
   created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   title TEXT NOT NULL,
   body TEXT NOT NULL,
   filename TEXT,
   den_id INTEGER NOT NULL, -- the den it was posted in
   FOREIGN KEY (author_id) REFERENCES user (id),
   FOREIGN KEY (den_id) REFERENCES dens (id)
);


CREATE TABLE polls (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   author_id INTEGER NOT NULL,
   created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   question TEXT NOT NULL,
   isOpen BOOLEAN NOT NULL DEFAULT 1,
   archive_at DATETIME,
   isArchived BOOLEAN NOT NULL DEFAULT 0,
   den_id INTEGER NOT NULL, -- the den it was posted in
   FOREIGN KEY (den_id) REFERENCES dens (id)
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
  edited TIMESTAMP NULL, -- when the comment was last edited (NULL = never)
  parent_id INTEGER NULL, -- set on replies: the top-level comment of the thread (one level deep)
  FOREIGN KEY (author_id) REFERENCES user(id),
  FOREIGN KEY (parent_id) REFERENCES comments(id),
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

-- Notifications shown in the notification panel. One row per recipient.
-- type: 'den_removed' (actor removed user_id from a den)
--       'mention'     (actor mentioned @user in a post / poll / comment)
--       'reply'       (actor replied to user_id's comment)
--       'comment'     (actor commented on user_id's post / poll)
--       'dm'          (direct messages, coming later)
-- den_name and snippet are copies, so the notification still reads right after
-- the den / post is renamed or deleted.
-- (Keep this in sync with ADDED_TABLES in db.py, which creates it on older databases.)
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL, -- who gets it
  type TEXT NOT NULL,
  actor_id INTEGER NULL, -- who caused it
  den_id INTEGER NULL,
  den_name TEXT NULL,
  post_id INTEGER NULL,
  poll_id INTEGER NULL,
  comment_id INTEGER NULL,
  snippet TEXT NULL, -- start of the text that mentioned them
  is_read BOOLEAN NOT NULL DEFAULT 0,
  created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user(id),
  FOREIGN KEY (actor_id) REFERENCES user(id)
);

CREATE INDEX notifications_by_user ON notifications (user_id, id);


-- ---------- Direct messages (API: docs/direct-messages-api.md) ----------
-- (Keep these in sync with ADDED_TABLES in db.py, which creates them on older databases.)

-- One row per conversation. Conversations are between two people for now; the
-- members table allows group conversations later without changing this table.
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP -- set to the newest message's time on every send (sorts the list)
);

-- Who is in each conversation, and how far each of them has read.
-- Unread for a user = messages from the other person with id > last_read_message_id.
CREATE TABLE conversation_members (
  conversation_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  last_read_message_id INTEGER NULL, -- NULL = hasn't read anything yet
  joined TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (user_id) REFERENCES user(id)
);

-- Find a user's conversations (and the shared one between two users) quickly
CREATE INDEX conversation_members_by_user ON conversation_members (user_id, conversation_id);

CREATE TABLE direct_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL, -- 1 to 2000 characters (checked by the API)
  created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (sender_id) REFERENCES user(id)
);

-- A conversation's messages in order, and "messages before / after id X" for paging and polling
CREATE INDEX direct_messages_by_conversation ON direct_messages (conversation_id, id);
