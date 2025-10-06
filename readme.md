# Wolflite Docs

- Wolflite is an even more intuitive version of Wolf, made with python/flask
- Built from the ground up with Flask and React.

## Features

- Social posts, (polls, posts, videos)
- User creation and user authentication
- admin permissions and user analytics dashboards
- Den community system for communities to post about their favorite topics


# Getting Started for developers

- When getting started with development, you want to make sure you create a virtual dev environment. This is important because you want to the projects dependencies isolated from the rest of your machine.

- For Linux users using Debian based distributions sometimes the venv python module is shipped in a seperate package. So you will have to install it first.
```
$ sudo apt install python3-venv
```

- Inside the /server directory
```
$ python -m venv .venv
```

- Once you have the.venv file in your /server directory, you have to activate it to tap into the virutal environment.

- For Linux/Mac
```
$ source .venv/bin/activate
```

- For Windows Users
```
.venv\Scripts\activate
```

## Installing Wolflite dependencies

- The repository already has a 'requirements.txt'. Install all dependancies using
```
$ pip install -r requirements.txt
```

- In case you add a new dependency, your local virtual environment only knows this. To make sure that the list of dependancies get updated so that other developers have the dependencies, run:
```
$ pip freeze > requirements.txt
```

## Database Instances

- To setup a database development instance (make sure you are inside the /server directory)
```
$ flask --app wolfr init-db
```

- This will give you an instance of a relational database you can use for development/testing. When you run the 'init-db' command it creates the instance of the database with the saved tables that you have inside of the SQL schema.


### Modifying the schema

- If you want to modify the schema, be sure to first delete the wolfr.sqilte file that is created when you first initialize an instance. That way, when you run the 'init-db' command again, you can have your updated schema ready for use.


## To run the development server (make sure you are inside the /server directory)
```
$ flask --app wolfr run --debug
```

- This run command is running the server in debug mode. This just sends HTTP logs directly to the server so you can see in real time what requests were made to the server.


# Setting up the Client side

- Make sure you have Node.js 20.19+ or 22.12+ as the client-side development bundled with Vite.

- Install vite inside the /client/wolflite directory (if you haven't already, using npm)
```
$ npm install vite --save-dev
```

- Once there, to run the client-side development server
```
$ npm run dev
```

- With both servers running, the development server is proxying api endpoints to the server over your own local network to send back information to your client.
