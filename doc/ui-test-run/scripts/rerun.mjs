import { launch, shutdown, startBackend, stopBackend, test, section, loggedIn, apiLogin, api, expect, sleep, WEB, results } from './lib.mjs';
await startBackend(); await launch();
section('re-run');
const ASHA = 'demo.customer@campusbite.dev';
await test('C-26', 'Pagination in My orders (with >10 past orders)', async (c) => {
  const p = c.page = await loggedIn(ASHA, '/customer/dashboard');
  await p.getByRole('tab', { name: 'Past orders' }).or(p.getByRole('button', { name: 'Past orders' })).first().click();
  const pag = p.getByText(/Page \d+ of \d+ · \d+ total/); await expect(pag).toBeVisible();
  const t1 = await pag.innerText(); const first1 = await p.getByText(/Order #\d+/).first().innerText();
  await p.getByRole('button', { name: /Next/ }).click(); await expect(pag).not.toHaveText(t1);
  const t2 = await pag.innerText(); const first2 = await p.getByText(/Order #\d+/).first().innerText();
  await p.getByRole('button', { name: /Previous/ }).click(); await expect(pag).toHaveText(t1);
  c.note(`${t1} (${first1}…) → ${t2} (${first2}…) → back`); expect(first1).not.toBe(first2);
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
await shutdown(); await stopBackend();
