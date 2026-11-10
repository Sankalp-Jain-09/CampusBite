"""D14: 60-second free cancellation window (auto refund), and D5: no refund afterwards."""
from datetime import timedelta
from decimal import Decimal

from freezegun import freeze_time
from sqlalchemy import select

from app.db.types import utcnow
from app.models import LedgerEntryType, Order, PaymentLedger, PaymentStatus

from tests.order_helpers import API, owner_set, place


def _ledger(shop, order_id):
    return shop["db"].scalars(select(PaymentLedger).where(PaymentLedger.order_id == order_id)
                              .order_by(PaymentLedger.id)).all()


def test_cancel_within_window_refunds_automatically(client, shop):
    with freeze_time(utcnow()) as clock:
        oid = place(client, shop)["id"]
        clock.tick(30)
        r = client.post(f"{API}/orders/{oid}/cancel", headers=shop["customer_h"])

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "CANCELLED"
    assert body["payment_status"] == "refunded"
    assert body["refunded_amount"] == 510.0
    assert "refund" in body["message"].lower()

    entries = _ledger(shop, oid)
    assert [e.entry_type for e in entries] == [LedgerEntryType.CHARGE, LedgerEntryType.REFUND]
    assert entries[1].amount == Decimal("510.00") and entries[1].note == "free_cancellation_window"
    order = shop["db"].get(Order, oid)
    assert order.cancelled_at is not None

    detail = client.get(f"{API}/orders/{oid}", headers=shop["customer_h"]).json()
    assert detail["refund"]["amount"] == 510.0
    assert detail["refund"]["transaction_ref"].startswith("MOCK-REFUND-")
    assert detail["cancel_window_remaining_seconds"] == 0


def test_cancel_after_window_does_not_refund(client, shop):
    with freeze_time(utcnow()) as clock:
        oid = place(client, shop)["id"]
        clock.tick(61)
        r = client.post(f"{API}/orders/{oid}/cancel", headers=shop["customer_h"])

    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "CANCELLED"
    assert body["payment_status"] == "mock_paid"
    assert body["refunded_amount"] == 0.0
    assert [e.entry_type for e in _ledger(shop, oid)] == [LedgerEntryType.CHARGE]


def test_owner_accept_blocked_during_window_then_allowed(client, shop):
    with freeze_time(utcnow()) as clock:
        oid = place(client, shop)["id"]
        clock.tick(30)
        blocked = owner_set(client, shop, oid, "ACCEPTED")
        assert blocked.status_code == 409
        assert blocked.json()["detail"] == "Order is in the customer's free-cancellation window"

        row = client.get(f"{API}/owner/orders", headers=shop["owner_h"]).json()["items"][0]
        assert row["in_cancel_window"] is True and 29 <= row["cancel_window_remaining_seconds"] <= 30

        clock.tick(31)
        allowed = owner_set(client, shop, oid, "ACCEPTED")
        assert allowed.status_code == 200 and allowed.json()["status"] == "ACCEPTED"


def test_window_boundary_is_inclusive(client, shop):
    with freeze_time(utcnow()) as clock:
        oid = place(client, shop)["id"]
        order = shop["db"].get(Order, oid)
        clock.move_to(order.cancellable_until)
        r = client.post(f"{API}/orders/{oid}/cancel", headers=shop["customer_h"])
    assert r.json()["payment_status"] == "refunded"


def test_cannot_cancel_after_accept(client, shop):
    with freeze_time(utcnow()) as clock:
        oid = place(client, shop)["id"]
        clock.tick(61)
        owner_set(client, shop, oid, "ACCEPTED")
        r = client.post(f"{API}/orders/{oid}/cancel", headers=shop["customer_h"])
    assert r.status_code == 409
    assert r.json()["detail"] == "Order can no longer be cancelled"


def test_double_cancel_creates_only_one_refund(client, shop):
    oid = place(client, shop)["id"]
    first = client.post(f"{API}/orders/{oid}/cancel", headers=shop["customer_h"])
    second = client.post(f"{API}/orders/{oid}/cancel", headers=shop["customer_h"])
    assert first.status_code == 200 and second.status_code == 409
    refunds = [e for e in _ledger(shop, oid) if e.entry_type == LedgerEntryType.REFUND]
    assert len(refunds) == 1
    assert shop["db"].get(Order, oid).payment_status == PaymentStatus.REFUNDED


def test_only_the_customer_can_cancel(client, shop):
    oid = place(client, shop)["id"]
    assert client.post(f"{API}/orders/{oid}/cancel", headers=shop["owner_h"]).status_code == 403
    assert client.post(f"{API}/orders/{oid}/cancel", headers=shop["partner_h"]).status_code == 403


def test_remaining_seconds_counts_down(client, shop):
    with freeze_time(utcnow()) as clock:
        oid = place(client, shop)["id"]
        clock.tick(timedelta(seconds=45))
        detail = client.get(f"{API}/orders/{oid}", headers=shop["customer_h"]).json()
    assert detail["cancel_window_remaining_seconds"] == 15
