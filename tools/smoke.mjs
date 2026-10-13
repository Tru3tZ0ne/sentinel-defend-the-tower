// Headless smoke test: load the game, play a scenario, fail on console/page errors,
// and capture screenshots. Verifies the game actually runs — not just that code reads ok.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const SHOTS = join(fileURLToPath(import.meta.url), '..', 'shots');

async function run() {
  await mkdir(SHOTS, { recursive: true });
  const { server, url } = await startServer(0 + 8123);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });

  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  const fail = async (msg) => { console.error('❌ ' + msg); await browser.close(); server.close(); process.exit(1); };

  await page.goto(url, { waitUntil: 'networkidle' });
  if (!(await page.locator('[data-start]').count())) await fail('start button missing');
  await page.screenshot({ path: join(SHOTS, '1-start.png') });

  // Enter the game.
  await page.click('[data-start]');
  await page.waitForSelector('.building');

  // Deploy a sensible defense via the engine API (deterministic), exercising the same
  // code paths the UI uses.
  await page.evaluate(() => {
    const g = window.__sentinel.game;
    g.pause();
    g.budget = 99;                              // let the test cover the full toolset
    g.deploy('AF', 'perimeter');
    g.deploy('NDR', 'network');
    g.deploy('XDR', 'command');
    g.deploy('EDR', 'r_server');
    g.deploy('EDR', 'r_vault');
    g.deploy('IAG', 'gateway');
    g.deploy('ASTOR', 'r_server');
    g.resume();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, '2-play.png') });

  // Fast-forward the simulation deterministically.
  const result = await page.evaluate(() => {
    const g = window.__sentinel.game;
    g.running = true;
    for (let i = 0; i < 800 && !g.ended; i++) g.tick(0.1);
    return { ended: g.ended, uptime: Math.round(g.uptime), data: Math.round(g.data),
             detected: g.log.filter(l => l.kind === 'attack' && (l.visible || l.blocked || l.prevented)).length,
             attacks: g.log.filter(l => l.kind === 'attack').length };
  });
  await page.waitForTimeout(300);
  await page.waitForSelector('.screen.end', { timeout: 3000 }).catch(() => {});
  await page.screenshot({ path: join(SHOTS, '3-end.png'), fullPage: true });

  // Also verify a weak/no-defense run reaches a (losing) end without errors.
  await page.click('[data-again]').catch(() => {});
  await page.waitForSelector('[data-start]');
  await page.click('[data-start]');
  await page.waitForSelector('.building');
  const result2 = await page.evaluate(() => {
    const g = window.__sentinel.game;
    g.running = true;
    for (let i = 0; i < 800 && !g.ended; i++) g.tick(0.1);
    return { ended: g.ended };
  });

  await browser.close();
  server.close();

  console.log('Scenario A (strong defense):', JSON.stringify(result));
  console.log('Scenario B (no defense):   ', JSON.stringify(result2));

  const problems = [];
  if (errors.length) problems.push(...errors);
  if (!result.ended) problems.push('Scenario A did not end');
  if (result.ended !== 'win') problems.push(`Scenario A expected win, got ${result.ended}`);
  if (result.detected < 3) problems.push(`Scenario A detected only ${result.detected} attacks`);
  if (!result2.ended) problems.push('Scenario B did not end');
  if (result2.ended === 'win') problems.push('Scenario B (no defense) should NOT win');

  if (problems.length) { console.error('❌ FAILED:\n - ' + problems.join('\n - ')); process.exit(1); }
  console.log('✅ Smoke test passed. Screenshots in tools/shots/');
}

run().catch(e => { console.error(e); process.exit(1); });
