"""Small helpers shared by services when building queries."""
from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional, Tuple

from fastapi import HTTPException, status

LIKE_ESCAPE = "\\"


def like_pattern(term: str) -> str:
    """Build a `%term%` pattern for ILIKE, escaping the user's own % and _ wildcards.

    Use together with `.ilike(pattern, escape=LIKE_ESCAPE)`.
    """
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def date_bounds(date_from: Optional[date], date_to: Optional[date]) -> Tuple[Optional[datetime], Optional[datetime]]:
    """Inclusive dates → half-open UTC range [date_from 00:00, date_to + 1 day 00:00). 422 if from > to."""
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="date_from cannot be after date_to")
    start = datetime.combine(date_from, time.min, tzinfo=timezone.utc) if date_from else None
    end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc) if date_to else None
    return start, end


def date_range_conditions(column, date_from: Optional[date], date_to: Optional[date]) -> List:
    """SQLAlchemy conditions for an inclusive date filter on a timestamp column."""
    start, end = date_bounds(date_from, date_to)
    conditions = []
    if start is not None:
        conditions.append(column >= start)
    if end is not None:
        conditions.append(column < end)
    return conditions
