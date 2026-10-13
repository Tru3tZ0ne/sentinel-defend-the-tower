// Headless smoke test for the 3D redesign: loads the game, plays through setup → incident
// → review, fails on console/page errors, and captures screenshots of each phase + replay.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const SHOTS = join(fileURLToPath(import.meta.url), '..', 'shots');

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
  await page.waitForTimeout(800);
  if (!(await page.locator('[data-act="start"]').count())) await fail('start button missing');
  await page.screenshot({ path: join(SHOTS, 'm2-1-start.png') });

  // Enter setup phase
  await page.click('[data-act="start"]');
  await page.waitForTimeout(1500);                 // let people populate & wander
  await page.screenshot({ path: join(SHOTS, 'm2-2-prep.png') });

  // Deploy a sensible defense through the engine (same code paths as clicking)
  await page.evaluate(() => {
    const g = window.__sentinel.engine; g.budget = 99;
    g.deploy('AF'); g.deploy('NDR'); g.deploy('XDR'); g.deploy('IAG');
    g.deploy('EDR', 'office#2'); g.deploy('EDR', 'finance#1'); g.deploy('EDR', 'server#core'); g.deploy('EDR', 'vault#core');
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOTS, 'm2-3-deployed.png') });

  // Begin the day, let it run live for a few seconds so people/clues animate
  await page.click('[data-act="begin"]');
  await page.evaluate(() => { window.__sentinel.engine.speed = 2; });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: join(SHOTS, 'm2-4-incident.png') });

  // Fast-forward deterministically to the end
  const resA = await page.evaluate(() => {
    const g = window.__sentinel.engine; g._paused = true;
    for (let i = 0; i < 1400 && !g.ended; i++) g.tick(0.1);
    return { ended: g.ended, uptime: Math.round(g.uptime), data: Math.round(g.data),
             detected: g.log.filter(l => l.kind === 'attack' && (l.visible || l.blocked || l.prevented)).length,
             attacks: g.log.filter(l => l.kind === 'attack').length };
  });
  await page.waitForTimeout(500);
  await page.waitForSelector('.endScreen:not(.hidden)', { timeout: 3000 }).catch(() => {});
  await page.screenshot({ path: join(SHOTS, 'm2-5-end.png') });

  // Spatial replay
  await page.click('[data-act="replayPlay"]').catch(() => {});
  await page.waitForTimeout(2600);
  await page.screenshot({ path: join(SHOTS, 'm2-6-replay.png') });

  // Scenario B: no defense should lose
  await page.click('[data-act="backToGame"]').catch(() => {});
  await page.click('[data-act="again"]').catch(() => {});
  await page.waitForSelector('[data-act="begin"]', { timeout: 12000 });
  await page.click('[data-act="begin"]');
  const resB = await page.evaluate(() => {
    const g = window.__sentinel.engine; g._paused = true;
    for (let i = 0; i < 1400 && !g.ended; i++) g.tick(0.1);
    return { ended: g.ended };
  });

  // Scenario C: contain via isolation
  await page.waitForTimeout(300);
  await page.click('[data-act="again"]').catch(() => {});
  await page.waitForSelector('[data-act="begin"]', { timeout: 12000 });
  const resC = await page.evaluate(() => {
    const g = window.__sentinel.engine; g.budget = 99;
    g.deploy('NDR'); g.deploy('XDR'); g.deploy('EDR', 'finance#1');
    g.beginDay(); g._paused = true;
    let contained = false;
    for (let i = 0; i < 1400 && !g.ended; i++) {
      g.tick(0.1);
      if (!contained && g.confirmed && g.intruder.room === 'finance') { g.isolateDevice('finance#1'); contained = true; }
    }
    return { ended: g.ended, containedTried: contained, contained: g.intruder.contained };
  });

  await browser.close(); server.close();

  console.log('A (strong):', JSON.stringify(resA));
  console.log('B (none):  ', JSON.stringify(resB));
  console.log('C (isolate):', JSON.stringify(resC));

  const probs = [];
  if (errors.length) probs.push(...errors);
  if (resA.ended !== 'win') probs.push(`A expected win, got ${resA.ended}`);
  if (resA.detected < 4) probs.push(`A detected only ${resA.detected}`);
  if (resB.ended === 'win' || !resB.ended) probs.push(`B should lose, got ${resB.ended}`);
  if (resC.ended !== 'win' || !resC.contained) probs.push(`C isolate should contain+win, got ${JSON.stringify(resC)}`);

  if (probs.length) { console.error('❌ FAILED:\n - ' + probs.join('\n - ')); process.exit(1); }
  console.log('✅ Smoke test passed. Screenshots in tools/shots/');
}
run().catch(e => { console.error(e); process.exit(1); });
