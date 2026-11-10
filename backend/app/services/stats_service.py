"""Restaurant statistics, computed with SQL aggregates (COUNT / SUM / AVG / GROUP BY) — no Python loops over rows."""
from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import Dict, Optional

from sqlalchemy import and_, bindparam, func, select, text
from sqlalchemy.orm import Session

from app.db.types import UTCDateTime, utcnow
from app.models import (
    AdminReminderLog,
    LedgerEntryType,
    Order,
    OrderItem,
    OrderStatus,
    PaymentLedger,
    ReturnRequest,
    ReturnStatus,
    Review,
    User,
)
from app.schemas.stats import RestaurantStats, TopItem
from app.services.query_utils import date_bounds, date_range_conditions
from app.services.restaurant_service import get_owner_restaurant

ZERO = Decimal("0.00")
TWO_PLACES = Decimal("0.01")


def _orders_by_status_sql(db: Session, restaurant_id: int, start: Optional[datetime],
                          end: Optional[datetime]) -> Dict[OrderStatus, int]:
    """Plain SQL (text) query — shows raw SQL alongside the ORM, as the PRD asks."""
    sql = "SELECT status, COUNT(*) AS n FROM orders WHERE restaurant_id = :rid"
    params = [bindparam("rid")]
    values = {"rid": restaurant_id}
    if start is not None:
        sql += " AND created_at >= :start"
        params.append(bindparam("start", type_=UTCDateTime))
        values["start"] = start
    if end is not None:
        sql += " AND created_at < :end"
        params.append(bindparam("end", type_=UTCDateTime))
        values["end"] = end
    sql += " GROUP BY status"
    rows = db.execute(text(sql).bindparams(*params), values).all()
    counts = {s: 0 for s in OrderStatus}
    for status_value, n in rows:
        counts[OrderStatus(status_value)] = int(n)
    return counts


def restaurant_stats(db: Session, owner: User, date_from: Optional[date] = None,
                     date_to: Optional[date] = None) -> RestaurantStats:
    restaurant = get_owner_restaurant(db, owner)
    rid = restaurant.id
    range_conds = date_range_conditions(Order.created_at, date_from, date_to)
    in_range = and_(Order.restaurant_id == rid, *range_conds)
    counted = and_(in_range, Order.status != OrderStatus.CANCELLED)   # cancelled orders don't count as sales (D5)

    total_orders = db.scalar(select(func.count(Order.id)).where(in_range)) or 0

    today_start = datetime.combine(utcnow().date(), time.min, tzinfo=timezone.utc)
    orders_today = db.scalar(
        select(func.count(Order.id)).where(Order.restaurant_id == rid, Order.created_at >= today_start)
    ) or 0

    start, end = date_bounds(date_from, date_to)
    by_status = _orders_by_status_sql(db, rid, start, end)

    def ledger_sum(entry_type: LedgerEntryType) -> Decimal:
        value = db.scalar(
            select(func.coalesce(func.sum(PaymentLedger.amount), 0))
            .join(Order, Order.id == PaymentLedger.order_id)
            .where(counted, PaymentLedger.entry_type == entry_type)
        )
        return Decimal(str(value or 0)).quantize(TWO_PLACES)

    gross = ledger_sum(LedgerEntryType.CHARGE)
    refunds = ledger_sum(LedgerEntryType.REFUND)
    sales_count = db.scalar(select(func.count(Order.id)).where(counted)) or 0
    aov = (gross / sales_count).quantize(TWO_PLACES) if sales_count else ZERO

    avg_rating, review_count = db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(Review.restaurant_id == rid)
    ).one()

    top_rows = db.execute(
        select(
            OrderItem.menu_item_id,
            func.max(OrderItem.item_name).label("name"),
            func.sum(OrderItem.quantity).label("qty"),
            func.sum(OrderItem.line_total).label("revenue"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .where(counted)
        .group_by(OrderItem.menu_item_id)
        .order_by(func.sum(OrderItem.quantity).desc(), OrderItem.menu_item_id)
        .limit(5)
    ).all()

    pending_returns = db.scalar(
        select(func.count(ReturnRequest.id))
        .join(Order, Order.id == ReturnRequest.order_id)
        .where(Order.restaurant_id == rid, ReturnRequest.status == ReturnStatus.REQUESTED)
    ) or 0
    open_reminders = db.scalar(
        select(func.count(AdminReminderLog.id))
        .where(AdminReminderLog.restaurant_id == rid, AdminReminderLog.is_resolved.is_(False))
    ) or 0

    return RestaurantStats(
        date_from=date_from,
        date_to=date_to,
        total_orders=total_orders,
        orders_today=orders_today,
        orders_by_status=by_status,
        gross_revenue=gross,
        refunds_total=refunds,
        net_revenue=gross - refunds,
        average_order_value=aov,
        avg_rating=round(float(avg_rating), 1) if avg_rating is not None else None,
        review_count=int(review_count or 0),
        top_items=[
            TopItem(menu_item_id=r.menu_item_id, name=r.name, quantity=int(r.qty),
                    revenue=Decimal(str(r.revenue)).quantize(TWO_PLACES))
            for r in top_rows
        ],
        pending_returns=pending_returns,
        open_reminders=open_reminders,
    )
