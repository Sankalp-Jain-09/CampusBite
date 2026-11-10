from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime
from app.models.enums import ReturnStatus, enum_column
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.order import Order
    from app.models.user import User


class ReturnRequest(TimestampMixin, Base):
    __tablename__ = "return_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    # UNIQUE: a customer cannot submit multiple return requests for the same order
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False, unique=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ReturnStatus] = mapped_column(
        enum_column(ReturnStatus), nullable=False, default=ReturnStatus.REQUESTED, index=True
    )
    owner_note: Mapped[Optional[str]] = mapped_column(Text)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)
    resolved_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))

    order: Mapped["Order"] = relationship(back_populates="return_request")
    customer: Mapped["User"] = relationship(foreign_keys=[customer_id])
    resolver: Mapped[Optional["User"]] = relationship(foreign_keys=[resolved_by])
