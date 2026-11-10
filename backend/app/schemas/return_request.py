from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, StringConstraints
from typing_extensions import Annotated

from app.models.enums import OrderStatus, PaymentStatus, ReturnStatus
from app.schemas.types import Money

ReturnReason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=500)]
OwnerNote = Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=500)]


class ReturnCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: ReturnReason


class RejectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    owner_note: OwnerNote


class ReturnRequestOut(BaseModel):
    """A return request with enough order context for the owner to decide."""

    id: int
    order_id: int
    status: ReturnStatus
    reason: str
    owner_note: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    customer_name: str
    order_total: Money
    items_summary: str
    order_status: OrderStatus
    payment_status: PaymentStatus
    order_placed_at: datetime
