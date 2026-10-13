// Headless smoke test. Verifies engine logic (deploy → fog-of-war → correlate → respond →
// honest outcomes) by driving the engine directly, which is robust to headless/software-GL
// frame-rate starvation. Screenshots of each phase are best-effort. Fails on console/page
// errors or wrong outcomes.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const SHOTS = join(fileURLToPath(import.meta.url), '..', 'shots');
const rawClick = async (page, sel) => { const b = await page.locator(sel).first().boundingBox().catch(() => null); if (b) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
const shot = (page, n) => page.screenshot({ path: join(SHOTS, n) }).catch(() => {});

async function run() {
  await mkdir(SHOTS, { recursive: true });
  const { server, url } = await startServer(8123);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  const fail = async (m) => { console.error('❌ ' + m); console.error('errors:', errors); await browser.close(); server.close(); process.exit(1); };

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  if (!(await page.locator('[data-act="start"]').count())) await fail('start button missing');
  await shot(page, 'm2-1-start.png');

  // Visual walk-through (best-effort screenshots).
  await rawClick(page, '[data-act="start"]');
  await page.waitForTimeout(1500);
  await shot(page, 'm2-2-prep.png');
  await page.evaluate(() => {
    const g = window.__sentinel.engine; g.budget = 99;
    g.deploy('AF'); g.deploy('NDR'); g.deploy('XDR'); g.deploy('IAG');
    g.deploy('EDR', 'office#2'); g.deploy('EDR', 'office#1'); g.deploy('EDR', 'server#core'); g.deploy('EDR', 'vault#core');
  });
  await page.waitForTimeout(400);
  await shot(page, 'm2-3-deployed.png');
  await rawClick(page, '[data-act="begin"]');
  await page.evaluate(() => { window.__sentinel.engine.speed = 2; });
  await page.waitForTimeout(2500);
  await shot(page, 'm2-4-incident.png');

  // Assertions — three scenarios driven directly through the engine (robust to render speed).
  const res = await page.evaluate(() => {
    const S = window.__sentinel; const out = {};
    const detected = g => g.log.filter(l => l.kind === 'attack' && (l.visible || l.blocked || l.prevented)).length;
    S.newGame(); let g = S.engine; g.budget = 99;
    g.deploy('AF'); g.deploy('NDR'); g.deploy('XDR'); g.deploy('IAG'); g.deploy('EDR', 'office#2'); g.deploy('EDR', 'server#core'); g.deploy('EDR', 'vault#core');
    g.beginDay(); g._paused = true; for (let i = 0; i < 1400 && !g.ended; i++) g.tick(0.1);
    out.A = { ended: g.ended, outcome: g.outcome && g.outcome.kind, detected: detected(g), attacks: g.log.filter(l => l.kind === 'attack').length };
    S.newGame(); g = S.engine; g.beginDay(); g._paused = true; for (let i = 0; i < 1400 && !g.ended; i++) g.tick(0.1);
    out.B = { ended: g.ended, outcome: g.outcome && g.outcome.kind };
    S.newGame(); g = S.engine; g.budget = 99; g.deploy('AF'); g.deploy('XDR'); g.deploy('EDR', 'office#2'); g.beginDay(); g._paused = true;
    let did = false; for (let i = 0; i < 1400 && !g.ended; i++) { g.tick(0.1); if (!did && g.confirmed && g.intruder.room === 'office') { g.isolateDevice('office#2'); did = true; } }
    out.C = { ended: g.ended, contained: g.intruder.contained, outcome: g.outcome && g.outcome.kind };
    return out;
  });

  await browser.close(); server.close();
  console.log('A (strong):', JSON.stringify(res.A));
  console.log('B (none):  ', JSON.stringify(res.B));
  console.log('C (isolate):', JSON.stringify(res.C));

  const probs = [];
  if (errors.length) probs.push(...errors);
  if (res.A.ended !== 'win') probs.push(`A expected win, got ${res.A.ended}`);
  if (res.A.detected < 4) probs.push(`A detected only ${res.A.detected}`);
  if (res.B.ended === 'win' || !res.B.ended) probs.push(`B should lose, got ${res.B.ended}`);
  if (res.C.ended !== 'win' || !res.C.contained || res.C.outcome !== 'contained') probs.push(`C isolate should contain, got ${JSON.stringify(res.C)}`);

  if (probs.length) { console.error('❌ FAILED:\n - ' + probs.join('\n - ')); process.exit(1); }
  console.log('✅ Smoke test passed (engine logic + honest outcomes). Screenshots in tools/shots/');
}
run().catch(e => { console.error(e); process.exit(1); });
