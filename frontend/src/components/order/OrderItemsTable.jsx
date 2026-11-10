import { formatCurrency } from '../../utils/format';

export default function OrderItemsTable({ items }) {
  return (
    <ul className="divide-y divide-gray-100">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <span className="min-w-0">
            <span className="font-medium text-gray-900">{item.item_name}</span>
            <span className="text-gray-500"> × {item.quantity}</span>
            <span className="block text-xs text-gray-400">{formatCurrency(item.unit_price)} each</span>
          </span>
          <span className="font-medium">{formatCurrency(item.line_total)}</span>
        </li>
      ))}
    </ul>
  );
}
