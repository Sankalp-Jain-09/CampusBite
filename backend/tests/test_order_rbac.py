"""Cross-tenant and role checks on order endpoints: other people's orders are always 404."""
import pytest

from app.models import UserRole

from tests.factories import auth_headers, make_menu_item, make_owner_with_restaurant, make_user
from tests.order_helpers import API, advance_to_ready, assign, end_cancel_window, owner_set, partner_set, place


@pytest.fixture
def others(shop):
    db = shop["db"]
    other_owner = make_owner_with_restaurant(db)
    make_menu_item(db, other_owner.restaurant)
    return {
        "customer_h": auth_headers(make_user(db)),
        "owner_h": auth_headers(other_owner),
        "partner": make_user(db, role=UserRole.DELIVERY_PARTNER),
    }


def test_order_detail_visible_to_the_three_parties(client, shop):
    oid = place(client, shop)["id"]
    advance_to_ready(client, shop, oid)
    assign(client, shop, oid)
    for headers in (shop["customer_h"], shop["owner_h"], shop["partner_h"]):
        assert client.get(f"{API}/orders/{oid}", headers=headers).status_code == 200


def test_other_customer_cannot_see_or_cancel(client, shop, others):
    oid = place(client, shop)["id"]
    assert client.get(f"{API}/orders/{oid}", headers=others["customer_h"]).status_code == 404
    assert client.post(f"{API}/orders/{oid}/cancel", headers=others["customer_h"]).status_code == 404
    assert client.get(f"{API}/orders/me", headers=others["customer_h"]).json()["total"] == 0


def test_other_owner_cannot_see_or_update(client, shop, others):
    oid = place(client, shop)["id"]
    end_cancel_window(shop, oid)
    assert client.get(f"{API}/orders/{oid}", headers=others["owner_h"]).status_code == 404
    r = client.patch(f"{API}/owner/orders/{oid}/status", json={"status": "ACCEPTED"}, headers=others["owner_h"])
    assert r.status_code == 404
    assert client.get(f"{API}/owner/orders", headers=others["owner_h"]).json()["total"] == 0
    assert owner_set(client, shop, oid, "ACCEPTED").status_code == 200   # the real owner still can


def test_other_owner_cannot_assign(client, shop, others):
    oid = place(client, shop)["id"]
    advance_to_ready(client, shop, oid)
    r = client.post(f"{API}/owner/orders/{oid}/assign", json={"delivery_partner_id": shop["partner"].id},
                    headers=others["owner_h"])
    assert r.status_code == 404


def test_unassigned_partner_cannot_see_or_update(client, shop, others):
    oid = place(client, shop)["id"]
    advance_to_ready(client, shop, oid)
    assign(client, shop, oid)
    other_h = auth_headers(others["partner"])
    assert client.get(f"{API}/delivery/orders/{oid}", headers=other_h).status_code == 404
    assert client.get(f"{API}/orders/{oid}", headers=other_h).status_code == 404
    assert partner_set(client, shop, oid, "OUT_FOR_DELIVERY", headers=other_h).status_code == 404
    assert client.get(f"{API}/delivery/orders", headers=other_h).json()["total"] == 0


def test_partner_cannot_see_orders_before_assignment(client, shop):
    oid = place(client, shop)["id"]
    assert client.get(f"{API}/delivery/orders/{oid}", headers=shop["partner_h"]).status_code == 404


@pytest.mark.parametrize(
    "method,path",
    [("get", "/owner/orders"), ("get", "/owner/delivery-partners"),
     ("patch", "/owner/orders/1/status"), ("post", "/owner/orders/1/assign")],
)
def test_owner_order_endpoints_reject_other_roles(client, shop, method, path):
    for headers in (shop["customer_h"], shop["partner_h"]):
        kwargs = {"headers": headers}
        if method != "get":
            kwargs["json"] = {"status": "ACCEPTED", "delivery_partner_id": 1}
        assert getattr(client, method)(f"{API}{path}", **kwargs).status_code == 403


@pytest.mark.parametrize("path", ["/delivery/orders", "/delivery/history", "/delivery/orders/1"])
def test_delivery_endpoints_reject_other_roles(client, shop, path):
    assert client.get(f"{API}{path}", headers=shop["customer_h"]).status_code == 403
    assert client.get(f"{API}{path}", headers=shop["owner_h"]).status_code == 403
    assert client.get(f"{API}{path}").status_code == 401


def test_customer_endpoints_reject_other_roles(client, shop):
    assert client.get(f"{API}/orders/me", headers=shop["owner_h"]).status_code == 403
    assert client.get(f"{API}/orders/me", headers=shop["partner_h"]).status_code == 403
