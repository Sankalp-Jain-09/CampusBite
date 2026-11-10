from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import UserRole, VehicleType


class UserOut(BaseModel):
    """Public view of a user. Never includes the password hash."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    phone: str
    role: UserRole
    default_address: Optional[str] = None
    vehicle_type: Optional[VehicleType] = None
    vehicle_number: Optional[str] = None
