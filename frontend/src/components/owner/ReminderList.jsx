import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ownerApi } from '../../api/owner';
import { useToast } from '../../hooks/useToast';
import { STATUS_LABELS } from '../../utils/constants';
import { timeAgo } from '../../utils/format';

export default function ReminderList({ reminders, onChanged }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);
  if (!reminders.length) return null;

  const acknowledge = async (id) => {
    setBusyId(id);
    try {
      await ownerApi.acknowledgeReminder(id);
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4" aria-label="Reminders">
      <h2 className="font-semibold text-amber-900">
        {reminders.length} order{reminders.length > 1 ? 's need' : ' needs'} attention
      </h2>
      <p className="text-sm text-amber-800/80">These orders haven't been updated for more than 15 minutes.</p>
      <ul className="mt-3 divide-y divide-amber-200/70">
        {reminders.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium text-amber-950">{r.message}</p>
              <p className="text-xs text-amber-800/70">Still {STATUS_LABELS[r.order_status_at_reminder].toLowerCase()} · reminder {timeAgo(r.created_at)}</p>
            </div>
            <div className="flex gap-2">
              <Link to="/owner/orders" className="btn-secondary btn-sm">View orders</Link>
              <button type="button" className="btn-ghost btn-sm" onClick={() => acknowledge(r.id)} disabled={busyId === r.id}>Dismiss</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
