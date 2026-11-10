"""Checkout: validation, server-side pricing, dummy payment and the order history list."""
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models import LedgerEntryType, Order, OrderStatusHistory, PaymentLedger, UserRole

from tests.factories import auth_headers, make_menu_item, make_owner_with_restaurant, make_user
from tests.order_helpers import API, order_payload, place


def test_place_order_computes_totals_from_db_prices(client, shop):
    body = place(client, shop)
    # 2 × 180 + 3 × 40 = 480, + 30 delivery fee
    assert body["subtotal"] == 480.0
    assert body["delivery_fee"] == 30.0
    assert body["total_amount"] == 510.0
    assert body["status"] == "PLACED"
    assert body["payment_status"] == "mock_paid"
    assert body["item_count"] == 5
    assert {i["item_name"]: i["line_total"] for i in body["items"]} == {"Paneer Tikka": 360.0, "Butter Naan": 120.0}
    assert body["restaurant"]["name"] == shop["restaurant"].name
    assert body["customer"]["id"] == shop["customer"].id


def test_place_order_writes_charge_ledger_and_history(client, shop):
    body = place(client, shop)
    db = shop["db"]
    ledger = db.scalars(select(PaymentLedger).where(PaymentLedger.order_id == body["id"])).all()
    assert len(ledger) == 1
    assert ledger[0].entry_type == LedgerEntryType.CHARGE
    assert ledger[0].amount == Decimal("510.00")
    assert ledger[0].transaction_ref.startswith("MOCK-")
    assert body["payments"][0]["entry_type"] == "charge"

    history = db.scalars(select(OrderStatusHistory).where(OrderStatusHistory.order_id == body["id"])).all()
    assert [(h.from_status, h.to_status.value) for h in history] == [(None, "PLACED")]
    assert body["timeline"][0]["to_status"] == "PLACED"


def test_place_order_starts_free_cancel_window(client, shop):
    body = place(client, shop)
    assert body["in_cancel_window"] is True
    assert 55 <= body["cancel_window_remaining_seconds"] <= 60


def test_client_sent_prices_are_ignored(client, shop):
    payload = order_payload(shop)
    payload["items"][0]["price"] = 1
    payload["items"][0]["unit_price"] = 1
    payload["total_amount"] = 1
    r = client.post(f"{API}/orders", json=payload, headers=shop["customer_h"])
    assert r.status_code == 201
    assert r.json()["total_amount"] == 510.0


def test_duplicate_lines_are_merged(client, shop):
    paneer = shop["dishes"]["paneer"].id
    body = place(client, shop, items=[{"menu_item_id": paneer, "quantity": 1},
                                      {"menu_item_id": paneer, "quantity": 2}])
    assert len(body["items"]) == 1 and body["items"][0]["quantity"] == 3


def test_merged_quantity_over_20_is_rejected(client, shop):
    paneer = shop["dishes"]["paneer"].id
    r = client.post(f"{API}/orders", headers=shop["customer_h"], json=order_payload(
        shop, items=[{"menu_item_id": paneer, "quantity": 15}, {"menu_item_id": paneer, "quantity": 10}]))
    assert r.status_code == 422


def test_unavailable_dish_is_rejected(client, shop):
    r = client.post(f"{API}/orders", headers=shop["customer_h"], json=order_payload(
        shop, items=[{"menu_item_id": shop["dishes"]["lassi"].id, "quantity": 1}]))
    assert r.status_code == 400
    assert "unavailable" in r.json()["detail"]


def test_deleted_or_unknown_dish_is_rejected(client, shop):
    deleted = make_menu_item(shop["db"], shop["restaurant"], name="Gone", is_deleted=True)
    for dish_id in (deleted.id, 99999):
        r = client.post(f"{API}/orders", headers=shop["customer_h"],
                        json=order_payload(shop, items=[{"menu_item_id": dish_id, "quantity": 1}]))
        assert r.status_code == 400


def test_dish_from_another_restaurant_is_rejected(client, shop):
    other = make_owner_with_restaurant(shop["db"])
    foreign = make_menu_item(shop["db"], other.restaurant, name="Foreign Pizza")
    r = client.post(f"{API}/orders", headers=shop["customer_h"], json=order_payload(
        shop, items=[{"menu_item_id": shop["dishes"]["paneer"].id, "quantity": 1},
                     {"menu_item_id": foreign.id, "quantity": 1}]))
    assert r.status_code == 400
    assert "not on this restaurant's menu" in r.json()["detail"]
    assert shop["db"].scalar(select(Order)) is None   # nothing was created


def test_closed_restaurant_is_rejected(client, shop):
    shop["restaurant"].is_open = False
    shop["db"].commit()
    r = client.post(f"{API}/orders", headers=shop["customer_h"], json=order_payload(shop))
    assert r.status_code == 400 and r.json()["detail"] == "Restaurant is closed"


@pytest.mark.parametrize(
    "overrides",
    [{"items": []}, {"contact_phone": "123"}, {"delivery_address": "x"},
     {"items": [{"menu_item_id": 1, "quantity": 0}]}, {"items": [{"menu_item_id": 1, "quantity": 21}]}],
)
def test_checkout_validation(client, shop, overrides):
    r = client.post(f"{API}/orders", headers=shop["customer_h"], json=order_payload(shop, **overrides))
    assert r.status_code == 422


def test_unknown_restaurant_is_404(client, shop):
    r = client.post(f"{API}/orders", headers=shop["customer_h"], json=order_payload(shop, restaurant_id=9999))
    assert r.status_code == 404


@pytest.mark.parametrize("role", [UserRole.RESTAURANT_OWNER, UserRole.DELIVERY_PARTNER])
def test_only_customers_can_order(client, shop, role):
    headers = shop["owner_h"] if role == UserRole.RESTAURANT_OWNER else shop["partner_h"]
    assert client.post(f"{API}/orders", headers=headers, json=order_payload(shop)).status_code == 403
    assert client.post(f"{API}/orders", json=order_payload(shop)).status_code == 401


def test_order_history_lists_only_my_orders_with_filters(client, shop):
    first = place(client, shop)
    second = place(client, shop)
    client.post(f"{API}/orders/{second['id']}/cancel", headers=shop["customer_h"])

    other_customer = make_user(shop["db"])
    client.post(f"{API}/orders", headers=auth_headers(other_customer), json=order_payload(shop))

    mine = client.get(f"{API}/orders/me", headers=shop["customer_h"]).json()
    assert mine["total"] == 2
    assert [o["id"] for o in mine["items"]] == [second["id"], first["id"]]   # newest first
    assert mine["items"][1]["items_summary"] == "2× Paneer Tikka, 3× Butter Naan"

    placed = client.get(f"{API}/orders/me", params={"status": "PLACED"}, headers=shop["customer_h"]).json()
    assert [o["id"] for o in placed["items"]] == [first["id"]]

    today = first["created_at"][:10]
    assert client.get(f"{API}/orders/me", params={"date_from": today, "date_to": today},
                      headers=shop["customer_h"]).json()["total"] == 2
    assert client.get(f"{API}/orders/me", params={"date_from": "2000-01-01", "date_to": "2000-01-02"},
                      headers=shop["customer_h"]).json()["total"] == 0
    assert client.get(f"{API}/orders/me", params={"date_from": "2030-01-02", "date_to": "2030-01-01"},
                      headers=shop["customer_h"]).status_code == 422


# ---------------- Price changed after the cart was filled (expected_subtotal) ----------------

def test_expected_subtotal_matching_places_the_order(client, shop):
    body = place(client, shop, expected_subtotal=480)
    assert body["total_amount"] == 510.0


def test_expected_subtotal_mismatch_is_refused_and_nothing_is_charged(client, shop):
    db = shop["db"]
    shop["dishes"]["naan"].price = Decimal("45.00")   # owner raised the price after the customer filled the cart
    db.commit()
    payload = order_payload(shop, expected_subtotal=480)   # what the customer saw: 2 × 180 + 3 × 40
    r = client.post(f"{API}/orders", json=payload, headers=shop["customer_h"])
    assert r.status_code == 409
    assert "Prices have changed" in r.json()["detail"]
    assert "495.00" in r.json()["detail"]                  # 2 × 180 + 3 × 45
    assert db.scalars(select(Order)).all() == []
    assert db.scalars(select(PaymentLedger)).all() == []
    # Paying again with the new subtotal works.
    assert place(client, shop, expected_subtotal="495.00")["total_amount"] == 525.0


def test_expected_subtotal_is_optional_and_validated(client, shop):
    assert place(client, shop)["subtotal"] == 480.0     # older clients that don't send it still work
    for bad in (-1, "abc", 10.999):
        r = client.post(f"{API}/orders", json=order_payload(shop, expected_subtotal=bad), headers=shop["customer_h"])
        assert r.status_code == 422, bad
