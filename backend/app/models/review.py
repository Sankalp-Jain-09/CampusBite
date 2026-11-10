from typing import TYPE_CHECKING, Optional

from sqlalchemy import CheckConstraint, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import CreatedAtMixin

if TYPE_CHECKING:
    from app.models.order import Order
    from app.models.restaurant import Restaurant
    from app.models.user import User


class Review(CreatedAtMixin, Base):
    __tablename__ = "reviews"
    __table_args__ = (CheckConstraint("rating BETWEEN 1 AND 5", name="rating_range"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # UNIQUE: one review per delivered order
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False, unique=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), nullable=False, index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text)

    order: Mapped["Order"] = relationship(back_populates="review")
    customer: Mapped["User"] = relationship()
    restaurant: Mapped["Restaurant"] = relationship(back_populates="reviews")
