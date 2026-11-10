from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.types import UTCDateTime, utcnow


class CreatedAtMixin:
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow, server_default=func.now()
    )


class TimestampMixin(CreatedAtMixin):
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow, onupdate=utcnow, server_default=func.now()
    )
