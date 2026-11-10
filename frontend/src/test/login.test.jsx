import { fireEvent, screen } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '../pages/auth/LoginPage';
import { storage } from '../utils/storage';
import { renderWithProviders } from './renderWithProviders';

vi.mock('../api/auth', () => ({ authApi: { login: vi.fn(), me: vi.fn() } }));
const { authApi } = await import('../api/auth');

const routes = (
  <>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/owner/dashboard" element={<p>Owner dashboard</p>} />
    <Route path="/" element={<p>Restaurants</p>} />
  </>
);

function fill(email, password) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
}

describe('LoginPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validates before calling the API', async () => {
    renderWithProviders(null, { route: '/login', routes });
    fill('not-an-email', '');
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('logs in, stores the token and redirects by role', async () => {
    authApi.login.mockResolvedValue({
      access_token: 'jwt-123', token_type: 'bearer',
      user: { id: 7, name: 'Ravi', email: 'ravi@example.com', role: 'restaurant_owner' },
    });
    renderWithProviders(null, { route: '/login', routes });
    fill('ravi@example.com', 'Secret123');
    expect(await screen.findByText('Owner dashboard')).toBeInTheDocument();
    expect(authApi.login).toHaveBeenCalledWith('ravi@example.com', 'Secret123');
    expect(storage.getToken()).toBe('jwt-123');
    expect(storage.getUser().role).toBe('restaurant_owner');
  });

  it('shows the server error message', async () => {
    authApi.login.mockRejectedValue({ status: 401, message: 'Invalid email or password', fieldErrors: {} });
    renderWithProviders(null, { route: '/login', routes });
    fill('ravi@example.com', 'wrongpass');
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(storage.getToken()).toBeNull();
  });
});
