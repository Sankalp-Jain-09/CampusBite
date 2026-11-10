from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import UserRole, VehicleType, enum_column
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.order import Order
    from app.models.restaurant import Restaurant


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(enum_column(UserRole), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Customer-specific
    default_address: Mapped[Optional[str]] = mapped_column(Text)

    # Delivery-partner-specific
    vehicle_type: Mapped[Optional[VehicleType]] = mapped_column(enum_column(VehicleType))
    vehicle_number: Mapped[Optional[str]] = mapped_column(String(20))

    # Owner -> their restaurant (one-to-one, D3)
    restaurant: Mapped[Optional["Restaurant"]] = relationship(back_populates="owner", uselist=False)

    # Customer -> orders they placed
    orders: Mapped[List["Order"]] = relationship(
        back_populates="customer", foreign_keys="Order.customer_id"
    )

    # Delivery partner -> orders assigned to them
    deliveries: Mapped[List["Order"]] = relationship(
        back_populates="delivery_partner", foreign_keys="Order.delivery_partner_id"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role.value}>"
