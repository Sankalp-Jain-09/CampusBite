import { screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RoleRoute from '../components/routing/RoleRoute';
import { canAccessPath, homePathFor } from '../utils/constants';
import { storage } from '../utils/storage';
import { renderWithProviders } from './renderWithProviders';

vi.mock('../api/auth', () => ({ authApi: { me: vi.fn() } }));
const { authApi } = await import('../api/auth');

const routes = (
  <>
    <Route element={<RoleRoute roles={['restaurant_owner']} />}>
      <Route path="/owner/dashboard" element={<p>Owner area</p>} />
    </Route>
    <Route path="/login" element={<p>Login page</p>} />
    <Route path="/unauthorized" element={<p>No access</p>} />
  </>
);

function loginAs(role) {
  const user = { id: 1, name: 'Test', email: 't@example.com', role };
  storage.setAuth('token', user);
  authApi.me.mockResolvedValue(user);
}

describe('RoleRoute', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends guests to the login page', async () => {
    renderWithProviders(null, { route: '/owner/dashboard', routes });
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('lets the right role in', async () => {
    loginAs('restaurant_owner');
    renderWithProviders(null, { route: '/owner/dashboard', routes });
    expect(await screen.findByText('Owner area')).toBeInTheDocument();
  });

  it('sends other roles to /unauthorized', async () => {
    loginAs('customer');
    renderWithProviders(null, { route: '/owner/dashboard', routes });
    expect(await screen.findByText('No access')).toBeInTheDocument();
  });

  it('logs out when the stored token is no longer valid', async () => {
    storage.setAuth('expired', { id: 1, role: 'restaurant_owner' });
    authApi.me.mockRejectedValue({ status: 401, message: 'Invalid or expired token' });
    renderWithProviders(null, { route: '/owner/dashboard', routes });
    expect(await screen.findByText('Login page')).toBeInTheDocument();
    await waitFor(() => expect(storage.getToken()).toBeNull());
  });
});

describe('role helpers', () => {
  it('homePathFor', () => {
    expect(homePathFor('customer')).toBe('/');
    expect(homePathFor('restaurant_owner')).toBe('/owner/dashboard');
    expect(homePathFor('delivery_partner')).toBe('/delivery/dashboard');
  });

  it('canAccessPath', () => {
    expect(canAccessPath('customer', '/checkout')).toBe(true);
    expect(canAccessPath('customer', '/owner/menu')).toBe(false);
    expect(canAccessPath('restaurant_owner', '/owner/menu')).toBe(true);
    expect(canAccessPath('restaurant_owner', '/checkout')).toBe(false);
    expect(canAccessPath('delivery_partner', '/orders/5')).toBe(true);
    expect(canAccessPath('delivery_partner', '/delivery/register')).toBe(false);
    expect(canAccessPath('customer', undefined)).toBe(false);
  });
});

describe('session changes in another tab', () => {
  const tabRoutes = (
    <>
      <Route element={<RoleRoute roles={['restaurant_owner']} />}>
        <Route path="/owner/dashboard" element={<p>Owner area</p>} />
      </Route>
      <Route path="/" element={<p>Customer home</p>} />
      <Route path="/login" element={<p>Login page</p>} />
    </>
  );

  it('follows a login as another user in a different tab', async () => {
    loginAs('restaurant_owner');
    renderWithProviders(null, { route: '/owner/dashboard', routes: tabRoutes });
    expect(await screen.findByText('Owner area')).toBeInTheDocument();

    // Another tab logs in as a customer (same localStorage).
    storage.setAuth('customer-token', { id: 2, name: 'Asha', email: 'a@example.com', role: 'customer' });
    window.dispatchEvent(new StorageEvent('storage', { key: 'campusbite_user' }));
    expect(await screen.findByText('Customer home')).toBeInTheDocument();
  });

  it('follows a logout in a different tab', async () => {
    loginAs('restaurant_owner');
    renderWithProviders(null, { route: '/owner/dashboard', routes: tabRoutes });
    await screen.findByText('Owner area');
    storage.clearAuth();
    window.dispatchEvent(new StorageEvent('storage', { key: 'campusbite_user' }));
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
});
