FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
  sqlite3 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p instance static/uploads

ENV FLASK_APP=wolfr
ENV FLASK_ENV=production

# Default images are copied into static/uploads by the app on startup (see wolfr/__init__.py)
RUN echo '#!/bin/bash\n\
if [ ! -f /app/instance/wolfr.sqlite ]; then\n\
  flask --app wolfr init-db\n\
fi\n\
gunicorn --bind 0.0.0.0:8000 --workers 4 --timeout 900 "wolfr:create_app()"' > start.sh
# --timeout 900: big uploads (videos up to MAX_UPLOAD_MB) can take minutes to arrive;
# gunicorn's default (30 s) would kill the worker halfway through the upload.


RUN chmod +x start.sh

EXPOSE 8000

CMD ["./start.sh"]
