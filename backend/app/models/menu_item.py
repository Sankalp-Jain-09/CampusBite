from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.restaurant import Restaurant


class MenuItem(TimestampMixin, Base):
    __tablename__ = "menu_items"
    __table_args__ = (
        CheckConstraint("price > 0", name="price_positive"),
        Index("ix_menu_items_restaurant_flags", "restaurant_id", "is_deleted", "is_available"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="Main")
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_veg: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Soft delete so past orders keep resolving (D12)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    restaurant: Mapped["Restaurant"] = relationship(back_populates="menu_items")

    def __repr__(self) -> str:
        return f"<MenuItem id={self.id} name={self.name!r} price={self.price}>"
