import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { restaurantsApi } from '../../api/restaurants';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import ErrorMessage from '../../components/common/ErrorMessage';
import Loader from '../../components/common/Loader';
import Pagination from '../../components/common/Pagination';
import { RatingStars, RatingSummary } from '../../components/common/RatingStars';
import DishCard from '../../components/restaurant/DishCard';
import DishFilters from '../../components/restaurant/DishFilters';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';
import { formatCurrency, formatDate } from '../../utils/format';

const DEFAULT_FILTERS = { search: '', min_price: '', max_price: '', category: '', veg: '', sort: 'name' };

export default function RestaurantMenuPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { isAuthenticated } = useAuth();
  const cart = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingDish, setPendingDish] = useState(null);
  const [reviewPage, setReviewPage] = useState(1);

  // Filters live in the URL so the page is shareable and the back button works.
  const filters = Object.fromEntries(
    Object.keys(DEFAULT_FILTERS).map((k) => [k, searchParams.get(k) ?? DEFAULT_FILTERS[k]]),
  );
  const page = Number(searchParams.get('page') || 1);
  const debouncedSearch = useDebounce(filters.search.trim());

  const setFilters = (next) => {
    // Keep only non-default values; changing a filter always goes back to page 1.
    const params = {};
    Object.entries(next).forEach(([key, value]) => {
      if (value && value !== DEFAULT_FILTERS[key]) params[key] = value;
    });
    setSearchParams(params, { replace: true });
  };
  const setPage = (p) => {
    const params = Object.fromEntries(searchParams.entries());
    setSearchParams({ ...params, page: String(p) });
  };

  const restaurant = useApi(() => restaurantsApi.get(id), [id]);
  const categories = useApi(() => restaurantsApi.categories(id), [id]);
  const menu = useApi(
    () => restaurantsApi.menu(id, {
      search: debouncedSearch, min_price: filters.min_price, max_price: filters.max_price,
      category: filters.category, veg: filters.veg, sort: filters.sort, page, page_size: 20,
    }),
    [id, debouncedSearch, filters.min_price, filters.max_price, filters.category, filters.veg, filters.sort, page],
  );
  const reviews = useApi(() => restaurantsApi.reviews(id, { page: reviewPage, page_size: 5 }), [id, reviewPage]);

  if (restaurant.loading) return <Loader />;
  if (restaurant.error) {
    // 422 = the id in the URL isn't a number (e.g. /restaurants/abc).
    return restaurant.error.status === 404 || restaurant.error.status === 422
      ? <EmptyState title="Restaurant not found" action={<Link to="/" className="btn-primary">Back to restaurants</Link>} />
      : <ErrorMessage error={restaurant.error} onRetry={restaurant.refetch} />;
  }
  const r = restaurant.data;

  const add = (dish, replace = false) => {
    if (!isAuthenticated) {
      toast.info('Log in to start your order');
      navigate('/login', { state: { from: location } });
      return;
    }
    const result = cart.addItem(r, dish, { replace });
    if (result.conflict) setPendingDish(dish);
  };

  const cartHere = cart.restaurant?.id === r.id && cart.itemCount > 0;

  return (
    <div className="pb-20 md:pb-0">
      <Link to="/" className="link text-sm">← All restaurants</Link>
      <header className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{r.name}</h1>
          <p className="text-gray-600">{r.cuisine} · {r.address}</p>
          {r.description && <p className="mt-1 max-w-2xl text-sm text-gray-500">{r.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <RatingSummary avg={r.avg_rating} count={r.review_count} />
          {!r.is_open && <span className="badge bg-gray-100 text-gray-600 ring-gray-200">Closed now</span>}
        </div>
      </header>
      {!r.is_open && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">This restaurant is closed right now — you can browse the menu, but ordering is paused.</p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <DishFilters key={id} filters={filters} defaults={DEFAULT_FILTERS} categories={categories.data || []}
            onChange={setFilters} onReset={() => setSearchParams({}, { replace: true })} />
          <ErrorMessage error={menu.error} onRetry={menu.refetch} />
          {menu.loading && !menu.data && <Loader text="Loading menu…" />}
          {menu.data && menu.data.items.length === 0 && (
            <EmptyState title="No dishes match" message="Try removing some filters." />
          )}
          <div className={`grid gap-3 xl:grid-cols-2 ${menu.loading ? 'opacity-60' : ''}`}>
            {menu.data?.items.map((dish) => (
              <DishCard
                key={dish.id}
                dish={dish}
                quantity={cart.restaurant?.id === r.id ? cart.quantityOf(dish.id) : 0}
                onAdd={() => add(dish)}
                onChangeQuantity={(q) => cart.updateQuantity(dish.id, q)}
                disabled={!r.is_open}
                disabledReason={!r.is_open ? 'Restaurant is closed' : undefined}
              />
            ))}
          </div>
          {menu.data && <Pagination page={menu.data.page} pages={menu.data.pages} total={menu.data.total} onChange={setPage} />}

          <section className="pt-6">
            <h2 className="mb-3 text-lg font-semibold">Reviews</h2>
            {reviews.data?.items.length === 0 && <p className="text-sm text-gray-500">No reviews yet.</p>}
            <ul className="space-y-3">
              {reviews.data?.items.map((rv) => (
                <li key={rv.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{rv.reviewer_name}</span>
                    <span className="text-xs text-gray-400">{formatDate(rv.created_at)}</span>
                  </div>
                  <RatingStars value={rv.rating} size="text-sm" />
                  {rv.comment && <p className="mt-1 text-sm text-gray-600">{rv.comment}</p>}
                </li>
              ))}
            </ul>
            {reviews.data && <Pagination page={reviews.data.page} pages={reviews.data.pages} total={reviews.data.total} onChange={setReviewPage} />}
          </section>
        </div>

        <aside className="hidden lg:block">
          <div className="card sticky top-24 p-5">
            <h2 className="font-semibold">Your cart</h2>
            {cartHere ? (
              <>
                <ul className="mt-3 space-y-2 text-sm">
                  {cart.items.map((i) => (
                    <li key={i.menuItemId} className="flex justify-between gap-2">
                      <span className="truncate">{i.quantity} × {i.name}</span>
                      <span>{formatCurrency(i.price * i.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 font-semibold">
                  <span>Subtotal</span><span>{formatCurrency(cart.subtotal)}</span>
                </div>
                <Link to="/cart" className="btn-primary mt-4 w-full">Go to cart</Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-500">Add dishes to start your order.</p>
            )}
          </div>
        </aside>
      </div>

      {cartHere && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white p-3 lg:hidden">
          <Link to="/cart" className="btn-primary w-full justify-between">
            <span>{cart.itemCount} item{cart.itemCount > 1 ? 's' : ''} · {formatCurrency(cart.subtotal)}</span>
            <span>View cart →</span>
          </Link>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDish)}
        title="Start a new cart?"
        message={`Your cart has items from ${cart.restaurant?.name}. Clear it and add ${pendingDish?.name} from ${r.name}?`}
        confirmLabel="Clear cart & add"
        onConfirm={() => { add(pendingDish, true); setPendingDish(null); }}
        onCancel={() => setPendingDish(null)}
      />
    </div>
  );
}
