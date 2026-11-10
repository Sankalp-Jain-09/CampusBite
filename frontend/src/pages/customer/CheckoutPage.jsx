import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ordersApi } from '../../api/orders';
import { restaurantsApi } from '../../api/restaurants';
import Button from '../../components/common/Button';
import ErrorMessage from '../../components/common/ErrorMessage';
import FormField from '../../components/common/FormField';
import PageHeader from '../../components/common/PageHeader';
import OrderTotals from '../../components/order/OrderTotals';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useToast } from '../../hooks/useToast';
import { DELIVERY_FEE } from '../../utils/constants';
import { formatCurrency } from '../../utils/format';
import { collectErrors, minLength, validatePhone } from '../../utils/validation';

export default function CheckoutPage() {
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    delivery_address: user?.default_address || '',
    contact_phone: user?.phone || '',
    notes: '',
  });
  // Dummy card — shown for realism, never sent to the backend.
  const [card, setCard] = useState({ number: '4111 1111 1111 1111', expiry: '12/30', cvv: '123', name: user?.name || '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [placing, setPlacing] = useState(false);
  // The cart keeps the prices from when dishes were added; check them against the server before paying.
  const [checkingPrices, setCheckingPrices] = useState(true);
  const [priceChanges, setPriceChanges] = useState([]);

  /** Load current prices/names for the cart's dishes, update the cart, and return what changed. */
  const refreshPrices = async (items) => {
    const results = await Promise.allSettled(items.map((i) => restaurantsApi.menuItem(i.menuItemId)));
    const updates = {};
    const changes = [];
    results.forEach((r, idx) => {
      if (r.status !== 'fulfilled' || !r.value) return;   // deleted/unavailable dishes are reported by the server at checkout
      const item = items[idx];
      const price = Number(r.value.price);
      if (!Number.isFinite(price)) return;
      if (price !== item.price || r.value.name !== item.name) updates[item.menuItemId] = { price, name: r.value.name };
      if (price !== item.price) changes.push({ id: item.menuItemId, name: r.value.name, from: item.price, to: price });
    });
    if (Object.keys(updates).length) cart.syncPrices(updates);
    return changes;
  };

  const itemIds = cart.items.map((i) => i.menuItemId).join(',');
  useEffect(() => {
    if (!itemIds) return undefined;
    let cancelled = false;
    setCheckingPrices(true);
    refreshPrices(cart.items)
      .then((changes) => { if (!cancelled && changes.length) setPriceChanges(changes); })
      .catch(() => {})   // offline etc.: the server still refuses a stale total (expected_subtotal)
      .finally(() => { if (!cancelled) setCheckingPrices(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIds]);

  if (!cart.items.length && !placing) return <Navigate to="/cart" replace />;

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    setFormError(null);
    const clientErrors = collectErrors({
      delivery_address: minLength(form.delivery_address, 5, 'Delivery address'),
      contact_phone: validatePhone(form.contact_phone),
    });
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setPlacing(true);
    try {
      const order = await ordersApi.place({
        restaurant_id: cart.restaurant.id,
        items: cart.items.map((i) => ({ menu_item_id: i.menuItemId, quantity: i.quantity })),
        delivery_address: form.delivery_address.trim(),
        contact_phone: form.contact_phone.trim(),
        notes: form.notes.trim() || null,
        // The amount shown to the customer; the server refuses the order (409) if prices changed meanwhile.
        expected_subtotal: Number(cart.subtotal.toFixed(2)),
      });
      toast.success(`Payment successful (demo) · ${formatCurrency(order.total_amount)}`);
      cart.clearCart();
      navigate(`/orders/${order.id}`, { replace: true, state: { justPlaced: true } });
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setFormError(err);
      setPlacing(false);
      if (err.status === 409) {
        // Prices changed after the page loaded: show the new prices and total before the customer pays again.
        const changes = await refreshPrices(cart.items).catch(() => []);
        if (changes.length) setPriceChanges(changes);
      }
    }
  };

  return (
    <form onSubmit={placeOrder} noValidate>
      <PageHeader title="Checkout" subtitle={`Ordering from ${cart.restaurant?.name}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {priceChanges.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
              <p className="font-semibold">Prices changed since you added these dishes</p>
              <ul className="mt-1 list-disc pl-5">
                {priceChanges.map((c) => (
                  <li key={c.id}>{c.name}: {formatCurrency(c.from)} → {formatCurrency(c.to)}</li>
                ))}
              </ul>
              <p className="mt-1">Your total has been updated. Please check it before paying.</p>
            </div>
          )}
          <ErrorMessage error={formError} />
          {formError?.status === 400 && (
            <p className="text-sm text-gray-600">
              Something in your cart changed. <Link to={`/restaurants/${cart.restaurant.id}`} className="link">Review the menu</Link>
            </p>
          )}
          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">Delivery details</h2>
            <FormField label="Delivery address" error={errors.delivery_address}>
              <textarea rows={2} value={form.delivery_address} onChange={set('delivery_address')} placeholder="Hostel B, Room 214" />
            </FormField>
            <FormField label="Contact phone" error={errors.contact_phone}>
              <input type="tel" value={form.contact_phone} onChange={set('contact_phone')} />
            </FormField>
            <FormField label="Notes for the restaurant (optional)" error={errors.notes}>
              <input value={form.notes} maxLength={500} onChange={set('notes')} placeholder="Less spicy, no onions…" />
            </FormField>
          </section>

          <section className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Payment</h2>
              <span className="badge bg-amber-50 text-amber-800 ring-amber-200">Demo — no real charge</span>
            </div>
            <FormField label="Card number">
              <input value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} inputMode="numeric" autoComplete="off" />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Expiry"><input value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} autoComplete="off" /></FormField>
              <FormField label="CVV"><input value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value })} autoComplete="off" /></FormField>
            </div>
            <FormField label="Name on card"><input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} autoComplete="off" /></FormField>
            <p className="text-xs text-gray-500">This is a dummy payment. Card details stay in your browser and are never sent anywhere.</p>
          </section>
        </div>

        <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-24">
          <h2 className="font-semibold">Order summary</h2>
          <ul className="space-y-1.5 text-sm">
            {cart.items.map((i) => (
              <li key={i.menuItemId} className="flex justify-between gap-2">
                <span className="truncate">{i.quantity} × {i.name}</span>
                <span>{formatCurrency(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <OrderTotals subtotal={cart.subtotal} deliveryFee={DELIVERY_FEE} total={cart.subtotal + DELIVERY_FEE} />
          <Button type="submit" className="w-full" loading={placing} disabled={checkingPrices}>
            {checkingPrices ? 'Checking prices…' : `Pay ${formatCurrency(cart.subtotal + DELIVERY_FEE)} & place order`}
          </Button>
          <p className="text-center text-xs text-gray-500">You can cancel for free within 1 minute of ordering.</p>
        </aside>
      </div>
    </form>
  );
}
