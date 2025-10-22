FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
  sqlite3 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p instance static/uploads

COPY static/uploads/defaultUser.jpg /app/static/uploads/defaultUser.jpg
COPY static/uploads/wolfLogo.png /app/static/uploads/wolfLogo.png

ENV FLASK_APP=wolfr
ENV FLASK_ENV=production

RUN echo '#!/bin/bash\n\
if [ ! -f /app/instance/wolfr.sqlite ]; then\n\
  flask --app wolfr init-db\n\
fi\n\
# Copy defaults if they don'\''t exist in mounted volume\n\
if [ ! -f /app/static/uploads/defaultUser.jpg ]; then\n\
  cp /app/defaults/defaultUser.jpg /app/static/uploads/\n\
fi\n\
if [ ! -f /app/static/uploads/wolfLogo.png ]; then\n\
  cp /app/defaults/wolfLogo.png /app/static/uploads/\n\
fi\n\
gunicorn --bind 0.0.0.0:8000 --workers 4 "wolfr:create_app()"' > start.sh


RUN chmod +x start.sh

EXPOSE 8000

CMD ["./start.sh"]
