"""Schema-level checks: constraints, relationships and the Alembic migration itself."""
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import IntegrityError

from app.db.base import Base
from app.db.types import utcnow
from app.models import (
    LedgerEntryType,
    MenuItem,
    Order,
    OrderItem,
    OrderStatus,
    PaymentLedger,
    PaymentStatus,
    Restaurant,
    ReturnRequest,
    Review,
    UserRole,
)

from tests.factories import make_owner_with_restaurant, make_user

BACKEND_DIR = Path(__file__).resolve().parents[1]
EXPECTED_TABLES = {
    "users", "restaurants", "menu_items", "orders", "order_items", "order_status_history",
    "reviews", "payment_ledger", "return_requests", "admin_reminder_logs",
}


def _order(db, customer, restaurant, **kw) -> Order:
    now = utcnow()
    order = Order(
        customer_id=customer.id, restaurant_id=restaurant.id,
        subtotal=Decimal("200.00"), delivery_fee=Decimal("30.00"), total_amount=Decimal("230.00"),
        delivery_address="Hostel B", contact_phone="9876543210",
        cancellable_until=now + timedelta(seconds=60), **kw,
    )
    db.add(order)
    db.commit()
    return order


@pytest.fixture
def world(db_session):
    owner = make_owner_with_restaurant(db_session)
    customer = make_user(db_session)
    dish = MenuItem(restaurant_id=owner.restaurant.id, name="Paneer Tikka", price=Decimal("180.00"))
    db_session.add(dish)
    db_session.commit()
    return {"db": db_session, "owner": owner, "restaurant": owner.restaurant, "customer": customer, "dish": dish}


def test_order_defaults_and_relationships(world):
    db, customer, restaurant, dish = world["db"], world["customer"], world["restaurant"], world["dish"]
    order = _order(db, customer, restaurant)
    order.items.append(OrderItem(menu_item_id=dish.id, item_name=dish.name, unit_price=dish.price,
                                 quantity=2, line_total=dish.price * 2))
    order.ledger_entries.append(PaymentLedger(entry_type=LedgerEntryType.CHARGE, amount=order.total_amount,
                                              transaction_ref="MOCK-1"))
    db.commit()
    db.expire_all()

    order = db.get(Order, order.id)
    assert order.status == OrderStatus.PLACED
    assert order.payment_status == PaymentStatus.PENDING
    assert order.customer.id == customer.id and order.restaurant.id == restaurant.id
    assert order.items[0].line_total == Decimal("360.00")
    assert order.ledger_entries[0].method == "dummy"
    assert customer.orders[0].id == order.id
    assert restaurant.orders[0].id == order.id
    # UTCDateTime gives timezone-aware values even on SQLite
    assert order.cancellable_until.tzinfo is not None and order.created_at.tzinfo is not None


def test_one_restaurant_per_owner(world):
    db, owner = world["db"], world["owner"]
    db.add(Restaurant(owner_id=owner.id, name="Second", cuisine="X", address="Y", phone="9876500009"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_menu_item_price_must_be_positive(world):
    db = world["db"]
    db.add(MenuItem(restaurant_id=world["restaurant"].id, name="Free", price=Decimal("0")))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_order_item_quantity_range(world):
    db, dish = world["db"], world["dish"]
    order = _order(db, world["customer"], world["restaurant"])
    db.add(OrderItem(order_id=order.id, menu_item_id=dish.id, item_name=dish.name,
                     unit_price=dish.price, quantity=21, line_total=dish.price * 21))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_one_review_and_one_return_per_order(world):
    db, customer, restaurant = world["db"], world["customer"], world["restaurant"]
    order = _order(db, customer, restaurant, status=OrderStatus.DELIVERED)

    db.add(Review(order_id=order.id, customer_id=customer.id, restaurant_id=restaurant.id, rating=5))
    db.commit()
    db.add(Review(order_id=order.id, customer_id=customer.id, restaurant_id=restaurant.id, rating=4))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    db.add(ReturnRequest(order_id=order.id, customer_id=customer.id, reason="Cold food"))
    db.commit()
    db.add(ReturnRequest(order_id=order.id, customer_id=customer.id, reason="Again"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_review_rating_range(world):
    db, customer, restaurant = world["db"], world["customer"], world["restaurant"]
    order = _order(db, customer, restaurant, status=OrderStatus.DELIVERED)
    db.add(Review(order_id=order.id, customer_id=customer.id, restaurant_id=restaurant.id, rating=6))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_delivery_partner_relationship(world):
    db = world["db"]
    partner = make_user(db, role=UserRole.DELIVERY_PARTNER)
    order = _order(db, world["customer"], world["restaurant"], delivery_partner_id=partner.id)
    db.expire_all()
    assert partner.deliveries[0].id == order.id
    assert db.get(Order, order.id).delivery_partner.id == partner.id


# ---------------- Alembic migration ----------------

def _alembic_config(connection) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.attributes["connection"] = connection
    cfg.attributes["configure_logger"] = False
    return cfg


def test_migration_upgrade_matches_models_and_downgrades(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'migrate.db'}")
    with engine.begin() as conn:
        command.upgrade(_alembic_config(conn), "head")

    with engine.connect() as conn:
        assert EXPECTED_TABLES <= set(inspect(conn).get_table_names())
        # The migration must produce exactly what the models describe.
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
        assert diff == [], f"Migration and models differ: {diff}"

    with engine.begin() as conn:
        command.downgrade(_alembic_config(conn), "base")
    with engine.connect() as conn:
        assert set(inspect(conn).get_table_names()) <= {"alembic_version"}
