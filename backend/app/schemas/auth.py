from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import VehicleType
from app.schemas.restaurant import RestaurantCreate
from app.schemas.types import Password, PersonName, Phone, VehicleNumber
from app.schemas.user import UserOut


class _RegisterBase(BaseModel):
    # extra="ignore": a client-sent "role" (or any unknown field) is silently dropped.
    # The role is decided by which endpoint is called (D2), never by the request body.
    model_config = ConfigDict(extra="ignore")

    name: PersonName
    email: EmailStr
    phone: Phone
    password: Password


class CustomerRegister(_RegisterBase):
    default_address: Optional[str] = Field(default=None, max_length=500)


class OwnerRegister(_RegisterBase):
    restaurant: RestaurantCreate


class DeliveryPartnerRegister(_RegisterBase):
    vehicle_type: VehicleType
    vehicle_number: VehicleNumber


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
