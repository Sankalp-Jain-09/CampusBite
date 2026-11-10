import { STATUS_LABELS } from '../../utils/constants';
import { formatCurrency } from '../../utils/format';

function Stat({ label, value, hint, accent = false }) {
  return (
    <div className={`card p-4 ${accent ? 'border-brand-200 bg-brand-50' : ''}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export default function StatsCards({ stats }) {
  const breakdown = Object.entries(stats.orders_by_status).filter(([, n]) => n > 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total orders" value={stats.total_orders} hint={`${stats.orders_today} today`} />
        <Stat label="Net revenue" value={formatCurrency(stats.net_revenue)}
          hint={`${formatCurrency(stats.gross_revenue)} gross · ${formatCurrency(stats.refunds_total)} refunded`} accent />
        <Stat label="Avg order value" value={formatCurrency(stats.average_order_value)} hint="Cancelled orders excluded" />
        <Stat label="Rating" value={stats.avg_rating ? `${stats.avg_rating.toFixed(1)} ★` : '—'} hint={`${stats.review_count} reviews`} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold">Orders by status</h3>
          {breakdown.length === 0 ? <p className="text-sm text-gray-500">No orders yet.</p> : (
            <ul className="space-y-2">
              {breakdown.map(([status, n]) => (
                <li key={status} className="flex items-center gap-3 text-sm">
                  <span className="w-32 shrink-0 text-gray-600">{STATUS_LABELS[status]}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(n / stats.total_orders) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right font-medium">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold">Top dishes</h3>
          {stats.top_items.length === 0 ? <p className="text-sm text-gray-500">No sales yet.</p> : (
            <ol className="space-y-2">
              {stats.top_items.map((item, i) => (
                <li key={item.menu_item_id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate"><span className="mr-2 text-gray-400">{i + 1}.</span>{item.name}</span>
                  <span className="shrink-0 text-gray-600">{item.quantity} sold · {formatCurrency(item.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
