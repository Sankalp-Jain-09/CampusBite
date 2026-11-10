from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.auth import (
    CustomerRegister,
    DeliveryPartnerRegister,
    LoginRequest,
    OwnerRegister,
    TokenResponse,
)
from app.schemas.user import UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])

_REGISTER_ERRORS = {409: {"description": "Email already registered"}, 422: {"description": "Validation error"}}


def _token_response(user: User) -> TokenResponse:
    token = create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Customer signup",
    responses=_REGISTER_ERRORS,
)
def register_customer(data: CustomerRegister, db: DbSession):
    """Create a **customer** account. Any `role` sent in the body is ignored."""
    return _token_response(auth_service.register_customer(db, data))


@router.post(
    "/register/restaurant-owner",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary='Restaurant owner signup ("Partner with us")',
    responses=_REGISTER_ERRORS,
)
def register_restaurant_owner(data: OwnerRegister, db: DbSession):
    """Create a **restaurant owner** and their restaurant in one transaction."""
    return _token_response(auth_service.register_owner(db, data))


@router.post(
    "/register/delivery-partner",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary='Delivery partner signup ("Ride with us")',
    responses=_REGISTER_ERRORS,
)
def register_delivery_partner(data: DeliveryPartnerRegister, db: DbSession):
    """Create a **delivery partner** account with vehicle details."""
    return _token_response(auth_service.register_delivery_partner(db, data))


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Log in (all roles)",
    responses={401: {"description": "Invalid email or password"}, 403: {"description": "Account disabled"}},
)
def login(data: LoginRequest, db: DbSession):
    """Shared login for every role. The response includes the user's role for frontend redirects."""
    return _token_response(auth_service.authenticate(db, data.email, data.password))


@router.get("/me", response_model=UserOut, summary="Current user profile")
def me(user: CurrentUser):
    return user
