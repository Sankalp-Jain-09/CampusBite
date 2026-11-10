"""Orders: checkout, reading (scoped per role), cancellation, owner actions and serialisation."""
import math
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import Select, and_, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.db.types import utcnow
from app.models import (
    LedgerEntryType,
    MenuItem,
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusHistory,
    Restaurant,
    User,
    UserRole,
)
from app.schemas.common import PaginationParams, paginate
from app.schemas.order import (
    CancelResponse,
    DeliveryPartnerOut,
    LedgerEntryOut,
    OrderCreate,
    OrderDetail,
    OrderItemOut,
    OrderSummary,
    PartnerBrief,
    PersonBrief,
    RefundInfo,
    RestaurantBrief,
    ReturnInfo,
    ReviewInfo,
    TimelineEntry,
)
from app.services import payment_service
from app.services.order_state import ACTIVE_DELIVERY_STATUSES, in_cancel_window, transition
from app.services.query_utils import date_range_conditions
from app.services.restaurant_service import get_owner_restaurant

ORDER_NOT_FOUND = "Order not found"
TWO_PLACES = Decimal("0.01")

# Eager-load everything the serialisers touch (selectinload never changes the main query or its COUNT).
ORDER_LOAD_OPTIONS = (
    selectinload(Order.items),
    selectinload(Order.restaurant),
    selectinload(Order.customer),
    selectinload(Order.delivery_partner),
    selectinload(Order.status_history),
    selectinload(Order.ledger_entries),
    selectinload(Order.return_request),
    selectinload(Order.review),
)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ORDER_NOT_FOUND)


# ---------------- Serialisation ----------------

def remaining_cancel_seconds(order: Order, now: Optional[datetime] = None) -> int:
    now = now or utcnow()
    if not in_cancel_window(order, now):
        return 0
    return max(0, math.ceil((order.cancellable_until - now).total_seconds()))


def _summary_fields(order: Order, now: datetime) -> dict:
    items_summary = ", ".join(f"{i.quantity}× {i.item_name}" for i in order.items)
    return dict(
        id=order.id,
        status=order.status,
        payment_status=order.payment_status,
        total_amount=order.total_amount,
        item_count=sum(i.quantity for i in order.items),
        items_summary=items_summary,
        restaurant_id=order.restaurant_id,
        restaurant_name=order.restaurant.name,
        restaurant_address=order.restaurant.address,
        customer_name=order.customer.name,
        delivery_address=order.delivery_address,
        contact_phone=order.contact_phone,
        delivery_partner_name=order.delivery_partner.name if order.delivery_partner else None,
        created_at=order.created_at,
        status_updated_at=order.status_updated_at,
        in_cancel_window=in_cancel_window(order, now),
        cancel_window_remaining_seconds=remaining_cancel_seconds(order, now),
        return_status=order.return_request.status if order.return_request else None,
        has_review=order.review is not None,
    )


def to_summary(order: Order, now: Optional[datetime] = None) -> OrderSummary:
    return OrderSummary(**_summary_fields(order, now or utcnow()))


def to_detail(order: Order, now: Optional[datetime] = None) -> OrderDetail:
    now = now or utcnow()
    refund_entry = next((e for e in order.ledger_entries if e.entry_type == LedgerEntryType.REFUND), None)
    partner = order.delivery_partner
    rr = order.return_request
    review = order.review
    return OrderDetail(
        **_summary_fields(order, now),
        subtotal=order.subtotal,
        delivery_fee=order.delivery_fee,
        notes=order.notes,
        cancellable_until=order.cancellable_until,
        cancelled_at=order.cancelled_at,
        restaurant=RestaurantBrief(id=order.restaurant.id, name=order.restaurant.name,
                                   address=order.restaurant.address, phone=order.restaurant.phone),
        customer=PersonBrief(id=order.customer.id, name=order.customer.name, phone=order.customer.phone),
        delivery_partner=PartnerBrief(id=partner.id, name=partner.name, phone=partner.phone,
                                      vehicle_type=partner.vehicle_type,
                                      vehicle_number=partner.vehicle_number) if partner else None,
        items=[OrderItemOut.model_validate(i) for i in order.items],
        timeline=[TimelineEntry.model_validate(h) for h in order.status_history],
        payments=[LedgerEntryOut.model_validate(e) for e in order.ledger_entries],
        refund=RefundInfo(amount=refund_entry.amount, transaction_ref=refund_entry.transaction_ref,
                          refunded_at=refund_entry.created_at, note=refund_entry.note) if refund_entry else None,
        return_request=ReturnInfo(id=rr.id, status=rr.status, reason=rr.reason, owner_note=rr.owner_note,
                                  created_at=rr.created_at, resolved_at=rr.resolved_at) if rr else None,
        review=ReviewInfo(id=review.id, rating=review.rating, comment=review.comment,
                          created_at=review.created_at) if review else None,
    )


def page_of_summaries(db: Session, stmt: Select, params: PaginationParams) -> dict:
    page = paginate(db, stmt.options(*ORDER_LOAD_OPTIONS), params)
    now = utcnow()
    page["items"] = [to_summary(o, now) for o in page["items"]]
    return page


def _load(db: Session, stmt: Select) -> Optional[Order]:
    return db.scalar(stmt.options(*ORDER_LOAD_OPTIONS).execution_options(populate_existing=True))


# ---------------- Checkout ----------------

def place_order(db: Session, customer: User, data: OrderCreate) -> Order:
    # Merge duplicate lines for the same dish.
    quantities: Dict[int, int] = {}
    for line in data.items:
        quantities[line.menu_item_id] = quantities.get(line.menu_item_id, 0) + line.quantity
    for menu_item_id, qty in quantities.items():
        if qty > 20:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail=f"Quantity for dish {menu_item_id} cannot exceed 20")

    restaurant = db.get(Restaurant, data.restaurant_id)
    if restaurant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")
    if not restaurant.is_open:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Restaurant is closed")

    dishes = {d.id: d for d in db.scalars(select(MenuItem).where(MenuItem.id.in_(quantities.keys())))}
    for menu_item_id in quantities:
        dish = dishes.get(menu_item_id)
        if dish is None or dish.is_deleted:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Dish {menu_item_id} does not exist")
        if dish.restaurant_id != restaurant.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"'{dish.name}' is not on this restaurant's menu")
        if not dish.is_available:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"'{dish.name}' is currently unavailable")

    # Prices always come from the database, never from the client (D4).
    lines = []
    subtotal = Decimal("0.00")
    for menu_item_id, qty in quantities.items():
        dish = dishes[menu_item_id]
        line_total = (dish.price * qty).quantize(TWO_PLACES)
        subtotal += line_total
        lines.append(OrderItem(menu_item_id=dish.id, item_name=dish.name, unit_price=dish.price,
                               quantity=qty, line_total=line_total))
    if data.expected_subtotal is not None and data.expected_subtotal.quantize(TWO_PLACES) != subtotal:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Prices have changed since you added these dishes. The new subtotal is ₹{subtotal}. "
                   "Please review your order and pay again.",
        )
    delivery_fee = Decimal(str(settings.DELIVERY_FEE)).quantize(TWO_PLACES)

    now = utcnow()
    order = Order(
        customer_id=customer.id,
        restaurant_id=restaurant.id,
        status=OrderStatus.PLACED,
        subtotal=subtotal,
        delivery_fee=delivery_fee,
        total_amount=subtotal + delivery_fee,
        delivery_address=data.delivery_address,
        contact_phone=data.contact_phone,
        notes=data.notes,
        status_updated_at=now,
        cancellable_until=now + timedelta(seconds=settings.CANCEL_GRACE_SECONDS),
        items=lines,
    )
    db.add(order)
    db.flush()  # get order.id
    db.add(OrderStatusHistory(order_id=order.id, from_status=None, to_status=OrderStatus.PLACED,
                              changed_by_user_id=customer.id, changed_at=now))
    payment_service.mock_charge(db, order)
    db.commit()
    return get_order_for(db, customer, order.id)


# ---------------- Reading (role-scoped) ----------------

def _scope_condition(user: User):
    """Which orders `user` may see: their own (customer), their restaurant's (owner), assigned (partner)."""
    if user.role == UserRole.CUSTOMER:
        return Order.customer_id == user.id
    if user.role == UserRole.RESTAURANT_OWNER:
        return Order.restaurant_id.in_(select(Restaurant.id).where(Restaurant.owner_id == user.id))
    return Order.delivery_partner_id == user.id


def get_order_for(db: Session, user: User, order_id: int) -> Order:
    order = _load(db, select(Order).where(Order.id == order_id, _scope_condition(user)))
    if order is None:
        raise _not_found()
    return order


def lock_order_for(db: Session, user: User, order_id: int) -> Order:
    """Load an order the user may act on, locking the row (SELECT ... FOR UPDATE) until commit."""
    order = db.scalar(
        select(Order).where(Order.id == order_id, _scope_condition(user))
        .with_for_update(of=Order)
        .execution_options(populate_existing=True)
    )
    if order is None:
        raise _not_found()
    return order


ACTIVE_STATUSES = (OrderStatus.PLACED, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY,
                   OrderStatus.ASSIGNED, OrderStatus.OUT_FOR_DELIVERY)
PAST_STATUSES = (OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED)
SCOPES = {"active": ACTIVE_STATUSES, "past": PAST_STATUSES}


def _filtered(stmt: Select, status_filter: Optional[OrderStatus], date_from: Optional[date],
              date_to: Optional[date], scope: Optional[str] = None) -> Select:
    if scope is not None:
        stmt = stmt.where(Order.status.in_(SCOPES[scope]))
    if status_filter is not None:
        stmt = stmt.where(Order.status == status_filter)
    conditions = date_range_conditions(Order.created_at, date_from, date_to)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    return stmt.order_by(Order.created_at.desc(), Order.id.desc())


def list_customer_orders(db: Session, customer: User, params: PaginationParams,
                         status_filter: Optional[OrderStatus] = None,
                         date_from: Optional[date] = None, date_to: Optional[date] = None,
                         scope: Optional[str] = None) -> dict:
    stmt = _filtered(select(Order).where(Order.customer_id == customer.id), status_filter, date_from, date_to, scope)
    return page_of_summaries(db, stmt, params)


# ---------------- Customer cancel (D5 / D14) ----------------

def cancel_order(db: Session, customer: User, order_id: int) -> CancelResponse:
    order = lock_order_for(db, customer, order_id)
    if order.status != OrderStatus.PLACED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order can no longer be cancelled")

    now = utcnow()
    free_window = in_cancel_window(order, now)
    transition(db, order, OrderStatus.CANCELLED, customer)
    order.cancelled_at = now

    refunded = Decimal("0.00")
    if free_window:
        payment_service.mock_refund(db, order, note=payment_service.FREE_CANCEL_NOTE)
        refunded = order.total_amount
        message = "Order cancelled. Full refund issued (demo)."
    else:
        message = "Order cancelled. The free cancellation window had ended, so no refund was issued."
    db.commit()
    return CancelResponse(order_id=order.id, status=order.status, payment_status=order.payment_status,
                          refunded_amount=refunded, message=message)


# ---------------- Owner ----------------

OWNER_SETTABLE = (OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY)


def list_owner_orders(db: Session, owner: User, params: PaginationParams,
                      status_filter: Optional[OrderStatus] = None,
                      date_from: Optional[date] = None, date_to: Optional[date] = None,
                      scope: Optional[str] = None) -> dict:
    restaurant = get_owner_restaurant(db, owner)
    stmt = _filtered(select(Order).where(Order.restaurant_id == restaurant.id), status_filter, date_from, date_to,
                     scope)
    return page_of_summaries(db, stmt, params)


def owner_update_status(db: Session, owner: User, order_id: int, target: OrderStatus) -> Order:
    if target not in OWNER_SETTABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Restaurant owners can only set ACCEPTED, PREPARING or READY "
                   "(use the assign endpoint for delivery; owners cannot cancel orders)",
        )
    order = lock_order_for(db, owner, order_id)
    transition(db, order, target, owner)
    db.commit()
    return get_order_for(db, owner, order.id)


def list_delivery_partners(db: Session) -> List[DeliveryPartnerOut]:
    active = (
        select(Order.delivery_partner_id.label("partner_id"), func.count(Order.id).label("active"))
        .where(Order.status.in_(ACTIVE_DELIVERY_STATUSES))
        .group_by(Order.delivery_partner_id)
        .subquery()
    )
    rows = db.execute(
        select(User, func.coalesce(active.c.active, 0))
        .outerjoin(active, active.c.partner_id == User.id)
        .where(User.role == UserRole.DELIVERY_PARTNER, User.is_active.is_(True))
        .order_by(func.coalesce(active.c.active, 0), User.name, User.id)
    ).all()
    return [
        DeliveryPartnerOut(id=u.id, name=u.name, phone=u.phone, vehicle_type=u.vehicle_type,
                           vehicle_number=u.vehicle_number, active_deliveries=int(count))
        for u, count in rows
    ]


def assign_partner(db: Session, owner: User, order_id: int, partner_id: int) -> Order:
    order = lock_order_for(db, owner, order_id)
    if order.status != OrderStatus.READY:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail=f"Only READY orders can be assigned (order is {order.status.value})")
    partner = db.get(User, partner_id)
    if partner is None or partner.role != UserRole.DELIVERY_PARTNER or not partner.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Delivery partner not found or inactive")
    order.delivery_partner_id = partner.id
    transition(db, order, OrderStatus.ASSIGNED, owner)
    db.commit()
    return get_order_for(db, owner, order.id)
