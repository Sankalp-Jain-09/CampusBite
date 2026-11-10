import { WEB, Blocked, api, expect, loggedIn, section, sleep, state, test, toast } from './lib.mjs';

const MEENA = 'rider.one@campusbite.dev';
const ARJUN = 'rider.two@campusbite.dev';
const ROHAN = 'demo.customer2@campusbite.dev';
const card = (p, id) => p.locator('main li, main article, main div.card').filter({ hasText: `#${id}` }).filter({ has: p.getByRole('button') }).last();

export async function run() {
  section('5. Delivery partner');
  const m = await loggedIn(MEENA, '/delivery/dashboard');
  await test('D-01', 'Active deliveries (Meena)', async (c) => {
    c.page = m; await expect(m.getByText('Hi Meena, your deliveries')).toBeVisible();
    const ofd = (await api('GET', '/delivery/orders', MEENA)).data.items.find((o) => o.status === 'OUT_FOR_DELIVERY');
    if (!ofd) throw new Blocked('no out-for-delivery order for Meena');
    const k = card(m, ofd.id);
    for (const t of ['Pick up', 'Deliver to', 'Campus Curry House', 'Asha Rao', 'Hostel B']) await expect(k).toContainText(t);
    await expect(k.locator('a[href^="tel:"]').first()).toBeVisible();
  });
  const a = await loggedIn(ARJUN, '/delivery/dashboard');
  const arjunOrders = (await api('GET', '/delivery/orders', ARJUN)).data.items;
  await test('D-02', 'Rider sees only own orders', async (c) => {
    c.page = a; await expect(a.getByText('Hi Arjun, your deliveries')).toBeVisible();
    await expect(a.getByText('Green Bowl').first()).toBeVisible();
    await expect(a.getByText(/Rider assigned/).first()).toBeVisible();
    const meenas = (await api('GET', '/delivery/orders', MEENA)).data.items.map((o) => o.id);
    for (const id of meenas) await expect(a.getByText(`#${id}`, { exact: false })).toHaveCount(0);
    c.note(`Arjun: ${arjunOrders.map((o) => '#' + o.id).join(',')}; Meena: ${meenas.map((x) => '#' + x).join(',')}`);
  });
  await test('D-03', 'Filter chips', async (c) => {
    c.page = m; const n = async () => m.getByRole('button', { name: /Picked up|Mark delivered/ }).count();
    const all = await n();
    await m.getByRole('button', { name: 'To pick up' }).click(); await sleep(800);
    const pick = await m.getByRole('button', { name: /Picked up/ }).count(); const mark1 = await m.getByRole('button', { name: /Mark delivered/ }).count();
    await m.getByRole('button', { name: 'On the way' }).click(); await sleep(800);
    const pick2 = await m.getByRole('button', { name: /Picked up/ }).count(); const mark2 = await m.getByRole('button', { name: /Mark delivered/ }).count();
    c.note(`all=${all}; to-pick-up: ${pick} pick/${mark1} deliver; on-the-way: ${pick2} pick/${mark2} deliver`);
    expect(mark1).toBe(0); expect(pick2).toBe(0); expect(pick).toBeGreaterThan(0); expect(mark2).toBeGreaterThan(0);
    await m.getByRole('button', { name: /All active/ }).click();
  });
  const target = arjunOrders.find((o) => o.status === 'ASSIGNED');
  await test('D-04', 'Picked up → Out for delivery', async (c) => {
    c.page = a; if (!target) throw new Blocked('Arjun has no ASSIGNED order');
    state.arjunOrder = target.id;
    await card(a, target.id).getByRole('button', { name: 'Picked up · Out for delivery' }).click();
    await a.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await toast(a, `Order #${target.id} is out for delivery`);
    await expect(card(a, target.id).getByRole('button', { name: 'Mark delivered' })).toBeVisible();
  });
  await test('D-05', 'Mark delivered', async (c) => {
    c.page = a; if (!target) throw new Blocked('no order');
    await card(a, target.id).getByRole('button', { name: 'Mark delivered' }).click();
    await a.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await toast(a, `Order #${target.id} delivered`);
    await expect(a.getByText('No deliveries right now')).toBeVisible();
  });
  await test('D-06', 'Delivery history', async (c) => {
    c.page = a; await a.getByRole('link', { name: 'History' }).click();
    await expect(a.getByText('Delivery history')).toBeVisible();
    const cnt = a.getByText(/\d+ completed deliver(y|ies)/); await expect(cnt).toBeVisible(); c.note(await cnt.innerText());
    await expect(a.getByText(`#${target?.id}`).first()).toBeVisible();
    const dates = a.locator('input[type="date"]');
    await dates.nth(0).fill('2020-01-01'); await dates.nth(1).fill('2020-01-02'); await sleep(900);
    await expect(a.getByText(/0 completed deliveries|No deliveries|No completed/).first()).toBeVisible();
  });
  await test('D-07', 'Customer sees Delivered + review/return', async (c) => {
    const r = c.page = await loggedIn(ROHAN, `/orders/${target?.id}`); if (!target) throw new Blocked('no order');
    await expect(r.getByText('Delivered', { exact: true }).first()).toBeVisible();
    await expect(r.getByRole('button', { name: 'Submit review' })).toBeVisible();
    await expect(r.getByRole('button', { name: 'Request return / refund' })).toBeVisible();
    const d = (await api('GET', `/orders/${target.id}`, ROHAN)).data;
    c.note(`timeline: ${d.timeline.map((t) => t.to_status).join('→')}`);
    expect(d.timeline.map((t) => t.to_status)).toEqual(['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED']);
  });
  await test('D-08', 'Phone link is tel:', async (c) => {
    c.page = m; await m.goto(WEB + '/delivery/dashboard');
    const href = await m.locator('a[href^="tel:"]').first().getAttribute('href'); c.note(href);
    expect(href).toMatch(/^tel:\+?\d{10,15}$/);
  });
}
