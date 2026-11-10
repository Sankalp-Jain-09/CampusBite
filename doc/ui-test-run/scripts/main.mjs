// Usage: node main.mjs [section ...]   (default: all, in order). Sections share DB state, so run them in order.
import fs from 'node:fs';
import { launch, shutdown, results, OUT, state, startBackend, stopBackend } from './lib.mjs';

const ALL = ['s1_public_auth', 's2_customer', 's3_owner', 's4_delivery', 's5_e2e_security', 's6_mobile_ux_backend', 's7_edge'];
const pick = process.argv.slice(2);
const order = pick.length ? ALL.filter((s) => pick.some((p) => s.startsWith(p))) : ALL;

// EXTERNAL_BACKEND=1: test an already-running backend (e.g. Docker Compose + PostgreSQL) instead of starting one.
const external = Boolean(process.env.EXTERNAL_BACKEND);
if (!external) await startBackend();
await launch();
const t0 = Date.now();
try {
  for (const name of order) {
    if (!fs.existsSync(new URL(`./${name}.mjs`, import.meta.url))) { console.log(`(skip ${name}: not written)`); continue; }
    const mod = await import(`./${name}.mjs`);
    await mod.run();
  }
} finally {
  await shutdown();
  if (!external && !process.env.KEEP_BACKEND) await stopBackend();
  const by = results.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  console.log(`\nDone in ${Math.round((Date.now() - t0) / 1000)}s:`, by);
  fs.writeFileSync(OUT + 'state.json', JSON.stringify(state, null, 2));
}
