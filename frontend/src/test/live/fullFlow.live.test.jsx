// @vitest-environment-options {"url": "http://localhost:5173/"}
/**
 * Live end-to-end UI test: the real <App/> + real Axios client against a running backend.
 * Skipped unless LIVE_API=1. Start the backend first (fresh DB, CANCEL_GRACE_SECONDS=2), e.g.:
 *   CANCEL_GRACE_SECONDS=2 uvicorn app.main:app --port 8000
 *   LIVE_API=1 npx vitest run src/test/live
 */
import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import { beforeAll, describe, expect, it } from 'vitest';
import App from '../../App';
import { storage } from '../../utils/storage';
import { renderWithProviders } from '../renderWithProviders';

configure({ asyncUtilTimeout: 8000 });
const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const run = Date.now();
const S = { owner: null, partner: null, customer: null, orderId: null };

function session(auth) {
  storage.setAuth(auth.access_token, auth.user);
}
function open(route) {
  return renderWithProviders(<App />, { route });
}
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = async (name, opts = {}, waitOpts) => fireEvent.click(await screen.findByRole('button', { name, ...opts }, waitOpts));

describe.skipIf(!process.env.LIVE_API)('CampusBite full flow (live backend)', () => {
  beforeAll(async () => {
    const owner = await axios.post(`${API}/auth/register/restaurant-owner`, {
      name: 'Ravi Kumar', email: `ravi${run}@cb.dev`, phone: '9876543211', password: 'Secret123',
      restaurant: { name: `Curry House ${run}`, cuisine: 'North Indian', address: 'Food Court, Block A', phone: '9876500001' },
    });
    S.owner = owner.data;
    const h = { headers: { Authorization: `Bearer ${S.owner.access_token}` } };
    await axios.post(`${API}/owner/menu-items`, { name: 'Paneer Tikka', category: 'Starters', price: 180 }, h);
    await axios.post(`${API}/owner/menu-items`, { name: 'Butter Naan', category: 'Breads', price: 40 }, h);
    S.partner = { email: `meena${run}@cb.dev`, password: 'Secret123' };
    await axios.post(`${API}/auth/register/delivery-partner`, {
      name: 'Meena Rider', phone: '9876543212', vehicle_type: 'scooter', vehicle_number: 'KA01AB1234', ...S.partner,
    });
  });

  it('customer signs up through the form and lands on the restaurant list', async () => {
    open('/register');
    type('Full name', 'Asha Rao');
    type('Email', `asha${run}@cb.dev`);
    type('Phone', '9876543210');
    type('Password', 'Secret123');
    type('Confirm password', 'Secret123');
    await click('Create account');
    expect(await screen.findByText(/Hungry, Asha\?/)).toBeInTheDocument();
    S.customer = { access_token: storage.getToken(), user: storage.getUser() };
    expect(S.customer.user.role).toBe('customer');
  });

  it('customer adds dishes, checks out with the dummy payment and sees the free-cancel countdown', async () => {
    session(S.customer);
    open('/');
    fireEvent.click(await screen.findByRole('link', { name: new RegExp(`Curry House ${run}`) }));
    await screen.findByText('Paneer Tikka');
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Add' })).toHaveLength(1));
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);
    fireEvent.click(screen.getAllByRole('link', { name: 'Cart, 2 items' })[0]);
    await click('Proceed to checkout');
    type('Delivery address', 'Hostel B, Room 214');
    await click(/Pay .*250.* place order/);
    const heading = await screen.findByRole('heading', { name: /Order #\d+/ });
    S.orderId = Number(heading.textContent.match(/\d+/)[0]);
    expect(await screen.findByRole('button', { name: /Cancel for free · 0:0\d/ })).toBeInTheDocument();
    expect(screen.getAllByText('Paid (demo)').length).toBeGreaterThan(0);
  });

  it('customer cannot open owner pages', async () => {
    session(S.customer);
    open('/owner/dashboard');
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
  });

  it('owner waits for the window, then accepts, prepares, marks ready and assigns a rider', async () => {
    session(S.owner);
    open('/owner/orders');
    await screen.findByText(`Order #${S.orderId}`);
    await click('Accept', {}, { timeout: 8000 });     // appears once the 2s free window is over
    await click('Start preparing');
    await click('Mark ready');
    await click('Assign rider');
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(await within(dialog).findByRole('radio'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Assign' }));
    expect(await screen.findByText('Rider: Meena Rider')).toBeInTheDocument();
  });

  it('delivery partner logs in, sees the customer details and delivers', async () => {
    open('/login');
    type('Email', S.partner.email);
    type('Password', S.partner.password);
    await click('Log in');
    expect(await screen.findByText('Hostel B, Room 214')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '9876543210' })).toBeInTheDocument();
    await click('Picked up · Out for delivery');
    await click('Confirm');
    await click('Mark delivered');
    await click('Confirm');
    expect(await screen.findByText('No deliveries right now')).toBeInTheDocument();
  });

  it('customer sees DELIVERED, leaves a review and requests a return', async () => {
    session(S.customer);
    open(`/orders/${S.orderId}`);
    expect((await screen.findAllByText('Delivered')).length).toBeGreaterThan(0);
    fireEvent.click(await screen.findByRole('radio', { name: '4 stars' }));
    await click('Submit review');
    expect(await screen.findByText('Your review')).toBeInTheDocument();
    await click('Request return / refund');
    type('What went wrong?', 'The naan was missing from the bag.');
    await click('Send request');
    expect(await screen.findByText('Waiting for the restaurant to respond.')).toBeInTheDocument();
  });

  it('owner approves the return and the customer sees the refund', async () => {
    session(S.owner);
    const view = open('/owner/returns');
    expect(await screen.findByText(/The naan was missing/)).toBeInTheDocument();
    await click('Approve refund');
    await click('Approve & refund');
    expect(await screen.findByText('No return requests are waiting for you.')).toBeInTheDocument();
    view.unmount();

    session(S.customer);
    open(`/orders/${S.orderId}`);
    expect(await screen.findByText(/250\.00 refunded \(demo\)/)).toBeInTheDocument();
  });

  it('owner dashboard shows the statistics', async () => {
    session(S.owner);
    open('/owner/dashboard');
    expect(await screen.findByText('Total orders')).toBeInTheDocument();
    expect(await screen.findByText('4.0 ★')).toBeInTheDocument();
    expect(screen.getByText('Butter Naan')).toBeInTheDocument();
  });

  it('customer asks the AI assistant about their orders', async () => {
    session(S.customer);
    open('/customer/ai-insights');
    await click('How much did I spend this week?');
    expect(await screen.findByText(/You have 1 orders/)).toBeInTheDocument();
  });
});
