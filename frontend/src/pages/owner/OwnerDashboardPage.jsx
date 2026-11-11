import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ownerApi } from '../../api/owner';
import Button from '../../components/common/Button';
import ErrorMessage from '../../components/common/ErrorMessage';
import { DateRangeFilter } from '../../components/common/Filters';
import Loader from '../../components/common/Loader';
import PageHeader from '../../components/common/PageHeader';
import OrderCard from '../../components/order/OrderCard';
import ReminderList from '../../components/owner/ReminderList';
import RestaurantProfileForm from '../../components/owner/RestaurantProfileForm';
import StatsCards from '../../components/owner/StatsCards';
import { useApi } from '../../hooks/useApi';
import { useInterval } from '../../hooks/useInterval';
import { useToast } from '../../hooks/useToast';

export default function OwnerDashboardPage() {
  const toast = useToast();
  const [range, setRange] = useState({ from: '', to: '' });
  const [toggling, setToggling] = useState(false);

  const restaurant = useApi(() => ownerApi.restaurant(), []);
  const stats = useApi(() => ownerApi.stats({ date_from: range.from, date_to: range.to }), [range.from, range.to]);
  const reminders = useApi(() => ownerApi.reminders({ page_size: 20 }), []);
  const recent = useApi(() => ownerApi.orders({ scope: 'active', page_size: 5 }), []);

  // Poll reminders and recent orders every 60s (no WebSockets needed).
  useInterval(() => {
    reminders.refetch({ silent: true });
    recent.refetch({ silent: true });
  }, 60000);

  const toggleOpen = async () => {
    setToggling(true);
    try {
      const updated = await ownerApi.updateRestaurant({ is_open: !restaurant.data.is_open });
      restaurant.setData(updated);
      toast.success(updated.is_open ? 'Restaurant is now open for orders' : 'Restaurant is now closed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setToggling(false);
    }
  };

  const saveProfile = async (payload, imageFile) => {
    if (imageFile) {
      const withImage = await ownerApi.uploadRestaurantImage(imageFile);
      restaurant.setData(withImage);
    }
    const updated = await ownerApi.updateRestaurant(payload);
    restaurant.setData(updated);
    toast.success('Restaurant profile updated');
  };

  if (restaurant.loading) return <Loader />;
  if (restaurant.error) return <ErrorMessage error={restaurant.error} onRetry={restaurant.refetch} />;
  const r = restaurant.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={r.name}
        subtitle={`${r.cuisine} · ${r.address}`}
        actions={(
          <>
            <RestaurantProfileForm restaurant={r} onSave={saveProfile} />
            <span className={`badge self-center ${r.is_open ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
              {r.is_open ? 'Open' : 'Closed'}
            </span>
            <Button variant="secondary" size="sm" loading={toggling} onClick={toggleOpen}>
              {r.is_open ? 'Close for now' : 'Open restaurant'}
            </Button>
          </>
        )}
      />

      <ReminderList reminders={reminders.data?.items || []} onChanged={() => { reminders.refetch({ silent: true }); stats.refetch({ silent: true }); }} />

      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Statistics</h2>
          <div className="flex items-center gap-2">
            <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
            {(range.from || range.to) && <button type="button" className="btn-ghost btn-sm" onClick={() => setRange({ from: '', to: '' })}>All time</button>}
          </div>
        </div>
        {stats.loading && !stats.data && <Loader className="py-8" />}
        <ErrorMessage error={stats.error} onRetry={stats.refetch} />
        {stats.data && (
          <>
            <StatsCards stats={stats.data} />
            {stats.data.pending_returns > 0 && (
              <p className="mt-3 text-sm">
                <Link to="/owner/returns" className="link">{stats.data.pending_returns} return request{stats.data.pending_returns > 1 ? 's' : ''} waiting for you →</Link>
              </p>
            )}
          </>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active orders</h2>
          <Link to="/owner/orders" className="link text-sm">Manage all orders →</Link>
        </div>
        <ErrorMessage error={recent.error} onRetry={recent.refetch} />
        {recent.data?.items.length === 0 && <p className="card p-6 text-center text-sm text-gray-500">No active orders right now.</p>}
        <div className="space-y-3">
          {recent.data?.items.map((o) => <OrderCard key={o.id} order={o} showCustomer showRestaurant={false} />)}
        </div>
      </section>
    </div>
  );
}
