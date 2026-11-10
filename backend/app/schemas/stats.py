from datetime import date, datetime
from typing import Dict, List, Optional

from pydantic import BaseModel

from app.models.enums import OrderStatus
from app.schemas.types import Money


class TopItem(BaseModel):
    menu_item_id: int
    name: str
    quantity: int
    revenue: Money


class RestaurantStats(BaseModel):
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    total_orders: int
    orders_today: int
    orders_by_status: Dict[OrderStatus, int]
    gross_revenue: Money
    refunds_total: Money
    net_revenue: Money
    average_order_value: Money
    avg_rating: Optional[float] = None
    review_count: int
    top_items: List[TopItem]
    pending_returns: int
    open_reminders: int


class ReminderOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    order_id: int
    order_status_at_reminder: OrderStatus
    message: str
    minutes_pending: int
    is_resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None
