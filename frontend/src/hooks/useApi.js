import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Run `fn` when `deps` change; returns { data, loading, error, refetch, setData }.
 * Stale responses (after unmount or a newer request) are ignored.
 * `refetch({ silent: true })` refreshes without showing the loading state (used for polling).
 */
export function useApi(fn, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const requestId = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++requestId.current;
      if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fnRef.current();
        if (id === requestId.current) setState({ data: result, loading: false, error: null });
        return result;
      } catch (error) {
        if (id === requestId.current) setState((s) => ({ ...s, loading: false, error }));
        return undefined;
      }
    },
    [],
  );

  useEffect(() => {
    if (enabled) run();
    return () => {
      requestId.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, refetch: run, setData };
}
