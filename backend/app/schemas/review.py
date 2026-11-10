from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field
from typing_extensions import Annotated

from app.schemas.types import Description


class ReviewPublic(BaseModel):
    """A review as shown on a restaurant page. Only the reviewer's first name is exposed."""

    id: int
    rating: int
    comment: Optional[str] = None
    reviewer_name: str
    created_at: datetime


class ReviewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rating: Annotated[int, Field(ge=1, le=5)]
    comment: Optional[Description] = None


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    restaurant_id: int
    rating: int
    comment: Optional[str] = None
    created_at: datetime
