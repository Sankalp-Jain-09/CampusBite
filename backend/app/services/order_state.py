"""Order lifecycle state machine — the single source of truth for allowed status changes.

Every status change in the app goes through `validate_transition` + `apply_transition`.
"""
from datetime import datetime
from typing import Dict, FrozenSet, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.db.types import utcnow
from app.models import AdminReminderLog, Order, OrderStatus, OrderStatusHistory, User, UserRole

S = OrderStatus
R = UserRole

# (from, to) -> roles allowed to make that change
TRANSITIONS: Dict[Tuple[OrderStatus, OrderStatus], FrozenSet[UserRole]] = {
    (S.PLACED, S.ACCEPTED): frozenset({R.RESTAURANT_OWNER}),            # blocked during the free window (D14)
    (S.PLACED, S.CANCELLED): frozenset({R.CUSTOMER}),                    # owners cannot cancel (D6)
    (S.ACCEPTED, S.PREPARING): frozenset({R.RESTAURANT_OWNER}),
    (S.PREPARING, S.READY): frozenset({R.RESTAURANT_OWNER}),
    (S.READY, S.ASSIGNED): frozenset({R.RESTAURANT_OWNER}),              # only via the assign endpoint
    (S.ASSIGNED, S.OUT_FOR_DELIVERY): frozenset({R.DELIVERY_PARTNER}),
    (S.OUT_FOR_DELIVERY, S.DELIVERED): frozenset({R.DELIVERY_PARTNER}),
    (S.DELIVERED, S.REFUNDED): frozenset({R.RESTAURANT_OWNER}),          # only via return approval (P4)
}

FINAL_STATUSES = frozenset({S.DELIVERED, S.CANCELLED, S.REFUNDED})
ACTIVE_DELIVERY_STATUSES = (S.ASSIGNED, S.OUT_FOR_DELIVERY)


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def in_cancel_window(order: Order, now: Optional[datetime] = None) -> bool:
    now = now or utcnow()
    return order.status == S.PLACED and now <= order.cancellable_until


def validate_transition(order: Order, target: OrderStatus, actor: User, now: Optional[datetime] = None) -> None:
    """Raise 409 unless `actor` may move `order` to `target` right now."""
    allowed_roles = TRANSITIONS.get((order.status, target))
    if allowed_roles is None or actor.role not in allowed_roles:
        raise _conflict(f"Cannot move order from {order.status.value} to {target.value}")
    if order.status == S.PLACED and target == S.ACCEPTED and in_cancel_window(order, now):
        raise _conflict("Order is in the customer's free-cancellation window")


def apply_transition(
    db: Session, order: Order, target: OrderStatus, actor: Optional[User], now: Optional[datetime] = None
) -> None:
    """Change the status and record side effects. Does not commit — the caller commits once."""
    now = now or utcnow()
    previous = order.status
    order.status = target
    order.status_updated_at = now
    db.add(OrderStatusHistory(
        order_id=order.id,
        from_status=previous,
        to_status=target,
        changed_by_user_id=actor.id if actor else None,
        changed_at=now,
    ))
    # Any open reminder for this order is no longer relevant (P5).
    db.execute(
        update(AdminReminderLog)
        .where(AdminReminderLog.order_id == order.id, AdminReminderLog.is_resolved.is_(False))
        .values(is_resolved=True, resolved_at=now)
    )


def transition(db: Session, order: Order, target: OrderStatus, actor: User) -> None:
    """Validate + apply in one call (still no commit)."""
    now = utcnow()
    validate_transition(order, target, actor, now)
    apply_transition(db, order, target, actor, now)
