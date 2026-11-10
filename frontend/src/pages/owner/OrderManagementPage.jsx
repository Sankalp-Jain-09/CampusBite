import { useEffect, useState } from 'react';
import { ownerApi } from '../../api/owner';
import EmptyState from '../../components/common/EmptyState';
import ErrorMessage from '../../components/common/ErrorMessage';
import { DateRangeFilter, StatusFilter } from '../../components/common/Filters';
import Loader from '../../components/common/Loader';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import OrderCard from '../../components/order/OrderCard';
import AssignPartnerModal from '../../components/owner/AssignPartnerModal';
import OwnerOrderActions from '../../components/owner/OwnerOrderActions';
import { useApi } from '../../hooks/useApi';
import { useInterval } from '../../hooks/useInterval';
import { usePagination } from '../../hooks/usePagination';
import { ACTIVE_STATUSES, PAST_STATUSES } from '../../utils/constants';

const TABS = [
  { key: 'active', label: 'Active', statuses: ACTIVE_STATUSES },
  { key: 'past', label: 'Completed', statuses: PAST_STATUSES },
];

export default function OrderManagementPage() {
  const [tab, setTab] = useState('active');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [assigning, setAssigning] = useState(null);
  const { page, pageSize, setPage, reset } = usePagination(10);

  useEffect(reset, [tab, status, range.from, range.to, reset]);

  const { data, loading, error, refetch } = useApi(
    () => ownerApi.orders({ scope: tab, status, date_from: range.from, date_to: range.to, page, page_size: pageSize }),
    [tab, status, range.from, range.to, page, pageSize],
  );
  useInterval(() => refetch({ silent: true }), tab === 'active' ? 15000 : null);

  return (
    <>
      <PageHeader title="Orders" subtitle="Accept new orders, update their progress and assign riders." />
      <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1 sm:w-fit" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
            onClick={() => { setTab(t.key); setStatus(''); }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium sm:flex-none ${tab === t.key ? 'bg-white shadow-sm' : 'text-gray-600'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <StatusFilter value={status} onChange={setStatus} statuses={TABS.find((t) => t.key === tab).statuses} className="sm:w-52" />
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        {(status || range.from || range.to) && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => { setStatus(''); setRange({ from: '', to: '' }); }}>Clear</button>
        )}
      </div>

      {loading && !data && <Loader />}
      <ErrorMessage error={error} onRetry={refetch} />
      {data?.items.length === 0 && (
        <EmptyState title={tab === 'active' ? 'No active orders' : 'No completed orders'}
          message={status || range.from || range.to ? 'Try clearing the filters.' : 'New orders will appear here automatically.'} />
      )}
      <div className="space-y-3">
        {data?.items.map((order) => (
          <OrderCard key={order.id} order={order} showCustomer showRestaurant={false}
            actions={<OwnerOrderActions order={order} onChanged={() => refetch({ silent: true })} onAssign={setAssigning} />} />
        ))}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
      <AssignPartnerModal order={assigning} onClose={() => setAssigning(null)} onAssigned={() => refetch({ silent: true })} />
    </>
  );
}
