# CampusBite — Implementation TODO

Phase-by-phase checklist based on [PLAN.md](PLAN.md). Each phase also has a detailed design document in [doc/](doc/README.md). Each phase ends with a **Done when** check that must pass before moving on.
**What's left is summarised in [REMAINING_WORK.md](REMAINING_WORK.md).**
Notation: `[ ]` pending · `[x]` done · decision refs (D2, D14, …) point to PLAN.md §2.

---

## P0 — Project Setup & Infrastructure

**Repository**
- [ ] `git init`, create GitHub repo (public), `main` branch
- [x] Root `.gitignore` (`.env`, `node_modules/`, `__pycache__/`, `venv/`, `dist/`, `*.pyc`, `.DS_Store`, `pgdata/`) *(added in P10)*
- [x] Folder layout: `backend/`, root `README.md` stub, `PLAN.md`, `TODO.md` (`frontend/` is created by Vite in P7)

**Backend skeleton**
- [x] `backend/requirements.txt` (runtime, pinned) + `requirements-dev.txt` (adds pytest, httpx, freezegun; not installed in the Docker image)
- [x] `app/core/config.py` — `Settings` (pydantic-settings) for every env var in PLAN §12
- [x] `app/db/base.py` (DeclarativeBase) + `app/db/session.py` (engine, SessionLocal, `get_db`)
- [x] `app/main.py` — app factory, CORS from `CORS_ORIGINS`, `/api/v1` router mount, lifespan hook (empty for now)
- [x] `GET /api/v1/health` — returns status + DB ping (`SELECT 1`); 503 if the DB is unreachable
- [x] `app/core/logging.py` — log format and level from `LOG_LEVEL`

**Middleware**
- [x] `app/middleware/request_logging.py`:
  - [x] generate or propagate `X-Request-ID`
  - [x] log `method path status duration_ms request_id`
  - [x] add `X-Process-Time` header
  - [x] catch unhandled exceptions → log stack trace → return a clean 500 JSON response
- [x] Never log request bodies or the `Authorization` header

**Alembic**
- [x] `alembic.ini`, `alembic/env.py` wired to `Settings.DATABASE_URL` + `Base.metadata`, `script.py.mako`, empty `versions/`

**Docker**
- [x] `backend/Dockerfile` (python:3.12-slim, non-root user, `EXPOSE 8000`)
- [x] `backend/.dockerignore` (`.env`, `venv`, `__pycache__`, `tests`, `.git`)
- [x] `backend/scripts/entrypoint.sh` — wait for DB (`scripts/wait_for_db.py`) → `alembic upgrade head` → seed if `SEED_DEMO_DATA=true` and `seed.py` exists → `uvicorn`
- [x] Root `docker-compose.yml` — `db` (postgres:16-alpine, healthcheck, volume) + `backend` (`depends_on: service_healthy`, port 8000, `env_file`, healthcheck)
- [x] Root `.env.example` and `backend/.env.example` (placeholders only)

**Tests**
- [x] `tests/test_health.py` — health 200, request-ID and timing headers, incoming request ID propagated, unhandled error → clean 500 (4 passing)

**Done when:** `docker compose up --build` → `curl localhost:8000/api/v1/health` returns `{"status":"ok","db":"ok"}` and request logs appear in the container output.
- [x] Verified locally without Docker (SQLite): migrations, server start, `/health`, headers, CORS preflight, `/docs`, request logs
- [x] Verified with `docker compose up --build` (10 Nov 2026, Docker Desktop 29.2, `postgres:16-alpine`): wait for DB → migration → seed → API; `/health` → `{"status":"ok","db":"ok"}`; request logs in the container output

---

## P1 — Database Models, Auth & RBAC

**Models (`app/models/`)**, with enums, FKs, constraints and indexes from PLAN §4
- [x] `User` — role enum, unique email, `vehicle_type`, `vehicle_number`, `default_address`, `is_active`
- [x] `Restaurant` — `owner_id` UNIQUE FK (D3)
- [x] `MenuItem` — price CHECK > 0, `is_available`, `is_deleted` (D12)
- [x] `Order` — status enum, payment_status enum (`pending` / `mock_paid` / `refunded`), `delivery_partner_id`, `status_updated_at`, `cancellable_until`, `cancelled_at`, composite indexes
- [x] `OrderItem` — name and price snapshot, quantity CHECK 1–20
- [x] `OrderStatusHistory`
- [x] `Review` — `order_id` UNIQUE, rating CHECK 1–5
- [x] `PaymentLedger` — `entry_type` (charge/refund), `status`, `method`, `transaction_ref`, `note`
- [x] `ReturnRequest` — `order_id` UNIQUE, status enum, `reason`, `owner_note`, `resolved_by`
- [x] `AdminReminderLog` — `order_status_at_reminder`, `is_resolved`
- [x] SQLAlchemy `relationship()`s both ways
- [x] Generate and review the first Alembic migration, then `alembic upgrade head`

**Security (`app/core/security.py`)**
- [x] `hash_password` / `verify_password` using `bcrypt` directly
- [x] `create_access_token(sub, role)` / `decode_token` (PyJWT, HS256, `exp`)

**Dependencies (`app/api/deps.py`)**
- [x] `get_current_user` — decode the JWT → load the user from the DB → 401 if missing, inactive or invalid
- [x] `require_roles(*roles)` → 403 on role mismatch

**Schemas**
- [x] `schemas/common.py` — generic `Page[T]` (`items`, `total`, `page`, `page_size`, `pages`) + `PaginationParams` dependency (max 50)
- [x] `schemas/auth.py` — `CustomerRegister`, `OwnerRegister` (with nested `restaurant`), `DeliveryPartnerRegister` (with vehicle fields), `LoginRequest`, `TokenResponse`, `UserOut`

**Auth routes (`api/v1/auth.py`)** (D2)
- [x] `POST /auth/register` → role is always `customer`; any `role` field in the body is ignored
- [x] `POST /auth/register/restaurant-owner` → user + restaurant in one transaction
- [x] `POST /auth/register/delivery-partner`
- [x] `POST /auth/login` → `{access_token, token_type, user}`
- [x] `GET /auth/me`
- [x] Duplicate email → 409, weak password → 422

**Tests**
- [x] `tests/conftest.py` — test DB, session override, client, factory helpers, `auth_headers(user)` fixture
- [x] `test_auth.py` — each register endpoint sets the correct role, an injected role is ignored, duplicate email, login success and failure, invalid or expired token → 401, password stored hashed

- [x] `tests/test_models.py`: constraints, relationships, and the migration matches the models (upgrade + downgrade)

**Done when:** all three roles can register and log in through Swagger (`/docs`), and the auth tests are green.
- [x] Verified: 41 tests passing; live server run (3 signups, login, `/auth/me`, 409, 401); migration rendered as PostgreSQL SQL offline
- [x] Migration `0001` applied on a real PostgreSQL 16 (Docker Compose, 10 Nov 2026). The full browser suite then passed against it (160/160, no 5xx in the logs)

---

## P2 — Restaurant Catalog & Menu Management

**Public browse (`api/v1/restaurants.py`)**
- [x] `GET /restaurants?search=&cuisine=&page=&page_size=` — includes `avg_rating` and `review_count`
- [x] `GET /restaurants/{id}`
- [x] `GET /restaurants/{id}/menu?search=&min_price=&max_price=&category=&veg=&sort=` — only available, non-deleted items; `ILIKE` name search; price range; sort `price_asc`, `price_desc` or `name`
- [x] `GET /menu-items/{id}`
- [x] `GET /restaurants/{id}/reviews?page=`
- [x] `GET /restaurants/{id}/categories` (added: feeds the category filter in P8)

**Owner restaurant and menu (`api/v1/owner.py`, `require_roles(owner)`)**
- [x] `GET` / `PUT /owner/restaurant`
- [x] `GET /owner/menu-items?search=&available=&page=` — includes unavailable items
- [x] `POST /owner/menu-items`
- [x] `PUT /owner/menu-items/{id}` — ownership check → 404 if not the caller's
- [x] `PATCH /owner/menu-items/{id}/availability`
- [x] `DELETE /owner/menu-items/{id}` — soft delete

**Tests**
- [x] Search and price filter return the correct items
- [x] Unavailable or deleted items are hidden from the public menu
- [x] Owner A cannot edit owner B's dish (404)
- [x] Customer or delivery partner on `/owner/*` → 403

**Done when:** an owner can fully manage their menu through Swagger, and the public menu search and filters work.
- [x] Verified: 90 tests passing (49 new); live server run of the owner flow + public search, filters, sorts and role checks

---

## P3 — Orders Core: Checkout, State Machine, Assignment, Delivery

**State machine (`services/order_state.py`)**
- [x] `TRANSITIONS` table (PLACED→CANCELLED is customer-only; owners cannot cancel, D6)
- [x] `validate_transition(order, target, actor)` → raises 409 with a clear message
- [x] Free-window rule (D14): block `PLACED→ACCEPTED` while `now <= cancellable_until`
- [x] `apply_transition()` — `SELECT … FOR UPDATE`, set status, `status_updated_at`, write `OrderStatusHistory`, resolve open reminders

**Payment service (`services/payment_service.py`)**
- [x] `mock_charge(order)` → ledger `charge/success/MOCK-<uuid>`, payment_status = `mock_paid`
- [x] `mock_refund(order, note)` → ledger `refund/success/MOCK-REFUND-<uuid>`, payment_status = `refunded`

**Customer orders (`api/v1/orders.py`, `require_roles(customer)`)**
- [x] `POST /orders` (single transaction):
  - [x] all items belong to `restaurant_id`, are available and not deleted; the restaurant is open
  - [x] compute subtotal, `DELIVERY_FEE` and total from **DB prices** (client prices ignored)
  - [x] create the order (PLACED) and items (snapshots) → `mock_charge` → set `cancellable_until = created_at + CANCEL_GRACE_SECONDS`
  - [x] 201 response includes `cancellable_until` and `cancel_window_remaining_seconds`
- [x] `GET /orders/me?status=&date_from=&date_to=&page=`
- [x] `GET /orders/{id}` — scoped access: customer owns the order, owner owns the restaurant, or the delivery partner is assigned; otherwise 404. Includes items, timeline, payment, return and review info, and the remaining cancel seconds.
- [x] `POST /orders/{id}/cancel` (no body):
  - [x] not PLACED → 409
  - [x] `now <= cancellable_until` → CANCELLED + `mock_refund(note="free_cancellation_window")` (D14)
  - [x] after the window → CANCELLED, no refund, payment unchanged (D5)
  - [x] set `cancelled_at`; respond with `{status, payment_status, refunded_amount}`

**Owner order management (`api/v1/owner.py`)**
- [x] `GET /owner/orders?status=&date_from=&date_to=&page=` — includes the `in_cancel_window` flag and remaining seconds
- [x] `PATCH /owner/orders/{id}/status` — only ACCEPTED, PREPARING or READY; anything else → 409
- [x] `GET /owner/delivery-partners` — active partners with their active-delivery count
- [x] `POST /owner/orders/{id}/assign` — order must be READY and the target user must be an active delivery partner → set `delivery_partner_id` → ASSIGNED

**Delivery partner (`api/v1/delivery.py`, `require_roles(delivery_partner)`)**
- [x] `GET /delivery/orders?status=&page=` — only `delivery_partner_id = me`, statuses ASSIGNED and OUT_FOR_DELIVERY
- [x] `GET /delivery/orders/{id}` — customer name, phone, address and items; 404 if not assigned to the caller
- [x] `PATCH /delivery/orders/{id}/status` — OUT_FOR_DELIVERY or DELIVERED only, through the state machine
- [x] `GET /delivery/history?date_from=&date_to=&page=` — DELIVERED orders

**Tests (`test_order_lifecycle.py`, `test_rbac.py`)**
- [x] Full happy path PLACED → … → DELIVERED across three users
- [x] Every invalid transition → 409 (PLACED→READY, DELIVERED→CANCELLED, owner→CANCELLED, assign when not READY, …)
- [x] D14 with `freezegun`: cancel at 30s refunds; cancel at 61s doesn't; owner Accept at 30s → 409, at 61s → OK; cancel after Accept → 409; a double cancel creates only one refund entry
- [x] A tampered client price is ignored; an unavailable item → 400; items from mixed restaurants → 400
- [x] Cross-tenant: customer A reading B's order, owner A updating B's order, delivery partner reading an unassigned order → all 404

**Done when:** the full order lifecycle, including the free cancellation window, works through Swagger for all three roles, and the lifecycle and RBAC tests are green.
- [x] Verified: 154 tests passing; live end-to-end run of the lifecycle and the cancel window

---

## P4 — Reviews, Returns & Refunds

**Reviews**
- [x] `POST /orders/{id}/review` `{rating, comment}` — DELIVERED only; one per order (409); caller must own the order
- [x] Restaurant `avg_rating` reflects new reviews

**Returns (`services/return_service.py`)**
- [x] `POST /orders/{id}/return` `{reason}` — DELIVERED only; reason 10–500 characters required; a duplicate → 409 (UNIQUE constraint as a backstop, `IntegrityError` → 409)
- [x] `GET /owner/returns?status=&page=` — only the caller's restaurant
- [x] `POST /owner/returns/{id}/approve` → return `approved`, `mock_refund(note="return_approved")`, order → REFUNDED, `resolved_at` and `resolved_by` set
- [x] `POST /owner/returns/{id}/reject` `{owner_note}` → return `rejected`; the order and payment are unchanged
- [x] Acting on an already-resolved return → 409

**Tests (`test_returns.py`)**
- [x] Return on a non-delivered order → 409; missing reason → 422; second request → 409
- [x] Approve → ledger has charge + refund entries, payment `refunded`, order REFUNDED
- [x] Reject → status `rejected`, no refund entry
- [x] Review rules (not delivered → 409, duplicate → 409, rating out of range → 422)

**Done when:** a delivered order can be reviewed and returned, and the owner can approve or reject with the correct ledger entries.
- [x] Verified: 186 tests passing; live run of review → return → approve (refund recorded)

---

## P5 — Owner Stats & Reminder Background Task

**Stats (`services/stats_service.py`)**
- [x] `GET /owner/stats?date_from=&date_to=` returns:
  - [x] order totals: total orders, orders today, count by status
  - [x] revenue: gross revenue (excluding cancelled), refunds total, net revenue, average order value
  - [x] ratings: average rating and review count
  - [x] top 5 dishes by quantity
  - [x] counts of pending returns and open reminders
- [x] Use SQL aggregates (`func.count`, `func.sum`, `group_by`), not Python loops

**Reminders (`services/reminder_service.py`, `workers/reminder_worker.py`)**
- [x] `scan()`:
  - [x] select orders in PLACED or ACCEPTED with `status_updated_at < now - REMINDER_THRESHOLD_MINUTES`, skipping orders still in the cancel window
  - [x] insert an `AdminReminderLog` unless an unresolved one already exists for the same `(order_id, status)`
- [x] asyncio loop started in the `lifespan`, running every `REMINDER_CHECK_INTERVAL_SECONDS` via `run_in_threadpool` and cancelled cleanly on shutdown
- [x] Resolve open reminders when the order's status changes (already hooked into `apply_transition`)
- [x] `GET /owner/reminders?resolved=false&page=` + schedule an on-demand `scan()` via FastAPI `BackgroundTasks`
- [x] `PATCH /owner/reminders/{id}/acknowledge`

**Tests (`test_reminders.py`)**
- [x] Stale PLACED or ACCEPTED order → one reminder; a rescan creates no duplicate
- [x] A status change resolves the reminder
- [x] A PREPARING order gets no reminder
- [x] Owner sees only their own restaurant's reminders

**Done when:** stale orders generate reminders automatically within about a minute, and the stats endpoint returns correct numbers for the seed data.
- [x] Verified: 202 tests passing; live run of the background worker creating and resolving reminders

---

## P6 — AI Order Insights

**Service (`services/ai_service.py`)**
- [x] `build_context(customer_id)`:
  - [x] load the latest 50 orders with items and restaurant names (filtered by `customer_id`)
  - [x] pre-compute aggregates: spend this week, this month and all-time (net of refunds); count by status; undelivered orders; top 5 items; last 5 orders in detail
- [x] System prompt: answer only from the provided data, today's date, INR, decline unrelated questions, never invent orders
- [x] OpenAI call: `OPENAI_MODEL`, `temperature=0.3`, `max_tokens≈500`, `timeout=20s`
- [x] Retry `RateLimitError`, `APITimeoutError` and `APIConnectionError` twice with exponential backoff → then 503
- [x] In-memory per-user sliding-window limiter (`AI_RATE_LIMIT_PER_MINUTE`) → 429 + `Retry-After`
- [x] Missing `OPENAI_API_KEY` → 503 "AI insights are not configured"
- [x] No orders → friendly message without calling OpenAI
- [x] Never log the API key or the full prompt

**Route (`api/v1/ai.py`)**
- [x] `POST /ai/insights` `{question?: str (max 500)}` → `{answer, generated_at, orders_considered}`; customer only; `customer_id` comes **only** from the JWT

**Tests (`test_ai.py`, OpenAI mocked)**
- [x] Context contains only the caller's order IDs (isolation)
- [x] Rate limit exceeded → 429
- [x] OpenAI error → 503; missing key → 503
- [x] Non-customer role → 403

**Done when:** all four example questions from the PRD return sensible answers using seed data and a real key, and the tests pass with OpenAI mocked.
- [x] Verified: 219 tests passing; live run with the real SDK against a local OpenAI-compatible stub (answer, 429 retry → 503, rate limit)

---

## P7 — Frontend Foundation

**Setup**
- [x] `npm create vite@latest frontend -- --template react`
- [x] Install `react-router-dom`, `axios`; Tailwind CSS setup
- [x] `frontend/.env.example` → `VITE_API_BASE_URL=http://localhost:8000/api/v1`
- [x] `src/utils/` — `constants.js` (roles, statuses, status labels and colours), `formatCurrency` (₹), `formatDate`

**API layer (`src/api/`)**
- [x] `client.js` — axios instance; request interceptor adds `Bearer` token; response interceptor clears auth on 401 and redirects to `/login`; normalise `detail` error messages
- [x] Modules: `auth.js`, `restaurants.js`, `orders.js`, `owner.js`, `delivery.js`, `ai.js`

**State**
- [x] `AuthContext` — `user`, `token`, `login`, `logout`, the three register functions, `hasRole`; initialise from localStorage; validate with `/auth/me` on load
- [x] `CartContext` — add, update or remove items, clear, subtotal, count; persisted to localStorage; single-restaurant rule with a "clear cart?" prompt (D4)
- [x] Hooks: `useAuth`, `useCart`, `useApi` (`data`, `loading`, `error`, `refetch`), `usePagination`, `useDebounce`

**Routing and layout**
- [x] `App.jsx` route table (PLAN §11.2)
- [x] `ProtectedRoute` (logged in) + `RoleRoute` (role check → `/unauthorized`)
- [x] `Layout` + role-aware responsive `Navbar` (hamburger menu on mobile) + `Footer` with "Partner with us" and "Ride with us" links
- [x] Common components: `Loader`, `ErrorMessage` (with retry), `EmptyState`, `Pagination`, `Modal`, `ConfirmDialog`, `StatusBadge`, `RatingStars`, `StatusFilter`, `DateRangeFilter`, toast notifications

**Auth pages**
- [x] `LoginPage` (shared) → redirect by role after login
- [x] `CustomerRegisterPage` (`/register`)
- [x] `PartnerRegisterPage` (`/partner/register`) — owner and restaurant fields
- [x] `DeliveryRegisterPage` (`/delivery/register`) — personal and vehicle fields
- [x] Client-side form validation + display of server errors
- [x] `NotFoundPage`, `UnauthorizedPage`

**Done when:** a user of each role can register and log in, lands on the correct (placeholder) dashboard, cannot open other roles' routes, and refreshing the page keeps them logged in.
- [x] Verified: production build OK; 19 Vitest tests (cart, role routing, login flow, API errors)

---

## P8 — Customer UI

- [x] `RestaurantListPage` (`/`) — `RestaurantCard` grid, debounced search, cuisine filter, pagination, loading, empty and error states
- [x] `RestaurantMenuPage` (`/restaurants/:id`) — header with rating, `DishFilters` (search, min and max price, veg, sort), `DishCard` with add-to-cart and a quantity stepper, reviews section
- [x] `CartPage` (`/cart`) — update quantities, remove items, subtotal, delivery fee, total, empty state
- [x] `CheckoutPage` (`/checkout`):
  - [x] address (prefilled from profile), phone and notes
  - [x] dummy card form (never sent to the backend)
  - [x] Place order → clear the cart → redirect to `/orders/:id`
- [x] `CancelCountdown` component (D14):
  - [x] start from `cancel_window_remaining_seconds`; `setInterval` in `useEffect` with cleanup
  - [x] "Cancel for free · 0:SS" → one-click cancel → show "₹X refunded (demo)"
  - [x] at 0 → switch to "Cancel (no refund)" behind a `ConfirmDialog` (shown only while PLACED), then refetch
- [x] `OrderDetailPage` (`/orders/:id`):
  - [x] items table, totals, `OrderTimeline`, payment and return badges, refund info
  - [x] `CancelCountdown`
  - [x] `ReviewForm` (DELIVERED, no review yet) and `ReturnForm` (DELIVERED, no return yet, reason required)
- [x] `CustomerDashboardPage` (`/customer/dashboard`):
  - [x] current and past order tabs; status and date-range filters; pagination
  - [x] `OrderCard` with status, payment and return badges and quick actions (cancel, review, return)
- [x] `AIInsightsPage` (`/customer/ai-insights`):
  - [x] suggested question chips (the four PRD examples) + free-text input (max 500 characters)
  - [x] chat-style answer panel; loading indicator; friendly messages for 429 and 503

**Done when:** a customer can browse, filter, add to cart, check out, see the countdown, cancel with a refund inside 60s, track the order, review and return after delivery, and use AI insights — on both desktop and mobile widths.
- [x] Verified: build OK; 27 Vitest tests; backend scope filter (220 backend tests)

---

## P9 — Owner & Delivery Partner UI

**Owner**
- [x] `OwnerDashboardPage` (`/owner/dashboard`):
  - [x] `StatsCards` and a top-dishes list
  - [x] `ReminderList` banner with "Acknowledge" buttons (polls every 60s)
  - [x] recent orders
- [x] `MenuManagementPage` (`/owner/menu`):
  - [x] table on desktop, cards on mobile; search; availability filter
  - [x] `MenuItemForm` modal for add and edit; availability toggle; delete with confirmation
- [x] `OrderManagementPage` (`/owner/orders`):
  - [x] status and date filters; pagination
  - [x] next-step action buttons: Accept → Start Preparing → Mark Ready → Assign
  - [x] Accept disabled with "Awaiting customer confirmation · 0:SS" during the cancel window (D14)
  - [x] `AssignPartnerModal` listing partners and their current load
- [x] `ReturnRequestsPage` (`/owner/returns`) — status filter; order summary and reason; Approve; Reject with a required note

**Delivery partner**
- [x] `DeliveryDashboardPage` (`/delivery/dashboard`):
  - [x] assigned orders with a status filter
  - [x] customer name, phone (`tel:` link) and address
  - [x] "Out for Delivery" and "Delivered" buttons with confirmation
- [x] `DeliveryHistoryPage` (`/delivery/history`) — delivered orders, date filter, pagination

**Done when:** a full lifecycle can be driven end to end in three browser sessions (customer, owner, delivery partner) using only the UI.
- [x] Verified: 36 Vitest tests; live end-to-end UI test (9 steps, all 3 roles) against a running backend

---

## P10 — Seed Data, Polish, Docs & Submission

**Seed (`backend/scripts/seed.py`, idempotent)**
- [x] 3 owners + restaurants (Campus Curry House, Byte Pizza, Green Bowl), 8–12 dishes each (some unavailable)
- [x] 2 delivery partners and 2 customers
- [x] Historical orders covering **every** status:
  - [x] DELIVERED with a review
  - [x] a pending return
  - [x] a REFUNDED order (approved return)
  - [x] a CANCELLED order with a free-window refund, plus one cancelled after the window
  - [x] stale PLACED and ACCEPTED orders → 2 reminders created at seed time
  - [x] ASSIGNED, OUT_FOR_DELIVERY, READY and PREPARING orders
  - [x] orders spread over this week and earlier
- [x] `tests/test_seed.py`: valid, idempotent, demo logins work, consistent with the state machine

**Quality pass**
- [x] Every page has loading, error (with retry) and empty states; buttons are disabled while requests run
- [x] Full backend suite green: `cd backend && pytest` (223; tests are not in the Docker image, so they run locally)
- [x] Frontend: 36 Vitest tests + the live end-to-end UI suite (9 steps, all three roles)
- [x] Login page shows the demo accounts; the fake key in the tests was renamed so secret scans stay clean
- [x] Visual responsive QA in a real browser (Chromium): 390 px (touch) and 1280–1366 px, M-01 to M-06 in the UI test plan. 768 px was not checked separately

**Documentation — `README.md`**
- [x] Overview, tech stack, features by role (including the free cancellation window)
- [x] Architecture diagram + folder structure
- [x] Run the backend: `cp .env.example .env` → `docker compose up --build` → `/docs`
- [x] Run the frontend: `cd frontend && cp .env.example .env && npm install && npm run dev`
- [x] Environment variables table
- [x] Database setup: automatic migrations, seeding, reset, manual Alembic commands
- [x] API documentation: Swagger/ReDoc + the full endpoint table
- [x] Order lifecycle + business rules (D5, D6, D14); demo accounts; running tests; security notes; known limitations
- [x] Screenshots: 15 in `doc/screenshots/` (retaken 10 Nov 2026 with restaurant photos; script in `doc/ui-test-run/scripts/screenshots.mjs`)

**UI test run (9–10 Nov 2026)**
- [x] Full manual UI test plan (138 cases) plus 37 edge cases, automated with Playwright: [doc/UI_TEST_REPORT.md](doc/UI_TEST_REPORT.md)
- [x] 8 bugs found and fixed (3 Medium, 5 Low) with regression tests: backend 228 tests, frontend 58 tests
- [x] Re-run after the fixes: 175/175 on SQLite; 160/160 on Docker Compose + PostgreSQL (sections that restart the backend were covered by the SQLite run)

**Security and submission**
- [x] Root `.gitignore` (`.env*` except `.env.example`, venv, node_modules, dist, `*.db`, caches)
- [x] Secret scan: no keys, passwords or secrets in the code (only `.env.example` placeholders)
- [ ] `git init`, first commit, and confirm `git ls-files | grep .env` shows only `.env.example` files *(you, skipped on request)*
- [x] Run `docker compose up --build` once on a machine with Docker *(done 10 Nov 2026; `POSTGRES_PORT=5433` in `.env` on this machine because a local PostgreSQL uses 5432)*
- [ ] Try the AI page with a real `OPENAI_API_KEY` *(you; everything else about AI was verified with a local stand-in: request flow, rate limit, "not configured", privacy)*
- [ ] Fresh clone → follow the README → the app works end to end *(you)*
- [ ] Push to GitHub, make the repository **public**, check it from a logged-out browser, submit the URL *(you)*

**Done when:** a fresh clone runs by following only the README, there are no secrets in the repository, and the public URL is submitted.

---

## Progress Tracker

| Phase | Status |
|---|---|
| P0 Setup & Infrastructure | 🟡 Code complete; Docker run pending (.gitignore added in P10; git init skipped on request) |
| P1 Models, Auth & RBAC | 🟡 Code complete; live PostgreSQL run pending (needs Docker) |
| P2 Catalog & Menu | ✅ Done |
| P3 Orders Core | ✅ Done |
| P4 Reviews & Returns | ✅ Done |
| P5 Stats & Reminders | ✅ Done |
| P6 AI Insights | ✅ Done |
| P7 Frontend Foundation | ✅ Done |
| P8 Customer UI | ✅ Done |
| P9 Owner & Partner UI | ✅ Done |
| P10 Seed, Polish, Docs & Submit | 🟡 Built; your steps left: Docker run, git push, real OpenAI key, submit |
