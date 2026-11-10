from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime
from app.models.enums import OrderStatus, enum_column
from app.models.mixins import CreatedAtMixin

if TYPE_CHECKING:
    from app.models.order import Order
    from app.models.restaurant import Restaurant


class AdminReminderLog(CreatedAtMixin, Base):
    """Reminder for an order left in PLACED/ACCEPTED too long (created by the background task, P5)."""

    __tablename__ = "admin_reminder_logs"
    __table_args__ = (Index("ix_admin_reminder_logs_restaurant_resolved", "restaurant_id", "is_resolved"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), nullable=False)
    order_status_at_reminder: Mapped[OrderStatus] = mapped_column(enum_column(OrderStatus), nullable=False)
    message: Mapped[str] = mapped_column(String(255), nullable=False)
    minutes_pending: Mapped[int] = mapped_column(Integer, nullable=False)
    is_resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    order: Mapped["Order"] = relationship(back_populates="reminders")
    restaurant: Mapped["Restaurant"] = relationship()
