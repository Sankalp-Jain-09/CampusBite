import math
from typing import Generic, List, TypeVar

from fastapi import Query
from pydantic import BaseModel
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

T = TypeVar("T")

MAX_PAGE_SIZE = 50


class Page(BaseModel, Generic[T]):
    """Standard paginated response used by every list endpoint."""

    items: List[T]
    total: int
    page: int
    page_size: int
    pages: int


class PaginationParams:
    """FastAPI dependency for `?page=&page_size=` (page_size capped at 50)."""

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number (1-based)"),
        page_size: int = Query(10, ge=1, le=MAX_PAGE_SIZE, description="Items per page (max 50)"),
    ):
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def paginate(db: Session, stmt: Select, params: PaginationParams, scalars: bool = True) -> dict:
    """Run `stmt` with LIMIT/OFFSET plus a COUNT query and return a dict matching `Page`.

    `scalars=True` returns ORM objects; `scalars=False` returns Row objects (for aggregate queries).
    """
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    paged = stmt.limit(params.page_size).offset(params.offset)
    items = db.scalars(paged).all() if scalars else db.execute(paged).all()
    return {
        "items": items,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "pages": math.ceil(total / params.page_size) if total else 0,
    }
