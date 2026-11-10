import { useEffect, useState } from 'react';
import { deliveryApi } from '../../api/delivery';
import DeliveryCard from '../../components/delivery/DeliveryCard';
import EmptyState from '../../components/common/EmptyState';
import ErrorMessage from '../../components/common/ErrorMessage';
import Loader from '../../components/common/Loader';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { useInterval } from '../../hooks/useInterval';
import { usePagination } from '../../hooks/usePagination';

const FILTERS = [
  { value: '', label: 'All active' },
  { value: 'ASSIGNED', label: 'To pick up' },
  { value: 'OUT_FOR_DELIVERY', label: 'On the way' },
];

export default function DeliveryDashboardPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('');
  const { page, pageSize, setPage, reset } = usePagination(10);
  useEffect(reset, [status, reset]);

  const { data, loading, error, refetch } = useApi(() => deliveryApi.active({ status, page, page_size: pageSize }), [status, page, pageSize]);
  useInterval(() => refetch({ silent: true }), 30000);

  return (
    <>
      <PageHeader title={`Hi ${user.name.split(' ')[0]}, your deliveries`} subtitle="Only orders assigned to you are shown here." />
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
      {data?.items.length === 0 && <EmptyState title="No deliveries right now" message="New assignments from restaurants will appear here." />}
      <div className="grid gap-4 lg:grid-cols-2">
        {data?.items.map((o) => <DeliveryCard key={o.id} order={o} onChanged={() => refetch({ silent: true })} />)}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
    </>
  );
}
