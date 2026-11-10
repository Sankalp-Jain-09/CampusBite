import enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, model_validator

from app.schemas.types import Category, Description, ImageUrl, Money, PriceIn, ShortText


class MenuSort(str, enum.Enum):
    NAME = "name"
    PRICE_ASC = "price_asc"
    PRICE_DESC = "price_desc"


class MenuItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    restaurant_id: int
    name: str
    description: Optional[str] = None
    category: str
    price: Money
    is_veg: bool
    is_available: bool
    image_url: Optional[str] = None


class MenuItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ShortText
    description: Optional[Description] = None
    category: Category = "Main"
    price: PriceIn
    is_veg: bool = True
    is_available: bool = True
    image_url: Optional[ImageUrl] = None


class MenuItemUpdate(BaseModel):
    """Partial update: only the fields sent are changed."""

    model_config = ConfigDict(extra="forbid")

    name: Optional[ShortText] = None
    description: Optional[Description] = None   # null clears it
    category: Optional[Category] = None
    price: Optional[PriceIn] = None
    is_veg: Optional[bool] = None
    is_available: Optional[bool] = None
    image_url: Optional[ImageUrl] = None        # null clears it

    @model_validator(mode="after")
    def _required_fields_not_null(self):
        for field in ("name", "category", "price", "is_veg", "is_available"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class AvailabilityUpdate(BaseModel):
    is_available: bool
