import { chromium } from 'playwright';
const WEB = 'http://localhost:5173', API = 'http://localhost:8000/api/v1';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const auth = await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'demo.customer@campusbite.dev', password: 'Demo@1234' }) })).json();
await p.goto(WEB + '/404-blank');
await p.evaluate(([t, u]) => { localStorage.setItem('campusbite_token', t); localStorage.setItem('campusbite_user', JSON.stringify(u));
  localStorage.setItem(`campusbite_cart_${u.id}`, JSON.stringify({ restaurant: { id: 1, name: 'Campus Curry House' }, items: [
    { menuItemId: 1, name: 'Paneer Tikka', price: 180, quantity: 2 }, { menuItemId: 9, name: 'Butter Naan', price: 40, quantity: 3 }] })); }, [auth.access_token, auth.user]);
await p.goto(WEB + '/restaurants/1'); await p.getByText('Butter Chicken').first().waitFor();
await p.waitForLoadState('networkidle');
await p.evaluate(async () => { await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))); });
const top = await p.getByText('Butter Chicken', { exact: true }).first().evaluate((el) => el.closest('li, article, [class*="card"]').getBoundingClientRect().top + window.scrollY);
await p.evaluate((y) => window.scrollTo(0, y - 80), top); await p.waitForTimeout(600);
await p.screenshot({ path: process.argv[2] + '/14-mobile-menu.png' });
await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('campusbite_cart_')).forEach((k) => localStorage.removeItem(k)));
await b.close(); console.log('saved 14');
