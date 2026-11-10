# CampusBite — Project Context

Full-stack restaurant ordering and delivery app (capstone). Three roles: **customer**, **restaurant_owner**, **delivery_partner**.
Requirements are in `prd.txt`, the design in `PLAN.md`, the checklist in `TODO.md`, and one design document per phase in `doc/P*.md`.
**Update this file after every phase.**

## Stack
- **Backend:** FastAPI, Pydantic v2, SQLAlchemy 2.0 (sync, ORM), Alembic, PyJWT, bcrypt, OpenAI SDK. Python 3.12 in Docker.
- **DB:** PostgreSQL 16 (docker-compose); tests use in-memory SQLite.
- **Frontend:** React (Vite), React Router, Axios, Tailwind, Context + hooks (P7+).
- **Infra:** `backend/Dockerfile`, root `docker-compose.yml` (db + backend), `.env.example` files.

## Repo layout
```
backend/app/
  main.py                 app factory, middleware, lifespan, routers
  core/config.py          Settings (env vars) · core/security.py (bcrypt, JWT) · core/logging.py
  db/base.py (Base + naming convention) · db/session.py (engine, get_db) · db/types.py (UTCDateTime, utcnow)
  models/                 10 ORM models + enums.py (enum_column) + mixins.py
  schemas/                Pydantic schemas; common.py = Page[T], PaginationParams, paginate(); types.py = shared field types
  services/               business logic (routers stay thin)
  api/deps.py             get_current_user, require_roles, CurrentCustomer/CurrentOwner/CurrentDeliveryPartner, DbSession
  api/v1/                 routers: health, auth, restaurants (public), orders (customer + shared detail), owner, delivery
  services/order_state.py TRANSITIONS + validate/apply_transition (every status change goes through it)
  services/order_service.py checkout, scoped reads (_scope_condition), lock_order_for (FOR UPDATE), to_summary/to_detail
  middleware/request_logging.py
backend/alembic/versions/ migrations (0001_initial_schema)
backend/tests/            conftest.py (SQLite StaticPool, get_db override), factories.py, test_*.py
frontend/src/
  api/                    axios client (JWT, 401 → logout, normalizeError) + one module per backend area
  context/                AuthContext, CartContext (per-user key, one restaurant), ToastContext
  hooks/                  useApi, useAuth, useCart, useToast, usePagination, useDebounce, useInterval, useCountdown
  components/             common/ (Button, Modal, Badges, FormField, ...), layout/, routing/ (RoleRoute, GuestOnly), auth/
  pages/                  auth/, customer/, owner/, delivery/, OrderDetailPage
  utils/                  constants (labels, colours, homePathFor, canAccessPath), format, storage, validation
  test/                   Vitest + Testing Library (renderWithProviders)
doc/                      per-phase design and as-built notes
```

## Commands (this machine: Linux, project at `~/concept understanding/practice/practice`, quote the path)
```bash
# Backend (local venv, Python 3.10)
cd backend && .venv/bin/python -m pytest -q -p no:cacheprovider          # run tests (228)
DATABASE_URL=sqlite:///campusbite.db JWT_SECRET_KEY=dev .venv/bin/alembic upgrade head && DATABASE_URL=sqlite:///campusbite.db JWT_SECRET_KEY=dev .venv/bin/python -m scripts.seed
DATABASE_URL=sqlite:///campusbite.db JWT_SECRET_KEY=dev .venv/bin/uvicorn app.main:app --port 8000
DATABASE_URL=postgresql+psycopg://u:p@localhost/x JWT_SECRET_KEY=x .venv/bin/alembic upgrade head --sql   # Postgres DDL offline

# Frontend (Node 20 via nvm; new shells have it, non-interactive shells need: . ~/.nvm/nvm.sh)
cd frontend && npm run build && npx vitest run     # build + 58 tests
npm run dev                                       # http://localhost:5173

# Docker Compose (backend + PostgreSQL 16)
systemctl --user start docker-desktop             # Docker Desktop is the CLI context (desktop-linux)
docker compose up --build -d                      # migrate + seed + API on :8000; db published on :5433
docker compose down -v && docker compose up -d    # fresh demo data
```
- `.env` has `POSTGRES_PORT=5433`, because a local PostgreSQL already listens on 5432. The local SQLite uvicorn and Docker both use :8000, so run one at a time.
- Browser UI suite (Playwright, 175 cases): `doc/ui-test-run/scripts/` (`node main.mjs`; `EXTERNAL_BACKEND=1 PG_CONTAINER=campusbite-db` to test the running Docker stack). Results are in `doc/UI_TEST_REPORT.md`. README screenshots: `screenshots.mjs` (the app's font is Inter; give Chromium Inter via `FONTCONFIG_FILE`, or it falls back to DejaVu).

**Environment notes:**
- Local Python is 3.10 and the Docker image uses 3.12. Keep the existing style anyway: `Optional[...]` / `List[...]`, never `X | None` in runtime annotations.
- Remove `__pycache__` after test runs to keep the tree tidy (they are git-ignored).

## Conventions
- **Routers are thin; logic lives in `services/`.** Services raise `HTTPException` with clear `detail` messages.
- **Auth:** `get_current_user` always reloads the user from the DB (the role comes from the DB, not the token). Use `CurrentCustomer` / `CurrentOwner` / `CurrentDeliveryPartner`; role routers also set `dependencies=[Depends(owner_required)]` (same shared callable, so it runs once).
- **Ownership:** another user's resource → **404** (never reveal that it exists). Wrong role → 403. No token → 401.
- **Status codes:** 400 bad business input, 401, 403, 404, 409 conflict or invalid state transition, 422 validation, 429, 503.
- **Lists:** `Page[T]` via `paginate(db, stmt, params, scalars=True|False)`; always add `id` as a sort tie-breaker.
- **Money:** `Decimal` in the DB (`Numeric(10,2)`); responses use `Money` (serialised as a JSON number); requests use `PriceIn`.
- **Datetimes:** `UTCDateTime` columns + `utcnow()`; always timezone-aware UTC.
- **Enums:** `enum_column(Enum)` stores values as VARCHAR (portable).
- **Partial updates:** Optional fields + `model_dump(exclude_unset=True)`; a validator rejects `null` for required fields; write schemas use `extra="forbid"` (register schemas use `extra="ignore"` so an injected `role` is dropped).
- **Search:** `like_pattern()` + `ilike(..., escape=LIKE_ESCAPE)` (escapes user `%` and `_`).
- **Orders:** change status only via `order_state.transition()` (writes history, resolves reminders), after `lock_order_for()`; commit once in the service. Serialise with `order_service.to_summary/to_detail`.
- **Background work:** never reuse the request session; use `get_session_factory()` (tests override it). The reminder worker is off in tests (`REMINDER_WORKER_ENABLED=false`).
- **AI:** tests replace `ai_service._create_completion` and `_sleep`, and reset `ai_service.rate_limiter`. For a live check without a key, point `OPENAI_BASE_URL` at a local stub.
- **Payments:** `payment_service.mock_charge` / `mock_refund(note=...)` (refund is idempotency-guarded).
- **Checkout price guard:** the client sends `expected_subtotal`; the server returns 409 if DB prices differ. `CheckoutPage` refreshes cart prices (`GET /menu-items/{id}`, `cart.syncPrices`) on load and after a 409.
- **Tests:** `shop` fixture (conftest) + `tests/order_helpers.py` (`place`, `end_cancel_window`, `advance_to_ready`, `assign`, `deliver`, ...). freezegun for time. `BCRYPT_ROUNDS=4` in tests. Factories in `tests/factories.py` (`make_user`, `make_owner_with_restaurant`, `make_menu_item`, `make_order`, `make_review`, `auth_headers`). Each test gets a fresh schema.
- **Migrations:** after model changes, run `alembic revision --autogenerate`, tidy the file, and keep `tests/test_models.py::test_migration_upgrade_matches_models_and_downgrades` green.

## Confirmed business decisions
- **D2** Separate signups: `/auth/register` (customer), `/auth/register/restaurant-owner` (+ restaurant), `/auth/register/delivery-partner` (+ vehicle); one shared login. Accounts are active immediately.
- **D3** One restaurant per owner (`restaurants.owner_id` UNIQUE).
- **D4** The cart lives on the client, one restaurant at a time; the server recomputes prices at checkout.
- **D5** After delivery, refunds only via a return request (with a reason) approved by the owner. Cancelling after the free window → no refund, payment stays `mock_paid`, the order is excluded from revenue.
- **D6** Owners cannot reject or cancel orders; their only action on PLACED is Accept. Owners approve or reject returns.
- **D12** Dishes are soft-deleted; order items store name and price snapshots.
- **D14** 60s free cancel window (`CANCEL_GRACE_SECONDS`): a customer cancel inside it → CANCELLED + automatic full refund (ledger note `free_cancellation_window`), no reason asked, no owner involvement. The owner can't Accept during the window (409). The API exposes `cancel_window_remaining_seconds`.
- Only DELIVERED orders can be reviewed. A return rejection requires an owner note. A return can't be withdrawn. Login to an inactive account → 403.

## Order state machine
PLACED → ACCEPTED (owner, after the window) → PREPARING → READY (owner) → ASSIGNED (owner via assign) → OUT_FOR_DELIVERY → DELIVERED (assigned partner) → REFUNDED (owner approves return). PLACED → CANCELLED (customer only). Everything else → 409.

## Phase status
| Phase | Status | Notes |
|---|---|---|
| P0 Setup | ✅ | `docker compose up --build` verified 10 Nov 2026 (Docker Desktop 29.2); `.gitignore` added in P10; `git init` still skipped on request |
| P1 Models/Auth | ✅ | migration 0001 applied on PostgreSQL 16 (Docker); browser suite 160/160 against it |
| P2 Catalog/Menu | ✅ | public browse + owner menu CRUD, 90 tests |
| P3 Orders core | ✅ | checkout + dummy payment, state machine, cancel window, assign, delivery; 154 tests |
| P4 Reviews/Returns | ✅ | review after delivery; return → owner approve (refund + REFUNDED) / reject (note); 186 tests |
| P5 Stats/Reminders | ✅ | /owner/stats (SQL aggregates + one raw text() query); reminder worker (lifespan) + BackgroundTasks; 202 tests |
| P6 AI insights | ✅ | POST /ai/insights; context = caller's orders only + precomputed totals; retry/backoff, per-user rate limit; 219 tests |
| P7 Frontend foundation | ✅ | Vite/React/Router/Axios/Tailwind; auth + cart + toast contexts; guards; auth pages; 19 Vitest tests |
| P8 Customer UI | ✅ | browse/menu (URL filters)/cart/checkout/countdown/dashboard (scope tabs)/order detail/AI; 27 Vitest tests |
| P9 Owner/Partner UI | ✅ | owner dashboard/menu/orders/returns, rider dashboard/history; 36 unit tests + live E2E UI test (LIVE_API=1) |
| P10 Seed/Polish/Docs | 🟡 | seed, README, screenshots (retaken 10 Nov), UI test run + 8 bug fixes, Docker verified; user steps left: real OpenAI key, git init/push/submit |

## Frontend conventions
- Tailwind with the component classes in `src/index.css` (`btn-primary`, `input`, `card`, `badge`, ...); brand colour = `brand-*` (orange).
- Data fetching: `useApi(() => api.call(params), [deps])` → `{data, loading, error, refetch}`; every view shows Loader / ErrorMessage (with retry) / EmptyState.
- Errors from the API are `{status, message, fieldErrors, retryAfter}`; show `message` in toasts or banners and `fieldErrors[field]` under inputs.
- Forms: `FormField` wraps an input (adds id, label, error). Validators are in `utils/validation.js`.
- Live E2E UI test: start the backend on :8000 (fresh DB, `CANCEL_GRACE_SECONDS=2`, optional OpenAI stub), then `LIVE_API=1 npx vitest run src/test/live`.
- Auth state follows other tabs (`storage` event in AuthContext); use a private window to test two roles side by side.
- Session: only a 401/403 from `/auth/me` logs the user out (network errors/5xx keep the session). `logoutReason` ('expired' | 'manual') drives the "session expired" banner; `GuestOnly` sends a fresh login back to `location.state.from` (not after a manual logout).
- Stored carts go through `sanitizeCart()`; `ErrorBoundary` (main.jsx) catches render errors. Menu filters keep local state in `DishFilters` (URL updates render late under `v7_startTransition`).
- UI test report: `doc/UI_TEST_REPORT.md` (8 bugs found and fixed).
- Mobile first: tables become cards below `md`; tap targets ≥ 40px (`.btn`).

## Demo data
`python -m scripts.seed` (idempotent; Docker runs it when `SEED_DEMO_DATA=true`). Password `Demo@1234` for demo.customer@, demo.customer2@,
owner.curry@, owner.pizza@, owner.green@, rider.one@, rider.two@ campusbite.dev. Every order status is represented, plus 2 reminders and 1 pending return. All 30 dishes (`DISH_IMAGES`) and 3 restaurants (`RESTAURANT_IMAGES`) have Wikimedia photos; re-running the seed backfills missing ones. Show dish photos with `components/common/DishImage` (falls back to a letter).

## Current totals
Backend 228 pytest · frontend 58 Vitest + 9-step live E2E · Playwright UI suite (175 cases, `doc/ui-test-run/`) · 40 API endpoints · 10 tables · 1 migration (0001).
