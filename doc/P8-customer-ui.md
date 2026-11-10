# P8 — Customer UI

**Status:** ✅ Done (build OK; 27 frontend tests passing)
**Depends on:** P7 (foundation), P2–P4 and P6 (APIs) · **Unblocks:** P10

## Goal

Every customer-facing page: browse restaurants, search and filter dishes, cart, checkout with dummy payment, the 60-second free cancellation countdown, order tracking, the dashboard with filters, reviews, returns, and AI insights. All responsive, with loading, error and empty states.

## Pages and components

### RestaurantListPage — `/` (public)
- Search box (debounced 400ms) and cuisine filter → `GET /restaurants`
- `RestaurantCard` grid: image, name, cuisine, ⭐ avg rating (count), open or closed badge
- Grid: 1 column on mobile, 2 at `sm`, 3–4 at `lg`; `Pagination`
- States: skeleton loader, `ErrorMessage` with retry, `EmptyState` ("No restaurants match …")

### RestaurantMenuPage — `/restaurants/:id` (public)
- Header: name, cuisine, address, rating, open status
- `DishFilters`: search, min and max price, veg toggle, category select, sort (price ↑ / price ↓ / name). Filters are kept in the URL query string so the page can be shared and the back button works.
- `DishCard`: name, description, price, veg marker, **Add** button → becomes a quantity stepper when the dish is in the cart
- Adding from a different restaurant → `ConfirmDialog` "Your cart has items from X. Clear it and add this?"
- Guests clicking Add → redirected to `/login` and returned afterwards
- Reviews section (`GET /restaurants/:id/reviews`, paginated)
- Sticky "View cart (n) · ₹X" bar on mobile

### CartPage — `/cart` (customer)
- Restaurant name, line items with a quantity stepper and remove button, subtotal, delivery fee (from config or constants), total
- "Proceed to checkout" (disabled when empty); empty state links to restaurants

### CheckoutPage — `/checkout` (customer)
- Delivery address (prefilled from `user.default_address`), contact phone, notes
- **Dummy payment card:** card number prefilled `4111 1111 1111 1111`, expiry and CVV fields, with the label "Demo payment, no real charge". This data is **never sent** to the API.
- Order summary and a "Pay ₹X & Place order" button (spinner and disabled while submitting)
- `POST /orders` → on success: `clearCart()`, toast "Payment successful (demo)", navigate to `/orders/:id`
- On 400 (an item became unavailable) → show the message and link back to the menu

### CancelCountdown component (D14)
```jsx
<CancelCountdown order={order} onCancelled={refetch} />
```
- Shown only to the customer and only while `order.status === 'PLACED'`
- Starts from `order.cancel_window_remaining_seconds` (server value, so the device clock doesn't matter); `useEffect` + `setInterval(1000)`, cleared on unmount
- **While > 0:** a prominent card "Changed your mind? **Cancel for free · 0:42**" with a progress bar. One click → `POST /orders/:id/cancel` (no reason form) → toast "Order cancelled · ₹X refunded (demo)" → `onCancelled()`
- **At 0:** switches to a secondary "Cancel order (no refund)" button → `ConfirmDialog` "The free cancellation window has ended. Cancelling now will not refund ₹X. Continue?" → cancel
- On a 409 (e.g. the restaurant already accepted) → show the message and refetch

### OrderDetailPage — `/orders/:id`
- Header: order #, restaurant, placed time, `StatusBadge`
- `OrderTimeline`: the steps PLACED → … → DELIVERED with the completed ones ticked and timestamps from the history (CANCELLED and REFUNDED shown as end states)
- `CancelCountdown` (customer, PLACED)
- `OrderItemsTable` + totals; payment badge (`mock_paid` / `refunded`); refund info box (amount, ref, date)
- Delivery info: address, phone, assigned partner name once assigned
- If DELIVERED and no review → `ReviewForm` (stars 1–5 + comment)
- If DELIVERED and no return → "Request return/refund" → `ReturnForm` (reason textarea, 10–500 characters, character counter)
- Shows the existing review and the return status (requested / approved / rejected with the owner's note)
- Auto-refreshes every 30s while the order is active (not DELIVERED, CANCELLED or REFUNDED), so tracking updates without WebSockets

### CustomerDashboardPage — `/customer/dashboard`
- Tabs: **Current** (PLACED → OUT_FOR_DELIVERY) and **Past** (DELIVERED, CANCELLED, REFUNDED)
- `StatusFilter` + `DateRangeFilter` → `GET /orders/me`; `Pagination`
- `OrderCard`: restaurant, date, item summary, total, status, payment and return badges, and quick actions: **Cancel** (PLACED, with a countdown chip if in the window), **Review**, **Return**, **View**
- Cards on mobile, compact rows on desktop

### AIInsightsPage — `/customer/ai-insights`
- Intro text and **suggested question chips**: "Summarize my last five orders", "Which of my orders are still not delivered?", "How much did I spend this week?", "Which food items have I ordered most frequently?"
- Free-text input (max 500 characters, counter) and a "Get summary" button for the no-question mode
- Chat-style thread (kept in component state for the session): the question bubble, then a typing indicator, then the answer (rendered as plain text with line breaks or simple markdown)
- Errors: 429 → "You're asking too fast — try again in N s"; 503 → "AI is unavailable right now"; generic → retry

## Components created in this phase
`RestaurantCard`, `DishCard`, `DishFilters`, `QuantityStepper`, `CartLineItem`, `OrderSummary`, `DummyPaymentForm`, `CancelCountdown`, `OrderTimeline`, `OrderItemsTable`, `OrderCard`, `ReviewForm`, `ReturnForm`, `PaymentBadge`, `ReturnBadge`, `ChatMessage`, `SuggestedQuestions`

## Tasks
- [x] RestaurantListPage
- [x] RestaurantMenuPage + DishFilters (URL-synced) + cart conflict dialog
- [x] CartPage
- [x] CheckoutPage + DummyPaymentForm
- [x] CancelCountdown
- [x] OrderDetailPage + timeline + review and return forms + auto-refresh
- [x] CustomerDashboardPage + tabs, filters and pagination
- [x] AIInsightsPage
- [x] Responsive pass at 375px, 768px and 1280px

## Manual test script
1. Guest browses, searches "pizza", filters ₹100–₹300 → correct dishes
2. Adds a dish → asked to log in → logs in → returns to the menu
3. Adds 2 dishes, switches restaurant → conflict dialog works
4. Checkout → order page shows the countdown; cancels at about 0:30 → refunded toast, payment badge "Refunded"
5. Places another order; waits past 0:00 → button becomes "Cancel (no refund)"; leaves it
6. (The owner and delivery partner complete it in P9) → timeline updates; review and return forms appear; submits both
7. Dashboard filters by status and date; pagination works
8. AI page: all four chips return answers; rapid clicking shows the 429 message

## Done when
A customer can browse, filter, add to the cart, check out, see the countdown and cancel with a refund within 60 seconds, track the order, review and return after delivery, and use AI insights, all on both desktop and mobile widths.

## Implementation notes (as built)

**Pages:** `RestaurantListPage`, `RestaurantMenuPage`, `CartPage`, `CheckoutPage`, `CustomerDashboardPage`, `AIInsightsPage`, and the shared `OrderDetailPage` (also used by owners and delivery partners).

**Components:**
- `restaurant/`: RestaurantCard, DishCard, DishFilters, QuantityStepper
- `order/`: OrderCard, OrderTimeline, OrderItemsTable, OrderTotals, CancelCountdown, ReviewForm, ReturnForm (modal)

**Decisions made while building**
| Topic | Decision |
|---|---|
| Current vs past tabs | Added a backend `scope=active\|past` filter to `GET /orders/me` and `GET /owner/orders` (with a test), so the tabs paginate correctly on the server |
| Menu filters | Kept in the URL query string (shareable, back button works); default values are left out of the URL; changing a filter resets to page 1 |
| Cuisine dropdown | Built from the unfiltered restaurant list (page_size 50) |
| Guests clicking Add | A toast, then redirect to `/login` and back to the menu afterwards |
| Other-restaurant conflict | ConfirmDialog "Start a new cart?" → replace the cart |
| Closed restaurant | Menu viewable with a banner; Add buttons disabled |
| Checkout | The address and phone are prefilled from the profile; the dummy card form is never sent; the request carries only ids and quantities; 400 (e.g. a dish became unavailable) → message + link back to the menu |
| Cart loading bug (found by a test) | The cart is now loaded **synchronously on the first render** (keyed reducer), so refreshing `/checkout` no longer bounces to `/cart` |
| CancelCountdown | Seeded from `cancel_window_remaining_seconds` and counts down using its own end time (not the device clock). Inside the window: one-click free cancel with a progress bar. At 0: "Cancel order (no refund)" behind a ConfirmDialog. A compact version is used in the dashboard list. |
| Live tracking | Order detail and the current-orders tab poll every 15s while the order is active (no WebSockets) |
| Reviews and returns | ReviewForm (star picker + comment) on DELIVERED orders without a review; ReturnForm modal with a 10–500 character counter; the existing review or return (status + owner note) is shown otherwise |
| AI page | Chat thread kept in component state; the 4 PRD questions as chips; free text up to 500 characters; "Summarize my orders" sends no question; friendly 429 (uses Retry-After) and 503 messages |

**Tests: 27 frontend tests passing (8 new)**
- CancelCountdown: free cancel + refund toast; no-refund confirmation; counting down to 0 switches the mode; hidden when not PLACED
- Checkout: the payload has only ids and quantities, then navigates to the order and clears the cart; an empty cart redirects
- AI page: a chip question → answer shown; 429 → "try again in 20 seconds"

**Verification log**
- [x] `npm run build`: OK
- [x] `npx vitest run`: 27 passed
- [x] Backend: 220 passed (scope filter added)
- [ ] Full UI flow against a live backend: see the live integration test in P9
