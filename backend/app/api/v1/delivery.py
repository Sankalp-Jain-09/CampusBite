from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentDeliveryPartner, DbSession, delivery_partner_required
from app.models import OrderStatus
from app.schemas.common import Page, PaginationParams
from app.schemas.order import OrderDetail, OrderSummary, StatusUpdate
from app.services import delivery_service, order_service

router = APIRouter(
    prefix="/delivery",
    tags=["Delivery partner"],
    dependencies=[Depends(delivery_partner_required)],
    responses={401: {"description": "Not authenticated"}, 403: {"description": "Not a delivery partner"}},
)

_NOT_FOUND = {404: {"description": "Order not found or not assigned to you"}}


@router.get("/orders", response_model=Page[OrderSummary], summary="My active deliveries")
def active_deliveries(
    partner: CurrentDeliveryPartner,
    db: DbSession,
    params: PaginationParams = Depends(),
    status_filter: Optional[OrderStatus] = Query(None, alias="status", description="ASSIGNED or OUT_FOR_DELIVERY"),
):
    return delivery_service.list_active(db, partner, params, status_filter)


@router.get("/orders/{order_id}", response_model=OrderDetail, summary="Delivery details", responses=_NOT_FOUND)
def delivery_detail(order_id: int, partner: CurrentDeliveryPartner, db: DbSession):
    """Includes the customer's name, phone and delivery address."""
    return order_service.to_detail(delivery_service.get_assigned(db, partner, order_id))


@router.patch("/orders/{order_id}/status", response_model=OrderDetail, summary="Update delivery status",
              responses={**_NOT_FOUND, 409: {"description": "Invalid status change"}})
def update_delivery_status(order_id: int, data: StatusUpdate, partner: CurrentDeliveryPartner, db: DbSession):
    """ASSIGNED → OUT_FOR_DELIVERY → DELIVERED."""
    return order_service.to_detail(delivery_service.update_status(db, partner, order_id, data.status))


@router.get("/history", response_model=Page[OrderSummary], summary="My delivery history")
def delivery_history(
    partner: CurrentDeliveryPartner,
    db: DbSession,
    params: PaginationParams = Depends(),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
):
    return delivery_service.history(db, partner, params, date_from, date_to)
