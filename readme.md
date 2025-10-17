# Wolflite Documentation

Wolflite is a social blogging platform where users can create posts and polls, interact through likes and comments, and manage their profiles with custom profile pictures. The app features a dynamic feed, user profiles, and real-time updates for community engagement. Upcoming features include communities, allowing users to join groups, share content, and participate in discussions within focused interest areas.

## Tech Stack
- **Frontend:** React + Vite
- **Backend:** Flask (Python)
- **Database:** SQLite3
- **Deployment:** Docker Compose

## Current Features

#### User Management
- User account creation and authentication
- Custom profile pictures
- User profile management and settings

#### Content Creation
- **Post Creation** - Blog-style posts with text and media
- **Poll Creation** - Interactive polls with multiple options
- **Media Support** - Image and video uploads

#### Social Interaction
- **Likes** - Like posts and polls
- **Comments** - Comment on posts and polls
- **Dynamic Feed** - Real-time content updates
- **User Profiles** - View other users' profiles and content

#### Poll System
- Create polls with custom options
- Vote tracking with visual progress bars
- Percentage calculations and vote counts
- Poll closing functionality (manual/timer-based)

### Upcoming Features
- **Communities** - Interest-based groups
- **Group Discussions** - Focused conversations
- **Enhanced Content Sharing** within communities

### Prerequisites
- Python 3.11+
- Node.js 20.19+ or 22.12+
- Git


# Getting started for developers

- When getting started with development, you want to make sure you create a virtual dev environment. This is important because you want to the projects dependencies isolated from the rest of your machine.
<br>
- For Linux users using Debian based distributions sometimes the venv python module is shipped in a seperate package. So you will have to install it first.
```
$ sudo apt install python3-venv
```

#### Inside the /server directory
```
$ python -m venv .venv
```

#### Activate Virtual Environment

For Linux/Mac
```
$ source .venv/bin/activate
```

For Windows Users
```
.venv\Scripts\activate
```


#### Install Backend Dependencies
```
$ pip install -r requirements.txt
```

In case you add a new dependency, your local virtual environment only knows this. To make sure that the list of dependancies get updated so that other developers have the dependencies, run:
```
$ pip freeze > requirements.txt
```

#### Database Instances

To setup a database development instance (make sure you are inside the /server directory)
```
$ flask --app wolfr init-db
```

This will give you an instance of a relational database you can use for development/testing. When you run the 'init-db' command it creates the instance of the database with the saved tables that you have inside of the SQL schema.

#### Run Development Server (from /server)
```
$ flask --app wolfr run --debug
```


### Modifying the schema

If you want to modify the schema, be sure to first delete the wolfr.sqilte file that is created when you first initialize an instance. That way, when you run the 'init-db' command again, you can have your updated schema ready for use.


## Setting up the Client side

Make sure you have Node.js 20.19+ or 22.12+ as the client-side development bundled with Vite.

Install vite inside the /client/wolflite directory (if you haven't already, using npm)
```
$ npm install vite --save-dev
```

#### Navigate to Client Directory
```
$ cd client/wolflite
```

#### Install Frontend Dependencies
```
$ npm install
```

#### Run Development Server
```
$ npm run dev
```

- With both servers running, the development server is proxying api endpoints to the server over your own local network to send back information to your client.


## Production Deployment

### Docker Setup
Build and Run:
```
$ docker-compose up -d --build
```

Delete and tear down container and image:
```
$ docker-compose down --rmi all
```

#### Environment Setup
Create .env file in project root:
```
DB_KEY="your-secret-key"
```
### Access Application

- Application: "http://localhost:8000"

#### Development vs Production
- **Development:** Flask debug server + Vite dev server
- **Production:** Gunicorn + static files served by Flask


### Contributing (for new devs)
- Fork the repository
- Create a feature branch
- Make your changes
- Test thoroughly
- Submit a pull request