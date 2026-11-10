from typing import Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.models import Restaurant, Review, User
from app.schemas.common import PaginationParams, paginate
from app.schemas.restaurant import RestaurantPublic, RestaurantUpdate
from app.schemas.review import ReviewPublic
from app.services.query_utils import LIKE_ESCAPE, like_pattern

RESTAURANT_NOT_FOUND = "Restaurant not found"


def _rating_subquery():
    """Per-restaurant average rating and review count (SQL aggregate, grouped by restaurant)."""
    return (
        select(
            Review.restaurant_id.label("restaurant_id"),
            func.avg(Review.rating).label("avg_rating"),
            func.count(Review.id).label("review_count"),
        )
        .group_by(Review.restaurant_id)
        .subquery()
    )


def _restaurants_with_rating() -> Select:
    ratings = _rating_subquery()
    return select(Restaurant, ratings.c.avg_rating, ratings.c.review_count).outerjoin(
        ratings, ratings.c.restaurant_id == Restaurant.id
    )


def _to_public(row: Tuple[Restaurant, Optional[float], Optional[int]]) -> RestaurantPublic:
    restaurant, avg_rating, review_count = row
    return RestaurantPublic(
        id=restaurant.id,
        name=restaurant.name,
        cuisine=restaurant.cuisine,
        address=restaurant.address,
        phone=restaurant.phone,
        description=restaurant.description,
        image_url=restaurant.image_url,
        is_open=restaurant.is_open,
        avg_rating=round(float(avg_rating), 1) if avg_rating is not None else None,
        review_count=int(review_count or 0),
    )


def list_restaurants(
    db: Session, params: PaginationParams, search: Optional[str] = None, cuisine: Optional[str] = None
) -> dict:
    stmt = _restaurants_with_rating()
    if search:
        pattern = like_pattern(search)
        stmt = stmt.where(or_(
            Restaurant.name.ilike(pattern, escape=LIKE_ESCAPE),
            Restaurant.cuisine.ilike(pattern, escape=LIKE_ESCAPE),
        ))
    if cuisine:
        stmt = stmt.where(func.lower(Restaurant.cuisine) == cuisine.strip().lower())
    stmt = stmt.order_by(Restaurant.name, Restaurant.id)

    page = paginate(db, stmt, params, scalars=False)
    page["items"] = [_to_public(row) for row in page["items"]]
    return page


def get_restaurant_or_404(db: Session, restaurant_id: int) -> Restaurant:
    restaurant = db.get(Restaurant, restaurant_id)
    if restaurant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=RESTAURANT_NOT_FOUND)
    return restaurant


def get_restaurant_public(db: Session, restaurant_id: int) -> RestaurantPublic:
    row = db.execute(_restaurants_with_rating().where(Restaurant.id == restaurant_id)).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=RESTAURANT_NOT_FOUND)
    return _to_public(row)


def list_reviews(db: Session, restaurant_id: int, params: PaginationParams) -> dict:
    get_restaurant_or_404(db, restaurant_id)
    stmt = (
        select(Review, User.name)
        .join(User, User.id == Review.customer_id)
        .where(Review.restaurant_id == restaurant_id)
        .order_by(Review.created_at.desc(), Review.id.desc())
    )
    page = paginate(db, stmt, params, scalars=False)
    page["items"] = [
        ReviewPublic(
            id=review.id,
            rating=review.rating,
            comment=review.comment,
            reviewer_name=(name or "Customer").split()[0],
            created_at=review.created_at,
        )
        for review, name in page["items"]
    ]
    return page


# ---------------- Owner ----------------

def get_owner_restaurant(db: Session, owner: User) -> Restaurant:
    restaurant = db.scalar(select(Restaurant).where(Restaurant.owner_id == owner.id))
    if restaurant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="You do not have a restaurant yet")
    return restaurant


def update_owner_restaurant(db: Session, owner: User, data: RestaurantUpdate) -> Restaurant:
    restaurant = get_owner_restaurant(db, owner)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(restaurant, field, value)
    db.commit()
    return restaurant
