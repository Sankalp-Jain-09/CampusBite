import os

# Test settings must be in place before the app (and its settings) are imported.
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("BCRYPT_ROUNDS", "4")  # fast hashing in tests
os.environ.setdefault("REMINDER_WORKER_ENABLED", "false")  # no periodic thread in tests

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: E402,F401  (register all models)
from app.db.base import Base  # noqa: E402
from app.db.session import enable_sqlite_foreign_keys, get_db, get_session_factory  # noqa: E402
from app.main import app  # noqa: E402

# One in-memory SQLite database shared by the test and the app (StaticPool = single connection).
test_engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
enable_sqlite_foreign_keys(test_engine)
TestingSessionLocal = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)


@pytest.fixture
def db_session():
    """Fresh schema for every test."""
    Base.metadata.create_all(test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(test_engine)


@pytest.fixture
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_session_factory] = lambda: TestingSessionLocal
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def shop(db_session):
    """One restaurant with a small menu, plus a customer and a delivery partner (all with auth headers)."""
    from app.models import UserRole
    from tests.factories import auth_headers, make_menu_item, make_owner_with_restaurant, make_user

    db = db_session
    owner = make_owner_with_restaurant(db, name="Ravi Owner")
    restaurant = owner.restaurant
    customer = make_user(db, name="Asha Customer")
    partner = make_user(db, role=UserRole.DELIVERY_PARTNER, name="Meena Rider")
    dishes = {
        "paneer": make_menu_item(db, restaurant, name="Paneer Tikka", price="180.00"),
        "naan": make_menu_item(db, restaurant, name="Butter Naan", price="40.00"),
        "lassi": make_menu_item(db, restaurant, name="Sweet Lassi", price="70.00", is_available=False),
    }
    return {
        "db": db, "owner": owner, "restaurant": restaurant, "customer": customer, "partner": partner,
        "dishes": dishes,
        "owner_h": auth_headers(owner), "customer_h": auth_headers(customer), "partner_h": auth_headers(partner),
    }
