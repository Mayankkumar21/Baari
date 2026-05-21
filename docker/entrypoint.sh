#!/bin/sh
set -e

echo "→ Applying database migrations…"
alembic upgrade head

echo "→ Baari is starting on http://localhost:8000"
echo "  (Sign up a new business, or sign in if you already created one.)"
exec uvicorn api.index:app --host 0.0.0.0 --port 8000
