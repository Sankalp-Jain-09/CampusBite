"""Reminders for orders stuck in PLACED/ACCEPTED longer than REMINDER_THRESHOLD_MINUTES (default 15)."""
import logging
from datetime import datetime, timedelta
from typing import Callable, Optional

from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.types import utcnow
from app.models import AdminReminderLog, Order, OrderStatus, User
from app.schemas.common import PaginationParams, paginate
from app.services.restaurant_service import get_owner_restaurant

logger = logging.getLogger(__name__)

WATCHED_STATUSES = (OrderStatus.PLACED, OrderStatus.ACCEPTED)


def scan(db: Session, now: Optional[datetime] = None) -> int:
    """Create one reminder per stale order and status. Safe to run repeatedly (no duplicates)."""
    now = now or utcnow()
    threshold = now - timedelta(minutes=settings.REMINDER_THRESHOLD_MINUTES)
    already_reminded = exists().where(
        AdminReminderLog.order_id == Order.id,
        AdminReminderLog.order_status_at_reminder == Order.status,
        AdminReminderLog.is_resolved.is_(False),
    )
    stale = db.scalars(
        select(Order).where(
            Order.status.in_(WATCHED_STATUSES),
            Order.status_updated_at < threshold,
            Order.cancellable_until < now,          # still in the customer's free window → not the owner's turn yet
            ~already_reminded,
        ).order_by(Order.id)
    ).all()

    for order in stale:
        minutes = int((now - order.status_updated_at).total_seconds() // 60)
        db.add(AdminReminderLog(
            order_id=order.id,
            restaurant_id=order.restaurant_id,
            order_status_at_reminder=order.status,
            minutes_pending=minutes,
            message=f"Order #{order.id} has been {order.status.value} for {minutes} minutes without an update.",
        ))
    db.commit()
    if stale:
        logger.info("Reminder scan created %d reminder(s)", len(stale))
    return len(stale)


def scan_with_factory(session_factory: Callable[[], Session]) -> int:
    """Run a scan in its own session (used by the periodic worker and FastAPI BackgroundTasks)."""
    db = session_factory()
    try:
        return scan(db)
    except Exception:
        db.rollback()
        logger.exception("Reminder scan failed")
        return 0
    finally:
        db.close()


def list_reminders(db: Session, owner: User, params: PaginationParams, resolved: bool = False) -> dict:
    restaurant = get_owner_restaurant(db, owner)
    stmt = (
        select(AdminReminderLog)
        .where(AdminReminderLog.restaurant_id == restaurant.id, AdminReminderLog.is_resolved.is_(resolved))
        .order_by(AdminReminderLog.created_at.desc(), AdminReminderLog.id.desc())
    )
    return paginate(db, stmt, params)


def acknowledge(db: Session, owner: User, reminder_id: int) -> AdminReminderLog:
    restaurant = get_owner_restaurant(db, owner)
    reminder = db.scalar(select(AdminReminderLog).where(
        AdminReminderLog.id == reminder_id, AdminReminderLog.restaurant_id == restaurant.id))
    if reminder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
    if not reminder.is_resolved:
        reminder.is_resolved = True
        reminder.resolved_at = utcnow()
        db.commit()
    return reminder
