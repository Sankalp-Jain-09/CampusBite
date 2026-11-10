"""P4: reviews after delivery, return requests, and owner approve/reject with refund records."""
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models import LedgerEntryType, Order, OrderStatus, PaymentLedger, PaymentStatus, ReturnRequest, Review

from tests.factories import auth_headers, make_owner_with_restaurant, make_user
from tests.order_helpers import API, advance_to_ready, deliver, place

REASON = "The curry was cold and the naan was missing."


@pytest.fixture
def delivered(client, shop):
    oid = place(client, shop)["id"]
    deliver(client, shop, oid)
    return oid


def _review(client, shop, oid, **body):
    return client.post(f"{API}/orders/{oid}/review", json={"rating": 5, "comment": "Great", **body},
                       headers=shop["customer_h"])


def _return(client, shop, oid, reason=REASON, headers=None):
    return client.post(f"{API}/orders/{oid}/return", json={"reason": reason}, headers=headers or shop["customer_h"])


# ---------------- Reviews ----------------

def test_review_after_delivery(client, shop, delivered):
    r = _review(client, shop, delivered, rating=4, comment="Tasty, a bit late")
    assert r.status_code == 201, r.text
    assert r.json()["rating"] == 4 and r.json()["restaurant_id"] == shop["restaurant"].id

    detail = client.get(f"{API}/orders/{delivered}", headers=shop["customer_h"]).json()
    assert detail["has_review"] is True and detail["review"]["rating"] == 4

    # Shows up publicly and in the restaurant's average rating
    public = client.get(f"{API}/restaurants/{shop['restaurant'].id}").json()
    assert public["avg_rating"] == 4.0 and public["review_count"] == 1
    reviews = client.get(f"{API}/restaurants/{shop['restaurant'].id}/reviews").json()["items"]
    assert reviews[0]["comment"] == "Tasty, a bit late" and reviews[0]["reviewer_name"] == "Asha"


def test_review_before_delivery_is_409(client, shop):
    oid = place(client, shop)["id"]
    r = _review(client, shop, oid)
    assert r.status_code == 409 and r.json()["detail"] == "Reviews are allowed only after delivery"
    advance_to_ready(client, shop, oid)
    assert _review(client, shop, oid).status_code == 409


def test_second_review_is_409(client, shop, delivered):
    assert _review(client, shop, delivered).status_code == 201
    r = _review(client, shop, delivered, rating=1)
    assert r.status_code == 409 and r.json()["detail"] == "Order already reviewed"
    assert len(shop["db"].scalars(select(Review)).all()) == 1


@pytest.mark.parametrize("body", [{"rating": 0}, {"rating": 6}, {"rating": "five"}, {"comment": "x" * 1001}])
def test_review_validation(client, shop, delivered, body):
    assert _review(client, shop, delivered, **body).status_code == 422


def test_review_requires_rating(client, shop, delivered):
    r = client.post(f"{API}/orders/{delivered}/review", json={"comment": "no rating"}, headers=shop["customer_h"])
    assert r.status_code == 422


def test_cannot_review_someone_elses_order(client, shop, delivered):
    other = auth_headers(make_user(shop["db"]))
    r = client.post(f"{API}/orders/{delivered}/review", json={"rating": 1}, headers=other)
    assert r.status_code == 404


def test_owner_and_partner_cannot_review(client, shop, delivered):
    for h in (shop["owner_h"], shop["partner_h"]):
        assert client.post(f"{API}/orders/{delivered}/review", json={"rating": 5}, headers=h).status_code == 403


# ---------------- Return requests ----------------

def test_request_return_after_delivery(client, shop, delivered):
    r = _return(client, shop, delivered)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "requested" and body["reason"] == REASON
    assert body["order_status"] == "DELIVERED" and body["payment_status"] == "mock_paid"

    detail = client.get(f"{API}/orders/{delivered}", headers=shop["customer_h"]).json()
    assert detail["return_status"] == "requested"
    assert detail["return_request"]["reason"] == REASON


@pytest.mark.parametrize("stage", ["PLACED", "READY", "CANCELLED"])
def test_return_before_delivery_is_409(client, shop, stage):
    oid = place(client, shop)["id"]
    if stage == "READY":
        advance_to_ready(client, shop, oid)
    if stage == "CANCELLED":
        client.post(f"{API}/orders/{oid}/cancel", headers=shop["customer_h"])
    r = _return(client, shop, oid)
    assert r.status_code == 409 and r.json()["detail"] == "Returns are allowed only after delivery"


@pytest.mark.parametrize("reason", ["", "too short", "   short   ", "x" * 501])
def test_return_reason_validation(client, shop, delivered, reason):
    assert _return(client, shop, delivered, reason=reason).status_code == 422


def test_return_requires_reason_field(client, shop, delivered):
    r = client.post(f"{API}/orders/{delivered}/return", json={}, headers=shop["customer_h"])
    assert r.status_code == 422


def test_only_one_return_per_order(client, shop, delivered):
    assert _return(client, shop, delivered).status_code == 201
    r = _return(client, shop, delivered, reason="Trying again with another reason")
    assert r.status_code == 409 and r.json()["detail"] == "A return request already exists for this order"


def test_cannot_return_someone_elses_order(client, shop, delivered):
    other = auth_headers(make_user(shop["db"]))
    assert _return(client, shop, delivered, headers=other).status_code == 404


# ---------------- Owner: list, approve, reject ----------------

def _return_id(client, shop, oid):
    return _return(client, shop, oid).json()["id"]


def test_owner_lists_returns_with_order_context(client, shop, delivered):
    rid = _return_id(client, shop, delivered)
    page = client.get(f"{API}/owner/returns", headers=shop["owner_h"]).json()
    assert page["total"] == 1
    item = page["items"][0]
    assert item["id"] == rid and item["customer_name"] == "Asha Customer"
    assert item["order_total"] == 510.0 and item["items_summary"] == "2× Paneer Tikka, 3× Butter Naan"

    assert client.get(f"{API}/owner/returns", params={"status": "approved"}, headers=shop["owner_h"]).json()["total"] == 0
    assert client.get(f"{API}/owner/returns", params={"status": "requested"}, headers=shop["owner_h"]).json()["total"] == 1


def test_approve_refunds_and_marks_order_refunded(client, shop, delivered):
    rid = _return_id(client, shop, delivered)
    r = client.post(f"{API}/owner/returns/{rid}/approve", headers=shop["owner_h"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "approved" and body["resolved_at"]
    assert body["order_status"] == "REFUNDED" and body["payment_status"] == "refunded"

    db = shop["db"]
    ledger = db.scalars(select(PaymentLedger).where(PaymentLedger.order_id == delivered)
                        .order_by(PaymentLedger.id)).all()
    assert [(e.entry_type, e.amount) for e in ledger] == [
        (LedgerEntryType.CHARGE, Decimal("510.00")), (LedgerEntryType.REFUND, Decimal("510.00"))]
    assert ledger[1].note == "return_approved"
    rr = db.scalar(select(ReturnRequest))
    assert rr.resolved_by == shop["owner"].id

    detail = client.get(f"{API}/orders/{delivered}", headers=shop["customer_h"]).json()
    assert detail["status"] == "REFUNDED" and detail["refund"]["amount"] == 510.0
    assert detail["timeline"][-1]["to_status"] == "REFUNDED"
    # The delivery partner still sees it in their history
    assert client.get(f"{API}/delivery/history", headers=shop["partner_h"]).json()["total"] == 1


def test_reject_keeps_order_and_payment(client, shop, delivered):
    rid = _return_id(client, shop, delivered)
    r = client.post(f"{API}/owner/returns/{rid}/reject", json={"owner_note": "Photos show the food was fine."},
                    headers=shop["owner_h"])
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "rejected" and body["owner_note"] == "Photos show the food was fine."
    assert body["order_status"] == "DELIVERED" and body["payment_status"] == "mock_paid"

    db = shop["db"]
    db.expire_all()
    order = db.get(Order, delivered)
    assert order.status == OrderStatus.DELIVERED and order.payment_status == PaymentStatus.MOCK_PAID
    refunds = db.scalars(select(PaymentLedger).where(PaymentLedger.entry_type == LedgerEntryType.REFUND)).all()
    assert refunds == []
    detail = client.get(f"{API}/orders/{delivered}", headers=shop["customer_h"]).json()
    assert detail["return_status"] == "rejected" and detail["return_request"]["owner_note"]


@pytest.mark.parametrize("body", [{}, {"owner_note": ""}, {"owner_note": "no"}])
def test_reject_requires_a_note(client, shop, delivered, body):
    rid = _return_id(client, shop, delivered)
    assert client.post(f"{API}/owner/returns/{rid}/reject", json=body, headers=shop["owner_h"]).status_code == 422


def test_cannot_resolve_twice(client, shop, delivered):
    rid = _return_id(client, shop, delivered)
    assert client.post(f"{API}/owner/returns/{rid}/approve", headers=shop["owner_h"]).status_code == 200
    again = client.post(f"{API}/owner/returns/{rid}/approve", headers=shop["owner_h"])
    assert again.status_code == 409 and again.json()["detail"] == "Return request already approved"
    reject = client.post(f"{API}/owner/returns/{rid}/reject", json={"owner_note": "Changed my mind"},
                         headers=shop["owner_h"])
    assert reject.status_code == 409
    refunds = shop["db"].scalars(select(PaymentLedger).where(PaymentLedger.entry_type == LedgerEntryType.REFUND)).all()
    assert len(refunds) == 1


def test_other_owner_cannot_see_or_resolve(client, shop, delivered):
    rid = _return_id(client, shop, delivered)
    other = auth_headers(make_owner_with_restaurant(shop["db"]))
    assert client.get(f"{API}/owner/returns", headers=other).json()["total"] == 0
    assert client.post(f"{API}/owner/returns/{rid}/approve", headers=other).status_code == 404
    assert client.post(f"{API}/owner/returns/{rid}/reject", json={"owner_note": "Not mine to judge"},
                       headers=other).status_code == 404


def test_customer_and_partner_cannot_use_owner_return_endpoints(client, shop, delivered):
    rid = _return_id(client, shop, delivered)
    for h in (shop["customer_h"], shop["partner_h"]):
        assert client.get(f"{API}/owner/returns", headers=h).status_code == 403
        assert client.post(f"{API}/owner/returns/{rid}/approve", headers=h).status_code == 403


def test_refunded_order_cannot_be_reviewed(client, shop, delivered):
    rid = _return_id(client, shop, delivered)
    client.post(f"{API}/owner/returns/{rid}/approve", headers=shop["owner_h"])
    assert _review(client, shop, delivered).status_code == 409


def test_unknown_return_is_404(client, shop):
    assert client.post(f"{API}/owner/returns/999/approve", headers=shop["owner_h"]).status_code == 404
