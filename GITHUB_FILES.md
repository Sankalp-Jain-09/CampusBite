# Files to share in the public GitHub repository

*Generated 10 Nov 2026 from a dry-run of `git add .`, so it follows `.gitignore` exactly.*

**256 files** go into the public repository. They contain **no secrets**: no `.env` files, keys, passwords or database files (checked on 10 Nov 2026, see section 5).

## 1. Required by the PRD

| PRD requirement (section 13 / submission) | File(s) |
|---|---|
| Complete React frontend source code | [`frontend/`](frontend/) — `src/` plus config files (section 3) |
| Complete FastAPI backend source code | [`backend/`](backend/) — `app/`, migrations, scripts, tests (section 3) |
| Dockerfile | [`backend/Dockerfile`](backend/Dockerfile) |
| docker-compose.yml | [`docker-compose.yml`](docker-compose.yml) |
| `.env.example` files wherever required | [`.env.example`](.env.example), [`backend/.env.example`](backend/.env.example), [`frontend/.env.example`](frontend/.env.example) |
| README.md | [`README.md`](README.md) |

## 2. Summary by folder

| Folder | Files | What it contains |
|---|---|---|
| `(root)` | 10 | Project overview, requirements, planning, Docker Compose and the root environment template |
| `backend/ (config)` | 6 | Backend Dockerfile, Docker ignore rules, dependencies, Alembic config, environment template |
| `backend/alembic/` | 4 | Database migrations (creates the 10 tables) |
| `backend/app/ (entry)` | 2 | FastAPI app factory (middleware, CORS, routers, startup) |
| `backend/app/api/` | 10 | REST API routers (auth, restaurants, orders, owner, delivery, AI, health) and auth dependencies |
| `backend/app/core/` | 4 | Settings from environment variables, security (bcrypt, JWT), logging |
| `backend/app/db/` | 4 | Database engine, session, base model, UTC datetime type |
| `backend/app/middleware/` | 2 | Request logging and response-time middleware |
| `backend/app/models/` | 13 | SQLAlchemy ORM models (users, restaurants, menu items, orders, order items, reviews, payment ledger, reminder logs, returns, status history) |
| `backend/app/schemas/` | 12 | Pydantic request/response schemas and validation |
| `backend/app/services/` | 14 | Business logic (orders, state machine, payments, reviews/returns, stats, reminders, AI insights) |
| `backend/app/workers/` | 2 | Background reminder worker |
| `backend/scripts/` | 4 | Container entrypoint, wait-for-database and demo seed data |
| `backend/tests/` | 17 | Backend test suite (pytest, 228 tests) |
| `frontend/ (config)` | 8 | Vite/Tailwind/PostCSS config, npm package files, environment template, HTML entry |
| `frontend/src/ (entry)` | 3 | React entry point, routes, global styles |
| `frontend/src/api/` | 7 | Axios client (JWT, errors) and one module per backend area |
| `frontend/src/components/` | 41 | Reusable React components (common UI, layout, routing guards, order/owner/restaurant widgets) |
| `frontend/src/context/` | 3 | React Context providers: auth, cart, toasts |
| `frontend/src/hooks/` | 8 | Custom React hooks (useApi, useAuth, useCart, …) |
| `frontend/src/pages/` | 19 | Pages for each role: auth, customer, owner, delivery, order details |
| `frontend/src/test/` | 10 | Frontend tests (Vitest + Testing Library, 58 tests + live E2E) |
| `frontend/src/utils/` | 4 | Constants, formatting, storage and validation helpers |
| `doc/ (documents)` | 14 | Per-phase design notes, documentation index, UI test plan and test report |
| `doc/screenshots/` | 15 | README screenshots (15 images) |
| `doc/ui-test-run/` | 20 | Automated Playwright UI test suite, screenshot script and run logs |
| **Total** | **256** | |

## 3. Full file list

**`(root)` — 10 files**

- [`.env.example`](.env.example)
- [`.gitignore`](.gitignore)
- [`CLAUDE.md`](CLAUDE.md)
- [`GITHUB_FILES.md`](GITHUB_FILES.md)
- [`PLAN.md`](PLAN.md)
- [`README.md`](README.md)
- [`REMAINING_WORK.md`](REMAINING_WORK.md)
- [`TODO.md`](TODO.md)
- [`docker-compose.yml`](docker-compose.yml)
- [`prd.txt`](prd.txt)

**`backend/ (config)` — 6 files**

- [`backend/.dockerignore`](backend/.dockerignore)
- [`backend/.env.example`](backend/.env.example)
- [`backend/Dockerfile`](backend/Dockerfile)
- [`backend/alembic.ini`](backend/alembic.ini)
- [`backend/requirements-dev.txt`](backend/requirements-dev.txt)
- [`backend/requirements.txt`](backend/requirements.txt)

**`backend/alembic/` — 4 files**

- [`backend/alembic/env.py`](backend/alembic/env.py)
- [`backend/alembic/script.py.mako`](backend/alembic/script.py.mako)
- [`backend/alembic/versions/.gitkeep`](backend/alembic/versions/.gitkeep)
- [`backend/alembic/versions/0001_initial_schema.py`](backend/alembic/versions/0001_initial_schema.py)

**`backend/app/ (entry)` — 2 files**

- [`backend/app/__init__.py`](backend/app/__init__.py)
- [`backend/app/main.py`](backend/app/main.py)

**`backend/app/api/` — 10 files**

- [`backend/app/api/__init__.py`](backend/app/api/__init__.py)
- [`backend/app/api/deps.py`](backend/app/api/deps.py)
- [`backend/app/api/v1/__init__.py`](backend/app/api/v1/__init__.py)
- [`backend/app/api/v1/ai.py`](backend/app/api/v1/ai.py)
- [`backend/app/api/v1/auth.py`](backend/app/api/v1/auth.py)
- [`backend/app/api/v1/delivery.py`](backend/app/api/v1/delivery.py)
- [`backend/app/api/v1/health.py`](backend/app/api/v1/health.py)
- [`backend/app/api/v1/orders.py`](backend/app/api/v1/orders.py)
- [`backend/app/api/v1/owner.py`](backend/app/api/v1/owner.py)
- [`backend/app/api/v1/restaurants.py`](backend/app/api/v1/restaurants.py)

**`backend/app/core/` — 4 files**

- [`backend/app/core/__init__.py`](backend/app/core/__init__.py)
- [`backend/app/core/config.py`](backend/app/core/config.py)
- [`backend/app/core/logging.py`](backend/app/core/logging.py)
- [`backend/app/core/security.py`](backend/app/core/security.py)

**`backend/app/db/` — 4 files**

- [`backend/app/db/__init__.py`](backend/app/db/__init__.py)
- [`backend/app/db/base.py`](backend/app/db/base.py)
- [`backend/app/db/session.py`](backend/app/db/session.py)
- [`backend/app/db/types.py`](backend/app/db/types.py)

**`backend/app/middleware/` — 2 files**

- [`backend/app/middleware/__init__.py`](backend/app/middleware/__init__.py)
- [`backend/app/middleware/request_logging.py`](backend/app/middleware/request_logging.py)

<details>
<summary>`backend/app/models/` — 13 files</summary>

- [`backend/app/models/__init__.py`](backend/app/models/__init__.py)
- [`backend/app/models/admin_reminder_log.py`](backend/app/models/admin_reminder_log.py)
- [`backend/app/models/enums.py`](backend/app/models/enums.py)
- [`backend/app/models/menu_item.py`](backend/app/models/menu_item.py)
- [`backend/app/models/mixins.py`](backend/app/models/mixins.py)
- [`backend/app/models/order.py`](backend/app/models/order.py)
- [`backend/app/models/order_item.py`](backend/app/models/order_item.py)
- [`backend/app/models/order_status_history.py`](backend/app/models/order_status_history.py)
- [`backend/app/models/payment_ledger.py`](backend/app/models/payment_ledger.py)
- [`backend/app/models/restaurant.py`](backend/app/models/restaurant.py)
- [`backend/app/models/return_request.py`](backend/app/models/return_request.py)
- [`backend/app/models/review.py`](backend/app/models/review.py)
- [`backend/app/models/user.py`](backend/app/models/user.py)

</details>

**`backend/app/schemas/` — 12 files**

- [`backend/app/schemas/__init__.py`](backend/app/schemas/__init__.py)
- [`backend/app/schemas/ai.py`](backend/app/schemas/ai.py)
- [`backend/app/schemas/auth.py`](backend/app/schemas/auth.py)
- [`backend/app/schemas/common.py`](backend/app/schemas/common.py)
- [`backend/app/schemas/menu.py`](backend/app/schemas/menu.py)
- [`backend/app/schemas/order.py`](backend/app/schemas/order.py)
- [`backend/app/schemas/restaurant.py`](backend/app/schemas/restaurant.py)
- [`backend/app/schemas/return_request.py`](backend/app/schemas/return_request.py)
- [`backend/app/schemas/review.py`](backend/app/schemas/review.py)
- [`backend/app/schemas/stats.py`](backend/app/schemas/stats.py)
- [`backend/app/schemas/types.py`](backend/app/schemas/types.py)
- [`backend/app/schemas/user.py`](backend/app/schemas/user.py)

<details>
<summary>`backend/app/services/` — 14 files</summary>

- [`backend/app/services/__init__.py`](backend/app/services/__init__.py)
- [`backend/app/services/ai_service.py`](backend/app/services/ai_service.py)
- [`backend/app/services/auth_service.py`](backend/app/services/auth_service.py)
- [`backend/app/services/delivery_service.py`](backend/app/services/delivery_service.py)
- [`backend/app/services/menu_service.py`](backend/app/services/menu_service.py)
- [`backend/app/services/order_service.py`](backend/app/services/order_service.py)
- [`backend/app/services/order_state.py`](backend/app/services/order_state.py)
- [`backend/app/services/payment_service.py`](backend/app/services/payment_service.py)
- [`backend/app/services/query_utils.py`](backend/app/services/query_utils.py)
- [`backend/app/services/reminder_service.py`](backend/app/services/reminder_service.py)
- [`backend/app/services/restaurant_service.py`](backend/app/services/restaurant_service.py)
- [`backend/app/services/return_service.py`](backend/app/services/return_service.py)
- [`backend/app/services/review_service.py`](backend/app/services/review_service.py)
- [`backend/app/services/stats_service.py`](backend/app/services/stats_service.py)

</details>

**`backend/app/workers/` — 2 files**

- [`backend/app/workers/__init__.py`](backend/app/workers/__init__.py)
- [`backend/app/workers/reminder_worker.py`](backend/app/workers/reminder_worker.py)

**`backend/scripts/` — 4 files**

- [`backend/scripts/__init__.py`](backend/scripts/__init__.py)
- [`backend/scripts/entrypoint.sh`](backend/scripts/entrypoint.sh)
- [`backend/scripts/seed.py`](backend/scripts/seed.py)
- [`backend/scripts/wait_for_db.py`](backend/scripts/wait_for_db.py)

<details>
<summary>`backend/tests/` — 17 files</summary>

- [`backend/tests/__init__.py`](backend/tests/__init__.py)
- [`backend/tests/conftest.py`](backend/tests/conftest.py)
- [`backend/tests/factories.py`](backend/tests/factories.py)
- [`backend/tests/order_helpers.py`](backend/tests/order_helpers.py)
- [`backend/tests/test_ai.py`](backend/tests/test_ai.py)
- [`backend/tests/test_auth.py`](backend/tests/test_auth.py)
- [`backend/tests/test_cancel_window.py`](backend/tests/test_cancel_window.py)
- [`backend/tests/test_catalog.py`](backend/tests/test_catalog.py)
- [`backend/tests/test_checkout.py`](backend/tests/test_checkout.py)
- [`backend/tests/test_health.py`](backend/tests/test_health.py)
- [`backend/tests/test_models.py`](backend/tests/test_models.py)
- [`backend/tests/test_order_lifecycle.py`](backend/tests/test_order_lifecycle.py)
- [`backend/tests/test_order_rbac.py`](backend/tests/test_order_rbac.py)
- [`backend/tests/test_owner_menu.py`](backend/tests/test_owner_menu.py)
- [`backend/tests/test_reviews_returns.py`](backend/tests/test_reviews_returns.py)
- [`backend/tests/test_seed.py`](backend/tests/test_seed.py)
- [`backend/tests/test_stats_reminders.py`](backend/tests/test_stats_reminders.py)

</details>

**`frontend/ (config)` — 8 files**

- [`frontend/.env.example`](frontend/.env.example)
- [`frontend/.gitignore`](frontend/.gitignore)
- [`frontend/index.html`](frontend/index.html)
- [`frontend/package-lock.json`](frontend/package-lock.json)
- [`frontend/package.json`](frontend/package.json)
- [`frontend/postcss.config.js`](frontend/postcss.config.js)
- [`frontend/tailwind.config.js`](frontend/tailwind.config.js)
- [`frontend/vite.config.js`](frontend/vite.config.js)

**`frontend/src/ (entry)` — 3 files**

- [`frontend/src/App.jsx`](frontend/src/App.jsx)
- [`frontend/src/index.css`](frontend/src/index.css)
- [`frontend/src/main.jsx`](frontend/src/main.jsx)

**`frontend/src/api/` — 7 files**

- [`frontend/src/api/ai.js`](frontend/src/api/ai.js)
- [`frontend/src/api/auth.js`](frontend/src/api/auth.js)
- [`frontend/src/api/client.js`](frontend/src/api/client.js)
- [`frontend/src/api/delivery.js`](frontend/src/api/delivery.js)
- [`frontend/src/api/orders.js`](frontend/src/api/orders.js)
- [`frontend/src/api/owner.js`](frontend/src/api/owner.js)
- [`frontend/src/api/restaurants.js`](frontend/src/api/restaurants.js)

<details>
<summary>`frontend/src/components/` — 41 files</summary>

- [`frontend/src/components/auth/AuthCard.jsx`](frontend/src/components/auth/AuthCard.jsx)
- [`frontend/src/components/auth/useAuthForm.js`](frontend/src/components/auth/useAuthForm.js)
- [`frontend/src/components/common/Badges.jsx`](frontend/src/components/common/Badges.jsx)
- [`frontend/src/components/common/Button.jsx`](frontend/src/components/common/Button.jsx)
- [`frontend/src/components/common/ConfirmDialog.jsx`](frontend/src/components/common/ConfirmDialog.jsx)
- [`frontend/src/components/common/DishImage.jsx`](frontend/src/components/common/DishImage.jsx)
- [`frontend/src/components/common/EmptyState.jsx`](frontend/src/components/common/EmptyState.jsx)
- [`frontend/src/components/common/ErrorBoundary.jsx`](frontend/src/components/common/ErrorBoundary.jsx)
- [`frontend/src/components/common/ErrorMessage.jsx`](frontend/src/components/common/ErrorMessage.jsx)
- [`frontend/src/components/common/Filters.jsx`](frontend/src/components/common/Filters.jsx)
- [`frontend/src/components/common/FormField.jsx`](frontend/src/components/common/FormField.jsx)
- [`frontend/src/components/common/Loader.jsx`](frontend/src/components/common/Loader.jsx)
- [`frontend/src/components/common/Modal.jsx`](frontend/src/components/common/Modal.jsx)
- [`frontend/src/components/common/PageHeader.jsx`](frontend/src/components/common/PageHeader.jsx)
- [`frontend/src/components/common/Pagination.jsx`](frontend/src/components/common/Pagination.jsx)
- [`frontend/src/components/common/RatingStars.jsx`](frontend/src/components/common/RatingStars.jsx)
- [`frontend/src/components/common/Spinner.jsx`](frontend/src/components/common/Spinner.jsx)
- [`frontend/src/components/delivery/DeliveryCard.jsx`](frontend/src/components/delivery/DeliveryCard.jsx)
- [`frontend/src/components/layout/Footer.jsx`](frontend/src/components/layout/Footer.jsx)
- [`frontend/src/components/layout/Layout.jsx`](frontend/src/components/layout/Layout.jsx)
- [`frontend/src/components/layout/Navbar.jsx`](frontend/src/components/layout/Navbar.jsx)
- [`frontend/src/components/order/CancelCountdown.jsx`](frontend/src/components/order/CancelCountdown.jsx)
- [`frontend/src/components/order/OrderCard.jsx`](frontend/src/components/order/OrderCard.jsx)
- [`frontend/src/components/order/OrderItemsTable.jsx`](frontend/src/components/order/OrderItemsTable.jsx)
- [`frontend/src/components/order/OrderTimeline.jsx`](frontend/src/components/order/OrderTimeline.jsx)
- [`frontend/src/components/order/OrderTotals.jsx`](frontend/src/components/order/OrderTotals.jsx)
- [`frontend/src/components/order/ReturnForm.jsx`](frontend/src/components/order/ReturnForm.jsx)
- [`frontend/src/components/order/ReviewForm.jsx`](frontend/src/components/order/ReviewForm.jsx)
- [`frontend/src/components/owner/AssignPartnerModal.jsx`](frontend/src/components/owner/AssignPartnerModal.jsx)
- [`frontend/src/components/owner/MenuItemForm.jsx`](frontend/src/components/owner/MenuItemForm.jsx)
- [`frontend/src/components/owner/OwnerOrderActions.jsx`](frontend/src/components/owner/OwnerOrderActions.jsx)
- [`frontend/src/components/owner/ReminderList.jsx`](frontend/src/components/owner/ReminderList.jsx)
- [`frontend/src/components/owner/StatsCards.jsx`](frontend/src/components/owner/StatsCards.jsx)
- [`frontend/src/components/restaurant/DishCard.jsx`](frontend/src/components/restaurant/DishCard.jsx)
- [`frontend/src/components/restaurant/DishFilters.jsx`](frontend/src/components/restaurant/DishFilters.jsx)
- [`frontend/src/components/restaurant/QuantityStepper.jsx`](frontend/src/components/restaurant/QuantityStepper.jsx)
- [`frontend/src/components/restaurant/RestaurantCard.jsx`](frontend/src/components/restaurant/RestaurantCard.jsx)
- [`frontend/src/components/routing/CustomerHome.jsx`](frontend/src/components/routing/CustomerHome.jsx)
- [`frontend/src/components/routing/GuestOnly.jsx`](frontend/src/components/routing/GuestOnly.jsx)
- [`frontend/src/components/routing/ProtectedRoute.jsx`](frontend/src/components/routing/ProtectedRoute.jsx)
- [`frontend/src/components/routing/RoleRoute.jsx`](frontend/src/components/routing/RoleRoute.jsx)

</details>

**`frontend/src/context/` — 3 files**

- [`frontend/src/context/AuthContext.jsx`](frontend/src/context/AuthContext.jsx)
- [`frontend/src/context/CartContext.jsx`](frontend/src/context/CartContext.jsx)
- [`frontend/src/context/ToastContext.jsx`](frontend/src/context/ToastContext.jsx)

**`frontend/src/hooks/` — 8 files**

- [`frontend/src/hooks/useApi.js`](frontend/src/hooks/useApi.js)
- [`frontend/src/hooks/useAuth.js`](frontend/src/hooks/useAuth.js)
- [`frontend/src/hooks/useCart.js`](frontend/src/hooks/useCart.js)
- [`frontend/src/hooks/useCountdown.js`](frontend/src/hooks/useCountdown.js)
- [`frontend/src/hooks/useDebounce.js`](frontend/src/hooks/useDebounce.js)
- [`frontend/src/hooks/useInterval.js`](frontend/src/hooks/useInterval.js)
- [`frontend/src/hooks/usePagination.js`](frontend/src/hooks/usePagination.js)
- [`frontend/src/hooks/useToast.js`](frontend/src/hooks/useToast.js)

<details>
<summary>`frontend/src/pages/` — 19 files</summary>

- [`frontend/src/pages/NotFoundPage.jsx`](frontend/src/pages/NotFoundPage.jsx)
- [`frontend/src/pages/OrderDetailPage.jsx`](frontend/src/pages/OrderDetailPage.jsx)
- [`frontend/src/pages/UnauthorizedPage.jsx`](frontend/src/pages/UnauthorizedPage.jsx)
- [`frontend/src/pages/auth/CustomerRegisterPage.jsx`](frontend/src/pages/auth/CustomerRegisterPage.jsx)
- [`frontend/src/pages/auth/DeliveryRegisterPage.jsx`](frontend/src/pages/auth/DeliveryRegisterPage.jsx)
- [`frontend/src/pages/auth/LoginPage.jsx`](frontend/src/pages/auth/LoginPage.jsx)
- [`frontend/src/pages/auth/PartnerRegisterPage.jsx`](frontend/src/pages/auth/PartnerRegisterPage.jsx)
- [`frontend/src/pages/customer/AIInsightsPage.jsx`](frontend/src/pages/customer/AIInsightsPage.jsx)
- [`frontend/src/pages/customer/CartPage.jsx`](frontend/src/pages/customer/CartPage.jsx)
- [`frontend/src/pages/customer/CheckoutPage.jsx`](frontend/src/pages/customer/CheckoutPage.jsx)
- [`frontend/src/pages/customer/CustomerDashboardPage.jsx`](frontend/src/pages/customer/CustomerDashboardPage.jsx)
- [`frontend/src/pages/customer/RestaurantListPage.jsx`](frontend/src/pages/customer/RestaurantListPage.jsx)
- [`frontend/src/pages/customer/RestaurantMenuPage.jsx`](frontend/src/pages/customer/RestaurantMenuPage.jsx)
- [`frontend/src/pages/delivery/DeliveryDashboardPage.jsx`](frontend/src/pages/delivery/DeliveryDashboardPage.jsx)
- [`frontend/src/pages/delivery/DeliveryHistoryPage.jsx`](frontend/src/pages/delivery/DeliveryHistoryPage.jsx)
- [`frontend/src/pages/owner/MenuManagementPage.jsx`](frontend/src/pages/owner/MenuManagementPage.jsx)
- [`frontend/src/pages/owner/OrderManagementPage.jsx`](frontend/src/pages/owner/OrderManagementPage.jsx)
- [`frontend/src/pages/owner/OwnerDashboardPage.jsx`](frontend/src/pages/owner/OwnerDashboardPage.jsx)
- [`frontend/src/pages/owner/ReturnRequestsPage.jsx`](frontend/src/pages/owner/ReturnRequestsPage.jsx)

</details>

**`frontend/src/test/` — 10 files**

- [`frontend/src/test/apiClient.test.js`](frontend/src/test/apiClient.test.js)
- [`frontend/src/test/bugfixes.test.jsx`](frontend/src/test/bugfixes.test.jsx)
- [`frontend/src/test/cart.test.jsx`](frontend/src/test/cart.test.jsx)
- [`frontend/src/test/customer.test.jsx`](frontend/src/test/customer.test.jsx)
- [`frontend/src/test/live/fullFlow.live.test.jsx`](frontend/src/test/live/fullFlow.live.test.jsx)
- [`frontend/src/test/login.test.jsx`](frontend/src/test/login.test.jsx)
- [`frontend/src/test/ownerDelivery.test.jsx`](frontend/src/test/ownerDelivery.test.jsx)
- [`frontend/src/test/renderWithProviders.jsx`](frontend/src/test/renderWithProviders.jsx)
- [`frontend/src/test/routing.test.jsx`](frontend/src/test/routing.test.jsx)
- [`frontend/src/test/setup.js`](frontend/src/test/setup.js)

**`frontend/src/utils/` — 4 files**

- [`frontend/src/utils/constants.js`](frontend/src/utils/constants.js)
- [`frontend/src/utils/format.js`](frontend/src/utils/format.js)
- [`frontend/src/utils/storage.js`](frontend/src/utils/storage.js)
- [`frontend/src/utils/validation.js`](frontend/src/utils/validation.js)

<details>
<summary>`doc/ (documents)` — 14 files</summary>

- [`doc/P0-setup-infrastructure.md`](doc/P0-setup-infrastructure.md)
- [`doc/P1-models-auth-rbac.md`](doc/P1-models-auth-rbac.md)
- [`doc/P10-seed-polish-submission.md`](doc/P10-seed-polish-submission.md)
- [`doc/P2-catalog-menu.md`](doc/P2-catalog-menu.md)
- [`doc/P3-orders-core.md`](doc/P3-orders-core.md)
- [`doc/P4-reviews-returns-refunds.md`](doc/P4-reviews-returns-refunds.md)
- [`doc/P5-stats-reminders.md`](doc/P5-stats-reminders.md)
- [`doc/P6-ai-insights.md`](doc/P6-ai-insights.md)
- [`doc/P7-frontend-foundation.md`](doc/P7-frontend-foundation.md)
- [`doc/P8-customer-ui.md`](doc/P8-customer-ui.md)
- [`doc/P9-owner-delivery-ui.md`](doc/P9-owner-delivery-ui.md)
- [`doc/README.md`](doc/README.md)
- [`doc/UI_TEST_PLAN.md`](doc/UI_TEST_PLAN.md)
- [`doc/UI_TEST_REPORT.md`](doc/UI_TEST_REPORT.md)

</details>

<details>
<summary>`doc/screenshots/` — 15 files</summary>

- [`doc/screenshots/01-restaurants.png`](doc/screenshots/01-restaurants.png)
- [`doc/screenshots/02-menu.png`](doc/screenshots/02-menu.png)
- [`doc/screenshots/03-checkout.png`](doc/screenshots/03-checkout.png)
- [`doc/screenshots/04-order-cancel-countdown.png`](doc/screenshots/04-order-cancel-countdown.png)
- [`doc/screenshots/05-my-orders.png`](doc/screenshots/05-my-orders.png)
- [`doc/screenshots/06-order-refunded.png`](doc/screenshots/06-order-refunded.png)
- [`doc/screenshots/07-ai-insights.png`](doc/screenshots/07-ai-insights.png)
- [`doc/screenshots/08-owner-dashboard.png`](doc/screenshots/08-owner-dashboard.png)
- [`doc/screenshots/09-owner-orders.png`](doc/screenshots/09-owner-orders.png)
- [`doc/screenshots/10-owner-menu.png`](doc/screenshots/10-owner-menu.png)
- [`doc/screenshots/11-owner-assign-rider.png`](doc/screenshots/11-owner-assign-rider.png)
- [`doc/screenshots/12-owner-returns.png`](doc/screenshots/12-owner-returns.png)
- [`doc/screenshots/13-rider-deliveries.png`](doc/screenshots/13-rider-deliveries.png)
- [`doc/screenshots/14-mobile-menu.png`](doc/screenshots/14-mobile-menu.png)
- [`doc/screenshots/15-mobile-cart-bar.png`](doc/screenshots/15-mobile-cart-bar.png)

</details>

<details>
<summary>`doc/ui-test-run/` — 20 files</summary>

- [`doc/ui-test-run/screenshots/A-16.png`](doc/ui-test-run/screenshots/A-16.png)
- [`doc/ui-test-run/screenshots/C-39.png`](doc/ui-test-run/screenshots/C-39.png)
- [`doc/ui-test-run/screenshots/X-28.png`](doc/ui-test-run/screenshots/X-28.png)
- [`doc/ui-test-run/screenshots/X-37.png`](doc/ui-test-run/screenshots/X-37.png)
- [`doc/ui-test-run/scripts/compose.test-override.yml`](doc/ui-test-run/scripts/compose.test-override.yml)
- [`doc/ui-test-run/scripts/lib.mjs`](doc/ui-test-run/scripts/lib.mjs)
- [`doc/ui-test-run/scripts/main.mjs`](doc/ui-test-run/scripts/main.mjs)
- [`doc/ui-test-run/scripts/openai_stub.py`](doc/ui-test-run/scripts/openai_stub.py)
- [`doc/ui-test-run/scripts/rerun.mjs`](doc/ui-test-run/scripts/rerun.mjs)
- [`doc/ui-test-run/scripts/reset_db.sh`](doc/ui-test-run/scripts/reset_db.sh)
- [`doc/ui-test-run/scripts/s1_public_auth.mjs`](doc/ui-test-run/scripts/s1_public_auth.mjs)
- [`doc/ui-test-run/scripts/s2_customer.mjs`](doc/ui-test-run/scripts/s2_customer.mjs)
- [`doc/ui-test-run/scripts/s3_owner.mjs`](doc/ui-test-run/scripts/s3_owner.mjs)
- [`doc/ui-test-run/scripts/s4_delivery.mjs`](doc/ui-test-run/scripts/s4_delivery.mjs)
- [`doc/ui-test-run/scripts/s5_e2e_security.mjs`](doc/ui-test-run/scripts/s5_e2e_security.mjs)
- [`doc/ui-test-run/scripts/s6_mobile_ux_backend.mjs`](doc/ui-test-run/scripts/s6_mobile_ux_backend.mjs)
- [`doc/ui-test-run/scripts/s7_edge.mjs`](doc/ui-test-run/scripts/s7_edge.mjs)
- [`doc/ui-test-run/scripts/screenshots.mjs`](doc/ui-test-run/scripts/screenshots.mjs)
- [`doc/ui-test-run/scripts/shot14.mjs`](doc/ui-test-run/scripts/shot14.mjs)
- [`doc/ui-test-run/scripts/start_backend.sh`](doc/ui-test-run/scripts/start_backend.sh)

</details>

## 4. Optional files: your choice

These are safe to share (no secrets), but they are not required by the PRD. Keep them, or delete them before the first commit:

| File | What it is | Suggestion |
|---|---|---|
| [`prd.txt`](prd.txt) | The original assignment text | Optional; some courses prefer you don't republish the brief |
| [`CLAUDE.md`](CLAUDE.md) | Project context for AI-assisted development | Optional; keep it if you're happy to show the project was built with AI assistance |
| [`REMAINING_WORK.md`](REMAINING_WORK.md) | Your personal to-do list for submission | Optional; it mentions this machine's folder layout |
| [`PLAN.md`](PLAN.md), [`TODO.md`](TODO.md), [`doc/P*.md`](doc/README.md) | Design, checklist and per-phase notes | Recommended: they show the engineering process |
| [`doc/ui-test-run/`](doc/ui-test-run/) | Automated UI test suite and logs | Recommended. Note: `scripts/start_backend.sh` and `scripts/reset_db.sh` contain this machine's path (`/home/sankalp/…`), which reveals your Linux username but nothing secret |
| `GITHUB_FILES.md` | This document | Optional |

## 5. Never share (already excluded by `.gitignore`)

| Item on this machine | Why it must stay private or local |
|---|---|
| `.env` | **Real secrets**: database password, JWT secret, OpenAI API key |
| `frontend/.env` | Local settings (no secret, but environment-specific) |
| `backend/campusbite.db` | Local SQLite database with test data |
| `backend/.venv/` | Python virtual environment (recreated from `requirements.txt`) |
| `frontend/node_modules/` | Installed npm packages (recreated with `npm ci`) |
| `frontend/dist/` | Build output (recreated with `npm run build`) |
| `.vscode/` | Editor settings |
| `__pycache__/`, `.pytest_cache/` | Caches |

Verified on 10 Nov 2026:
- none of the files above is in the list to commit
- the real `POSTGRES_PASSWORD`, `JWT_SECRET_KEY` and `OPENAI_API_KEY` values appear in **none** of the shared files
- no other API keys, tokens or private keys were found
- the only "keys" in shared files are placeholders (`change_me`, `replace_with_long_random_string`) and test fakes (`sk-stub`, `uitest-secret`)

## 6. Commands

Run all commands from the project root:
```bash
cd ~/"concept understanding/practice/practice"
```

### 6.1 Preview which files will be shared (without creating a repository)
This is how the list in section 3 was made. It applies `.gitignore` exactly like a real `git add .`, but writes nothing into the project:
```bash
git --git-dir=/tmp/preview.git init -q -b main
git --git-dir=/tmp/preview.git --work-tree=. add -n . | sed "s/^add '//; s/'$//" > /tmp/files-to-share.txt
wc -l < /tmp/files-to-share.txt              # expect about 256
less /tmp/files-to-share.txt                 # browse the list (q to quit)
```
Ask why a file is (or isn't) excluded:
```bash
git --git-dir=/tmp/preview.git --work-tree=. check-ignore -v .env frontend/.env backend/campusbite.db
# .gitignore:2:.env  .env  ← the rule that hides it
```

### 6.2 Check for secrets (prints file names only, never the secret values)
```bash
# env files: expect only the three .env.example files
grep -i "\.env" /tmp/files-to-share.txt

# files that must never be shared: expect no output
grep -E "\.db$|\.venv/|node_modules/|dist/|__pycache__" /tmp/files-to-share.txt

# your REAL secret values from .env inside any shared file: expect no output
tr '\n' '\0' < /tmp/files-to-share.txt | xargs -0 grep -lF -f <(grep -E '^(POSTGRES_PASSWORD|JWT_SECRET_KEY|OPENAI_API_KEY)=' .env | cut -d= -f2- | grep -v '^$')

# any OpenAI-style key at all: expect no output
tr '\n' '\0' < /tmp/files-to-share.txt | xargs -0 grep -lIE "sk-proj-[A-Za-z0-9_-]{20,}"

rm -rf /tmp/preview.git                      # remove the preview helper when done
```

### 6.3 Create the repository and the first commit
```bash
git init -b main
git add .
git status                                   # should match section 3
git ls-files | wc -l                         # about 256
git ls-files | grep -i "\.env"               # only the three .env.example files
git commit -m "CampusBite: full-stack restaurant ordering & delivery platform"
```
If git asks who you are (first commit on this machine):
```bash
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"
```

### 6.4 Push to a public GitHub repository
1. On https://github.com/new create a repository (e.g. `campusbite`). Set **Public**, and do **not** add a README, `.gitignore` or licence (they already exist here).
2. Connect and push:
```bash
git remote add origin https://github.com/<your-username>/campusbite.git
git push -u origin main
```
GitHub asks for a password: use a **personal access token** (GitHub → Settings → Developer settings → Personal access tokens), not your account password. Alternatively, install the GitHub CLI and run `gh auth login`.

### 6.5 Verify after pushing
```bash
git ls-remote --heads origin                 # shows refs/heads/main
```
- Open `https://github.com/<your-username>/campusbite` in a **private/incognito window**: it must load without logging in (the PRD requires a public repository).
- On GitHub, check that `.env` is **not** listed and `README.md` shows the screenshots.
- Optional fresh-clone test: `git clone https://github.com/<your-username>/campusbite.git /tmp/campusbite-test`, then follow only its README.

### 6.6 Later changes
```bash
git add .
git status                                   # review before every commit
git commit -m "Describe the change"
git push
```

If anything secret ever gets committed and pushed, **revoke it immediately** (create a new OpenAI key, change the passwords). Deleting the file afterwards is not enough, because it stays in the git history.
