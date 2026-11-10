import { useEffect, useState } from 'react';

/**
 * Counts down from `initialSeconds` (taken from the server, so the device clock doesn't matter).
 * Restarts whenever `initialSeconds` or `resetKey` changes.
 */
export function useCountdown(initialSeconds, resetKey) {
  const [remaining, setRemaining] = useState(Math.max(0, initialSeconds || 0));

  useEffect(() => {
    const total = Math.max(0, initialSeconds || 0);
    setRemaining(total);
    if (total <= 0) return undefined;
    const endsAt = Date.now() + total * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [initialSeconds, resetKey]);

  return remaining;
}
