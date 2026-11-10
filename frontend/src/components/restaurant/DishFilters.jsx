import { useEffect, useRef, useState } from 'react';

/**
 * Menu filters. The page keeps them in the URL, but URL updates render late (router transitions), so the
 * inputs keep a local copy: typing shows instantly and every change builds on the latest values instead
 * of a stale render (which used to drop changes made in quick succession).
 */
export default function DishFilters({ filters, categories = [], onChange, onReset, defaults }) {
  const [values, setValues] = useState(filters);
  const latest = useRef(filters);
  const pending = useRef(new Set());   // our own updates the URL hasn't caught up with yet
  const incoming = JSON.stringify(filters);

  useEffect(() => {
    if (incoming === JSON.stringify(latest.current)) { pending.current.clear(); return; }   // caught up
    if (pending.current.has(incoming)) return;   // a late echo of one of our own earlier changes
    pending.current.clear();                     // changed elsewhere (e.g. a link): adopt it
    latest.current = JSON.parse(incoming);
    setValues(latest.current);
  }, [incoming]);

  const push = (next) => {
    pending.current.add(JSON.stringify(next));
    latest.current = next;
    setValues(next);
    onChange(next);
  };
  const set = (field) => (e) => push({ ...latest.current, [field]: e.target.value });
  const reset = () => (defaults ? push({ ...defaults }) : onReset?.());
  const active = Object.entries(values).some(([k, v]) => v && !(k === 'sort' && v === 'name'));
  return (
    <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <input className="input lg:col-span-2" type="search" placeholder="Search dishes…" value={values.search}
        onChange={set('search')} aria-label="Search dishes" />
      <div className="flex gap-2 lg:col-span-2">
        <input className="input" type="number" min="0" inputMode="numeric" placeholder="Min ₹" value={values.min_price}
          onChange={set('min_price')} aria-label="Minimum price" />
        <input className="input" type="number" min="0" inputMode="numeric" placeholder="Max ₹" value={values.max_price}
          onChange={set('max_price')} aria-label="Maximum price" />
      </div>
      <select className="input" value={values.category} onChange={set('category')} aria-label="Category">
        <option value="">All categories</option>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select className="input" value={values.veg} onChange={set('veg')} aria-label="Veg filter">
        <option value="">Veg & non-veg</option>
        <option value="true">Veg only</option>
        <option value="false">Non-veg only</option>
      </select>
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
        <label htmlFor="dish-sort" className="text-sm text-gray-500">Sort by</label>
        <select id="dish-sort" className="input w-auto" value={values.sort} onChange={set('sort')}>
          <option value="name">Name</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
        {active && <button type="button" className="btn-ghost btn-sm ml-auto" onClick={reset}>Clear filters</button>}
      </div>
    </div>
  );
}
