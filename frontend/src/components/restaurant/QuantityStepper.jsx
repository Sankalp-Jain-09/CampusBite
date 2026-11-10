import { MAX_QTY } from '../../utils/constants';

export default function QuantityStepper({ value, onChange, disabled, label = 'item' }) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-brand-200 bg-brand-50 text-brand-700">
      <button type="button" className="h-9 w-9 text-lg font-bold hover:bg-brand-100 disabled:opacity-50"
        onClick={() => onChange(value - 1)} disabled={disabled} aria-label={`Remove one ${label}`}>−</button>
      <span className="w-8 text-center text-sm font-semibold" aria-live="polite">{value}</span>
      <button type="button" className="h-9 w-9 text-lg font-bold hover:bg-brand-100 disabled:opacity-50"
        onClick={() => onChange(value + 1)} disabled={disabled || value >= MAX_QTY} aria-label={`Add one ${label}`}>+</button>
    </div>
  );
}
