from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field
from typing_extensions import Annotated

from app.models.enums import (
    LedgerEntryType,
    LedgerStatus,
    OrderStatus,
    PaymentStatus,
    ReturnStatus,
    VehicleType,
)
from app.schemas.types import LongText, Money, Phone

# ---------------- Requests ----------------


class OrderItemIn(BaseModel):
    # extra="ignore": a client-sent price is silently ignored; the server uses DB prices (D4).
    model_config = ConfigDict(extra="ignore")

    menu_item_id: int = Field(gt=0)
    quantity: int = Field(ge=1, le=20)


class OrderCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    restaurant_id: int = Field(gt=0)
    items: Annotated[List[OrderItemIn], Field(min_length=1, max_length=50)]
    delivery_address: LongText
    contact_phone: Phone
    notes: Optional[str] = Field(default=None, max_length=500)
    # Optional: the items subtotal the customer saw. If prices changed since the cart was filled,
    # the order is refused (409) instead of charging an amount the customer was never shown.
    expected_subtotal: Optional[Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]] = None


class StatusUpdate(BaseModel):
    status: OrderStatus


class AssignRequest(BaseModel):
    delivery_partner_id: int = Field(gt=0)


# ---------------- Responses ----------------


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    menu_item_id: int
    item_name: str
    unit_price: Money
    quantity: int
    line_total: Money


class TimelineEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    from_status: Optional[OrderStatus] = None
    to_status: OrderStatus
    changed_at: datetime


class LedgerEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    entry_type: LedgerEntryType
    amount: Money
    status: LedgerStatus
    method: str
    transaction_ref: str
    note: Optional[str] = None
    created_at: datetime


class RefundInfo(BaseModel):
    amount: Money
    transaction_ref: str
    refunded_at: datetime
    note: Optional[str] = None


class ReturnInfo(BaseModel):
    id: int
    status: ReturnStatus
    reason: str
    owner_note: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None


class ReviewInfo(BaseModel):
    id: int
    rating: int
    comment: Optional[str] = None
    created_at: datetime


class PersonBrief(BaseModel):
    id: int
    name: str
    phone: str


class PartnerBrief(PersonBrief):
    vehicle_type: Optional[VehicleType] = None
    vehicle_number: Optional[str] = None


class RestaurantBrief(BaseModel):
    id: int
    name: str
    address: str
    phone: str


class OrderSummary(BaseModel):
    """One row in any order list (customer, owner or delivery partner)."""

    id: int
    status: OrderStatus
    payment_status: PaymentStatus
    total_amount: Money
    item_count: int
    items_summary: str
    restaurant_id: int
    restaurant_name: str
    restaurant_address: str
    customer_name: str
    delivery_address: str
    contact_phone: str
    delivery_partner_name: Optional[str] = None
    created_at: datetime
    status_updated_at: datetime
    in_cancel_window: bool
    cancel_window_remaining_seconds: int
    return_status: Optional[ReturnStatus] = None
    has_review: bool = False


class OrderDetail(OrderSummary):
    subtotal: Money
    delivery_fee: Money
    notes: Optional[str] = None
    cancellable_until: datetime
    cancelled_at: Optional[datetime] = None
    restaurant: RestaurantBrief
    customer: PersonBrief
    delivery_partner: Optional[PartnerBrief] = None
    items: List[OrderItemOut]
    timeline: List[TimelineEntry]
    payments: List[LedgerEntryOut]
    refund: Optional[RefundInfo] = None
    return_request: Optional[ReturnInfo] = None
    review: Optional[ReviewInfo] = None


class CancelResponse(BaseModel):
    order_id: int
    status: OrderStatus
    payment_status: PaymentStatus
    refunded_amount: Money
    message: str


class DeliveryPartnerOut(BaseModel):
    id: int
    name: str
    phone: str
    vehicle_type: Optional[VehicleType] = None
    vehicle_number: Optional[str] = None
    active_deliveries: int
