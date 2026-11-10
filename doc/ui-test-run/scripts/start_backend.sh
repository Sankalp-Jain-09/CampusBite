#!/bin/bash
HERE="$(cd "$(dirname "$0")" && pwd)"
# usage: start_backend.sh [extra env assignments...]
cd "/home/sankalp/concept understanding/practice/practice/backend"
export DATABASE_URL=sqlite:///$HERE/uitest.db JWT_SECRET_KEY=uitest-secret CORS_ORIGINS=http://localhost:5173
export OPENAI_API_KEY=sk-stub OPENAI_BASE_URL=http://127.0.0.1:8099/v1
for kv in "$@"; do export "$kv"; done
exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
