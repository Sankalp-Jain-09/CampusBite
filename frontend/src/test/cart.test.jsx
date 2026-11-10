import { describe, expect, it } from 'vitest';
import { cartReducer, EMPTY_CART } from '../context/CartContext';

const curry = { id: 1, name: 'Campus Curry House' };
const pizza = { id: 2, name: 'Byte Pizza' };
const paneer = { id: 10, name: 'Paneer Tikka', price: 180 };
const naan = { id: 11, name: 'Butter Naan', price: 40 };

describe('cartReducer', () => {
  it('adds items and increments quantity', () => {
    let s = cartReducer(EMPTY_CART, { type: 'add', restaurant: curry, dish: paneer });
    s = cartReducer(s, { type: 'add', restaurant: curry, dish: paneer });
    s = cartReducer(s, { type: 'add', restaurant: curry, dish: naan });
    expect(s.restaurant).toEqual(curry);
    expect(s.items).toEqual([
      { menuItemId: 10, name: 'Paneer Tikka', price: 180, quantity: 2 },
      { menuItemId: 11, name: 'Butter Naan', price: 40, quantity: 1 },
    ]);
  });

  it('caps quantity at 20', () => {
    let s = cartReducer(EMPTY_CART, { type: 'add', restaurant: curry, dish: paneer });
    s = cartReducer(s, { type: 'setQty', menuItemId: 10, quantity: 99 });
    expect(s.items[0].quantity).toBe(20);
  });

  it('removes an item when quantity drops to 0 and empties the cart', () => {
    let s = cartReducer(EMPTY_CART, { type: 'add', restaurant: curry, dish: paneer });
    s = cartReducer(s, { type: 'setQty', menuItemId: 10, quantity: 0 });
    expect(s).toEqual(EMPTY_CART);
  });

  it('adding from another restaurant replaces the cart (single-restaurant rule)', () => {
    let s = cartReducer(EMPTY_CART, { type: 'add', restaurant: curry, dish: paneer });
    s = cartReducer(s, { type: 'add', restaurant: pizza, dish: { id: 20, name: 'Margherita', price: 220 } });
    expect(s.restaurant).toEqual(pizza);
    expect(s.items.map((i) => i.name)).toEqual(['Margherita']);
  });

  it('remove and clear', () => {
    let s = cartReducer(EMPTY_CART, { type: 'add', restaurant: curry, dish: paneer });
    s = cartReducer(s, { type: 'add', restaurant: curry, dish: naan });
    s = cartReducer(s, { type: 'remove', menuItemId: 10 });
    expect(s.items.map((i) => i.menuItemId)).toEqual([11]);
    expect(cartReducer(s, { type: 'clear' })).toEqual(EMPTY_CART);
  });
});
