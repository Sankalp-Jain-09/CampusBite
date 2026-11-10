# P7 — Frontend Foundation

**Status:** ✅ Done (build OK; 19 frontend tests passing)
**Depends on:** P1 (auth API); the other APIs come in during P8 and P9 · **Unblocks:** P8, P9

## Goal

Set up the React app: build tooling, styling, API client with JWT handling, global auth and cart state, routing with protected and role-based routes, a responsive layout, shared components, and the login and three registration pages.

## Scope

| In scope | Out of scope |
|---|---|
| Vite + React 18 + React Router v6 + Axios + Tailwind | Redux, Zustand (not needed) |
| `AuthContext`, `CartContext`, custom hooks | TypeScript (the PRD specifies JavaScript) |
| `ProtectedRoute`, `RoleRoute`, role-based redirects | Feature pages (P8, P9); placeholders only |
| Layout, Navbar, Footer, common UI components | |
| Login + customer, partner and delivery registration pages | |

## Design

### Setup
```bash
npm create vite@latest frontend -- --template react
cd frontend && npm i react-router-dom axios
npm i -D tailwindcss @tailwindcss/vite        # Tailwind v4 Vite plugin (or v3 + postcss)
```
`frontend/.env.example`: `VITE_API_BASE_URL=http://localhost:8000/api/v1`

### Folder structure
```
src/
├── main.jsx            BrowserRouter + AuthProvider + CartProvider + ToastProvider
├── App.jsx             route table
├── api/                client.js, auth.js, restaurants.js, orders.js, owner.js, delivery.js, ai.js
├── context/            AuthContext.jsx, CartContext.jsx, ToastContext.jsx
├── hooks/              useAuth.js, useCart.js, useApi.js, usePagination.js, useDebounce.js
├── components/
│   ├── layout/         Layout.jsx, Navbar.jsx, Footer.jsx
│   ├── routing/        ProtectedRoute.jsx, RoleRoute.jsx
│   └── common/         Loader, ErrorMessage, EmptyState, Pagination, Modal, ConfirmDialog,
│                       StatusBadge, RatingStars, StatusFilter, DateRangeFilter, Button, FormField
├── pages/              auth/*, NotFoundPage.jsx, UnauthorizedPage.jsx, placeholder dashboards
└── utils/              constants.js, format.js, storage.js
```

### API client (`src/api/client.js`)
```js
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL, timeout: 30000 });
api.interceptors.request.use(cfg => {
  const token = storage.getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) {
    storage.clearAuth(); window.location.assign('/login?expired=1');
  }
  return Promise.reject(normalizeError(err));   // → { status, message } from response.data.detail
});
```
FastAPI 422 errors (an array of `detail` items) are flattened into readable field messages.

### AuthContext
- **State:** `user`, `token`, `loading` (true while restoring the session).
- **On mount:** read `token` and `user` from localStorage → call `GET /auth/me` to confirm → set or clear.
- **Actions:** `login(email, pw)`, `registerCustomer(data)`, `registerOwner(data)`, `registerDeliveryPartner(data)` (each stores the token and user), `logout()`.
- **Helpers:** `isAuthenticated`, `hasRole(...roles)`, `homePathFor(role)` (customer → `/`, owner → `/owner/dashboard`, partner → `/delivery/dashboard`).

### CartContext (D4)
- **State:** `{ restaurant: {id, name} | null, items: [{menuItemId, name, price, quantity}] }`, persisted to `localStorage` (`campusbite_cart`).
- **Actions:** `addItem(restaurant, dish)` (if the cart holds another restaurant's items → return `{conflict: true}` so the UI can ask "Clear cart and add?"), `updateQuantity(id, qty)` (1–20; 0 removes), `removeItem(id)`, `clearCart()`.
- **Derived:** `itemCount`, `subtotal`. Prices shown here are for display only; the server recomputes them.

### Hooks
- `useApi(fn, deps)` → `{data, loading, error, refetch}`; ignores stale responses after unmount or a deps change.
- `usePagination(initialPageSize)` → `{page, pageSize, setPage, reset}`.
- `useDebounce(value, 400)`.

### Routing (`App.jsx`)
```jsx
<Route element={<Layout/>}>
  <Route path="/login" element={<GuestOnly><LoginPage/></GuestOnly>}/>
  <Route path="/register" element={<GuestOnly><CustomerRegisterPage/></GuestOnly>}/>
  <Route path="/partner/register" element={<GuestOnly><PartnerRegisterPage/></GuestOnly>}/>
  <Route path="/delivery/register" element={<GuestOnly><DeliveryRegisterPage/></GuestOnly>}/>
  <Route path="/" element={<RestaurantListPage/>}/>                         {/* public */}
  <Route path="/restaurants/:id" element={<RestaurantMenuPage/>}/>         {/* public */}
  <Route element={<RoleRoute roles={['customer']}/>}> ...customer routes </Route>
  <Route element={<RoleRoute roles={['restaurant_owner']}/>}> ...owner routes </Route>
  <Route element={<RoleRoute roles={['delivery_partner']}/>}> ...delivery routes </Route>
  <Route element={<ProtectedRoute/>}><Route path="/orders/:id" element={<OrderDetailPage/>}/></Route>
  <Route path="/unauthorized" element={<UnauthorizedPage/>}/>
  <Route path="*" element={<NotFoundPage/>}/>
</Route>
```
- `ProtectedRoute`: shows a loader while auth is restoring; if not logged in → `<Navigate to="/login" state={{from}}/>`.
- `RoleRoute`: protected, and also checks the role → `/unauthorized`.
- Owners and delivery partners who open `/` are redirected to their dashboard.

### Layout and Navbar
- Role-aware links:
  - guest: Restaurants, Login, Sign up
  - customer: Restaurants, My Orders, AI Insights, Cart (with count badge)
  - owner: Dashboard, Orders, Menu, Returns
  - partner: Deliveries, History
- Hamburger menu below the `md` breakpoint.
- Footer: "Partner with us" → `/partner/register`, "Ride with us" → `/delivery/register`.

### Auth pages
| Page | Fields |
|---|---|
| Login | email, password; shows an "expired" notice when `?expired=1`; links to all three signups |
| CustomerRegister | name, email, phone, password, confirm password, address (optional) |
| PartnerRegister | owner: name, email, phone, password · restaurant: name, cuisine, address, phone, description |
| DeliveryRegister | name, email, phone, password, vehicle type (select), vehicle number |

Client-side validation mirrors the server (required fields, email format, password ≥ 8, phone 10 digits). Server errors are shown under the matching fields or as a banner.

### Constants (`utils/constants.js`)
`ROLES`, `ORDER_STATUS`, `STATUS_LABELS` ("OUT_FOR_DELIVERY" → "Out for delivery"), `STATUS_COLORS`, `PAYMENT_STATUS_LABELS`, `RETURN_STATUS_LABELS`. `formatCurrency` → `₹1,234.00` (`Intl.NumberFormat('en-IN')`), `formatDate` / `formatDateTime` (local time).

## Tasks
- [x] Scaffold Vite, install dependencies, Tailwind, `.env.example`
- [x] `utils/`, `api/client.js` + API modules (functions for every endpoint in PLAN §7)
- [x] `AuthContext`, `CartContext`, `ToastContext` + hooks
- [x] `ProtectedRoute`, `RoleRoute`, `GuestOnly`
- [x] Layout, Navbar (responsive), Footer
- [x] Common components
- [x] Login + 3 register pages
- [x] Placeholder dashboard pages for each role, NotFound, Unauthorized

## Tests / checks
- [x] (Vitest, optional) `CartContext`: adds, updates and removes items; the single-restaurant conflict; persistence
- [x] (Vitest, optional) `RoleRoute` redirects for the wrong role and for no session
- [x] Manual: register each role → lands on the right page; refresh keeps the session; a customer opening `/owner/dashboard` → `/unauthorized`; a tampered token → logged out on the next API call

## Done when
A user of each role can register and log in, lands on the correct placeholder dashboard, cannot open other roles' routes, stays logged in after refresh, and the layout works at mobile width.

## Implementation notes (as built)

**Tooling:** Vite 5.4, React 18.3, React Router 6.28 (v7 future flags on), Axios 1.7, Tailwind 3.4 (PostCSS), Vitest 2.1 + Testing Library + jsdom. All versions are pinned exactly and `package-lock.json` is committed. Node 20 LTS is used here.

**Structure (as built)**
```
frontend/
  package.json, vite.config.js (+ vitest config), tailwind.config.js (brand = orange), postcss.config.js
  index.html, .env.example (VITE_API_BASE_URL), .gitignore
  src/main.jsx            BrowserRouter > ToastProvider > AuthProvider > CartProvider > App
  src/App.jsx             route table (guest, public, customer, owner, partner, shared /orders/:id)
  src/index.css           Tailwind + component classes (.btn-*, .input, .card, .badge, .label, .link, .container-page)
  src/api/                client.js (axios, JWT interceptor, 401 → logout, normalizeError → {status, message, fieldErrors, retryAfter}, cleanParams)
                          auth.js, restaurants.js, orders.js, owner.js, delivery.js, ai.js (one function per backend endpoint)
  src/context/            AuthContext (session restore via /auth/me, login, 3 register functions, logout)
                          CartContext (reducer; per-user localStorage key; single-restaurant conflict result)
                          ToastContext
  src/hooks/              useAuth, useCart, useToast, useApi (stale-safe, silent refetch), usePagination, useDebounce,
                          useInterval (polling), useCountdown (server-seeded)
  src/components/common/  Button, Spinner, Loader, ErrorMessage (retry), EmptyState, Pagination, Modal, ConfirmDialog,
                          Badges (Status/Payment/Return/VegMark), RatingStars/RatingInput/RatingSummary, FormField,
                          Filters (StatusFilter, DateRangeFilter), PageHeader
  src/components/layout/  Layout, Navbar (role links, cart badge, hamburger menu below md), Footer (Partner / Ride links)
  src/components/routing/ ProtectedRoute, RoleRoute, GuestOnly, CustomerHome
  src/components/auth/    AuthCard, useAuthForm (client validation + server field errors + redirect by role)
  src/pages/auth/         LoginPage, CustomerRegisterPage, PartnerRegisterPage, DeliveryRegisterPage
  src/pages/              NotFoundPage, UnauthorizedPage (+ P8/P9 pages)
  src/utils/              constants (roles, labels, colours, homePathFor, canAccessPath), format (₹, dates, countdown),
                          storage (try/catch-safe localStorage), validation
  src/test/               setup.js, renderWithProviders.jsx, cart / routing / login / apiClient tests
```

**Decisions made while building**
| Topic | Decision |
|---|---|
| Session | Token and user in localStorage; on load, `/auth/me` confirms the token (invalid → cleared). Any 401 from the API logs out and redirects to `/login?expired=1`. A failed login attempt does not trigger this. |
| Cart storage | Key `campusbite_cart_<userId>`: each customer has their own cart, guests have none (Add asks them to log in), and a logged-out cart is never shown to the next user |
| Redirect after login | Back to the page that required login if `canAccessPath(role, path)`; otherwise the role's home (customer `/`, owner `/owner/dashboard`, partner `/delivery/dashboard`) |
| Public pages | `/` and `/restaurants/:id` are public; logged-in owners and partners are redirected to their dashboards (`CustomerHome`) |
| Server errors | FastAPI 422 details are mapped to field names (e.g. `restaurant.name`) and shown under the matching inputs |
| `/orders/:id` | Any logged-in role can open it; the backend decides (404 if not theirs) |

**Tests: 19 passing (Vitest)**
- cart reducer (5)
- RoleRoute: guest → login, right role, wrong role → unauthorized, expired session → logout (4) + role helpers (2)
- LoginPage: validation before calling the API, success → token stored and owner redirect, server error shown (3)
- API error normalisation and params (5)

**Verification log**
- [x] `npm run build`: OK (≈ 230 kB JS, 76 kB gzipped)
- [x] `npx vitest run`: 19 passed, no warnings
- [ ] Manual browser check (no browser on this machine); covered by the live UI integration test added in P9

**Post-release fix: sessions across tabs.** Browser tabs share localStorage. Logging in as user B in one tab replaced the token used by a tab still showing user A, so that tab got 403 "Insufficient permissions" (the backend role checks were working correctly). `AuthContext` now listens for the `storage` event. When the logged-in user changes in another tab, this tab switches to that user's home page, or to `/login` after a logout. The state change and the navigation happen in one `startTransition`, so route guards never see the new user on the old page. Covered by 2 new tests (38 frontend tests in total). Use a private window to stay logged in as two roles at once.
