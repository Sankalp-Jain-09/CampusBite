import {
  PAYMENT_COLORS, PAYMENT_LABELS, RETURN_COLORS, RETURN_LABELS, STATUS_COLORS, STATUS_LABELS,
} from '../../utils/constants';

export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_COLORS[status] || ''}`}>{STATUS_LABELS[status] || status}</span>;
}

export function PaymentBadge({ status }) {
  if (!status) return null;
  return <span className={`badge ${PAYMENT_COLORS[status] || ''}`}>{PAYMENT_LABELS[status] || status}</span>;
}

export function ReturnBadge({ status }) {
  if (!status) return null;
  return <span className={`badge ${RETURN_COLORS[status] || ''}`}>{RETURN_LABELS[status] || status}</span>;
}

export function VegMark({ veg }) {
  const color = veg ? 'border-green-600 text-green-600' : 'border-red-600 text-red-600';
  return (
    <span className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border ${color}`} title={veg ? 'Vegetarian' : 'Non-vegetarian'}>
      <span className="h-2 w-2 rounded-full bg-current" />
      <span className="sr-only">{veg ? 'Vegetarian' : 'Non-vegetarian'}</span>
    </span>
  );
}
