import { createContext, useCallback, useMemo, useRef, useState } from 'react';

export const ToastContext = createContext(null);

const STYLES = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-gray-200 bg-white text-gray-800',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (message, type = 'info', ms = 4000) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, message, type }]);
      setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'error', 6000),
      info: (m) => show(m, 'info'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${STYLES[t.type]}`}
          >
            <span className="flex-1">{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
