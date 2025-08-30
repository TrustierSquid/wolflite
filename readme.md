# wolflite

- Wolflite is a smaller version of wolf, made with python/flask
- Just a simple blog site for experiments

- Simple flask python backend setup with React Frontend setup (no css framework preprocessor)

## Features

- Simple blog posts
- User creation


# Getting Started

- When getting started with development, you want to make sure you create a virtual dev environment. This is important because you want to the projects dependencies isolated from the rest of your machine.

- Inside the /server directory
```
$ python -m venv .venv

```

- For Linux users using Debian based distributions sometimes the venv python module is shipped in a seperate package. So you will have to install it first.
```
$ sudo apt install python3-venv

```

## installing Wolflite dependencies

- The repository already has a 'requirements.txt'. Install all dependancies using
```
$ pip install -r requirements.txt

```

- In case you add a new dependency, your local virtual environment only knows this. To make sure that the list of dependancies get updated so that other developers have the dependencies, run:
```
$ pip freeze > requirements.txt

```

## Database Instances

- To setup a database development instance
```
$ flask --app wolfr init-db

```

- This will give you an instance of a relational database you can use for development/testing. When you run the 'init-db' command it creates the instance of the database with the saved tables that you have inside of the SQL schema.


### Modifying the schema

- If you want to modify the schema, be sure to first delete the wolfr.sqilte file that is created when you first initialize an instance. That way, when you run the 'init-db' command again, you can have your updated schema ready for use.


## To run the development server
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