import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ordersApi } from '../../api/orders';
import EmptyState from '../../components/common/EmptyState';
import ErrorMessage from '../../components/common/ErrorMessage';
import { DateRangeFilter, StatusFilter } from '../../components/common/Filters';
import Loader from '../../components/common/Loader';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import CancelCountdown from '../../components/order/CancelCountdown';
import OrderCard from '../../components/order/OrderCard';
import ReturnForm from '../../components/order/ReturnForm';
import { useApi } from '../../hooks/useApi';
import { useInterval } from '../../hooks/useInterval';
import { usePagination } from '../../hooks/usePagination';
import { ACTIVE_STATUSES, PAST_STATUSES } from '../../utils/constants';

const TABS = [
  { key: 'active', label: 'Current orders', statuses: ACTIVE_STATUSES },
  { key: 'past', label: 'Past orders', statuses: PAST_STATUSES },
];

export default function CustomerDashboardPage() {
  const [tab, setTab] = useState('active');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [returnFor, setReturnFor] = useState(null);
  const { page, pageSize, setPage, reset } = usePagination(10);

  useEffect(reset, [tab, status, range.from, range.to, reset]);

  const { data, loading, error, refetch } = useApi(
    () => ordersApi.mine({ scope: tab, status, date_from: range.from, date_to: range.to, page, page_size: pageSize }),
    [tab, status, range.from, range.to, page, pageSize],
  );
  // Keep current orders fresh without WebSockets.
  useInterval(() => refetch({ silent: true }), tab === 'active' ? 15000 : null);

  const currentTab = TABS.find((t) => t.key === tab);

  return (
    <>
      <PageHeader title="My orders" subtitle="Track current orders and review past ones." />
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
        <StatusFilter value={status} onChange={setStatus} statuses={currentTab.statuses} className="sm:w-52" />
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        {(status || range.from || range.to) && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => { setStatus(''); setRange({ from: '', to: '' }); }}>Clear</button>
        )}
      </div>

      {loading && !data && <Loader />}
      <ErrorMessage error={error} onRetry={refetch} />
      {data?.items.length === 0 && (
        <EmptyState
          title={tab === 'active' ? 'No current orders' : 'No past orders'}
          message={status || range.from || range.to ? 'Try clearing the filters.' : 'Your orders will show up here.'}
          action={<Link to="/" className="btn-primary">Order food</Link>}
        />
      )}
      <div className="space-y-3">
        {data?.items.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            actions={(
              <>
                {order.status === 'PLACED' && <CancelCountdown order={order} onChanged={refetch} compact />}
                {order.status === 'DELIVERED' && !order.has_review && (
                  <Link to={`/orders/${order.id}#review`} className="btn-secondary btn-sm">Rate</Link>
                )}
                {order.status === 'DELIVERED' && !order.return_status && (
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setReturnFor(order.id)}>Return</button>
                )}
                <Link to={`/orders/${order.id}`} className="btn-ghost btn-sm">View</Link>
              </>
            )}
          />
        ))}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
      <ReturnForm orderId={returnFor} open={Boolean(returnFor)} onClose={() => setReturnFor(null)} onDone={refetch} />
    </>
  );
}
