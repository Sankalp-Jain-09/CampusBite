import { createContext, useCallback, useEffect, useMemo, useReducer } from 'react';
import { useAuth } from '../hooks/useAuth';
import { MAX_QTY } from '../utils/constants';
import { storage } from '../utils/storage';

export const CartContext = createContext(null);

export const EMPTY_CART = { restaurant: null, items: [] };

export function cartReducer(state, action) {
  switch (action.type) {
    case 'add': {
      const { restaurant, dish } = action;
      const base = state.restaurant && state.restaurant.id !== restaurant.id ? EMPTY_CART : state;
      const existing = base.items.find((i) => i.menuItemId === dish.id);
      const items = existing
        ? base.items.map((i) => (i.menuItemId === dish.id ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + 1) } : i))
        : [...base.items, { menuItemId: dish.id, name: dish.name, price: Number(dish.price), quantity: 1 }];
      return { restaurant: { id: restaurant.id, name: restaurant.name }, items };
    }
    case 'setQty': {
      const quantity = Math.min(MAX_QTY, Math.max(0, action.quantity));
      const items = quantity === 0
        ? state.items.filter((i) => i.menuItemId !== action.menuItemId)
        : state.items.map((i) => (i.menuItemId === action.menuItemId ? { ...i, quantity } : i));
      return items.length ? { ...state, items } : EMPTY_CART;
    }
    case 'remove': {
      const items = state.items.filter((i) => i.menuItemId !== action.menuItemId);
      return items.length ? { ...state, items } : EMPTY_CART;
    }
    case 'syncPrices': {
      // action.updates: { [menuItemId]: { price, name } } with the dishes' current values from the server.
      const items = state.items.map((i) => (action.updates[i.menuItemId] ? { ...i, ...action.updates[i.menuItemId] } : i));
      return { ...state, items };
    }
    case 'clear':
      return EMPTY_CART;
    default:
      return state;
  }
}

/**
 * Validate a cart read from localStorage. Anything malformed (edited by hand, or saved by an older
 * version of the app) becomes an empty cart instead of crashing every page.
 */
export function sanitizeCart(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return EMPTY_CART;
  const restaurant = raw.restaurant;
  if (!restaurant || typeof restaurant !== 'object' || !Number.isInteger(restaurant.id)) return EMPTY_CART;
  const items = raw.items
    .filter((i) => i && typeof i === 'object' && Number.isInteger(i.menuItemId) && i.menuItemId > 0
      && Number.isFinite(Number(i.price)) && Number(i.price) >= 0
      && Number.isFinite(Number(i.quantity)) && Number(i.quantity) >= 1)
    .map((i) => ({
      menuItemId: i.menuItemId,
      name: String(i.name ?? ''),
      price: Number(i.price),
      quantity: Math.min(MAX_QTY, Math.floor(Number(i.quantity))),
    }));
  return items.length ? { restaurant: { id: restaurant.id, name: String(restaurant.name ?? '') }, items } : EMPTY_CART;
}

const loadCart = (key) => (key ? sanitizeCart(storage.getJSON(key)) : EMPTY_CART);

/** Wraps cartReducer and remembers which user's cart is loaded. */
function keyedReducer(state, action) {
  if (action.type === 'switchUser') return { key: action.key, cart: loadCart(action.key) };
  return { ...state, cart: cartReducer(state.cart, action) };
}

/** Cart for the logged-in customer, one restaurant at a time (D4), persisted per user in localStorage. */
export function CartProvider({ children }) {
  const { user } = useAuth();
  const storageKey = user ? `campusbite_cart_${user.id}` : null;
  // Load synchronously on the first render, so pages like /checkout never see a falsely empty cart.
  const [state, dispatch] = useReducer(keyedReducer, storageKey, (key) => ({ key, cart: loadCart(key) }));
  if (state.key !== storageKey) dispatch({ type: 'switchUser', key: storageKey }); // user changed (login/logout)
  const cart = state.key === storageKey ? state.cart : loadCart(storageKey);

  useEffect(() => {
    if (state.key) storage.setJSON(state.key, state.cart.items.length ? state.cart : null);
  }, [state]);

  /** Returns { conflict: true, currentRestaurant } instead of adding if the cart holds another restaurant. */
  const addItem = useCallback(
    (restaurant, dish, { replace = false } = {}) => {
      if (!replace && cart.restaurant && cart.restaurant.id !== restaurant.id) {
        return { conflict: true, currentRestaurant: cart.restaurant };
      }
      dispatch({ type: 'add', restaurant, dish });
      return { conflict: false };
    },
    [cart.restaurant],
  );

  const value = useMemo(() => {
    const itemCount = cart.items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return {
      restaurant: cart.restaurant,
      items: cart.items,
      itemCount,
      subtotal,
      quantityOf: (menuItemId) => cart.items.find((i) => i.menuItemId === menuItemId)?.quantity || 0,
      addItem,
      updateQuantity: (menuItemId, quantity) => dispatch({ type: 'setQty', menuItemId, quantity }),
      removeItem: (menuItemId) => dispatch({ type: 'remove', menuItemId }),
      clearCart: () => dispatch({ type: 'clear' }),
      syncPrices: (updates) => dispatch({ type: 'syncPrices', updates }),
    };
  }, [cart, addItem]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
