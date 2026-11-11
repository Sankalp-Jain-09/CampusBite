import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RatingSummary } from '../common/RatingStars';

const GRADIENTS = [
  'from-orange-400 to-rose-500', 'from-amber-400 to-orange-600', 'from-emerald-400 to-teal-600',
  'from-sky-400 to-indigo-500', 'from-fuchsia-400 to-purple-600', 'from-lime-400 to-green-600',
];

export default function RestaurantCard({ restaurant }) {
  const gradient = GRADIENTS[restaurant.id % GRADIENTS.length];
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [restaurant.image_url]);
  return (
    <Link to={`/restaurants/${restaurant.id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`relative flex h-36 items-center overflow-hidden justify-center bg-gradient-to-br ${gradient}`}>
        {restaurant.image_url && !imageFailed ? (
          <img
            src={restaurant.image_url}
            alt=""
            className="h-full w-full object-cover transition duration-300"
            style={{
              objectPosition: `${(restaurant.image_crop_x ?? 0.5) * 100}% ${(restaurant.image_crop_y ?? 0.5) * 100}%`,
            }}
            loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <span className="text-4xl font-black text-white/90 drop-shadow">{restaurant.name.slice(0, 1)}</span>
        )}
        {!restaurant.is_open && (
          <span className="absolute left-3 top-3 rounded-full bg-gray-900/80 px-2.5 py-1 text-xs font-semibold text-white">Closed now</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 group-hover:text-brand-700">{restaurant.name}</h3>
          <RatingSummary avg={restaurant.avg_rating} count={restaurant.review_count} />
        </div>
        <p className="text-sm text-gray-600">{restaurant.cuisine}</p>
        <p className="mt-auto truncate pt-2 text-xs text-gray-400">{restaurant.address}</p>
      </div>
    </Link>
  );
}
