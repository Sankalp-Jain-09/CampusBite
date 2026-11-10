"""AI order insights (OpenAI).

Data isolation: the context is built ONLY from the authenticated customer's orders (customer_id comes
from the JWT via the route). Other customers' data never enters the prompt, so no prompt can reveal it.
Aggregates (spend, counts, top items) are computed here, so the model explains numbers instead of
doing arithmetic.
"""
import json
import logging
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, time as dtime, timedelta, timezone
from decimal import Decimal
from typing import Deque, Dict, List, Optional

import openai
from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.db.types import utcnow
from app.models import Order, OrderItem, OrderStatus, PaymentStatus, User
from app.schemas.ai import InsightResponse

logger = logging.getLogger(__name__)

MAX_ORDERS_IN_CONTEXT = 50
RECENT_DETAILED = 5
NOT_DELIVERED = (OrderStatus.PLACED, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY,
                 OrderStatus.ASSIGNED, OrderStatus.OUT_FOR_DELIVERY)
DEFAULT_QUESTION = "Summarize my recent orders and any notable patterns."
NO_ORDERS_ANSWER = ("You haven't placed any orders yet, so there's nothing to summarise. "
                    "Browse the restaurants and place your first order — insights will appear here afterwards.")
RETRYABLE_ERRORS = (openai.RateLimitError, openai.APITimeoutError, openai.APIConnectionError)
RETRY_DELAYS = (1.0, 2.0)   # two retries with exponential backoff

SYSTEM_PROMPT = (
    "You are CampusBite's order assistant. Answer ONLY using the order data provided for this customer. "
    "Today is {today}. Currency is Indian Rupees (₹). Amounts in the data are already computed; use them as given. "
    "If the question is unrelated to the customer's orders, or the data does not contain the answer, say so briefly. "
    "Never invent orders, amounts, dates or items. Keep answers concise and friendly; use short bullet lists "
    "where helpful."
)

_sleep = time.sleep  # replaced in tests


class AIServiceUnavailable(Exception):
    """OpenAI could not answer (rate limited, timed out, unreachable or errored)."""


# ---------------- Per-user rate limiting ----------------

class RateLimiter:
    """In-memory sliding window per user. Single-process only (documented limitation)."""

    def __init__(self) -> None:
        self._hits: Dict[int, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, user_id: int, limit: int, window_seconds: float = 60.0) -> Optional[int]:
        """Record a hit; return None if allowed, else the seconds to wait."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[user_id]
            while hits and now - hits[0] >= window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                return max(1, int(window_seconds - (now - hits[0])) + 1)
            hits.append(now)
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


rate_limiter = RateLimiter()


# ---------------- Context ----------------

def _money(value) -> float:
    return float(Decimal(str(value or 0)).quantize(Decimal("0.01")))


def build_context(db: Session, customer_id: int, now: Optional[datetime] = None) -> dict:
    """Everything the model may know: this customer's orders and pre-computed aggregates."""
    now = now or utcnow()
    mine = Order.customer_id == customer_id
    # Money actually spent = orders still charged (refunded orders cost nothing).
    paid = and_(mine, Order.payment_status == PaymentStatus.MOCK_PAID)

    week_start = datetime.combine((now - timedelta(days=now.weekday())).date(), dtime.min, tzinfo=timezone.utc)
    month_start = datetime.combine(now.date().replace(day=1), dtime.min, tzinfo=timezone.utc)

    def spent(*conds) -> float:
        return _money(db.scalar(select(func.coalesce(func.sum(Order.total_amount), 0)).where(paid, *conds)))

    total_orders = db.scalar(select(func.count(Order.id)).where(mine)) or 0
    by_status = {s.value: int(n) for s, n in db.execute(
        select(Order.status, func.count(Order.id)).where(mine).group_by(Order.status)).all()}

    top_items = [
        {"name": name, "total_quantity": int(qty), "times_ordered": int(times)}
        for name, qty, times in db.execute(
            select(OrderItem.item_name, func.sum(OrderItem.quantity), func.count(func.distinct(Order.id)))
            .join(Order, Order.id == OrderItem.order_id)
            .where(mine, Order.status != OrderStatus.CANCELLED)
            .group_by(OrderItem.item_name)
            .order_by(func.sum(OrderItem.quantity).desc(), OrderItem.item_name)
            .limit(5)
        ).all()
    ]

    orders: List[Order] = db.scalars(
        select(Order).where(mine)
        .options(selectinload(Order.items), selectinload(Order.restaurant))
        .order_by(Order.created_at.desc(), Order.id.desc())
        .limit(MAX_ORDERS_IN_CONTEXT)
    ).all()

    def brief(o: Order) -> dict:
        return {"order_id": o.id, "restaurant": o.restaurant.name, "status": o.status.value,
                "payment": o.payment_status.value, "total": _money(o.total_amount),
                "placed_at": o.created_at.strftime("%Y-%m-%d %H:%M UTC")}

    return {
        "today": now.date().isoformat(),
        "currency": "INR",
        "total_orders": total_orders,
        "orders_in_this_context": len(orders),
        "spending": {
            "this_week_since_monday": spent(Order.created_at >= week_start),
            "this_month": spent(Order.created_at >= month_start),
            "all_time": spent(),
            "note": "Refunded orders are excluded; orders cancelled without refund still count.",
        },
        "orders_by_status": by_status,
        "not_delivered_yet": [brief(o) for o in orders if o.status in NOT_DELIVERED],
        "most_ordered_items": top_items,
        "recent_orders_detailed": [
            {**brief(o), "items": [{"name": i.item_name, "quantity": i.quantity, "price": _money(i.unit_price)}
                                   for i in o.items]}
            for o in orders[:RECENT_DETAILED]
        ],
        "all_orders_brief": [brief(o) for o in orders],
    }


def build_messages(context: dict, question: Optional[str]) -> List[dict]:
    return [
        {"role": "system", "content": SYSTEM_PROMPT.format(today=context["today"])},
        {"role": "user", "content": f"Question: {question or DEFAULT_QUESTION}\n\n"
                                    f"Order data (JSON):\n{json.dumps(context, ensure_ascii=False)}"},
    ]


# ---------------- OpenAI call ----------------

def _create_completion(messages: List[dict]) -> str:
    """One OpenAI request (no SDK-level retries; we retry ourselves). Replaced in tests."""
    client = openai.OpenAI(api_key=settings.OPENAI_API_KEY, max_retries=0, timeout=20.0)
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=messages,
        temperature=0.3,
        max_tokens=500,
    )
    return (response.choices[0].message.content or "").strip()


def call_openai(messages: List[dict]) -> str:
    """Retry transient errors (rate limit, timeout, connection) with backoff; then give up."""
    attempts = len(RETRY_DELAYS) + 1
    for attempt in range(attempts):
        try:
            answer = _create_completion(messages)
            if not answer:
                raise AIServiceUnavailable("Empty response")
            return answer
        except RETRYABLE_ERRORS as exc:
            logger.warning("OpenAI transient error (%s), attempt %d/%d", type(exc).__name__, attempt + 1, attempts)
            if attempt < len(RETRY_DELAYS):
                _sleep(RETRY_DELAYS[attempt])
                continue
            raise AIServiceUnavailable(type(exc).__name__) from exc
        except openai.OpenAIError as exc:   # auth, bad request, server error...
            logger.error("OpenAI error (%s)", type(exc).__name__)   # never log the key or the prompt
            raise AIServiceUnavailable(type(exc).__name__) from exc
    raise AIServiceUnavailable("unreachable")  # pragma: no cover


# ---------------- Entry point ----------------

def get_insights(db: Session, customer: User, question: Optional[str]) -> InsightResponse:
    retry_after = rate_limiter.check(customer.id, settings.AI_RATE_LIMIT_PER_MINUTE)
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many AI requests. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    context = build_context(db, customer.id)
    now = utcnow()
    if context["total_orders"] == 0:
        return InsightResponse(answer=NO_ORDERS_ANSWER, generated_at=now, orders_considered=0)

    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI insights are not configured")

    try:
        answer = call_openai(build_messages(context, question))
    except AIServiceUnavailable:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="AI service is busy, please try again shortly")
    return InsightResponse(answer=answer, generated_at=utcnow(), orders_considered=context["orders_in_this_context"])
