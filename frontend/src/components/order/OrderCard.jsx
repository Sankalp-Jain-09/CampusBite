import { Link } from 'react-router-dom';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { PaymentBadge, ReturnBadge, StatusBadge } from '../common/Badges';

/** Compact order row used in lists. `actions` renders role-specific buttons. */
export default function OrderCard({ order, actions, showCustomer = false, showRestaurant = true }) {
  return (
    <div className="card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/orders/${order.id}`} className="font-semibold text-gray-900 hover:text-brand-700">Order #{order.id}</Link>
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.payment_status} />
            <ReturnBadge status={order.return_status} />
          </div>
          <p className="text-sm text-gray-600">
            {showRestaurant && <span className="font-medium">{order.restaurant_name}</span>}
            {showRestaurant && showCustomer && ' · '}
            {showCustomer && <span>{order.customer_name}</span>}
            <span className="text-gray-400"> · {formatDateTime(order.created_at)}</span>
          </p>
          <p className="truncate text-sm text-gray-500">{order.items_summary}</p>
        </div>
        <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
          <span className="text-lg font-semibold">{formatCurrency(order.total_amount)}</span>
          {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
