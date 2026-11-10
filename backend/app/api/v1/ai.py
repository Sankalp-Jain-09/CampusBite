from fastapi import APIRouter

from app.api.deps import CurrentCustomer, DbSession
from app.schemas.ai import InsightRequest, InsightResponse
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["AI insights"])


@router.post(
    "/insights",
    response_model=InsightResponse,
    summary="AI summary of / answers about my orders",
    responses={
        403: {"description": "Customers only"},
        429: {"description": "Too many requests (see Retry-After header)"},
        503: {"description": "AI not configured or temporarily unavailable"},
    },
)
def insights(data: InsightRequest, customer: CurrentCustomer, db: DbSession):
    """Ask about your own order history, e.g. *"How much did I spend this week?"* or
    *"Which of my orders are still not delivered?"*. Leave `question` empty for a summary.
    Only the logged-in customer's orders are ever sent to the AI."""
    return ai_service.get_insights(db, customer, data.question)
