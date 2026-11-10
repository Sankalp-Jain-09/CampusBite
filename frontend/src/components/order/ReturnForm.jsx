import { useEffect, useState } from 'react';
import { ordersApi } from '../../api/orders';
import { useToast } from '../../hooks/useToast';
import Button from '../common/Button';
import Modal from '../common/Modal';

const MIN = 10;
const MAX = 500;

export default function ReturnForm({ orderId, onDone, open, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const length = reason.trim().length;

  // Start fresh each time the form opens for an order.
  useEffect(() => {
    if (open) {
      setReason('');
      setError('');
    }
  }, [open, orderId]);

  const submit = async () => {
    if (length < MIN) {
      setError(`Please describe the problem in at least ${MIN} characters`);
      return;
    }
    setBusy(true);
    try {
      await ordersApi.requestReturn(orderId, reason.trim());
      toast.success('Return request sent to the restaurant');
      onClose();
      onDone?.();
    } catch (err) {
      setError(err.fieldErrors?.reason || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Request a return / refund"
      onClose={busy ? undefined : onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} loading={busy}>Send request</Button>
        </>
      )}
    >
      <label htmlFor="return-reason" className="label">What went wrong?</label>
      <textarea id="return-reason" className={`input ${error ? 'input-error' : ''}`} rows={4} maxLength={MAX}
        value={reason} onChange={(e) => { setReason(e.target.value); setError(''); }}
        placeholder="e.g. The naan was missing and the curry arrived cold." />
      <div className="mt-1 flex justify-between text-xs">
        <span className="text-red-600">{error}</span>
        <span className={length < MIN ? 'text-gray-400' : 'text-gray-500'}>{length}/{MAX}</span>
      </div>
      <p className="mt-3 text-xs text-gray-500">The restaurant will approve or reject your request. You can only send one request per order.</p>
    </Modal>
  );
}
