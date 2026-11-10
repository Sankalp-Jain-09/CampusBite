from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import LedgerEntryType, LedgerStatus, enum_column
from app.models.mixins import CreatedAtMixin

if TYPE_CHECKING:
    from app.models.order import Order


class PaymentLedger(CreatedAtMixin, Base):
    """Dummy payment records: one CHARGE when an order is placed, one REFUND if refunded."""

    __tablename__ = "payment_ledger"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entry_type: Mapped[LedgerEntryType] = mapped_column(enum_column(LedgerEntryType), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[LedgerStatus] = mapped_column(
        enum_column(LedgerStatus), nullable=False, default=LedgerStatus.SUCCESS
    )
    method: Mapped[str] = mapped_column(String(20), nullable=False, default="dummy")
    transaction_ref: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    # e.g. "free_cancellation_window" or "return_approved"
    note: Mapped[Optional[str]] = mapped_column(String(100))

    order: Mapped["Order"] = relationship(back_populates="ledger_entries")
