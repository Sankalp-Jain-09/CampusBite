from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime
from sqlalchemy.types import TypeDecorator


def utcnow() -> datetime:
    """Current time as a timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """`TIMESTAMP WITH TIME ZONE` that always hands back timezone-aware UTC datetimes.

    PostgreSQL already returns aware values; SQLite (used in tests) returns naive ones,
    so naive values are treated as UTC. This keeps time comparisons (e.g. the 60-second
    cancellation window) identical on both databases.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: Optional[datetime], dialect) -> Optional[datetime]:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value: Optional[datetime], dialect) -> Optional[datetime]:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
