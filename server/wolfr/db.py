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
]

# (table, column, definition)
ADDED_COLUMNS = []


def upgrade_db():
   db = get_db()

   # Only upgrade databases that were initialised (init-db creates everything itself)
   if not db.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'user'").fetchone():
      return

   for statement in ADDED_TABLES:
      db.execute(statement)

   for table, column, definition in ADDED_COLUMNS:
      existing = {row["name"] for row in db.execute(f"PRAGMA table_info({table})")}
      # A table missing entirely means the db was never initialised; init-db handles that
      if existing and column not in existing:
         try:
            db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
         except sqlite3.OperationalError as error:
            # Another gunicorn worker added it at the same moment
            if "duplicate column" not in str(error):
               raise
   db.commit()


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