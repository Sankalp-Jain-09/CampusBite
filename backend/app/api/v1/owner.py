from datetime import date
from typing import List, Optional

from typing_extensions import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response, status
from sqlalchemy.orm import sessionmaker

from app.api.deps import CurrentOwner, DbSession, owner_required
from app.db.session import get_session_factory
from app.schemas.common import Page, PaginationParams
from app.models import OrderStatus, ReturnStatus
from app.schemas.menu import AvailabilityUpdate, MenuItemCreate, MenuItemOut, MenuItemUpdate
from app.schemas.order import AssignRequest, DeliveryPartnerOut, OrderDetail, OrderSummary, StatusUpdate
from app.schemas.restaurant import RestaurantOut, RestaurantUpdate
from app.schemas.return_request import RejectRequest, ReturnRequestOut
from app.schemas.stats import ReminderOut, RestaurantStats
from app.services import (
    menu_service,
    order_service,
    reminder_service,
    restaurant_service,
    return_service,
    stats_service,
)

# Every route here requires a restaurant owner (403 for other roles, 401 without a token).
router = APIRouter(
    prefix="/owner",
    tags=["Restaurant owner"],
    dependencies=[Depends(owner_required)],
    responses={401: {"description": "Not authenticated"}, 403: {"description": "Not a restaurant owner"}},
)

_ITEM_NOT_FOUND = {404: {"description": "Dish not found in your restaurant"}}


# ---------------- Restaurant profile ----------------

@router.get("/restaurant", response_model=RestaurantOut, summary="My restaurant")
def get_my_restaurant(owner: CurrentOwner, db: DbSession):
    return restaurant_service.get_owner_restaurant(db, owner)


@router.put("/restaurant", response_model=RestaurantOut, summary="Update my restaurant")
def update_my_restaurant(data: RestaurantUpdate, owner: CurrentOwner, db: DbSession):
    """Only the fields sent are changed (e.g. `{"is_open": false}` to close for the day)."""
    return restaurant_service.update_owner_restaurant(db, owner, data)


# ---------------- Menu management ----------------

@router.get("/menu-items", response_model=Page[MenuItemOut], summary="My menu (including unavailable dishes)")
def list_my_menu(
    owner: CurrentOwner,
    db: DbSession,
    params: PaginationParams = Depends(),
    search: Optional[str] = Query(None, max_length=100),
    available: Optional[bool] = Query(None, description="Filter by availability"),
    category: Optional[str] = Query(None, max_length=100),
):
    return menu_service.list_owner_menu(db, owner, params, search=search, available=available, category=category)


@router.post("/menu-items", response_model=MenuItemOut, status_code=status.HTTP_201_CREATED, summary="Add a dish")
def create_dish(data: MenuItemCreate, owner: CurrentOwner, db: DbSession):
    return menu_service.create_menu_item(db, owner, data)


@router.put("/menu-items/{item_id}", response_model=MenuItemOut, summary="Update a dish", responses=_ITEM_NOT_FOUND)
def update_dish(item_id: int, data: MenuItemUpdate, owner: CurrentOwner, db: DbSession):
    """Only the fields sent are changed."""
    return menu_service.update_menu_item(db, owner, item_id, data)


@router.patch("/menu-items/{item_id}/availability", response_model=MenuItemOut,
              summary="Mark a dish available / unavailable", responses=_ITEM_NOT_FOUND)
def set_dish_availability(item_id: int, data: AvailabilityUpdate, owner: CurrentOwner, db: DbSession):
    return menu_service.set_availability(db, owner, item_id, data.is_available)


@router.delete("/menu-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Delete a dish (soft delete)", responses=_ITEM_NOT_FOUND)
def delete_dish(item_id: int, owner: CurrentOwner, db: DbSession):
    """The dish disappears from all menus; past orders keep their snapshot of it."""
    menu_service.soft_delete_menu_item(db, owner, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------- Orders ----------------

_ORDER_NOT_FOUND = {404: {"description": "Order not found in your restaurant"}}


@router.get("/orders", response_model=Page[OrderSummary], summary="Incoming orders")
def list_orders(
    owner: CurrentOwner,
    db: DbSession,
    params: PaginationParams = Depends(),
    status_filter: Optional[OrderStatus] = Query(None, alias="status"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    scope: Optional[Literal["active", "past"]] = Query(None, description="active = not finished yet; past = delivered, cancelled or refunded"),
):
    """Each order includes `in_cancel_window`: Accept is blocked until the customer's free window ends."""
    return order_service.list_owner_orders(db, owner, params, status_filter, date_from, date_to, scope)


@router.patch("/orders/{order_id}/status", response_model=OrderDetail, summary="Update preparation status",
              responses={**_ORDER_NOT_FOUND, 409: {"description": "Invalid status change"}})
def update_order_status(order_id: int, data: StatusUpdate, owner: CurrentOwner, db: DbSession):
    """PLACED → ACCEPTED → PREPARING → READY. Owners cannot cancel orders."""
    return order_service.to_detail(order_service.owner_update_status(db, owner, order_id, data.status))


@router.get("/delivery-partners", response_model=List[DeliveryPartnerOut], summary="Available delivery partners")
def delivery_partners(db: DbSession):
    """Active partners, least busy first, with their current number of active deliveries."""
    return order_service.list_delivery_partners(db)


@router.post("/orders/{order_id}/assign", response_model=OrderDetail, summary="Assign a delivery partner",
             responses={**_ORDER_NOT_FOUND, 400: {"description": "Invalid delivery partner"},
                        409: {"description": "Order is not READY"}})
def assign_delivery_partner(order_id: int, data: AssignRequest, owner: CurrentOwner, db: DbSession):
    return order_service.to_detail(order_service.assign_partner(db, owner, order_id, data.delivery_partner_id))


# ---------------- Returns / refunds ----------------

_RETURN_NOT_FOUND = {404: {"description": "Return request not found in your restaurant"},
                     409: {"description": "Already approved or rejected"}}


@router.get("/returns", response_model=Page[ReturnRequestOut], summary="Return/refund requests")
def list_returns(
    owner: CurrentOwner,
    db: DbSession,
    params: PaginationParams = Depends(),
    status_filter: Optional[ReturnStatus] = Query(None, alias="status"),
):
    return return_service.list_owner_returns(db, owner, params, status_filter)


@router.post("/returns/{return_id}/approve", response_model=ReturnRequestOut,
             summary="Approve a return (refund the dummy payment)", responses=_RETURN_NOT_FOUND)
def approve_return(return_id: int, owner: CurrentOwner, db: DbSession):
    """Writes a refund ledger entry, sets payment to `refunded` and the order to REFUNDED."""
    return return_service.to_out(return_service.approve(db, owner, return_id))


@router.post("/returns/{return_id}/reject", response_model=ReturnRequestOut,
             summary="Reject a return", responses=_RETURN_NOT_FOUND)
def reject_return(return_id: int, data: RejectRequest, owner: CurrentOwner, db: DbSession):
    """A note explaining the decision is required. The order and payment are unchanged."""
    return return_service.to_out(return_service.reject(db, owner, return_id, data.owner_note))


# ---------------- Stats & reminders ----------------

@router.get("/stats", response_model=RestaurantStats, summary="Restaurant statistics")
def stats(
    owner: CurrentOwner,
    db: DbSession,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
):
    """Order counts, revenue (cancelled orders excluded), refunds, average order value, rating, top dishes,
    pending returns and open reminders. The optional date range applies to order placement dates."""
    return stats_service.restaurant_stats(db, owner, date_from, date_to)


@router.get("/reminders", response_model=Page[ReminderOut], summary="Reminders for stale orders")
def list_reminders(
    owner: CurrentOwner,
    db: DbSession,
    background_tasks: BackgroundTasks,
    session_factory: sessionmaker = Depends(get_session_factory),
    params: PaginationParams = Depends(),
    resolved: bool = Query(False, description="false = open reminders, true = resolved history"),
):
    """Orders left in PLACED/ACCEPTED for more than 15 minutes. A fresh scan is also queued as a
    background task, so the next poll is up to date even between periodic worker runs."""
    background_tasks.add_task(reminder_service.scan_with_factory, session_factory)
    return reminder_service.list_reminders(db, owner, params, resolved)


@router.patch("/reminders/{reminder_id}/acknowledge", response_model=ReminderOut, summary="Dismiss a reminder",
              responses={404: {"description": "Reminder not found in your restaurant"}})
def acknowledge_reminder(reminder_id: int, owner: CurrentOwner, db: DbSession):
    return reminder_service.acknowledge(db, owner, reminder_id)
