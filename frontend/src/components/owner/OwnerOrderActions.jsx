import { useState } from 'react';
import { ownerApi } from '../../api/owner';
import { useCountdown } from '../../hooks/useCountdown';
import { useToast } from '../../hooks/useToast';
import { formatCountdown } from '../../utils/format';
import Button from '../common/Button';

const NEXT = {
  ACCEPTED: { target: 'PREPARING', label: 'Start preparing' },
  PREPARING: { target: 'READY', label: 'Mark ready' },
};

/** The one valid next step for an order (the backend enforces it too). Owners cannot cancel (D6). */
export default function OwnerOrderActions({ order, onChanged, onAssign }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const windowLeft = useCountdown(order.cancel_window_remaining_seconds, `${order.id}-${order.status}`);

  const setStatus = async (target, label) => {
    setBusy(true);
    try {
      await ownerApi.setStatus(order.id, target);
      toast.success(`Order #${order.id}: ${label.toLowerCase()}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      onChanged?.();
    }
  };

  if (order.status === 'PLACED') {
    if (windowLeft > 0) {
      return (
        <Button size="sm" variant="secondary" disabled title="The customer can still cancel for free">
          Awaiting customer · {formatCountdown(windowLeft)}
        </Button>
      );
    }
    return <Button size="sm" loading={busy} onClick={() => setStatus('ACCEPTED', 'Accepted')}>Accept</Button>;
  }
  if (NEXT[order.status]) {
    const { target, label } = NEXT[order.status];
    return <Button size="sm" loading={busy} onClick={() => setStatus(target, label)}>{label}</Button>;
  }
  if (order.status === 'READY') {
    return <Button size="sm" onClick={() => onAssign(order)}>Assign rider</Button>;
  }
  if (order.delivery_partner_name && ['ASSIGNED', 'OUT_FOR_DELIVERY'].includes(order.status)) {
    return <span className="text-xs text-gray-500">Rider: {order.delivery_partner_name}</span>;
  }
  return null;
}
