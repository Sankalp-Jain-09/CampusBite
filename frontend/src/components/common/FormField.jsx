import { cloneElement, isValidElement, useId } from 'react';

/** Label + control + error. The child input gets id, aria-invalid and error styling automatically. */
export default function FormField({ label, error, hint, children, className = '' }) {
  const id = useId();
  const control = isValidElement(children)
    ? cloneElement(children, {
      id,
      'aria-invalid': error ? 'true' : undefined,
      'aria-describedby': error ? `${id}-error` : undefined,
      className: `${children.props.className || 'input'} ${error ? 'input-error' : ''}`,
    })
    : children;
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="label">{label}</label>}
      {control}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
