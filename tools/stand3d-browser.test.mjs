// Last Stand 3D browser smoke: boots the real page, plays through the UI and
// checks steering, camera orbit, upgrades, services, defeat and replay.
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import assert from 'node:assert/strict';

const srv = await startServer(0);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  for (const vp of [{ width: 900, height: 600 }, { width: 390, height: 700 }]) {
    const page = await browser.newPage({ viewport: vp });
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', r => errors.push('request failed ' + r.url()));
    await page.goto(srv.url + '/stand3d.html');
    await page.waitForFunction(() => window.__stand3d?.game, { timeout: 30000 });
    await page.click('[data-act="play"]');
    await page.waitForSelector('#stLevelUp .st-card');
    assert.deepEqual(await page.$$eval('#stLevelUp .st-card', c => c.map(x => x.dataset.up)), ['EDR', 'MDR', 'HCI']);
    await page.keyboard.press('1');
    const st = () => page.evaluate(() => { const g = window.__stand3d.game, S = g.state; return { phase: g.phase, levels: S && S.levels, ang: S && Math.atan2(S.op.y, S.op.x), r: S && Math.hypot(S.op.x, S.op.y), yaw: g.diagnostics.camera.yaw, dashes: S && S.dashes, temps: S && S.temps.length, t: S && S.elapsed }; });
    let s = await st(); assert.equal(s.levels.EDR, 1); assert.equal(s.phase, 'play');
    await page.keyboard.down('d'); await page.waitForFunction(a => Math.abs(Math.atan2(window.__stand3d.game.state.op.y, window.__stand3d.game.state.op.x) - a) > .5, s.ang, { timeout: 30000 }); await page.keyboard.up('d');
    await page.waitForTimeout(1500);
    const moved = await st(); assert.ok(Math.abs(moved.yaw - s.yaw) > .2, 'camera orbits with the mech');
    await page.keyboard.press('Space'); await page.waitForFunction(() => window.__stand3d.game.state.dashes >= 1, null, { timeout: 15000 });
    await page.keyboard.press('r'); await page.waitForFunction(() => window.__stand3d.game.state.temps.length === 6, null, { timeout: 15000 });
    assert.ok(!(await page.$eval('#s3Dash', b => b.hidden)));
    // real defeat path: business availability collapses
    await page.evaluate(() => { window.__stand3d.game.state.availability = 0; });
    await page.waitForFunction(() => window.__stand3d.game.phase === 'over', null, { timeout: 90000 });
    await page.waitForSelector('[data-act="again"]');
    await page.click('[data-act="again"]'); await page.waitForSelector('#stLevelUp .st-card');
    s = await st(); assert.equal(s.phase, 'play'); assert.deepEqual(s.levels, {});
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('stand3d browser smoke: ok');
} finally { await browser.close(); await new Promise(r => srv.server.close(r)); }
