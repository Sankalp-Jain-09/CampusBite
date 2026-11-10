// Retake the README screenshots (doc/screenshots/*.png) against fresh demo data.
// Desktop 1280×860 (06 and 08 full page), mobile 390×664 @3x — same framing as the originals.
import { chromium } from 'playwright';

const WEB = 'http://localhost:5173';
const API = 'http://localhost:8000/api/v1';
const OUT = process.argv[2];
const PW = 'Demo@1234';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
async function win(email, { mobile = false } = {}) {
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage();
  if (email) {
    const auth = await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) })).json();
    await p.goto(WEB + '/404-blank');
    await p.evaluate(([t, u]) => { localStorage.setItem('campusbite_token', t); localStorage.setItem('campusbite_user', JSON.stringify(u)); }, [auth.access_token, auth.user]);
  }
  return p;
}
async function settle(p) {
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.evaluate(async () => {   // wait for every visible image to finish loading
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
  });
  await sleep(500);
}
async function shot(p, name, opts = {}) {
  await settle(p);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: Boolean(opts.fullPage) });
  console.log('saved', name);
}
const card = (p, dish) => p.locator('main li, main article, main [class*="card"]').filter({ hasText: dish }).filter({ has: p.getByRole('button') }).last();

// 01 — restaurant list (logged out)
const guest = await win(null);
await guest.goto(WEB); await guest.getByText('3 restaurants').waitFor();
await shot(guest, '01-restaurants');

// 02 — menu with a live cart: Paneer Tikka ×2 + Butter Naan ×3 = ₹480
const asha = await win('demo.customer@campusbite.dev');
await asha.goto(WEB + '/restaurants/1'); await asha.getByText('Paneer Tikka').first().waitFor();
await card(asha, 'Paneer Tikka').getByRole('button', { name: /^add/i }).click();
await asha.getByRole('button', { name: 'Add one Paneer Tikka' }).first().click();
await card(asha, 'Butter Naan').getByRole('button', { name: /^add/i }).click();
await asha.getByRole('button', { name: 'Add one Butter Naan' }).first().click();
await asha.getByRole('button', { name: 'Add one Butter Naan' }).first().click();
await asha.evaluate(() => window.scrollTo(0, 0));
await shot(asha, '02-menu');

// 03 — checkout
await asha.goto(WEB + '/checkout'); await asha.getByRole('button', { name: /^Pay ₹/ }).waitFor();
await shot(asha, '03-checkout');

// 04 — free-cancel countdown right after paying; 09 — owner sees "Awaiting customer" at the same time
await asha.getByRole('button', { name: /^Pay ₹/ }).click();
await asha.waitForURL(/\/orders\/\d+/); await asha.getByText('Changed your mind?').waitFor();
const newOrder = Number(asha.url().match(/(\d+)$/)[1]);
await shot(asha, '04-order-cancel-countdown');
const curry = await win('owner.curry@campusbite.dev');
await curry.goto(WEB + '/owner/orders'); await curry.getByRole('button', { name: /Awaiting customer/ }).first().waitFor();
await shot(curry, '09-owner-orders');
// Cancel it inside the window (full automatic refund) so the demo data stays tidy.
await asha.getByRole('button', { name: /Cancel for free/ }).click(); await sleep(800);

// 05 — My orders (current tab)
await asha.goto(WEB + '/customer/dashboard'); await asha.getByText(/Order #\d+/).first().waitFor();
await shot(asha, '05-my-orders');

// 06 — refunded order details (Green Bowl), full page
const tok = await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'demo.customer@campusbite.dev', password: PW }) })).json();
const refunded = (await (await fetch(`${API}/orders/me?status=REFUNDED`, { headers: { authorization: `Bearer ${tok.access_token}` } })).json()).items[0];
await asha.goto(WEB + `/orders/${refunded.id}`); await asha.getByText(/refunded \(demo\)/).first().waitFor();
await shot(asha, '06-order-refunded', { fullPage: true });

// 07 — AI insights (start screen with suggested questions)
await asha.goto(WEB + '/customer/ai-insights'); await asha.getByText('What would you like to know?').waitFor();
await shot(asha, '07-ai-insights');

// 08 — owner dashboard, full page
await curry.goto(WEB + '/owner/dashboard'); await curry.getByText(/needs attention/).waitFor();
await shot(curry, '08-owner-dashboard', { fullPage: true });

// 10 — owner menu
await curry.goto(WEB + '/owner/menu'); await curry.getByRole('switch').first().waitFor();
await shot(curry, '10-owner-menu');

// 11 — assign a rider (Byte Pizza has a READY order); 12 — return requests
const pizza = await win('owner.pizza@campusbite.dev');
await pizza.goto(WEB + '/owner/orders'); await pizza.getByRole('button', { name: 'Assign rider' }).first().click();
await pizza.getByRole('dialog').waitFor(); await pizza.getByRole('dialog').getByText('Meena Shah').click();
await shot(pizza, '11-owner-assign-rider');
await pizza.keyboard.press('Escape');
await pizza.goto(WEB + '/owner/returns'); await pizza.getByRole('button', { name: 'Approve refund' }).first().waitFor();
await shot(pizza, '12-owner-returns');

// 13 — rider deliveries
const meena = await win('rider.one@campusbite.dev');
await meena.goto(WEB + '/delivery/dashboard'); await meena.getByText('Hi Meena, your deliveries').waitFor();
await shot(meena, '13-rider-deliveries');

// 14 — mobile menu with photos; 15 — mobile drawer + sticky cart bar (same 5-item cart)
const mob = await win('demo.customer@campusbite.dev', { mobile: true });
await mob.goto(WEB + '/restaurants/1'); await mob.getByText('Paneer Tikka').first().waitFor();
await card(mob, 'Paneer Tikka').getByRole('button', { name: /^add/i }).click();
await mob.getByRole('button', { name: 'Add one Paneer Tikka' }).first().click();
await card(mob, 'Butter Naan').getByRole('button', { name: /^add/i }).click();
await mob.getByRole('button', { name: 'Add one Butter Naan' }).first().click();
await mob.getByRole('button', { name: 'Add one Butter Naan' }).first().click();
await mob.getByText('Starters', { exact: true }).first().scrollIntoViewIfNeeded().catch(() => {});
await mob.evaluate(() => { const h = [...document.querySelectorAll('main h2, main h3')].find((e) => /Starters|Breads/.test(e.textContent)); if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 80); });
await shot(mob, '14-mobile-menu');
await mob.evaluate(() => window.scrollTo(0, 0));
await mob.getByRole('button', { name: 'Toggle menu' }).click();
await shot(mob, '15-mobile-cart-bar');
// leave Asha's cart empty again
await mob.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('campusbite_cart_')).forEach((k) => localStorage.removeItem(k)));

await b.close();
console.log('done; placed and cancelled order', newOrder);
