import click
from flask import current_app, g

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