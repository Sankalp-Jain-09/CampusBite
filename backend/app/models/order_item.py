from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import CreatedAtMixin

if TYPE_CHECKING:
    from app.models.menu_item import MenuItem
    from app.models.order import Order


class OrderItem(CreatedAtMixin, Base):
    __tablename__ = "order_items"
    __table_args__ = (CheckConstraint("quantity BETWEEN 1 AND 20", name="quantity_range"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    menu_item_id: Mapped[int] = mapped_column(ForeignKey("menu_items.id"), nullable=False)
    # Snapshots, so order history stays correct if the menu changes (D12)
    item_name: Mapped[str] = mapped_column(String(150), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    order: Mapped["Order"] = relationship(back_populates="items")
    menu_item: Mapped["MenuItem"] = relationship()
