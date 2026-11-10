// Regression tests for the bugs found in the UI test run (doc/UI_TEST_REPORT.md, BUG-01 … BUG-08).
import { fireEvent, render, screen } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '../components/common/ErrorBoundary';
import DishFilters from '../components/restaurant/DishFilters';
import GuestOnly from '../components/routing/GuestOnly';
import RoleRoute from '../components/routing/RoleRoute';
import { EMPTY_CART, sanitizeCart } from '../context/CartContext';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import LoginPage from '../pages/auth/LoginPage';
import { storage } from '../utils/storage';
import { renderWithProviders } from './renderWithProviders';

vi.mock('../api/auth', () => ({ authApi: { me: vi.fn(), login: vi.fn() } }));
const { authApi } = await import('../api/auth');

const owner = { id: 1, name: 'Ravi', email: 'ravi@example.com', role: 'restaurant_owner' };
const customer = { id: 2, name: 'Asha', email: 'asha@example.com', role: 'customer' };

const routes = (
  <>
    <Route element={<RoleRoute roles={['restaurant_owner']} />}>
      <Route path="/owner/dashboard" element={<p>Owner area</p>} />
    </Route>
    <Route element={<RoleRoute roles={['customer']} />}>
      <Route path="/customer/dashboard" element={<p>Customer orders</p>} />
    </Route>
    <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
    <Route path="/" element={<p>Home</p>} />
  </>
);

function logIn(email) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Secret123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
}

describe('BUG-01: session survives a backend outage', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it('keeps the user logged in when /auth/me fails with a network error', async () => {
    storage.setAuth('good-token', owner);
    authApi.me.mockRejectedValue({ status: 0, message: 'Cannot reach the server. Is the backend running?' });
    renderWithProviders(null, { route: '/owner/dashboard', routes });
    expect(await screen.findByText('Owner area')).toBeInTheDocument();
    expect(storage.getToken()).toBe('good-token');
  });

  it('keeps the user logged in on a 503', async () => {
    storage.setAuth('good-token', owner);
    authApi.me.mockRejectedValue({ status: 503, message: 'Service unavailable' });
    renderWithProviders(null, { route: '/owner/dashboard', routes });
    expect(await screen.findByText('Owner area')).toBeInTheDocument();
    expect(storage.getToken()).toBe('good-token');
  });

  it('still logs out a disabled account (403) without the "expired" banner', async () => {
    storage.setAuth('good-token', owner);
    authApi.me.mockRejectedValue({ status: 403, message: 'Account is disabled' });
    renderWithProviders(null, { route: '/owner/dashboard', routes });
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(storage.getToken()).toBeNull();
    expect(screen.queryByText(/Your session expired/)).not.toBeInTheDocument();
  });
});

describe('BUG-04: "session expired" banner', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it('is shown when the stored token is rejected (401)', async () => {
    storage.setAuth('expired-token', owner);
    authApi.me.mockRejectedValue({ status: 401, message: 'Invalid or expired token' });
    renderWithProviders(null, { route: '/owner/dashboard', routes });
    expect(await screen.findByText('Your session expired. Please log in again.')).toBeInTheDocument();
    expect(storage.getToken()).toBeNull();
  });

  it('is not shown on a normal visit to the login page', async () => {
    renderWithProviders(null, { route: '/login', routes });
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByText(/Your session expired/)).not.toBeInTheDocument();
  });
});

describe('BUG-03: login returns to the page that required it', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it('goes back to the protected page after logging in', async () => {
    authApi.login.mockResolvedValue({ access_token: 'jwt', token_type: 'bearer', user: customer });
    renderWithProviders(null, { route: '/customer/dashboard', routes });
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    logIn('asha@example.com');
    expect(await screen.findByText('Customer orders')).toBeInTheDocument();
  });

  it("goes to the role's home when the original page is not allowed for that role", async () => {
    authApi.login.mockResolvedValue({ access_token: 'jwt', token_type: 'bearer', user: customer });
    renderWithProviders(null, { route: '/owner/dashboard', routes });
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    logIn('asha@example.com');
    expect(await screen.findByText('Home')).toBeInTheDocument();
  });

  it('after clicking Log out on a protected page, the next login starts from the role home', async () => {
    storage.setAuth('t', customer);
    authApi.me.mockResolvedValue(customer);
    authApi.login.mockResolvedValue({ access_token: 'jwt', token_type: 'bearer', user: customer });
    function LogoutButton() { const { logout } = useAuth(); return <button type="button" onClick={logout}>Log out</button>; }
    const withLogout = (
      <>
        <Route element={<RoleRoute roles={['customer']} />}>
          <Route path="/customer/dashboard" element={<><p>Customer orders</p><LogoutButton /></>} />
        </Route>
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/" element={<p>Home</p>} />
      </>
    );
    renderWithProviders(null, { route: '/customer/dashboard', routes: withLogout });
    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    logIn('asha@example.com');
    expect(await screen.findByText('Home')).toBeInTheDocument();
  });

  it('a plain login still goes to the role home', async () => {
    authApi.login.mockResolvedValue({ access_token: 'jwt', token_type: 'bearer', user: owner });
    renderWithProviders(null, { route: '/login', routes });
    logIn('ravi@example.com');
    expect(await screen.findByText('Owner area')).toBeInTheDocument();
  });
});

describe('BUG-05: malformed cart in localStorage', () => {
  it('sanitizeCart rejects bad shapes and fixes bad lines', () => {
    for (const bad of [null, 'string', 42, [], { items: 'oops' }, { restaurant: null, items: [] }, { restaurant: { id: 'x' }, items: [] }]) {
      expect(sanitizeCart(bad)).toEqual(EMPTY_CART);
    }
    const cart = sanitizeCart({
      restaurant: { id: 1, name: 'Curry' },
      items: [
        { menuItemId: 10, name: 'Paneer', price: 180, quantity: 2 },
        { menuItemId: 11, name: 'Naan', price: 'abc', quantity: 1 },     // bad price → dropped
        { menuItemId: 12, name: 'Lassi', price: 70, quantity: -5 },      // bad quantity → dropped
        { menuItemId: 13, name: 'Dal', price: 170, quantity: 99999 },    // capped at 20
        null,
      ],
    });
    expect(cart).toEqual({
      restaurant: { id: 1, name: 'Curry' },
      items: [{ menuItemId: 10, name: 'Paneer', price: 180, quantity: 2 }, { menuItemId: 13, name: 'Dal', price: 170, quantity: 20 }],
    });
  });

  it('the app renders with a corrupted stored cart', async () => {
    storage.setAuth('t', customer);
    authApi.me.mockResolvedValue(customer);
    localStorage.setItem(`campusbite_cart_${customer.id}`, JSON.stringify({ restaurant: null, items: 'oops' }));
    function CartCount() { const cart = useCart(); return <p>{cart.itemCount} items</p>; }
    renderWithProviders(<CartCount />);
    expect(await screen.findByText('0 items')).toBeInTheDocument();
  });

  it('an unexpected render error shows a recovery screen, not a blank page', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Boom() { throw new Error('boom'); }
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('BUG-08: menu filters keep quick successive changes', () => {
  const DEFAULTS = { search: '', min_price: '', max_price: '', category: '', veg: '', sort: 'name' };

  it('builds each change on the latest values even if the URL has not re-rendered yet', () => {
    const onChange = vi.fn();
    render(<DishFilters filters={DEFAULTS} defaults={DEFAULTS} categories={['Mains']} onChange={onChange} />);
    // The parent never re-renders with new props here: exactly the "URL update is still pending" situation.
    fireEvent.change(screen.getByLabelText('Minimum price'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Maximum price'), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Mains' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULTS, min_price: '100', max_price: '200', category: 'Mains' });
    expect(screen.getByLabelText('Minimum price')).toHaveValue(100);
  });

  it('Clear filters resets immediately, and the next change starts from the defaults', () => {
    const onChange = vi.fn();
    const filters = { ...DEFAULTS, category: 'Mains', veg: 'false' };
    render(<DishFilters filters={filters} defaults={DEFAULTS} categories={['Mains']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onChange).toHaveBeenLastCalledWith(DEFAULTS);
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'price_asc' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULTS, sort: 'price_asc' });
  });

  it('follows a filter change that comes from outside (new props)', () => {
    const { rerender } = render(<DishFilters filters={DEFAULTS} defaults={DEFAULTS} onChange={() => {}} />);
    rerender(<DishFilters filters={{ ...DEFAULTS, search: 'naan' }} defaults={DEFAULTS} onChange={() => {}} />);
    expect(screen.getByLabelText('Search dishes')).toHaveValue('naan');
  });
});

describe('BUG-06: rate-limit wait time reaches the UI', () => {
  it('normalizeError reads Retry-After', async () => {
    const { normalizeError } = await import('../api/client');
    const err = normalizeError({ response: { status: 429, data: { detail: 'Too many requests' }, headers: { 'retry-after': '42' } } });
    expect(err).toMatchObject({ status: 429, retryAfter: '42' });
  });
});
