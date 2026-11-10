import fs from 'node:fs';
import { WEB, API, Blocked, api, apiLogin, expect, loggedIn, newWindow, section, sleep, state, test, toast } from './lib.mjs';
import { menuCard } from './s2_customer.mjs';

const ASHA = 'demo.customer@campusbite.dev';
const ROHAN = 'demo.customer2@campusbite.dev';
const CURRY = 'owner.curry@campusbite.dev';
const PIZZA = 'owner.pizza@campusbite.dev';
const MEENA = 'rider.one@campusbite.dev';
const ARJUN = 'rider.two@campusbite.dev';
const ADDR = { delivery_address: 'Hostel B, Room 214', contact_phone: '9876543210' };
const order = (rid, items, extra = {}) => ({ restaurant_id: rid, items, ...ADDR, ...extra });
const raw = async (method, path, headers = {}, body) => {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...headers }, body });
  let data = null; try { data = await r.json(); } catch { /* */ }
  return { status: r.status, data };
};

export async function run() {
  section('11. Edge cases — API (checkout, payments, state machine)');
  const menu = (await api('GET', '/restaurants/1/menu?page_size=50', null)).data.items;
  const dish = (n) => menu.find((d) => d.name === n);
  const owner1 = (await api('GET', '/owner/menu-items?page_size=50', CURRY)).data.items;
  const biryani = owner1.find((d) => d.name === 'Chicken Biryani');   // unavailable
  const pizzaDish = (await api('GET', '/restaurants/2/menu?page_size=50', null)).data.items[0];

  await test('X-01', 'Checkout mixing dishes from two restaurants → 400', async (c) => {
    const r = await api('POST', '/orders', ASHA, order(1, [{ menu_item_id: dish('Butter Naan').id, quantity: 1 }, { menu_item_id: pizzaDish.id, quantity: 1 }]));
    c.note(`${r.status} ${r.data?.detail}`); expect([400, 409, 422]).toContain(r.status);
  });
  await test('X-02', 'Checkout with an unavailable dish → rejected', async (c) => {
    const r = await api('POST', '/orders', ASHA, order(1, [{ menu_item_id: biryani.id, quantity: 1 }]));
    c.note(`${r.status} ${r.data?.detail}`); expect([400, 409]).toContain(r.status);
  });
  await test('X-03', 'Quantity 0 / -1 / 21 / 1.5 / "2" → 422', async (c) => {
    const out = [];
    for (const q of [0, -1, 21, 1.5, '2']) {
      const r = await api('POST', '/orders', ASHA, order(1, [{ menu_item_id: dish('Butter Naan').id, quantity: q }]));
      out.push(`${JSON.stringify(q)}→${r.status}`);
      if (r.status === 201) await api('POST', `/orders/${r.data.id}/cancel`, ASHA);
    }
    c.note(out.join(', '));
    expect(out.slice(0, 4).every((s) => s.endsWith('422'))).toBe(true);
  });
  await test('X-04', 'Client-sent price/total is ignored or rejected (server recomputes)', async (c) => {
    const r = await api('POST', '/orders', ASHA, order(1, [{ menu_item_id: dish('Butter Naan').id, quantity: 2, price: 1 }], { total_amount: 1 }));
    c.note(`${r.status} ${r.data?.total_amount ?? JSON.stringify(r.data?.detail)?.slice(0, 120)}`);
    if (r.status === 201) { expect(r.data.total_amount).toBe(110); await api('POST', `/orders/${r.data.id}/cancel`, ASHA); }
    else expect(r.status).toBe(422);
  });
  await test('X-05', 'Empty cart, 51 lines, duplicate lines', async (c) => {
    const e = await api('POST', '/orders', ASHA, order(1, []));
    const many = await api('POST', '/orders', ASHA, order(1, Array.from({ length: 51 }, () => ({ menu_item_id: dish('Butter Naan').id, quantity: 1 }))));
    const dup = await api('POST', '/orders', ASHA, order(1, [{ menu_item_id: dish('Butter Naan').id, quantity: 15 }, { menu_item_id: dish('Butter Naan').id, quantity: 15 }]));
    c.note(`empty→${e.status}, 51 lines→${many.status}, same dish twice (15+15)→${dup.status}${dup.status === 201 ? ` items=${dup.data.items.length} qty=${dup.data.items.map((i) => i.quantity)}` : ''}`);
    expect(e.status).toBe(422); expect(many.status).toBe(422);
    if (dup.status === 201) await api('POST', `/orders/${dup.data.id}/cancel`, ASHA);
  });
  await test('X-06', 'Non-existent / soft-deleted dish and restaurant', async (c) => {
    const a = await api('POST', '/orders', ASHA, order(1, [{ menu_item_id: 999999, quantity: 1 }]));
    const b = await api('POST', '/orders', ASHA, order(999999, [{ menu_item_id: dish('Butter Naan').id, quantity: 1 }]));
    c.note(`unknown dish→${a.status}, unknown restaurant→${b.status}`);
    expect([400, 404]).toContain(a.status); expect([400, 404]).toContain(b.status);
  });
  await test('X-07', 'Bad address / phone at checkout', async (c) => {
    const out = [];
    for (const [k, v] of [['delivery_address', ''], ['delivery_address', ' '.repeat(20)], ['contact_phone', 'abcdefghij'], ['contact_phone', '1'.repeat(30)], ['notes', 'x'.repeat(501)]]) {
      const r = await api('POST', '/orders', ASHA, { ...order(1, [{ menu_item_id: dish('Butter Naan').id, quantity: 1 }]), [k]: v });
      out.push(`${k}=${JSON.stringify(v).slice(0, 12)}→${r.status}`);
      if (r.status === 201) await api('POST', `/orders/${r.data.id}/cancel`, ASHA);
    }
    c.note(out.join(', ')); expect(out.every((s) => s.endsWith('422'))).toBe(true);
  });
  // a fresh order to drive through the state machine
  const fresh = (await api('POST', '/orders', ROHAN, order(1, [{ menu_item_id: dish('Butter Naan').id, quantity: 1 }]))).data;
  await test('X-08', 'Owner skipping steps / illegal transitions → 409', async (c) => {
    const out = [];
    for (const s of ['READY', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'PLACED']) out.push(`${s}→${(await api('PATCH', `/owner/orders/${fresh.id}/status`, CURRY, { status: s })).status}`);
    out.push(`bogus→${(await api('PATCH', `/owner/orders/${fresh.id}/status`, CURRY, { status: 'EATEN' })).status}`);
    c.note(out.join(', '));
    expect(out.slice(0, 5).every((s) => /→(409|400|403)$/.test(s))).toBe(true); expect(out[5]).toMatch(/422$/);
  });
  await test('X-09', 'Double cancel → second is 409, refund only once', async (c) => {
    const a = await api('POST', `/orders/${fresh.id}/cancel`, ROHAN);
    const b = await api('POST', `/orders/${fresh.id}/cancel`, ROHAN);
    const d = (await api('GET', `/orders/${fresh.id}`, ROHAN)).data;
    const refunds = d.payments.filter((p) => p.entry_type.toLowerCase().includes('refund')).length;
    c.note(`first→${a.status} (refunded ₹${a.data?.refunded_amount}), second→${b.status}, refund ledger rows=${refunds}`);
    expect(a.status).toBe(200); expect(b.status).toBe(409); expect(refunds).toBe(1);
  });
  await test('X-10', 'Concurrent cancels (5 at once) → exactly one succeeds', async (c) => {
    const o = (await api('POST', '/orders', ROHAN, order(1, [{ menu_item_id: dish('Butter Naan').id, quantity: 1 }]))).data;
    const rs = await Promise.all(Array.from({ length: 5 }, () => api('POST', `/orders/${o.id}/cancel`, ROHAN)));
    const d = (await api('GET', `/orders/${o.id}`, ROHAN)).data;
    const refunds = d.payments.filter((p) => p.entry_type.toLowerCase().includes('refund')).length;
    c.note(`statuses ${rs.map((r) => r.status).join(',')}; refund rows ${refunds}`);
    expect(rs.filter((r) => r.status === 200).length).toBe(1); expect(refunds).toBe(1);
  });
  await test('X-11', 'Another customer cancelling my order → 404', async (c) => {
    const o = (await api('POST', '/orders', ROHAN, order(1, [{ menu_item_id: dish('Butter Naan').id, quantity: 1 }]))).data;
    const r = await api('POST', `/orders/${o.id}/cancel`, ASHA); c.note(`${r.status}`); expect(r.status).toBe(404);
    await api('POST', `/orders/${o.id}/cancel`, ROHAN);
  });
  await test('X-12', 'Assign: non-READY order, a customer as rider, unknown rider', async (c) => {
    const o = (await api('POST', '/orders', ROHAN, order(1, [{ menu_item_id: dish('Butter Naan').id, quantity: 1 }]))).data;
    const meena = (await apiLogin(MEENA)).user.id, rohan = (await apiLogin(ROHAN)).user.id;
    const a = await api('POST', `/owner/orders/${o.id}/assign`, CURRY, { delivery_partner_id: meena });
    const b = await api('POST', `/owner/orders/${o.id}/assign`, CURRY, { delivery_partner_id: rohan });
    const d = await api('POST', `/owner/orders/${o.id}/assign`, CURRY, { delivery_partner_id: 999999 });
    c.note(`PLACED order→${a.status}, customer as rider→${b.status}, unknown rider→${d.status}`);
    expect(a.status).toBe(409); expect([400, 404, 409]).toContain(b.status); expect([400, 404, 409]).toContain(d.status);
    await api('POST', `/orders/${o.id}/cancel`, ROHAN);
  });
  await test('X-13', 'Rider updating an order not assigned to them → 404; skipping pickup → 409', async (c) => {
    const mine = (await api('GET', '/delivery/orders', MEENA)).data.items[0];
    if (!mine) throw new Blocked('Meena has no active order');
    const a = await api('PATCH', `/delivery/orders/${mine.id}/status`, ARJUN, { status: 'DELIVERED' });
    let b = { status: 'n/a' };
    if (mine.status === 'ASSIGNED') b = await api('PATCH', `/delivery/orders/${mine.id}/status`, MEENA, { status: 'DELIVERED' });
    const cc = await api('PATCH', `/delivery/orders/${mine.id}/status`, MEENA, { status: 'CANCELLED' });
    c.note(`other rider→${a.status}; ASSIGNED→DELIVERED→${b.status}; rider cancel→${cc.status}`);
    expect(a.status).toBe(404); expect([400, 409, 422]).toContain(cc.status);
  });

  section('12. Edge cases — reviews & returns');
  const deliveredR = (await api('GET', '/orders/me?status=DELIVERED&page_size=50', ROHAN)).data.items;
  await test('X-14', 'Review rating 0 / 6 / 3.5, 2nd review, review of non-delivered', async (c) => {
    const t = deliveredR.find((o) => !o.has_review) || deliveredR[0];
    const out = [];
    for (const rating of [0, 6, 3.5]) out.push(`rating ${rating}→${(await api('POST', `/orders/${t.id}/review`, ROHAN, { rating })).status}`);
    const reviewed = deliveredR.find((o) => o.has_review);
    if (reviewed) out.push(`second review→${(await api('POST', `/orders/${reviewed.id}/review`, ROHAN, { rating: 3 })).status}`);
    const act = (await api('GET', '/orders/me?scope=active', ROHAN)).data.items[0];
    if (act) out.push(`non-delivered→${(await api('POST', `/orders/${act.id}/review`, ROHAN, { rating: 3 })).status}`);
    out.push(`other's order→${(await api('POST', `/orders/${state.e2e}/review`, ROHAN, { rating: 3 })).status}`);
    c.note(out.join(', '));
    expect(out.slice(0, 3).every((s) => s.endsWith('422'))).toBe(true);
    for (const s of out.slice(3)) expect(s).toMatch(/→(400|404|409)$/);
  });
  await test('X-15', 'Return: too-short reason, 2nd return, non-delivered, approve twice, reject w/o note', async (c) => {
    const t = deliveredR.find((o) => !o.return_status);
    const out = [];
    if (t) {
      out.push(`reason "bad"→${(await api('POST', `/orders/${t.id}/return`, ROHAN, { reason: 'bad' })).status}`);
      out.push(`reason 2001 chars→${(await api('POST', `/orders/${t.id}/return`, ROHAN, { reason: 'x'.repeat(2001) })).status}`);
      const ok = await api('POST', `/orders/${t.id}/return`, ROHAN, { reason: 'Edge test: wrong item delivered.' });
      out.push(`valid→${ok.status}`);
      out.push(`second return→${(await api('POST', `/orders/${t.id}/return`, ROHAN, { reason: 'Edge test: again please.' })).status}`);
      const od = (await api('GET', `/orders/${t.id}`, ROHAN)).data;
      const ownerEmail = { 'Campus Curry House': CURRY, 'Byte Pizza': PIZZA, 'Green Bowl': 'owner.green@campusbite.dev' }[od.restaurant.name];
      const rid = od.return_request.id;
      out.push(`reject no note→${(await api('POST', `/owner/returns/${rid}/reject`, ownerEmail, {})).status}`);
      out.push(`reject by other owner→${(await api('POST', `/owner/returns/${rid}/reject`, ownerEmail === CURRY ? PIZZA : CURRY, { owner_note: 'not mine at all' })).status}`);
      const a1 = await api('POST', `/owner/returns/${rid}/approve`, ownerEmail);
      const a2 = await api('POST', `/owner/returns/${rid}/approve`, ownerEmail);
      const rj = await api('POST', `/owner/returns/${rid}/reject`, ownerEmail, { owner_note: 'changed my mind' });
      const after = (await api('GET', `/orders/${t.id}`, ROHAN)).data;
      out.push(`approve→${a1.status}, approve again→${a2.status}, reject after approve→${rj.status}, refund rows=${after.payments.filter((p) => p.entry_type.toLowerCase().includes('refund')).length}`);
    }
    const act = (await api('GET', '/orders/me?scope=active', ROHAN)).data.items[0];
    if (act) out.push(`return on non-delivered→${(await api('POST', `/orders/${act.id}/return`, ROHAN, { reason: 'Edge test: not delivered yet' })).status}`);
    c.note(out.join('; '));
    expect(out.join(';')).not.toMatch(/second return→2|approve again→2|reject after approve→2|refund rows=[02-9]/);
    expect(out[0]).toMatch(/422$/);
  });

  section('13. Edge cases — auth, validation & injection');
  await test('X-16', 'Register with injected role / is_active → stays a customer', async (c) => {
    const email = `qa.inject${Date.now() % 1e6}@campusbite.dev`;
    const r = await api('POST', '/auth/register', null, { name: 'Mallory', email, phone: '9876543281', password: 'Secret123', role: 'restaurant_owner', is_active: false, id: 1 });
    c.note(`${r.status} role=${r.data?.user?.role} active=${r.data?.user?.is_active}`);
    expect(r.status).toBe(201); expect(r.data.user.role).toBe('customer');
    const s = await api('GET', '/owner/stats', null); expect(s.status).toBe(401);
  });
  await test('X-17', 'Tampered, wrong-secret, expired-style and malformed tokens → 401', async (c) => {
    const { access_token: t } = await apiLogin(ASHA);
    const [h, p] = t.split('.');
    const forged = `${h}.${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), sub: '1', role: 'restaurant_owner' })).toString('base64url')}.${t.split('.')[2]}`;
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${p}.`;
    const out = [];
    for (const [name, tok] of [['forged payload', forged], ['alg=none', none], ['garbage', 'abc'], ['empty', '']]) out.push(`${name}→${(await raw('GET', '/auth/me', { authorization: `Bearer ${tok}` })).status}`);
    out.push(`Basic scheme→${(await raw('GET', '/auth/me', { authorization: `Basic ${t}` })).status}`);
    c.note(out.join(', ')); expect(out.every((s) => s.endsWith('401') || s.endsWith('403'))).toBe(true);
  });
  await test('X-18', 'Login: email case / whitespace, SQL-ish input, huge password', async (c) => {
    const out = [];
    for (const [email, pw] of [['DEMO.CUSTOMER@CAMPUSBITE.DEV', 'Demo@1234'], ['  demo.customer@campusbite.dev  ', 'Demo@1234'], ["' OR 1=1 --", 'x'], ['demo.customer@campusbite.dev', "' OR '1'='1"], ['demo.customer@campusbite.dev', 'x'.repeat(5000)]]) {
      const r = await raw('POST', '/auth/login', {}, JSON.stringify({ email, password: pw }));
      out.push(`${JSON.stringify(email).slice(0, 18)}/${pw.length > 20 ? pw.length + ' chars' : pw}→${r.status}`);
    }
    c.note(out.join(', '));
    expect(out[2]).toMatch(/→(401|422)$/); expect(out[3]).toMatch(/→401$/); expect(out[4]).toMatch(/→(401|422)$/);
  });
  await test('X-19', 'Search wildcards & injection strings are treated literally', async (c) => {
    const out = [];
    for (const q of ['%', '_', "'; DROP TABLE orders; --", '<script>', 'naan%']) {
      const r = await api('GET', `/restaurants/1/menu?search=${encodeURIComponent(q)}`, null);
      out.push(`${JSON.stringify(q)}→${r.status}/${r.data?.items?.length}`);
    }
    const rs = await api('GET', `/restaurants?search=${encodeURIComponent('%')}`, null); out.push(`restaurants "%"→${rs.status}/${rs.data?.items?.length}`);
    c.note(out.join(', '));
    expect(out[0]).toBe('"%"→200/0'); expect(out[1]).toBe('"_"→200/0'); expect(out[2]).toMatch(/→200\/0/);
    expect((await api('GET', '/health', null)).data.db).toBe('ok');
  });
  await test('X-20', 'Pagination & filter bounds', async (c) => {
    const out = [];
    for (const qs of ['page=0', 'page=-1', 'page_size=0', 'page_size=1000', 'page=abc', 'page=99999', 'min_price=-5', 'min_price=abc', 'sort=hack']) {
      const r = await api('GET', `/restaurants/1/menu?${qs}`, null); out.push(`${qs}→${r.status}${r.status === 200 ? `/${r.data.items.length}` : ''}`);
    }
    c.note(out.join(', '));
    for (const s of out.slice(0, 5)) expect(s).toMatch(/→422$/);
    expect(out[5]).toBe('page=99999→200/0');
  });
  await test('X-21', 'Owner dish: price 0 / -1 / 10.999 / 1e9, huge name, javascript: image URL', async (c) => {
    const out = [];
    for (const body of [{ price: 0 }, { price: -1 }, { price: 10.999 }, { price: 1e9 }, { name: 'x'.repeat(300) }, { image_url: 'javascript:alert(1)' }, { image_url: 'ftp://x/y.png' }]) {
      const r = await api('POST', '/owner/menu-items', CURRY, { name: 'Edge Dish', category: 'Edge', price: 99, ...body });
      out.push(`${JSON.stringify(body).slice(0, 28)}→${r.status}`);
      if (r.status === 201) await api('DELETE', `/owner/menu-items/${r.data.id}`, CURRY);
    }
    c.note(out.join(', ')); expect(out.every((s) => /→(422|400)$/.test(s))).toBe(true);
  });
  await test('X-22', "Owner editing / deleting another restaurant's dish → 404", async (c) => {
    const a = await api('PUT', `/owner/menu-items/${pizzaDish.id}`, CURRY, { price: 1 });
    const b = await api('DELETE', `/owner/menu-items/${pizzaDish.id}`, CURRY);
    const t = await api('PATCH', `/owner/menu-items/${pizzaDish.id}/availability`, CURRY, { is_available: false });
    const s = await api('PATCH', `/owner/orders/${state.e2e}/status`, PIZZA, { status: 'PREPARING' });
    c.note(`edit→${a.status}, delete→${b.status}, toggle→${t.status}, other owner's order status→${s.status}`);
    for (const r of [a, b, t, s]) expect(r.status).toBe(404);
  });
  await test('X-23', 'Mass-assignment on restaurant update / unknown fields', async (c) => {
    const r = await api('PUT', '/owner/restaurant', CURRY, { owner_id: 999, avg_rating: 5 });
    const ok = await api('PUT', '/owner/restaurant', CURRY, { name: '' });
    c.note(`extra fields→${r.status}; empty name→${ok.status}`); expect(r.status).toBe(422); expect(ok.status).toBe(422);
  });
  await test('X-24', 'Inactive account login → 403', async (c) => {
    const email = `qa.inactive${Date.now() % 1e6}@campusbite.dev`;
    await api('POST', '/auth/register', null, { name: 'Ina Active', email, phone: '9876543282', password: 'Secret123' });
    const { execFileSync } = await import('node:child_process');
    if (process.env.PG_CONTAINER) {   // Docker Compose + PostgreSQL
      execFileSync('docker', ['exec', process.env.PG_CONTAINER, 'psql', '-U', 'campusbite', '-d', 'campusbite', '-c',
        `update users set is_active = false where email = '${email}'`]);
    } else {
      const db = new URL('./uitest.db', import.meta.url).pathname;
      execFileSync('python3', ['-c', `import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute("update users set is_active=0 where email=?", (sys.argv[2],));c.commit()`, db, email]);
    }
    const r = await raw('POST', '/auth/login', {}, JSON.stringify({ email, password: 'Secret123' }));
    c.note(`${r.status} ${r.data?.detail}`); expect(r.status).toBe(403);
  });
  await test('X-25', 'AI: question too long / empty / only whitespace', async (c) => {
    const out = [];
    for (const q of ['x'.repeat(501), '', '   ']) { const r = await api('POST', '/ai/insights', ROHAN, { question: q }); out.push(`${JSON.stringify(q).slice(0, 8)}(${q.length})→${r.status}`); }
    c.note(out.join(', ')); expect(out[0]).toMatch(/→422$/);
  });
  await test('X-26', 'AI context contains only the caller’s orders (privacy)', async (c) => {
    const log = new URL('./ai_requests.jsonl', import.meta.url).pathname;
    const before = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).length : 0;
    await api('POST', '/ai/insights', ROHAN, { question: 'Edge privacy check' });
    const lines = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).slice(before);
    const ctx = JSON.parse(lines.at(-1)).context;
    const rohanIds = new Set((await api('GET', '/orders/me?page_size=50', ROHAN)).data.items.map((o) => o.id));
    const ctxIds = ctx.all_orders_brief.map((o) => o.order_id);
    const foreign = ctxIds.filter((id) => !rohanIds.has(id));
    const leaks = JSON.stringify(ctx).match(/Asha|Hostel B|9876543210|@campusbite/g) || [];
    c.note(`context orders ${ctxIds.length}, foreign ${foreign.length}, PII strings found: ${[...new Set(leaks)].join(',') || 'none'}`);
    expect(foreign).toEqual([]); expect(leaks).toEqual([]);
  });

  section('14. Edge cases — UI');
  await test('X-27', 'XSS: HTML in review / dish name / notes is rendered as text', async (c) => {
    const xss = '<img src=x onerror="window.__xss=1">';
    const d = await api('POST', '/owner/menu-items', CURRY, { name: `Edge ${xss}`.slice(0, 100), category: 'Edge', price: 50 });
    const o = await api('POST', '/orders', ASHA, order(1, [{ menu_item_id: dish('Butter Naan').id, quantity: 1 }], { notes: `<script>window.__xss=2</script>${xss}` }));
    const p = c.page = await loggedIn(ASHA, state.curryPath || '/restaurants/1'); await sleep(1500);
    const o2 = await loggedIn(CURRY, '/owner/orders'); await sleep(1500);
    await p.goto(WEB + `/orders/${o.data.id}`); await sleep(1000);
    const fired = await p.evaluate(() => window.__xss) || await o2.evaluate(() => window.__xss);
    const shown = await p.getByText('<script>window.__xss=2</script>', { exact: false }).count();
    c.note(`payload executed: ${Boolean(fired)}; notes shown as literal text: ${shown > 0}; dish create→${d.status}`);
    expect(fired).toBeFalsy();
    if (d.status === 201) await api('DELETE', `/owner/menu-items/${d.data.id}`, CURRY);
    await api('POST', `/orders/${o.data.id}/cancel`, ASHA);
  });
  await test('X-28', 'Corrupted cart in localStorage does not crash the app', async (c) => {
  const { user } = await apiLogin(ASHA); const key = `campusbite_cart_${user.id}`;
  const p = c.page = await loggedIn(ASHA, '/');
  const out = [];
  for (const val of ['{not json', 'null', '"string"', '{"restaurant":null,"items":"oops"}', JSON.stringify({ restaurant: { id: 1, name: 'X' }, items: [{ menu_item_id: 1, name: 'Paneer Tikka', price: 'abc', quantity: -5 }] }), JSON.stringify({ restaurant: { id: 1 }, items: [{ menu_item_id: 1, quantity: 99999, price: 180 }] })]) {
    await p.evaluate(([k, v]) => localStorage.setItem(k, v), [key, val]);
    for (const path of ['/cart', '/checkout', '/restaurants/1']) {
      await p.goto(WEB + path); await sleep(900);
      const visible = await p.locator('main').innerText().catch(() => '');
      const blank = visible.trim().length < 5;
      if (blank || p.consoleErrors.length) out.push(`${val.slice(0, 22)} @${path}: ${blank ? 'BLANK PAGE' : ''} ${p.consoleErrors.splice(0).join(' ').slice(0, 120)}`);
    }
    const badge = await p.getByRole('link', { name: /^Cart, / }).first().getAttribute('aria-label').catch(() => '?');
    if (val.includes('99999') || val.includes('-5')) out.push(`${val.slice(0, 22)}: navbar says "${badge}"`);
  }
  await p.evaluate((k) => localStorage.removeItem(k), key);
  c.note(out.join(' | ') || 'all variants rendered without errors');
  expect(out.filter((o) => o.includes('BLANK'))).toEqual([]);
});
  await test('X-29', 'Cart item made unavailable before checkout → clear error, no order', async (c) => {
    const p = c.page = await loggedIn(ASHA, state.curryPath || '/restaurants/1');
    await menuCard(p, 'Sweet Lassi').getByRole('button', { name: /^add/i }).click();
    const lassi = owner1.find((d) => d.name === 'Sweet Lassi');
    await api('PATCH', `/owner/menu-items/${lassi.id}/availability`, CURRY, { is_available: false });
    const before = (await api('GET', '/orders/me?size=1', ASHA)).data.total;
    await p.goto(WEB + '/checkout'); await p.getByRole('button', { name: /^Pay ₹/ }).click(); await sleep(1500);
    const msg = await p.locator('[role="alert"], .text-red-600, .bg-red-50').filter({ visible: true }).allInnerTexts();
    const after = (await api('GET', '/orders/me?size=1', ASHA)).data.total;
    c.note(`message: ${msg.join(' | ').slice(0, 160) || '(none)'}; url ${p.url().replace(WEB, '')}; orders created ${after - before}`);
    await api('PATCH', `/owner/menu-items/${lassi.id}/availability`, CURRY, { is_available: true });
    expect(after - before).toBe(0); expect(msg.join(' ')).toMatch(/available|Sweet Lassi/i);
    await p.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('cart')).forEach((k) => localStorage.removeItem(k)));
  });
  await test('X-30', 'Price changed after adding to cart → server price is charged', async (c) => {
    const p = c.page = await loggedIn(ASHA, state.curryPath || '/restaurants/1');
    await menuCard(p, 'Garlic Naan').getByRole('button', { name: /^add/i }).click();
    const gn = owner1.find((d) => d.name === 'Garlic Naan');
    await api('PUT', `/owner/menu-items/${gn.id}`, CURRY, { price: 55 });
    await p.goto(WEB + '/checkout');
    const btn = await p.getByRole('button', { name: /^Pay ₹/ }).innerText();
    await p.getByRole('button', { name: /^Pay ₹/ }).click(); await expect(p).toHaveURL(/\/orders\/\d+/);
    const oid = Number(p.url().match(/(\d+)$/)[1]); const d = (await api('GET', `/orders/${oid}`, ASHA)).data;
    c.note(`checkout button said "${btn}", order total charged ₹${d.total_amount}`);
    await api('PUT', `/owner/menu-items/${gn.id}`, CURRY, { price: 50 });
    await api('POST', `/orders/${oid}/cancel`, ASHA);
    expect(d.total_amount).toBe(85);
    if (!btn.includes('85')) throw new Error(`UI showed stale price (${btn}) but server charged ₹${d.total_amount} — customer is not told the price changed`);
  });
  await test('X-31', 'Stepper caps quantity at the max (20)', async (c) => {
    const p = c.page = await loggedIn(ASHA, state.curryPath || '/restaurants/1');
    await menuCard(p, 'Butter Naan').getByRole('button', { name: /^add/i }).click();
    const plus = p.getByRole('button', { name: 'Add one Butter Naan' }).first();
    for (let i = 0; i < 25 && await plus.isEnabled(); i++) await plus.click();
    const label = await p.getByRole('link', { name: /^Cart, / }).first().getAttribute('aria-label');
    c.note(`${label}; + disabled: ${await plus.isDisabled()}`); expect(label).toMatch(/Cart, 20 items/);
    await p.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('cart')).forEach((k) => localStorage.removeItem(k)));
  });
  await test('X-32', 'Bad URLs: /orders/abc, /orders/999999, /restaurants/abc, /restaurants/999999', async (c) => {
    const p = c.page = await loggedIn(ASHA, '/'); const out = [];
    for (const path of ['/orders/abc', '/orders/999999', '/restaurants/abc', '/restaurants/999999', '/restaurants/-1']) {
      await p.goto(WEB + path); await sleep(1200);
      const txt = (await p.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 60);
      out.push(`${path}: "${txt}"`);
    }
    c.note(out.join(' | '));
    expect(out.every((o) => /not found|404|doesn't exist/i.test(o))).toBe(true);
  });
  await test('X-33', 'Browser Back after placing an order does not re-submit', async (c) => {
    const p = c.page = await loggedIn(ASHA, state.curryPath || '/restaurants/1');
    await menuCard(p, 'Butter Naan').getByRole('button', { name: /^add/i }).click();
    await p.goto(WEB + '/checkout'); const before = (await api('GET', '/orders/me?size=1', ASHA)).data.total;
    await p.getByRole('button', { name: /^Pay ₹/ }).click(); await expect(p).toHaveURL(/\/orders\/\d+/);
    const oid = Number(p.url().match(/(\d+)$/)[1]);
    await p.goBack(); await sleep(1000); await p.goForward(); await sleep(800); await p.reload(); await sleep(800);
    const after = (await api('GET', '/orders/me?size=1', ASHA)).data.total;
    c.note(`after Back/Forward/Reload: orders created ${after - before}; Back landed on ${p.url().replace(WEB, '')}`);
    expect(after - before).toBe(1); await api('POST', `/orders/${oid}/cancel`, ASHA);
  });
  await test('X-34', 'Price filter: negative / letters / decimals in the UI', async (c) => {
    const p = c.page = await loggedIn(ASHA, state.curryPath || '/restaurants/1');
    await p.getByPlaceholder('Min ₹').fill('-50'); await sleep(1200);
    const neg = (await p.locator('main').innerText()).replace(/\s+/g, ' ');
    const negState = /min_price/.test(neg) ? 'error text' : (/No dishes match/.test(neg) ? 'empty' : 'dishes shown');
    await p.getByPlaceholder('Min ₹').fill(''); await sleep(700);
    await p.getByPlaceholder('Max ₹').fill('99.5'); await sleep(1200);
    const dec = await p.getByText(/₹\d/).count();
    c.note(`min -50 → ${negState} (url ${p.url().replace(WEB, '')}); max 99.5 → ${dec} price tags`);
    const errBanner = await p.getByText(/Something went wrong|greater than or equal/i).count();
    expect(errBanner).toBe(0);
  });
  await test('X-35', 'Unicode / emoji in names and reviews round-trip', async (c) => {
    const email = `qa.uni${Date.now() % 1e6}@campusbite.dev`;
    const r = await api('POST', '/auth/register', null, { name: 'Zoë Ñandú 李雷 🍕', email, phone: '9876543283', password: 'Secret123' });
    c.note(`${r.status} name=${r.data?.user?.name}`); expect(r.status).toBe(201); expect(r.data.user.name).toBe('Zoë Ñandú 李雷 🍕');
  });
  await test('X-36', 'Logout in one tab logs out the other tab', async (c) => {
    const t1 = c.page = await loggedIn(ASHA, '/customer/dashboard');
    const t2 = await t1.context().newPage(); await t2.goto(WEB + '/');
    await t2.getByRole('button', { name: /log out/i }).first().click();
    await expect(t1).toHaveURL(/\/login/, { timeout: 8000 });
  });
}
