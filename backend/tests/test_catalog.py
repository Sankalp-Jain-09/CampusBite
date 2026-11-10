"""Public browsing: restaurants, menu search/filters/sorts, categories, reviews (no login needed)."""
import pytest

from tests.factories import make_menu_item, make_owner_with_restaurant, make_review, make_user

API = "/api/v1"


@pytest.fixture
def catalog(db_session):
    db = db_session
    curry_owner = make_owner_with_restaurant(db)
    pizza_owner = make_owner_with_restaurant(db)
    curry, pizza = curry_owner.restaurant, pizza_owner.restaurant
    curry.name, curry.cuisine = "Campus Curry House", "North Indian"
    pizza.name, pizza.cuisine = "Byte Pizza", "Italian"
    db.commit()

    dishes = {
        "paneer": make_menu_item(db, curry, name="Paneer Tikka", price="180.00", category="Starters"),
        "butter": make_menu_item(db, curry, name="Butter Chicken", price="260.00", category="Mains", is_veg=False),
        "dal": make_menu_item(db, curry, name="Dal Makhani", price="150.00", category="Mains"),
        "naan": make_menu_item(db, curry, name="Butter Naan", price="40.00", category="Breads"),
        "lassi": make_menu_item(db, curry, name="Sweet Lassi", price="70.00", category="Drinks",
                                is_available=False),
        "old": make_menu_item(db, curry, name="Old Paneer Roll", price="90.00", category="Starters",
                              is_deleted=True),
        "margherita": make_menu_item(db, pizza, name="Margherita", price="220.00"),
    }
    return {"db": db, "curry": curry, "pizza": pizza, "dishes": dishes}


def _names(response):
    return [item["name"] for item in response.json()["items"]]


# ---------------- Restaurants ----------------

def test_list_restaurants_is_public_and_sorted_by_name(client, catalog):
    r = client.get(f"{API}/restaurants")
    assert r.status_code == 200
    assert _names(r) == ["Byte Pizza", "Campus Curry House"]
    assert r.json()["total"] == 2


def test_restaurant_search_matches_name_or_cuisine(client, catalog):
    assert _names(client.get(f"{API}/restaurants", params={"search": "curry"})) == ["Campus Curry House"]
    assert _names(client.get(f"{API}/restaurants", params={"search": "ITAL"})) == ["Byte Pizza"]


def test_restaurant_cuisine_filter(client, catalog):
    assert _names(client.get(f"{API}/restaurants", params={"cuisine": "north indian"})) == ["Campus Curry House"]


def test_search_wildcards_are_treated_literally(client, catalog):
    assert client.get(f"{API}/restaurants", params={"search": "%"}).json()["total"] == 0
    assert client.get(f"{API}/restaurants", params={"search": "_"}).json()["total"] == 0


def test_restaurant_rating_aggregate(client, catalog):
    db, curry = catalog["db"], catalog["curry"]
    customer = make_user(db)
    make_review(db, customer, curry, rating=5, comment="Great")
    make_review(db, customer, curry, rating=4)

    by_name = {i["name"]: i for i in client.get(f"{API}/restaurants").json()["items"]}
    assert by_name["Campus Curry House"]["avg_rating"] == 4.5
    assert by_name["Campus Curry House"]["review_count"] == 2
    assert by_name["Byte Pizza"]["avg_rating"] is None
    assert by_name["Byte Pizza"]["review_count"] == 0

    detail = client.get(f"{API}/restaurants/{curry.id}").json()
    assert detail["avg_rating"] == 4.5 and detail["review_count"] == 2
    assert "owner_id" not in detail


def test_restaurant_detail_404(client, catalog):
    assert client.get(f"{API}/restaurants/9999").status_code == 404


def test_restaurant_pagination(client, db_session):
    for _ in range(7):
        make_owner_with_restaurant(db_session)
    page1 = client.get(f"{API}/restaurants", params={"page": 1, "page_size": 3}).json()
    page3 = client.get(f"{API}/restaurants", params={"page": 3, "page_size": 3}).json()
    assert (page1["total"], page1["pages"], len(page1["items"])) == (7, 3, 3)
    assert len(page3["items"]) == 1
    assert client.get(f"{API}/restaurants", params={"page_size": 51}).status_code == 422
    assert client.get(f"{API}/restaurants", params={"page": 0}).status_code == 422


# ---------------- Menu ----------------

def test_menu_hides_unavailable_and_deleted_dishes(client, catalog):
    names = _names(client.get(f"{API}/restaurants/{catalog['curry'].id}/menu"))
    assert names == ["Butter Chicken", "Butter Naan", "Dal Makhani", "Paneer Tikka"]
    assert "Sweet Lassi" not in names and "Old Paneer Roll" not in names


def test_menu_name_search_is_case_insensitive_and_partial(client, catalog):
    url = f"{API}/restaurants/{catalog['curry'].id}/menu"
    assert _names(client.get(url, params={"search": "BUTTER"})) == ["Butter Chicken", "Butter Naan"]
    assert _names(client.get(url, params={"search": "neer"})) == ["Paneer Tikka"]


def test_menu_price_range(client, catalog):
    url = f"{API}/restaurants/{catalog['curry'].id}/menu"
    r = client.get(url, params={"min_price": 100, "max_price": 200})
    assert _names(r) == ["Dal Makhani", "Paneer Tikka"]
    assert all(100 <= i["price"] <= 200 for i in r.json()["items"])
    assert _names(client.get(url, params={"min_price": 180, "max_price": 180})) == ["Paneer Tikka"]


def test_menu_min_price_above_max_price_is_422(client, catalog):
    r = client.get(f"{API}/restaurants/{catalog['curry'].id}/menu", params={"min_price": 300, "max_price": 100})
    assert r.status_code == 422


def test_menu_category_and_veg_filters(client, catalog):
    url = f"{API}/restaurants/{catalog['curry'].id}/menu"
    assert _names(client.get(url, params={"category": "mains"})) == ["Butter Chicken", "Dal Makhani"]
    assert _names(client.get(url, params={"veg": "false"})) == ["Butter Chicken"]
    assert "Butter Chicken" not in _names(client.get(url, params={"veg": "true"}))


@pytest.mark.parametrize(
    "sort,expected",
    [
        ("price_asc", ["Butter Naan", "Dal Makhani", "Paneer Tikka", "Butter Chicken"]),
        ("price_desc", ["Butter Chicken", "Paneer Tikka", "Dal Makhani", "Butter Naan"]),
        ("name", ["Butter Chicken", "Butter Naan", "Dal Makhani", "Paneer Tikka"]),
    ],
)
def test_menu_sorts(client, catalog, sort, expected):
    assert _names(client.get(f"{API}/restaurants/{catalog['curry'].id}/menu", params={"sort": sort})) == expected


def test_menu_invalid_sort_is_422(client, catalog):
    assert client.get(f"{API}/restaurants/{catalog['curry'].id}/menu", params={"sort": "cheap"}).status_code == 422


def test_menu_pagination(client, catalog):
    url = f"{API}/restaurants/{catalog['curry'].id}/menu"
    page2 = client.get(url, params={"page": 2, "page_size": 3, "sort": "price_asc"}).json()
    assert page2["total"] == 4 and page2["pages"] == 2
    assert [i["name"] for i in page2["items"]] == ["Butter Chicken"]


def test_menu_price_is_a_json_number(client, catalog):
    item = client.get(f"{API}/restaurants/{catalog['curry'].id}/menu", params={"search": "paneer"}).json()["items"][0]
    assert item["price"] == 180.0 and isinstance(item["price"], float)


def test_menu_for_unknown_restaurant_is_404(client, catalog):
    assert client.get(f"{API}/restaurants/9999/menu").status_code == 404


def test_categories_list_only_visible_dishes(client, catalog):
    r = client.get(f"{API}/restaurants/{catalog['curry'].id}/categories")
    assert r.json() == ["Breads", "Mains", "Starters"]  # Drinks only has an unavailable dish


def test_menu_item_detail(client, catalog):
    dishes = catalog["dishes"]
    assert client.get(f"{API}/menu-items/{dishes['paneer'].id}").json()["name"] == "Paneer Tikka"
    # Unavailable dishes can still be viewed (shown as unavailable); deleted ones cannot.
    assert client.get(f"{API}/menu-items/{dishes['lassi'].id}").json()["is_available"] is False
    assert client.get(f"{API}/menu-items/{dishes['old'].id}").status_code == 404


# ---------------- Reviews ----------------

def test_reviews_newest_first_with_first_name_only(client, catalog):
    db, curry = catalog["db"], catalog["curry"]
    customer = make_user(db, name="Asha Rao")
    make_review(db, customer, curry, rating=3, comment="Okay")
    make_review(db, customer, curry, rating=5, comment="Loved it")

    r = client.get(f"{API}/restaurants/{curry.id}/reviews")
    assert r.status_code == 200
    items = r.json()["items"]
    assert [i["comment"] for i in items] == ["Loved it", "Okay"]
    assert items[0]["reviewer_name"] == "Asha"
    assert "customer_id" not in items[0]


def test_reviews_for_unknown_restaurant_is_404(client, catalog):
    assert client.get(f"{API}/restaurants/9999/reviews").status_code == 404
