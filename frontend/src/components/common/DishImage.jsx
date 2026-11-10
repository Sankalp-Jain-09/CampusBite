import { useEffect, useState } from 'react';

/** Dish photo with a graceful fallback (first letter on a tinted tile) if there is no URL or it fails to load. */
export default function DishImage({ src, name, className = 'h-14 w-14' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-lg bg-brand-50 font-bold text-brand-600 ${className}`} aria-hidden="true">
        {(name || '?').slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return (
    <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)}
      className={`shrink-0 rounded-lg bg-gray-100 object-cover ${className}`} />
  );
}
