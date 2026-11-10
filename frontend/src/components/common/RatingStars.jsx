export function RatingStars({ value = 0, size = 'text-base' }) {
  const rounded = Math.round(value);
  return (
    <span className={`${size} tracking-tight`} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rounded ? 'text-amber-400' : 'text-gray-300'}>★</span>
      ))}
    </span>
  );
}

export function RatingInput({ value, onChange, disabled }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`text-3xl leading-none transition ${n <= value ? 'text-amber-400' : 'text-gray-300 hover:text-amber-200'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function RatingSummary({ avg, count }) {
  if (!count) return <span className="text-sm text-gray-500">No reviews yet</span>;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm">
      <span className="rounded bg-green-600 px-1.5 py-0.5 text-xs font-semibold text-white">{avg.toFixed(1)} ★</span>
      <span className="text-gray-500">({count})</span>
    </span>
  );
}
