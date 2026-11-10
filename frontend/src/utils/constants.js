export const ROLES = {
  CUSTOMER: 'customer',
  OWNER: 'restaurant_owner',
  PARTNER: 'delivery_partner',
};

export const ROLE_LABELS = {
  customer: 'Customer',
  restaurant_owner: 'Restaurant owner',
  delivery_partner: 'Delivery partner',
};

export const ORDER_STATUSES = [
  'PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED',
];

// The normal path an order takes (used by the timeline).
export const LIFECYCLE = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
export const ACTIVE_STATUSES = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY'];
export const PAST_STATUSES = ['DELIVERED', 'CANCELLED', 'REFUNDED'];

export const STATUS_LABELS = {
  PLACED: 'Placed',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready for pickup',
  ASSIGNED: 'Rider assigned',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

export const STATUS_COLORS = {
  PLACED: 'bg-blue-50 text-blue-700 ring-blue-200',
  ACCEPTED: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  PREPARING: 'bg-amber-50 text-amber-800 ring-amber-200',
  READY: 'bg-teal-50 text-teal-700 ring-teal-200',
  ASSIGNED: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  OUT_FOR_DELIVERY: 'bg-violet-50 text-violet-700 ring-violet-200',
  DELIVERED: 'bg-green-50 text-green-700 ring-green-200',
  CANCELLED: 'bg-gray-100 text-gray-600 ring-gray-200',
  REFUNDED: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export const PAYMENT_LABELS = { pending: 'Payment pending', mock_paid: 'Paid (demo)', refunded: 'Payment refunded' };
export const PAYMENT_COLORS = {
  pending: 'bg-gray-100 text-gray-600 ring-gray-200',
  mock_paid: 'bg-green-50 text-green-700 ring-green-200',
  refunded: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export const RETURN_LABELS = { requested: 'Return requested', approved: 'Return approved', rejected: 'Return rejected' };
export const RETURN_COLORS = {
  requested: 'bg-amber-50 text-amber-800 ring-amber-200',
  approved: 'bg-green-50 text-green-700 ring-green-200',
  rejected: 'bg-gray-100 text-gray-600 ring-gray-200',
};

export const VEHICLE_TYPES = [
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'scooter', label: 'Scooter' },
  { value: 'bike', label: 'Motorbike' },
];

// Display only — the server computes the real fee at checkout.
export const DELIVERY_FEE = 30;
export const MAX_QTY = 20;

export const AI_SUGGESTIONS = [
  'Summarize my last five orders.',
  'Which of my orders are still not delivered?',
  'How much did I spend this week?',
  'Which food items have I ordered most frequently?',
];

export function homePathFor(role) {
  if (role === ROLES.OWNER) return '/owner/dashboard';
  if (role === ROLES.PARTNER) return '/delivery/dashboard';
  return '/';
}

/** Whether a role may open a path (used to send users back where they were after login). */
export function canAccessPath(role, path) {
  if (!path || path.startsWith('/login') || path.includes('/register')) return false;
  if (path.startsWith('/orders/')) return true;
  if (role === ROLES.OWNER) return path.startsWith('/owner');
  if (role === ROLES.PARTNER) return path.startsWith('/delivery');
  return !path.startsWith('/owner') && !path.startsWith('/delivery');
}
