# CampusBite — Manual UI Test Plan

A step-by-step checklist to test every feature through the browser. Tick each box as you go and note any failure in the [bug log](#bug-log) at the end.

> **Last run: 9–10 Nov 2026, automated with Playwright. All 143 cases pass** (138 plan cases plus 5 regression checks in section 11) on SQLite. Sections 1–7 and the regression checks passed again on Docker Compose with PostgreSQL 16. Sections 8–10 restart the backend, so they ran on SQLite only; they don't depend on the database. The first run found 8 bugs; all are fixed. Details, measurements and 37 extra edge cases are in [UI_TEST_REPORT.md](UI_TEST_REPORT.md). The boxes below show that run's results; clear them (`[ ]`) to run the plan again.

**Legend:** `[ ]` not run · `[x]` passed · write ❌ and a bug ID next to a failed test.

---

## 0. Setup

### 0.1 Start the app
| Part | Command | URL |
|---|---|---|
| Backend (Docker) | `docker compose up --build` (repo root, after creating `.env`) | http://localhost:8000/docs |
| Backend (local, no Docker) | `cd backend && DATABASE_URL=sqlite:///campusbite.db JWT_SECRET_KEY=dev alembic upgrade head && python -m scripts.seed && DATABASE_URL=sqlite:///campusbite.db JWT_SECRET_KEY=dev uvicorn app.main:app --port 8000` | http://localhost:8000/docs |
| Frontend | `cd frontend && npm install && npm run dev` | **http://localhost:5173** |

- [x] **S-01** http://localhost:8000/api/v1/health returns `{"status":"ok","db":"ok"}`
- [x] **S-02** http://localhost:5173 shows the CampusBite home page with 3 restaurants

### 0.2 Demo accounts (password for all: `Demo@1234`)
| Role | Email |
|---|---|
| Customer | `demo.customer@campusbite.dev` (Asha Rao) |
| Customer 2 | `demo.customer2@campusbite.dev` (Rohan Mehta) |
| Owner | `owner.curry@campusbite.dev` (Campus Curry House) |
| Owner | `owner.pizza@campusbite.dev` (Byte Pizza) |
| Owner | `owner.green@campusbite.dev` (Green Bowl) |
| Rider | `rider.one@campusbite.dev` (Meena Shah) |
| Rider | `rider.two@campusbite.dev` (Arjun Das) |

### 0.3 Tips
- **Testing two roles at once:** use a normal window for one role and a **private/incognito window** for the other. Tabs in the same window share one login, so logging in as someone else in another tab switches every tab to that account.
- **Mobile tests:** open DevTools (F12) → toggle the device toolbar (Ctrl/Cmd + Shift + M) → choose an iPhone-size screen.
- **Starting over with fresh demo data:**
  - Docker: `docker compose down -v && docker compose up --build`
  - local run: delete the SQLite file, then run `alembic upgrade head` and `python -m scripts.seed`
- **What's in the demo data:**
  - **Asha's active orders:** one PLACED (Curry House, stale), one ACCEPTED (Byte Pizza, stale), one READY (Byte Pizza) and one OUT_FOR_DELIVERY (Curry House, rider Meena).
  - **Asha's past orders:** several delivered, 2 cancelled, 1 refunded, and 1 delivered Byte Pizza order with a **pending return**.
  - **Unavailable dishes:** Chicken Biryani and Gulab Jamun (Curry House), Cheesy Fries (Byte Pizza), Grilled Chicken Wrap (Green Bowl).
- **Tests change the data.** Later expectations assume the earlier steps ran in order. For example, C-30 adds a 4★ review, so O-01 then shows 4.3 ★.
- **AI tests without an OpenAI key:** point `OPENAI_BASE_URL` at a local stub that speaks the chat-completions API, for example `doc/ui-test-run/scripts/openai_stub.py`. Set any non-empty `OPENAI_API_KEY`.

---

## 1. Public pages & navigation (logged out)

- [x] **P-01 Home page**
  - Steps: open http://localhost:5173 while logged out.
  - Expected: hero banner "Campus food, delivered."; "3 restaurants"; cards for Byte Pizza, Campus Curry House and Green Bowl, each with a rating badge (4.0 ★ (1), 4.5 ★ (2), 4.5 ★ (2)); navbar shows Restaurants, **Log in**, **Sign up**.
- [x] **P-02 Search restaurants**
  - Steps: type `pizza` in "Search restaurants or cuisines…".
  - Expected: after a short pause, only Byte Pizza is shown. Typing `healthy` (a cuisine) shows only Green Bowl.
- [x] **P-03 Cuisine filter**
  - Steps: clear the search and pick "North Indian" in "All cuisines".
  - Expected: only Campus Curry House.
- [x] **P-04 No results**
  - Steps: search `zzz`.
  - Expected: "No restaurants found" empty state.
- [x] **P-05 Browse a menu as a guest**
  - Steps: open Campus Curry House.
  - Expected: the menu with dish photos, prices and veg/non-veg marks; Chicken Biryani and Gulab Jamun (unavailable) are **not** listed; reviews appear at the bottom.
- [x] **P-06 Guests can't add to the cart**
  - Steps: click **Add** on any dish.
  - Expected: a "Log in to start your order" toast, then the login page. After logging in as the customer, you return to the same menu.
- [x] **P-07 Footer links**
  - Steps: click "Partner with us", then "Ride with us".
  - Expected: the restaurant signup and delivery-partner signup pages open.
- [x] **P-08 Protected page while logged out**
  - Steps: open http://localhost:5173/customer/dashboard directly.
  - Expected: redirected to the login page.
- [x] **P-09 404 page**
  - Steps: open http://localhost:5173/does-not-exist.
  - Expected: "404 · Page not found" with a "Go home" button.

---

## 2. Registration & login

### 2.1 Customer signup (`/register`)
- [x] **A-01 Validation**
  - Steps: click **Create account** with every field empty.
  - Expected: errors under the fields (Name, "Email is required", Phone, Password). Nothing is submitted.
- [x] **A-02 Field rules**
  - Steps: enter email `abc`, phone `123`, password `short`, and a different confirm password.
  - Expected: "Enter a valid email address", "Enter 10–15 digits…", "Use at least 8 characters", "Passwords do not match".
- [x] **A-03 Successful signup**
  - Steps: fill in valid details (a new email, phone `9876543299`, password `Secret123` twice, address optional) → **Create account**.
  - Expected: logged in automatically and taken to the home page with "Hungry, \<first name\>?"; navbar shows My orders, AI insights, Cart, your name and "Customer".
- [x] **A-04 Duplicate email**
  - Steps: log out and sign up again with `demo.customer@campusbite.dev`.
  - Expected: "An account with this email already exists".

### 2.2 Restaurant owner signup (`/partner/register`)
- [x] **A-05 Validation**
  - Steps: submit with the Restaurant details left empty.
  - Expected: errors under Restaurant name, Cuisine, Address and Restaurant phone.
- [x] **A-06 Successful signup**
  - Steps: fill in the owner and restaurant details → **Register restaurant**.
  - Expected: you land on the **owner dashboard** showing your new restaurant's name with an "Open" badge.
- [x] **A-07 New restaurant is public**
  - Steps: log out → home page.
  - Expected: the new restaurant appears in the list ("No reviews yet").

### 2.3 Delivery partner signup (`/delivery/register`)
- [x] **A-08 Vehicle details required**
  - Steps: submit without a vehicle type or number.
  - Expected: "Vehicle type is required" and the vehicle number error.
- [x] **A-09 Successful signup**
  - Steps: fill in valid details (vehicle type Scooter, number `ka01xy9999`) → **Join as delivery partner**.
  - Expected: you land on "Hi \<name\>, your deliveries" with "No deliveries right now".

### 2.4 Login / logout
- [x] **A-10 Wrong password**
  - Steps: log in as `demo.customer@campusbite.dev` with password `wrong123`.
  - Expected: "Invalid email or password".
- [x] **A-11 Unknown email**
  - Steps: log in as `nobody@campusbite.dev`.
  - Expected: the **same** message, "Invalid email or password".
- [x] **A-12 Redirect by role**
  - Steps: log in as each of the customer, `owner.curry` and `rider.one`.
  - Expected: customer → restaurant list; owner → owner dashboard; rider → deliveries page.
- [x] **A-13 Demo accounts box**
  - Steps: on the login page, expand "Demo accounts (seeded data)".
  - Expected: it shows the password and three demo emails.
- [x] **A-14 Stay logged in after refresh**
  - Steps: log in, then refresh the page (F5).
  - Expected: still logged in, on the same page.
- [x] **A-15 Log out**
  - Steps: click **Log out**.
  - Expected: back on the login page; the navbar shows Log in and Sign up.
- [x] **A-16 Expired or invalid session**
  - Steps: while logged in, open DevTools → Application → Local Storage → change `campusbite_token` to `abc` → click any navbar link that loads data.
  - Expected: redirected to login with "Your session expired. Please log in again."
- [x] **A-17 Logged-in users skip the login page**
  - Steps: while logged in as the owner, open http://localhost:5173/login.
  - Expected: redirected to the owner dashboard.

---

## 3. Customer

*Log in as `demo.customer@campusbite.dev` unless a test says otherwise.*

### 3.1 Menu search, filter, sort
- [x] **C-01 Search dishes**
  - Steps: Campus Curry House → type `butter` in "Search dishes…".
  - Expected: Butter Chicken, Butter Naan and Paneer Butter Masala.
- [x] **C-02 Price range**
  - Steps: Min ₹ `100`, Max ₹ `200`.
  - Expected: only dishes priced 100–200 (e.g. Paneer Tikka ₹180, Dal Makhani ₹170, Hara Bhara Kebab ₹150, Veg Biryani ₹190).
- [x] **C-03 Invalid price range**
  - Steps: Min `300`, Max `100`.
  - Expected: the error "min_price cannot be greater than max_price".
- [x] **C-04 Category & veg filters**
  - Steps: choose category "Mains", then "Non-veg only".
  - Expected: Mains only, then just Butter Chicken.
- [x] **C-05 Sorting**
  - Steps: Sort by "Price: low to high", then "Price: high to low".
  - Expected: the order changes to match each choice.
- [x] **C-06 Filters stay in the URL**
  - Steps: apply a filter → copy the URL → open it in a new tab (logged in as the same user).
  - Expected: the same filters are applied. **Clear filters** resets them.
- [x] **C-07 Dish photos**
  - Steps: look at the dish cards.
  - Expected: every dish shows a photo of that dish.

### 3.2 Cart
- [x] **C-08 Add & steppers**
  - Steps: Campus Curry House → **Add** Paneer Tikka → click **+** twice → **Add** Butter Naan.
  - Expected: Paneer Tikka shows a stepper with quantity 3; the navbar Cart badge shows 4; the "Your cart" side panel (desktop) lists both items with the subtotal.
- [x] **C-09 Single-restaurant rule**
  - Steps: go to Byte Pizza → **Add** Margherita.
  - Expected: a "Start a new cart?" dialog. **Cancel** keeps the old cart. **Clear cart & add** replaces it with Margherita only.
- [x] **C-10 Cart page**
  - Steps: click Cart in the navbar.
  - Expected: items with steppers, line totals, Remove buttons and "Bill details" (Subtotal, Delivery fee ₹30, Total).
- [x] **C-11 Update / remove**
  - Steps: change a quantity with the stepper; click **Remove**; use **−** down to 0.
  - Expected: the totals update; an item at quantity 0 disappears; an empty cart shows "Your cart is empty".
- [x] **C-12 Cart kept after refresh**
  - Steps: add items → refresh the page.
  - Expected: the cart is still there. Log out and in as Rohan: Rohan's cart is empty, because each customer has their own cart.
- [x] **C-13 Closed restaurant**
  - Steps: (needs O-02 first: the owner closes Campus Curry House) open its menu as the customer.
  - Expected: a "This restaurant is closed right now…" banner, and the **Add** buttons are disabled. Reopen it afterwards.

### 3.3 Checkout & dummy payment
- [x] **C-14 Checkout form**
  - Steps: with items in the cart → **Proceed to checkout**.
  - Expected: the delivery address and phone are pre-filled from the profile; "Payment — Demo — no real charge" with a pre-filled card; the order summary; the button reads "Pay ₹X & place order". It may read "Checking prices…" for a moment while current prices are confirmed.
- [x] **C-15 Checkout validation**
  - Steps: clear the address and enter phone `12`, then submit.
  - Expected: errors under "Delivery address" and "Contact phone"; no order is placed.
- [x] **C-16 Place order**
  - Steps: fix the fields → **Pay ₹X & place order**.
  - Expected: a "Payment successful (demo) · ₹X" toast; the order page "Order #N"; badges **Placed** and **Paid (demo)**; a green "Payment successful (demo)…" note; the cart is now empty.
- [x] **C-17 Empty-cart checkout**
  - Steps: open http://localhost:5173/checkout with an empty cart.
  - Expected: redirected to the cart page.

### 3.4 Free cancellation window (60 seconds) — D14
- [x] **C-18 Countdown**
  - Steps: right after C-16, look at the order page.
  - Expected: a "Changed your mind?" box with **Cancel for free · 0:59** counting down, and a shrinking progress bar.
- [x] **C-19 Free cancel = automatic refund**
  - Steps: place another order → click **Cancel for free** within 60 seconds.
  - Expected:
    - no reason is asked and nothing goes to the restaurant
    - a toast "Order cancelled · ₹X refunded (demo)"
    - status **Cancelled**, payment **Payment refunded**
    - a pink box "₹X refunded (demo)" with a MOCK-REFUND reference
    - the timeline shows Placed → Cancelled
- [x] **C-20 After 60 seconds, no refund**
  - Steps: place an order → wait more than 60 seconds (don't let the owner accept it).
  - Expected: the button changes to **Cancel order (no refund)**. Clicking it shows the dialog "Cancel without refund?" → **Yes, cancel order** → status Cancelled, payment stays **Paid (demo)**, no refund box.
- [x] **C-21 No cancel once accepted**
  - Steps: (needs O-08) once the owner accepts the order, look at it as the customer.
  - Expected: no cancel button at all.

### 3.5 My orders dashboard
- [x] **C-22 Tabs**
  - Steps: navbar → **My orders**.
  - Expected: "Current orders" shows the active orders (Placed, Accepted, Ready for pickup, Out for delivery…); "Past orders" shows Delivered, Cancelled and Refunded.
- [x] **C-23 Status filter**
  - Steps: Past orders → status "Refunded".
  - Expected: only the refunded order (Green Bowl).
- [x] **C-24 Date filter**
  - Steps: Past orders → set From and To to **today**.
  - Expected: only today's past orders. A range before the demo data shows "No past orders… Try clearing the filters".
- [x] **C-25 Badges**
  - Steps: look at the past orders.
  - Expected: payment badges (Paid (demo) / Payment refunded) and return badges (Return requested, Return approved) where they apply.
- [x] **C-26 Pagination**
  - Steps: the pager appears only with **more than 10** orders in a tab. The seed gives Asha exactly 10 past orders, so place and cancel one or two orders first (or run this after section 3.4). Then Past orders → **Next →** / **← Previous**.
  - Expected: "Page X of Y · N total" updates, and page 2 shows different orders.
- [x] **C-27 Live tracking**
  - Steps: keep "Current orders" open while the owner or rider (in another window) changes an order's status.
  - Expected: the status updates within about 15 seconds without refreshing.

### 3.6 Order details
- [x] **C-28 Order page**
  - Steps: open any order (click "View" or the order number).
  - Expected: items with unit and line prices; subtotal, delivery fee and total; the timeline with times; Delivery (address, phone link, rider once assigned); restaurant details.
- [x] **C-29 Someone else's order**
  - Steps: as Rohan, open the URL of one of Asha's orders (e.g. /orders/1).
  - Expected: "Order not found — This order doesn't exist or isn't yours."

### 3.7 Reviews & returns
- [x] **C-30 Review a delivered order**
  - Steps: open a delivered order that has no review (e.g. the most recent delivered Curry House order) → "Rate your order" → click 4 stars → comment → **Submit review**.
  - Expected: a "Thanks for your review!" toast; the section changes to "Your review" with 4★; the restaurant's rating on the home page changes.
- [x] **C-31 Review needs a rating**
  - Steps: click **Submit review** without choosing stars.
  - Expected: "Please choose a rating".
- [x] **C-32 No review before delivery**
  - Steps: open an active order.
  - Expected: no review section.
- [x] **C-33 Request a return**
  - Steps: a delivered order without a return → **Request return / refund** → type `bad` → **Send request**.
  - Expected: "Please describe the problem in at least 10 characters". Type a proper reason → send → the toast "Return request sent to the restaurant" → the section shows "Return requested" and "Waiting for the restaurant to respond."
- [x] **C-34 Only one return per order**
  - Steps: look at the same order again.
  - Expected: no button to request another return.
- [x] **C-35 Quick actions from the list**
  - Steps: My orders → Past → on a delivered order, use **Rate** and **Return**.
  - Expected: Rate opens the order at the review form; Return opens the return dialog.

### 3.8 AI order insights (needs `OPENAI_API_KEY`)
- [x] **C-36 Suggested questions**
  - Steps: navbar → **AI insights** → click each of the 4 chips.
  - Expected: each question appears on the right, a typing indicator shows, then an answer based on **your** orders ("N orders considered").
- [x] **C-37 Your own question**
  - Steps: type "What did I order from Byte Pizza?" → **Ask**.
  - Expected: a relevant answer using only your orders.
- [x] **C-38 Summary**
  - Steps: click **Summarize my orders**.
  - Expected: a summary of recent orders.
- [x] **C-39 Rate limit**
  - Steps: click chips quickly more than 10 times within a minute.
  - Expected: a red message "You're asking a bit too fast — please try again in N seconds."
- [x] **C-40 No API key**
  - Steps: with `OPENAI_API_KEY` empty, ask anything.
  - Expected: "AI insights are not configured". The rest of the app keeps working.
- [x] **C-41 New customer**
  - Steps: as a newly registered customer with no orders, ask a question.
  - Expected: "You haven't placed any orders yet…"

---

## 4. Restaurant owner

*Log in as `owner.curry@campusbite.dev` unless a test says otherwise.*

### 4.1 Dashboard
- [x] **O-01 Dashboard contents**
  - Steps: open **Dashboard**.
  - Expected:
    - "Campus Curry House", the address and an "Open" badge
    - an amber "1 order needs attention" reminder banner
    - Statistics cards: Total orders, Net revenue, Avg order value, Rating 4.5 ★ (**4.3 ★** if C-30 already added a 4★ review)
    - the "Orders by status" bars and the "Top dishes" list
    - an "Active orders" list
- [x] **O-02 Open / close**
  - Steps: click **Close for now**.
  - Expected: a toast "Restaurant is now closed"; the badge reads Closed. (Check C-13 as the customer.) Click **Open restaurant** to reopen.
- [x] **O-03 Reminders (orders not updated for more than 15 minutes)**
  - Steps: read the reminder banner.
  - Expected: "Order #N has been PLACED for X minutes without an update." with **View orders** and **Dismiss**.
- [x] **O-04 Dismiss a reminder**
  - Steps: click **Dismiss**.
  - Expected: the reminder disappears. (A reminder also clears automatically once the order's status changes; see O-08.)
- [x] **O-05 Stats date range**
  - Steps: set the Statistics date range to today only, then click **All time**.
  - Expected: the numbers change for the range and go back for All time.
- [x] **O-06 Pending returns link**
  - Steps: log in as `owner.pizza` → Dashboard.
  - Expected: "1 return request waiting for you →", linking to Returns. A reminder for the stale ACCEPTED order is also shown.

### 4.2 Orders
- [x] **O-07 Order list**
  - Steps: navbar → **Orders**.
  - Expected: "Active" and "Completed" tabs, status and date filters; each card shows the customer name, items, total and one action button.
- [x] **O-08 Accept (window already over)**
  - Steps: on the stale **Placed** order, click **Accept**.
  - Expected: a toast; the status changes to **Accepted**; the button becomes **Start preparing**; that order's reminder disappears from the dashboard.
- [x] **O-09 Accept blocked during the customer's 60s window (D14)**
  - Steps: as the customer (private window), place a new Curry House order → as the owner, open Orders straight away.
  - Expected: the new order shows a **disabled "Awaiting customer · 0:SS"** button that counts down. After about 60 seconds it becomes **Accept**.
- [x] **O-10 Preparation steps**
  - Steps: **Start preparing** → **Mark ready**.
  - Expected: the status changes to Preparing, then Ready; the button becomes **Assign rider**.
- [x] **O-11 Owners can't cancel or reject (D6)**
  - Steps: look at the buttons on any order.
  - Expected: there is **no** Cancel or Reject button for owners.
- [x] **O-12 Assign a rider**
  - Steps: on a **Ready** order → **Assign rider**.
  - Expected:
    - the dialog "Assign a rider to order #N" lists Meena Shah and Arjun Das with vehicle, phone and a load badge ("Free" / "1 active")
    - the **Assign** button stays disabled until you pick one
    - after you pick one and click **Assign**: a toast, the status changes to Assigned, and the card shows "Rider: \<name\>"
- [x] **O-13 Filters**
  - Steps: Completed tab → status "Delivered"; set a date range.
  - Expected: the list filters to match.
- [x] **O-14 Owner opens an order**
  - Steps: click "Order #N" on a card.
  - Expected: the order page shows the customer's name, address and phone, plus the timeline.

### 4.3 Menu management
- [x] **O-15 Menu list**
  - Steps: navbar → **Menu**.
  - Expected: a table (desktop) with a photo, veg mark, name, category, price, an availability switch, and Edit and Delete for every dish, **including unavailable ones** (Chicken Biryani, Gulab Jamun with the switch off). The list shows 10 dishes per page: "Page 1 of 2 · 12 total", and **Next →** shows the rest (e.g. Paneer Tikka).
- [x] **O-16 Search & availability filter**
  - Steps: search `naan`; set the filter to "Unavailable".
  - Expected: Butter Naan and Garlic Naan; then only the unavailable dishes.
- [x] **O-17 Add a dish (validation)**
  - Steps: **+ Add dish** → submit with an empty name and price `0`.
  - Expected: "Name must be at least 2 characters" and "Price must be greater than 0".
- [x] **O-18 Add a dish (success)**
  - Steps: Name `Masala Dosa`, Category `South Indian`, Price `120`, Vegetarian ✓, Available ✓; paste an image URL (e.g. from Wikipedia) → **Add dish**.
  - Expected: the photo preview appears next to the URL field as you paste; after saving, a "Dish added" toast and the dish is in the list. As the customer, it shows on the menu with its photo.
- [x] **O-19 Edit a dish**
  - Steps: **Edit** Masala Dosa → change the price to `130` → **Save changes**.
  - Expected: a "Dish updated" toast; the new price shows in the owner list and on the customer menu.
- [x] **O-20 Toggle availability**
  - Steps: switch Masala Dosa **off**.
  - Expected: the switch turns grey straight away with a toast "…is now unavailable"; the customer menu no longer lists it. Switch it back on → it reappears.
- [x] **O-21 Delete a dish**
  - Steps: **Delete** Masala Dosa → the dialog "Delete dish?" → **Delete**.
  - Expected: removed from the owner and customer menus. Past orders that include a deleted dish still show its name and price.
- [x] **O-22 Owners see only their own menu**
  - Steps: log in as `owner.pizza` → Menu.
  - Expected: only Byte Pizza dishes.

### 4.4 Return / refund requests
- [x] **O-23 Pending list**
  - Steps: log in as `owner.pizza` → **Returns**.
  - Expected: under the "Waiting" filter, a card for Asha's order with the customer, total, items and the reason in quotes.
- [x] **O-24 Reject needs a note**
  - Steps: **Reject** → **Reject request** with an empty note.
  - Expected: "Please explain your decision (at least 5 characters)".
- [x] **O-25 Approve a refund**
  - Steps: **Approve refund** → the dialog "Approve refund? Refund ₹X…" → **Approve & refund**.
  - Expected:
    - a toast "Refund of ₹X issued…"
    - the request moves to the "Approved" filter
    - as the customer, the order shows **Refunded** with a **Payment refunded** badge, the "₹X refunded (demo)" box, a "Return approved" badge, and a timeline ending in Refunded
- [x] **O-26 Reject with a note**
  - Steps: create another return (C-33), then as the owner click **Reject** → note "Photos show all items delivered" → **Reject request**.
  - Expected: the request moves to "Rejected" with "Your note: …". As the customer: "Return rejected", the restaurant's note, and the order stays Delivered and **Paid (demo)**.
- [x] **O-27 Filters**
  - Steps: switch between Waiting, Approved, Rejected and All.
  - Expected: the list filters to match.

---

## 5. Delivery partner

*Log in as `rider.one@campusbite.dev` (Meena) unless a test says otherwise.*

- [x] **D-01 Active deliveries**
  - Steps: open **Deliveries**.
  - Expected: "Hi Meena, your deliveries"; the out-for-delivery Curry House order with a **Pick up** panel (restaurant and address) and a **Deliver to** panel (Asha Rao, address, phone link).
- [x] **D-02 Only assigned orders**
  - Steps: compare with `rider.two`.
  - Expected: Arjun sees only **his** order (Green Bowl, "Rider assigned"), not Meena's.
- [x] **D-03 Filter chips**
  - Steps: click "To pick up" and "On the way".
  - Expected: the list filters by status.
- [x] **D-04 Picked up**
  - Steps: as Arjun → **Picked up · Out for delivery** → confirmation dialog → **Confirm**.
  - Expected: a toast "…is out for delivery"; the status changes to Out for delivery; the button becomes **Mark delivered**.
- [x] **D-05 Delivered**
  - Steps: **Mark delivered** → **Confirm**.
  - Expected: a toast "…delivered"; the order leaves the active list; "No deliveries right now" if none are left.
- [x] **D-06 History**
  - Steps: navbar → **History**.
  - Expected: "Delivery history" with "N completed deliveries", including the order just delivered; the date filter works.
- [x] **D-07 Customer sees it**
  - Steps: as the customer, open that order.
  - Expected: status **Delivered** with the full timeline, and the review and return options now available.
- [x] **D-08 Phone link**
  - Steps: click the customer's phone number.
  - Expected: it opens a `tel:` link (calling app / prompt).

---

## 6. End-to-end scenario (all three roles)

Use 3 windows: a normal window for the **customer**, a private window for the **owner**, and a second browser (or private window of another browser) for the **rider**.

- [x] **E-01** Customer: Curry House → add Paneer Tikka ×2 and Butter Naan ×2 → checkout → pay.
- [x] **E-02** Owner: Orders shows the order with "Awaiting customer · 0:SS". Wait for **Accept**.
- [x] **E-03** Customer (within about 15s): the order status changes to **Accepted**, with no cancel button.
- [x] **E-04** Owner: **Start preparing** → **Mark ready** → **Assign rider** → Meena.
- [x] **E-05** Rider (Meena): the order appears → **Picked up · Out for delivery** → **Mark delivered**.
- [x] **E-06** Customer: the timeline reaches Delivered → submit a 5★ review → request a return.
- [x] **E-07** Owner: Returns → **Approve refund**.
- [x] **E-08** Customer: the order is **Refunded** with the refund box; the AI page ("How much did I spend this week?") reflects the refund.
- [x] **E-09** Owner: Dashboard stats update (orders, refunds, rating).

---

## 7. Security & role protection (through the UI)

- [x] **R-01** As the customer, open http://localhost:5173/owner/dashboard → "403 · You don't have access to this page".
- [x] **R-02** As the customer, open http://localhost:5173/delivery/dashboard → the same 403 page.
- [x] **R-03** As the owner, open http://localhost:5173/checkout → the 403 page.
- [x] **R-04** As the rider, open http://localhost:5173/owner/menu → the 403 page.
- [x] **R-05** As the owner or rider, open http://localhost:5173/ → redirected to your own dashboard.
- [x] **R-06** Navbar shows only the links for your role (customer: Restaurants / My orders / AI insights / Cart; owner: Dashboard / Orders / Menu / Returns; rider: Deliveries / History).
- [x] **R-07** As `owner.green`, open the URL of a Curry House order → "Order not found".
- [x] **R-08** As `rider.two`, open the URL of Meena's delivery → "Order not found".
- [x] **R-09** Two tabs in the same window: log in as the owner in tab 1, then as the customer in tab 2 → tab 1 switches to the customer's home automatically. It doesn't show the owner while acting as the customer.
- [x] **R-10** Swagger (http://localhost:8000/docs): log in as the customer, **Authorize** with the token, then call `GET /api/v1/owner/stats` → **403**. The backend blocks it even without the UI.

---

## 8. Responsive / mobile (iPhone-size screen in DevTools)

- [x] **M-01** Navbar collapses into a ☰ button; tapping it opens the menu with links, the user name and Log out. The cart badge stays visible.
- [x] **M-02** Restaurant cards stack in 1 column; no sideways scrolling on any page.
- [x] **M-03** Menu page: filters stack; when the cart has items, a sticky bottom bar "N items · ₹X · View cart →" appears.
- [x] **M-04** Owner Menu: the table becomes cards with a photo, switch, Edit and Delete.
- [x] **M-05** Dialogs (assign rider, return, confirm) open as bottom sheets and are easy to tap.
- [x] **M-06** Checkout, order details and the AI chat are readable and usable with one hand.

---

## 9. UX states

- [x] **U-01 Loading:** on a slow network (DevTools → Network → "Slow 3G"), lists show a spinner ("Loading…") while loading.
- [x] **U-02 Errors:** stop the backend and refresh a page → a red box "Cannot reach the server. Is the backend running?" with **Try again**. **You stay logged in.** Restart the backend → **Try again** loads the data.
- [x] **U-03 Empty states:** a new owner's Menu shows "Your menu is empty"; a new rider shows "No deliveries right now"; a new customer's My orders shows "No current orders".
- [x] **U-04 No double submits:** buttons show a spinner and are disabled while a request is running (Pay, Accept, Assign, Approve…).
- [x] **U-05 Toasts:** success, info and error toasts appear at the bottom and disappear on their own (or with ×).
- [x] **U-06 Broken image fallback:** edit a dish's Image URL to `https://example.com/broken.jpg` → the dish shows its first letter on an orange tile instead of a broken image.

---

## 10. Backend features visible in the UI

- [x] **B-01 Request logging:** the backend terminal (`docker compose logs -f backend`) shows one line per request with method, path, status and time in ms, e.g. `GET /api/v1/restaurants 200 3.21ms request_id=…`.
- [x] **B-02 Reminder background task:** leave a new order un-accepted for 15+ minutes (after the 60s window) → within about a minute a reminder appears on the owner dashboard without anyone acting. For a quicker test, set `REMINDER_THRESHOLD_MINUTES=1` in `.env` and restart.
- [x] **B-03 Swagger docs:** http://localhost:8000/docs lists every endpoint grouped by Auth, Restaurants, Orders, Restaurant owner, Delivery partner and AI insights.

---

## 11. Regression checks for fixed bugs

These cover the bugs found and fixed on 9 Nov 2026 (see [UI_TEST_REPORT.md](UI_TEST_REPORT.md)). BUG-01, BUG-04 and BUG-06 are already covered by U-02, A-16 and C-39.

- [x] **G-01 Login returns to the page you came from (BUG-03)**
  - Steps:
    1. Logged out, open the URL of one of Asha's orders (e.g. http://localhost:5173/orders/1) → log in as Asha.
    2. Open **My orders** → **Log out** → log in again.
  - Expected:
    1. You land on that order's page, not the restaurant list. The same works for `/customer/dashboard` and `/customer/ai-insights`, and for P-06.
    2. After a deliberate logout, the next login goes to the restaurant list, not back to My orders.
- [x] **G-02 Price changed while the dish is in the cart (BUG-02)**
  - Steps:
    1. As the customer, add Garlic Naan (₹50) from Campus Curry House.
    2. As `owner.curry`, edit Garlic Naan's price to `55`.
    3. As the customer, open checkout and pay.
  - Expected: an amber box "Prices changed since you added these dishes · Garlic Naan: ₹50.00 → ₹55.00", and the button reads **"Pay ₹85.00 & place order"**. The order total is **₹85.00**, the amount shown. Afterwards, set the price back to 50.
- [x] **G-03 Damaged saved cart (BUG-05)**
  - Steps: as the customer, open DevTools → Application → Local Storage. Set `campusbite_cart_<your user id>` to `{"restaurant":null,"items":"oops"}`, then refresh and open Cart, Checkout and a menu.
  - Expected: every page renders with an empty cart (no white screen). If any page ever crashes, you see "Something went wrong" with **Reload page**.
- [x] **G-04 Invalid ids in the URL (BUG-07)**
  - Steps: open http://localhost:5173/orders/abc and http://localhost:5173/restaurants/abc.
  - Expected: "Order not found" / "Restaurant not found" with a back button, not "Please fix the highlighted fields".
- [x] **G-05 Quick filter changes are kept (BUG-08)**
  - Steps: on a menu, set Min ₹ `300` and Max ₹ `100` (error shown), clear Min and then Max straight away, and pick category "Mains". Then click **Clear filters** and immediately pick Sort "Price: low to high".
  - Expected: after clearing, both price boxes stay empty and only Mains shows. After Clear + sort, only the sort is applied (URL `?sort=price_asc`).

---

## PRD coverage

| PRD requirement | Tests |
|---|---|
| Customer: register/login | A-01 – A-04, A-10 – A-15 |
| Browse restaurants, view menus | P-01 – P-05, C-07 |
| Search/filter dishes by name & price | C-01 – C-06 |
| Cart add/update/remove | C-08 – C-13 |
| Dummy payment, `mock_paid` | C-14 – C-17 |
| Order history & tracking | C-22 – C-29, C-27 |
| Cancel when allowed | C-18 – C-21, O-09 |
| Reviews after delivery | C-30 – C-32 |
| Return/refund after delivery | C-33 – C-35, O-23 – O-27 |
| AI insights | C-36 – C-41 |
| Owner: menu management & availability | O-15 – O-22 |
| Owner: orders, preparation, assign rider, filters | O-07 – O-14 |
| Owner: statistics | O-01, O-05, E-09 |
| Owner: reminders for stale orders | O-03, O-04, O-06, B-02 |
| Rider: assigned orders, customer details, Out for delivery, Delivered, history | D-01 – D-08 |
| Auth, JWT in localStorage, protected routes, backend RBAC | A-14 – A-17, R-01 – R-10 |
| Pagination | C-26 |
| Responsive design | M-01 – M-06 |
| Loading & error handling | U-01 – U-05 |
| Middleware logging | B-01 |
| Regression checks for fixed bugs | G-01 – G-05 (plus U-02, A-16, C-39) |

---

## Results summary

| Area | Total | Passed | Failed | First run (before fixes) |
|---|---|---|---|---|
| Setup (S) | 2 | 2 | 0 | 2 / 2 |
| Public (P) | 9 | 9 | 0 | 8 / 9 (P-06) |
| Auth (A) | 17 | 17 | 0 | 16 / 17 (A-16) |
| Customer (C) | 41 | 41 | 0 | 40 / 41 (C-39) |
| Owner (O) | 27 | 27 | 0 | 27 / 27 |
| Delivery (D) | 8 | 8 | 0 | 8 / 8 |
| End-to-end (E) | 9 | 9 | 0 | 9 / 9 |
| Security (R) | 10 | 10 | 0 | 10 / 10 |
| Mobile (M) | 6 | 6 | 0 | 6 / 6 |
| UX (U) | 6 | 6 | 0 | 6 / 6 (U-02 only without a refresh: BUG-01) |
| Backend (B) | 3 | 3 | 0 | 3 / 3 |
| **Plan total** | **138** | **138** | **0** | 135 / 138 |
| Regression checks (G) | 5 | 5 | 0 | (added after the fixes) |

Tested by: automated Playwright run (Chromium 145, desktop and 390×844 mobile), see [UI_TEST_REPORT.md](UI_TEST_REPORT.md) · Date: 9 Nov 2026 · Build/commit: working tree (no git repository yet) · Backends: SQLite, and Docker Compose + PostgreSQL 16 (10 Nov 2026) · AI: a local OpenAI stand-in, not a real key

## Bug log

| Bug ID | Test ID | What happened | Expected | Severity (High/Med/Low) | Status |
|---|---|---|---|---|---|
| BUG-01 | U-02, X-37 | Refreshing while the backend was down logged the user out | Stay logged in; show the error box | Med | ✅ Fixed |
| BUG-02 | G-02, X-30 | Pay button showed ₹80 (old cart price), server charged ₹85 | Customer sees the new price before paying | Med | ✅ Fixed |
| BUG-03 | P-06, G-01 | After login, always sent to the role's home page | Return to the menu or link that needed login | Med | ✅ Fixed |
| BUG-04 | A-16 | "Your session expired" banner never shown | Banner on the login page | Low | ✅ Fixed |
| BUG-05 | G-03, X-28 | Malformed saved cart turned every page white | App renders with an empty cart | Low | ✅ Fixed |
| BUG-06 | C-39 | "Try again in a few seconds" (Retry-After hidden by CORS) | "Try again in N seconds" | Low | ✅ Fixed |
| BUG-07 | G-04, X-32 | `/orders/abc` showed "Please fix the highlighted fields" | "Order not found" | Low | ✅ Fixed |
| BUG-08 | G-05, C-02 – C-06 | Very fast filter changes were lost (automation, autofill) | Every change kept | Low | ✅ Fixed |
| OBS-1 | M-05, M-06 | AI chips are 30 px high; the dialog × is 21×32 px | Tap targets of 40 px or more | Low (cosmetic) | Open |
