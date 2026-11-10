// Shared helpers for the CampusBite manual-UI-plan automation.
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import fs from 'node:fs';

export { expect };
export const WEB = 'http://localhost:5173';
export const API = 'http://localhost:8000/api/v1';
export const PW = 'Demo@1234';
export const OUT = new URL('./out/', import.meta.url).pathname;
fs.mkdirSync(OUT + 'shots', { recursive: true });

expect.configure({ timeout: 8000 });

export const results = [];
export const state = {};          // values shared between sections (order ids, emails, ...)
let browser;
const contexts = [];

export async function launch() {
  browser = await chromium.launch({ headless: true });
  return browser;
}
export async function shutdown() {
  for (const c of contexts) await c.close().catch(() => {});
  await browser?.close();
}

/** Fresh browser context (= a private window). mobile=true → iPhone-size viewport. */
export async function newWindow({ mobile = false } = {}) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1366, height: 900 } });
  contexts.push(ctx);
  const page = await ctx.newPage();
  page.consoleErrors = [];
  page.on('pageerror', (e) => page.consoleErrors.push(String(e)));
  return page;
}

/** Window already logged in as `email` (token injected into localStorage, like a returning user). */
export async function loggedIn(email, path = '/', opts = {}) {
  const page = await newWindow(opts);
  await injectAuth(page, email, opts.password);
  await page.goto(WEB + path);
  return page;
}
export async function injectAuth(page, email, password = PW) {
  const auth = await apiLogin(email, password);
  if (!page.url().startsWith(WEB)) await page.goto(WEB + '/404-blank');
  await page.evaluate(([t, u]) => { localStorage.setItem('campusbite_token', t); localStorage.setItem('campusbite_user', JSON.stringify(u)); },
    [auth.access_token, auth.user]);
  return auth;
}

/** UI login through the form. */
export async function uiLogin(page, email, password = PW) {
  await page.goto(WEB + '/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^log in$/i }).click();
}

// ---------- API helpers (setup + verification) ----------
const tokens = {};
export async function apiLogin(email, password = PW) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(j)}`);
  tokens[email] = j.access_token;
  return j;
}
export async function api(method, path, email, body) {
  if (email && !tokens[email]) await apiLogin(email);
  const r = await fetch(API + path, {
    method, headers: { 'content-type': 'application/json', ...(email ? { authorization: `Bearer ${tokens[email]}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await r.json(); } catch { /* empty */ }
  return { status: r.status, data };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- test runner ----------
let current = { section: '' };
export function section(name) { current.section = name; console.log(`\n=== ${name}`); }

/**
 * Run one test case. fn(ctx) may call ctx.note('...') and ctx.page = page (for a failure screenshot).
 * Throw Blocked('reason') when a precondition is missing.
 */
export class Blocked extends Error {}
export async function test(id, title, fn) {
  const ctx = { notes: [], page: null, note(n) { this.notes.push(n); } };
  const t0 = Date.now();
  let status = 'PASS', error = null, shot = null;
  try {
    await fn(ctx);
  } catch (e) {
    status = e instanceof Blocked ? 'BLOCKED' : 'FAIL';
    error = String(e.message || e).split('\n').slice(0, 6).join(' ').replace(/\s+/g, ' ').slice(0, 600);
    if (ctx.page && !ctx.page.isClosed()) {
      shot = `shots/${id}.png`;
      await ctx.page.screenshot({ path: OUT + shot, fullPage: true }).catch(() => { shot = null; });
    }
  }
  if (ctx.page?.consoleErrors?.length) ctx.notes.push(`JS errors: ${ctx.page.consoleErrors.splice(0).join(' | ').slice(0, 300)}`);
  const r = { id, title, section: current.section, status, error, notes: ctx.notes, shot, ms: Date.now() - t0 };
  results.push(r);
  console.log(`${status.padEnd(7)} ${id} ${title}${error ? '  → ' + error : ''}${ctx.notes.length ? '  [' + ctx.notes.join('; ') + ']' : ''}`);
  fs.writeFileSync(OUT + 'results.json', JSON.stringify(results, null, 2));
  return status === 'PASS';
}

/** Read the visible toast text (bottom of the screen). */
export async function toast(page, re) {
  await expect(page.getByText(re).first()).toBeVisible();
}

// ---------- backend process control (the runner owns the backend so it can restart it) ----------
import { spawn } from 'node:child_process';
let backendProc = null;
const BACKEND_SH = new URL('./start_backend.sh', import.meta.url).pathname;
const BACKEND_LOG = new URL('./backend.log', import.meta.url).pathname;
export async function startBackend(env = {}) {
  await stopBackend();
  const out = fs.openSync(BACKEND_LOG, 'a');
  backendProc = spawn(BACKEND_SH, Object.entries(env).map(([k, v]) => `${k}=${v}`), { stdio: ['ignore', out, out], detached: true });
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${API}/health`); if (r.ok) return; } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('backend did not start');
}
export async function stopBackend() {
  if (backendProc) { try { process.kill(-backendProc.pid, 'SIGTERM'); } catch { /* gone */ } backendProc = null; }
  for (let i = 0; i < 40; i++) { try { await fetch(`${API}/health`); await sleep(250); } catch { return; } }
}
export const backendLogPath = BACKEND_LOG;
