FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# psycopg[binary] bundles libpq, so no system packages needed.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

RUN chmod +x docker/entrypoint.sh

EXPOSE 8000

CMD ["docker/entrypoint.sh"]
