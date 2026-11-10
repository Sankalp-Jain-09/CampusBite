"""Helpers to drive orders through the API in tests."""
from datetime import timedelta

from app.db.types import utcnow
from app.models import Order

API = "/api/v1"


def order_payload(shop, **overrides):
    payload = {
        "restaurant_id": shop["restaurant"].id,
        "items": [
            {"menu_item_id": shop["dishes"]["paneer"].id, "quantity": 2},
            {"menu_item_id": shop["dishes"]["naan"].id, "quantity": 3},
        ],
        "delivery_address": "Hostel B, Room 214",
        "contact_phone": "9876543210",
        "notes": "Less spicy",
    }
    payload.update(overrides)
    return payload


def place(client, shop, **overrides):
    r = client.post(f"{API}/orders", json=order_payload(shop, **overrides), headers=shop["customer_h"])
    assert r.status_code == 201, r.text
    return r.json()


def end_cancel_window(shop, order_id):
    """Move the order's free-cancellation window into the past (instead of waiting 60s)."""
    db = shop["db"]
    order = db.get(Order, order_id)
    order.cancellable_until = utcnow() - timedelta(seconds=1)
    db.commit()


def owner_set(client, shop, order_id, status):
    return client.patch(f"{API}/owner/orders/{order_id}/status", json={"status": status}, headers=shop["owner_h"])


def advance_to_ready(client, shop, order_id):
    end_cancel_window(shop, order_id)
    for status in ("ACCEPTED", "PREPARING", "READY"):
        r = owner_set(client, shop, order_id, status)
        assert r.status_code == 200, r.text


def assign(client, shop, order_id, partner_id=None):
    return client.post(f"{API}/owner/orders/{order_id}/assign",
                       json={"delivery_partner_id": partner_id or shop["partner"].id}, headers=shop["owner_h"])


def partner_set(client, shop, order_id, status, headers=None):
    return client.patch(f"{API}/delivery/orders/{order_id}/status", json={"status": status},
                        headers=headers or shop["partner_h"])


def deliver(client, shop, order_id):
    advance_to_ready(client, shop, order_id)
    assert assign(client, shop, order_id).status_code == 200
    assert partner_set(client, shop, order_id, "OUT_FOR_DELIVERY").status_code == 200
    assert partner_set(client, shop, order_id, "DELIVERED").status_code == 200
