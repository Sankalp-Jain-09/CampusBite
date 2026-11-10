from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, StringConstraints
from typing_extensions import Annotated

Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class InsightRequest(BaseModel):
    """Leave `question` empty for a general summary of recent orders."""

    model_config = ConfigDict(extra="forbid")

    question: Optional[Question] = None


class InsightResponse(BaseModel):
    answer: str
    generated_at: datetime
    orders_considered: int
