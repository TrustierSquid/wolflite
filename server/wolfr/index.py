import os
from flask import Flask, request
from werkzeug.security import generate_password_hash, check_password_hash


def create_app(test_config=None):
   app = Flask(__name__)

   app.config.from_mapping(
        SECRET_KEY='dev',
        DATABASE=os.path.join(app.instance_path, 'wolfr.sqlite'),
   )

   if test_config is None:
        # load the instance config, if it exists, when not testing
        app.config.from_pyfile('config.py', silent=True)
   else:
      # load the test config if passed in
      app.config.from_mapping(test_config)

   # ensure the instance folder exists
   try:
      os.makedirs(app.instance_path)
   except OSError:
      pass

   @app.route('/')
   def init():
      return "OK", 200

   @app.route('/formSubmission', methods=(['POST']))
   def formSubmission():
      username = request.form['username']
      password = request.form['password']
      pw_hash = generate_password_hash(password)

      print(f"Received username: {username}")
      print(f"Generated hash: {pw_hash}")

      return "Received", 200


   from . import db
   db.init_app(app)

   return app