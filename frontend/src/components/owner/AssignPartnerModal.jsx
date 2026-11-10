import { useEffect, useState } from 'react';
import { ownerApi } from '../../api/owner';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../hooks/useToast';
import { VEHICLE_TYPES } from '../../utils/constants';
import Button from '../common/Button';
import ErrorMessage from '../common/ErrorMessage';
import Loader from '../common/Loader';
import Modal from '../common/Modal';

export default function AssignPartnerModal({ order, onClose, onAssigned }) {
  const toast = useToast();
  const open = Boolean(order);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const partners = useApi(() => ownerApi.deliveryPartners(), [open], { enabled: open });

  useEffect(() => {
    if (open) setSelected(null);
  }, [open]);

  const assign = async () => {
    setSaving(true);
    try {
      await ownerApi.assign(order.id, selected);
      toast.success(`Order #${order.id} assigned`);
      onAssigned?.();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={order ? `Assign a rider to order #${order.id}` : ''}
      onClose={saving ? undefined : onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={assign} disabled={!selected} loading={saving}>Assign</Button>
        </>
      )}
    >
      {partners.loading && <Loader className="py-6" text="Loading delivery partners…" />}
      <ErrorMessage error={partners.error} onRetry={partners.refetch} />
      {partners.data?.length === 0 && <p className="text-sm text-gray-500">No delivery partners are available right now.</p>}
      <ul className="space-y-2" role="radiogroup" aria-label="Delivery partners">
        {partners.data?.map((p) => (
          <li key={p.id}>
            <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-sm ${selected === p.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <span className="flex items-center gap-3">
                <input type="radio" name="partner" className="accent-brand-600" checked={selected === p.id} onChange={() => setSelected(p.id)} />
                <span>
                  <span className="block font-medium">{p.name}</span>
                  <span className="text-xs text-gray-500">{VEHICLE_TYPES.find((v) => v.value === p.vehicle_type)?.label || 'Vehicle'} · {p.vehicle_number} · {p.phone}</span>
                </span>
              </span>
              <span className={`badge ${p.active_deliveries ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-green-50 text-green-700 ring-green-200'}`}>
                {p.active_deliveries ? `${p.active_deliveries} active` : 'Free'}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
