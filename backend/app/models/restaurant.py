from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.menu_item import MenuItem
    from app.models.order import Order
    from app.models.review import Review
    from app.models.user import User


class Restaurant(TimestampMixin, Base):
    __tablename__ = "restaurants"

    id: Mapped[int] = mapped_column(primary_key=True)
    # UNIQUE: one restaurant per owner (D3)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    cuisine: Mapped[str] = mapped_column(String(100), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    image_crop_x: Mapped[float] = mapped_column(default=0.5, nullable=False)
    image_crop_y: Mapped[float] = mapped_column(default=0.5, nullable=False)
    is_open: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    owner: Mapped["User"] = relationship(back_populates="restaurant")
    menu_items: Mapped[List["MenuItem"]] = relationship(back_populates="restaurant")
    orders: Mapped[List["Order"]] = relationship(back_populates="restaurant")
    reviews: Mapped[List["Review"]] = relationship(back_populates="restaurant")

    def __repr__(self) -> str:
        return f"<Restaurant id={self.id} name={self.name!r}>"
