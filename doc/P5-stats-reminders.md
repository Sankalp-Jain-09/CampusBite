# P5 — Owner Stats & Reminder Background Task

**Status:** ✅ Done (202 tests passing; worker verified on a live server)
**Depends on:** P3, P4 · **Unblocks:** P9 (owner dashboard)

## Goal

Give restaurant owners a statistics summary, and run a background task that creates reminder records for orders stuck in PLACED or ACCEPTED for more than 15 minutes, shown on the owner dashboard.

## Scope

| In scope | Out of scope |
|---|---|
| `/owner/stats` with SQL aggregates | Charts (frontend, P9) |
| Periodic asyncio reminder worker started in the lifespan | Real-time push, WebSockets, email or SMS (not required) |
| On-demand scan via FastAPI `BackgroundTasks` | Multi-replica locking (single replica assumed) |
| List and acknowledge reminders | |

## Design

### Statistics — `GET /owner/stats?date_from=&date_to=`
Scoped to the caller's restaurant. If no dates are given, all time.

| Field | Calculation |
|---|---|
| `total_orders` | count of orders in range |
| `orders_today` | count with `created_at >= today 00:00` |
| `orders_by_status` | `{status: count}` via `group_by(Order.status)` |
| `gross_revenue` | sum of charge ledger amounts for orders **not CANCELLED** |
| `refunds_total` | sum of refund ledger amounts |
| `net_revenue` | gross − refunds (free-window refunds belong to cancelled orders, so exclude them from both, or compute consistently; documented in code) |
| `average_order_value` | gross revenue / non-cancelled order count |
| `avg_rating`, `review_count` | from reviews |
| `top_items` | top 5 by `sum(order_items.quantity)` with name and quantity (non-cancelled orders) |
| `pending_returns` | returns with status `requested` |
| `open_reminders` | unresolved reminder count |

All of these use SQLAlchemy aggregates (`func.count`, `func.sum`, `func.avg`, `group_by`), not Python loops. One query may use `text()` raw SQL to show the PRD's "SQL queries" requirement.

### Reminder scan (`app/services/reminder_service.py`)
```python
def scan(db, now=None) -> int:
    threshold = now - timedelta(minutes=settings.REMINDER_THRESHOLD_MINUTES)
    stale = select(Order).where(
        Order.status.in_([PLACED, ACCEPTED]),
        Order.status_updated_at < threshold,
        Order.cancellable_until < now,          # skip orders still in the free window (D14)
        ~exists().where(AdminReminderLog.order_id == Order.id,
                        AdminReminderLog.order_status_at_reminder == Order.status,
                        AdminReminderLog.is_resolved.is_(False)))
    for order in db.scalars(stale):
        minutes = int((now - order.status_updated_at).total_seconds() // 60)
        db.add(AdminReminderLog(order_id=order.id, restaurant_id=order.restaurant_id,
               order_status_at_reminder=order.status, minutes_pending=minutes,
               message=f"Order #{order.id} has been {order.status} for {minutes} minutes without an update."))
    db.commit()
    return created_count
```
- **Deduplication:** at most one unresolved reminder per `(order_id, status)`.
- **Resolution:** `apply_transition()` (P3) marks the order's open reminders resolved when its status changes.

### Periodic worker (`app/workers/reminder_worker.py`)
```python
async def reminder_loop(stop: asyncio.Event):
    while not stop.is_set():
        try:
            await run_in_threadpool(_scan_with_new_session)
        except Exception:
            logger.exception("Reminder scan failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=settings.REMINDER_CHECK_INTERVAL_SECONDS)
        except asyncio.TimeoutError:
            pass
```
Started in `main.py`'s `lifespan` (`asyncio.create_task`) and stopped on shutdown (set the event, await the task). It can be disabled in tests with a setting such as `REMINDER_WORKER_ENABLED=false`.

### Endpoints (`/owner/reminders`)
| Method | Path | Notes |
|---|---|---|
| GET | `/owner/reminders?resolved=false&page=` | Caller's restaurant, newest first. Also schedules `background_tasks.add_task(scan_with_new_session)` (FastAPI `BackgroundTasks`), so the next poll is fresh. |
| PATCH | `/owner/reminders/{id}/acknowledge` | Sets `is_resolved = true`, `resolved_at = now`; 404 if not the caller's |

## Files to create
```
app/services/stats_service.py, reminder_service.py
app/workers/reminder_worker.py
app/schemas/stats.py, reminder.py
app/api/v1/owner.py (stats + reminders routes)
app/main.py (start and stop the worker in lifespan)
app/core/config.py (+ REMINDER_WORKER_ENABLED)
tests/test_stats.py, tests/test_reminders.py
```

## Tasks
- [x] Stats service with aggregate queries + endpoint
- [x] Reminder scan with deduplication and free-window skip
- [x] Worker loop + lifespan start and stop + enable flag
- [x] Reminders list (with on-demand `BackgroundTasks` scan) + acknowledge
- [x] Confirm the P3 `apply_transition` resolves reminders

## Tests
- [x] Stats: create known orders, charges and refunds → exact expected totals; cancelled orders excluded from revenue; top items ordered correctly; another restaurant's data excluded
- [x] Reminders (freezegun): PLACED at T, scan at T+16m → 1 reminder; rescan → still 1; ACCEPTED stale → reminder; PREPARING stale → none; status change → reminder resolved; then going stale in the new status → new reminder
- [x] Owner sees only their own reminders; acknowledging another owner's reminder → 404
- [x] The worker starts and stops cleanly with the app (lifespan test)

## Done when
Stale orders automatically produce reminders within about one check interval, owners can list and acknowledge them, and `/owner/stats` returns correct numbers for test data.

## Implementation notes (as built)

**Files**
```
app/schemas/stats.py              RestaurantStats, TopItem, ReminderOut
app/services/stats_service.py     restaurant_stats (ORM aggregates + one raw SQL text() query for orders_by_status)
app/services/reminder_service.py  scan (idempotent), scan_with_factory, list_reminders, acknowledge
app/workers/reminder_worker.py    ReminderWorker: asyncio loop, scan via run_in_threadpool, clean stop
app/main.py                       lifespan starts/stops the worker (REMINDER_WORKER_ENABLED)
app/db/session.py                 + get_session_factory dependency (overridable in tests)
app/services/query_utils.py       + date_bounds
app/api/v1/owner.py               + GET /owner/stats, GET /owner/reminders (+ BackgroundTasks scan), PATCH /owner/reminders/{id}/acknowledge
tests/test_stats_reminders.py     16 tests
```

**Stats definitions**
| Field | Definition |
|---|---|
| `total_orders` | Orders placed in the range (all statuses) |
| `orders_today` | Orders placed since 00:00 UTC today (ignores the range) |
| `orders_by_status` | Every status with a count (0 included), via **raw SQL** `text()` with typed bind params |
| `gross_revenue` | Sum of CHARGE ledger entries for **non-cancelled** orders in the range |
| `refunds_total` | Sum of REFUND entries for non-cancelled orders (i.e. approved returns; free-window refunds belong to cancelled orders, so they are excluded from both sides) |
| `net_revenue` | gross − refunds |
| `average_order_value` | gross / number of non-cancelled orders |
| `avg_rating`, `review_count` | All-time for the restaurant |
| `top_items` | Top 5 dishes by quantity (non-cancelled orders in range), with revenue |
| `pending_returns`, `open_reminders` | Current counts |

**Reminder design**
- `scan()` selects PLACED/ACCEPTED orders with `status_updated_at < now − REMINDER_THRESHOLD_MINUTES`, skips orders still in the free cancel window, and skips orders that already have an unresolved reminder for the same status (`NOT EXISTS`). The message reads: "Order #12 has been PLACED for 22 minutes without an update."
- Status changes resolve open reminders (P3's `apply_transition`). A reminder for the new status can be created later.
- Two triggers:
  1. a **periodic asyncio worker** in the lifespan (every `REMINDER_CHECK_INTERVAL_SECONDS`, DB work in a threadpool, never dies on errors, stops cleanly)
  2. **FastAPI `BackgroundTasks`**: each `GET /owner/reminders` queues a scan to run after the response

  Background work uses its own session from `get_session_factory()`. Since FastAPI 0.106 the request session is closed before background tasks run.
- Tests set `REMINDER_WORKER_ENABLED=false` and override `get_session_factory`.

**Verification log**
- [x] `pytest`: 202 passed (16 new), no warnings
- [x] Live server (threshold 0, interval 2s): the worker created the reminder with no API calls; the stats show the order, revenue, top item and open reminder; Accept → the reminder is resolved; the worker logs start and stop cleanly
