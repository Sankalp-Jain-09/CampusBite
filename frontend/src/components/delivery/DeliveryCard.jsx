import { useState } from 'react';
import { Link } from 'react-router-dom';
import { deliveryApi } from '../../api/delivery';
import { useToast } from '../../hooks/useToast';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { StatusBadge } from '../common/Badges';
import Button from '../common/Button';
import ConfirmDialog from '../common/ConfirmDialog';

const NEXT = {
  ASSIGNED: { target: 'OUT_FOR_DELIVERY', label: 'Picked up · Out for delivery', confirm: 'Confirm you have picked up this order from the restaurant.' },
  OUT_FOR_DELIVERY: { target: 'DELIVERED', label: 'Mark delivered', confirm: 'Confirm the order was handed to the customer.' },
};

export default function DeliveryCard({ order, onChanged }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const next = NEXT[order.status];

  const update = async () => {
    setBusy(true);
    try {
      await deliveryApi.setStatus(order.id, next.target);
      toast.success(next.target === 'DELIVERED' ? `Order #${order.id} delivered` : `Order #${order.id} is out for delivery`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      setConfirming(false);
      onChanged?.();
    }
  };

  return (
    <article className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <Link to={`/orders/${order.id}`} className="font-semibold hover:text-brand-700">Order #{order.id}</Link>
        <StatusBadge status={order.status} />
      </div>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pick up</p>
          <p className="font-medium">{order.restaurant_name}</p>
          <p className="text-gray-600">{order.restaurant_address}</p>
        </div>
        <div className="rounded-lg bg-brand-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Deliver to</p>
          <p className="font-medium">{order.customer_name}</p>
          <p className="text-gray-700">{order.delivery_address}</p>
          <a href={`tel:${order.contact_phone}`} className="link">{order.contact_phone}</a>
        </div>
      </div>
      <p className="mt-3 truncate text-sm text-gray-500">{order.items_summary}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-gray-500">{formatCurrency(order.total_amount)} · assigned {formatDateTime(order.status_updated_at)}</span>
        {next && <Button onClick={() => setConfirming(true)}>{next.label}</Button>}
      </div>
      {next && (
        <ConfirmDialog
          open={confirming}
          title={next.label}
          message={next.confirm}
          confirmLabel="Confirm"
          loading={busy}
          onConfirm={update}
          onCancel={() => setConfirming(false)}
        />
      )}
    </article>
  );
}
