from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import DbSession
from app.schemas.common import Page, PaginationParams
from app.schemas.menu import MenuItemOut, MenuSort
from app.schemas.restaurant import RestaurantPublic
from app.schemas.review import ReviewPublic
from app.services import menu_service, restaurant_service

router = APIRouter(tags=["Restaurants (public)"])

_NOT_FOUND = {404: {"description": "Not found"}}


@router.get("/restaurants", response_model=Page[RestaurantPublic], summary="List restaurants")
def list_restaurants(
    db: DbSession,
    params: PaginationParams = Depends(),
    search: Optional[str] = Query(None, max_length=100, description="Matches restaurant name or cuisine"),
    cuisine: Optional[str] = Query(None, max_length=100, description="Exact cuisine (case-insensitive)"),
):
    """Browse restaurants with average rating and review count. No login required."""
    return restaurant_service.list_restaurants(db, params, search=search, cuisine=cuisine)


@router.get("/restaurants/{restaurant_id}", response_model=RestaurantPublic,
            summary="Restaurant details", responses=_NOT_FOUND)
def get_restaurant(restaurant_id: int, db: DbSession):
    return restaurant_service.get_restaurant_public(db, restaurant_id)


@router.get(
    "/restaurants/{restaurant_id}/menu",
    response_model=Page[MenuItemOut],
    summary="Search and filter a restaurant's menu",
    responses={**_NOT_FOUND, 422: {"description": "Invalid filters (e.g. min_price > max_price)"}},
)
def get_menu(
    restaurant_id: int,
    db: DbSession,
    params: PaginationParams = Depends(),
    search: Optional[str] = Query(None, max_length=100, description="Dish name contains (case-insensitive)"),
    min_price: Optional[Decimal] = Query(None, ge=0),
    max_price: Optional[Decimal] = Query(None, ge=0),
    category: Optional[str] = Query(None, max_length=100),
    veg: Optional[bool] = Query(None, description="true = veg only, false = non-veg only"),
    sort: MenuSort = Query(MenuSort.NAME),
):
    """Only available, non-deleted dishes are shown."""
    return menu_service.list_public_menu(
        db, restaurant_id, params,
        search=search, min_price=min_price, max_price=max_price, category=category, veg=veg, sort=sort,
    )


@router.get("/restaurants/{restaurant_id}/categories", response_model=List[str],
            summary="Menu categories of a restaurant", responses=_NOT_FOUND)
def get_categories(restaurant_id: int, db: DbSession):
    """Distinct categories of available dishes (for the menu category filter)."""
    return menu_service.list_public_categories(db, restaurant_id)


@router.get("/restaurants/{restaurant_id}/reviews", response_model=Page[ReviewPublic],
            summary="Restaurant reviews", responses=_NOT_FOUND)
def get_reviews(restaurant_id: int, db: DbSession, params: PaginationParams = Depends()):
    return restaurant_service.list_reviews(db, restaurant_id, params)


@router.get("/menu-items/{item_id}", response_model=MenuItemOut, summary="Dish details", responses=_NOT_FOUND)
def get_menu_item(item_id: int, db: DbSession):
    return menu_service.get_public_menu_item(db, item_id)
