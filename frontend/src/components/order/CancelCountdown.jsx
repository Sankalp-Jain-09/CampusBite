import { useState } from 'react';
import { ordersApi } from '../../api/orders';
import { useCountdown } from '../../hooks/useCountdown';
import { useToast } from '../../hooks/useToast';
import { formatCountdown, formatCurrency } from '../../utils/format';
import Button from '../common/Button';
import ConfirmDialog from '../common/ConfirmDialog';

/**
 * D14: free cancellation for 60 seconds after ordering (automatic full refund, no reason asked).
 * After that, while still PLACED, the customer may cancel without a refund (D5).
 */
export default function CancelCountdown({ order, onChanged, compact = false }) {
  const toast = useToast();
  const remaining = useCountdown(order.cancel_window_remaining_seconds, `${order.id}-${order.status}`);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const total = 60;

  if (order.status !== 'PLACED') return null;

  const cancel = async () => {
    setBusy(true);
    try {
      const result = await ordersApi.cancel(order.id);
      if (result.refunded_amount > 0) toast.success(`Order cancelled · ${formatCurrency(result.refunded_amount)} refunded (demo)`);
      else toast.info('Order cancelled. No refund was issued.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      setConfirming(false);
      onChanged?.();
    }
  };

  if (remaining > 0) {
    if (compact) {
      return (
        <Button size="sm" variant="secondary" loading={busy} onClick={cancel} className="border-brand-200 text-brand-700">
          Cancel free · {formatCountdown(remaining)}
        </Button>
      );
    }
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-brand-700">Changed your mind?</p>
            <p className="text-sm text-brand-700/80">Cancel within the next minute for a full refund — no questions asked.</p>
          </div>
          <Button onClick={cancel} loading={busy}>Cancel for free · {formatCountdown(remaining)}</Button>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-100" aria-hidden="true">
          <div className="h-full rounded-full bg-brand-600 transition-all duration-300" style={{ width: `${Math.min(100, (remaining / total) * 100)}%` }} />
        </div>
      </div>
    );
  }

  return (
    <>
      <Button size={compact ? 'sm' : undefined} variant="secondary" onClick={() => setConfirming(true)}>
        Cancel order (no refund)
      </Button>
      <ConfirmDialog
        open={confirming}
        title="Cancel without refund?"
        message={`The free cancellation window has ended. Cancelling now will not refund ${formatCurrency(order.total_amount)}. Continue?`}
        confirmLabel="Yes, cancel order"
        cancelLabel="Keep order"
        danger
        loading={busy}
        onConfirm={cancel}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
