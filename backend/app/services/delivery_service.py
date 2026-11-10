"""Delivery partner: only orders assigned to them."""
from datetime import date
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models import Order, OrderStatus, User
from app.schemas.common import PaginationParams
from app.services.order_service import page_of_summaries, get_order_for, lock_order_for
from app.services.order_state import ACTIVE_DELIVERY_STATUSES, transition
from app.services.query_utils import date_range_conditions

PARTNER_SETTABLE = (OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED)
HISTORY_STATUSES = (OrderStatus.DELIVERED, OrderStatus.REFUNDED)


def list_active(db: Session, partner: User, params: PaginationParams,
                status_filter: Optional[OrderStatus] = None) -> dict:
    if status_filter is not None and status_filter not in ACTIVE_DELIVERY_STATUSES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="status must be ASSIGNED or OUT_FOR_DELIVERY")
    statuses = (status_filter,) if status_filter else ACTIVE_DELIVERY_STATUSES
    stmt = (
        select(Order)
        .where(Order.delivery_partner_id == partner.id, Order.status.in_(statuses))
        .order_by(Order.status_updated_at.asc(), Order.id.asc())   # oldest assignment first
    )
    return page_of_summaries(db, stmt, params)


def get_assigned(db: Session, partner: User, order_id: int) -> Order:
    return get_order_for(db, partner, order_id)


def update_status(db: Session, partner: User, order_id: int, target: OrderStatus) -> Order:
    if target not in PARTNER_SETTABLE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Delivery partners can only set OUT_FOR_DELIVERY or DELIVERED")
    order = lock_order_for(db, partner, order_id)
    transition(db, order, target, partner)
    db.commit()
    return get_order_for(db, partner, order.id)


def history(db: Session, partner: User, params: PaginationParams,
            date_from: Optional[date] = None, date_to: Optional[date] = None) -> dict:
    stmt = select(Order).where(Order.delivery_partner_id == partner.id, Order.status.in_(HISTORY_STATUSES))
    conditions = date_range_conditions(Order.created_at, date_from, date_to)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(Order.status_updated_at.desc(), Order.id.desc())
    return page_of_summaries(db, stmt, params)
