import Spinner from './Spinner';

const VARIANTS = { primary: 'btn-primary', secondary: 'btn-secondary', danger: 'btn-danger', ghost: 'btn-ghost' };

export default function Button({ variant = 'primary', size, loading = false, disabled, className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`${VARIANTS[variant]} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}
