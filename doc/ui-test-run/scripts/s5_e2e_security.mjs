import { WEB, API, Blocked, api, apiLogin, expect, injectAuth, loggedIn, newWindow, section, sleep, state, test, toast, uiLogin } from './lib.mjs';
import { menuCard } from './s2_customer.mjs';

const ASHA = 'demo.customer@campusbite.dev';
const CURRY = 'owner.curry@campusbite.dev';
const MEENA = 'rider.one@campusbite.dev';
const oc = (p, id) => p.locator('main li, main article, main div.card').filter({ hasText: `#${id}` }).filter({ has: p.getByRole('button') }).last();

export async function run() {
  section('6. End-to-end (3 roles)');
  const cu = await loggedIn(ASHA, '/');
  const ow = await loggedIn(CURRY, '/owner/orders');
  const ri = await loggedIn(MEENA, '/delivery/dashboard');
  const statsBefore = (await api('GET', '/owner/stats', CURRY)).data;
  let id = null, placedAt = 0;

  await test('E-01', 'Customer orders Paneer Tikka ×2 + Butter Naan ×2 and pays', async (c) => {
    c.page = cu; await cu.goto(WEB + state.curryPath);
    await menuCard(cu, 'Paneer Tikka').getByRole('button', { name: /^add/i }).click();
    await cu.getByRole('button', { name: 'Add one Paneer Tikka' }).first().click();
    await menuCard(cu, 'Butter Naan').getByRole('button', { name: /^add/i }).click();
    await cu.getByRole('button', { name: 'Add one Butter Naan' }).first().click();
    await cu.goto(WEB + '/checkout');
    await cu.getByRole('button', { name: 'Pay ₹470.00 & place order' }).click();
    await expect(cu).toHaveURL(/\/orders\/\d+/); id = Number(cu.url().match(/(\d+)$/)[1]); placedAt = Date.now(); state.e2e = id;
    c.note(`order #${id}`);
  });
  await test('E-02', 'Owner sees "Awaiting customer", then Accept', async (c) => {
    c.page = ow; if (!id) throw new Blocked('no order'); await ow.reload();
    await expect(oc(ow, id).getByRole('button', { name: /Awaiting customer/ })).toBeVisible({ timeout: 20000 });
    await sleep(Math.max(0, 61500 - (Date.now() - placedAt)));
    await expect(oc(ow, id).getByRole('button', { name: 'Accept' })).toBeEnabled({ timeout: 10000 });
    await oc(ow, id).getByRole('button', { name: 'Accept' }).click();
    await expect(oc(ow, id).getByRole('button', { name: 'Start preparing' })).toBeVisible();
  });
  await test('E-03', 'Customer sees Accepted within ~15 s, no cancel', async (c) => {
    c.page = cu; const t0 = Date.now();
    await expect(cu.getByRole('button', { name: /cancel/i })).toHaveCount(0, { timeout: 25000 });
    c.note(`order page dropped the cancel button ${Math.round((Date.now() - t0) / 1000)} s after the owner accepted`);
    const d = (await api('GET', `/orders/${id}`, ASHA)).data; expect(d.status).toBe('ACCEPTED');
  });
  await test('E-04', 'Owner prepares, marks ready, assigns Meena', async (c) => {
    c.page = ow; await oc(ow, id).getByRole('button', { name: 'Start preparing' }).click();
    await oc(ow, id).getByRole('button', { name: 'Mark ready' }).click();
    await oc(ow, id).getByRole('button', { name: 'Assign rider' }).click();
    const dlg = ow.getByRole('dialog'); await dlg.getByText('Meena Shah').click();
    await dlg.getByRole('button', { name: 'Assign', exact: true }).click();
    await toast(ow, `Order #${id} assigned`);
  });
  await test('E-05', 'Rider picks up and delivers', async (c) => {
    c.page = ri; await ri.reload();
    await oc(ri, id).getByRole('button', { name: 'Picked up · Out for delivery' }).click();
    await ri.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await oc(ri, id).getByRole('button', { name: 'Mark delivered' }).click();
    await ri.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await toast(ri, `Order #${id} delivered`);
  });
  await test('E-06', 'Customer: Delivered → 5★ review → return request', async (c) => {
    c.page = cu; await expect(cu.getByText('Delivered', { exact: true }).first()).toBeVisible({ timeout: 20000 });
    await cu.getByRole('radio', { name: '5 stars' }).click(); await cu.getByRole('button', { name: 'Submit review' }).click();
    await toast(cu, 'Thanks for your review!');
    await cu.getByRole('button', { name: 'Request return / refund' }).click();
    await cu.getByRole('dialog').locator('textarea').fill('E2E: the naan was missing from the bag.');
    await cu.getByRole('dialog').getByRole('button', { name: 'Send request' }).click();
    await toast(cu, 'Return request sent to the restaurant');
  });
  let spentBefore = null;
  await test('E-07', 'Owner approves the refund', async (c) => {
    c.page = ow; const ai = (await api('POST', '/ai/insights', ASHA, { question: 'How much did I spend this week?' })).data;
    spentBefore = ai?.answer?.match(/this week: ₹([\d.]+)/)?.[1];
    await ow.goto(WEB + '/owner/returns');
    await ow.locator('main').filter({ hasText: `#${id}` }).getByRole('button', { name: 'Approve refund' }).first().click();
    await ow.getByRole('dialog').getByRole('button', { name: 'Approve & refund' }).click();
    await toast(ow, /Refund of ₹470(\.00)? issued/);
  });
  await test('E-08', 'Customer sees Refunded; AI spend reflects refund', async (c) => {
    c.page = cu; await cu.reload();
    await expect(cu.getByText('Refunded', { exact: true }).first()).toBeVisible();
    await expect(cu.getByText(/₹470(\.00)? refunded \(demo\)/).first()).toBeVisible();
    const ai = await loggedIn(ASHA, '/customer/ai-insights'); c.page = ai;
    await ai.getByRole('button', { name: 'How much did I spend this week?' }).click();
    const ans = ai.getByText(/Spent this week: ₹[\d.]+/); await expect(ans).toBeVisible();
    const after = (await ans.innerText()).match(/this week: ₹([\d.]+)/)[1];
    c.note(`week spend before refund ₹${spentBefore} → after ₹${after}`);
    expect(Number(spentBefore) - Number(after)).toBeCloseTo(470, 1);
  });
  await test('E-09', 'Owner stats update', async (c) => {
    c.page = ow; await ow.goto(WEB + '/owner/dashboard');
    const s = (await api('GET', '/owner/stats', CURRY)).data;
    const pick = (o) => ({ total: o.total_orders, refunded: o.refunded_orders ?? o.orders_by_status?.REFUNDED, reviews: o.review_count, rating: o.avg_rating, revenue: o.net_revenue });
    c.note(`before ${JSON.stringify(pick(statsBefore))} after ${JSON.stringify(pick(s))}`);
    expect(s.total_orders).toBeGreaterThan(statsBefore.total_orders);
    expect(s.review_count).toBe(statsBefore.review_count + 1);
    await expect(ow.getByText(`${s.total_orders}`, { exact: true }).first()).toBeVisible();
  });

  section('7. Security & role protection');
  const C = await loggedIn(ASHA, '/');
  for (const [tid, path] of [['R-01', '/owner/dashboard'], ['R-02', '/delivery/dashboard']]) {
    await test(tid, `Customer opens ${path} → 403 page`, async (c) => {
      c.page = C; await C.goto(WEB + path);
      await expect(C.getByText(/403/).first()).toBeVisible(); await expect(C.getByText(/You don't have access to this page/)).toBeVisible();
    });
  }
  await test('R-03', 'Owner opens /checkout → 403', async (c) => {
    const p = c.page = await loggedIn(CURRY, '/checkout');
    await expect(p.getByText(/You don't have access to this page/)).toBeVisible();
  });
  await test('R-04', 'Rider opens /owner/menu → 403', async (c) => {
    const p = c.page = await loggedIn(MEENA, '/owner/menu');
    await expect(p.getByText(/You don't have access to this page/)).toBeVisible();
  });
  await test('R-05', 'Owner/rider opening / → own dashboard', async (c) => {
    const p = c.page = await loggedIn(CURRY, '/'); await expect(p).toHaveURL(/owner\/dashboard/);
    const q = await loggedIn(MEENA, '/'); await expect(q).toHaveURL(/delivery\/dashboard/);
  });
  await test('R-06', 'Navbar links per role', async (c) => {
    const expectLinks = { [ASHA]: ['Restaurants', 'My orders', 'AI insights', 'Cart'], [CURRY]: ['Dashboard', 'Orders', 'Menu', 'Returns'], [MEENA]: ['Deliveries', 'History'] };
    for (const [email, links] of Object.entries(expectLinks)) {
      const p = c.page = await loggedIn(email, '/');
      const got = (await p.locator('header a').filter({ visible: true }).allInnerTexts()).map((t) => t.replace(/\d+$/, '').trim()).filter((t) => t && t !== 'CampusBite' && t !== 'CBCampusBite' && !/^CB/.test(t));
      c.note(`${email.split('@')[0]}: ${got.join('/')}`);
      expect(got).toEqual(links);
    }
  });
  await test('R-07', "owner.green opens a Curry order → not found", async (c) => {
    const p = c.page = await loggedIn('owner.green@campusbite.dev', `/orders/${state.e2e || 1}`);
    await expect(p.getByText('Order not found')).toBeVisible();
  });
  await test('R-08', "rider.two opens Meena's delivery → not found", async (c) => {
    const p = c.page = await loggedIn('rider.two@campusbite.dev', `/orders/${state.e2e || state.ofdOrder}`);
    await expect(p.getByText('Order not found')).toBeVisible();
  });
  await test('R-09', 'Two tabs: second login switches the first tab', async (c) => {
    const t1 = c.page = await newWindow(); await uiLogin(t1, CURRY); await expect(t1).toHaveURL(/owner\/dashboard/);
    const t2 = await t1.context().newPage(); await t2.goto(WEB + '/login');
    await expect(t2).toHaveURL(/owner\/dashboard/);   // already logged in as owner in this window
    await t2.getByRole('button', { name: /log out/i }).first().click();
    await uiLogin(t2, ASHA); await expect(t2).toHaveURL(WEB + '/');
    await expect(t1).toHaveURL(WEB + '/', { timeout: 8000 });
    await expect(t1.getByText('Asha Rao').first()).toBeVisible();
    await expect(t1.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
  });
  await test('R-10', 'API: customer token → /owner/stats 403', async (c) => {
    const r = await api('GET', '/owner/stats', ASHA); c.note(`status ${r.status}: ${r.data?.detail}`); expect(r.status).toBe(403);
    const n = await api('GET', '/owner/stats', null); c.note(`no token → ${n.status}`); expect(n.status).toBe(401);
  });
}
