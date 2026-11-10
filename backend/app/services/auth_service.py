import logging
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import DUMMY_PASSWORD_HASH, hash_password, verify_password
from app.models.enums import UserRole
from app.models.restaurant import Restaurant
from app.models.user import User
from app.schemas.auth import CustomerRegister, DeliveryPartnerRegister, OwnerRegister

logger = logging.getLogger(__name__)

EMAIL_TAKEN = "An account with this email already exists"
INVALID_CREDENTIALS = "Invalid email or password"


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.scalar(select(User).where(func.lower(User.email) == _normalize_email(email)))


def _ensure_email_free(db: Session, email: str) -> None:
    if get_user_by_email(db, email) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=EMAIL_TAKEN)


def _new_user(data, role: UserRole, **extra) -> User:
    return User(
        name=data.name,
        email=_normalize_email(data.email),
        phone=data.phone,
        password_hash=hash_password(data.password),
        role=role,
        **extra,
    )


def _commit(db: Session) -> None:
    """Commit; a race on the UNIQUE email constraint becomes a clean 409."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=EMAIL_TAKEN)


def register_customer(db: Session, data: CustomerRegister) -> User:
    _ensure_email_free(db, data.email)
    user = _new_user(data, UserRole.CUSTOMER, default_address=data.default_address)
    db.add(user)
    _commit(db)
    logger.info("Registered customer user_id=%s", user.id)
    return user


def register_owner(db: Session, data: OwnerRegister) -> User:
    """Create the owner and their restaurant in one transaction ("Partner with us")."""
    _ensure_email_free(db, data.email)
    user = _new_user(data, UserRole.RESTAURANT_OWNER)
    user.restaurant = Restaurant(
        name=data.restaurant.name,
        cuisine=data.restaurant.cuisine,
        address=data.restaurant.address,
        phone=data.restaurant.phone,
        description=data.restaurant.description,
    )
    db.add(user)
    _commit(db)
    logger.info("Registered restaurant owner user_id=%s restaurant_id=%s", user.id, user.restaurant.id)
    return user


def register_delivery_partner(db: Session, data: DeliveryPartnerRegister) -> User:
    _ensure_email_free(db, data.email)
    user = _new_user(
        data,
        UserRole.DELIVERY_PARTNER,
        vehicle_type=data.vehicle_type,
        vehicle_number=data.vehicle_number,
    )
    db.add(user)
    _commit(db)
    logger.info("Registered delivery partner user_id=%s", user.id)
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    """Return the user for valid credentials; otherwise raise the same 401 for any failure."""
    user = get_user_by_email(db, email)
    if user is None:
        verify_password(password, DUMMY_PASSWORD_HASH)  # equalise timing for unknown emails
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)
    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    return user
