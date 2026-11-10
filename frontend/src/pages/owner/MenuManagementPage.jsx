import { useEffect, useState } from 'react';
import { ownerApi } from '../../api/owner';
import { VegMark } from '../../components/common/Badges';
import Button from '../../components/common/Button';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import DishImage from '../../components/common/DishImage';
import EmptyState from '../../components/common/EmptyState';
import ErrorMessage from '../../components/common/ErrorMessage';
import Loader from '../../components/common/Loader';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import MenuItemForm from '../../components/owner/MenuItemForm';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../hooks/useToast';
import { formatCurrency } from '../../utils/format';

function AvailabilityToggle({ dish, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dish.is_available}
      aria-label={`${dish.name} available`}
      onClick={() => onToggle(dish)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${dish.is_available ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${dish.is_available ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function MenuManagementPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [available, setAvailable] = useState('');
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new dish, object = edit
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const debounced = useDebounce(search.trim());
  const { page, pageSize, setPage, reset } = usePagination(10);

  useEffect(reset, [debounced, available, reset]);

  const { data, loading, error, refetch, setData } = useApi(
    () => ownerApi.menu({ search: debounced, available, page, page_size: pageSize }),
    [debounced, available, page, pageSize],
  );

  const save = async (payload) => {
    if (editing) await ownerApi.updateDish(editing.id, payload);
    else await ownerApi.createDish(payload);
    toast.success(editing ? 'Dish updated' : 'Dish added');
    refetch({ silent: true });
  };

  // Optimistic toggle: flip immediately, roll back if the API refuses.
  const toggle = async (dish) => {
    const flip = (value) => setData((d) => ({ ...d, items: d.items.map((i) => (i.id === dish.id ? { ...i, is_available: value } : i)) }));
    flip(!dish.is_available);
    try {
      await ownerApi.setAvailability(dish.id, !dish.is_available);
      toast.success(`${dish.name} is now ${dish.is_available ? 'unavailable' : 'available'}`);
    } catch (err) {
      flip(dish.is_available);
      toast.error(err.message);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await ownerApi.deleteDish(deleting.id);
      toast.success(`${deleting.name} deleted`);
      setDeleting(null);
      refetch({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Menu" subtitle="Add dishes, update prices and mark items as sold out."
        actions={<Button onClick={() => setEditing(null)}>+ Add dish</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input type="search" className="input sm:max-w-xs" placeholder="Search dishes…" value={search}
          onChange={(e) => setSearch(e.target.value)} aria-label="Search dishes" />
        <select className="input sm:w-48" value={available} onChange={(e) => setAvailable(e.target.value)} aria-label="Availability">
          <option value="">All dishes</option>
          <option value="true">Available</option>
          <option value="false">Unavailable</option>
        </select>
      </div>

      {loading && !data && <Loader />}
      <ErrorMessage error={error} onRetry={refetch} />
      {data?.items.length === 0 && (
        <EmptyState title={search || available ? 'No dishes match' : 'Your menu is empty'}
          message={search || available ? 'Try another search.' : 'Add your first dish to start receiving orders.'}
          action={!search && !available && <Button onClick={() => setEditing(null)}>Add dish</Button>} />
      )}

      {data?.items.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="px-4 py-3">Dish</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Available</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((dish) => (
                  <tr key={dish.id} className={dish.is_available ? '' : 'bg-gray-50/60'}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <DishImage src={dish.image_url} name={dish.name} className="h-12 w-12" />
                        <span className="flex items-center gap-2"><VegMark veg={dish.is_veg} /><span className="font-medium">{dish.name}</span></span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{dish.category}</td>
                    <td className="px-4 py-3">{formatCurrency(dish.price)}</td>
                    <td className="px-4 py-3"><AvailabilityToggle dish={dish} onToggle={toggle} /></td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(dish)}>Edit</button>
                      <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => setDeleting(dish)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {data.items.map((dish) => (
              <li key={dish.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <DishImage src={dish.image_url} name={dish.name} className="h-14 w-14" />
                    <div>
                      <p className="flex items-center gap-2 font-medium"><VegMark veg={dish.is_veg} />{dish.name}</p>
                      <p className="text-sm text-gray-500">{dish.category} · {formatCurrency(dish.price)}</p>
                    </div>
                  </div>
                  <AvailabilityToggle dish={dish} onToggle={toggle} />
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="btn-secondary btn-sm flex-1" onClick={() => setEditing(dish)}>Edit</button>
                  <button type="button" className="btn-secondary btn-sm flex-1 text-red-600" onClick={() => setDeleting(dish)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}

      <MenuItemForm open={editing !== undefined} dish={editing || null} onClose={() => setEditing(undefined)} onSave={save} />
      <ConfirmDialog open={Boolean(deleting)} title="Delete dish?" danger loading={busy}
        message={`${deleting?.name} will be removed from your menu. Past orders keep their record of it.`}
        confirmLabel="Delete" onConfirm={remove} onCancel={() => setDeleting(null)} />
    </>
  );
}
