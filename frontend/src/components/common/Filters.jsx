import { STATUS_LABELS } from '../../utils/constants';

export function StatusFilter({ value, onChange, statuses, allLabel = 'All statuses', className = '' }) {
  return (
    <select className={`input ${className}`} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Filter by status">
      <option value="">{allLabel}</option>
      {statuses.map((s) => (
        <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
      ))}
    </select>
  );
}

export function DateRangeFilter({ from, to, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <input type="date" className="input" value={from} max={to || undefined} aria-label="From date"
        onChange={(e) => onChange({ from: e.target.value, to })} />
      <span className="text-sm text-gray-400">to</span>
      <input type="date" className="input" value={to} min={from || undefined} aria-label="To date"
        onChange={(e) => onChange({ from, to: e.target.value })} />
    </div>
  );
}
