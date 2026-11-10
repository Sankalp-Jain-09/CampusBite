import { API, WEB, PW, Blocked, api, expect, loggedIn, newWindow, section, state, test, toast, uiLogin } from './lib.mjs';

export async function run() {
  const run = Date.now() % 1e6;
  state.run = run;

  section('0. Setup');
  await test('S-01', 'Health endpoint', async () => {
    const r = await fetch(`${API}/health`); const j = await r.json();
    expect(j).toEqual({ status: 'ok', db: 'ok' });
  });
  await test('S-02', 'Home page shows 3 restaurants', async (c) => {
    const p = c.page = await newWindow(); await p.goto(WEB);
    await expect(p.getByText('3 restaurants')).toBeVisible();
  });

  section('1. Public pages & navigation');
  const g = await newWindow();
  await test('P-01', 'Home page (logged out)', async (c) => {
    c.page = g; await g.goto(WEB);
    await expect(g.getByText('Campus food, delivered.')).toBeVisible();
    await expect(g.getByText('3 restaurants')).toBeVisible();
    for (const [name, rating, count] of [['Byte Pizza', '4.0', '(1)'], ['Campus Curry House', '4.5', '(2)'], ['Green Bowl', '4.5', '(2)']]) {
      const card = g.locator('a', { hasText: name });
      await expect(card).toContainText(rating); await expect(card).toContainText(count);
    }
    const nav = g.locator('header, nav').first();
    await expect(nav.getByRole('link', { name: 'Restaurants' })).toBeVisible();
    await expect(nav.getByRole('link', { name: /log in/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /sign up/i })).toBeVisible();
    const imgs = await g.locator('a[href^="/restaurants/"] img').count();
    c.note(`${imgs} restaurant cover photos shown`);
  });
  await test('P-02', 'Search restaurants (name + cuisine)', async (c) => {
    c.page = g; const s = g.getByPlaceholder('Search restaurants or cuisines…');
    await s.fill('pizza');
    await expect(g.getByText('1 restaurant', { exact: false })).toBeVisible();
    await expect(g.locator('a[href^="/restaurants/"]')).toHaveCount(1);
    await expect(g.locator('a[href^="/restaurants/"]')).toContainText('Byte Pizza');
    await s.fill('healthy');
    await expect(g.locator('a[href^="/restaurants/"]')).toHaveCount(1);
    await expect(g.locator('a[href^="/restaurants/"]')).toContainText('Green Bowl');
  });
  await test('P-03', 'Cuisine filter', async (c) => {
    c.page = g; await g.getByPlaceholder('Search restaurants or cuisines…').fill('');
    await g.getByLabel('Cuisine').selectOption({ label: 'North Indian' });
    await expect(g.locator('a[href^="/restaurants/"]')).toHaveCount(1);
    await expect(g.locator('a[href^="/restaurants/"]')).toContainText('Campus Curry House');
    await g.getByLabel('Cuisine').selectOption({ index: 0 });
  });
  await test('P-04', 'No results empty state', async (c) => {
    c.page = g; await g.getByPlaceholder('Search restaurants or cuisines…').fill('zzz');
    await expect(g.getByText('No restaurants found')).toBeVisible();
    await g.getByPlaceholder('Search restaurants or cuisines…').fill('');
  });
  await test('P-05', 'Guest browses a menu', async (c) => {
    c.page = g; await g.goto(WEB); await g.locator('a', { hasText: 'Campus Curry House' }).click();
    await expect(g.getByText('Paneer Tikka').first()).toBeVisible();
    await expect(g.getByText('₹180').first()).toBeVisible();
    await expect(g.getByText('Chicken Biryani')).toHaveCount(0);
    await expect(g.getByText('Gulab Jamun')).toHaveCount(0);
    await expect(g.getByText(/Paneer was perfectly charred/)).toBeVisible();
    const photos = await g.locator('main img').count();
    c.note(`${photos} dish photos`);
    state.curryUrl = g.url();
  });
  await test('P-06', 'Guest Add → login → back to the menu', async (c) => {
    c.page = g;
    await g.getByRole('button', { name: /^add/i }).first().click();
    await toast(g, /log in to start your order/i);
    await expect(g).toHaveURL(/\/login/);
    await g.getByLabel('Email').fill('demo.customer@campusbite.dev');
    await g.getByLabel('Password', { exact: true }).fill(PW);
    await g.getByRole('button', { name: /^log in$/i }).click();
    await expect(g.getByRole('button', { name: /log out/i }).first()).toBeVisible();
    const landed = g.url();
    await g.getByRole('button', { name: /log out/i }).first().click();
    await expect(g).toHaveURL(/\/login/);
    if (landed !== state.curryUrl) throw new Error(`after login landed on ${landed}, expected ${state.curryUrl}`);
  });
  await test('P-07', 'Footer links', async (c) => {
    c.page = g; await g.goto(WEB);
    await g.getByRole('link', { name: 'Partner with us' }).click();
    await expect(g).toHaveURL(/\/partner\/register/);
    await g.goto(WEB); await g.getByRole('link', { name: 'Ride with us' }).click();
    await expect(g).toHaveURL(/\/delivery\/register/);
  });
  await test('P-08', 'Protected page while logged out → login', async (c) => {
    c.page = g; await g.goto(WEB + '/customer/dashboard');
    await expect(g).toHaveURL(/\/login/);
  });
  await test('P-09', '404 page', async (c) => {
    c.page = g; await g.goto(WEB + '/does-not-exist');
    await expect(g.getByText(/404/).first()).toBeVisible();
    await expect(g.getByText(/page not found/i)).toBeVisible();
    await g.getByRole('link', { name: /go home/i }).or(g.getByRole('button', { name: /go home/i })).first().click();
    await expect(g).toHaveURL(WEB + '/');
  });

  section('2. Registration & login');
  const r = await newWindow();
  await test('A-01', 'Customer signup: empty form validation', async (c) => {
    c.page = r; await r.goto(WEB + '/register');
    await r.getByRole('button', { name: 'Create account' }).click();
    await expect(r.getByText('Email is required')).toBeVisible();
    const errs = await r.locator('[role="alert"], .text-red-600, .text-red-500').allInnerTexts();
    c.note(`errors: ${errs.filter(Boolean).join(' / ')}`);
    expect(errs.filter(Boolean).length).toBeGreaterThanOrEqual(4);
    await expect(r).toHaveURL(/\/register/);
  });
  await test('A-02', 'Customer signup: field rules', async (c) => {
    c.page = r;
    await r.getByLabel('Email').fill('abc');
    await r.getByLabel('Phone').fill('123');
    await r.getByLabel('Password', { exact: true }).fill('short');
    await r.getByLabel('Confirm password').fill('different');
    await r.getByRole('button', { name: 'Create account' }).click();
    await expect(r.getByText('Enter a valid email address')).toBeVisible();
    await expect(r.getByText(/Enter 10.15 digits/)).toBeVisible();
    await expect(r.getByText('Use at least 8 characters')).toBeVisible();
    await expect(r.getByText('Passwords do not match')).toBeVisible();
  });
  state.newCustomer = `qa.cust${run}@campusbite.dev`;
  await test('A-03', 'Customer signup success', async (c) => {
    c.page = r;
    await r.getByLabel('Full name').fill('Quinn Tester');
    await r.getByLabel('Email').fill(state.newCustomer);
    await r.getByLabel('Phone').fill('9876543299');
    await r.getByLabel('Password', { exact: true }).fill('Secret123');
    await r.getByLabel('Confirm password').fill('Secret123');
    await r.getByRole('button', { name: 'Create account' }).click();
    await expect(r.getByText('Hungry, Quinn?')).toBeVisible();
    for (const l of ['My orders', 'AI insights']) await expect(r.getByRole('link', { name: l }).first()).toBeVisible();
    await expect(r.getByRole('link', { name: /cart/i }).first()).toBeVisible();
    await expect(r.getByText('Customer').first()).toBeVisible();
  });
  await test('A-04', 'Duplicate email', async (c) => {
    c.page = r; await r.getByRole('button', { name: /log out/i }).first().click();
    await r.goto(WEB + '/register');
    await r.getByLabel('Full name').fill('Dup User');
    await r.getByLabel('Email').fill('demo.customer@campusbite.dev');
    await r.getByLabel('Phone').fill('9876543298');
    await r.getByLabel('Password', { exact: true }).fill('Secret123');
    await r.getByLabel('Confirm password').fill('Secret123');
    await r.getByRole('button', { name: 'Create account' }).click();
    await expect(r.getByText('An account with this email already exists')).toBeVisible();
  });
  await test('A-05', 'Owner signup: restaurant fields required', async (c) => {
    c.page = r; await r.goto(WEB + '/partner/register');
    await r.getByLabel('Full name').fill('Olive Owner');
    await r.getByLabel('Email').fill(`qa.owner${run}@campusbite.dev`);
    await r.getByLabel('Phone', { exact: true }).fill('9876543297');
    await r.getByLabel('Password', { exact: true }).fill('Secret123');
    const cp = r.getByLabel('Confirm password'); if (await cp.count()) await cp.fill('Secret123');
    await r.getByRole('button', { name: 'Register restaurant' }).click();
    const errs = (await r.locator('.text-red-600, [role="alert"]').allInnerTexts()).filter(Boolean);
    c.note(`errors: ${errs.join(' / ')}`);
    expect(errs.length).toBeGreaterThanOrEqual(4);
    await expect(r).toHaveURL(/partner\/register/);
  });
  state.newRestaurant = `QA Dosa Corner ${run}`;
  state.newOwner = `qa.owner${run}@campusbite.dev`;
  await test('A-06', 'Owner signup success → owner dashboard', async (c) => {
    c.page = r;
    await r.getByLabel('Restaurant name').fill(state.newRestaurant);
    await r.getByLabel('Cuisine').fill('South Indian');
    await r.getByLabel('Address').fill('Library Lane, Stall 2');
    await r.getByLabel('Restaurant phone').fill('9876500099');
    await r.getByRole('button', { name: 'Register restaurant' }).click();
    await expect(r).toHaveURL(/owner\/dashboard/);
    await expect(r.getByText(state.newRestaurant).first()).toBeVisible();
    await expect(r.getByText('Open', { exact: true }).first()).toBeVisible();
  });
  await test('A-07', 'New restaurant is public', async (c) => {
    c.page = r; await r.getByRole('button', { name: /log out/i }).first().click();
    await r.goto(WEB);
    const card = r.locator('a', { hasText: state.newRestaurant });
    await expect(card).toBeVisible();
    await expect(card).toContainText('No reviews yet');
  });
  state.newRider = `qa.rider${run}@campusbite.dev`;
  await test('A-08', 'Rider signup: vehicle required', async (c) => {
    c.page = r; await r.goto(WEB + '/delivery/register');
    await r.getByLabel('Full name').fill('Riley Rider');
    await r.getByLabel('Email').fill(state.newRider);
    await r.getByLabel('Phone').fill('9876543296');
    await r.getByLabel('Password', { exact: true }).fill('Secret123');
    const cp = r.getByLabel('Confirm password'); if (await cp.count()) await cp.fill('Secret123');
    await r.getByRole('button', { name: 'Join as delivery partner' }).click();
    await expect(r.getByText('Vehicle type is required')).toBeVisible();
    const errs = (await r.locator('.text-red-600, [role="alert"]').allInnerTexts()).filter(Boolean);
    c.note(`errors: ${errs.join(' / ')}`);
    expect(errs.length).toBeGreaterThanOrEqual(2);
  });
  await test('A-09', 'Rider signup success', async (c) => {
    c.page = r;
    await r.getByLabel('Vehicle type').selectOption({ label: 'Scooter' });
    await r.getByLabel('Vehicle number').fill('ka01xy9999');
    await r.getByRole('button', { name: 'Join as delivery partner' }).click();
    await expect(r.getByText(/Hi Riley, your deliveries/)).toBeVisible();
    await expect(r.getByText('No deliveries right now')).toBeVisible();
    const me = await api('GET', '/auth/me', null).catch(() => null);
    await r.getByRole('button', { name: /log out/i }).first().click();
  });
  await test('A-10', 'Wrong password', async (c) => {
    c.page = r; await uiLogin(r, 'demo.customer@campusbite.dev', 'wrong123');
    await expect(r.getByText('Invalid email or password')).toBeVisible();
  });
  await test('A-11', 'Unknown email → same message', async (c) => {
    c.page = r; await uiLogin(r, 'nobody@campusbite.dev', 'wrong123');
    await expect(r.getByText('Invalid email or password')).toBeVisible();
  });
  await test('A-12', 'Redirect by role after login', async (c) => {
    c.page = r;
    const cases = [['demo.customer@campusbite.dev', /localhost:5173\/$/], ['owner.curry@campusbite.dev', /owner\/dashboard/], ['rider.one@campusbite.dev', /delivery\/dashboard/]];
    for (const [email, re] of cases) {
      await uiLogin(r, email); await expect(r).toHaveURL(re);
      await r.getByRole('button', { name: /log out/i }).first().click();
      await expect(r).toHaveURL(/\/login/);
    }
  });
  await test('A-13', 'Demo accounts box', async (c) => {
    c.page = r; await r.goto(WEB + '/login');
    await r.getByText('Demo accounts (seeded data)').click();
    const box = r.locator('details');
    await expect(box).toContainText('Demo@1234');
    for (const e of ['demo.customer@campusbite.dev', 'owner.curry@campusbite.dev', 'rider.one@campusbite.dev']) await expect(box).toContainText(e);
  });
  await test('A-14', 'Stay logged in after refresh', async (c) => {
    c.page = r; await uiLogin(r, 'demo.customer@campusbite.dev');
    await r.getByRole('link', { name: 'My orders' }).first().click();
    await expect(r).toHaveURL(/customer\/dashboard/);
    await r.reload();
    await expect(r).toHaveURL(/customer\/dashboard/);
    await expect(r.getByRole('button', { name: /log out/i }).first()).toBeVisible();
  });
  await test('A-15', 'Log out', async (c) => {
    c.page = r; await r.getByRole('button', { name: /log out/i }).first().click();
    await expect(r).toHaveURL(/\/login/);
    await expect(r.getByRole('link', { name: /sign up/i }).first()).toBeVisible();
  });
  await test('A-16', 'Invalid token → session expired', async (c) => {
    c.page = r; await uiLogin(r, 'demo.customer@campusbite.dev'); await expect(r).toHaveURL(WEB + '/');
    await r.evaluate(() => localStorage.setItem('campusbite_token', 'abc'));
    await r.getByRole('link', { name: 'My orders' }).first().click();
    await expect(r).toHaveURL(/\/login/);
    c.note(`final URL ${r.url()}`);
    await expect(r.getByText(/Your session expired\. Please log in again\./)).toBeVisible();
  });
  await test('A-17', 'Logged-in owner opening /login → dashboard', async (c) => {
    const p = c.page = await loggedIn('owner.curry@campusbite.dev', '/login');
    await expect(p).toHaveURL(/owner\/dashboard/);
  });
}
