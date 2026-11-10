export default function ErrorMessage({ error, onRetry, className = '' }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  return (
    <div className={`flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center ${className}`} role="alert">
      <span className="flex-1">{message || 'Something went wrong.'}</span>
      {onRetry && (
        <button type="button" onClick={() => onRetry()} className="btn-secondary btn-sm self-start">
          Try again
        </button>
      )}
    </div>
  );
}
