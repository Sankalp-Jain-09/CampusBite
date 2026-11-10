from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow
from app.models.enums import OrderStatus, PaymentStatus, enum_column
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.admin_reminder_log import AdminReminderLog
    from app.models.order_item import OrderItem
    from app.models.order_status_history import OrderStatusHistory
    from app.models.payment_ledger import PaymentLedger
    from app.models.restaurant import Restaurant
    from app.models.return_request import ReturnRequest
    from app.models.review import Review
    from app.models.user import User


class Order(TimestampMixin, Base):
    __tablename__ = "orders"
    __table_args__ = (
        Index("ix_orders_restaurant_status_created", "restaurant_id", "status", "created_at"),
        Index("ix_orders_customer_created", "customer_id", "created_at"),
        Index("ix_orders_partner_status", "delivery_partner_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), nullable=False)
    delivery_partner_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))

    status: Mapped[OrderStatus] = mapped_column(
        enum_column(OrderStatus), nullable=False, default=OrderStatus.PLACED
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        enum_column(PaymentStatus), nullable=False, default=PaymentStatus.PENDING
    )

    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    delivery_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    delivery_address: Mapped[str] = mapped_column(Text, nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    # Drives reminders (P5)
    status_updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=utcnow)
    # End of the free cancellation window (D14)
    cancellable_until: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)

    customer: Mapped["User"] = relationship(back_populates="orders", foreign_keys=[customer_id])
    delivery_partner: Mapped[Optional["User"]] = relationship(
        back_populates="deliveries", foreign_keys=[delivery_partner_id]
    )
    restaurant: Mapped["Restaurant"] = relationship(back_populates="orders")

    items: Mapped[List["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )
    status_history: Mapped[List["OrderStatusHistory"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderStatusHistory.id"
    )
    ledger_entries: Mapped[List["PaymentLedger"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="PaymentLedger.id"
    )
    review: Mapped[Optional["Review"]] = relationship(back_populates="order", uselist=False)
    return_request: Mapped[Optional["ReturnRequest"]] = relationship(
        back_populates="order", uselist=False
    )
    reminders: Mapped[List["AdminReminderLog"]] = relationship(back_populates="order")

    def __repr__(self) -> str:
        return f"<Order id={self.id} status={self.status.value} total={self.total_amount}>"
