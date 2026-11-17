# Wolflite image: builds the React frontend, then runs Flask with gunicorn.
# Build from the REPO ROOT (it needs both client/ and server/):
#   docker build -f server/Dockerfile -t wolflite .
# compose.yml and the GitHub Actions workflow already do this.

# ---------- 1. Frontend (Vite) ----------
FROM node:22-slim AS frontend

WORKDIR /src/client/wolflite

# Dependencies first, so they're cached until package*.json changes
COPY client/wolflite/package.json client/wolflite/package-lock.json ./
RUN npm ci

COPY client/wolflite/ ./
# vite.config.js writes the build to ../../server/static/dist = /src/server/static/dist
RUN npm run build


# ---------- 2. Backend (Flask + gunicorn) ----------
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
  sqlite3 \
  && rm -rf /var/lib/apt/lists/*

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ .
COPY --from=frontend /src/server/static/dist ./static/dist

RUN mkdir -p instance static/uploads

ENV FLASK_APP=wolfr
ENV FLASK_ENV=production

# Default images are copied into static/uploads by the app on startup (see wolfr/__init__.py).
# Existing databases are upgraded on startup too (upgrade_db in wolfr/db.py).
# --timeout 900: big uploads (videos up to MAX_UPLOAD_MB) can take minutes to arrive;
# gunicorn's default (30 s) would kill the worker halfway through the upload.
RUN printf '%s\n' \
  '#!/bin/sh' \
  'if [ ! -f /app/instance/wolfr.sqlite ]; then' \
  '  flask --app wolfr init-db' \
  'fi' \
  'exec gunicorn --bind 0.0.0.0:8000 --workers 4 --timeout 900 "wolfr:create_app()"' \
  > start.sh && chmod +x start.sh

EXPOSE 8000

CMD ["./start.sh"]
