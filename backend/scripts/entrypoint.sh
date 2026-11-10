#!/bin/sh
set -e

echo "==> Waiting for database..."
python scripts/wait_for_db.py

echo "==> Applying database migrations..."
alembic upgrade head

if [ "${SEED_DEMO_DATA}" = "true" ] && [ -f scripts/seed.py ]; then
  echo "==> Seeding demo data..."
  python -m scripts.seed
fi

echo "==> Starting CampusBite API on port 8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers
