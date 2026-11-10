import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ordersApi } from '../api/orders';
import { PaymentBadge, ReturnBadge, StatusBadge } from '../components/common/Badges';
import EmptyState from '../components/common/EmptyState';
import ErrorMessage from '../components/common/ErrorMessage';
import Loader from '../components/common/Loader';
import { RatingStars } from '../components/common/RatingStars';
import CancelCountdown from '../components/order/CancelCountdown';
import OrderItemsTable from '../components/order/OrderItemsTable';
import OrderTimeline from '../components/order/OrderTimeline';
import OrderTotals from '../components/order/OrderTotals';
import ReturnForm from '../components/order/ReturnForm';
import ReviewForm from '../components/order/ReviewForm';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { useInterval } from '../hooks/useInterval';
import { PAST_STATUSES, ROLES, VEHICLE_TYPES } from '../utils/constants';
import { formatCurrency, formatDateTime } from '../utils/format';

const BACK = {
  [ROLES.CUSTOMER]: { to: '/customer/dashboard', label: 'My orders' },
  [ROLES.OWNER]: { to: '/owner/orders', label: 'Orders' },
  [ROLES.PARTNER]: { to: '/delivery/dashboard', label: 'Deliveries' },
};

function Section({ title, children, className = '' }) {
  return (
    <section className={`card p-5 ${className}`}>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [returnOpen, setReturnOpen] = useState(false);
  const { data: order, loading, error, refetch } = useApi(() => ordersApi.get(id), [id]);
  const isCustomer = user?.role === ROLES.CUSTOMER;
  const active = order && !PAST_STATUSES.includes(order.status);

  // Live tracking by polling while the order is in progress.
  useInterval(() => refetch({ silent: true }), active ? 15000 : null);

  useEffect(() => {
    if (order && location.hash === '#review') document.getElementById('review')?.scrollIntoView?.({ behavior: 'smooth' });
  }, [order, location.hash]);

  if (loading && !order) return <Loader />;
  if (error) {
    // 422 = the id in the URL isn't a number (e.g. /orders/abc): that order doesn't exist either.
    return error.status === 404 || error.status === 422
      ? <EmptyState title="Order not found" message="This order doesn't exist or isn't yours."
        action={<Link to={BACK[user?.role]?.to || '/'} className="btn-primary">Back</Link>} />
      : <ErrorMessage error={error} onRetry={refetch} />;
  }
  const back = BACK[user.role];
  const vehicle = VEHICLE_TYPES.find((v) => v.value === order.delivery_partner?.vehicle_type)?.label;

  return (
    <div className="space-y-6">
      <div>
        <Link to={back.to} className="link text-sm">← {back.label}</Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Order #{order.id}</h1>
            <p className="text-sm text-gray-500">{order.restaurant.name} · placed {formatDateTime(order.created_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.payment_status} />
            <ReturnBadge status={order.return_status} />
          </div>
        </div>
      </div>

      {location.state?.justPlaced && order.status === 'PLACED' && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Payment successful (demo). Your order has been sent to {order.restaurant.name}.</p>
      )}
      {isCustomer && <CancelCountdown order={order} onChanged={refetch} />}

      {order.refund && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">{formatCurrency(order.refund.amount)} refunded (demo)</p>
          <p className="text-rose-700/80">Reference {order.refund.transaction_ref} · {formatDateTime(order.refund.refunded_at)}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Section title="Items">
            <OrderItemsTable items={order.items} />
            <div className="mt-3 border-t border-gray-100 pt-3">
              <OrderTotals subtotal={order.subtotal} deliveryFee={order.delivery_fee} total={order.total_amount} />
            </div>
            {order.notes && <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600"><span className="font-medium">Note:</span> {order.notes}</p>}
          </Section>

          {isCustomer && order.status === 'DELIVERED' && !order.review && (
            <Section title="Rate your order"><ReviewForm orderId={order.id} onDone={refetch} /></Section>
          )}
          {order.review && (
            <Section title={isCustomer ? 'Your review' : 'Customer review'}>
              <RatingStars value={order.review.rating} />
              {order.review.comment && <p className="mt-1 text-sm text-gray-600">{order.review.comment}</p>}
            </Section>
          )}

          {order.return_request ? (
            <Section title="Return / refund request">
              <div className="space-y-2 text-sm">
                <ReturnBadge status={order.return_request.status} />
                <p><span className="text-gray-500">Reason:</span> {order.return_request.reason}</p>
                {order.return_request.owner_note && <p><span className="text-gray-500">Restaurant's note:</span> {order.return_request.owner_note}</p>}
                {order.return_request.status === 'requested' && <p className="text-gray-500">Waiting for the restaurant to respond.</p>}
              </div>
            </Section>
          ) : isCustomer && order.status === 'DELIVERED' && (
            <Section title="Problem with your order?">
              <p className="mb-3 text-sm text-gray-600">Request a return or refund and the restaurant will review it.</p>
              <button type="button" className="btn-secondary" onClick={() => setReturnOpen(true)}>Request return / refund</button>
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Order status"><OrderTimeline status={order.status} timeline={order.timeline} /></Section>
          <Section title="Delivery">
            <dl className="space-y-2 text-sm">
              {!isCustomer && <div><dt className="text-gray-500">Customer</dt><dd className="font-medium">{order.customer.name}</dd></div>}
              <div><dt className="text-gray-500">Address</dt><dd>{order.delivery_address}</dd></div>
              <div><dt className="text-gray-500">Phone</dt><dd><a href={`tel:${order.contact_phone}`} className="link">{order.contact_phone}</a></dd></div>
              {order.delivery_partner && (
                <div>
                  <dt className="text-gray-500">Delivery partner</dt>
                  <dd>{order.delivery_partner.name}{vehicle ? ` · ${vehicle}` : ''}{order.delivery_partner.vehicle_number ? ` (${order.delivery_partner.vehicle_number})` : ''}</dd>
                </div>
              )}
              <div><dt className="text-gray-500">Restaurant</dt><dd>{order.restaurant.name}, {order.restaurant.address}</dd></div>
            </dl>
          </Section>
        </div>
      </div>
      {isCustomer && <ReturnForm orderId={order.id} open={returnOpen} onClose={() => setReturnOpen(false)} onDone={refetch} />}
    </div>
  );
}
