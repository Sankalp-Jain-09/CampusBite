"""The demo seed must be valid, idempotent and consistent with the app's own rules."""
from sqlalchemy import func, select

from app.models import AdminReminderLog, Order, OrderStatus, PaymentStatus, ReturnRequest, Review, User
from scripts.seed import PASSWORD, seed

from tests.conftest import TestingSessionLocal

API = "/api/v1"


def test_seed_creates_demo_world_and_is_idempotent(db_session):
    assert seed(TestingSessionLocal()) is True
    assert seed(TestingSessionLocal()) is False   # second run does nothing

    db = db_session
    assert db.scalar(select(func.count(User.id))) == 7   # 2 customers, 2 riders, 3 owners
    statuses = {s for (s,) in db.execute(select(Order.status)).all()}
    assert statuses == set(OrderStatus)              # every lifecycle status is represented
    assert db.scalar(select(func.count(AdminReminderLog.id))) == 2
    assert db.scalar(select(func.count(ReturnRequest.id))) == 2
    assert db.scalar(select(func.count(Review.id))) == 5
    refunded = db.scalars(select(Order).where(Order.payment_status == PaymentStatus.REFUNDED)).all()
    assert {o.status for o in refunded} == {OrderStatus.REFUNDED, OrderStatus.CANCELLED}


def test_seeded_accounts_work_through_the_api(client, db_session):
    seed(TestingSessionLocal())
    tokens = {}
    for email in ("demo.customer", "owner.curry", "rider.one"):
        r = client.post(f"{API}/auth/login", json={"email": f"{email}@campusbite.dev", "password": PASSWORD})
        assert r.status_code == 200, r.text
        tokens[email] = {"Authorization": f"Bearer {r.json()['access_token']}"}

    mine = client.get(f"{API}/orders/me", params={"page_size": 50}, headers=tokens["demo.customer"]).json()
    assert mine["total"] == 12
    stats = client.get(f"{API}/owner/stats", headers=tokens["owner.curry"]).json()
    assert stats["total_orders"] > 0 and stats["avg_rating"] is not None
    reminders = client.get(f"{API}/owner/reminders", headers=tokens["owner.curry"]).json()
    assert reminders["total"] == 1
    rider = client.get(f"{API}/delivery/orders", headers=tokens["rider.one"]).json()
    assert [o["status"] for o in rider["items"]] == ["OUT_FOR_DELIVERY"]
    # The seeded history is consistent with the state machine: the rider can finish the delivery.
    oid = rider["items"][0]["id"]
    r = client.patch(f"{API}/delivery/orders/{oid}/status", json={"status": "DELIVERED"}, headers=tokens["rider.one"])
    assert r.status_code == 200


def test_seeded_dishes_have_images_and_backfill_fills_missing(db_session):
    from app.models import MenuItem, Restaurant
    from scripts.seed import DISH_IMAGES, RESTAURANT_IMAGES

    seed(TestingSessionLocal())
    dishes = db_session.scalars(select(MenuItem)).all()
    restaurants = db_session.scalars(select(Restaurant)).all()
    assert all(r.image_url and r.image_url.startswith("https://") for r in [*dishes, *restaurants])
    assert len(DISH_IMAGES) == len(dishes) == 30
    assert len(RESTAURANT_IMAGES) == len(restaurants) == 3

    # A database seeded before images existed gets them on the next seed run.
    for row in [*dishes, *restaurants]:
        row.image_url = None
    db_session.commit()
    seed(TestingSessionLocal())
    db_session.expire_all()
    assert all(d.image_url == DISH_IMAGES[d.name] for d in db_session.scalars(select(MenuItem)))
    assert all(r.image_url == RESTAURANT_IMAGES[r.name] for r in db_session.scalars(select(Restaurant)))
