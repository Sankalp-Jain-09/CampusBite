import enum
from typing import Type

from sqlalchemy import Enum as SAEnum


class UserRole(str, enum.Enum):
    CUSTOMER = "customer"
    RESTAURANT_OWNER = "restaurant_owner"
    DELIVERY_PARTNER = "delivery_partner"


class VehicleType(str, enum.Enum):
    BICYCLE = "bicycle"
    SCOOTER = "scooter"
    BIKE = "bike"


class OrderStatus(str, enum.Enum):
    PLACED = "PLACED"
    ACCEPTED = "ACCEPTED"
    PREPARING = "PREPARING"
    READY = "READY"
    ASSIGNED = "ASSIGNED"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    MOCK_PAID = "mock_paid"
    REFUNDED = "refunded"


class LedgerEntryType(str, enum.Enum):
    CHARGE = "charge"
    REFUND = "refund"


class LedgerStatus(str, enum.Enum):
    SUCCESS = "success"
    FAILED = "failed"


class ReturnStatus(str, enum.Enum):
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"


def enum_column(enum_cls: Type[enum.Enum]) -> SAEnum:
    """Store an Enum as a plain VARCHAR of its *values* (portable across PostgreSQL and SQLite)."""
    return SAEnum(
        enum_cls,
        native_enum=False,
        create_constraint=False,
        validate_strings=True,
        values_callable=lambda cls: [member.value for member in cls],
        length=max(len(member.value) for member in enum_cls),
    )
