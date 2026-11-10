import { useEffect, useRef } from 'react';

/** Call `callback` every `ms` milliseconds while `ms` is a number (pass null to pause). */
export function useInterval(callback, ms) {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (ms === null || ms === undefined) return undefined;
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}
