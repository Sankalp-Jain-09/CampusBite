import { useEffect, useMemo, useState } from 'react';
import { restaurantsApi } from '../../api/restaurants';
import EmptyState from '../../components/common/EmptyState';
import ErrorMessage from '../../components/common/ErrorMessage';
import Loader from '../../components/common/Loader';
import Pagination from '../../components/common/Pagination';
import RestaurantCard from '../../components/restaurant/RestaurantCard';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { useDebounce } from '../../hooks/useDebounce';
import { usePagination } from '../../hooks/usePagination';

export default function RestaurantListPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [cuisine, setCuisine] = useState('');
  const debouncedSearch = useDebounce(search.trim());
  const { page, pageSize, setPage, reset } = usePagination(12);

  useEffect(reset, [debouncedSearch, cuisine, reset]);

  const { data, loading, error, refetch } = useApi(
    () => restaurantsApi.list({ search: debouncedSearch, cuisine, page, page_size: pageSize }),
    [debouncedSearch, cuisine, page, pageSize],
  );
  // Cuisine options come from the full (unfiltered) list.
  const all = useApi(() => restaurantsApi.list({ page_size: 50 }), []);
  const cuisines = useMemo(
    () => [...new Set((all.data?.items || []).map((r) => r.cuisine))].sort(),
    [all.data],
  );

  return (
    <div>
      <section className="mb-8 rounded-2xl bg-gradient-to-br from-brand-600 to-rose-600 px-6 py-8 text-white sm:px-10 sm:py-12">
        <h1 className="text-2xl font-bold sm:text-3xl">{user ? `Hungry, ${user.name.split(' ')[0]}?` : 'Campus food, delivered.'}</h1>
        <p className="mt-2 max-w-xl text-white/85">Order from your favourite campus restaurants and track your food in real time.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input type="search" className="input max-w-md border-0 text-gray-900" placeholder="Search restaurants or cuisines…"
            value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search restaurants" />
          <select className="input border-0 text-gray-900 sm:w-56" value={cuisine} onChange={(e) => setCuisine(e.target.value)} aria-label="Cuisine">
            <option value="">All cuisines</option>
            {cuisines.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </section>

      <h2 className="mb-4 text-lg font-semibold">
        {data ? `${data.total} restaurant${data.total === 1 ? '' : 's'}` : 'Restaurants'}
      </h2>
      {loading && !data ? <Loader /> : null}
      <ErrorMessage error={error} onRetry={refetch} />
      {data && data.items.length === 0 && (
        <EmptyState title="No restaurants found" message="Try a different search or cuisine." />
      )}
      {data && data.items.length > 0 && (
        <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loading ? 'opacity-60' : ''}`}>
          {data.items.map((r) => <RestaurantCard key={r.id} restaurant={r} />)}
        </div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
    </div>
  );
}
