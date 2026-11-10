# P1 — Database Models, Auth & RBAC

**Status:** 🟡 Code complete and verified locally (41 tests passing); applying the migration on a live PostgreSQL is pending (needs Docker)
**Depends on:** P0 · **Unblocks:** P2–P6

## Goal

Define every database table with the SQLAlchemy ORM, create the first Alembic migration, and implement registration (three role-specific signups), login with JWT, and the role-based access control dependencies that every later endpoint uses.

## Scope

| In scope | Out of scope |
|---|---|
| All 10 ORM models + relationships + constraints + indexes | Business endpoints (P2+) |
| First Alembic migration | Seed data (P10) |
| bcrypt hashing, JWT create/decode | Refresh tokens or password reset (not required) |
| `get_current_user`, `require_roles` | |
| 3 register endpoints, login, `/auth/me` | |
| `Page[T]` pagination schema | |
| Test DB fixtures | |

## Design

### Enums (`app/models/enums.py`)
| Enum | Values |
|---|---|
| `UserRole` | `customer`, `restaurant_owner`, `delivery_partner` |
| `VehicleType` | `bicycle`, `scooter`, `bike` |
| `OrderStatus` | `PLACED`, `ACCEPTED`, `PREPARING`, `READY`, `ASSIGNED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`, `REFUNDED` |
| `PaymentStatus` | `pending`, `mock_paid`, `refunded` |
| `LedgerEntryType` | `charge`, `refund` |
| `LedgerStatus` | `success`, `failed` |
| `ReturnStatus` | `requested`, `approved`, `rejected` |

Enums are stored as strings (`sa.Enum(..., native_enum=False)` or `String` + validation) so migrations stay simple on both Postgres and SQLite.

### Models (`app/models/`)
All models have `id` (PK int) and `created_at` (timestamptz, server default `now()`), except `OrderStatusHistory`, which uses `changed_at`. Mutable models also have `updated_at`.

| Model | Key columns | Constraints / indexes |
|---|---|---|
| `User` | name, email, phone, password_hash, role, default_address?, vehicle_type?, vehicle_number?, is_active | `email` UNIQUE + index (stored lowercase) |
| `Restaurant` | owner_id → users, name, description, cuisine, address, phone, image_url, is_open | `owner_id` UNIQUE (D3) |
| `MenuItem` | restaurant_id → restaurants, name, description, category, image_url, price numeric(10,2), is_veg, is_available, is_deleted | CHECK `price > 0`; index `(restaurant_id, is_deleted, is_available)`; index `name` |
| `Order` | customer_id, restaurant_id, delivery_partner_id?, status, payment_status, subtotal, delivery_fee, total_amount, delivery_address, contact_phone, notes, status_updated_at, cancellable_until, cancelled_at? | indexes `(restaurant_id, status, created_at)`, `(customer_id, created_at)`, `(delivery_partner_id, status)` |
| `OrderItem` | order_id, menu_item_id, item_name, unit_price, quantity, line_total | CHECK `quantity BETWEEN 1 AND 20` |
| `OrderStatusHistory` | order_id, from_status?, to_status, changed_by_user_id, changed_at | index `order_id` |
| `Review` | order_id, customer_id, restaurant_id, rating, comment | `order_id` UNIQUE; CHECK `rating BETWEEN 1 AND 5` |
| `PaymentLedger` | order_id, entry_type, amount, status, method (`dummy`), transaction_ref, note? | index `order_id` |
| `ReturnRequest` | order_id, customer_id, reason, status, owner_note?, resolved_at?, resolved_by? | `order_id` UNIQUE |
| `AdminReminderLog` | order_id, restaurant_id, order_status_at_reminder, message, minutes_pending, is_resolved, resolved_at? | index `(restaurant_id, is_resolved)` |

**Relationships (`relationship()` with `back_populates`):**
- `User.orders` (customer), `User.deliveries` (delivery partner), `User.restaurant` (owner, one-to-one)
- `Restaurant.menu_items`, `Restaurant.orders`, `Restaurant.reviews`
- `Order.items`, `Order.status_history`, `Order.ledger_entries`, `Order.review`, `Order.return_request`, `Order.customer`, `Order.restaurant`, `Order.delivery_partner`

`app/models/__init__.py` imports every model so Alembic autogenerate sees them.

### Security (`app/core/security.py`)
- `hash_password(plain) -> str`: `bcrypt.hashpw(plain.encode(), bcrypt.gensalt())`
- `verify_password(plain, hashed) -> bool`: `bcrypt.checkpw`
- `create_access_token(user_id, role) -> str`: payload `{sub: str(user_id), role, exp, iat}`, signed with `JWT_SECRET_KEY` / `JWT_ALGORITHM`
- `decode_token(token) -> dict`: raises on an invalid or expired token

### Dependencies (`app/api/deps.py`)
```python
oauth2_scheme = HTTPBearer(auto_error=False)

def get_current_user(credentials, db) -> User:
    # missing or invalid token → 401 {"detail": "Not authenticated"}
    # decode → load User by sub → missing or inactive → 401
    # role ALWAYS taken from the DB row, never from the token alone

def require_roles(*roles: UserRole):
    def checker(user = Depends(get_current_user)) -> User:
        if user.role not in roles: raise HTTPException(403, "Insufficient permissions")
        return user
    return checker
```
Shortcuts: `CurrentCustomer`, `CurrentOwner`, `CurrentDeliveryPartner` (`Annotated` aliases).

### Schemas (`app/schemas/`)
- `common.py`: `Page[T]` (`items`, `total`, `page`, `page_size`, `pages`), `PaginationParams` dependency (`page >= 1`, `1 <= page_size <= 50`, default 10), and a `paginate(query, params)` helper.
- `auth.py`:
  - `CustomerRegister`: name, email (`EmailStr`), phone, password (min 8), default_address?
  - `OwnerRegister`: the same fields plus `restaurant: RestaurantCreate` (name, address, cuisine, phone, description?)
  - `DeliveryPartnerRegister`: the same fields plus vehicle_type, vehicle_number
  - `LoginRequest`: email, password
  - `UserOut`: id, name, email, phone, role, default_address?, vehicle_type?, vehicle_number?
  - `TokenResponse`: access_token, token_type = "bearer", user: `UserOut`
- Register schemas use `extra="ignore"`, so a client-sent `role` is silently dropped.

### Endpoints (`app/api/v1/auth.py`)
| Method | Path | Body | Response | Errors |
|---|---|---|---|---|
| POST | `/auth/register` | `CustomerRegister` | 201 `TokenResponse` (role = customer) | 409 duplicate email, 422 validation |
| POST | `/auth/register/restaurant-owner` | `OwnerRegister` | 201 `TokenResponse` (user and restaurant created in one transaction) | 409, 422 |
| POST | `/auth/register/delivery-partner` | `DeliveryPartnerRegister` | 201 `TokenResponse` | 409, 422 |
| POST | `/auth/login` | `LoginRequest` | 200 `TokenResponse` | 401 "Invalid email or password" (same message for an unknown email and a wrong password); 403 "Account is disabled" for an inactive user with the correct password |
| GET | `/auth/me` | — | 200 `UserOut` | 401 |

Registration returns a token straight away, so the frontend can log the user in after signup.

## Files to create
```
app/models/enums.py, user.py, restaurant.py, menu_item.py, order.py, order_item.py,
           order_status_history.py, review.py, payment_ledger.py, return_request.py,
           admin_reminder_log.py, __init__.py (imports all)
app/core/security.py
app/api/deps.py
app/schemas/common.py, auth.py, user.py
app/services/auth_service.py
app/api/v1/auth.py            (+ register in app/api/v1/__init__.py)
alembic/versions/0001_initial_schema.py
tests/conftest.py (extend), tests/factories.py, tests/test_auth.py
```

## Tasks
- [x] Enums module
- [x] All 10 models with relationships, constraints and indexes
- [x] `alembic revision --autogenerate -m "initial schema"`, then review the generated file by hand and run `alembic upgrade head`
- [x] `security.py` (bcrypt + JWT)
- [x] `deps.py` (`get_current_user`, `require_roles`, role aliases)
- [x] `common.py` pagination
- [x] Auth schemas + `auth_service` (`register_customer`, `register_owner`, `register_delivery_partner`, `authenticate`)
- [x] Auth router + include it in `api_router`
- [x] Test infrastructure: per-test DB (SQLite file or transaction rollback), `get_db` override, user factories, `auth_headers(user)` fixture

## Tests (`tests/test_auth.py`)
- [x] Each register endpoint creates a user with the correct role
- [x] A `"role": "restaurant_owner"` field sent to `/auth/register` is ignored (user is still a customer)
- [x] Owner registration creates the restaurant linked to the owner
- [x] Duplicate email (case-insensitive) → 409
- [x] Short password or invalid email → 422
- [x] Login success returns a token; a wrong password and an unknown email return the same 401
- [x] `/auth/me` with no token, a garbage token or an expired token (`freezegun`) → 401
- [x] The stored `password_hash` is not the plain password and verifies with bcrypt
- [x] `require_roles` returns 403 for the wrong role (tested with a small dummy route)

## Done when
All three roles can register and log in through Swagger (`/docs` → Authorize with the token), `/auth/me` returns the correct user, the migration applies cleanly on PostgreSQL, and the auth tests are green.

## Implementation notes (as built)

**Additions beyond the original design**
- `app/db/types.py`: `UTCDateTime` type. It stores `TIMESTAMP WITH TIME ZONE` and always returns timezone-aware UTC values, including on SQLite in tests, so time comparisons such as the 60-second cancel window behave the same everywhere. Also provides `utcnow()`.
- `app/db/base.py`: a constraint naming convention (`pk_`, `fk_`, `uq_`, `ix_`, `ck_`), so migration constraint names are stable.
- `app/models/mixins.py`: `CreatedAtMixin` and `TimestampMixin`.
- `app/schemas/types.py`: reusable validated fields. `PersonName` is 2–100 characters, trimmed. `Phone` is 10–15 digits with an optional `+`. `Password` is 8–72 characters (bcrypt's limit). `VehicleNumber` is upper-cased.
- `enum_column()` stores enum **values** as `VARCHAR`, so it works on both PostgreSQL and SQLite and needs no native enum types in migrations.
- Login spends the same bcrypt time on an unknown email as on a known one, so response timing doesn't reveal which emails are registered.
- SQLite foreign keys are switched on (`PRAGMA foreign_keys=ON`) for local runs and tests.
- `alembic/env.py`:
  - writes `UTCDateTime` as `sa.DateTime(timezone=True)` in migration files
  - accepts a connection passed in through `config.attributes["connection"]`, which the migration test uses
- Booleans use Python-side defaults only. This avoids SQLite-specific server defaults leaking into the PostgreSQL schema.

**Migration**
- `alembic/versions/0001_initial_schema.py` was autogenerated, then tidied by hand: plain `op.create_index` calls and `sa.func.now()` defaults.
- Rendering it offline for PostgreSQL (`alembic upgrade head --sql`) produced valid DDL: 10 tables plus `alembic_version`, `TIMESTAMP WITH TIME ZONE` columns, and all FKs, UNIQUE and CHECK constraints and indexes.

**Tests: 41 passing**
| File | Tests |
|---|---|
| `test_health.py` | 4 (from P0) |
| `test_auth.py` | 28: signups (roles, injected role ignored, owner + restaurant atomic, vehicle details, duplicate email case-insensitive, lowercase storage, 5 validation cases, hashed password); login (success, identical 401s, inactive → 403); `/auth/me` (valid, missing or garbage or Basic token, expired token, forged signature, deactivated user); `require_roles` (allow, forbid, multi-role, role taken from the DB rather than the token, needs authentication) |
| `test_models.py` | 9: defaults and relationships, timezone-aware datetimes, one restaurant per owner, price > 0, quantity 1–20, one review and one return per order, rating 1–5, delivery partner relationship, **migration upgrade → matches models exactly → downgrade** |

The expired-token test uses `create_access_token(..., expires_delta=-1s)` instead of freezegun. It is simpler and tests the same behaviour.

**Test infrastructure**
- `tests/conftest.py`: a shared in-memory SQLite database (`StaticPool`), a fresh schema per test, and a `get_db` override.
- `tests/factories.py`: `make_user`, `make_owner_with_restaurant`, `auth_headers`.

**Verification log**
- [x] `pytest`: 41 passed, no warnings
- [x] Live uvicorn and SQLite run: `alembic upgrade head`; 3 signups (an injected role was ignored); duplicate email → 409; login → `/auth/me`; bad login → 401; no token → 401; Swagger shows the bearer security scheme
- [x] PostgreSQL DDL rendered offline
- [ ] `docker compose up --build` applies the migration on PostgreSQL 16
