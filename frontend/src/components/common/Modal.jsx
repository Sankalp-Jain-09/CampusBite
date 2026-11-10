import { useEffect, useRef } from 'react';

export default function Modal({ open, title, onClose, children, footer, size = 'md' }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const previous = document.activeElement;
    panelRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl outline-none sm:rounded-2xl ${width}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  );
}
