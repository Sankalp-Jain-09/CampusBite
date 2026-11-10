import { Link, useNavigate } from 'react-router-dom';
import EmptyState from '../../components/common/EmptyState';
import PageHeader from '../../components/common/PageHeader';
import OrderTotals from '../../components/order/OrderTotals';
import QuantityStepper from '../../components/restaurant/QuantityStepper';
import { useCart } from '../../hooks/useCart';
import { DELIVERY_FEE } from '../../utils/constants';
import { formatCurrency } from '../../utils/format';

export default function CartPage() {
  const cart = useCart();
  const navigate = useNavigate();

  if (!cart.items.length) {
    return (
      <>
        <PageHeader title="Your cart" />
        <EmptyState title="Your cart is empty" message="Browse restaurants and add some dishes."
          action={<Link to="/" className="btn-primary">Browse restaurants</Link>} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Your cart" subtitle={<>From <Link to={`/restaurants/${cart.restaurant.id}`} className="link">{cart.restaurant.name}</Link></>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <ul className="card divide-y divide-gray-100">
          {cart.items.map((item) => (
            <li key={item.menuItemId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-gray-500">{formatCurrency(item.price)} each</p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <QuantityStepper value={item.quantity} onChange={(q) => cart.updateQuantity(item.menuItemId, q)} label={item.name} />
                <span className="w-20 text-right font-semibold">{formatCurrency(item.price * item.quantity)}</span>
                <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => cart.removeItem(item.menuItemId)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
        <div className="card h-fit space-y-4 p-5">
          <h2 className="font-semibold">Bill details</h2>
          <OrderTotals subtotal={cart.subtotal} deliveryFee={DELIVERY_FEE} total={cart.subtotal + DELIVERY_FEE}
            note="Final prices are confirmed by the restaurant at checkout." />
          <button type="button" className="btn-primary w-full" onClick={() => navigate('/checkout')}>Proceed to checkout</button>
          <button type="button" className="btn-ghost w-full" onClick={cart.clearCart}>Clear cart</button>
        </div>
      </div>
    </>
  );
}
