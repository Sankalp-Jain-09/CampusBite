import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ownerApi } from '../../api/owner';
import { ReturnBadge } from '../../components/common/Badges';
import Button from '../../components/common/Button';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import ErrorMessage from '../../components/common/ErrorMessage';
import Loader from '../../components/common/Loader';
import Modal from '../../components/common/Modal';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import { useApi } from '../../hooks/useApi';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../hooks/useToast';
import { formatCurrency, formatDateTime } from '../../utils/format';

const FILTERS = [
  { value: 'requested', label: 'Waiting' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

export default function ReturnRequestsPage() {
  const toast = useToast();
  const [status, setStatus] = useState('requested');
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [busy, setBusy] = useState(false);
  const { page, pageSize, setPage, reset } = usePagination(10);

  useEffect(reset, [status, reset]);
  const { data, loading, error, refetch } = useApi(() => ownerApi.returns({ status, page, page_size: pageSize }), [status, page, pageSize]);

  const approve = async () => {
    setBusy(true);
    try {
      await ownerApi.approveReturn(approving.id);
      toast.success(`Refund of ${formatCurrency(approving.order_total)} issued for order #${approving.order_id} (demo)`);
      setApproving(null);
      refetch({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (note.trim().length < 5) {
      setNoteError('Please explain your decision (at least 5 characters)');
      return;
    }
    setBusy(true);
    try {
      await ownerApi.rejectReturn(rejecting.id, note.trim());
      toast.info(`Return for order #${rejecting.order_id} rejected`);
      setRejecting(null);
      refetch({ silent: true });
    } catch (err) {
      setNoteError(err.fieldErrors?.owner_note || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Return requests" subtitle="Approve to refund the customer, or reject with a short explanation." />
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.label} type="button" onClick={() => setStatus(f.value)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${status === f.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'}`}>
            {f.label}
          </button>
        ))}
      </div>
      {loading && !data && <Loader />}
      <ErrorMessage error={error} onRetry={refetch} />
      {data?.items.length === 0 && <EmptyState title="Nothing here" message={status === 'requested' ? 'No return requests are waiting for you.' : 'No requests match this filter.'} />}
      <div className="space-y-3">
        {data?.items.map((rr) => (
          <article key={rr.id} className="card p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/orders/${rr.order_id}`} className="font-semibold hover:text-brand-700">Order #{rr.order_id}</Link>
                  <ReturnBadge status={rr.status} />
                </div>
                <p className="text-sm text-gray-600">{rr.customer_name} · {formatCurrency(rr.order_total)} · requested {formatDateTime(rr.created_at)}</p>
                <p className="text-sm text-gray-500">{rr.items_summary}</p>
              </div>
              {rr.status === 'requested' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { setRejecting(rr); setNote(''); setNoteError(''); }}>Reject</Button>
                  <Button size="sm" onClick={() => setApproving(rr)}>Approve refund</Button>
                </div>
              )}
            </div>
            <blockquote className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">“{rr.reason}”</blockquote>
            {rr.owner_note && <p className="mt-2 text-sm text-gray-500"><span className="font-medium">Your note:</span> {rr.owner_note}</p>}
          </article>
        ))}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}

      <ConfirmDialog open={Boolean(approving)} title="Approve refund?" loading={busy}
        message={`Refund ${formatCurrency(approving?.order_total)} to ${approving?.customer_name} for order #${approving?.order_id} (demo). This cannot be undone.`}
        confirmLabel="Approve & refund" onConfirm={approve} onCancel={() => setApproving(null)} />
      <Modal open={Boolean(rejecting)} title={`Reject return for order #${rejecting?.order_id}`} onClose={busy ? undefined : () => setRejecting(null)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)} disabled={busy}>Cancel</Button>
            <Button variant="danger" onClick={reject} loading={busy}>Reject request</Button>
          </>
        )}>
        <label htmlFor="reject-note" className="label">Note to the customer</label>
        <textarea id="reject-note" rows={3} maxLength={500} className={`input ${noteError ? 'input-error' : ''}`} value={note}
          onChange={(e) => { setNote(e.target.value); setNoteError(''); }} placeholder="e.g. The order photos show all items were delivered." />
        {noteError && <p className="mt-1 text-xs text-red-600">{noteError}</p>}
      </Modal>
    </>
  );
}
