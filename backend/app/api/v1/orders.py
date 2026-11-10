from datetime import date
from typing import Optional

from typing_extensions import Literal

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import CurrentCustomer, CurrentUser, DbSession
from app.models import OrderStatus
from app.schemas.common import Page, PaginationParams
from app.schemas.order import CancelResponse, OrderCreate, OrderDetail, OrderSummary
from app.schemas.return_request import ReturnCreate, ReturnRequestOut
from app.schemas.review import ReviewCreate, ReviewOut
from app.services import order_service, return_service, review_service

router = APIRouter(prefix="/orders", tags=["Orders"])

_NOT_FOUND = {404: {"description": "Order not found (or not yours)"}}


@router.post(
    "",
    response_model=OrderDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Place an order (dummy payment)",
    responses={400: {"description": "Dish unavailable / wrong restaurant / restaurant closed"},
               403: {"description": "Customers only"}},
)
def place_order(data: OrderCreate, customer: CurrentCustomer, db: DbSession):
    """Prices are taken from the database. Payment is mocked (`mock_paid`) and a 60-second free
    cancellation window starts (`cancel_window_remaining_seconds`)."""
    order = order_service.place_order(db, customer, data)
    return order_service.to_detail(order)


@router.get("/me", response_model=Page[OrderSummary], summary="My order history")
def my_orders(
    customer: CurrentCustomer,
    db: DbSession,
    params: PaginationParams = Depends(),
    status_filter: Optional[OrderStatus] = Query(None, alias="status"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    scope: Optional[Literal["active", "past"]] = Query(None, description="active = not finished yet; past = delivered, cancelled or refunded"),
):
    return order_service.list_customer_orders(db, customer, params, status_filter, date_from, date_to, scope)


@router.get("/{order_id}", response_model=OrderDetail, summary="Order details", responses=_NOT_FOUND)
def order_detail(order_id: int, user: CurrentUser, db: DbSession):
    """Visible to the customer who placed it, the restaurant's owner and the assigned delivery partner."""
    return order_service.to_detail(order_service.get_order_for(db, user, order_id))


@router.post(
    "/{order_id}/cancel",
    response_model=CancelResponse,
    summary="Cancel my order",
    responses={**_NOT_FOUND, 409: {"description": "Order is no longer PLACED"}},
)
def cancel_order(order_id: int, customer: CurrentCustomer, db: DbSession):
    """Only while PLACED. Within the free window: full automatic refund, no reason needed.
    After it: cancelled without refund."""
    return order_service.cancel_order(db, customer, order_id)


@router.post(
    "/{order_id}/review",
    response_model=ReviewOut,
    status_code=status.HTTP_201_CREATED,
    summary="Rate and review a delivered order",
    responses={**_NOT_FOUND, 409: {"description": "Not delivered yet, or already reviewed"}},
)
def review_order(order_id: int, data: ReviewCreate, customer: CurrentCustomer, db: DbSession):
    return review_service.create_review(db, customer, order_id, data)


@router.post(
    "/{order_id}/return",
    response_model=ReturnRequestOut,
    status_code=status.HTTP_201_CREATED,
    summary="Request a return/refund for a delivered order",
    responses={**_NOT_FOUND, 409: {"description": "Not delivered yet, or a request already exists"}},
)
def request_return(order_id: int, data: ReturnCreate, customer: CurrentCustomer, db: DbSession):
    """A reason (10–500 characters) is required. Only one request per order. The owner approves or rejects it."""
    return return_service.to_out(return_service.create_return(db, customer, order_id, data.reason))
