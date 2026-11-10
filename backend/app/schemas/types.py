"""Reusable, validated field types for request and response schemas."""
from decimal import Decimal

from pydantic import AfterValidator, Field, PlainSerializer, StringConstraints
from typing_extensions import Annotated

PersonName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]

# 10–15 digits, optional leading "+" (e.g. 9876543210 or +919876543210)
Phone = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\+?\d{10,15}$")]

# bcrypt only uses the first 72 bytes, so longer passwords are rejected instead of silently truncated.
Password = Annotated[str, Field(min_length=8, max_length=72)]

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=150)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=500)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)]
Category = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
ImageUrl = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500, pattern=r"^https?://\S+$")]

VehicleNumber = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=4, max_length=20),
    AfterValidator(lambda v: v.upper()),
]

# Money in requests: positive, at most 2 decimal places, below 1 crore.
PriceIn = Annotated[Decimal, Field(gt=0, lt=Decimal("10000000"), max_digits=10, decimal_places=2)]

# Money in responses: stored as exact Decimal, sent to the frontend as a plain JSON number (180.0).
Money = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float, when_used="json")]
