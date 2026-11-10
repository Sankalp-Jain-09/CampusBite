# P10 — Seed Data, Polish, Docs & Submission

**Status:** 🟡 Built and verified, including Docker Compose + PostgreSQL (10 Nov 2026) and a full UI test run (8 bugs found and fixed). The remaining steps need your account: a real OpenAI key, git push, submission
**Depends on:** P0–P9 · **Unblocks:** submission

## Goal

Make the project demo-ready and easy to evaluate: realistic seed data, a final quality pass, a complete README, a check that no secrets are in the repository, a verified fresh-clone run, and the public GitHub submission.

## 1. Seed data (`backend/scripts/seed.py`)

Run automatically by `entrypoint.sh` when `SEED_DEMO_DATA=true`. **Idempotent**: it skips seeding if `demo.customer@campusbite.dev` already exists.

| Entity | Data |
|---|---|
| Owners + restaurants | 3: **Campus Curry House** (North Indian), **Byte Pizza** (Italian), **Green Bowl** (Healthy). 8–12 dishes each across categories, realistic ₹ prices, veg and non-veg mix, 1–2 unavailable per restaurant |
| Delivery partners | 2 (scooter, bicycle) |
| Customers | 2 |
| Historical orders (customer 1) | DELIVERED with a review · DELIVERED with a pending return · REFUNDED (approved return) · CANCELLED within the free window (refund entry) · CANCELLED after the window (no refund) · OUT_FOR_DELIVERY · READY · stale PLACED (more than 20 minutes old, window over) and stale ACCEPTED → these trigger reminders · several orders this week and earlier so "spend this week" and "most frequent items" are meaningful |
| Ledger and history | Matching charge and refund entries and full status history rows for every seeded order |

Demo credentials (shared password e.g. `Demo@1234`), documented in the README as **local demo data only**:
`demo.customer@…`, `demo.customer2@…`, `owner.curry@…`, `owner.pizza@…`, `owner.green@…`, `rider.one@…`, `rider.two@…`

## 2. Quality pass

**Functional**
- [x] Run the P8 and P9 manual scripts end to end on the Docker backend *(superseded by the full UI test plan: 160/160 on Docker + PostgreSQL, [UI_TEST_REPORT.md](UI_TEST_REPORT.md))*
- [x] Every PRD bullet works (use the checklist in section 4) *(the plan's PRD coverage table, all passing)*

**UI**
- [ ] Every page checked at 375px, 768px and 1280px: no horizontal scroll, tap targets ≥ 40px, tables become cards on mobile *(partly: 390 px and 1280–1366 px checked on 12 pages with no sideways scroll, and tables become cards. 768 px was not checked separately, and two controls are under 40 px: report OBS-1)*
- [x] Every data view has loading, error (with retry) and empty states *(U-01 to U-03)*
- [x] Buttons are disabled while requests are in flight; no double submits *(U-04: 4 rapid Pay clicks → 1 order)*
- [x] Consistent status colours and labels; currency and dates formatted everywhere *(seen on every page in the UI run and the screenshots)*

**Backend**
- [x] Full test suite green: `cd backend && pytest` (local venv; tests are not in the Docker image, see P0) *(228 passed)*
- [ ] Swagger: every endpoint has a summary, tags, response models and example bodies
- [x] Consistent error messages and status codes (400, 401, 403, 404, 409, 422, 429, 503) *(37 edge cases in the UI test report)*
- [x] No `print`, no debug routes, `LOG_LEVEL=INFO` by default

**Frontend**
- [x] `npm run build` succeeds with no errors; remove unused files and console logs *(no `console.log`; `ErrorBoundary` keeps one `console.error` on purpose)*
- [x] (Optional) Vitest: `CartContext`, `RoleRoute` *(58 tests in total)*

## 3. README.md (final)

1. **Project overview** + screenshots (one per role dashboard, AI page, mobile view)
2. **Technologies used** (frontend, backend, DB, AI, DevOps)
3. **Features implemented**: a checklist by role, plus business rules (order lifecycle diagram, D5, D6, D14)
4. **Architecture** diagram + folder structure
5. **Run the backend with Docker Compose**: `cp .env.example .env` → edit secrets → `docker compose up --build` → `http://localhost:8000/docs`
6. **Run the frontend locally**: `cd frontend && cp .env.example .env && npm install && npm run dev` → `http://localhost:5173`
7. **Environment variables** table (name, purpose, example, required?), for the root and frontend `.env.example` files
8. **Database setup**: PostgreSQL in compose; migrations applied automatically on start; seeding with `SEED_DEMO_DATA`; reset with `docker compose down -v`; manual `docker compose exec backend alembic upgrade head` / `alembic revision --autogenerate`
9. **API documentation**: Swagger `/docs`, ReDoc `/redoc`, and the endpoint summary table (method, path, role, description)
10. **Demo accounts** (local seed only)
11. **Running tests**
12. **Security notes**: bcrypt, JWT, backend RBAC and ownership checks, secrets only in env, AI data isolation
13. **Known limitations**: in-memory AI rate limiter and single-replica reminder worker; no real payments

## 4. PRD compliance checklist (tick before submitting)

- [x] Customer: register/login · browse · menu · search and filter by name and price · cart add/update/remove · dummy payment checkout · history · tracking · cancel when allowed · review after delivery · return with reason · AI insights
- [x] Owner: login · add/view/update dishes · availability · incoming orders · accept + preparation statuses · assign partner · filter by status and date · stats · approve/reject returns · reminders
- [x] Delivery partner: login · only assigned orders · customer details · Out for Delivery · Delivered · history
- [x] bcrypt · JWT · 3 roles · frontend route protection · backend RBAC · token in localStorage
- [x] Lifecycle statuses + CANCELLED and REFUNDED · invalid transitions rejected by the backend
- [x] `mock_paid` · payment ledger · refund record · one return per order
- [x] Three dashboards with filters · pagination
- [x] AI: summary + questions · only the caller's data · key in the env · error and rate-limit handling *(verified with a local OpenAI stand-in; a real key is still to be tried)*
- [x] Middleware: logs method and path + response time · background reminders for orders older than 15 minutes in PLACED or ACCEPTED
- [x] React: hooks, Router, Context, Axios, loading and errors, responsive
- [x] Tables: users, restaurants, menu_items, orders, order_items, reviews, payment_ledger, admin_reminder_logs (+ return_requests, order_status_history)
- [x] Dockerfile · docker-compose.yml · `.env.example` · runs with compose · no secrets in the image
- [x] README with all the required sections

## 5. Security and submission

- [x] Root `.gitignore` exists and covers `.env`, `venv/`, `node_modules/`, `__pycache__/`, `dist/`, `*.db`, `.DS_Store`
- [ ] `git ls-files | grep -i '\.env'` → only `.env.example` files
- [ ] `git grep -nI -e "sk-" -e "OPENAI_API_KEY=." -e "JWT_SECRET_KEY=." -- ':!*.example'` → no results
- [ ] Check git history for accidentally committed secrets (`git log -p | grep -i "sk-"`); if any are found, rotate the key and rewrite the history
- [ ] **Fresh-clone test:** clone into a new folder → follow only the README → backend and frontend run, the seed logins work, and AI works with a key
- [ ] Push to GitHub; make the repository **Public**; open it in a logged-out or incognito browser to confirm access
- [ ] Submit the repository URL

## Done when
A fresh clone runs by following only the README, every item in the PRD checklist is ticked, there are no secrets in the repository or its history, and the public repository URL is submitted.

## Implementation notes (as built)

**Seed (`backend/scripts/seed.py`)**
- Creates 7 users (2 customers, 2 riders, 3 owners), 3 restaurants, 30 dishes (5 unavailable), 17 orders and 5 reviews.
- Return requests: 1 pending (Byte Pizza) and 1 approved.
- Reminders: 2, created at seed time by running `reminder_service.scan`.
- **Every order status** is represented. Each seeded order has consistent status history, charge and refund ledger entries, and timestamps spread over the last 35 days.
- **Idempotent:** it skips if `demo.customer@campusbite.dev` exists. It runs from the Docker entrypoint when `SEED_DEMO_DATA=true`, or manually with `python -m scripts.seed`.
- Demo accounts use the password `Demo@1234` and are listed in the README and on the login page.

**Polish**
- Root `.gitignore` added. You had skipped it in P0, but P10's security checklist requires it; `git init` itself is still left to you.
- The fake OpenAI key in the tests was renamed (`test-openai-key-not-real`), so `grep "sk-"` scans come back clean.
- The login page has a collapsible "Demo accounts" box.
- README rewritten in full, with the endpoint table taken from the app's OpenAPI schema.

**Final verification (all on this machine)**
| Check | Result |
|---|---|
| Backend `pytest` | **223 passed**, no warnings |
| Migration → PostgreSQL DDL (offline) | 10 tables + `alembic_version` |
| Frontend `vitest run` | **36 passed** (live suite skipped offline) |
| Frontend `npm run build` | OK (≈ 305 kB JS / 95 kB gzipped) |
| Live end-to-end UI test (real backend) | **9/9 steps passed** across all three roles |
| Seeded data via a live API | all 7 logins OK; dashboards, reminders, pending return, rider queues; the 4 PRD AI questions → 200 (local OpenAI stub) |
| Secret scan | clean |

**Remaining steps (need your account)**
1. ~~Docker Compose run~~: **done** 10 Nov 2026 (migration, seed and API on PostgreSQL 16; UI suite 160/160 against it).
2. Set a real `OPENAI_API_KEY` and ask the 4 PRD questions on the AI page.
3. ~~Phone-sized UI check and README screenshots~~: **done** (UI test plan section 8; 15 screenshots retaken 10 Nov 2026).
4. `git init` → first commit → check `git ls-files | grep .env` shows only `.env.example` files → push to a **public** GitHub repository → open it while logged out → submit the URL.

**Post-release addition: dish photos.**
- **Images:** all 30 demo dishes have a photo from Wikimedia Commons (free licences, direct linking allowed). They are stored in `DISH_IMAGES` in `scripts/seed.py`.
- **How they were chosen:** found through the Wikipedia/Commons APIs, checked by eye where the match was uncertain (a logo, live chickens and meat photos for veg dishes were replaced), with tracking parameters stripped. Every URL was confirmed to return an image.
- **Existing databases:** running the seed on an already-seeded database **backfills** the missing photos (`backfill_images`; restaurants get cover photos from `RESTAURANT_IMAGES` the same way). The Docker database gets them on the next `docker compose up` or with `python -m scripts.seed`.
- **Frontend:** a new `DishImage` component (photo, or a lettered placeholder if a link breaks), shown in the owner's Menu table and mobile cards, as a live preview in the add/edit form, and larger on the customer dish cards.
- **Tests:** backend 224 (seed images + backfill), frontend 39 (DishImage fallback).

**Post-release: UI test run, bug fixes, Docker verification (9–10 Nov 2026).**
- **UI test run:** the full manual UI test plan (138 cases) plus 37 edge cases, automated with Playwright. 8 bugs found (3 Medium, 5 Low), all fixed with regression tests, then 175/175. Details: [UI_TEST_REPORT.md](UI_TEST_REPORT.md).
- **Main fixes:**
  - a reload during a backend outage no longer logs users out
  - checkout refreshes cart prices, and the server refuses a stale total with 409 (`expected_subtotal`)
  - login returns to the page that required it
  - a "session expired" banner
  - sanitised stored carts and a top-level error boundary
  - `Retry-After` exposed through CORS
- **Docker:** `docker compose up --build` verified on Docker Desktop 29.2 with `postgres:16-alpine`. On this machine `POSTGRES_PORT=5433`, because a local PostgreSQL uses 5432.
- **Screenshots:** all 15 retaken (restaurant photos; script `doc/ui-test-run/scripts/screenshots.mjs`).
- **Tests now:** backend 228, frontend 58.
