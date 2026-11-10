import { formatCurrency } from '../../utils/format';

export default function OrderTotals({ subtotal, deliveryFee, total, note }) {
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd>{formatCurrency(subtotal)}</dd></div>
      <div className="flex justify-between"><dt className="text-gray-500">Delivery fee</dt><dd>{formatCurrency(deliveryFee)}</dd></div>
      <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold">
        <dt>Total</dt><dd>{formatCurrency(total)}</dd>
      </div>
      {note && <p className="pt-1 text-xs text-gray-400">{note}</p>}
    </dl>
  );
}
