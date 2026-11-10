# P9 — Owner & Delivery Partner UI

**Status:** ✅ Done (36 unit tests + 9-step live end-to-end UI test passing)
**Depends on:** P7, plus P2–P5 APIs · **Unblocks:** P10

## Goal

Dashboards and management pages for restaurant owners (stats, reminders, menu, orders, assignment, returns) and delivery partners (assigned deliveries, status updates, history).

## Owner pages

### OwnerDashboardPage — `/owner/dashboard`
- `StatsCards` (`GET /owner/stats`): total orders, orders today, net revenue, average order value, ⭐ avg rating, pending returns
- Orders-by-status mini breakdown (simple bars or chips) and a **Top dishes** list
- `ReminderList` (`GET /owner/reminders?resolved=false`): a warning banner "3 orders need attention"; each row has the message, minutes pending, "View order" and **Acknowledge** (`PATCH …/acknowledge`). Polls every 60s while the page is open (no WebSockets).
- Recent orders (latest 5) with a link to Order Management
- Optional date range for the stats

### MenuManagementPage — `/owner/menu`
- Toolbar: search, availability filter (All / Available / Unavailable), **+ Add dish**
- Table on desktop (name, category, price, veg, availability toggle, actions) and cards on mobile
- `MenuItemForm` in a `Modal` for add and edit: name, description, category, price (> 0), veg, available, image URL; client-side validation
- Availability toggle → `PATCH …/availability` (optimistic update, reverted on error)
- Delete → `ConfirmDialog` → `DELETE` (soft delete)
- Pagination

### OrderManagementPage — `/owner/orders`
- `StatusFilter` + `DateRangeFilter` + pagination → `GET /owner/orders`
- Order rows or cards: #, time, customer name, items summary, total, `StatusBadge`
- **Next-step action button** by status (only valid actions shown; the backend still enforces them):

| Status | Owner action |
|---|---|
| PLACED (in the free window) | Accept disabled, with "Awaiting customer confirmation · 0:42" (D14) |
| PLACED (window over) | **Accept** |
| ACCEPTED | **Start preparing** |
| PREPARING | **Mark ready** |
| READY | **Assign delivery partner** → `AssignPartnerModal` |
| ASSIGNED / OUT_FOR_DELIVERY | Read only (shows the partner's name) |
| DELIVERED / CANCELLED / REFUNDED | Read only |

- No Reject or Cancel button (D6)
- `AssignPartnerModal`: lists `GET /owner/delivery-partners` (name, vehicle, active deliveries count), radio select → `POST …/assign`
- An order row expands, or links to `/orders/:id`, for the full detail
- Auto-refreshes every 30s

### ReturnRequestsPage — `/owner/returns`
- Status filter (Requested / Approved / Rejected) + pagination → `GET /owner/returns`
- Card: order #, customer, delivered date, items, total, **reason**
- **Approve** → `ConfirmDialog` "Refund ₹X to the customer (demo)?" → `POST …/approve` → toast
- **Reject** → `Modal` with a required note → `POST …/reject`
- Resolved requests show the outcome, date and note

## Delivery partner pages

### DeliveryDashboardPage — `/delivery/dashboard`
- Status filter (All active / Assigned / Out for delivery) → `GET /delivery/orders`
- `DeliveryCard`: order #, restaurant name and address (pickup), **customer name, phone (`tel:` link), delivery address**, items count, total, notes
- Actions:
  - ASSIGNED → **Picked up · Out for delivery**
  - OUT_FOR_DELIVERY → **Mark delivered**

  Each asks for confirmation first, then calls `PATCH /delivery/orders/:id/status`.
- Empty state: "No deliveries assigned right now"; auto-refreshes every 30s

### DeliveryHistoryPage — `/delivery/history`
- `DateRangeFilter` + pagination → `GET /delivery/history`
- Rows: order #, delivered date, restaurant, customer area, total

## Components created in this phase
`StatsCards`, `StatusBreakdown`, `TopItemsList`, `ReminderList`, `MenuItemForm`, `MenuTable`, `AvailabilityToggle`, `OwnerOrderRow`, `OrderActionButton`, `AssignPartnerModal`, `ReturnRequestCard`, `RejectReturnModal`, `DeliveryCard`, `DeliveryStatusButton`

## Tasks
- [x] OwnerDashboardPage (stats + reminders polling + recent orders)
- [x] MenuManagementPage (table/cards, form modal, toggle, delete)
- [x] OrderManagementPage (filters, action buttons, cancel-window awareness, assign modal)
- [x] ReturnRequestsPage (approve and reject flows)
- [x] DeliveryDashboardPage (cards, status actions)
- [x] DeliveryHistoryPage
- [x] Responsive pass at 375px, 768px and 1280px

## Manual end-to-end script (three browser profiles)
1. **Customer** places an order → **Owner** sees it with Accept disabled and the countdown → after 60s, Accept becomes enabled
2. Owner: Accept → Start preparing → Mark ready → Assign partner (the modal shows the load)
3. **Delivery partner** sees it with the customer's details → Out for delivery → Delivered
4. Customer's order page shows DELIVERED → submits a return with a reason
5. Owner's Returns page → Approve → customer sees "Refunded"
6. Leave a new order un-accepted for more than 15 minutes (or lower `REMINDER_THRESHOLD_MINUTES` for testing) → a reminder appears on the owner dashboard → Accept → the reminder clears
7. Owner menu: add a dish, toggle it unavailable → it disappears from the customer menu; delete a dish
8. A delivery partner opening `/owner/orders` → Unauthorized page; calling the API directly with their token → 403

## Done when
A full order lifecycle, including the return and refund, can be driven end to end in three browser sessions using only the UI, on both desktop and mobile widths.

## Implementation notes (as built)

**Pages:**
- owner: `OwnerDashboardPage`, `MenuManagementPage`, `OrderManagementPage`, `ReturnRequestsPage`
- delivery partner: `DeliveryDashboardPage`, `DeliveryHistoryPage`

**Components:**
- `owner/`: StatsCards (KPIs, orders-by-status bars, top dishes), ReminderList, MenuItemForm (modal), AssignPartnerModal, OwnerOrderActions
- `delivery/`: DeliveryCard

**Decisions made while building**
| Topic | Decision |
|---|---|
| Owner dashboard | Restaurant header with an **Open/Closed toggle** (`PUT /owner/restaurant {is_open}`); reminders banner with Dismiss; stats with an optional date range; a link to pending returns; active orders. Reminders and orders poll every 60s. |
| Order actions | `OwnerOrderActions` shows only the single valid next step: Accept → Start preparing → Mark ready → Assign rider. During the customer's free window it shows a disabled "Awaiting customer · 0:42" (D14). There is **no cancel or reject button** (D6). |
| Order management | Active and Completed tabs (backend `scope`), status and date filters, pagination; polls every 15s on the Active tab |
| Assign modal | Partners least-busy first with vehicle details and a "Free" or "N active" badge |
| Menu management | Table on desktop and cards on mobile; debounced search; availability filter; **optimistic** availability switch (rolled back if the API fails); add/edit modal with client validation (price > 0, 2 decimal places, image URL); delete with confirmation (soft delete) |
| Returns | Waiting/Approved/Rejected/All chips; Approve → confirmation showing the refund amount; Reject → modal requiring a note of at least 5 characters |
| Delivery cards | Pick-up (restaurant + address) and Deliver-to (customer, address, `tel:` link) panels; one action button per status, each behind a confirmation; polling every 30s |
| Backend tweak | `OrderSummary` gained `delivery_address`, `contact_phone` and `restaurant_address`, so list rows carry what riders need (no N+1 detail calls), with a test |

**Tests**
- Unit (Vitest): 36 passing, 9 new for OwnerOrderActions (window block, accept, next steps, assign, no cancel), DeliveryCard (details, confirmation flow) and ReturnRequestsPage (note required, approve)
- **Live end-to-end UI test** (`src/test/live/fullFlow.live.test.jsx`, runs only with `LIVE_API=1`): the real `<App/>` and the real Axios client in jsdom (origin `http://localhost:5173`) against a running backend with a 2s cancel window. 9 passing steps:
  1. a customer signs up via the form
  2. browses → adds 2 dishes → cart → checkout (dummy pay ₹250) → sees "Cancel for free"
  3. the customer is blocked from owner pages
  4. the owner waits out the window → Accept → Start preparing → Mark ready → assigns the rider in the modal
  5. the rider logs in via the form → sees the customer details → Out for delivery → Delivered (with confirmations)
  6. the customer sees Delivered → 4★ review → return request
  7. the owner approves the return → the customer sees "₹250.00 refunded (demo)"
  8. the owner dashboard shows the stats (rating 4.0, top dish)
  9. the customer asks the AI (local OpenAI stub)

  The backend logged 54 real requests, all 2xx.

**Verification log**
- [x] `npm run build`: OK
- [x] `npx vitest run`: 36 passed (the live suite is skipped without `LIVE_API`)
- [x] `LIVE_API=1 npx vitest run src/test/live`: 9 passed against a live backend
- [x] Backend: 221 passed
