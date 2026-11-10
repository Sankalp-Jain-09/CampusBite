#!/bin/bash
HERE="$(cd "$(dirname "$0")" && pwd)"
# Reseed the UI-test database in place (the backend keeps running).
cd "/home/sankalp/concept understanding/practice/practice/backend"
export DATABASE_URL=sqlite:///$HERE/uitest.db JWT_SECRET_KEY=x
.venv/bin/alembic downgrade base >/dev/null 2>&1; .venv/bin/alembic upgrade head 2>/dev/null >/dev/null && .venv/bin/python -m scripts.seed
: > $HERE/ai_requests.jsonl
