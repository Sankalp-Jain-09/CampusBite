import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CancelCountdown from '../components/order/CancelCountdown';
import AIInsightsPage from '../pages/customer/AIInsightsPage';
import CheckoutPage from '../pages/customer/CheckoutPage';
import { storage } from '../utils/storage';
import { renderWithProviders } from './renderWithProviders';

vi.mock('../api/auth', () => ({ authApi: { me: vi.fn() } }));
vi.mock('../api/orders', () => ({ ordersApi: { cancel: vi.fn(), place: vi.fn() } }));
vi.mock('../api/ai', () => ({ aiApi: { insights: vi.fn() } }));
vi.mock('../api/restaurants', () => ({ restaurantsApi: { menuItem: vi.fn() } }));
const { authApi } = await import('../api/auth');
const { ordersApi } = await import('../api/orders');
const { restaurantsApi } = await import('../api/restaurants');
const { aiApi } = await import('../api/ai');

const customer = { id: 5, name: 'Asha Rao', email: 'asha@example.com', role: 'customer', phone: '9876543210', default_address: 'Hostel B, Room 214' };

function loginCustomer() {
  storage.setAuth('token', customer);
  authApi.me.mockResolvedValue(customer);
}

const placedOrder = (seconds) => ({ id: 42, status: 'PLACED', total_amount: 510, cancel_window_remaining_seconds: seconds });

describe('CancelCountdown (D14)', () => {
  beforeEach(() => { vi.clearAllMocks(); loginCustomer(); });

  it('offers a free cancel with a countdown and reports the refund', async () => {
    ordersApi.cancel.mockResolvedValue({ status: 'CANCELLED', payment_status: 'refunded', refunded_amount: 510 });
    const onChanged = vi.fn();
    renderWithProviders(<CancelCountdown order={placedOrder(42)} onChanged={onChanged} />);
    const button = await screen.findByRole('button', { name: /Cancel for free · 0:4[12]/ });
    fireEvent.click(button);
    await waitFor(() => expect(ordersApi.cancel).toHaveBeenCalledWith(42));
    expect(await screen.findByText(/refunded \(demo\)/)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it('after the window, asks for confirmation before a no-refund cancel', async () => {
    ordersApi.cancel.mockResolvedValue({ status: 'CANCELLED', payment_status: 'mock_paid', refunded_amount: 0 });
    renderWithProviders(<CancelCountdown order={placedOrder(0)} onChanged={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel order (no refund)' }));
    expect(screen.getByText(/will not refund/)).toBeInTheDocument();
    expect(ordersApi.cancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel order' }));
    await waitFor(() => expect(ordersApi.cancel).toHaveBeenCalledWith(42));
  });

  it('counts down and switches to the no-refund option at zero', async () => {
    vi.useFakeTimers();
    try {
      renderWithProviders(<CancelCountdown order={placedOrder(2)} onChanged={() => {}} />);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(screen.getByRole('button', { name: /Cancel for free/ })).toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
      expect(screen.getByRole('button', { name: 'Cancel order (no refund)' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders nothing once the order is no longer PLACED', () => {
    const { container } = renderWithProviders(<CancelCountdown order={{ ...placedOrder(30), status: 'ACCEPTED' }} />);
    expect(container.textContent).toBe('');
  });
});

describe('CheckoutPage', () => {
  beforeEach(() => { vi.clearAllMocks(); loginCustomer(); });

  it('sends the cart (ids + quantities only) and opens the new order', async () => {
    storage.setJSON(`campusbite_cart_${customer.id}`, {
      restaurant: { id: 3, name: 'Campus Curry House' },
      items: [{ menuItemId: 10, name: 'Paneer Tikka', price: 180, quantity: 2 }, { menuItemId: 11, name: 'Butter Naan', price: 40, quantity: 3 }],
    });
    ordersApi.place.mockResolvedValue({ id: 99, total_amount: 510 });
    restaurantsApi.menuItem.mockImplementation(async (id) => (id === 10 ? { id, name: 'Paneer Tikka', price: 180 } : { id, name: 'Butter Naan', price: 40 }));
    renderWithProviders(null, {
      route: '/checkout',
      routes: (
        <>
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders/:id" element={<p>Order page</p>} />
          <Route path="/cart" element={<p>Cart page</p>} />
        </>
      ),
    });
    expect(await screen.findByDisplayValue('Hostel B, Room 214')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /Pay .*510.* place order/ }));
    expect(await screen.findByText('Order page')).toBeInTheDocument();
    expect(ordersApi.place).toHaveBeenCalledWith({
      restaurant_id: 3,
      items: [{ menu_item_id: 10, quantity: 2 }, { menu_item_id: 11, quantity: 3 }],
      delivery_address: 'Hostel B, Room 214',
      contact_phone: '9876543210',
      notes: null,
      expected_subtotal: 480,
    });
    expect(storage.getJSON(`campusbite_cart_${customer.id}`)).toBeNull();
    expect(screen.queryByText(/Prices changed/)).not.toBeInTheDocument();
  });

  const checkoutRoutes = (
    <>
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/orders/:id" element={<p>Order page</p>} />
      <Route path="/cart" element={<p>Cart page</p>} />
    </>
  );
  const naanCart = () => storage.setJSON(`campusbite_cart_${customer.id}`, {
    restaurant: { id: 3, name: 'Campus Curry House' },
    items: [{ menuItemId: 11, name: 'Garlic Naan', price: 50, quantity: 1 }],
  });

  it('refreshes prices that changed since the dish was added and pays the new total (BUG-02)', async () => {
    naanCart();
    restaurantsApi.menuItem.mockResolvedValue({ id: 11, name: 'Garlic Naan', price: 55 });
    ordersApi.place.mockResolvedValue({ id: 100, total_amount: 85 });
    renderWithProviders(null, { route: '/checkout', routes: checkoutRoutes });
    expect(await screen.findByText('Prices changed since you added these dishes')).toBeInTheDocument();
    expect(screen.getByText(/Garlic Naan: ₹50\.00 → ₹55\.00/)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /Pay ₹85\.00 & place order/ }));
    expect(await screen.findByText('Order page')).toBeInTheDocument();
    expect(ordersApi.place).toHaveBeenCalledWith(expect.objectContaining({ expected_subtotal: 55 }));
  });

  it('shows the new prices when the server refuses a stale total (409)', async () => {
    naanCart();
    restaurantsApi.menuItem
      .mockResolvedValueOnce({ id: 11, name: 'Garlic Naan', price: 50 })     // on page load: unchanged
      .mockResolvedValueOnce({ id: 11, name: 'Garlic Naan', price: 60 });    // after the 409: changed
    ordersApi.place.mockRejectedValue({ status: 409, message: 'Prices have changed since you added these dishes.', fieldErrors: {} });
    renderWithProviders(null, { route: '/checkout', routes: checkoutRoutes });
    fireEvent.click(await screen.findByRole('button', { name: /Pay ₹80\.00 & place order/ }));
    expect(await screen.findByText(/Prices have changed since you added these dishes\./)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Pay ₹90\.00 & place order/ })).toBeInTheDocument();
    expect(screen.getByText(/Garlic Naan: ₹50\.00 → ₹60\.00/)).toBeInTheDocument();
  });

  it('still lets the customer pay if the price check itself fails (server guard covers it)', async () => {
    naanCart();
    restaurantsApi.menuItem.mockRejectedValue({ status: 0, message: 'offline' });
    renderWithProviders(null, { route: '/checkout', routes: checkoutRoutes });
    const pay = await screen.findByRole('button', { name: /Pay ₹80\.00 & place order/ });
    expect(pay).toBeEnabled();
  });

  it('redirects to the cart when it is empty', async () => {
    renderWithProviders(null, {
      route: '/checkout',
      routes: (<><Route path="/checkout" element={<CheckoutPage />} /><Route path="/cart" element={<p>Cart page</p>} /></>),
    });
    expect(await screen.findByText('Cart page')).toBeInTheDocument();
  });
});

describe('AIInsightsPage', () => {
  beforeEach(() => { vi.clearAllMocks(); loginCustomer(); });

  it('asks a suggested question and shows the answer', async () => {
    aiApi.insights.mockResolvedValue({ answer: 'You spent ₹780 this week.', generated_at: new Date().toISOString(), orders_considered: 4 });
    renderWithProviders(<AIInsightsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'How much did I spend this week?' }));
    expect(await screen.findByText('You spent ₹780 this week.')).toBeInTheDocument();
    expect(aiApi.insights).toHaveBeenCalledWith('How much did I spend this week?');
    expect(screen.getByText(/4 orders considered/)).toBeInTheDocument();
  });

  it('explains rate limiting', async () => {
    aiApi.insights.mockRejectedValue({ status: 429, message: 'Too many', retryAfter: '20' });
    renderWithProviders(<AIInsightsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Summarize my orders' }));
    expect(await screen.findByText(/try again in 20 seconds/)).toBeInTheDocument();
    expect(aiApi.insights).toHaveBeenCalledWith(null);
  });
});
