import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deliveryApi } from '../../api/delivery';
import { StatusBadge } from '../../components/common/Badges';
import EmptyState from '../../components/common/EmptyState';
import ErrorMessage from '../../components/common/ErrorMessage';
import { DateRangeFilter } from '../../components/common/Filters';
import Loader from '../../components/common/Loader';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import { useApi } from '../../hooks/useApi';
import { usePagination } from '../../hooks/usePagination';
import { formatCurrency, formatDateTime } from '../../utils/format';

export default function DeliveryHistoryPage() {
  const [range, setRange] = useState({ from: '', to: '' });
  const { page, pageSize, setPage, reset } = usePagination(10);
  useEffect(reset, [range.from, range.to, reset]);
  const { data, loading, error, refetch } = useApi(
    () => deliveryApi.history({ date_from: range.from, date_to: range.to, page, page_size: pageSize }),
    [range.from, range.to, page, pageSize],
  );

  return (
    <>
      <PageHeader title="Delivery history" subtitle={data ? `${data.total} completed deliveries` : undefined} />
      <div className="mb-5 flex items-center gap-2">
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        {(range.from || range.to) && <button type="button" className="btn-ghost btn-sm" onClick={() => setRange({ from: '', to: '' })}>Clear</button>}
      </div>
      {loading && !data && <Loader />}
      <ErrorMessage error={error} onRetry={refetch} />
      {data?.items.length === 0 && <EmptyState title="No deliveries yet" message="Completed deliveries will be listed here." />}
      {data?.items.length > 0 && (
        <ul className="card divide-y divide-gray-100">
          {data.items.map((o) => (
            <li key={o.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link to={`/orders/${o.id}`} className="font-medium hover:text-brand-700">Order #{o.id}</Link>
                <p className="text-sm text-gray-500">{o.restaurant_name} → {o.customer_name}, {o.delivery_address}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <StatusBadge status={o.status} />
                <span className="text-gray-500">{formatDateTime(o.status_updated_at)}</span>
                <span className="font-medium">{formatCurrency(o.total_amount)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
    </>
  );
}
