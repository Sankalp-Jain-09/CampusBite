"""Return/refund requests: customers request after delivery (with a reason), owners approve or reject (D5)."""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.db.types import utcnow
from app.models import Order, OrderStatus, Restaurant, ReturnRequest, ReturnStatus, User
from app.schemas.common import PaginationParams, paginate
from app.schemas.return_request import ReturnRequestOut
from app.services import payment_service
from app.services.order_service import lock_order_for
from app.services.order_state import transition

RETURN_EXISTS = "A return request already exists for this order"
RETURN_NOT_FOUND = "Return request not found"

_LOAD = (
    selectinload(ReturnRequest.order).selectinload(Order.items),
    selectinload(ReturnRequest.order).selectinload(Order.customer),
)


def to_out(rr: ReturnRequest) -> ReturnRequestOut:
    order = rr.order
    return ReturnRequestOut(
        id=rr.id,
        order_id=order.id,
        status=rr.status,
        reason=rr.reason,
        owner_note=rr.owner_note,
        created_at=rr.created_at,
        resolved_at=rr.resolved_at,
        customer_name=order.customer.name,
        order_total=order.total_amount,
        items_summary=", ".join(f"{i.quantity}× {i.item_name}" for i in order.items),
        order_status=order.status,
        payment_status=order.payment_status,
        order_placed_at=order.created_at,
    )


# ---------------- Customer ----------------

def create_return(db: Session, customer: User, order_id: int, reason: str) -> ReturnRequest:
    order = lock_order_for(db, customer, order_id)   # 404 if not the caller's order
    if order.status != OrderStatus.DELIVERED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Returns are allowed only after delivery")
    if order.return_request is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=RETURN_EXISTS)

    rr = ReturnRequest(order_id=order.id, customer_id=customer.id, reason=reason, status=ReturnStatus.REQUESTED)
    db.add(rr)
    try:
        db.commit()
    except IntegrityError:   # concurrent duplicate hits UNIQUE(order_id)
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=RETURN_EXISTS)
    return _load_one(db, rr.id)


# ---------------- Owner ----------------

def _owned_condition(owner: User):
    return ReturnRequest.order_id.in_(
        select(Order.id).join(Restaurant, Restaurant.id == Order.restaurant_id).where(Restaurant.owner_id == owner.id)
    )


def _load_one(db: Session, return_id: int) -> ReturnRequest:
    return db.scalar(select(ReturnRequest).where(ReturnRequest.id == return_id).options(*_LOAD)
                     .execution_options(populate_existing=True))


def list_owner_returns(db: Session, owner: User, params: PaginationParams,
                       status_filter: Optional[ReturnStatus] = None) -> dict:
    stmt = select(ReturnRequest).where(_owned_condition(owner))
    if status_filter is not None:
        stmt = stmt.where(ReturnRequest.status == status_filter)
    stmt = stmt.order_by(ReturnRequest.created_at.desc(), ReturnRequest.id.desc()).options(*_LOAD)
    page = paginate(db, stmt, params)
    page["items"] = [to_out(rr) for rr in page["items"]]
    return page


def _lock_pending(db: Session, owner: User, return_id: int) -> ReturnRequest:
    rr = db.scalar(
        select(ReturnRequest)
        .where(ReturnRequest.id == return_id, _owned_condition(owner))
        .with_for_update(of=ReturnRequest)
        .execution_options(populate_existing=True)
    )
    if rr is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=RETURN_NOT_FOUND)
    if rr.status != ReturnStatus.REQUESTED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail=f"Return request already {rr.status.value}")
    return rr


def approve(db: Session, owner: User, return_id: int) -> ReturnRequest:
    """Approve → refund ledger entry, payment `refunded`, order REFUNDED — all in one transaction."""
    rr = _lock_pending(db, owner, return_id)
    order = lock_order_for(db, owner, rr.order_id)
    now = utcnow()
    payment_service.mock_refund(db, order, note=payment_service.RETURN_APPROVED_NOTE)
    transition(db, order, OrderStatus.REFUNDED, owner)
    rr.status = ReturnStatus.APPROVED
    rr.resolved_at = now
    rr.resolved_by = owner.id
    db.commit()
    return _load_one(db, rr.id)


def reject(db: Session, owner: User, return_id: int, owner_note: str) -> ReturnRequest:
    """Reject → only the return status changes; order and payment stay as they are."""
    rr = _lock_pending(db, owner, return_id)
    rr.status = ReturnStatus.REJECTED
    rr.owner_note = owner_note
    rr.resolved_at = utcnow()
    rr.resolved_by = owner.id
    db.commit()
    return _load_one(db, rr.id)
