import fs from 'node:fs';
import { WEB, API, Blocked, api, backendLogPath, expect, loggedIn, newWindow, section, sleep, startBackend, state, stopBackend, test, toast } from './lib.mjs';
import { menuCard } from './s2_customer.mjs';

const ASHA = 'demo.customer@campusbite.dev';
const CURRY = 'owner.curry@campusbite.dev';
const MEENA = 'rider.one@campusbite.dev';
const noHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

export async function run() {
  section('8. Responsive / mobile (390×844)');
  const m = await loggedIn(ASHA, '/', { mobile: true });
  await test('M-01', 'Hamburger menu', async (c) => {
    c.page = m; const t = m.getByRole('button', { name: 'Toggle menu' });
    await expect(t).toBeVisible();
    await expect(m.getByRole('link', { name: 'My orders' }).filter({ visible: true })).toHaveCount(0);
    await expect(m.getByRole('link', { name: /^Cart, / }).filter({ visible: true }).first()).toBeVisible();
    await t.click();
    for (const l of ['Restaurants', 'My orders', 'AI insights']) await expect(m.getByRole('link', { name: l }).filter({ visible: true }).first()).toBeVisible();
    await expect(m.getByText('Asha Rao').filter({ visible: true }).first()).toBeVisible();
    await expect(m.getByRole('button', { name: /log out/i }).filter({ visible: true }).first()).toBeVisible();
    await t.click();
  });
  await test('M-02', 'One-column cards; no sideways scroll on any page', async (c) => {
    c.page = m; await m.goto(WEB); await expect(m.locator('a[href^="/restaurants/"]').first()).toBeVisible();
    const xs = await m.locator('a[href^="/restaurants/"]').evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().left)))]);
    c.note(`card x positions: ${xs.join(',')}`); expect(xs.length).toBe(1);
    const pages = { [ASHA]: ['/', state.curryPath || '/restaurants/1', '/cart', '/customer/dashboard', '/customer/ai-insights', `/orders/${state.e2e || 1}`],
      [CURRY]: ['/owner/dashboard', '/owner/orders', '/owner/menu', '/owner/returns'], [MEENA]: ['/delivery/dashboard', '/delivery/history'] };
    const bad = [];
    for (const [email, paths] of Object.entries(pages)) {
      const p = await loggedIn(email, '/', { mobile: true });
      for (const path of paths) { await p.goto(WEB + path); await sleep(900); if (!(await noHScroll(p))) bad.push(path); }
      await p.close();
    }
    c.note(`checked ${Object.values(pages).flat().length} pages; overflowing: ${bad.join(', ') || 'none'}`);
    expect(bad).toEqual([]);
  });
  await test('M-03', 'Menu: stacked filters + sticky cart bar', async (c) => {
    c.page = m; await m.goto(WEB + (state.curryPath || '/restaurants/1'));
    const s = await m.getByPlaceholder('Search dishes…').boundingBox(); const mn = await m.getByPlaceholder('Min ₹').boundingBox();
    expect(mn.y).toBeGreaterThan(s.y + s.height - 1);
    await menuCard(m, 'Butter Naan').getByRole('button', { name: /^add/i }).click();
    const bar = m.getByText(/\d+ items? · ₹[\d.,]+/).filter({ visible: true }).first();
    await expect(bar).toBeVisible(); await expect(m.getByText('View cart →').filter({ visible: true })).toBeVisible();
    await m.mouse.wheel(0, 3000); await sleep(400);
    const box = await m.getByText('View cart →').filter({ visible: true }).boundingBox();
    c.note(`bar text "${await bar.innerText()}", bottom at ${Math.round(box.y + box.height)}/844`);
    expect(box.y + box.height).toBeGreaterThan(780);
  });
  await test('M-04', 'Owner menu becomes cards', async (c) => {
    const p = c.page = await loggedIn(CURRY, '/owner/menu', { mobile: true });
    await expect(p.locator('table').filter({ visible: true })).toHaveCount(0);
    await expect(p.getByRole('switch').filter({ visible: true }).first()).toBeVisible();
    await expect(p.getByRole('button', { name: 'Edit' }).filter({ visible: true }).first()).toBeVisible();
    await expect(p.getByRole('button', { name: 'Delete' }).filter({ visible: true }).first()).toBeVisible();
    expect(await p.locator('main img').filter({ visible: true }).count()).toBeGreaterThan(0);
  });
  await test('M-05', 'Dialogs open as bottom sheets with big tap targets', async (c) => {
    c.page = m; await m.goto(WEB + `/orders/${state.reviewedOrder || 1}`);
    const p = await loggedIn(CURRY, '/owner/menu', { mobile: true }); c.page = p;
    await p.getByRole('button', { name: 'Delete' }).filter({ visible: true }).first().click();
    const dlg = p.getByRole('dialog'); await expect(dlg).toBeVisible(); await sleep(400);
    const b = await dlg.boundingBox();
    const btns = await dlg.getByRole('button').evaluateAll((els) => els.map((e) => [e.getAttribute('aria-label') || e.innerText.trim(), Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)]));
    c.note(`dialog y=${Math.round(b.y)} h=${Math.round(b.height)} bottom=${Math.round(b.y + b.height)}; buttons ${btns.map(([n, w, h]) => `"${n}" ${w}×${h}`).join(', ')}`);
    expect(b.y + b.height).toBeGreaterThan(830);
    const actions = btns.filter(([n]) => n !== 'Close');
    expect(Math.min(...actions.map(([, , h]) => h))).toBeGreaterThanOrEqual(40);
    await dlg.getByRole('button', { name: /cancel/i }).click();
  });
  await test('M-06', 'Checkout, order details, AI chat usable on a phone', async (c) => {
    c.page = m; const small = [];
    for (const path of ['/checkout', `/orders/${state.e2e || 1}`, '/customer/ai-insights']) {
      await m.goto(WEB + path); await sleep(900);
      expect(await noHScroll(m)).toBe(true);
      const tiny = await m.locator('main button').filter({ visible: true }).evaluateAll((els) => els.map((e) => [e.innerText.trim().slice(0, 20), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 36));
      if (tiny.length) small.push(`${path}: ${tiny.map(([t, h]) => `"${t}" ${h}px`).join(', ')}`);
    }
    await expect(m.getByLabel('Your question')).toBeVisible();
    c.note(small.length ? `buttons under 36px: ${small.join(' | ')}` : 'all buttons ≥36px');
  });

  section('9. UX states');
  await test('U-01', 'Loading spinner on a slow network', async (c) => {
    const p = c.page = await loggedIn(ASHA, '/');
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 2000, downloadThroughput: 50000, uploadThroughput: 50000 });
    await p.getByRole('link', { name: 'My orders' }).first().click();
    await expect(p.getByText(/Loading/).first()).toBeVisible({ timeout: 3000 });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  });
  await test('U-04', 'No double submit (button busy while request runs)', async (c) => {
    const p = c.page = await loggedIn(ASHA, state.curryPath || '/restaurants/1');
    await menuCard(p, 'Garlic Naan').getByRole('button', { name: /^add/i }).click();
    await p.goto(WEB + '/checkout');
    const before = (await api('GET', '/orders/me?size=1', ASHA)).data.total;
    const cdp = await p.context().newCDPSession(p); await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 1500, downloadThroughput: -1, uploadThroughput: -1 });
    const pay = p.getByRole('button', { name: /^Pay ₹/ });
    await pay.click(); await pay.click({ force: true, timeout: 1000 }).catch(() => {}); await pay.dblclick({ force: true, timeout: 1000 }).catch(() => {});
    const disabled = await p.getByRole('button', { name: /Pay ₹|Processing|Placing/ }).first().isDisabled().catch(() => null);
    await expect(p).toHaveURL(/\/orders\/\d+/, { timeout: 15000 });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const after = (await api('GET', '/orders/me?size=1', ASHA)).data.total;
    c.note(`button disabled while busy: ${disabled}; orders created by 4 clicks: ${after - before}`);
    expect(after - before).toBe(1);
    const oid = Number(p.url().match(/(\d+)$/)[1]); await api('POST', `/orders/${oid}/cancel`, ASHA);
  });
  await test('U-05', 'Toasts auto-dismiss and can be closed', async (c) => {
    const p = c.page = await loggedIn(CURRY, '/owner/dashboard');
    await p.getByRole('button', { name: 'Close for now' }).click();
    const t1 = p.getByText('Restaurant is now closed'); await expect(t1).toBeVisible();
    const t0 = Date.now(); await expect(t1).toHaveCount(0, { timeout: 12000 }); c.note(`auto-dismissed after ~${Math.round((Date.now() - t0) / 1000)} s`);
    await p.getByRole('button', { name: 'Open restaurant' }).click();
    const t2 = p.getByText('Restaurant is now open for orders'); await expect(t2).toBeVisible();
    await p.locator('[role="status"], [role="alert"], div').filter({ hasText: 'Restaurant is now open for orders' }).last().getByRole('button').first().click();
    await expect(t2).toHaveCount(0, { timeout: 1500 });
  });
  await test('U-06', 'Broken image falls back to a letter tile', async (c) => {
    const p = c.page = await loggedIn(CURRY, '/owner/menu');
    const dish = (await api('GET', '/owner/menu-items?search=Butter%20Naan', CURRY)).data.items.find((d) => d.name === 'Butter Naan');
    await p.locator('tr, li, div.card').filter({ hasText: 'Butter Naan' }).getByRole('button', { name: 'Edit' }).first().click();
    const dlg = p.getByRole('dialog'); await dlg.getByLabel('Image URL (optional)').fill('https://example.com/broken.jpg');
    await dlg.getByRole('button', { name: 'Save changes' }).click(); await toast(p, 'Dish updated');
    const cu = await loggedIn(ASHA, state.curryPath || '/restaurants/1'); c.page = cu; await sleep(2500);
    const card = menuCard(cu, 'Butter Naan');
    await expect(card.locator('img')).toHaveCount(0);
    await expect(card.getByText('B', { exact: true })).toBeVisible();
    await api('PUT', `/owner/menu-items/${dish.id}`, CURRY, { image_url: dish.image_url });
  });
  await test('U-03', 'Empty states (new owner / rider / customer)', async (c) => {
    if (!state.newOwner) throw new Blocked('accounts from section 2 missing');
    const o = c.page = await loggedIn(state.newOwner, '/owner/menu', { password: 'Secret123' });
    await expect(o.getByText('Your menu is empty')).toBeVisible();
    const r = c.page = await loggedIn(state.newRider, '/delivery/dashboard', { password: 'Secret123' });
    await expect(r.getByText('No deliveries right now')).toBeVisible();
    const cu = c.page = await loggedIn(state.newCustomer, '/customer/dashboard', { password: 'Secret123' });
    await expect(cu.getByText('No current orders')).toBeVisible();
  });
  await test('U-02', 'Backend down → error box → Try again recovers', async (c) => {
    const p = c.page = await loggedIn(ASHA, '/'); await expect(p.getByText(/restaurants?$/).first()).toBeVisible();
    await stopBackend();
    await p.getByRole('link', { name: 'My orders' }).first().click();   // in-app navigation, no reload
    await expect(p.getByText('Cannot reach the server. Is the backend running?')).toBeVisible({ timeout: 15000 });
    await expect(p.getByRole('button', { name: /log out/i }).first()).toBeVisible();
    await startBackend();
    await p.getByRole('button', { name: 'Try again' }).first().click();
    await expect(p.getByText(/Order #\d+/).first()).toBeVisible();
  });
  await test('X-37', 'Reloading while the backend is down keeps the user logged in', async (c) => {
    const p = c.page = await loggedIn(ASHA, '/customer/dashboard'); await expect(p.getByText(/Order #\d+/).first()).toBeVisible();
    await stopBackend();
    await p.reload(); await sleep(2500);
    const token = await p.evaluate(() => localStorage.getItem('campusbite_token'));
    c.note(`after reload with server down: URL ${p.url().replace(WEB, '')}, token in storage: ${Boolean(token)}`);
    await startBackend();
    expect(token).toBeTruthy();
    await expect(p).not.toHaveURL(/\/login/);
  });

  section('10. Backend features');
  await test('B-01', 'Request logging line per request', async (c) => {
    const log = fs.readFileSync(backendLogPath, 'utf8').split('\n');
    const line = log.reverse().find((l) => /GET \/api\/v1\/restaurants\S* 200 [\d.]+ms request_id=/.test(l));
    c.note(line ? line.trim().slice(0, 160) : 'no matching line');
    expect(line).toBeTruthy();
    const r = await fetch(`${API}/health`); c.note(`X-Request-ID header: ${r.headers.get('x-request-id')}`);
  });
  await test('B-03', 'Swagger docs list endpoint groups', async (c) => {
    const spec = await (await fetch('http://localhost:8000/openapi.json')).json();
    const tags = [...new Set(Object.values(spec.paths).flatMap((p) => Object.values(p).flatMap((op) => op.tags || [])))];
    const ops = Object.values(spec.paths).reduce((n, p) => n + Object.keys(p).length, 0);
    c.note(`${ops} operations; tags: ${tags.join(', ')}`);
    for (const t of ['Auth', 'Restaurants', 'Orders', 'AI insights']) expect(tags.join('|')).toContain(t);
    const p = c.page = await newWindow(); await p.goto('http://localhost:8000/docs'); await expect(p.getByText(/CampusBite/).first()).toBeVisible({ timeout: 15000 });
  });
  await test('C-40', 'AI without an API key', async (c) => {
    await startBackend({ OPENAI_API_KEY: '' });
    const p = c.page = await loggedIn(ASHA, '/customer/ai-insights');
    await p.getByRole('button', { name: 'How much did I spend this week?' }).click();
    const e = p.getByText(/AI insights are not configured/); await expect(e).toBeVisible(); c.note(await e.innerText());
    await p.getByRole('link', { name: 'My orders' }).first().click(); await expect(p.getByText(/Order #\d+/).first()).toBeVisible();
  });
  await test('B-02', 'Reminder worker creates a reminder by itself', async (c) => {
    await startBackend({ REMINDER_THRESHOLD_MINUTES: '1', REMINDER_CHECK_INTERVAL_SECONDS: '10', CANCEL_GRACE_SECONDS: '5' });
    const placed = await api('POST', '/orders', ASHA, { restaurant_id: 3, items: [{ menu_item_id: 25, quantity: 1 }], delivery_address: 'Hostel B, Room 214', contact_phone: '9876543210' });
    if (placed.status !== 201) throw new Error(`could not place order: ${placed.status} ${JSON.stringify(placed.data)}`);
    const oid = placed.data.id;
    const p = c.page = await loggedIn('owner.green@campusbite.dev', '/owner/dashboard');
    const t0 = Date.now();
    await expect(p.getByText(new RegExp(`Order #${oid} has been PLACED for \\d+ minutes? without an update`))).toBeVisible({ timeout: 200000 });
    c.note(`reminder for #${oid} appeared ${Math.round((Date.now() - t0) / 1000)} s after placing (threshold 1 min, scan every 10 s), no page reload`);
    await startBackend();
  });
}
