import { WEB, Blocked, api, expect, loggedIn, section, sleep, state, test, toast } from './lib.mjs';
import { placeOrderViaUI, menuCard } from './s2_customer.mjs';

const ASHA = 'demo.customer@campusbite.dev';
const CURRY = 'owner.curry@campusbite.dev';
const PIZZA = 'owner.pizza@campusbite.dev';
const OWNER_OF = { 'Campus Curry House': CURRY, 'Byte Pizza': PIZZA, 'Green Bowl': 'owner.green@campusbite.dev' };
const orderCard = (p, id) => p.locator('main li, main article, main div.card').filter({ hasText: `Order #${id}` }).filter({ has: p.getByRole('button') }).last();

export async function run() {
  section('4. Restaurant owner');
  const cust = await loggedIn(ASHA, '/');
  // order for O-09 (placed first so its 60 s window runs while other tests execute)
  let o9 = null;
  try { o9 = await placeOrderViaUI(cust, 'Campus Curry House', ['Paneer Tikka']); state.o9 = o9; state.o9At = Date.now(); } catch (e) { console.log('setup O-09 order failed', e.message); }
  const o = await loggedIn(CURRY, '/owner/dashboard');

  await test('O-09a', 'Accept disabled during the 60 s window (countdown)', async (c) => {
    c.page = o; if (!o9) throw new Blocked('could not place order');
    await o.goto(WEB + '/owner/orders');
    const btn = orderCard(o, o9).getByRole('button', { name: /Awaiting customer · 0:\d\d/ });
    await expect(btn).toBeVisible(); await expect(btn).toBeDisabled();
    const t1 = await btn.innerText(); await sleep(2100); const t2 = await btn.innerText(); c.note(`${t1} → ${t2}`);
    expect(t1).not.toBe(t2);
    const r = await api('PATCH', `/owner/orders/${o9}/status`, CURRY, { status: 'ACCEPTED' }); c.note(`API accept during window → ${r.status}`);
    expect(r.status).toBe(409);
  });

  await test('O-01', 'Dashboard contents', async (c) => {
    c.page = o; await o.goto(WEB + '/owner/dashboard');
    await expect(o.getByRole('heading', { name: 'Campus Curry House' }).first()).toBeVisible();
    await expect(o.getByText('Food Court, Block A, Main Campus').first()).toBeVisible();
    await expect(o.getByText('Open', { exact: true }).first()).toBeVisible();
    await expect(o.getByText('1 order needs attention')).toBeVisible();
    for (const t of ['Total orders', 'Net revenue', 'Avg order value', 'Orders by status', 'Top dishes', 'Active orders']) await expect(o.getByText(t).first()).toBeVisible();
    const rating = o.getByText(/^\d\.\d ★$/).first(); await expect(rating).toBeVisible(); c.note(`rating card: ${await rating.innerText()} (plan says 4.5; C-30 added a 4★ review)`);
  });
  await test('O-03', 'Reminder text', async (c) => {
    c.page = o; const t = o.getByText(/Order #\d+ has been PLACED for \d+ minutes without an update\./);
    await expect(t).toBeVisible(); c.note(await t.innerText());
    await expect(o.getByRole('link', { name: 'View orders' }).or(o.getByRole('button', { name: 'View orders' })).first()).toBeVisible();
    await expect(o.getByRole('button', { name: 'Dismiss' }).first()).toBeVisible();
  });
  await test('O-02', 'Close / reopen restaurant', async (c) => {
    c.page = o; await o.getByRole('button', { name: 'Close for now' }).click();
    await toast(o, 'Restaurant is now closed');
    await expect(o.getByText('Closed', { exact: true }).first()).toBeVisible();
  });
  await test('C-13', 'Customer sees closed restaurant, Add disabled', async (c) => {
    c.page = cust; await cust.goto(WEB + state.curryPath);
    await expect(cust.getByText(/This restaurant is closed right now/)).toBeVisible();
    const adds = cust.getByRole('button', { name: /^add/i });
    const n = await adds.count(); let enabled = 0;
    for (let i = 0; i < n; i++) if (await adds.nth(i).isEnabled()) enabled++;
    c.note(`${n} Add buttons, ${enabled} enabled`); expect(enabled).toBe(0);
    const r = await api('POST', '/orders', ASHA, { restaurant_id: 1, items: [{ menu_item_id: 1, quantity: 1 }], delivery_address: 'Hostel B, Room 214', contact_phone: '9876543210' });
    c.note(`API checkout while closed → ${r.status} ${r.data?.detail}`); expect(r.status).toBeGreaterThanOrEqual(400);
  });
  await test('O-02b', 'Reopen restaurant', async (c) => {
    c.page = o; await o.getByRole('button', { name: 'Open restaurant' }).click();
    await toast(o, 'Restaurant is now open for orders');
    await expect(o.getByText('Open', { exact: true }).first()).toBeVisible();
  });
  await test('O-05', 'Stats date range', async (c) => {
    c.page = o; const total = async () => (await o.locator('main').textContent()).match(/Total orders\s*(\d+)/)?.[1];
    const all = await total();
    const today = new Date().toISOString().slice(0, 10);
    const dates = o.locator('input[type="date"]');
    await dates.nth(0).fill(today); await dates.nth(1).fill(today); await sleep(1200);
    const t = await total(); c.note(`all-time ${all} → today ${t}`);
    await o.getByRole('button', { name: 'All time' }).click(); await sleep(1000);
    expect(await total()).toBe(all); expect(t).not.toBe(all);
  });
  await test('O-04', 'Dismiss a reminder', async (c) => {
    c.page = o; await o.reload(); await o.getByRole('button', { name: 'Dismiss' }).first().click();
    await expect(o.getByText(/needs attention/)).toHaveCount(0);
    const r = await api('GET', '/owner/reminders', CURRY); c.note(`open reminders via API: ${r.data.items.filter((x) => !x.acknowledged_at && !x.resolved_at).length}`);
  });
  await test('O-06', 'Pizza owner: pending-return link + reminder', async (c) => {
    const pz = c.page = await loggedIn(PIZZA, '/owner/dashboard');
    const link = pz.getByRole('link', { name: /1 return request waiting for you/ });
    await expect(link).toBeVisible();
    await expect(pz.getByText(/Order #\d+ has been ACCEPTED for \d+ minutes/)).toBeVisible();
    await link.click(); await expect(pz).toHaveURL(/owner\/returns/);
    await pz.close();
  });

  // ---- orders
  const stale = (await api('GET', '/owner/orders?status=PLACED', CURRY)).data.items.find((x) => x.id !== o9);
  const custDash = await loggedIn(ASHA, '/customer/dashboard');
  await test('O-07', 'Owner order list', async (c) => {
    c.page = o; await o.goto(WEB + '/owner/orders');
    for (const t of ['Active', 'Completed']) await expect(o.getByRole('tab', { name: t }).or(o.getByRole('button', { name: t, exact: true })).first()).toBeVisible();
    await expect(o.getByLabel('Filter by status')).toBeVisible();
    const card = orderCard(o, stale.id);
    await expect(card).toContainText('Asha Rao'); await expect(card).toContainText('Dal Makhani'); await expect(card).toContainText('₹');
    await expect(card.getByRole('button', { name: 'Accept' })).toBeVisible();
  });
  await test('O-08', 'Accept stale order → reminder resolves', async (c) => {
    c.page = o; state.staleId = stale.id;
    await api('POST', '/owner/reminders', CURRY).catch(() => {});
    await orderCard(o, stale.id).getByRole('button', { name: 'Accept' }).click();
    await expect(orderCard(o, stale.id).getByRole('button', { name: 'Start preparing' })).toBeVisible();
    await expect(orderCard(o, stale.id)).toContainText('Accepted');
    const rem = (await api('GET', '/owner/reminders', CURRY)).data.items.filter((x) => x.order_id === stale.id && !x.resolved_at);
    c.note(`unresolved reminders for #${stale.id}: ${rem.length}`); expect(rem.length).toBe(0);
  });
  await test('C-27', 'Customer dashboard updates live (≤15 s)', async (c) => {
    c.page = custDash; const t0 = Date.now();
    await expect(custDash.locator('main').filter({ hasText: `Order #${stale.id}` }).getByText('Accepted', { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 20000 });
    c.note(`updated after ~${Math.round((Date.now() - t0) / 1000)} s of waiting`);
  });
  await test('C-21', 'No cancel button once accepted', async (c) => {
    c.page = cust; await cust.goto(WEB + `/orders/${stale.id}`);
    await expect(cust.getByText('Accepted', { exact: true }).first()).toBeVisible();
    await expect(cust.getByRole('button', { name: /cancel/i })).toHaveCount(0);
    const r = await api('POST', `/orders/${stale.id}/cancel`, ASHA); c.note(`API cancel after accept → ${r.status}`); expect(r.status).toBe(409);
  });
  await test('O-11', 'Owners have no Cancel/Reject buttons', async (c) => {
    c.page = o; await o.goto(WEB + '/owner/orders');
    await expect(o.locator('main').getByRole('button', { name: /cancel|reject/i })).toHaveCount(0);
  });
  await test('O-10', 'Start preparing → Mark ready', async (c) => {
    c.page = o; const card = orderCard(o, stale.id);
    await card.getByRole('button', { name: 'Start preparing' }).click();
    await expect(card.getByRole('button', { name: 'Mark ready' })).toBeVisible(); await expect(card).toContainText('Preparing');
    await card.getByRole('button', { name: 'Mark ready' }).click();
    await expect(card.getByRole('button', { name: 'Assign rider' })).toBeVisible();
  });
  await test('O-12', 'Assign a rider', async (c) => {
    c.page = o; await orderCard(o, stale.id).getByRole('button', { name: 'Assign rider' }).click();
    const dlg = o.getByRole('dialog'); await expect(dlg).toContainText(`Assign a rider to order #${stale.id}`);
    for (const t of ['Meena Shah', 'Arjun Das']) await expect(dlg).toContainText(t);
    const txt = await dlg.innerText(); c.note(`load badges: ${(txt.match(/Free|\d+ active/g) || []).join(', ')}`);
    expect(txt).toMatch(/Free|\d+ active/);
    await expect(dlg.getByRole('button', { name: 'Assign', exact: true })).toBeDisabled();
    await dlg.getByText('Meena Shah').click();
    await dlg.getByRole('button', { name: 'Assign', exact: true }).click();
    await toast(o, `Order #${stale.id} assigned`);
    await expect(orderCard(o, stale.id).or(o.locator('main').filter({ hasText: `Order #${stale.id}` })).getByText('Rider: Meena Shah').first()).toBeVisible();
    state.assignedToMeena = stale.id;
  });
  await test('O-13', 'Completed tab + filters', async (c) => {
    c.page = o; await o.getByRole('tab', { name: 'Completed' }).or(o.getByRole('button', { name: 'Completed', exact: true })).first().click();
    await o.getByLabel('Filter by status').selectOption({ label: 'Delivered' }); await sleep(900);
    const badges = await o.locator('main span').filter({ hasText: /^(Delivered|Cancelled|Refunded)$/ }).allInnerTexts();
    c.note(`badges: ${[...new Set(badges)].join(',')}`); expect(badges.length).toBeGreaterThan(0); expect(new Set(badges)).toEqual(new Set(['Delivered']));
    await o.getByLabel('From date').fill('2020-01-01'); await o.getByLabel('To date').fill('2020-01-02');
    await expect(o.getByText('No completed orders')).toBeVisible();
  });
  await test('O-14', 'Owner opens an order', async (c) => {
    c.page = o; await o.goto(WEB + `/orders/${stale.id}`);
    for (const t of ['Asha Rao', 'Hostel B', '9876543210']) await expect(o.getByText(t).first()).toBeVisible();
    await expect(o.getByText('Assigned', { exact: false }).first()).toBeVisible();
  });

  // ---- menu
  await test('O-15', 'Menu list incl. unavailable dishes', async (c) => {
    c.page = o; await o.goto(WEB + '/owner/menu');
    for (const d of ['Chicken Biryani', 'Gulab Jamun']) await expect(o.getByRole('switch', { name: `${d} available` })).toHaveAttribute('aria-checked', 'false');
    let edits = await o.getByRole('button', { name: 'Edit' }).count();
    await o.getByRole('button', { name: /Next/ }).click();
    await expect(o.getByRole('switch', { name: 'Paneer Tikka available' })).toHaveAttribute('aria-checked', 'true');
    edits += await o.getByRole('button', { name: 'Edit' }).count(); c.note(`Edit buttons across 2 pages: ${edits}`);
    expect(edits).toBe(12);
    await o.getByRole('button', { name: /Previous/ }).click();
  });
  await test('O-16', 'Owner menu search & availability filter', async (c) => {
    c.page = o; await o.locator('main input[type="search"], main input[placeholder*="earch"]').first().fill('naan'); await sleep(900);
    expect(await o.getByRole('switch').count()).toBe(2);
    await o.locator('main input[type="search"], main input[placeholder*="earch"]').first().fill(''); await sleep(700);
    await o.getByLabel('Availability').selectOption({ label: 'Unavailable' }); await sleep(900);
    const names = await o.getByRole('switch').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    c.note(names.join(', ')); expect(names.sort()).toEqual(['Chicken Biryani available', 'Gulab Jamun available']);
    await o.getByLabel('Availability').selectOption({ index: 0 });
  });
  await test('O-17', 'Add dish validation', async (c) => {
    c.page = o; await o.getByRole('button', { name: '+ Add dish' }).click();
    const dlg = o.getByRole('dialog'); await dlg.getByLabel('Price (₹)').fill('0');
    await dlg.getByRole('button', { name: 'Add dish' }).click();
    await expect(dlg.getByText('Name must be at least 2 characters')).toBeVisible();
    await expect(dlg.getByText('Price must be greater than 0')).toBeVisible();
  });
  const IMG = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/Dosa_at_Sri_Ganesha_Restauran%2C_Bangkok_%2844570742744%29.jpg/500px-Dosa_at_Sri_Ganesha_Restauran%2C_Bangkok_%2844570742744%29.jpg';
  await test('O-18', 'Add dish success (with photo preview)', async (c) => {
    c.page = o; const dlg = o.getByRole('dialog');
    await dlg.getByLabel('Name').fill('Masala Dosa'); await dlg.getByLabel('Category').fill('South Indian');
    await dlg.getByLabel('Price (₹)').fill('120'); await dlg.getByLabel('Image URL (optional)').fill(IMG);
    await expect(dlg.locator(`img[src="${IMG}"]`)).toBeVisible();
    await dlg.getByRole('button', { name: 'Add dish' }).click();
    await toast(o, 'Dish added');
    await expect(o.getByRole('switch', { name: 'Masala Dosa available' })).toBeVisible();
    await cust.goto(WEB + state.curryPath);
    await expect(cust.getByText('Masala Dosa').first()).toBeVisible();
    await expect(menuCard(cust, 'Masala Dosa').locator('img')).toHaveAttribute('src', IMG);
  });
  await test('O-19', 'Edit dish price', async (c) => {
    c.page = o; await o.locator('tr, li, div.card').filter({ hasText: 'Masala Dosa' }).getByRole('button', { name: 'Edit' }).last().click();
    const dlg = o.getByRole('dialog'); await dlg.getByLabel('Price (₹)').fill('130');
    await dlg.getByRole('button', { name: 'Save changes' }).click();
    await toast(o, 'Dish updated');
    await expect(o.locator('tr, li, div.card').filter({ hasText: 'Masala Dosa' }).last()).toContainText('130');
    await cust.reload(); await expect(menuCard(cust, 'Masala Dosa')).toContainText('130');
  });
  await test('O-20', 'Toggle availability', async (c) => {
    c.page = o; const sw = o.getByRole('switch', { name: 'Masala Dosa available' });
    await sw.click(); await expect(sw).toHaveAttribute('aria-checked', 'false');
    await toast(o, /Masala Dosa is now unavailable/);
    await cust.reload(); await expect(cust.getByRole('heading', { name: 'Paneer Tikka' }).or(cust.getByText('Paneer Tikka')).first()).toBeVisible();
    await expect(cust.getByText('Masala Dosa')).toHaveCount(0);
    await sw.click(); await expect(sw).toHaveAttribute('aria-checked', 'true');
    await cust.reload(); await expect(cust.getByText('Masala Dosa').first()).toBeVisible();
  });
  await test('O-21', 'Delete dish; past orders keep snapshot', async (c) => {
    c.page = o; const dish = (await api('GET', '/owner/menu-items?search=Masala', CURRY)).data.items.find((d) => d.name === 'Masala Dosa');
    const r = await api('POST', '/orders', ASHA, { restaurant_id: 1, items: [{ menu_item_id: dish.id, quantity: 1 }], delivery_address: 'Hostel B, Room 214', contact_phone: '9876543210' });
    const oid = r.data.id; c.note(`order with dish → ${r.status} #${oid} (dish ${dish.name} ${dish.id})`);
    await o.locator('tr, li, div.card').filter({ hasText: 'Masala Dosa' }).getByRole('button', { name: 'Delete' }).last().click();
    const dlg = o.getByRole('dialog'); await expect(dlg).toContainText('Delete dish?');
    await dlg.getByRole('button', { name: 'Delete' }).click();
    await expect(o.getByRole('switch', { name: 'Masala Dosa available' })).toHaveCount(0);
    await cust.goto(WEB + `/orders/${oid}`);
    await expect(cust.getByText('Masala Dosa').first()).toBeVisible(); await expect(cust.getByText('₹130').first()).toBeVisible();
    await api('POST', `/orders/${oid}/cancel`, ASHA);
  });
  await test('O-22', 'Owner sees only own menu', async (c) => {
    const pz = c.page = await loggedIn(PIZZA, '/owner/menu');
    await expect(pz.getByRole('switch', { name: 'Margherita available' })).toBeVisible();
    await expect(pz.getByText('Paneer Tikka')).toHaveCount(0);
    expect(await pz.getByRole('switch').count()).toBe(10);
    await pz.close();
  });

  // ---- O-09 continued: after the window, Accept + prep for E2E later
  await test('O-09b', 'After 60 s the button becomes Accept', async (c) => {
    c.page = o; if (!o9) throw new Blocked('no order');
    const wait = 61500 - (Date.now() - state.o9At); if (wait > 0) await sleep(wait);
    await o.goto(WEB + '/owner/orders');
    const card = orderCard(o, o9);
    await expect(card.getByRole('button', { name: 'Accept' })).toBeEnabled({ timeout: 10000 });
    await card.getByRole('button', { name: 'Accept' }).click();
    await expect(card.getByRole('button', { name: 'Start preparing' })).toBeVisible();
  });

  // ---- returns
  const pz = await loggedIn(PIZZA, '/owner/returns');
  await test('O-23', 'Pending return list', async (c) => {
    c.page = pz; const card = pz.locator('main').filter({ hasText: 'Asha' });
    await expect(pz.getByText('Asha Rao').first()).toBeVisible();
    await expect(pz.getByText(/The pizza arrived cold and the garlic bread was missing\./).first()).toBeVisible();
    await expect(pz.getByText('Farmhouse').first()).toBeVisible();
  });
  await test('O-24', 'Reject needs a note', async (c) => {
    c.page = pz; await pz.getByRole('button', { name: 'Reject', exact: true }).first().click();
    const dlg = pz.getByRole('dialog'); await dlg.getByRole('button', { name: 'Reject request' }).click();
    await expect(dlg.getByText('Please explain your decision (at least 5 characters)')).toBeVisible();
    await dlg.getByRole('button', { name: /cancel/i }).click();
  });
  await test('O-25', 'Approve refund', async (c) => {
    c.page = pz; const ret = (await api('GET', '/owner/returns?status=requested', PIZZA)).data.items[0]; state.approvedOrder = ret.order_id;
    await pz.getByRole('button', { name: 'Approve refund' }).first().click();
    const dlg = pz.getByRole('dialog'); await expect(dlg).toContainText('Approve refund?');
    await dlg.getByRole('button', { name: 'Approve & refund' }).click();
    await toast(pz, /Refund of ₹[\d.,]+ issued/);
    await pz.getByRole('tab', { name: 'Approved' }).or(pz.getByRole('button', { name: 'Approved', exact: true })).first().click();
    await expect(pz.getByText(`#${ret.order_id}`).first()).toBeVisible();
    await cust.goto(WEB + `/orders/${ret.order_id}`);
    for (const t of ['Refunded', 'Payment refunded', 'Return approved']) await expect(cust.getByText(t, { exact: true }).first()).toBeVisible();
    await expect(cust.getByText(/refunded \(demo\)/).first()).toBeVisible();
    const d = (await api('GET', `/orders/${ret.order_id}`, ASHA)).data; expect(d.timeline.at(-1).to_status).toBe('REFUNDED');
  });
  await test('O-26', 'Reject with a note', async (c) => {
    if (!state.returnOrder1) throw new Blocked('C-33 return not created');
    const od = (await api('GET', `/orders/${state.returnOrder1}`, ASHA)).data;
    const ow = c.page = await loggedIn(OWNER_OF[od.restaurant.name], '/owner/returns');
    await ow.locator('main').filter({ hasText: `#${od.id}` }).getByRole('button', { name: 'Reject', exact: true }).first().click();
    const dlg = ow.getByRole('dialog'); await dlg.locator('textarea').fill('Photos show all items delivered');
    await dlg.getByRole('button', { name: 'Reject request' }).click();
    await toast(ow, `Return for order #${od.id} rejected`);
    await ow.getByRole('tab', { name: 'Rejected' }).or(ow.getByRole('button', { name: 'Rejected', exact: true })).first().click();
    await expect(ow.getByText(/Your note:/).first()).toBeVisible();
    await cust.goto(WEB + `/orders/${od.id}`);
    await expect(cust.getByText('Return rejected').first()).toBeVisible();
    await expect(cust.getByText('Photos show all items delivered').first()).toBeVisible();
    await expect(cust.getByText('Delivered', { exact: true }).first()).toBeVisible();
    await expect(cust.getByText('Paid (demo)').first()).toBeVisible();
  });
  await test('O-27', 'Returns filters', async (c) => {
    c.page = pz; await pz.reload();
    for (const [tab, expectEmpty] of [['Waiting', true], ['Approved', false], ['Rejected', true], ['All', false]]) {
      await pz.getByRole('tab', { name: tab }).or(pz.getByRole('button', { name: tab, exact: true })).first().click(); await sleep(700);
      const empty = await pz.getByText(/Nothing here/).count();
      c.note(`${tab}: ${empty ? 'empty' : 'has items'}`);
      expect(Boolean(empty)).toBe(expectEmpty);
    }
  });
}
