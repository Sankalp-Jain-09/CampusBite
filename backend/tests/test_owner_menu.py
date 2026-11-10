"""Owner restaurant profile and menu management, including ownership and role checks."""
import pytest

from app.models import MenuItem, UserRole

from tests.factories import auth_headers, make_menu_item, make_owner_with_restaurant, make_user

API = "/api/v1"
NEW_DISH = {"name": "Veg Biryani", "category": "Mains", "price": 199.5, "is_veg": True, "description": "Fragrant rice"}


@pytest.fixture
def owners(db_session):
    a = make_owner_with_restaurant(db_session)
    b = make_owner_with_restaurant(db_session)
    return {
        "db": db_session,
        "a": a, "a_headers": auth_headers(a),
        "b": b, "b_headers": auth_headers(b),
        "b_dish": make_menu_item(db_session, b.restaurant, name="B's Secret Dish"),
    }


# ---------------- Restaurant profile ----------------

def test_owner_gets_own_restaurant(client, owners):
    r = client.get(f"{API}/owner/restaurant", headers=owners["a_headers"])
    assert r.status_code == 200
    assert r.json()["id"] == owners["a"].restaurant.id
    assert r.json()["owner_id"] == owners["a"].id


def test_owner_updates_only_sent_fields(client, owners):
    before = client.get(f"{API}/owner/restaurant", headers=owners["a_headers"]).json()
    r = client.put(f"{API}/owner/restaurant", headers=owners["a_headers"],
                   json={"is_open": False, "description": "Closed for Diwali"})
    assert r.status_code == 200
    body = r.json()
    assert body["is_open"] is False and body["description"] == "Closed for Diwali"
    assert body["name"] == before["name"] and body["address"] == before["address"]


@pytest.mark.parametrize(
    "payload",
    [{"name": None}, {"phone": "12"}, {"image_url": "not-a-url"}, {"owner_id": 999}, {"name": "X"}],
)
def test_restaurant_update_validation(client, owners, payload):
    assert client.put(f"{API}/owner/restaurant", headers=owners["a_headers"], json=payload).status_code == 422


# ---------------- Menu CRUD ----------------

def test_create_dish(client, owners):
    r = client.post(f"{API}/owner/menu-items", headers=owners["a_headers"], json=NEW_DISH)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["restaurant_id"] == owners["a"].restaurant.id
    assert body["price"] == 199.5 and body["is_available"] is True


def test_create_dish_rejects_unknown_fields(client, owners):
    """Unknown fields such as restaurant_id are rejected, so a dish can't be created for another restaurant."""
    payload = {**NEW_DISH, "restaurant_id": owners["b"].restaurant.id}
    assert client.post(f"{API}/owner/menu-items", headers=owners["a_headers"], json=payload).status_code == 422


@pytest.mark.parametrize("price", [0, -10, 12.345, "abc"])
def test_create_dish_rejects_bad_price(client, owners, price):
    r = client.post(f"{API}/owner/menu-items", headers=owners["a_headers"], json={**NEW_DISH, "price": price})
    assert r.status_code == 422


def test_create_dish_requires_name(client, owners):
    payload = {k: v for k, v in NEW_DISH.items() if k != "name"}
    assert client.post(f"{API}/owner/menu-items", headers=owners["a_headers"], json=payload).status_code == 422


def test_owner_menu_includes_unavailable_but_not_deleted(client, owners):
    db, restaurant = owners["db"], owners["a"].restaurant
    make_menu_item(db, restaurant, name="Visible")
    make_menu_item(db, restaurant, name="Sold Out", is_available=False)
    make_menu_item(db, restaurant, name="Gone", is_deleted=True)

    names = [i["name"] for i in client.get(f"{API}/owner/menu-items", headers=owners["a_headers"]).json()["items"]]
    assert sorted(names) == ["Sold Out", "Visible"]

    only_unavailable = client.get(f"{API}/owner/menu-items", headers=owners["a_headers"],
                                  params={"available": "false"}).json()["items"]
    assert [i["name"] for i in only_unavailable] == ["Sold Out"]


def test_owner_menu_only_shows_own_dishes(client, owners):
    items = client.get(f"{API}/owner/menu-items", headers=owners["a_headers"]).json()["items"]
    assert all(i["restaurant_id"] == owners["a"].restaurant.id for i in items)
    assert "B's Secret Dish" not in [i["name"] for i in items]


def test_update_dish_partial(client, owners):
    dish = make_menu_item(owners["db"], owners["a"].restaurant, name="Masala Dosa", price="90.00")
    r = client.put(f"{API}/owner/menu-items/{dish.id}", headers=owners["a_headers"], json={"price": 110})
    assert r.status_code == 200
    assert r.json()["price"] == 110.0 and r.json()["name"] == "Masala Dosa"


def test_update_dish_rejects_null_for_required_field(client, owners):
    dish = make_menu_item(owners["db"], owners["a"].restaurant)
    r = client.put(f"{API}/owner/menu-items/{dish.id}", headers=owners["a_headers"], json={"price": None})
    assert r.status_code == 422


def test_toggle_availability_hides_and_shows_dish_publicly(client, owners):
    restaurant = owners["a"].restaurant
    dish = make_menu_item(owners["db"], restaurant, name="Chole Bhature")
    public_menu = f"{API}/restaurants/{restaurant.id}/menu"

    r = client.patch(f"{API}/owner/menu-items/{dish.id}/availability", headers=owners["a_headers"],
                     json={"is_available": False})
    assert r.status_code == 200 and r.json()["is_available"] is False
    assert "Chole Bhature" not in [i["name"] for i in client.get(public_menu).json()["items"]]

    client.patch(f"{API}/owner/menu-items/{dish.id}/availability", headers=owners["a_headers"],
                 json={"is_available": True})
    assert "Chole Bhature" in [i["name"] for i in client.get(public_menu).json()["items"]]


def test_delete_is_soft(client, owners):
    db = owners["db"]
    dish = make_menu_item(db, owners["a"].restaurant, name="Old Special")
    r = client.delete(f"{API}/owner/menu-items/{dish.id}", headers=owners["a_headers"])
    assert r.status_code == 204 and r.content == b""

    db.expire_all()
    assert db.get(MenuItem, dish.id).is_deleted is True  # row kept for order history
    assert client.get(f"{API}/menu-items/{dish.id}").status_code == 404
    # Already deleted -> 404 for every owner action
    assert client.delete(f"{API}/owner/menu-items/{dish.id}", headers=owners["a_headers"]).status_code == 404
    assert client.put(f"{API}/owner/menu-items/{dish.id}", headers=owners["a_headers"],
                      json={"price": 50}).status_code == 404


# ---------------- Ownership and roles ----------------

@pytest.mark.parametrize(
    "method,suffix,body",
    [
        ("put", "", {"price": 1}),
        ("patch", "/availability", {"is_available": False}),
        ("delete", "", None),
    ],
)
def test_owner_cannot_touch_another_owners_dish(client, owners, method, suffix, body):
    url = f"{API}/owner/menu-items/{owners['b_dish'].id}{suffix}"
    kwargs = {"headers": owners["a_headers"]}
    if body is not None:
        kwargs["json"] = body
    r = getattr(client, method)(url, **kwargs)
    assert r.status_code == 404
    db = owners["db"]
    db.expire_all()
    dish = db.get(MenuItem, owners["b_dish"].id)
    assert dish.is_deleted is False and dish.is_available is True and float(dish.price) == 100.0


@pytest.mark.parametrize("role", [UserRole.CUSTOMER, UserRole.DELIVERY_PARTNER])
def test_other_roles_get_403_on_owner_endpoints(client, db_session, role):
    headers = auth_headers(make_user(db_session, role=role))
    assert client.get(f"{API}/owner/menu-items", headers=headers).status_code == 403
    assert client.post(f"{API}/owner/menu-items", headers=headers, json=NEW_DISH).status_code == 403
    assert client.get(f"{API}/owner/restaurant", headers=headers).status_code == 403


def test_owner_endpoints_need_a_token(client, owners):
    assert client.get(f"{API}/owner/menu-items").status_code == 401
    assert client.post(f"{API}/owner/menu-items", json=NEW_DISH).status_code == 401
