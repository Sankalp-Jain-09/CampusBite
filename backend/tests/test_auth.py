from datetime import timedelta

import bcrypt
import pytest
from fastapi import APIRouter, Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.deps import CurrentOwner, require_roles
from app.core.security import create_access_token
from app.db.session import get_db
from app.models import Restaurant, User, UserRole

from tests.factories import DEFAULT_PASSWORD, auth_headers, make_owner_with_restaurant, make_user

CUSTOMER = {
    "name": "Asha Rao",
    "email": "asha@example.com",
    "phone": "9876543210",
    "password": "Secret123",
    "default_address": "Hostel B, Room 214",
}
OWNER = {
    "name": "Ravi Kumar",
    "email": "ravi@example.com",
    "phone": "9876543211",
    "password": "Secret123",
    "restaurant": {
        "name": "Campus Curry House",
        "cuisine": "North Indian",
        "address": "Food Court, Block A",
        "phone": "9876500001",
        "description": "Home-style curries",
    },
}
PARTNER = {
    "name": "Meena S",
    "email": "meena@example.com",
    "phone": "9876543212",
    "password": "Secret123",
    "vehicle_type": "scooter",
    "vehicle_number": "ka01ab1234",
}


# ---------------- Registration ----------------

def test_register_customer_sets_customer_role(client, db_session):
    r = client.post("/api/v1/auth/register", json=CUSTOMER)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["token_type"] == "bearer" and body["access_token"]
    assert body["user"]["role"] == "customer"
    assert body["user"]["default_address"] == "Hostel B, Room 214"
    assert "password" not in str(body) and "password_hash" not in body["user"]


def test_injected_role_is_ignored_on_customer_signup(client, db_session):
    r = client.post("/api/v1/auth/register", json={**CUSTOMER, "role": "restaurant_owner"})
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "customer"
    user = db_session.scalar(select(User).where(User.email == CUSTOMER["email"]))
    assert user.role == UserRole.CUSTOMER


def test_register_owner_creates_linked_restaurant(client, db_session):
    r = client.post("/api/v1/auth/register/restaurant-owner", json=OWNER)
    assert r.status_code == 201, r.text
    assert r.json()["user"]["role"] == "restaurant_owner"

    owner = db_session.scalar(select(User).where(User.email == OWNER["email"]))
    restaurant = db_session.scalar(select(Restaurant).where(Restaurant.owner_id == owner.id))
    assert restaurant is not None
    assert restaurant.name == "Campus Curry House"
    assert restaurant.is_open is True


def test_owner_signup_with_invalid_restaurant_creates_nothing(client, db_session):
    bad = {**OWNER, "restaurant": {**OWNER["restaurant"], "phone": "abc"}}
    r = client.post("/api/v1/auth/register/restaurant-owner", json=bad)
    assert r.status_code == 422
    assert db_session.scalar(select(User).where(User.email == OWNER["email"])) is None


def test_register_delivery_partner(client):
    r = client.post("/api/v1/auth/register/delivery-partner", json=PARTNER)
    assert r.status_code == 201, r.text
    user = r.json()["user"]
    assert user["role"] == "delivery_partner"
    assert user["vehicle_type"] == "scooter"
    assert user["vehicle_number"] == "KA01AB1234"  # normalised to upper case


def test_delivery_partner_requires_vehicle_details(client):
    r = client.post("/api/v1/auth/register/delivery-partner",
                    json={k: v for k, v in PARTNER.items() if k != "vehicle_type"})
    assert r.status_code == 422


def test_duplicate_email_is_rejected_case_insensitively(client):
    assert client.post("/api/v1/auth/register", json=CUSTOMER).status_code == 201
    r = client.post("/api/v1/auth/register/delivery-partner",
                    json={**PARTNER, "email": CUSTOMER["email"].upper()})
    assert r.status_code == 409
    assert r.json()["detail"] == "An account with this email already exists"


def test_email_is_stored_lowercase(client, db_session):
    client.post("/api/v1/auth/register", json={**CUSTOMER, "email": "Asha.Rao@Example.COM"})
    assert db_session.scalar(select(User.email)) == "asha.rao@example.com"


@pytest.mark.parametrize(
    "field,value",
    [
        ("password", "short1"),          # < 8 chars
        ("password", "x" * 73),          # > 72 chars (bcrypt limit)
        ("email", "not-an-email"),
        ("phone", "12345"),
        ("name", " "),
    ],
)
def test_register_validation_errors(client, field, value):
    r = client.post("/api/v1/auth/register", json={**CUSTOMER, field: value})
    assert r.status_code == 422


def test_password_is_stored_hashed(client, db_session):
    client.post("/api/v1/auth/register", json=CUSTOMER)
    user = db_session.scalar(select(User).where(User.email == CUSTOMER["email"]))
    assert user.password_hash != CUSTOMER["password"]
    assert user.password_hash.startswith("$2")
    assert bcrypt.checkpw(CUSTOMER["password"].encode(), user.password_hash.encode())


# ---------------- Login ----------------

def test_login_success_returns_token_and_role(client, db_session):
    make_owner_with_restaurant(db_session, email="owner@example.com")
    r = client.post("/api/v1/auth/login", json={"email": "OWNER@example.com", "password": DEFAULT_PASSWORD})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "restaurant_owner"
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"})
    assert me.status_code == 200 and me.json()["email"] == "owner@example.com"


def test_wrong_password_and_unknown_email_get_same_401(client, db_session):
    make_user(db_session, email="c@example.com")
    wrong_pw = client.post("/api/v1/auth/login", json={"email": "c@example.com", "password": "WrongPass1"})
    unknown = client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "WrongPass1"})
    assert wrong_pw.status_code == unknown.status_code == 401
    assert wrong_pw.json() == unknown.json() == {"detail": "Invalid email or password"}


def test_inactive_user_cannot_log_in(client, db_session):
    make_user(db_session, email="off@example.com", is_active=False)
    r = client.post("/api/v1/auth/login", json={"email": "off@example.com", "password": DEFAULT_PASSWORD})
    assert r.status_code == 403


# ---------------- /auth/me and token handling ----------------

def test_me_returns_current_user(client, db_session):
    user = make_user(db_session, email="me@example.com")
    r = client.get("/api/v1/auth/me", headers=auth_headers(user))
    assert r.status_code == 200
    assert r.json()["id"] == user.id and r.json()["role"] == "customer"


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer not.a.jwt"}, {"Authorization": "Basic abc"}])
def test_me_rejects_missing_or_garbage_token(client, headers):
    r = client.get("/api/v1/auth/me", headers=headers)
    assert r.status_code == 401
    assert r.headers.get("WWW-Authenticate") == "Bearer"


def test_me_rejects_expired_token(client, db_session):
    user = make_user(db_session)
    token = create_access_token(user.id, user.role.value, expires_delta=timedelta(seconds=-1))
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid or expired token"


def test_me_rejects_token_signed_with_other_secret(client, db_session):
    import jwt
    user = make_user(db_session)
    forged = jwt.encode({"sub": str(user.id), "role": "restaurant_owner", "exp": 9999999999},
                        "attacker-secret", algorithm="HS256")
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_token_for_deactivated_user_stops_working(client, db_session):
    user = make_user(db_session)
    headers = auth_headers(user)
    user.is_active = False
    db_session.commit()
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


# ---------------- require_roles (RBAC) ----------------

@pytest.fixture
def rbac_client(db_session):
    """A tiny app with role-protected routes, sharing the test database."""
    router = APIRouter()

    @router.get("/owner-only")
    def owner_only(user: CurrentOwner):
        return {"id": user.id}

    @router.get("/staff-only")
    def staff_only(user: User = Depends(require_roles(UserRole.RESTAURANT_OWNER, UserRole.DELIVERY_PARTNER))):
        return {"role": user.role.value}

    test_app = FastAPI()
    test_app.include_router(router)
    test_app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(test_app)


def test_require_roles_allows_matching_role(rbac_client, db_session):
    owner = make_owner_with_restaurant(db_session)
    assert rbac_client.get("/owner-only", headers=auth_headers(owner)).status_code == 200


def test_require_roles_forbids_other_roles(rbac_client, db_session):
    customer = make_user(db_session)
    partner = make_user(db_session, role=UserRole.DELIVERY_PARTNER)
    r = rbac_client.get("/owner-only", headers=auth_headers(customer))
    assert r.status_code == 403 and r.json()["detail"] == "Insufficient permissions"
    assert rbac_client.get("/owner-only", headers=auth_headers(partner)).status_code == 403


def test_require_roles_accepts_any_of_several_roles(rbac_client, db_session):
    partner = make_user(db_session, role=UserRole.DELIVERY_PARTNER)
    customer = make_user(db_session)
    assert rbac_client.get("/staff-only", headers=auth_headers(partner)).json() == {"role": "delivery_partner"}
    assert rbac_client.get("/staff-only", headers=auth_headers(customer)).status_code == 403


def test_role_comes_from_database_not_token(rbac_client, db_session):
    """A token claiming 'restaurant_owner' for a customer account must not grant owner access."""
    customer = make_user(db_session)
    token = create_access_token(customer.id, "restaurant_owner")
    r = rbac_client.get("/owner-only", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


def test_require_roles_needs_authentication(rbac_client):
    assert rbac_client.get("/owner-only").status_code == 401
