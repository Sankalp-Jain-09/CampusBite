from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import OrderStatus, Review, User
from app.schemas.review import ReviewCreate
from app.services.order_service import lock_order_for

ALREADY_REVIEWED = "Order already reviewed"


def create_review(db: Session, customer: User, order_id: int, data: ReviewCreate) -> Review:
    """One review per order, only after successful delivery, only by the customer who ordered."""
    order = lock_order_for(db, customer, order_id)   # 404 if not the caller's order
    if order.status != OrderStatus.DELIVERED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Reviews are allowed only after delivery")
    if order.review is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=ALREADY_REVIEWED)

    review = Review(order_id=order.id, customer_id=customer.id, restaurant_id=order.restaurant_id,
                    rating=data.rating, comment=data.comment)
    db.add(review)
    try:
        db.commit()
    except IntegrityError:   # concurrent duplicate hits the UNIQUE(order_id) constraint
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=ALREADY_REVIEWED)
    return review
