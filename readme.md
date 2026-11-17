# Wolflite Documentation

Wolflite is a social blogging platform where users can create posts and polls, interact through likes and comments, and manage their profiles with custom profile pictures. The app features a combined feed of posts and polls and user profiles for community engagement. Upcoming features include communities, allowing users to join groups, share content, and participate in discussions within focused interest areas.

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
- **Feed** - Posts and polls from every user, newest first
- **User Profiles** - View other users' profiles and content

#### Poll System
- Create polls with custom options
- Vote tracking with visual progress bars
- Percentage calculations and vote counts
- Manually closing a poll

### Upcoming Features
- **Communities** - Interest-based groups
- **Group Discussions** - Focused conversations
- **Enhanced Content Sharing** within communities


# Getting started for developers

### Prerequisites
- Python 3.11+
- Node.js 20.19+ or 22.12+
- Git

Development runs two servers side by side:

| Server | Folder | URL | Purpose |
| --- | --- | --- | --- |
| Flask | `server/` | http://localhost:5000 | API, database, uploaded files |
| Vite | `client/wolflite/` | http://localhost:5173 | React pages with hot reload |

**Open the app at http://localhost:5173.** Vite forwards API calls and `/static/...` files to Flask (see `vite.config.js`), so the browser only talks to one address and login cookies work.

Commands are shown for **Windows (PowerShell)** and **Linux/Mac (bash)**. If a step has only one block, it is the same on both.


## 1. Environment variables

From the project root, copy the example file:

Windows (PowerShell)
```powershell
Copy-Item .env.example .env
```

Linux/Mac
```bash
cp .env.example .env
```

Then open `.env` and set `DB_KEY` to a random secret. Flask uses it to sign session cookies, and **login will fail without it**. Generate one with:
```
python -c "import secrets; print(secrets.token_hex(32))"
```


## 2. Backend (Flask)

All of these commands run from the `server/` folder.

#### Create a virtual environment
A virtual environment keeps the project's Python packages isolated from the rest of your machine. You only create it once.

Windows (PowerShell)
```powershell
cd server
py -3.11 -m venv .venv      # or: python -m venv .venv
```

Linux/Mac
```bash
cd server
python3 -m venv .venv
```

> On Debian/Ubuntu the venv module is sometimes a separate package: `sudo apt install python3-venv`

#### Activate it
You need to do this **every time you open a new terminal**. Your prompt shows `(.venv)` when it is active.

Windows (PowerShell)
```powershell
.venv\Scripts\Activate.ps1
```

Windows (Command Prompt / cmd)
```bat
.venv\Scripts\activate.bat
```

Windows (Git Bash)
```bash
source .venv/Scripts/activate
```

Linux/Mac
```bash
source .venv/bin/activate
```

> **Not sure it's active?** Custom prompt themes (oh-my-posh, starship, ...) often hide `(.venv)`. Check which Python you're using; it should point inside `server/.venv`:
> ```powershell
> (Get-Command python).Source     # Windows PowerShell
> ```
> ```bash
> which python                    # Linux/Mac/Git Bash
> ```
> If `pip install` prints paths outside `.venv` (e.g. `...\LocalCache\local-packages\Python311\...`), the venv is not active and packages are going into your global Python.

> **Windows: "running scripts is disabled on this system"?** PowerShell blocks scripts by default. Allow local scripts for your user once, then activate again:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```

#### Install dependencies
```
pip install -r requirements.txt
```

#### Create the development database
```
flask --app wolfr init-db
```
This creates `server/instance/wolfr.sqlite` with the tables from `wolfr/schema.sql`.

> **Warning:** `init-db` drops every table and recreates it, so all local data is deleted. That is also how you apply changes to `schema.sql`: edit the schema, then run `init-db` again.

#### Run the dev server
```
flask --app wolfr run --debug
```
Leave this terminal open. Flask runs on http://localhost:5000.

#### Adding a new Python dependency
After `pip install <package>`, update `requirements.txt` so other developers get it too.

Linux/Mac, Git Bash, or cmd
```bash
pip freeze > requirements.txt
```

Windows (PowerShell)
```powershell
pip freeze | Out-File -Encoding utf8 requirements.txt
```
> In Windows PowerShell 5.1, `>` writes the file as UTF-16, which shows up as a garbled diff in git. Use the `Out-File` form above.


## 3. Frontend (React + Vite)

Open a **second terminal** from the project root:

```
cd client/wolflite
npm install
npm run dev
```

`npm install` installs Vite and everything else listed in `package.json`; you only need to run it again when dependencies change.

Open **http://localhost:5173** and create a user. Keep both terminals running while you develop.


## Running tests

Backend (from `server/`, with the virtual environment active):
```
pip install pytest
pytest
```

Frontend (from `client/wolflite/`):
```
npm test            # Jest tests
npm run typecheck   # TypeScript type checking (tsc)
npm run lint        # ESLint
```
> `npm run build` and `npm run dev` don't type check (Vite only strips the types), so run `typecheck` before committing.


## Production Deployment

In production, Flask (through Gunicorn) serves both the API and the built React pages on a single port.

#### 1. Build the frontend
The Docker image does not build the frontend itself yet, so build it first. The output goes to `server/static/dist`:
```
cd client/wolflite
npm run build
```

#### 2. Set up `.env`
Same file as in development (see step 1 above). Docker Compose reads `DB_KEY`, plus `TUNNEL_TOKEN` for the Cloudflare tunnel.

#### 3. Build and run
From the project root (with [Docker Desktop](https://www.docker.com/products/docker-desktop/) running on Windows/Mac):
```
docker compose up -d --build
```

Tear down the containers and delete the image:
```
docker compose down --rmi all
```

The app is available at http://localhost:8000.

> Older Docker installs use `docker-compose` (with a hyphen) instead of `docker compose`.

#### Development vs Production
- **Development:** Flask debug server + Vite dev server
- **Production:** Gunicorn + static files served by Flask


### Contributing (for new devs)
- Fork the repository
- Create a feature branch
- Make your changes
- Test thoroughly
- Submit a pull request
- Delete previous branch
