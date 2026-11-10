# P2 — Restaurant Catalog & Menu Management

**Status:** ✅ Done (90 tests passing; verified on a live server)
**Depends on:** P1 · **Unblocks:** P3 (checkout needs menu items), P8 and P9 UI

## Goal

Public browsing of restaurants and menus with search and filters, and full menu management for restaurant owners.

## Scope

| In scope | Out of scope |
|---|---|
| Restaurant list and detail with average rating | Image upload (URLs only) |
| Menu search and filter by name, price, category and veg | Global cross-restaurant dish search (optional extra) |
| Owner restaurant profile view and edit | Restaurant opening hours |
| Owner dish CRUD, availability toggle, soft delete | |
| Public reviews list (read only; review creation is in P4) | |

## Design

### Public endpoints (`app/api/v1/restaurants.py`): no auth needed
| Method | Path | Query params | Notes |
|---|---|---|---|
| GET | `/restaurants` | `search`, `cuisine`, `page`, `page_size` | `search` matches name or cuisine with `ILIKE`. Each item includes `avg_rating` and `review_count`, computed with an outer join + `func.avg` / `func.count` grouped by restaurant. |
| GET | `/restaurants/{id}` | — | 404 if not found |
| GET | `/restaurants/{id}/menu` | `search`, `min_price`, `max_price`, `category`, `veg`, `sort` (`price_asc` / `price_desc` / `name`), `page`, `page_size` | Only `is_available = true` and `is_deleted = false`. `min_price > max_price` → 422. |
| GET | `/menu-items/{id}` | — | 404 if deleted |
| GET | `/restaurants/{id}/reviews` | `page`, `page_size` | Newest first, with the reviewer's first name only |

**Query building (SQLAlchemy 2.0 style):**
```python
stmt = select(MenuItem).where(MenuItem.restaurant_id == rid,
                              MenuItem.is_deleted.is_(False),
                              MenuItem.is_available.is_(True))
if search:    stmt = stmt.where(MenuItem.name.ilike(f"%{search}%"))
if min_price is not None: stmt = stmt.where(MenuItem.price >= min_price)
if max_price is not None: stmt = stmt.where(MenuItem.price <= max_price)
if category:  stmt = stmt.where(MenuItem.category == category)
if veg is not None: stmt = stmt.where(MenuItem.is_veg.is_(veg))
stmt = stmt.order_by(SORTS[sort])
return paginate(db, stmt, params)
```

### Owner endpoints (`app/api/v1/owner.py`): `require_roles(restaurant_owner)` on the router
| Method | Path | Body / params | Notes |
|---|---|---|---|
| GET | `/owner/restaurant` | — | The caller's restaurant |
| PUT | `/owner/restaurant` | `RestaurantUpdate` (name, description, cuisine, address, phone, image_url, is_open) | |
| GET | `/owner/menu-items` | `search`, `available`, `page`, `page_size` | Includes unavailable items; excludes deleted ones |
| POST | `/owner/menu-items` | `MenuItemCreate` (name, description?, category, price > 0, is_veg, is_available = true, image_url?) | 201 |
| PUT | `/owner/menu-items/{id}` | `MenuItemUpdate` (all optional) | 404 if the item isn't in the caller's restaurant |
| PATCH | `/owner/menu-items/{id}/availability` | `{is_available: bool}` | |
| DELETE | `/owner/menu-items/{id}` | — | Soft delete (`is_deleted = true`) → 204 (D12) |

**Ownership helper** (`services/menu_service.py`):
```python
def get_owned_menu_item(db, owner: User, item_id) -> MenuItem:
    item = db.scalar(select(MenuItem).join(Restaurant)
                     .where(MenuItem.id == item_id, Restaurant.owner_id == owner.id,
                            MenuItem.is_deleted.is_(False)))
    if not item: raise HTTPException(404, "Menu item not found")
    return item
```

### Schemas (`app/schemas/restaurant.py`, `menu.py`)
`RestaurantOut`, `RestaurantListItem` (with avg_rating and review_count), `RestaurantUpdate`, `MenuItemOut`, `MenuItemCreate`, `MenuItemUpdate`, `AvailabilityUpdate`, `ReviewOut`.

Prices are `Decimal` in the DB and **sent as JSON numbers** (e.g. `180.0`) through the shared `Money` type. Request prices use `PriceIn` (> 0, max 2 decimal places).

## Files to create
```
app/schemas/restaurant.py, menu.py, review.py
app/services/restaurant_service.py, menu_service.py
app/api/v1/restaurants.py, owner.py (menu part)
tests/test_catalog.py, tests/test_owner_menu.py
```

## Tasks
- [x] Restaurant list with search, cuisine filter, rating aggregate and pagination
- [x] Restaurant detail, menu endpoint with all filters and sorts, menu item detail
- [x] Public reviews list
- [x] Owner restaurant GET and PUT
- [x] Owner menu list, create, update, availability, soft delete
- [x] Ownership helper used by every owner menu route

## Tests
- [x] Name search is case-insensitive and partial
- [x] Price range returns only items within the bounds; `min > max` → 422
- [x] Unavailable and deleted items are hidden from the public menu but unavailable ones appear in the owner list
- [x] Sorts return the correct order
- [x] Pagination: `total`, `pages` and page-2 contents are correct
- [x] Owner A editing, toggling or deleting owner B's dish → 404
- [x] Customer or delivery partner calling `/owner/menu-items` → 403; no token → 401
- [x] Price ≤ 0 → 422

## Done when
An owner can fully manage their menu through Swagger, and the public restaurant and menu search and filters return the correct, paginated results.

## Implementation notes (as built)

**Endpoints delivered**: all of those in the tables above, plus:
- `GET /restaurants/{id}/categories`: the distinct categories of visible dishes, for the P8 category dropdown.

**Decisions made while building**
| Topic | Decision |
|---|---|
| Price format | Decimal in the DB, JSON number in responses (`Money` type), validated `PriceIn` on input (> 0, 2 decimal places, < 1 crore) |
| Search safety | User-typed `%` and `_` are escaped (`like_pattern()`), so `search=%` matches nothing instead of everything |
| Restaurant search | `search` matches name **or** cuisine; `cuisine` is an exact, case-insensitive filter |
| Category filter | Case-insensitive exact match |
| Stable pagination | Every sort has `id` as a tie-breaker, so pages don't shuffle |
| Closed restaurants | Still listed and browsable (shown with an `is_open` badge); P3 checkout will refuse their orders |
| Unavailable dishes | Hidden from the public menu and categories, but `GET /menu-items/{id}` still returns them with `is_available: false`; deleted dishes → 404 |
| Updates | `PUT /owner/restaurant` and `PUT /owner/menu-items/{id}` change **only the fields sent**. Sending `null` for a required field → 422. `description` and `image_url` can be cleared with `null`. |
| Unknown fields | Owner write schemas use `extra="forbid"`, so e.g. a `restaurant_id` in the body → 422 (a dish can't be planted in another restaurant) |
| Image URLs | Must start with `http://` or `https://` (max 500 characters) |
| Public data | The public restaurant view hides `owner_id`; public reviews show only the reviewer's first name |
| Role check | The owner router has `dependencies=[Depends(owner_required)]`, so every current and future `/owner/*` route is protected. The same shared callable is used in `CurrentOwner`, so the check runs once per request. |

**Files**
```
app/schemas/types.py        (+ Money, PriceIn, Category, Description, ImageUrl)
app/schemas/restaurant.py   (+ RestaurantUpdate, RestaurantPublic)
app/schemas/menu.py         MenuSort, MenuItemOut, MenuItemCreate, MenuItemUpdate, AvailabilityUpdate
app/schemas/review.py       ReviewPublic
app/services/query_utils.py like_pattern (escaped ILIKE)
app/services/restaurant_service.py, menu_service.py
app/api/v1/restaurants.py, owner.py
app/api/deps.py             (+ shared customer_required / owner_required / delivery_partner_required)
tests/factories.py          (+ make_menu_item, make_order, make_review)
tests/test_catalog.py (24 tests), tests/test_owner_menu.py (25 tests)
```

**Verification log**
- [x] `pytest`: 90 passed, no warnings
- [x] Live server: an owner signs up → adds 4 dishes → toggles one unavailable → updates a price → deletes one (204). The public listing, price-desc sort, price range, categories and the owner list (including unavailable dishes) are all correct. Customer on `/owner/menu-items` → 403; `min_price > max_price` → 422.
