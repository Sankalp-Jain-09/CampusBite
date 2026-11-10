# P0 — Setup & Infrastructure

**Status:** 🟡 Code complete and verified locally; the Docker Compose run is still pending because Docker is not installed on the development machine.
**Depends on:** nothing · **Unblocks:** every other phase

## Goal

A runnable FastAPI backend skeleton, containerised with Docker, connected to PostgreSQL, with request-logging middleware, a health check and an Alembic migration setup. No business features yet.

## Scope

| In scope | Out of scope (skipped on request or deferred) |
|---|---|
| Backend folder structure, settings, DB session | `git init`, GitHub repo, root `.gitignore` (skipped on request) |
| Logging + request middleware | `frontend/` folder (created by Vite in P7) |
| `/api/v1/health` with DB ping | Database models (P1) |
| Alembic wiring | Seed script (P10) |
| Dockerfile, compose, entrypoint, `.env.example` files | |

## What was built

### Folder structure
```
backend/
├── Dockerfile, .dockerignore, alembic.ini
├── requirements.txt, requirements-dev.txt, .env.example
├── alembic/            env.py, script.py.mako, versions/
├── scripts/            entrypoint.sh, wait_for_db.py
├── app/
│   ├── main.py
│   ├── core/           config.py, logging.py
│   ├── db/             base.py, session.py
│   ├── api/v1/         __init__.py (api_router), health.py
│   ├── middleware/     request_logging.py
│   └── models/ schemas/ services/ workers/   (empty packages, filled in later phases)
└── tests/              conftest.py, test_health.py
docker-compose.yml, .env.example, README.md    (repo root)
```

### Key components

| File | Purpose |
|---|---|
| `app/core/config.py` | `Settings` (pydantic-settings) with every env var. `DATABASE_URL` and `JWT_SECRET_KEY` are required (no defaults). `cors_origins_list` parses the comma-separated `CORS_ORIGINS`. |
| `app/core/logging.py` | Root logger format `time \| level \| logger \| message`; silences uvicorn's duplicate access log. |
| `app/db/session.py` | SQLAlchemy engine (`pool_pre_ping`), `SessionLocal`, `get_db()` dependency, `ping_database()` (`text("SELECT 1")`). SQLite gets `check_same_thread=False` for local and test use. |
| `app/middleware/request_logging.py` | Generates or propagates `X-Request-ID`, adds `X-Process-Time` (ms), logs `METHOD path status duration request_id`, turns unhandled exceptions into `{"detail":"Internal server error","request_id":...}` with a 500 status. Never logs bodies or auth headers. |
| `app/main.py` | `create_app()`: lifespan hook (the reminder worker goes here in P5), middleware order (CORS outermost so even 500s carry CORS headers), `/api/v1` router, `/` info route. |
| `app/api/v1/health.py` | `GET /api/v1/health` → 200 `{"status":"ok","db":"ok"}` or 503 `{"status":"degraded","db":"error"}`. |
| `alembic/env.py` | Reads the URL from `settings.DATABASE_URL` (not stored in `alembic.ini`), targets `Base.metadata`, imports `app.models`, `compare_type=True`, batch mode on SQLite. |
| `scripts/wait_for_db.py` | Retries `SELECT 1` every 2s for up to `DB_WAIT_TIMEOUT` (60s). |
| `scripts/entrypoint.sh` | wait for DB → `alembic upgrade head` → `python -m scripts.seed` if `SEED_DEMO_DATA=true` and the file exists → `uvicorn`. |
| `Dockerfile` | `python:3.12-slim`, dependency layer cached, non-root `appuser`, `EXPOSE 8000`. |
| `.dockerignore` | Excludes `.env*` (keeps `.env.example`), venv, caches, `tests/`, `requirements-dev.txt`, `.git`. |
| `docker-compose.yml` | `db` (postgres:16-alpine, healthcheck, `pgdata` volume) + `backend` (`env_file: .env`, builds `DATABASE_URL` pointing at host `db`, `depends_on: service_healthy`, its own healthcheck). Ports can be overridden with `POSTGRES_PORT` / `BACKEND_PORT`. |

### Environment files
- **Root `.env.example`**: used by Docker Compose (variable substitution plus the backend `env_file`).
- **`backend/.env.example`**: for running uvicorn directly without Docker (DB on `localhost`).

Both contain placeholders only.

## Changes from the original plan

| Item | Change | Reason |
|---|---|---|
| `psycopg[binary]` | Pinned to 3.2.13 instead of 3.2.3 | 3.2.3 has no wheel for the local macOS Python |
| Test dependencies | Moved to `requirements-dev.txt`, not installed in the image | Keeps the runtime image small. Tests run locally, so the P10 step `docker compose exec backend pytest` must be adjusted. |
| `frontend/` | Not created yet | `npm create vite` expects an empty folder (P7) |

## How to run

```bash
# Docker (target)
cp .env.example .env            # edit POSTGRES_PASSWORD, JWT_SECRET_KEY
docker compose up --build
curl localhost:8000/api/v1/health

# Local without Docker
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

## Tests (`tests/test_health.py`) — 4 passing
- Health returns 200 with `{"status":"ok","db":"ok"}`
- `X-Request-ID` and `X-Process-Time` headers present
- An incoming `X-Request-ID` is propagated
- An unhandled exception returns a clean 500 with the request ID and no error details leaked

## Verification log
- [x] `pytest`: 4 passed
- [x] Local run with SQLite: `wait_for_db` OK, `alembic upgrade head` OK, uvicorn starts, `/api/v1/health` 200, headers present, CORS preflight allows `http://localhost:5173`, `/docs` 200, request logs written, clean startup and shutdown
- [x] `postgresql+psycopg://` URL loads the psycopg driver
- [ ] `docker compose up --build` on a machine with Docker

## Done when
`docker compose up --build` → `curl localhost:8000/api/v1/health` returns `{"status":"ok","db":"ok"}` and request logs appear in the container output.

## Before the first commit
Create the root `.gitignore` (`.env`, `venv/`, `__pycache__/`, `node_modules/`, `dist/`, `*.db`, `.DS_Store`). Without it, a real `.env` could be committed.
