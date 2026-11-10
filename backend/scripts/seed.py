"""Demo data for local runs and evaluation. Idempotent: does nothing if the demo customer already exists.

Run:  python -m scripts.seed        (the Docker entrypoint runs it when SEED_DEMO_DATA=true)

All accounts use the password  Demo@1234  — local demo data only, not secrets.
"""
import sys
import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.db.types import utcnow
from app.models import (
    LedgerEntryType,
    MenuItem,
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusHistory,
    PaymentLedger,
    PaymentStatus,
    Restaurant,
    ReturnRequest,
    ReturnStatus,
    Review,
    User,
    UserRole,
    VehicleType,
)
from app.services import reminder_service

PASSWORD = "Demo@1234"
DOMAIN = "campusbite.dev"
S = OrderStatus
LIFECYCLE = [S.PLACED, S.ACCEPTED, S.PREPARING, S.READY, S.ASSIGNED, S.OUT_FOR_DELIVERY, S.DELIVERED]

RESTAURANTS = [
    {
        "owner": ("Ravi Kumar", "owner.curry"),
        "name": "Campus Curry House", "cuisine": "North Indian", "address": "Food Court, Block A, Main Campus",
        "phone": "9876500001", "description": "Home-style curries, tandoor breads and comfort thalis.",
        "menu": [
            ("Paneer Tikka", "Starters", "180", True, True), ("Chicken 65", "Starters", "210", False, True),
            ("Hara Bhara Kebab", "Starters", "150", True, True), ("Butter Chicken", "Mains", "260", False, True),
            ("Dal Makhani", "Mains", "170", True, True), ("Paneer Butter Masala", "Mains", "220", True, True),
            ("Veg Biryani", "Rice", "190", True, True), ("Chicken Biryani", "Rice", "240", False, False),
            ("Butter Naan", "Breads", "40", True, True), ("Garlic Naan", "Breads", "50", True, True),
            ("Sweet Lassi", "Drinks", "70", True, True), ("Gulab Jamun", "Desserts", "60", True, False),
        ],
    },
    {
        "owner": ("Priya Nair", "owner.pizza"),
        "name": "Byte Pizza", "cuisine": "Italian", "address": "Tech Park Plaza, Shop 4",
        "phone": "9876500002", "description": "Wood-fired pizzas and pasta for late-night coding sessions.",
        "menu": [
            ("Margherita", "Pizza", "220", True, True), ("Farmhouse", "Pizza", "280", True, True),
            ("Pepperoni", "Pizza", "320", False, True), ("BBQ Chicken", "Pizza", "340", False, True),
            ("Penne Arrabbiata", "Pasta", "240", True, True), ("Alfredo Pasta", "Pasta", "260", True, True),
            ("Garlic Bread", "Sides", "120", True, True), ("Cheesy Fries", "Sides", "140", True, False),
            ("Cold Coffee", "Drinks", "110", True, True), ("Tiramisu", "Desserts", "180", True, True),
        ],
    },
    {
        "owner": ("Ananya Iyer", "owner.green"),
        "name": "Green Bowl", "cuisine": "Healthy", "address": "Sports Complex, Ground Floor",
        "phone": "9876500003", "description": "Salads, bowls and smoothies — fresh fuel between classes.",
        "menu": [
            ("Quinoa Power Bowl", "Bowls", "230", True, True), ("Chicken Protein Bowl", "Bowls", "270", False, True),
            ("Greek Salad", "Salads", "190", True, True), ("Caesar Salad", "Salads", "210", False, True),
            ("Hummus Wrap", "Wraps", "170", True, True), ("Grilled Chicken Wrap", "Wraps", "200", False, False),
            ("Berry Smoothie", "Drinks", "150", True, True), ("Green Detox Juice", "Drinks", "130", True, True),
        ],
    },
]

# Dish photos from Wikimedia Commons (freely licensed; hotlinking allowed). Each URL was checked to load.
DISH_IMAGES = {
    "Paneer Tikka":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Paneer_tikka.jpg/500px-Paneer_tikka.jpg",
    "Chicken 65":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/Chicken_65.jpg/500px-Chicken_65.jpg",
    "Hara Bhara Kebab":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bb/Hara_bhara_kabab.JPG/500px-Hara_bhara_kabab.JPG",
    "Butter Chicken":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Butter_Chicken_%26_Butter_Naan_-_Home_-_Chandigarh_-_India_-_0006.jpg/500px-Butter_Chicken_%26_Butter_Naan_-_Home_-_Chandigarh_-_India_-_0006.jpg",
    "Dal Makhani":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Punjabi_style_Dal_Makhani.jpg/500px-Punjabi_style_Dal_Makhani.jpg",
    "Paneer Butter Masala":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5c/Paneer_Makhani_Veggie.jpeg/500px-Paneer_Makhani_Veggie.jpeg",
    "Veg Biryani":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/Vegetable_Biryani_IMG_001.jpg/500px-Vegetable_Biryani_IMG_001.jpg",
    "Chicken Biryani":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Hyderabadi_Chicken_Biryani.jpg/500px-Hyderabadi_Chicken_Biryani.jpg",
    "Butter Naan":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Annapurna_Naan.jpg/500px-Annapurna_Naan.jpg",
    "Garlic Naan":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Annapurna_Naan.jpg/330px-Annapurna_Naan.jpg",
    "Sweet Lassi":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f1/Salt_lassi.jpg/500px-Salt_lassi.jpg",
    "Gulab Jamun":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Gulab-jamun-wallpaper-1.jpg/500px-Gulab-jamun-wallpaper-1.jpg",
    "Margherita":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/Neapolitan_pizza_at_Trappica_%2848701940197%29.jpg/500px-Neapolitan_pizza_at_Trappica_%2848701940197%29.jpg",
    "Farmhouse":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/California_club_pizza.jpg/500px-California_club_pizza.jpg",
    "Pepperoni":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0c/Pepperoni_Pizza_%2829204589095%29.jpg/500px-Pepperoni_Pizza_%2829204589095%29.jpg",
    "BBQ Chicken":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e8/B.B.Q._Chicken_Pizza_%2826679384893%29.jpg/500px-B.B.Q._Chicken_Pizza_%2826679384893%29.jpg",
    "Penne Arrabbiata":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cd/Penne_Arrabbiata.jpg/500px-Penne_Arrabbiata.jpg",
    "Alfredo Pasta":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Fettuccine_Alfredo_originals.jpg/500px-Fettuccine_Alfredo_originals.jpg",
    "Garlic Bread":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Garlicbread.jpg/500px-Garlicbread.jpg",
    "Cheesy Fries":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Shake_shack_cheese_fries.jpg/500px-Shake_shack_cheese_fries.jpg",
    "Cold Coffee":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Affogato_al_Caffe.jpg/500px-Affogato_al_Caffe.jpg",
    "Tiramisu":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Tiramisu_-_Raffaele_Diomede.jpg/500px-Tiramisu_-_Raffaele_Diomede.jpg",
    "Quinoa Power Bowl":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/53/BuddhaBowlLot.jpg/500px-BuddhaBowlLot.jpg",
    "Chicken Protein Bowl":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Lemongrass_chicken_rice_bowl_with_kimchi.jpg/500px-Lemongrass_chicken_rice_bowl_with_kimchi.jpg",
    "Greek Salad":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Greece_Food_Horiatiki.JPG/500px-Greece_Food_Horiatiki.JPG",
    "Caesar Salad":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/Caesar_salad_%282%29.jpg/500px-Caesar_salad_%282%29.jpg",
    "Hummus Wrap":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/Falafel_Melt_Wrap_-_We_Love_Falafel_2023-09-27.jpg/500px-Falafel_Melt_Wrap_-_We_Love_Falafel_2023-09-27.jpg",
    "Grilled Chicken Wrap":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/Smoked_chicken_and_avocado_wrap.jpg/330px-Smoked_chicken_and_avocado_wrap.jpg",
    "Berry Smoothie":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0c/Kiwi_Smoothie.jpg/500px-Kiwi_Smoothie.jpg",
    "Green Detox Juice":
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/Aojiru-inbottles-forsale-dec18-2015.jpg/500px-Aojiru-inbottles-forsale-dec18-2015.jpg",
}

# Restaurant cover photos (Wikimedia Commons, CC BY / CC BY-SA). Cuisine shots, not real storefronts.
RESTAURANT_IMAGES = {
    "Campus Curry House":   # "North Indian Vegetarian Thali-MB51.jpg", CC BY-SA 4.0
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/North_Indian_Vegetarian_Thali-MB51.jpg/960px-North_Indian_Vegetarian_Thali-MB51.jpg",
    "Byte Pizza":           # "Pizza baking in Wood-fired oven.jpg", CC BY 2.0
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/Pizza_baking_in_Wood-fired_oven.jpg/960px-Pizza_baking_in_Wood-fired_oven.jpg",
    "Green Bowl":           # "Healthy salad bowl (42231145040).jpg", CC BY 2.0
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/Healthy_salad_bowl_%2842231145040%29.jpg/960px-Healthy_salad_bowl_%2842231145040%29.jpg",
}

ACTOR_FOR = {
    S.PLACED: "customer", S.CANCELLED: "customer", S.ACCEPTED: "owner", S.PREPARING: "owner", S.READY: "owner",
    S.ASSIGNED: "owner", S.REFUNDED: "owner", S.OUT_FOR_DELIVERY: "partner", S.DELIVERED: "partner",
}


def _user(db: Session, name: str, local: str, role: UserRole, **extra) -> User:
    user = User(name=name, email=f"{local}@{DOMAIN}", phone=extra.pop("phone", "9876543210"),
                password_hash=hash_password(PASSWORD), role=role, **extra)
    db.add(user)
    return user


def _path_to(final: OrderStatus) -> List[OrderStatus]:
    if final == S.CANCELLED:
        return [S.PLACED, S.CANCELLED]
    if final == S.REFUNDED:
        return LIFECYCLE + [S.REFUNDED]
    return LIFECYCLE[: LIFECYCLE.index(final) + 1]


def _order(
    db: Session, *, customer: User, restaurant: Restaurant, owner: User, lines: Sequence[Tuple[MenuItem, int]],
    placed_ago: timedelta, final: OrderStatus, partner: Optional[User] = None, step: timedelta = timedelta(minutes=7),
    cancelled_in_window: bool = False, last_update_ago: Optional[timedelta] = None,
) -> Order:
    now = utcnow()
    placed_at = now - placed_ago
    path = _path_to(final)
    times = [placed_at + step * i for i in range(len(path))]
    if final == S.CANCELLED:
        times[1] = placed_at + (timedelta(seconds=30) if cancelled_in_window else timedelta(minutes=5))
    if last_update_ago is not None:
        times[-1] = now - last_update_ago

    subtotal = sum((dish.price * qty for dish, qty in lines), Decimal("0.00"))
    fee = Decimal("30.00")
    order = Order(
        customer_id=customer.id, restaurant_id=restaurant.id,
        delivery_partner_id=partner.id if partner and S.ASSIGNED in path else None,
        status=final, payment_status=PaymentStatus.MOCK_PAID,
        subtotal=subtotal, delivery_fee=fee, total_amount=subtotal + fee,
        delivery_address=customer.default_address or "Hostel B, Room 214", contact_phone=customer.phone,
        status_updated_at=times[-1], cancellable_until=placed_at + timedelta(seconds=60),
        cancelled_at=times[-1] if final == S.CANCELLED else None,
        created_at=placed_at, updated_at=times[-1],
        items=[OrderItem(menu_item_id=d.id, item_name=d.name, unit_price=d.price, quantity=q,
                         line_total=d.price * q, created_at=placed_at) for d, q in lines],
    )
    db.add(order)
    db.flush()

    actors = {"customer": customer, "owner": owner, "partner": partner}
    previous = None
    for status, at in zip(path, times):
        actor = actors[ACTOR_FOR[status]]
        db.add(OrderStatusHistory(order_id=order.id, from_status=previous, to_status=status,
                                  changed_by_user_id=actor.id if actor else None, changed_at=at))
        previous = status

    db.add(PaymentLedger(order_id=order.id, entry_type=LedgerEntryType.CHARGE, amount=order.total_amount,
                         method="dummy", transaction_ref=f"MOCK-{uuid.uuid4().hex[:20].upper()}", created_at=placed_at))
    refund_note = "return_approved" if final == S.REFUNDED else ("free_cancellation_window" if cancelled_in_window else None)
    if refund_note:
        db.add(PaymentLedger(order_id=order.id, entry_type=LedgerEntryType.REFUND, amount=order.total_amount,
                             method="dummy", transaction_ref=f"MOCK-REFUND-{uuid.uuid4().hex[:16].upper()}",
                             note=refund_note, created_at=times[-1]))
        order.payment_status = PaymentStatus.REFUNDED
    return order


def backfill_images(db: Session) -> int:
    """Add photos to demo dishes and restaurants that have none (for databases seeded before images existed)."""
    updated = 0
    for model, images in ((MenuItem, DISH_IMAGES), (Restaurant, RESTAURANT_IMAGES)):
        for row in db.scalars(select(model).where(model.image_url.is_(None), model.name.in_(images))):
            row.image_url = images[row.name]
            updated += 1
    db.commit()
    return updated


def seed(db: Session) -> bool:
    if db.scalar(select(User).where(User.email == f"demo.customer@{DOMAIN}")):
        updated = backfill_images(db)
        print("Seed: demo data already present — skipping." + (f" Added {updated} missing photos." if updated else ""))
        return False

    asha = _user(db, "Asha Rao", "demo.customer", UserRole.CUSTOMER, phone="9876543210",
                 default_address="Hostel B, Room 214, North Campus")
    rohan = _user(db, "Rohan Mehta", "demo.customer2", UserRole.CUSTOMER, phone="9876543220",
                  default_address="PG Block C, Room 12")
    meena = _user(db, "Meena Shah", "rider.one", UserRole.DELIVERY_PARTNER, phone="9876543230",
                  vehicle_type=VehicleType.SCOOTER, vehicle_number="KA01AB1234")
    arjun = _user(db, "Arjun Das", "rider.two", UserRole.DELIVERY_PARTNER, phone="9876543240",
                  vehicle_type=VehicleType.BICYCLE, vehicle_number="CYCLE-007")

    owners: List[User] = []
    menus: List[Dict[str, MenuItem]] = []
    for spec in RESTAURANTS:
        name, local = spec["owner"]
        owner = _user(db, name, local, UserRole.RESTAURANT_OWNER, phone=spec["phone"])
        owner.restaurant = Restaurant(name=spec["name"], cuisine=spec["cuisine"], address=spec["address"],
                                      phone=spec["phone"], description=spec["description"],
                                      image_url=RESTAURANT_IMAGES.get(spec["name"]))
        dishes = {}
        for dish_name, category, price, veg, available in spec["menu"]:
            dish = MenuItem(name=dish_name, category=category, price=Decimal(price), is_veg=veg, is_available=available,
                            image_url=DISH_IMAGES.get(dish_name))
            owner.restaurant.menu_items.append(dish)
            dishes[dish_name] = dish
        owners.append(owner)
        menus.append(dishes)
    db.flush()

    (curry_owner, pizza_owner, green_owner) = owners
    curry, pizza, green = (o.restaurant for o in owners)
    cm, pm, gm = menus
    d, h, m = timedelta(days=1), timedelta(hours=1), timedelta(minutes=1)

    def order(customer, idx, lines, **kw):
        owner = owners[idx]
        return _order(db, customer=customer, restaurant=owner.restaurant, owner=owner, lines=lines, **kw)

    # ---- Asha's history (covers every status for the dashboards and the AI insights) ----
    o1 = order(asha, 0, [(cm["Paneer Tikka"], 2), (cm["Butter Naan"], 4)], placed_ago=2 * d, final=S.DELIVERED, partner=meena)
    db.add(Review(order_id=o1.id, customer_id=asha.id, restaurant_id=curry.id, rating=5,
                  comment="Paneer was perfectly charred. Naan arrived hot!", created_at=o1.status_updated_at + h))
    o2 = order(asha, 1, [(pm["Farmhouse"], 1), (pm["Garlic Bread"], 1)], placed_ago=1 * d, final=S.DELIVERED, partner=arjun)
    db.add(ReturnRequest(order_id=o2.id, customer_id=asha.id, status=ReturnStatus.REQUESTED,
                         reason="The pizza arrived cold and the garlic bread was missing.", created_at=o2.status_updated_at + h))
    o3 = order(asha, 2, [(gm["Chicken Protein Bowl"], 1), (gm["Berry Smoothie"], 1)], placed_ago=9 * d,
               final=S.REFUNDED, partner=meena, step=timedelta(hours=3))
    db.add(ReturnRequest(order_id=o3.id, customer_id=asha.id, status=ReturnStatus.APPROVED,
                         reason="Found a plastic piece in the bowl.", resolved_at=o3.status_updated_at,
                         resolved_by=green_owner.id, created_at=o3.status_updated_at - h))
    order(asha, 0, [(cm["Butter Chicken"], 1), (cm["Garlic Naan"], 2)], placed_ago=3 * d, final=S.CANCELLED,
          cancelled_in_window=True)
    order(asha, 1, [(pm["Pepperoni"], 1)], placed_ago=12 * d, final=S.CANCELLED, cancelled_in_window=False)
    order(asha, 0, [(cm["Veg Biryani"], 1), (cm["Sweet Lassi"], 1)], placed_ago=40 * m, final=S.OUT_FOR_DELIVERY,
          partner=meena, step=6 * m)
    order(asha, 1, [(pm["Margherita"], 2)], placed_ago=25 * m, final=S.READY, step=5 * m)
    order(asha, 0, [(cm["Dal Makhani"], 1), (cm["Butter Naan"], 2)], placed_ago=22 * m, final=S.PLACED)   # stale → reminder
    order(asha, 1, [(pm["Alfredo Pasta"], 1), (pm["Cold Coffee"], 1)], placed_ago=35 * m, final=S.ACCEPTED,
          last_update_ago=18 * m)                                                                         # stale → reminder
    o10 = order(asha, 2, [(gm["Quinoa Power Bowl"], 1), (gm["Green Detox Juice"], 1)], placed_ago=20 * d,
                final=S.DELIVERED, partner=arjun)
    db.add(Review(order_id=o10.id, customer_id=asha.id, restaurant_id=green.id, rating=4,
                  comment="Healthy and filling. Could use more dressing.", created_at=o10.status_updated_at + h))
    order(asha, 0, [(cm["Paneer Butter Masala"], 1), (cm["Butter Naan"], 3)], placed_ago=35 * d, final=S.DELIVERED, partner=meena)
    order(asha, 0, [(cm["Paneer Tikka"], 1), (cm["Sweet Lassi"], 2)], placed_ago=5 * h, final=S.DELIVERED, partner=arjun, step=8 * m)

    # ---- Rohan: a few delivered + reviewed orders so ratings look realistic ----
    r1 = order(rohan, 1, [(pm["BBQ Chicken"], 1), (pm["Tiramisu"], 1)], placed_ago=4 * d, final=S.DELIVERED, partner=arjun)
    db.add(Review(order_id=r1.id, customer_id=rohan.id, restaurant_id=pizza.id, rating=4, comment="Great crust.",
                  created_at=r1.status_updated_at + h))
    r2 = order(rohan, 0, [(cm["Chicken 65"], 1), (cm["Garlic Naan"], 2)], placed_ago=6 * d, final=S.DELIVERED, partner=meena)
    db.add(Review(order_id=r2.id, customer_id=rohan.id, restaurant_id=curry.id, rating=4, comment="Spicy and tasty.",
                  created_at=r2.status_updated_at + h))
    r3 = order(rohan, 2, [(gm["Greek Salad"], 1), (gm["Hummus Wrap"], 1)], placed_ago=8 * d, final=S.DELIVERED, partner=meena)
    db.add(Review(order_id=r3.id, customer_id=rohan.id, restaurant_id=green.id, rating=5, comment="Fresh!",
                  created_at=r3.status_updated_at + h))
    order(rohan, 2, [(gm["Caesar Salad"], 1), (gm["Berry Smoothie"], 2)], placed_ago=30 * m, final=S.ASSIGNED,
          partner=arjun, step=6 * m)                                                                      # rider.two: to pick up
    order(rohan, 0, [(cm["Hara Bhara Kebab"], 1), (cm["Garlic Naan"], 2)], placed_ago=12 * m, final=S.PREPARING, step=3 * m)

    db.commit()
    created = reminder_service.scan(db)   # stale orders above get their reminders straight away
    counts = {label: db.query(model).count() for label, model in
              (("users", User), ("restaurants", Restaurant), ("dishes", MenuItem), ("orders", Order))}
    print("Seed: created " + ", ".join(f"{n} {label}" for label, n in counts.items())
          + f", {created} reminders. Password for all demo accounts: {PASSWORD}")
    return True


def main() -> int:
    db = SessionLocal()
    try:
        seed(db)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
