from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.types import Description, ImageUrl, LongText, Phone, ShortText


class RestaurantCreate(BaseModel):
    """Restaurant details collected in the "Partner with us" signup (D2)."""

    model_config = ConfigDict(extra="ignore")

    name: ShortText
    cuisine: ShortText
    address: LongText
    phone: Phone
    description: Optional[str] = Field(default=None, max_length=1000)


class RestaurantUpdate(BaseModel):
    """Owner edits their restaurant. Only the fields sent are changed."""

    model_config = ConfigDict(extra="forbid")

    name: Optional[ShortText] = None
    cuisine: Optional[ShortText] = None
    address: Optional[LongText] = None
    phone: Optional[Phone] = None
    description: Optional[Description] = None   # null clears it
    image_url: Optional[ImageUrl] = None        # null clears it
    image_crop_x: Optional[float] = Field(default=None, ge=0, le=1)
    image_crop_y: Optional[float] = Field(default=None, ge=0, le=1)
    is_open: Optional[bool] = None

    @model_validator(mode="after")
    def _required_fields_not_null(self):
        for field in ("name", "cuisine", "address", "phone", "image_crop_x", "image_crop_y", "is_open"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class RestaurantOut(BaseModel):
    """Owner's view of their own restaurant."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    name: str
    cuisine: str
    address: str
    phone: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    image_crop_x: float = 0.5
    image_crop_y: float = 0.5
    is_open: bool


class RestaurantPublic(BaseModel):
    """Public view (listing and detail), with rating summary."""

    id: int
    name: str
    cuisine: str
    address: str
    phone: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    image_crop_x: float = 0.5
    image_crop_y: float = 0.5
    is_open: bool
    avg_rating: Optional[float] = Field(default=None, description="Average review rating (1 decimal); null if no reviews")
    review_count: int = 0
