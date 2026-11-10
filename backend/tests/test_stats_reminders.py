"""P5: owner statistics (SQL aggregates) and the stale-order reminder background task."""
import asyncio
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.db.types import utcnow
from app.models import AdminReminderLog, Order, OrderStatus
from app.services import reminder_service
from app.workers.reminder_worker import ReminderWorker

from tests.conftest import TestingSessionLocal
from tests.factories import auth_headers, make_owner_with_restaurant, make_user
from tests.order_helpers import API, advance_to_ready, deliver, end_cancel_window, owner_set, place


def _stats(client, shop, **params):
    r = client.get(f"{API}/owner/stats", params=params, headers=shop["owner_h"])
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- Stats ----------------

def test_stats_for_empty_restaurant(client, shop):
    s = _stats(client, shop)
    assert s["total_orders"] == 0 and s["gross_revenue"] == 0.0 and s["average_order_value"] == 0.0
    assert s["avg_rating"] is None and s["top_items"] == []
    assert set(s["orders_by_status"]) == {st.value for st in OrderStatus}


def test_stats_numbers(client, shop):
    paneer, naan = shop["dishes"]["paneer"].id, shop["dishes"]["naan"].id
    # Order A: delivered, 510 (2 paneer + 3 naan), reviewed 4★, returned and refunded
    a = place(client, shop)["id"]
    deliver(client, shop, a)
    client.post(f"{API}/orders/{a}/review", json={"rating": 4}, headers=shop["customer_h"])
    rid = client.post(f"{API}/orders/{a}/return", json={"reason": "Food arrived cold, sorry"},
                      headers=shop["customer_h"]).json()["id"]
    client.post(f"{API}/owner/returns/{rid}/approve", headers=shop["owner_h"])
    # Order B: delivered, 1 paneer → 180 + 30 = 210
    b = place(client, shop, items=[{"menu_item_id": paneer, "quantity": 1}])["id"]
    deliver(client, shop, b)
    client.post(f"{API}/orders/{b}/review", json={"rating": 5}, headers=shop["customer_h"])
    # Order C: preparing, 4 naan → 160 + 30 = 190
    c = place(client, shop, items=[{"menu_item_id": naan, "quantity": 4}])["id"]
    end_cancel_window(shop, c)
    owner_set(client, shop, c, "ACCEPTED")
    owner_set(client, shop, c, "PREPARING")
    # Order D: cancelled in the free window (excluded from revenue)
    d = place(client, shop, items=[{"menu_item_id": paneer, "quantity": 10}])["id"]
    client.post(f"{API}/orders/{d}/cancel", headers=shop["customer_h"])
    # Order E: return requested, not yet decided → pending return
    e = place(client, shop, items=[{"menu_item_id": naan, "quantity": 1}])["id"]
    deliver(client, shop, e)
    client.post(f"{API}/orders/{e}/return", json={"reason": "Wrong item delivered"}, headers=shop["customer_h"])

    s = _stats(client, shop)
    assert s["total_orders"] == 5
    assert s["orders_today"] == 5
    by = s["orders_by_status"]
    assert (by["REFUNDED"], by["DELIVERED"], by["PREPARING"], by["CANCELLED"], by["PLACED"]) == (1, 2, 1, 1, 0)
    # Gross = charges on non-cancelled orders: 510 + 210 + 190 + 70 = 980; refunds = 510 (return on A)
    assert s["gross_revenue"] == 980.0
    assert s["refunds_total"] == 510.0
    assert s["net_revenue"] == 470.0
    assert s["average_order_value"] == 245.0          # 980 / 4 non-cancelled orders
    assert s["avg_rating"] == 4.5 and s["review_count"] == 2
    assert s["pending_returns"] == 1
    # Top items exclude the cancelled order's 10 paneer: naan 3+4+1 = 8, paneer 2+1 = 3
    assert [(t["name"], t["quantity"]) for t in s["top_items"]] == [("Butter Naan", 8), ("Paneer Tikka", 3)]
    assert s["top_items"][0]["revenue"] == 320.0


def test_stats_date_range(client, shop):
    oid = place(client, shop)["id"]
    order = shop["db"].get(Order, oid)
    order.created_at = utcnow() - timedelta(days=10)
    shop["db"].commit()
    place(client, shop)

    today = utcnow().date()
    assert _stats(client, shop)["total_orders"] == 2
    recent = _stats(client, shop, date_from=str(today), date_to=str(today))
    assert recent["total_orders"] == 1 and recent["gross_revenue"] == 510.0
    assert sum(recent["orders_by_status"].values()) == 1      # raw SQL path honours the range too
    old = _stats(client, shop, date_to=str(today - timedelta(days=5)))
    assert old["total_orders"] == 1
    bad = client.get(f"{API}/owner/stats", params={"date_from": str(today), "date_to": str(today - timedelta(days=1))},
                     headers=shop["owner_h"])
    assert bad.status_code == 422


def test_stats_only_include_own_restaurant(client, shop):
    place(client, shop)
    other = make_owner_with_restaurant(shop["db"])
    s = client.get(f"{API}/owner/stats", headers=auth_headers(other)).json()
    assert s["total_orders"] == 0


def test_stats_owner_only(client, shop):
    assert client.get(f"{API}/owner/stats", headers=shop["customer_h"]).status_code == 403
    assert client.get(f"{API}/owner/stats", headers=shop["partner_h"]).status_code == 403


# ---------------- Reminders ----------------

def _make_stale(shop, order_id, minutes=16):
    order = shop["db"].get(Order, order_id)
    order.status_updated_at = utcnow() - timedelta(minutes=minutes)
    order.cancellable_until = utcnow() - timedelta(minutes=minutes - 1)
    shop["db"].commit()


def _reminders(shop):
    return shop["db"].scalars(select(AdminReminderLog).order_by(AdminReminderLog.id)).all()


def test_stale_placed_order_gets_one_reminder(client, shop):
    oid = place(client, shop)["id"]
    _make_stale(shop, oid)
    assert reminder_service.scan(shop["db"]) == 1
    assert reminder_service.scan(shop["db"]) == 0       # no duplicates on rescan
    rows = _reminders(shop)
    assert len(rows) == 1
    assert rows[0].order_status_at_reminder == OrderStatus.PLACED
    assert rows[0].minutes_pending == 16
    assert rows[0].message == f"Order #{oid} has been PLACED for 16 minutes without an update."


def test_fresh_orders_get_no_reminder(client, shop):
    oid = place(client, shop)["id"]
    _make_stale(shop, oid, minutes=14)
    assert reminder_service.scan(shop["db"]) == 0


def test_stale_accepted_order_gets_reminder_but_preparing_does_not(client, shop):
    accepted = place(client, shop)["id"]
    preparing = place(client, shop)["id"]
    for oid in (accepted, preparing):
        end_cancel_window(shop, oid)
        owner_set(client, shop, oid, "ACCEPTED")
    owner_set(client, shop, preparing, "PREPARING")
    _make_stale(shop, accepted)
    _make_stale(shop, preparing)
    reminder_service.scan(shop["db"])
    assert [r.order_id for r in _reminders(shop)] == [accepted]


def test_status_change_resolves_reminder_then_new_status_can_remind_again(client, shop):
    oid = place(client, shop)["id"]
    _make_stale(shop, oid)
    reminder_service.scan(shop["db"])
    assert owner_set(client, shop, oid, "ACCEPTED").status_code == 200
    shop["db"].expire_all()
    first = _reminders(shop)[0]
    assert first.is_resolved is True and first.resolved_at is not None

    _make_stale(shop, oid)
    assert reminder_service.scan(shop["db"]) == 1
    second = _reminders(shop)[1]
    assert second.order_status_at_reminder == OrderStatus.ACCEPTED and second.is_resolved is False


def test_cancel_window_orders_are_skipped(client, shop):
    oid = place(client, shop)["id"]
    order = shop["db"].get(Order, oid)
    order.status_updated_at = utcnow() - timedelta(minutes=20)   # old, but window still open
    shop["db"].commit()
    assert reminder_service.scan(shop["db"]) == 0


def test_owner_lists_and_acknowledges_reminders(client, shop):
    oid = place(client, shop)["id"]
    _make_stale(shop, oid)
    reminder_service.scan(shop["db"])

    page = client.get(f"{API}/owner/reminders", headers=shop["owner_h"]).json()
    assert page["total"] == 1 and page["items"][0]["order_id"] == oid
    rid = page["items"][0]["id"]
    assert _stats(client, shop)["open_reminders"] == 1

    r = client.patch(f"{API}/owner/reminders/{rid}/acknowledge", headers=shop["owner_h"])
    assert r.status_code == 200 and r.json()["is_resolved"] is True
    assert client.get(f"{API}/owner/reminders", headers=shop["owner_h"]).json()["total"] == 0
    assert client.get(f"{API}/owner/reminders", params={"resolved": "true"},
                      headers=shop["owner_h"]).json()["total"] == 1


def test_listing_reminders_triggers_background_scan(client, shop):
    oid = place(client, shop)["id"]
    _make_stale(shop, oid)
    # First call queues a scan as a FastAPI background task (it runs after the response).
    client.get(f"{API}/owner/reminders", headers=shop["owner_h"])
    page = client.get(f"{API}/owner/reminders", headers=shop["owner_h"]).json()
    assert page["total"] == 1


def test_owners_only_see_their_own_reminders(client, shop):
    oid = place(client, shop)["id"]
    _make_stale(shop, oid)
    reminder_service.scan(shop["db"])
    other = auth_headers(make_owner_with_restaurant(shop["db"]))
    assert client.get(f"{API}/owner/reminders", headers=other).json()["total"] == 0
    rid = _reminders(shop)[0].id
    assert client.patch(f"{API}/owner/reminders/{rid}/acknowledge", headers=other).status_code == 404
    assert client.get(f"{API}/owner/reminders", headers=shop["customer_h"]).status_code == 403


def test_worker_runs_scans_and_stops_cleanly(shop, monkeypatch):
    calls = []
    monkeypatch.setattr(reminder_service, "scan_with_factory", lambda factory: calls.append(factory) or 0)

    async def run():
        worker = ReminderWorker(TestingSessionLocal, interval_seconds=0.01)
        worker.start()
        await asyncio.sleep(0.08)
        await worker.stop()
        return worker.runs

    runs = asyncio.run(run())
    assert runs >= 2 and len(calls) == runs


def test_worker_survives_a_failing_scan(shop, monkeypatch):
    def boom(factory):
        raise RuntimeError("db down")
    monkeypatch.setattr(reminder_service, "scan_with_factory", boom)

    async def run():
        worker = ReminderWorker(TestingSessionLocal, interval_seconds=0.01)
        worker.start()
        await asyncio.sleep(0.05)
        await worker.stop()
        return worker._task.done()

    assert asyncio.run(run()) is True


def test_scan_with_factory_creates_reminders_in_its_own_session(client, shop):
    oid = place(client, shop)["id"]
    _make_stale(shop, oid)
    assert reminder_service.scan_with_factory(TestingSessionLocal) == 1
    shop["db"].expire_all()
    assert len(_reminders(shop)) == 1
