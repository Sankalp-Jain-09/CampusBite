import { WEB, Blocked, api, expect, injectAuth, loggedIn, section, sleep, state, test, toast } from './lib.mjs';

const ASHA = 'demo.customer@campusbite.dev';
const ROHAN = 'demo.customer2@campusbite.dev';
const cartBadge = (p) => p.getByRole('link', { name: /^Cart, \d+ items?/ }).first();
const menuCard = (p, dish) => p.locator('main li, main article, main [class*="card"]').filter({ hasText: dish }).filter({ has: p.getByRole('button') }).last();

async function placeOrderViaUI(p, restaurant, dishes) {
  await p.goto(WEB); await p.locator('a', { hasText: restaurant }).first().click();
  for (const d of dishes) {
    await p.getByRole('button', { name: `Add ${d}` }).or(menuCard(p, d).getByRole('button', { name: /^add/i })).first().click();
    const dlg = p.getByRole('dialog');
    if (await dlg.isVisible().catch(() => false)) await dlg.getByRole('button', { name: /clear cart & add/i }).click();
  }
  await p.goto(WEB + '/cart'); await p.getByRole('link', { name: /proceed to checkout/i }).or(p.getByRole('button', { name: /proceed to checkout/i })).first().click();
  await p.getByRole('button', { name: /^Pay ₹/ }).click();
  await expect(p).toHaveURL(/\/orders\/\d+/);
  return Number(p.url().match(/orders\/(\d+)/)[1]);
}
export { placeOrderViaUI, menuCard };

export async function run() {
  section('3. Customer');
  const p = await loggedIn(ASHA, '/');

  // ---- 3.1 menu search / filter / sort
  await test('C-01', 'Search dishes', async (c) => {
    c.page = p; await p.locator('a', { hasText: 'Campus Curry House' }).click();
    state.curryPath = new URL(p.url()).pathname;
    await p.getByPlaceholder('Search dishes…').fill('butter');
    await expect(p.getByRole('heading', { name: 'Dal Makhani' })).toHaveCount(0);
    for (const d of ['Butter Chicken', 'Butter Naan', 'Paneer Butter Masala']) await expect(p.getByText(d, { exact: true }).first()).toBeVisible();
    await expect(p).toHaveURL(/search=butter/);
    await p.getByPlaceholder('Search dishes…').fill('');
    await expect(p).not.toHaveURL(/search=/);
  });
  await test('C-02', 'Price range 100–200', async (c) => {
    c.page = p; await p.getByPlaceholder('Min ₹').fill('100'); await p.getByPlaceholder('Max ₹').fill('200');
    await expect(p.getByText('Butter Chicken', { exact: true })).toHaveCount(0);
    for (const d of ['Paneer Tikka', 'Dal Makhani', 'Hara Bhara Kebab', 'Veg Biryani']) await expect(p.getByText(d, { exact: true }).first()).toBeVisible();
    await expect(p.getByText('Butter Naan', { exact: true })).toHaveCount(0);
  });
  await test('C-03', 'Invalid price range', async (c) => {
    c.page = p; await p.getByPlaceholder('Min ₹').fill('300'); await p.getByPlaceholder('Max ₹').fill('100');
    await expect(p.getByText(/min_price cannot be greater than max_price/i)).toBeVisible();
    await p.getByPlaceholder('Min ₹').fill(''); await expect(p).not.toHaveURL(/min_price/);
    await p.getByPlaceholder('Max ₹').fill(''); await expect(p).not.toHaveURL(/max_price/); await sleep(700);
  });
  await test('C-04', 'Category & veg filters', async (c) => {
    c.page = p; await p.goto(WEB + state.curryPath); await expect(p.getByText('Dal Makhani', { exact: true }).first()).toBeVisible();
    await p.getByLabel('Category').selectOption({ label: 'Mains' }); await sleep(600);
    await expect(p.getByText('Paneer Tikka', { exact: true })).toHaveCount(0);
    await expect(p.getByText('Dal Makhani', { exact: true }).first()).toBeVisible();
    await p.getByLabel('Veg filter').selectOption({ label: 'Non-veg only' });
    await expect(p.getByText('Dal Makhani', { exact: true })).toHaveCount(0);
    await expect(p.getByText('Butter Chicken', { exact: true }).first()).toBeVisible();
  });
  await test('C-05', 'Sorting by price', async (c) => {
    c.page = p; await p.getByRole('button', { name: /clear filters/i }).click(); await expect(p).toHaveURL(/\/restaurants\/\d+$/); await sleep(800);
    const prices = async () => (await p.locator('main').innerText()).match(/₹\s?\d+/g).map((x) => Number(x.replace(/\D/g, '')));
    await p.locator('#dish-sort').selectOption({ label: 'Price: low to high' }); await sleep(800);
    const asc = await prices(); c.note(`asc first: ${asc.slice(0, 5)}`);
    await p.locator('#dish-sort').selectOption({ label: 'Price: high to low' }); await sleep(800);
    const desc = await prices(); c.note(`desc first: ${desc.slice(0, 5)}`);
    expect(asc[0]).toBeLessThan(desc[0]);
  });
  await test('C-06', 'Filters stay in the URL', async (c) => {
    c.page = p; await p.locator('#dish-sort').selectOption('name'); await sleep(600);
    await p.getByLabel('Category').selectOption({ label: 'Breads' }); await sleep(600);
    const url = p.url(); c.note(url.replace(WEB, ''));
    expect(url).toMatch(/category=Breads/);
    const p2 = await p.context().newPage(); await p2.goto(url);
    await expect(p2.getByLabel('Category')).toHaveValue('Breads');
    await expect(p2.getByText('Garlic Naan', { exact: true }).first()).toBeVisible();
    await expect(p2.getByText('Dal Makhani', { exact: true })).toHaveCount(0);
    await p2.close();
    await p.getByRole('button', { name: /clear filters/i }).click();
    await expect(p.getByText('Dal Makhani', { exact: true }).first()).toBeVisible();
  });
  await test('C-07', 'Every dish has a photo', async (c) => {
    c.page = p; await sleep(1500);
    const imgs = p.locator('main img');
    const n = await imgs.count();
    const broken = await imgs.evaluateAll((els) => els.filter((e) => !e.complete || e.naturalWidth === 0).map((e) => e.alt));
    c.note(`${n} photos, broken: ${broken.length}`);
    expect(n).toBeGreaterThanOrEqual(10); expect(broken).toEqual([]);
  });

  // ---- 3.2 cart
  await test('C-08', 'Add & steppers', async (c) => {
    c.page = p;
    await menuCard(p, 'Paneer Tikka').getByRole('button', { name: /^add/i }).click();
    await p.getByRole('button', { name: 'Add one Paneer Tikka' }).first().click();
    await p.getByRole('button', { name: 'Add one Paneer Tikka' }).first().click();
    await menuCard(p, 'Butter Naan').getByRole('button', { name: /^add/i }).click();
    await expect(cartBadge(p)).toHaveAttribute('aria-label', /Cart, 4 items/);
    const panel = p.locator('aside').filter({ hasText: 'Your cart' });
    await expect(panel).toContainText('Paneer Tikka'); await expect(panel).toContainText('Butter Naan');
    await expect(panel).toContainText('₹580');   // 3×180 + 40
  });
  await test('C-09', 'Single-restaurant rule', async (c) => {
    c.page = p; await p.goto(WEB); await p.locator('a', { hasText: 'Byte Pizza' }).click();
    await menuCard(p, 'Margherita').getByRole('button', { name: /^add/i }).click();
    const dlg = p.getByRole('dialog'); await expect(dlg).toContainText('Start a new cart?');
    await dlg.getByRole('button', { name: /^cancel$/i }).click();
    await expect(cartBadge(p)).toHaveAttribute('aria-label', /Cart, 4 items/);
    await menuCard(p, 'Margherita').getByRole('button', { name: /^add/i }).click();
    await p.getByRole('dialog').getByRole('button', { name: /clear cart & add/i }).click();
    await expect(cartBadge(p)).toHaveAttribute('aria-label', /Cart, 1 item/);
  });
  await test('C-10', 'Cart page', async (c) => {
    c.page = p; await menuCard(p, 'Garlic Bread').getByRole('button', { name: /^add/i }).click();
    await cartBadge(p).click(); await expect(p).toHaveURL(/\/cart/);
    for (const t of ['Bill details', 'Subtotal', 'Delivery fee', '₹30', 'Total', 'Margherita', 'Garlic Bread']) await expect(p.getByText(t).first()).toBeVisible();
    await expect(p.getByRole('button', { name: 'Remove' }).first()).toBeVisible();
    await expect(p.getByText('₹340').first()).toBeVisible();   // 220 + 120
    await expect(p.getByText('₹370').first()).toBeVisible();   // + 30
  });
  await test('C-11', 'Update / remove / empty', async (c) => {
    c.page = p; await p.getByRole('button', { name: 'Add one Margherita' }).click();
    await expect(p.getByText('₹560').first()).toBeVisible();   // 440 + 120
    await p.locator('li, [class*="card"]').filter({ hasText: 'Garlic Bread' }).getByRole('button', { name: 'Remove' }).last().click();
    await expect(p.getByText('Garlic Bread')).toHaveCount(0);
    await p.getByRole('button', { name: 'Remove one Margherita' }).click();
    await p.getByRole('button', { name: 'Remove one Margherita' }).click();
    await expect(p.getByText('Your cart is empty')).toBeVisible();
  });
  await test('C-12', 'Cart survives refresh; per-user carts', async (c) => {
    c.page = p; await p.goto(WEB + state.curryPath);
    await menuCard(p, 'Dal Makhani').getByRole('button', { name: /^add/i }).click();
    await p.reload(); await expect(cartBadge(p)).toHaveAttribute('aria-label', /Cart, 1 item/);
    await p.getByRole('button', { name: /log out/i }).first().click();
    await injectAuth(p, ROHAN); await p.goto(WEB + '/cart');
    await expect(p.getByText('Your cart is empty')).toBeVisible();
    await p.evaluate(() => localStorage.removeItem('campusbite_token'));
    await injectAuth(p, ASHA); await p.goto(WEB + '/cart');
    await expect(p.getByText('Dal Makhani').first()).toBeVisible();
  });

  // ---- 3.3 checkout
  await test('C-14', 'Checkout form pre-filled', async (c) => {
    c.page = p; await p.getByRole('link', { name: /proceed to checkout/i }).or(p.getByRole('button', { name: /proceed to checkout/i })).first().click();
    await expect(p).toHaveURL(/checkout/);
    await expect(p.getByLabel('Delivery address')).toHaveValue(/Hostel B, Room 214/);
    await expect(p.getByLabel('Contact phone')).toHaveValue('9876543210');
    await expect(p.getByText('Demo — no real charge')).toBeVisible();
    await expect(p.getByLabel('Card number')).not.toHaveValue('');
    await expect(p.getByText('Order summary')).toBeVisible();
    await expect(p.getByRole('button', { name: 'Pay ₹200.00 & place order' })).toBeVisible();   // 170 + 30
  });
  await test('C-15', 'Checkout validation', async (c) => {
    c.page = p; await p.getByLabel('Delivery address').fill(''); await p.getByLabel('Contact phone').fill('12');
    const before = (await api('GET', '/orders/me?size=1', ASHA)).data.total;
    await p.getByRole('button', { name: /^Pay ₹/ }).click();
    const errs = (await p.locator('.text-red-600').allInnerTexts()).filter(Boolean); c.note(errs.join(' / '));
    expect(errs.length).toBeGreaterThanOrEqual(2);
    await expect(p).toHaveURL(/checkout/);
    expect((await api('GET', '/orders/me?size=1', ASHA)).data.total).toBe(before);
  });
  await test('C-16', 'Place order (dummy payment)', async (c) => {
    c.page = p; await p.getByLabel('Delivery address').fill('Hostel B, Room 214, North Campus'); await p.getByLabel('Contact phone').fill('9876543210');
    await p.getByRole('button', { name: /^Pay ₹/ }).click();
    await toast(p, /Payment successful \(demo\) · ₹200/);
    await expect(p).toHaveURL(/\/orders\/\d+/);
    state.orderA = Number(p.url().match(/orders\/(\d+)/)[1]); state.orderAt = Date.now();
    await expect(p.getByRole('heading', { name: `Order #${state.orderA}` })).toBeVisible();
    await expect(p.getByText('Placed', { exact: true }).first()).toBeVisible();
    await expect(p.getByText('Paid (demo)').first()).toBeVisible();
    await expect(cartBadge(p)).toHaveAttribute('aria-label', /Cart, 0 items/);
  });
  await test('C-18', 'Free-cancel countdown', async (c) => {
    c.page = p; await expect(p.getByText('Changed your mind?')).toBeVisible();
    const b = p.getByRole('button', { name: /Cancel for free · 0:\d\d/ });
    const t1 = await b.innerText(); await sleep(2200); const t2 = await b.innerText();
    c.note(`${t1} → ${t2}`); expect(t1).not.toBe(t2); expect(t1).toMatch(/0:5\d/);
  });
  await test('C-17', 'Empty-cart checkout → cart', async (c) => {
    const p2 = c.page = await p.context().newPage(); await p2.goto(WEB + '/checkout');
    await expect(p2).toHaveURL(/\/cart$/); await p2.close();
  });
  await test('C-19', 'Free cancel = automatic refund', async (c) => {
    c.page = p; const id = await placeOrderViaUI(p, 'Campus Curry House', ['Butter Naan']); state.orderB = id;
    await p.getByRole('button', { name: /Cancel for free/ }).click();
    await toast(p, /Order cancelled · ₹70(\.00)? refunded \(demo\)/);
    await expect(p.getByText('Cancelled', { exact: true }).first()).toBeVisible();
    await expect(p.getByText('Payment refunded').first()).toBeVisible();
    await expect(p.getByText(/₹70(\.00)? refunded \(demo\)/).first()).toBeVisible();
    await expect(p.getByText(/MOCK-REFUND/).first()).toBeVisible();
    const d = (await api('GET', `/orders/${id}`, ASHA)).data;
    expect(d.timeline.map((t) => t.to_status)).toEqual(['PLACED', 'CANCELLED']);
    expect(d.refund.note).toBe('free_cancellation_window');
  });

  // ---- 3.5 dashboard
  await test('C-22', 'My orders tabs', async (c) => {
    c.page = p; await p.getByRole('link', { name: 'My orders' }).first().click();
    const main = p.locator('main');
    for (const s of ['Placed', 'Accepted', 'Ready for pickup', 'Out for delivery']) await expect(main.getByText(s, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await p.getByRole('tab', { name: 'Past orders' }).or(p.getByRole('button', { name: 'Past orders' })).first().click();
    for (const s of ['Delivered', 'Cancelled', 'Refunded']) await expect(main.getByText(s, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(main.getByText('Out for delivery', { exact: true }).filter({ visible: true })).toHaveCount(0);
  });
  await test('C-23', 'Status filter = Refunded', async (c) => {
    c.page = p; await p.getByLabel('Filter by status').selectOption({ label: 'Refunded' }); await sleep(700);
    const rows = p.locator('main').getByText('Green Bowl');
    await expect(rows.first()).toBeVisible();
    await expect(p.locator('main').getByText('Byte Pizza')).toHaveCount(0);
    await expect(p.locator('main').getByText('Campus Curry House')).toHaveCount(0);
  });
  await test('C-24', 'Date filter', async (c) => {
    c.page = p; await p.getByLabel('Filter by status').selectOption({ index: 0 });
    await p.getByRole('tab', { name: 'Past orders' }).or(p.getByRole('button', { name: 'Past orders' })).first().click();
    const today = new Date().toISOString().slice(0, 10);
    await p.getByLabel('From date').fill(today); await p.getByLabel('To date').fill(today); await sleep(800);
    const txt = await p.locator('main').innerText(); c.note(`today: ${(txt.match(/Order #\d+/g) || []).join(',')}`);
    await p.getByLabel('From date').fill('2020-01-01'); await p.getByLabel('To date').fill('2020-01-31');
    await expect(p.getByText(/No past orders/)).toBeVisible();
    await expect(p.getByText(/Try clearing the filters/)).toBeVisible();
    await p.getByLabel('From date').fill(''); await p.getByLabel('To date').fill('');
  });
  await test('C-25', 'Payment and return badges', async (c) => {
    c.page = p; await p.reload(); await p.getByRole('tab', { name: 'Past orders' }).or(p.getByRole('button', { name: 'Past orders' })).first().click();
    for (const t of ['Paid (demo)', 'Payment refunded', 'Return requested', 'Return approved']) await expect(p.locator('main').getByText(t).first()).toBeVisible();
  });
  await test('C-26', 'Pagination', async (c) => {
    c.page = p; const pag = p.getByText(/Page \d+ of \d+ · \d+ total/);
    if (!(await pag.count())) { c.note('≤10 past orders → no pager shown'); return; }
    const t1 = await pag.innerText();
    await p.getByRole('button', { name: /Next/ }).click(); await expect(pag).not.toHaveText(t1);
    c.note(`${t1} → ${await pag.innerText()}`);
    await p.getByRole('button', { name: /Previous/ }).click(); await expect(pag).toHaveText(t1);
  });

  // ---- 3.6 order details
  await test('C-28', 'Order details page', async (c) => {
    c.page = p; const list = (await api('GET', '/orders/me?status=OUT_FOR_DELIVERY', ASHA)).data.items; const id = list[0].id;
    state.ofdOrder = id;
    await p.goto(WEB + `/orders/${id}`);
    for (const t of ['Veg Biryani', 'Sweet Lassi', 'Subtotal', 'Delivery fee', 'Total', 'Meena Shah', 'Campus Curry House']) await expect(p.getByText(t).first()).toBeVisible();
    await expect(p.locator('a[href^="tel:"]').first()).toBeVisible();
    await expect(p.getByText(/Out for delivery/).first()).toBeVisible();
  });
  await test('C-29', "Someone else's order → not found", async (c) => {
    const r = c.page = await loggedIn(ROHAN, `/orders/${state.orderA}`);
    await expect(r.getByText('Order not found')).toBeVisible();
    await expect(r.getByText(/doesn't exist or isn't yours/)).toBeVisible();
    await expect(r.getByText('Dal Makhani')).toHaveCount(0);
  });

  // ---- 3.7 reviews & returns
  const delivered = (await api('GET', '/orders/me?status=DELIVERED&page_size=50', ASHA)).data.items;
  const toReview = delivered.find((o) => o.restaurant_name === 'Campus Curry House' && !o.has_review);
  const toReturn = delivered.filter((o) => !o.return_status && o.id !== toReview?.id);
  await test('C-31', 'Review needs a rating', async (c) => {
    c.page = p; if (!toReview) throw new Blocked('no unreviewed delivered order');
    await p.goto(WEB + `/orders/${toReview.id}`);
    await p.getByRole('button', { name: 'Submit review' }).click();
    await expect(p.getByText('Please choose a rating')).toBeVisible();
  });
  await test('C-30', 'Review a delivered order', async (c) => {
    c.page = p; if (!toReview) throw new Blocked('no unreviewed delivered order');
    const before = (await api('GET', '/restaurants/1', null)).data;
    await p.getByRole('radio', { name: '4 stars' }).click();
    await p.getByLabel('Review comment').fill('QA review: tasty and on time 👍');
    await p.getByRole('button', { name: 'Submit review' }).click();
    await toast(p, 'Thanks for your review!');
    await expect(p.getByRole('heading', { name: 'Your review' })).toBeVisible();
    const after = (await api('GET', '/restaurants/1', null)).data;
    c.note(`Curry rating ${before.avg_rating} (${before.review_count}) → ${after.avg_rating} (${after.review_count})`);
    expect(after.review_count).toBe(before.review_count + 1);
    state.reviewedOrder = toReview.id;
  });
  await test('C-32', 'No review section before delivery', async (c) => {
    c.page = p; await p.goto(WEB + `/orders/${state.ofdOrder}`);
    await expect(p.getByText('Out for delivery').first()).toBeVisible();
    await expect(p.getByRole('button', { name: 'Submit review' })).toHaveCount(0);
    await expect(p.getByText('How was your food?')).toHaveCount(0);
  });
  await test('C-33', 'Request a return (validation + success)', async (c) => {
    c.page = p; const o = toReturn[0]; if (!o) throw new Blocked('no delivered order without a return');
    state.returnOrder1 = o.id;
    await p.goto(WEB + `/orders/${o.id}`);
    await p.getByRole('button', { name: 'Request return / refund' }).click();
    const dlg = p.getByRole('dialog'); await dlg.locator('textarea').fill('bad');
    await dlg.getByRole('button', { name: 'Send request' }).click();
    await expect(dlg.getByText(/at least 10 characters/)).toBeVisible();
    await dlg.locator('textarea').fill('QA: the naan was missing and the curry was cold.');
    await dlg.getByRole('button', { name: 'Send request' }).click();
    await toast(p, 'Return request sent to the restaurant');
    await expect(p.getByText('Return requested').first()).toBeVisible();
    await expect(p.getByText('Waiting for the restaurant to respond.')).toBeVisible();
  });
  await test('C-34', 'Only one return per order', async (c) => {
    c.page = p; await p.reload();
    await expect(p.getByText('Return requested').first()).toBeVisible();
    await expect(p.getByRole('button', { name: 'Request return / refund' })).toHaveCount(0);
  });
  await test('C-35', 'Quick actions Rate / Return from the list', async (c) => {
    c.page = p; await p.goto(WEB + '/customer/dashboard');
    await p.getByRole('tab', { name: 'Past orders' }).or(p.getByRole('button', { name: 'Past orders' })).first().click();
    const rate = p.getByRole('link', { name: 'Rate' }).or(p.getByRole('button', { name: 'Rate' })).first();
    await expect(rate).toBeVisible(); await rate.click();
    await expect(p).toHaveURL(/\/orders\/\d+/);
    await expect(p.getByRole('button', { name: 'Submit review' })).toBeVisible();
    await p.goBack();
    await p.getByRole('tab', { name: 'Past orders' }).or(p.getByRole('button', { name: 'Past orders' })).first().click();
    const ret = p.getByRole('button', { name: 'Return', exact: true }).first();
    await expect(ret).toBeVisible(); await ret.click();
    await expect(p.getByRole('dialog')).toContainText('What went wrong?');
    await p.getByRole('dialog').getByRole('button', { name: /cancel/i }).click();
  });

  // ---- 3.8 AI
  const ai = await loggedIn(ASHA, '/customer/ai-insights');
  await test('C-36', 'AI suggested questions (stub model)', async (c) => {
    c.page = ai;
    for (const q of ['Summarize my last five orders.', 'Which of my orders are still not delivered?', 'How much did I spend this week?', 'Which food items have I ordered most frequently?']) {
      await ai.getByRole('button', { name: q }).click();
      await expect(ai.getByText(`(stub) You asked: ${q}`)).toBeVisible();
    }
    const meta = await ai.getByText(/orders considered/).first().innerText(); c.note(meta);
    const mine = (await api('GET', '/orders/me?size=1', ASHA)).data.total;
    expect(meta).toContain(`${mine} orders considered`);
  });
  await test('C-37', 'AI own question', async (c) => {
    c.page = ai; await ai.getByLabel('Your question').fill('What did I order from Byte Pizza?');
    await ai.getByRole('button', { name: 'Ask' }).click();
    const a = ai.getByText(/From Byte Pizza you ordered:/); await expect(a).toBeVisible(); c.note((await a.innerText()).match(/From Byte Pizza[^.]*/)[0]);
  });
  await test('C-38', 'AI summary button', async (c) => {
    c.page = ai; await ai.getByRole('button', { name: 'Summarize my orders' }).click();
    await expect(ai.getByText(/\(stub\) You asked: /).nth(5)).toBeVisible();
  });
  await test('C-39', 'AI rate limit (10/min)', async (c) => {
    c.page = ai;
    for (let i = 0; i < 6; i++) { await ai.getByRole('button', { name: 'How much did I spend this week?' }).click(); await expect(ai.getByRole('status')).toHaveCount(0); }
    const e = ai.getByText(/You're asking a bit too fast — please try again in \d+ seconds\./);
    await expect(e.first()).toBeVisible(); c.note(await e.first().innerText());
  });
  await test('C-41', 'AI for a new customer with no orders', async (c) => {
    const n = c.page = await loggedIn(state.newCustomer || ASHA, '/customer/ai-insights', { password: 'Secret123' });
    if (!state.newCustomer) throw new Blocked('new customer not created in A-03');
    await n.getByRole('button', { name: 'How much did I spend this week?' }).click();
    const t = n.getByText(/haven't placed any orders yet/); await expect(t).toBeVisible(); c.note(await t.innerText());
  });

  // ---- C-20 last: needs >60 s since order A
  await test('C-20', 'After 60 s: cancel without refund', async (c) => {
    c.page = p; const wait = 62000 - (Date.now() - state.orderAt); if (wait > 0) await sleep(wait);
    await p.goto(WEB + `/orders/${state.orderA}`);
    await p.getByRole('button', { name: 'Cancel order (no refund)' }).click();
    const dlg = p.getByRole('dialog'); await expect(dlg).toContainText('Cancel without refund?');
    await dlg.getByRole('button', { name: 'Yes, cancel order' }).click();
    await toast(p, 'Order cancelled. No refund was issued.');
    await expect(p.getByText('Cancelled', { exact: true }).first()).toBeVisible();
    await expect(p.getByText('Paid (demo)').first()).toBeVisible();
    await expect(p.getByText(/refunded \(demo\)/)).toHaveCount(0);
  });
}
