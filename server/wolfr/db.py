import click
from flask import current_app, g

import os
import sqlite3
from datetime import datetime


# establishing the db connection
def get_db():
   if 'db' not in g:
      g.db = sqlite3.connect(
         current_app.config['DATABASE'],
         detect_types=sqlite3.PARSE_DECLTYPES
      )

      # tells the connection to return rows that behave like dicts.
      # This allows accessing the columns by name.
      g.db.row_factory = sqlite3.Row

   return g.db


def close_db(e=None):
   db = g.pop('db', None)

   if db is not None:
      db.close()


def init_db():
   db = get_db()

   with current_app.open_resource('schema.sql') as f:
      db.executescript(f.read().decode('utf8'))


# Tables and columns added after the first release. upgrade_db() creates any that
# are missing, so existing databases (including production) keep their data
# instead of needing `init-db`, which wipes everything.
# When you add a table or column to schema.sql, add it here too.

# CREATE TABLE IF NOT EXISTS statements
ADDED_TABLES = [
   """
   CREATE TABLE IF NOT EXISTS stashes (
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
   )
   """,
   """
   CREATE TABLE IF NOT EXISTS dens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL COLLATE NOCASE,
      description TEXT NOT NULL DEFAULT '',
      image TEXT NULL,
      owner_id INTEGER NOT NULL,
      created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES user(id)
   )
   """,
   """
   CREATE TABLE IF NOT EXISTS den_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      den_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (den_id) REFERENCES dens(id),
      FOREIGN KEY (user_id) REFERENCES user(id),
      UNIQUE(den_id, user_id)
   )
   """,
   """
   CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      actor_id INTEGER NULL,
      den_id INTEGER NULL,
      den_name TEXT NULL,
      post_id INTEGER NULL,
      poll_id INTEGER NULL,
      comment_id INTEGER NULL,
      snippet TEXT NULL,
      is_read BOOLEAN NOT NULL DEFAULT 0,
      created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user(id),
      FOREIGN KEY (actor_id) REFERENCES user(id)
   )
   """,
   "CREATE INDEX IF NOT EXISTS notifications_by_user ON notifications (user_id, id)",
   # Direct messages (see schema.sql for what each column means)
   """
   CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
   )
   """,
   """
   CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      last_read_message_id INTEGER NULL,
      joined TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (conversation_id, user_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id),
      FOREIGN KEY (user_id) REFERENCES user(id)
   )
   """,
   "CREATE INDEX IF NOT EXISTS conversation_members_by_user ON conversation_members (user_id, conversation_id)",
   """
   CREATE TABLE IF NOT EXISTS direct_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id),
      FOREIGN KEY (sender_id) REFERENCES user(id)
   )
   """,
   "CREATE INDEX IF NOT EXISTS direct_messages_by_conversation ON direct_messages (conversation_id, id)",
]

# (table, column, definition)
# SQLite can't add a NOT NULL column without a default, so den_id is nullable here;
# the routes always set it (schema.sql declares it NOT NULL for new databases).
ADDED_COLUMNS = [
   ("comments", "edited", "TIMESTAMP NULL"),
   ("comments", "parent_id", "INTEGER NULL REFERENCES comments(id)"),
   ("posts", "den_id", "INTEGER NULL REFERENCES dens(id)"),
   ("polls", "den_id", "INTEGER NULL REFERENCES dens(id)"),
   ("user", "theme", "TEXT NULL"),
   ("user", "accent", "TEXT NULL"),
]


def table_columns(db, table):
   return {row["name"] for row in db.execute(f"PRAGMA table_info({table})")}


# Every post and poll must belong to a den. Posts made before dens existed have
# none, so they are deleted (with their likes, comments, votes, stashes and media)
# the first time the server starts with den support.
def remove_posts_without_den(db):
   media = [row["filename"] for row in db.execute(
      "SELECT filename FROM posts WHERE den_id IS NULL AND filename IS NOT NULL"
   )]

   db.execute("DELETE FROM likes WHERE post_id IN (SELECT id FROM posts WHERE den_id IS NULL)")
   db.execute("DELETE FROM likes WHERE poll_id IN (SELECT id FROM polls WHERE den_id IS NULL)")
   db.execute("DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE den_id IS NULL)")
   db.execute("DELETE FROM comments WHERE poll_id IN (SELECT id FROM polls WHERE den_id IS NULL)")
   db.execute("DELETE FROM stashes WHERE post_id IN (SELECT id FROM posts WHERE den_id IS NULL)")
   db.execute("DELETE FROM stashes WHERE poll_id IN (SELECT id FROM polls WHERE den_id IS NULL)")
   db.execute("DELETE FROM votes WHERE poll_id IN (SELECT id FROM polls WHERE den_id IS NULL)")
   db.execute("DELETE FROM poll_options WHERE poll_id IN (SELECT id FROM polls WHERE den_id IS NULL)")
   db.execute("DELETE FROM posts WHERE den_id IS NULL")
   db.execute("DELETE FROM polls WHERE den_id IS NULL")
   return media


def upgrade_db():
   db = get_db()

   # Only upgrade databases that were initialised (init-db creates everything itself)
   if not db.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'user'").fetchone():
      return

   # One transaction with a write lock, so gunicorn workers starting at the same
   # time upgrade one after another instead of racing each other
   db.execute("BEGIN IMMEDIATE")
   try:
      for statement in ADDED_TABLES:
         db.execute(statement)

      adding_dens = "den_id" not in table_columns(db, "posts")

      for table, column, definition in ADDED_COLUMNS:
         existing = table_columns(db, table)
         # A table missing entirely means the db was never initialised; init-db handles that
         if existing and column not in existing:
            db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

      orphaned_media = remove_posts_without_den(db) if adding_dens else []
      db.commit()
   except Exception:
      db.rollback()
      raise

   delete_uploads(orphaned_media)


# Deletes uploaded files by their public URL (/static/uploads/...). Never touches
# the shared default images or anything outside the uploads folder.
def delete_uploads(urls):
   defaults = set(os.listdir(os.path.join(os.path.dirname(__file__), "defaults")))
   for url in urls:
      if not url or not url.startswith("/static/uploads/"):
         continue
      filename = os.path.basename(url)
      path = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
      if filename not in defaults and os.path.isfile(path):
         os.remove(path)


@click.command('init-db')
def init_db_command():
   # wipes existing data and creates a new db instance
   init_db()
   click.echo('Initialized the db')

sqlite3.register_converter(
   "timestamp", lambda v: datetime.fromisoformat(v.decode())
)


def init_app(app):
   # tells Flask to call that function when cleaning up after returning the response.
   app.teardown_appcontext(close_db)

   # adds a new command that can be called with the flask command.
   app.cli.add_command(init_db_command)

   # Bring an existing database up to date with the schema on every start
   if os.path.exists(app.config['DATABASE']):
      with app.app_context():
         upgrade_db()