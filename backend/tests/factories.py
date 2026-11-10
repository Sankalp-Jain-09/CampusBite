"""Small helpers to create test data directly in the database."""
import itertools
from datetime import timedelta
from decimal import Decimal
from typing import Dict, Optional

from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password
from app.db.types import utcnow
from app.models import MenuItem, Order, OrderStatus, Restaurant, Review, User, UserRole, VehicleType

DEFAULT_PASSWORD = "Password123"
_seq = itertools.count(1)


def make_user(
    db: Session,
    role: UserRole = UserRole.CUSTOMER,
    email: Optional[str] = None,
    password: str = DEFAULT_PASSWORD,
    **extra,
) -> User:
    n = next(_seq)
    if role == UserRole.DELIVERY_PARTNER:
        extra.setdefault("vehicle_type", VehicleType.SCOOTER)
        extra.setdefault("vehicle_number", f"KA01AB{n:04d}")
    user = User(
        name=extra.pop("name", f"Test User {n}"),
        email=email or f"user{n}@example.com",
        phone=extra.pop("phone", "9876543210"),
        password_hash=hash_password(password),
        role=role,
        **extra,
    )
    db.add(user)
    db.commit()
    return user


def make_owner_with_restaurant(db: Session, **user_kwargs) -> User:
    owner = make_user(db, role=UserRole.RESTAURANT_OWNER, **user_kwargs)
    owner.restaurant = Restaurant(
        name=f"Restaurant of {owner.name}",
        cuisine="Indian",
        address="Campus Main Road",
        phone="9876500000",
    )
    db.commit()
    return owner


def auth_headers(user: User) -> Dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role.value)}"}


def make_menu_item(db: Session, restaurant: Restaurant, **kw) -> MenuItem:
    n = next(_seq)
    item = MenuItem(
        restaurant_id=restaurant.id,
        name=kw.pop("name", f"Dish {n}"),
        price=Decimal(str(kw.pop("price", "100.00"))),
        category=kw.pop("category", "Main"),
        **kw,
    )
    db.add(item)
    db.commit()
    return item


def make_order(db: Session, customer: User, restaurant: Restaurant, **kw) -> Order:
    order = Order(
        customer_id=customer.id,
        restaurant_id=restaurant.id,
        subtotal=Decimal("200.00"),
        delivery_fee=Decimal("30.00"),
        total_amount=Decimal("230.00"),
        delivery_address="Hostel B, Room 214",
        contact_phone="9876543210",
        cancellable_until=utcnow() + timedelta(seconds=60),
        **kw,
    )
    db.add(order)
    db.commit()
    return order


def make_review(db: Session, customer: User, restaurant: Restaurant, rating: int, comment: Optional[str] = None) -> Review:
    order = make_order(db, customer, restaurant, status=OrderStatus.DELIVERED)
    review = Review(order_id=order.id, customer_id=customer.id, restaurant_id=restaurant.id,
                    rating=rating, comment=comment)
    db.add(review)
    db.commit()
    return review
