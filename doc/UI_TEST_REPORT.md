# CampusBite: UI Test Report

**Date:** 9 Nov 2026 (PostgreSQL run: 10 Nov 2026) · **Tested:** the current working tree (not a git repository yet, so there is no commit hash) · **Plan:** [UI_TEST_PLAN.md](UI_TEST_PLAN.md) (138 cases) plus 37 extra edge cases

## 1. Summary

**Status: all 175 cases pass. The 8 bugs found in the first run are fixed and verified.** The suite also passes against the real Docker Compose stack with **PostgreSQL 16** (160/160; the sections that restart the backend ran on SQLite).

| | Cases | First run | After fixes |
|---|---|---|---|
| Manual UI test plan | 138 | 135 passed, 3 failed | **138 passed** |
| Extra edge cases (X-01 … X-37) | 37 | 33 passed, 4 failed | **37 passed** |
| **Total** | **175** | **168 / 175** | **175 / 175** |

All the main flows work end to end in a real browser:
- the three roles
- checkout and the dummy payment
- the 60-second free-cancel window
- the order state machine
- reviews, returns and refunds
- owner statistics and reminders
- the rider flow
- AI insights
- role protection
- the mobile layout

The backend held up against every abuse case tried, in both runs:
- illegal state changes and concurrent cancels
- double refunds
- forged tokens and mass assignment
- SQL and LIKE injection
- XSS
- other users' data

The first run found **8 bugs** (3 Medium, 5 Low). None of them was a data-integrity or security problem. All 8 are fixed (section 5), and nothing else changed behaviour (section 2).

**Still open:**
- two small tap targets (OBS-1)
- the checks this environment couldn't run: a real OpenAI key, Safari/Firefox, real phones (section 3)

## 2. Fixes and regression checks

| Bug | Severity | Fix | Files |
|---|---|---|---|
| BUG-01 | Medium | Only a 401 or 403 from `/auth/me` ends the session. Network errors and 5xx keep it | `frontend/src/context/AuthContext.jsx` |
| BUG-02 | Medium | The server refuses with **409** when the optional `expected_subtotal` doesn't match the database prices, before anything is written. The checkout page refreshes the cart's prices when it opens and after a 409, and lists what changed | `backend/app/schemas/order.py`, `backend/app/services/order_service.py`, `pages/customer/CheckoutPage.jsx`, `context/CartContext.jsx` (`syncPrices`), `api/restaurants.js` |
| BUG-03 | Medium | `GuestOnly` sends a fresh login to `location.state.from` when the role may open it. After a deliberate **Log out**, the next login starts from the role's home | `components/routing/GuestOnly.jsx`, `components/routing/ProtectedRoute.jsx`, `pages/auth/LoginPage.jsx` |
| BUG-04 | Low | AuthContext remembers `logoutReason` (`'expired'` or `'manual'`). The route guard keeps `?expired=1`, and the login page shows the banner | `AuthContext.jsx`, `ProtectedRoute.jsx`, `LoginPage.jsx` |
| BUG-05 | Low | `sanitizeCart()` checks stored carts: the wrong shape becomes an empty cart, bad lines are dropped, quantities are clamped to 1–20. A new top-level `ErrorBoundary` shows "Something went wrong · Reload page" instead of a white screen | `context/CartContext.jsx`, `components/common/ErrorBoundary.jsx`, `main.jsx` |
| BUG-06 | Low | CORS exposes `Retry-After`, so the message reads "try again in 58 seconds" | `backend/app/main.py` |
| BUG-07 | Low | Detail pages treat a 422 (non-numeric id in the URL) as "not found" | `pages/OrderDetailPage.jsx`, `pages/customer/RestaurantMenuPage.jsx` |
| BUG-08 | Low | `DishFilters` keeps local input state, so each change builds on the latest values. Changes from elsewhere are still followed, and Clear resets at once | `components/restaurant/DishFilters.jsx`, `pages/customer/RestaurantMenuPage.jsx` |

**Regression checks after the fixes:**

| Check | Before | After |
|---|---|---|
| Backend pytest | 224 passed | **228 passed** (+4: the price guard, the CORS header) |
| Frontend Vitest | 39 passed | **58 passed** (+19 in `test/bugfixes.test.jsx` and `test/customer.test.jsx`; each fails on the old code) |
| `npm run build` | clean | **clean** |
| Playwright suite, fresh database | 168 / 175 | **175 / 175** (177 checks: O-09 and O-02 each run in two parts) |
| Playwright suite on **Docker Compose + PostgreSQL 16** | — | **160 / 160** (sections 1–5 and all 37 edge cases; no 5xx and no tracebacks in 1,262 logged requests) |

**Compatibility:**
- Checkout API: `expected_subtotal` is optional, so clients that don't send it behave exactly as before.
- No database or model changes, and no new migration.

**A side effect caught during re-testing:** the first version of the BUG-03 fix also sent users back to their last page after a deliberate **Log out** and a new login (A-16 caught it). This was fixed with `logoutReason: 'manual'`, covered by a unit test, and confirmed by a second full run.

## 3. How the test was run

| Item | Value |
|---|---|
| Browser | Chromium 145 (Playwright 1.58, headless). Desktop 1366×900; mobile 390×844 with touch |
| Frontend | Vite dev server on http://localhost:5173 (Node 20.18) |
| Backend | FastAPI/uvicorn on :8000, Python 3.10, **SQLite** test database, freshly seeded before each run |
| Settings | `CANCEL_GRACE_SECONDS=60` (the real value). Reminder checks used the default 15 min, except B-02 (1 min, scan every 10 s) |
| AI | A **local OpenAI stub** (via `OPENAI_BASE_URL`). It answers from the exact order JSON the backend sends and logs every request, so privacy could be checked (X-26). No real OpenAI key was used |
| Method | Every plan step was automated with Playwright, following the plan's wording. Each role got its own browser context, the equivalent of a private window. Failures were re-checked by hand-written probes before being called bugs |

**PostgreSQL run (10 Nov 2026):**
- **Setup:** `docker compose up --build` (Docker Desktop 29.2, `postgres:16-alpine`) on a fresh volume, with the AI pointed at the same stand-in through a test-only compose override (`scripts/compose.test-override.yml`). The project files were not changed for it.
- **Scope:** sections 1–5 and all edge cases ran against it: **160/160**. Section 6 (mobile, UX states, backend restarts) needs to stop and restart the backend with different settings, so it ran on SQLite only. Its checks don't depend on the database.
- **Postgres-sensitive checks that passed:**
  - five simultaneous cancels give exactly one refund (row lock, X-10)
  - case-insensitive search with `%`/`_` escaped (X-19)
  - the raw SQL stats query (O-05, E-09)
  - date filters (C-24)
  - email case (X-18)
  - the reminder worker
- **Log:** [ui-test-run/run_docker_postgres.log](ui-test-run/run_docker_postgres.log).

**Not covered here:** a real OpenAI model, Safari/Firefox and real phones, screen readers.

Timing-based cases used real time:
- the cancel countdown
- the "Awaiting customer" countdown
- the 15 s status polling
- toasts disappearing after about 5 s
- the reminder worker

### Re-running

The scripts are in [ui-test-run/scripts/](ui-test-run/scripts/). Full output: [before the fixes](ui-test-run/run_before_fixes.log) and [after the fixes](ui-test-run/run_after_fixes.log).

1. Start the frontend: `npm run dev`.
2. Install Playwright in that folder: `npm i playwright@1.58.2 @playwright/test@1.58.2`.
3. Start the stub: `python3 openai_stub.py 8099 ai_requests.jsonl &`.
4. Reset the test database: `./reset_db.sh`.
5. Run the suite: `node main.mjs`.

The runner starts and restarts its own backend (port 8000 must be free). A full run takes about 8 minutes.

To test the running Docker stack instead:

```bash
docker compose -f docker-compose.yml -f doc/ui-test-run/scripts/compose.test-override.yml down -v
docker compose -f docker-compose.yml -f doc/ui-test-run/scripts/compose.test-override.yml up -d
EXTERNAL_BACKEND=1 PG_CONTAINER=campusbite-db node main.mjs s1 s2 s3 s4 s5 s7
docker compose down -v && docker compose up -d   # back to the normal stack with fresh demo data
```

## 4. Results by area

| Area | Total | First run | After fixes | Failed in the first run |
|---|---|---|---|---|
| Setup (S) | 2 | 2 | **2** | |
| Public (P) | 9 | 8 | **9** | P-06 (BUG-03) |
| Auth (A) | 17 | 16 | **17** | A-16 (BUG-04) |
| Customer (C) | 41 | 40 | **41** | C-39 (BUG-06) |
| Owner (O) | 27 | 27 | **27** | |
| Delivery (D) | 8 | 8 | **8** | |
| End-to-end (E) | 9 | 9 | **9** | |
| Security (R) | 10 | 10 | **10** | |
| Mobile (M) | 6 | 6 | **6** | (two small tap targets, see OBS-1) |
| UX (U) | 6 | 6 | **6** | |
| Backend (B) | 3 | 3 | **3** | |
| **Plan total** | **138** | **135** | **138** | |
| Edge cases (X) | 37 | 33 | **37** | X-28 (BUG-05), X-30 (BUG-02), X-32 (BUG-07), X-37 (BUG-01) |

Notes on individual cases:
- **C-02 to C-06:** in the first run these sometimes failed in automation because of BUG-08 (machine-speed typing). At human typing speed they passed. After the fix they pass in automation too.
- **C-26:** needs more than 10 past orders, and the seed has exactly 10. It was checked once there were 18 orders: "Page 1 of 2 · 18 total", and Next/Previous worked. The plan now says to create a few orders first.
- **U-02:** before the fixes, *refreshing* while the backend was down logged the user out (BUG-01), so U-02 was run without a refresh. After the fix, the plan's exact steps pass: refresh → error box, still logged in → **Try again** recovers.

### Measurements from the run

| Check | Result |
|---|---|
| C-18 / O-09 countdowns | "0:59 → 0:57" after 2 s, on both the customer's and the owner's screens. The API rejects Accept during the window (409) |
| C-27 / E-03 live updates | The customer saw the owner's Accept after **14 s** on the order page (within the 15 s polling interval) |
| C-39 rate limit | 11th request refused: "You're asking a bit too fast — please try again in 58 seconds." |
| E-08 AI after a refund | This week's spending fell from ₹2670 to ₹2200, exactly the ₹470 refund |
| E-09 owner stats | Orders 12 → 13, refunded 0 → 1, reviews 3 → 4, rating 4.3 → 4.5. Net revenue stayed ₹2670 because the refunded order is excluded |
| U-04 double submit | 4 rapid clicks on **Pay** on a slow network created **1 order**; the button is disabled while busy |
| U-05 toasts | Disappear after about 5 s and close immediately with × |
| B-01 logging | e.g. `GET /api/v1/restaurants 200 4.34ms request_id=eebd69…`, plus an `X-Request-ID` response header |
| B-02 reminder worker | The reminder appeared on the owner dashboard **60 s** after the order (threshold 1 min) without a page reload |
| B-03 Swagger | 40 operations in 7 groups: System, Auth, Restaurants (public), Orders, Restaurant owner, Delivery partner, AI insights |
| M-02 mobile | 12 pages across all three roles: one-column cards, no sideways scrolling |
| X-26 AI privacy | The AI context for Rohan held 9 orders, all his own. No other customer's orders, names, addresses, phones or emails |

## 5. Bugs (all fixed)

| ID | Severity | Case | Summary | Status |
|---|---|---|---|---|
| BUG-01 | Medium | X-37, U-02 | A reload while the backend is unreachable logged the user out | ✅ Fixed |
| BUG-02 | Medium | X-30 | Checkout showed the cart's old price, but the server charged the new one | ✅ Fixed |
| BUG-03 | Medium | P-06 | "Return to where you were" after login never worked | ✅ Fixed |
| BUG-04 | Low | A-16 | The "Your session expired" banner was never shown | ✅ Fixed |
| BUG-05 | Low | X-28 | A malformed cart in localStorage white-screened the whole app | ✅ Fixed |
| BUG-06 | Low | C-39 | The rate-limit message said "a few seconds" instead of the real number | ✅ Fixed |
| BUG-07 | Low | X-32 | `/orders/abc` showed "Please fix the highlighted fields" instead of "not found" | ✅ Fixed |
| BUG-08 | Low | C-02 … C-06 (flaky) | Menu filters dropped changes typed less than about 10 ms apart | ✅ Fixed |

### BUG-01 · Medium · A reload during a backend outage logged the user out
- **Steps:**
  1. Log in and open My orders.
  2. Stop the backend.
  3. Press F5.
- **Expected:** the "Cannot reach the server" box with **Try again**, and the user stays logged in.
- **Was:** the user was sent to `/login`, and the token was deleted from localStorage.
- **Cause:** [AuthContext.jsx](../frontend/src/context/AuthContext.jsx) checks the session on start-up with `/auth/me`, and its `.catch()` cleared the session on **any** error: network failure, 500 or 503. A restart, a deploy or a flaky network signed everyone out.
- **Fix:** the session is cleared only for 401 (rejected token) and 403 (disabled account). Other errors keep the stored user, and pages show their own error state.
- **Verified by:**
  - X-37 and U-02 (refresh while down → error box, still logged in, **Try again** recovers)
  - unit tests for network error and 503 (session kept) and 403 (logged out)

### BUG-02 · Medium · Checkout charged a different amount from the one shown
- **Steps:**
  1. The customer adds Garlic Naan (₹50) to the cart.
  2. The owner changes its price to ₹55.
  3. The customer opens checkout.
- **Expected:** the customer sees the new price, or is told it changed, before paying.
- **Was:** the button said **"Pay ₹80.00 & place order"**, but the order was created with a total of **₹85.00**.
- **Cause:** the cart keeps the prices from when items were added (D4). The server correctly recomputes prices, but the UI never refreshed them.
- **Fix (both layers):**
  - **Server guard:** checkout accepts an optional `expected_subtotal`. If the database prices give a different subtotal, the order is refused with **409** "Prices have changed… The new subtotal is ₹X", before anything is written.
  - **UI:** the checkout page loads current prices for the cart's dishes (`GET /menu-items/{id}`) and updates the cart. It shows "Prices changed since you added these dishes: Garlic Naan ₹50.00 → ₹55.00", so the Pay button shows the real amount. Pay waits for this check (shown as "Checking prices…") unless the check fails, because the server guard still applies. After a 409, prices are refreshed again.
- **Verified by:**
  - X-30 (the button says ₹85.00, the order is charged ₹85.00)
  - backend tests (match → 201; mismatch → 409 with no order and no ledger row; optional; validated)
  - unit tests (notice + new total; 409 path; check failure still allows paying)

### BUG-03 · Medium · Login never returned to the page that needed it
- **Steps (either):**
  - As a guest, open Campus Curry House → **Add** → log in.
  - Or open `/customer/dashboard`, `/customer/ai-insights` or `/orders/1` while logged out → log in.
- **Expected:** you return to the menu or link you came from (plan P-06).
- **Was:** you always landed on the role's home page (`/`).
- **Cause:** `login()` sets the user state first. `GuestOnly` then re-rendered and immediately did `<Navigate to={homePath}>`, which unmounted `LoginPage`. When `useAuthForm` then called `navigate(from)`, the component was gone and the call was ignored.
- **Fix:** `GuestOnly` now redirects to `location.state.from` (with its query string) when `canAccessPath(role, from)` allows it, and otherwise to the role's home. After a deliberate **Log out**, no return page is remembered.
- **Verified by:**
  - P-06, A-12 and A-15 in the browser
  - unit tests: return to the protected page; role not allowed → home; log out then log in → home

### BUG-04 · Low · The "Your session expired" banner never appeared
- **Steps:**
  1. Log in.
  2. In DevTools, set `campusbite_token` to `abc`.
  3. Click **My orders**.
- **Expected:** the login page shows "Your session expired. Please log in again." (plan A-16).
- **Was:** the login page appeared without the banner, on `/login` instead of `/login?expired=1`.
- **Cause:** the 401 handler navigated to `/login?expired=1`. In the same render, the protected-route guard saw no user and redirected to plain `/login`, which won.
- **Fix:** AuthContext keeps `logoutReason: 'expired'`. The guard redirects to `/login?expired=1`, and the login page shows the banner from either the URL or the reason. A deliberate logout doesn't show it.
- **Verified by:**
  - A-16: the final URL is `/login?expired=1` and the banner is shown
  - unit tests: banner on a 401; no banner on a normal visit or after a disabled-account logout

### BUG-05 · Low · A malformed cart in localStorage white-screened the app
- **Steps:**
  1. Set `localStorage["campusbite_cart_<userId>"]` to valid JSON with the wrong shape, e.g. `"string"` or `{"restaurant":null,"items":"oops"}`. This could happen after a future cart-format change.
  2. Open any page.
- **Was:** a blank page on every route (`TypeError: cart.items.reduce is not a function`), even after logging out and in again. Stored quantities of `-5` or `99999` showed in the navbar.
- **Fix:**
  - `sanitizeCart()` checks the shape when loading and falls back to an empty cart. It drops lines with a bad id, price or quantity, and caps quantities at 20.
  - A top-level `ErrorBoundary` turns any unexpected render error into a "Something went wrong · Reload page" screen.
- **Verified by:**
  - X-28: 6 corrupted variants on 3 pages all render, and the navbar shows sane counts
  - unit tests for `sanitizeCart`, a corrupted stored cart, and the error boundary

### BUG-06 · Low · The rate-limit message lacked the wait time
- **Steps:** ask the AI more than 10 questions within a minute.
- **Expected:** "…please try again in **N** seconds."
- **Was:** "…please try again in **a few** seconds."
- **Cause:** the backend sends `Retry-After`, but CORS only exposed `X-Request-ID` and `X-Process-Time`. The browser hid the header from Axios because the frontend (:5173) and API (:8000) are different origins.
- **Fix:** `Retry-After` was added to `expose_headers` in `CORSMiddleware` ([main.py](../backend/app/main.py)).
- **Verified by:**
  - C-39: "try again in 58 seconds"
  - a backend test that checks the exposed headers

### BUG-07 · Low · A non-numeric id in the URL showed a form-validation error
- **Steps:** open `/orders/abc` or `/restaurants/abc`.
- **Expected:** "Order not found" / "Restaurant not found", like `/orders/999999`.
- **Was:** "Please fix the highlighted fields. Try again".
- **Fix:** the order and restaurant pages treat a 422 like a 404.
- **Verified by:** X-32, where all 5 bad URLs show "not found".

### BUG-08 · Low · Menu filters lost input typed very fast
- **Steps:** type into the dish search, or change two filters, faster than about 10 ms per change. Playwright does this; so do autofill tools and macros.
- **Was:**
  - `paneer butter` typed at 0 ms per key became `ar`.
  - Clearing Min then Max brought the old Min back.
  - Clear followed by a sort change restored the old filters.
- **Impact on people:** none at normal typing speed (≥30 ms per key, even with the CPU slowed 6×). It made the automated plan flaky.
- **Cause:** the inputs were controlled straight from the URL, and the router renders URL updates late (`v7_startTransition`). Each change was built from the last *rendered* filters, so two changes inside one render lost the first.
  - React Router's functional `setSearchParams(prev => …)` doesn't help in v6.28, because it also reads the rendered value.
- **Fix:** `DishFilters` keeps a local copy of the inputs, so each change builds on the latest values and is still written to the URL. URL changes from elsewhere are adopted, while late echoes of the component's own updates are ignored. **Clear filters** resets locally, and the component remounts per restaurant.
- **Verified by:**
  - C-02 to C-06 pass in automation
  - unit tests: three quick changes are all kept; Clear then sort; external URL change is followed

## 6. Edge cases (extra to the plan)

| ID | Edge case | Result |
|---|---|---|
| X-01 | Checkout mixing dishes from two restaurants | ✅ 400 "'Alfredo Pasta' is not on this restaurant's menu" |
| X-02 | Checkout with an unavailable dish | ✅ 400 "'Chicken Biryani' is currently unavailable" |
| X-03 | Quantity 0 / −1 / 21 / 1.5 | ✅ 422 for all (the string `"2"` is accepted as 2, which is harmless) |
| X-04 | Client sends `price: 1` / `total_amount: 1` | ✅ Ignored; the server charged the real ₹110 |
| X-05 | Empty cart; 51 lines; the same dish twice (15 + 15 > 20) | ✅ 422 for all |
| X-06 | Unknown dish / unknown restaurant | ✅ 400 / 404 |
| X-07 | Empty or whitespace address; letters or 30 digits in the phone; 501-character notes | ✅ 422 for all |
| X-08 | Owner skips steps (PLACED → READY / DELIVERED / CANCELLED / REFUNDED); unknown status | ✅ 409 for each; 422 for the unknown status |
| X-09 | Cancel the same order twice | ✅ 200 then 409; exactly one refund ledger row |
| X-10 | **5 simultaneous cancels** | ✅ One 200 and four 409s; exactly one refund (the row lock works) |
| X-11 | A customer cancels someone else's order | ✅ 404 |
| X-12 | Assign a rider to a PLACED order, to a customer account, to an unknown id | ✅ 409 for each |
| X-13 | A rider updates another rider's order; a rider tries to cancel | ✅ 404; 409 |
| X-14 | Review rating 0 / 6 / 3.5; second review; review before delivery; review of someone else's order | ✅ 422 ×3, 409, 409, 404 |
| X-15 | Return reason too short or too long; second return; reject without a note; reject by another owner; approve twice; reject after approve; return before delivery | ✅ 422 / 409 / 422 / 404 / 409 / 409 / 409, and exactly **one** refund |
| X-16 | Register with injected `role: restaurant_owner` / `is_active` / `id` | ✅ Created as a plain customer |
| X-17 | Forged JWT payload, `alg=none`, garbage, empty token, `Basic` scheme | ✅ 401 for all |
| X-18 | Login with uppercase email or surrounding spaces; SQL-like email or password; 5000-character password | ✅ Case and spaces normalised (200); injection attempts get 401/422 |
| X-19 | Search for `%`, `_`, `'; DROP TABLE orders; --`, `<script>` | ✅ Treated literally (0 results); the database is fine afterwards |
| X-20 | `page=0/-1/abc`, `page_size=0/1000`, `min_price=-5/abc`, `sort=hack`; `page=99999` | ✅ 422 for each; 200 with an empty list for `page=99999` |
| X-21 | Dish price 0 / −1 / 10.999 / 1e9; 300-character name; `javascript:` or `ftp:` image URL | ✅ 422 for all |
| X-22 | An owner edits, deletes or toggles another restaurant's dish, or changes its orders | ✅ 404 for each |
| X-23 | Restaurant update with `owner_id` / `avg_rating`; empty name | ✅ 422 |
| X-24 | Login to a deactivated account | ✅ 403 "Account is disabled" |
| X-25 | AI question of 501 characters / empty / whitespace only | ✅ 422 |
| X-26 | AI context contains only the caller's orders and no one else's details | ✅ 9/9 orders were the caller's; no foreign personal data |
| X-27 | HTML or script in a dish name or order notes (XSS) | ✅ Shown as plain text; never executed |
| X-28 | Malformed cart in localStorage | ✅ Fixed (was BUG-05): every variant renders, and counts are sanitised |
| X-29 | A dish in the cart becomes unavailable before Pay | ✅ Error "'Sweet Lassi' is currently unavailable"; no order created |
| X-30 | Price changes while the dish is in the cart | ✅ Fixed (was BUG-02): the new price is shown before Pay; ₹85 shown, ₹85 charged |
| X-31 | Stepper past the maximum | ✅ Stops at 20; **+** is disabled |
| X-32 | `/orders/abc`, `/orders/999999`, `/restaurants/abc`, `/restaurants/999999`, `/restaurants/-1` | ✅ Fixed (was BUG-07): all show "not found" |
| X-33 | Back / Forward / Reload after placing an order | ✅ No duplicate order |
| X-34 | Negative or decimal values in the price filter inputs | ✅ No error banner; the negative value is ignored |
| X-35 | Unicode and emoji in names (`Zoë Ñandú 李雷 🍕`) | ✅ Saved and returned unchanged |
| X-36 | Log out in one tab | ✅ The other tab is logged out too |
| X-37 | Reload while the backend is down | ✅ Fixed (was BUG-01): still logged in, error box with **Try again** |

## 7. Observations (not counted as failures)

| ID | Observation | Status |
|---|---|---|
| OBS-1 | **Small tap targets.** The project's rule is tap targets of 40 px or more. The AI suggestion chips are **30 px** high, and the dialog close **×** is **21×32 px**. The dialogs' main buttons are 40 px, and the dialogs open as bottom sheets | Open (cosmetic) |
| OBS-2 | **Reminder delay.** The owner dashboard checks for reminders every 60 s, so a new reminder can appear up to *threshold + scan interval + 60 s* after the order stalls | Works as designed |
| OBS-3 | **Test plan corrections.** O-01 rating after C-30 (4.3 ★, not 4.5 ★); the READY badge reads "Ready for pickup"; the owner menu has 2 pages (O-15); C-26 needs more than 10 past orders | Applied to [UI_TEST_PLAN.md](UI_TEST_PLAN.md) |
| OBS-4 | **No error boundary.** Any unexpected render error gave a white page | Resolved with BUG-05 (`ErrorBoundary`) |
| OBS-5 | The UI ignores negative price-filter values; the API rejects them (422) | Not a defect |

## 8. What still needs checking

1. ~~Docker + PostgreSQL~~: **done** on 10 Nov 2026 (160/160, see section 3).
2. **A real OpenAI key:** C-36 to C-38 with real answers. C-39 to C-41 and the privacy check are already verified with the stand-in.
3. **Other browsers and real phones:** Safari/Firefox, and the M section on an actual phone.
4. **Optional:** raise the AI chips and the dialog × to 40 px (OBS-1).
