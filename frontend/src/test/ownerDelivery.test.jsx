import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DeliveryCard from '../components/delivery/DeliveryCard';
import OwnerOrderActions from '../components/owner/OwnerOrderActions';
import ReturnRequestsPage from '../pages/owner/ReturnRequestsPage';
import { storage } from '../utils/storage';
import { renderWithProviders } from './renderWithProviders';

vi.mock('../api/auth', () => ({ authApi: { me: vi.fn() } }));
vi.mock('../api/owner', () => ({ ownerApi: { setStatus: vi.fn(), returns: vi.fn(), rejectReturn: vi.fn(), approveReturn: vi.fn() } }));
vi.mock('../api/delivery', () => ({ deliveryApi: { setStatus: vi.fn() } }));
const { authApi } = await import('../api/auth');
const { ownerApi } = await import('../api/owner');
const { deliveryApi } = await import('../api/delivery');

function loginAs(role) {
  const user = { id: 1, name: 'Test User', email: 't@example.com', role };
  storage.setAuth('token', user);
  authApi.me.mockResolvedValue(user);
}

const order = (over = {}) => ({
  id: 7, status: 'PLACED', cancel_window_remaining_seconds: 0, total_amount: 510, restaurant_name: 'Campus Curry House',
  restaurant_address: 'Food Court', customer_name: 'Asha Rao', delivery_address: 'Hostel B, Room 214', contact_phone: '9876543210',
  items_summary: '2× Paneer Tikka', status_updated_at: new Date().toISOString(), ...over,
});

describe('OwnerOrderActions', () => {
  beforeEach(() => { vi.clearAllMocks(); loginAs('restaurant_owner'); });

  it('blocks Accept during the customer free-cancel window (D14)', async () => {
    renderWithProviders(<OwnerOrderActions order={order({ cancel_window_remaining_seconds: 40 })} />);
    const btn = await screen.findByRole('button', { name: /Awaiting customer · 0:(39|40)/ });
    expect(btn).toBeDisabled();
  });

  it('accepts after the window', async () => {
    ownerApi.setStatus.mockResolvedValue({});
    const onChanged = vi.fn();
    renderWithProviders(<OwnerOrderActions order={order()} onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(ownerApi.setStatus).toHaveBeenCalledWith(7, 'ACCEPTED'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it.each([
    ['ACCEPTED', 'Start preparing', 'PREPARING'],
    ['PREPARING', 'Mark ready', 'READY'],
  ])('%s → %s', async (status, label, target) => {
    ownerApi.setStatus.mockResolvedValue({});
    renderWithProviders(<OwnerOrderActions order={order({ status })} />);
    fireEvent.click(await screen.findByRole('button', { name: label }));
    await waitFor(() => expect(ownerApi.setStatus).toHaveBeenCalledWith(7, target));
  });

  it('READY opens the assign flow; no cancel/reject button exists (D6)', async () => {
    const onAssign = vi.fn();
    renderWithProviders(<OwnerOrderActions order={order({ status: 'READY' })} onAssign={onAssign} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Assign rider' }));
    expect(onAssign).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /cancel|reject/i })).toBeNull();
  });
});

describe('DeliveryCard', () => {
  beforeEach(() => { vi.clearAllMocks(); loginAs('delivery_partner'); });

  it('shows customer delivery details and confirms before marking out for delivery', async () => {
    deliveryApi.setStatus.mockResolvedValue({});
    renderWithProviders(<DeliveryCard order={order({ status: 'ASSIGNED' })} onChanged={() => {}} />);
    expect(await screen.findByText('Hostel B, Room 214')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '9876543210' })).toHaveAttribute('href', 'tel:9876543210');
    fireEvent.click(screen.getByRole('button', { name: 'Picked up · Out for delivery' }));
    expect(deliveryApi.setStatus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(deliveryApi.setStatus).toHaveBeenCalledWith(7, 'OUT_FOR_DELIVERY'));
  });

  it('marks delivered from OUT_FOR_DELIVERY', async () => {
    deliveryApi.setStatus.mockResolvedValue({});
    renderWithProviders(<DeliveryCard order={order({ status: 'OUT_FOR_DELIVERY' })} onChanged={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark delivered' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(deliveryApi.setStatus).toHaveBeenCalledWith(7, 'DELIVERED'));
  });
});

describe('ReturnRequestsPage', () => {
  beforeEach(() => { vi.clearAllMocks(); loginAs('restaurant_owner'); });

  const page = {
    items: [{ id: 3, order_id: 7, status: 'requested', reason: 'Naan was missing from the bag', customer_name: 'Asha Rao',
      order_total: 510, items_summary: '2× Paneer Tikka', created_at: new Date().toISOString() }],
    total: 1, page: 1, pages: 1, page_size: 10,
  };

  it('requires a note to reject', async () => {
    ownerApi.returns.mockResolvedValue(page);
    ownerApi.rejectReturn.mockResolvedValue({});
    renderWithProviders(<ReturnRequestsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject request' }));
    expect(await screen.findByText(/at least 5 characters/)).toBeInTheDocument();
    expect(ownerApi.rejectReturn).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Note to the customer'), { target: { value: 'Photos show it was delivered' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reject request' }));
    await waitFor(() => expect(ownerApi.rejectReturn).toHaveBeenCalledWith(3, 'Photos show it was delivered'));
  });

  it('approves after confirmation', async () => {
    ownerApi.returns.mockResolvedValue(page);
    ownerApi.approveReturn.mockResolvedValue({});
    renderWithProviders(<ReturnRequestsPage />);
    expect(await screen.findByText(/Naan was missing/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve refund' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve & refund' }));
    await waitFor(() => expect(ownerApi.approveReturn).toHaveBeenCalledWith(3));
  });
});

describe('DishImage', () => {
  it('shows the photo, and falls back to the initial if it fails to load', async () => {
    const { default: DishImage } = await import('../components/common/DishImage');
    const { render } = await import('@testing-library/react');
    const { container } = render(<DishImage src="https://example.com/paneer.jpg" name="Paneer Tikka" />);
    const img = screen.getByRole('img', { name: 'Paneer Tikka' });
    expect(img).toHaveAttribute('src', 'https://example.com/paneer.jpg');
    fireEvent.error(img);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.textContent).toBe('P');
  });
});
