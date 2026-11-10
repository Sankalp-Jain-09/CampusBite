# P3 — Orders Core: Checkout, State Machine, Assignment, Delivery

**Status:** ✅ Done (154 tests passing; verified on a live server)
**Depends on:** P1, P2 · **Unblocks:** P4, P5, P6, P8, P9

## Goal

The heart of the system: placing orders with the dummy payment, the order status rules (state machine) enforced on the backend, the 60-second free cancellation window (D14), owner order management and delivery partner assignment, and the delivery partner's delivery flow.

## Scope

| In scope | Out of scope |
|---|---|
| Checkout + mock charge + payment ledger | Reviews and returns (P4) |
| State machine with role and ownership checks | Reminders (P5); only the hook for resolving them goes in here |
| Customer order list, detail and cancel (free window + no-refund) | Real payment gateway |
| Owner order list, status updates, partner list, assign | |
| Delivery partner order list, detail, status updates, history | |

## Design

### State machine (`app/services/order_state.py`)
```python
TRANSITIONS = {
    (PLACED,           ACCEPTED):         {RESTAURANT_OWNER},   # blocked during the free window (D14)
    (PLACED,           CANCELLED):        {CUSTOMER},           # refund if within the window
    (ACCEPTED,         PREPARING):        {RESTAURANT_OWNER},
    (PREPARING,        READY):            {RESTAURANT_OWNER},
    (READY,            ASSIGNED):         {RESTAURANT_OWNER},   # only via /assign
    (ASSIGNED,         OUT_FOR_DELIVERY): {DELIVERY_PARTNER},
    (OUT_FOR_DELIVERY, DELIVERED):        {DELIVERY_PARTNER},
    (DELIVERED,        REFUNDED):         {RESTAURANT_OWNER},   # only via return approval (P4)
}
```
- `validate_transition(order, target, actor)`: if the pair isn't in the table or the role isn't allowed → **409** `"Cannot move order from X to Y"`. If `PLACED→ACCEPTED` while `now <= cancellable_until` → **409** `"Order is in the customer's free-cancellation window"`.
- `apply_transition(db, order, target, actor)`: set the status and `status_updated_at = now`, insert `OrderStatusHistory`, mark open `AdminReminderLog` rows for the order as resolved. Does not commit; the caller commits once.
- **Concurrency:** the order is always loaded with `select(Order).where(...).with_for_update()` inside the request transaction before validating.

### Enforcement order (every status-changing endpoint)
1. Authenticated (401) → 2. Role (403) → 3. Ownership or assignment (404) → 4. Transition valid (409) → 5. Time rules (409) → 6. Side effects + commit.

### Payment service (`app/services/payment_service.py`)
- `mock_charge(db, order)`: ledger `{entry_type: charge, amount: total, status: success, method: "dummy", transaction_ref: "MOCK-<uuid4>"}`, then `order.payment_status = mock_paid`.
- `mock_refund(db, order, note)`: ledger `{entry_type: refund, amount: total, transaction_ref: "MOCK-REFUND-<uuid4>", note}`, then `order.payment_status = refunded`. Guard: if a refund entry already exists → 409 (prevents double refunds).

### Checkout — `POST /orders` (customer)
Request:
```json
{ "restaurant_id": 1, "items": [{"menu_item_id": 3, "quantity": 2}],
  "delivery_address": "Hostel B, Room 214", "contact_phone": "9876543210", "notes": "Less spicy",
  "expected_subtotal": 360.00 }
```
`expected_subtotal` is optional (added after the UI test run, BUG-02): the items subtotal the customer saw. If the
DB prices give a different subtotal, the order is refused with **409** and nothing is charged.
Algorithm (single transaction):
1. `items` must not be empty; merge duplicate `menu_item_id`s; quantity 1–20 (422).
2. Load the restaurant (404) and check `is_open` (400 "Restaurant is closed").
3. Load all menu items with `id IN (...)`. Any missing, deleted, unavailable or from another restaurant → **400** naming the item.
4. Compute from **DB prices**: `line_total = price × qty`, `subtotal`, `delivery_fee = settings.DELIVERY_FEE`, `total`.
   If `expected_subtotal` was sent and differs from `subtotal` → **409** "Prices have changed…" (before any write).
5. Insert the `Order` (PLACED, payment `pending`, `cancellable_until = now + CANCEL_GRACE_SECONDS`) and the `OrderItem`s (name and price snapshot).
6. Insert `OrderStatusHistory(None → PLACED)`.
7. `mock_charge()` → `mock_paid`.
8. Commit → **201** `OrderOut` with `cancellable_until` and `cancel_window_remaining_seconds = max(0, cancellable_until - now)`.

### Cancel — `POST /orders/{id}/cancel` (customer, no body)
```
load order FOR UPDATE where id = :id and customer_id = me      → 404
status != PLACED                                               → 409 "Order can no longer be cancelled"
apply_transition(PLACED → CANCELLED); order.cancelled_at = now
if now <= cancellable_until: mock_refund(note="free_cancellation_window")   # D14
else: payment unchanged, no ledger entry                                      # D5
commit → {status, payment_status, refunded_amount (total or 0)}
```

### Customer read endpoints
| Method | Path | Notes |
|---|---|---|
| GET | `/orders/me` | `status`, `date_from`, `date_to`, `page`, `page_size`; newest first; list items include restaurant name, total, status, payment_status, return_status?, has_review |
| GET | `/orders/{id}` | **Scoped:** customer owns the order, OR owner owns the restaurant, OR delivery partner is assigned; otherwise 404. Returns items, timeline (status history), payment info, refund info, return and review info, `cancel_window_remaining_seconds`. |

### Owner endpoints (`/owner/...`)
| Method | Path | Notes |
|---|---|---|
| GET | `/owner/orders` | `status`, `date_from`, `date_to`, `page`; restaurant = caller's; each item includes `in_cancel_window` and `cancel_window_remaining_seconds` |
| PATCH | `/owner/orders/{id}/status` | `{status}` ∈ {ACCEPTED, PREPARING, READY}; anything else → 409 (D6) |
| GET | `/owner/delivery-partners` | Active partners plus `active_deliveries` (count of ASSIGNED and OUT_FOR_DELIVERY) |
| POST | `/owner/orders/{id}/assign` | `{delivery_partner_id}`; order must be READY (409); target must exist, be active and be a delivery partner (400); sets `delivery_partner_id` and moves to ASSIGNED |

### Delivery partner endpoints (`/delivery/...`)
| Method | Path | Notes |
|---|---|---|
| GET | `/delivery/orders` | `delivery_partner_id = me`, status ∈ {ASSIGNED, OUT_FOR_DELIVERY} (optional `status` filter), paginated |
| GET | `/delivery/orders/{id}` | Includes customer name, phone, delivery address, restaurant name and address, items; 404 if not assigned to the caller |
| PATCH | `/delivery/orders/{id}/status` | `{status}` ∈ {OUT_FOR_DELIVERY, DELIVERED} via the state machine |
| GET | `/delivery/history` | DELIVERED orders for the caller; `date_from`, `date_to`, paginated |

### Date filters
`date_from` and `date_to` are ISO dates and inclusive. They are converted to `[date_from 00:00, date_to + 1 day 00:00)` UTC ranges.

## Files to create
```
app/services/order_state.py, order_service.py, payment_service.py, delivery_service.py
app/schemas/order.py      (OrderCreate, OrderItemIn, OrderOut, OrderListItem, OrderDetail,
                           StatusUpdate, AssignRequest, CancelResponse, DeliveryPartnerOut)
app/api/v1/orders.py, delivery.py, owner.py (orders part)
tests/test_order_lifecycle.py, tests/test_rbac.py, tests/test_cancel_window.py
```

## Tasks
- [x] State machine module + unit tests for the table
- [x] Payment service (charge and refund with the double-refund guard)
- [x] Checkout endpoint
- [x] Customer list, detail (scoped) and cancel
- [x] Owner list, status update, partner list, assign
- [x] Delivery partner list, detail, status update, history
- [x] Shared `get_order_for_update(db, order_id, scope)` helper

## Tests
- [x] Happy path PLACED → ACCEPTED → PREPARING → READY → ASSIGNED → OUT_FOR_DELIVERY → DELIVERED across three users; history has 7 rows
- [x] Invalid transitions → 409: PLACED→READY, ACCEPTED→READY, DELIVERED→CANCELLED, owner setting CANCELLED, owner setting OUT_FOR_DELIVERY, assign when not READY, delivery partner setting DELIVERED from ASSIGNED
- [x] **D14 (freezegun):** cancel at +30s → CANCELLED, payment `refunded`, 1 refund entry; cancel at +61s → CANCELLED, payment `mock_paid`, no refund entry; owner Accept at +30s → 409, at +61s → 200; cancel after Accept → 409; second cancel → 409 and still exactly one refund entry
- [x] Checkout: tampered client price ignored (the schema has no price field anyway); unavailable item → 400; items from another restaurant → 400; empty items → 422; closed restaurant → 400; totals correct; charge ledger entry exists; payment `mock_paid`
- [x] RBAC: customer A reading B's order → 404; owner A updating B's order → 404; delivery partner reading or updating an unassigned order → 404; customer calling `/owner/*` or `/delivery/*` → 403
- [x] Assign to a user who isn't a delivery partner → 400

## Done when
The full lifecycle, including the free cancellation window, can be driven through Swagger with three users (customer, owner, delivery partner), and the lifecycle, cancel-window and RBAC tests are green.

## Implementation notes (as built)

**Files**
```
app/services/order_state.py     TRANSITIONS table, validate_transition, apply_transition, transition, in_cancel_window
app/services/payment_service.py mock_charge, mock_refund (refuses a second refund → 409)
app/services/order_service.py   place_order, role-scoped get/lock, list (customer/owner), cancel_order,
                                owner_update_status, list_delivery_partners, assign_partner, to_summary/to_detail
app/services/delivery_service.py list_active, get_assigned, update_status, history
app/services/query_utils.py     + date_range_conditions (inclusive dates, from > to → 422)
app/schemas/order.py            OrderCreate, OrderSummary, OrderDetail (+ items, timeline, payments, refund,
                                return_request, review), CancelResponse, StatusUpdate, AssignRequest, DeliveryPartnerOut
app/api/v1/orders.py, delivery.py, owner.py (orders section)
tests/order_helpers.py, test_checkout.py (21), test_order_lifecycle.py (22), test_cancel_window.py (8), test_order_rbac.py (13)
```

**Decisions made while building**
| Topic | Decision |
|---|---|
| One read endpoint for all roles | `GET /orders/{id}` uses a role-based scope condition: customer → own orders, owner → their restaurant's, partner → assigned. Anything else → 404. |
| Response shape | Every list returns `OrderSummary` (status, payment, total, `items_summary` such as "2× Paneer Tikka", restaurant, customer and partner names, `in_cancel_window`, `cancel_window_remaining_seconds`, `return_status`, `has_review`). Detail adds items, timeline, ledger, refund, return and review, plus the restaurant, customer and partner briefs. |
| Duplicate cart lines | Merged; a merged quantity above 20 → 422 |
| Checkout errors | Unknown or deleted dish, dish from another restaurant, unavailable dish, closed restaurant → 400 with the dish named; nothing is written |
| Client prices | `OrderItemIn`/`OrderCreate` use `extra="ignore"`, so sent prices are dropped; totals always come from the DB |
| Owner status endpoint | Only ACCEPTED, PREPARING or READY; anything else → 409 with an explanation (D6) |
| Window boundary | `now <= cancellable_until` counts as inside the window (inclusive) |
| Locking | `lock_order_for()` uses `SELECT … FOR UPDATE OF orders` before every change (ignored on SQLite, effective on Postgres) |
| Partner list | Active partners only, least busy first, with an `active_deliveries` count |
| Partner history | DELIVERED **and** REFUNDED orders (the delivery happened in both cases) |
| Partner active-list filter | `status` must be ASSIGNED or OUT_FOR_DELIVERY, otherwise 422 |
| Reminder hook | `apply_transition` already marks the order's open `admin_reminder_logs` resolved (ready for P5) |
| Test speed | New `BCRYPT_ROUNDS` setting (default 12; tests use 4) — suite time 58s → 2s |

**Verification log**
- [x] `pytest`: 154 passed (64 new), no warnings
- [x] Live server (cancel window shortened to 3s): Accept during the window → 409; cancel in the window → refunded 510; cancel after the window → no refund; owner ACCEPTED → PREPARING → READY; owner CANCELLED → 409; partner list with load; assign; rider sees the customer's details; rider DELIVERED too early → 409; OUT_FOR_DELIVERY → DELIVERED; full 7-step timeline; cancelling a delivered order → 409; history and the customer list are correct
