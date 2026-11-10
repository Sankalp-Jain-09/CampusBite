"""Dummy payments: no gateway, just ledger records and the order's payment_status."""
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import LedgerEntryType, LedgerStatus, Order, PaymentLedger, PaymentStatus

FREE_CANCEL_NOTE = "free_cancellation_window"
RETURN_APPROVED_NOTE = "return_approved"


def mock_charge(db: Session, order: Order) -> PaymentLedger:
    entry = PaymentLedger(
        order_id=order.id,
        entry_type=LedgerEntryType.CHARGE,
        amount=order.total_amount,
        status=LedgerStatus.SUCCESS,
        method="dummy",
        transaction_ref=f"MOCK-{uuid.uuid4().hex[:20].upper()}",
    )
    db.add(entry)
    order.payment_status = PaymentStatus.MOCK_PAID
    return entry


def mock_refund(db: Session, order: Order, note: str) -> PaymentLedger:
    """Refund the full amount. Refuses a second refund for the same order."""
    already_refunded = order.payment_status == PaymentStatus.REFUNDED or any(
        e.entry_type == LedgerEntryType.REFUND for e in order.ledger_entries
    )
    if already_refunded:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order has already been refunded")
    entry = PaymentLedger(
        order_id=order.id,
        entry_type=LedgerEntryType.REFUND,
        amount=order.total_amount,
        status=LedgerStatus.SUCCESS,
        method="dummy",
        transaction_ref=f"MOCK-REFUND-{uuid.uuid4().hex[:16].upper()}",
        note=note,
    )
    order.ledger_entries.append(entry)
    order.payment_status = PaymentStatus.REFUNDED
    return entry
