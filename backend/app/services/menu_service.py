from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import MenuItem, Restaurant, User
from app.schemas.common import PaginationParams, paginate
from app.schemas.menu import MenuItemCreate, MenuItemUpdate, MenuSort
from app.services.query_utils import LIKE_ESCAPE, like_pattern
from app.services.restaurant_service import get_owner_restaurant, get_restaurant_or_404

MENU_ITEM_NOT_FOUND = "Menu item not found"

_SORTS = {
    MenuSort.NAME: (MenuItem.name.asc(), MenuItem.id.asc()),
    MenuSort.PRICE_ASC: (MenuItem.price.asc(), MenuItem.id.asc()),
    MenuSort.PRICE_DESC: (MenuItem.price.desc(), MenuItem.id.asc()),
}


# ---------------- Public ----------------

def list_public_menu(
    db: Session,
    restaurant_id: int,
    params: PaginationParams,
    search: Optional[str] = None,
    min_price: Optional[Decimal] = None,
    max_price: Optional[Decimal] = None,
    category: Optional[str] = None,
    veg: Optional[bool] = None,
    sort: MenuSort = MenuSort.NAME,
) -> dict:
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="min_price cannot be greater than max_price",
        )
    get_restaurant_or_404(db, restaurant_id)

    stmt = select(MenuItem).where(
        MenuItem.restaurant_id == restaurant_id,
        MenuItem.is_deleted.is_(False),
        MenuItem.is_available.is_(True),
    )
    if search:
        stmt = stmt.where(MenuItem.name.ilike(like_pattern(search), escape=LIKE_ESCAPE))
    if min_price is not None:
        stmt = stmt.where(MenuItem.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(MenuItem.price <= max_price)
    if category:
        stmt = stmt.where(func.lower(MenuItem.category) == category.strip().lower())
    if veg is not None:
        stmt = stmt.where(MenuItem.is_veg.is_(veg))
    stmt = stmt.order_by(*_SORTS[sort])
    return paginate(db, stmt, params)


def list_public_categories(db: Session, restaurant_id: int) -> List[str]:
    get_restaurant_or_404(db, restaurant_id)
    rows = db.scalars(
        select(MenuItem.category)
        .where(
            MenuItem.restaurant_id == restaurant_id,
            MenuItem.is_deleted.is_(False),
            MenuItem.is_available.is_(True),
        )
        .distinct()
        .order_by(MenuItem.category)
    )
    return list(rows)


def get_public_menu_item(db: Session, item_id: int) -> MenuItem:
    item = db.scalar(select(MenuItem).where(MenuItem.id == item_id, MenuItem.is_deleted.is_(False)))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=MENU_ITEM_NOT_FOUND)
    return item


# ---------------- Owner ----------------

def get_owned_menu_item(db: Session, owner: User, item_id: int) -> MenuItem:
    """Load a dish only if it belongs to the caller's restaurant; otherwise 404 (never reveal others' dishes)."""
    item = db.scalar(
        select(MenuItem)
        .join(Restaurant, Restaurant.id == MenuItem.restaurant_id)
        .where(
            MenuItem.id == item_id,
            Restaurant.owner_id == owner.id,
            MenuItem.is_deleted.is_(False),
        )
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=MENU_ITEM_NOT_FOUND)
    return item


def list_owner_menu(
    db: Session,
    owner: User,
    params: PaginationParams,
    search: Optional[str] = None,
    available: Optional[bool] = None,
    category: Optional[str] = None,
) -> dict:
    restaurant = get_owner_restaurant(db, owner)
    stmt = select(MenuItem).where(MenuItem.restaurant_id == restaurant.id, MenuItem.is_deleted.is_(False))
    if search:
        stmt = stmt.where(MenuItem.name.ilike(like_pattern(search), escape=LIKE_ESCAPE))
    if available is not None:
        stmt = stmt.where(MenuItem.is_available.is_(available))
    if category:
        stmt = stmt.where(func.lower(MenuItem.category) == category.strip().lower())
    stmt = stmt.order_by(MenuItem.category, MenuItem.name, MenuItem.id)
    return paginate(db, stmt, params)


def create_menu_item(db: Session, owner: User, data: MenuItemCreate) -> MenuItem:
    restaurant = get_owner_restaurant(db, owner)
    item = MenuItem(restaurant_id=restaurant.id, **data.model_dump())
    db.add(item)
    db.commit()
    return item


def update_menu_item(db: Session, owner: User, item_id: int, data: MenuItemUpdate) -> MenuItem:
    item = get_owned_menu_item(db, owner, item_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    return item


def set_availability(db: Session, owner: User, item_id: int, is_available: bool) -> MenuItem:
    item = get_owned_menu_item(db, owner, item_id)
    item.is_available = is_available
    db.commit()
    return item


def soft_delete_menu_item(db: Session, owner: User, item_id: int) -> None:
    """Hide the dish everywhere but keep the row, so past orders still reference it (D12)."""
    item = get_owned_menu_item(db, owner, item_id)
    item.is_deleted = True
    db.commit()
