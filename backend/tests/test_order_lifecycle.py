"""The full order lifecycle across customer, owner and delivery partner, and every invalid transition."""
import pytest
from sqlalchemy import select

from app.models import Order, OrderStatusHistory, UserRole

from tests.factories import make_user
from tests.order_helpers import (
    API,
    advance_to_ready,
    assign,
    deliver,
    end_cancel_window,
    owner_set,
    partner_set,
    place,
)


def test_happy_path_placed_to_delivered(client, shop):
    order = place(client, shop)
    oid = order["id"]
    end_cancel_window(shop, oid)

    for status in ("ACCEPTED", "PREPARING", "READY"):
        r = owner_set(client, shop, oid, status)
        assert r.status_code == 200 and r.json()["status"] == status

    r = assign(client, shop, oid)
    assert r.status_code == 200
    assert r.json()["status"] == "ASSIGNED"
    assert r.json()["delivery_partner"]["id"] == shop["partner"].id

    # Delivery partner sees it with the customer's delivery details
    active = client.get(f"{API}/delivery/orders", headers=shop["partner_h"]).json()
    assert [o["id"] for o in active["items"]] == [oid]
    detail = client.get(f"{API}/delivery/orders/{oid}", headers=shop["partner_h"]).json()
    assert detail["customer"]["name"] == "Asha Customer"
    assert detail["delivery_address"] == "Hostel B, Room 214"
    assert detail["contact_phone"] == "9876543210"

    assert partner_set(client, shop, oid, "OUT_FOR_DELIVERY").json()["status"] == "OUT_FOR_DELIVERY"
    final = partner_set(client, shop, oid, "DELIVERED").json()
    assert final["status"] == "DELIVERED"
    assert [t["to_status"] for t in final["timeline"]] == [
        "PLACED", "ACCEPTED", "PREPARING", "READY", "ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED"]

    # Moves from active to history
    assert client.get(f"{API}/delivery/orders", headers=shop["partner_h"]).json()["total"] == 0
    history = client.get(f"{API}/delivery/history", headers=shop["partner_h"]).json()
    assert [o["id"] for o in history["items"]] == [oid]

    # Customer sees the final state
    mine = client.get(f"{API}/orders/{oid}", headers=shop["customer_h"]).json()
    assert mine["status"] == "DELIVERED" and mine["delivery_partner_name"] == "Meena Rider"


def test_history_rows_record_who_changed_what(client, shop):
    oid = place(client, shop)["id"]
    deliver(client, shop, oid)
    rows = shop["db"].scalars(select(OrderStatusHistory).where(OrderStatusHistory.order_id == oid)
                              .order_by(OrderStatusHistory.id)).all()
    by_status = {r.to_status.value: r.changed_by_user_id for r in rows}
    assert by_status["PLACED"] == shop["customer"].id
    assert by_status["ACCEPTED"] == shop["owner"].id
    assert by_status["ASSIGNED"] == shop["owner"].id
    assert by_status["DELIVERED"] == shop["partner"].id


@pytest.mark.parametrize("skip_to", ["PREPARING", "READY"])
def test_owner_cannot_skip_steps(client, shop, skip_to):
    oid = place(client, shop)["id"]
    end_cancel_window(shop, oid)
    r = owner_set(client, shop, oid, skip_to)
    assert r.status_code == 409
    assert r.json()["detail"] == f"Cannot move order from PLACED to {skip_to}"


@pytest.mark.parametrize("target", ["CANCELLED", "OUT_FOR_DELIVERY", "DELIVERED", "ASSIGNED", "REFUNDED", "PLACED"])
def test_owner_cannot_set_non_preparation_statuses(client, shop, target):
    oid = place(client, shop)["id"]
    end_cancel_window(shop, oid)
    r = owner_set(client, shop, oid, target)
    assert r.status_code == 409


def test_owner_cannot_go_backwards(client, shop):
    oid = place(client, shop)["id"]
    advance_to_ready(client, shop, oid)
    assert owner_set(client, shop, oid, "PREPARING").status_code == 409
    assert owner_set(client, shop, oid, "ACCEPTED").status_code == 409


def test_assign_requires_ready(client, shop):
    oid = place(client, shop)["id"]
    end_cancel_window(shop, oid)
    owner_set(client, shop, oid, "ACCEPTED")
    r = assign(client, shop, oid)
    assert r.status_code == 409 and "READY" in r.json()["detail"]


def test_assign_requires_an_active_delivery_partner(client, shop):
    oid = place(client, shop)["id"]
    advance_to_ready(client, shop, oid)
    customer = shop["customer"]
    inactive = make_user(shop["db"], role=UserRole.DELIVERY_PARTNER, is_active=False)
    for bad_id in (customer.id, inactive.id, 99999):
        assert assign(client, shop, oid, partner_id=bad_id).status_code == 400
    assert shop["db"].get(Order, oid).delivery_partner_id is None


def test_cannot_assign_twice(client, shop):
    oid = place(client, shop)["id"]
    advance_to_ready(client, shop, oid)
    assert assign(client, shop, oid).status_code == 200
    assert assign(client, shop, oid).status_code == 409


def test_partner_cannot_skip_out_for_delivery(client, shop):
    oid = place(client, shop)["id"]
    advance_to_ready(client, shop, oid)
    assign(client, shop, oid)
    r = partner_set(client, shop, oid, "DELIVERED")
    assert r.status_code == 409


@pytest.mark.parametrize("target", ["CANCELLED", "READY", "ACCEPTED", "REFUNDED"])
def test_partner_can_only_set_delivery_statuses(client, shop, target):
    oid = place(client, shop)["id"]
    advance_to_ready(client, shop, oid)
    assign(client, shop, oid)
    assert partner_set(client, shop, oid, target).status_code == 409


def test_delivered_order_cannot_be_cancelled_or_changed(client, shop):
    oid = place(client, shop)["id"]
    deliver(client, shop, oid)
    assert client.post(f"{API}/orders/{oid}/cancel", headers=shop["customer_h"]).status_code == 409
    assert owner_set(client, shop, oid, "READY").status_code == 409
    assert partner_set(client, shop, oid, "OUT_FOR_DELIVERY").status_code == 409


def test_owner_orders_list_with_filters(client, shop):
    a = place(client, shop)["id"]
    b = place(client, shop)["id"]
    end_cancel_window(shop, a)
    owner_set(client, shop, a, "ACCEPTED")

    all_orders = client.get(f"{API}/owner/orders", headers=shop["owner_h"]).json()
    assert all_orders["total"] == 2
    row_b = next(o for o in all_orders["items"] if o["id"] == b)
    assert row_b["in_cancel_window"] is True and row_b["customer_name"] == "Asha Customer"

    accepted = client.get(f"{API}/owner/orders", params={"status": "ACCEPTED"}, headers=shop["owner_h"]).json()
    assert [o["id"] for o in accepted["items"]] == [a]


def test_delivery_partners_list_shows_load(client, shop):
    db = shop["db"]
    idle = make_user(db, role=UserRole.DELIVERY_PARTNER, name="Zed Idle")
    make_user(db, role=UserRole.DELIVERY_PARTNER, name="Off Duty", is_active=False)
    oid = place(client, shop)["id"]
    advance_to_ready(client, shop, oid)
    assign(client, shop, oid)

    partners = client.get(f"{API}/owner/delivery-partners", headers=shop["owner_h"]).json()
    loads = {p["name"]: p["active_deliveries"] for p in partners}
    assert loads == {"Zed Idle": 0, "Meena Rider": 1}       # inactive partner is not listed
    assert partners[0]["id"] == idle.id                      # least busy first


def test_delivery_status_filter_validation(client, shop):
    r = client.get(f"{API}/delivery/orders", params={"status": "DELIVERED"}, headers=shop["partner_h"])
    assert r.status_code == 422


def test_scope_filter_splits_active_and_past(client, shop):
    active = place(client, shop)["id"]
    cancelled = place(client, shop)["id"]
    client.post(f"{API}/orders/{cancelled}/cancel", headers=shop["customer_h"])
    delivered = place(client, shop)["id"]
    deliver(client, shop, delivered)

    def ids(path, headers, **params):
        return {o["id"] for o in client.get(f"{API}{path}", params=params, headers=headers).json()["items"]}

    assert ids("/orders/me", shop["customer_h"], scope="active") == {active}
    assert ids("/orders/me", shop["customer_h"], scope="past") == {cancelled, delivered}
    assert ids("/owner/orders", shop["owner_h"], scope="active") == {active}
    assert ids("/owner/orders", shop["owner_h"], scope="past", status="DELIVERED") == {delivered}
    assert client.get(f"{API}/orders/me", params={"scope": "soon"}, headers=shop["customer_h"]).status_code == 422


def test_delivery_list_rows_include_delivery_details(client, shop):
    oid = place(client, shop)["id"]
    advance_to_ready(client, shop, oid)
    assign(client, shop, oid)
    row = client.get(f"{API}/delivery/orders", headers=shop["partner_h"]).json()["items"][0]
    assert row["delivery_address"] == "Hostel B, Room 214"
    assert row["contact_phone"] == "9876543210"
    assert row["restaurant_address"] == shop["restaurant"].address
