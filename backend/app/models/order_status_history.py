from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow
from app.models.enums import OrderStatus, enum_column

if TYPE_CHECKING:
    from app.models.order import Order
    from app.models.user import User


class OrderStatusHistory(Base):
    """Audit trail of every status change; also powers the order timeline in the UI."""

    __tablename__ = "order_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[Optional[OrderStatus]] = mapped_column(enum_column(OrderStatus))
    to_status: Mapped[OrderStatus] = mapped_column(enum_column(OrderStatus), nullable=False)
    # Nullable for system-made changes
    changed_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    changed_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=utcnow)

    order: Mapped["Order"] = relationship(back_populates="status_history")
    changed_by: Mapped[Optional["User"]] = relationship()
