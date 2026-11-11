// Sentinel Frame browser smoke: boots the real page and plays through the UI.
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import assert from 'node:assert/strict';
const srv = await startServer(0);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  for (const vp of [{ width: 900, height: 600 }, { width: 390, height: 700 }]) {
    const page = await browser.newPage({ viewport: vp });
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('requestfailed', r => errors.push('request failed ' + r.url()));
    await page.goto(srv.url + '/frame.html');
    await page.waitForFunction(() => window.__frame?.game, { timeout: 30000 });
    assert.equal(await page.$$eval('.fr-leg', n => n.length), 8, 'all eight products are explained on the start card');
    await page.waitForFunction(() => window.__frame.game.demo.step >= 2, null, { timeout: 60000 });
    await page.click('[data-act="play"]');
    await page.waitForFunction(() => window.__frame.game.phase === 'play');
    const x0 = await page.evaluate(() => window.__frame.game.state.ship.x);
    await page.keyboard.down('d'); await page.waitForFunction(x => window.__frame.game.state.ship.x > x + 2, x0, { timeout: 30000 }); await page.keyboard.up('d');
    await page.waitForFunction(() => window.__frame.game.state.shots.length > 0, null, { timeout: 30000 });
    await page.keyboard.press('Space'); await page.waitForFunction(() => window.__frame.game.state.bombs === 2, null, { timeout: 30000 });
    await page.evaluate(() => { for (const id of ['XDR', 'NDR', 'AF']) window.__frame.game.grant(id); });
    await page.waitForFunction(() => document.querySelector('#frStatus .fr-tier')?.textContent.includes('MK-II') && window.__frame.game.state.tier === 1, null, { timeout: 30000 });
    await page.keyboard.press('p'); assert.equal(await page.evaluate(() => window.__frame.game.phase), 'paused');
    await page.keyboard.press('p'); assert.equal(await page.evaluate(() => window.__frame.game.phase), 'play');
    // real defeat path: no lives left and a bullet on the ship
    await page.evaluate(() => { const S = window.__frame.game.state; S.lives = 1; S.shield = 0; S.lv.ASTOR = 0; S.lv.AF = 0; S.ship.inv = 0; setInterval(() => { if (S.phase === 'play' && S.ship.dead <= 0) { S.ship.inv = 0; S.eb.push({ x: S.ship.x, y: S.ship.y, vx: 0, vy: 0, r: .3, kind: 0, age: 0 }); } }, 100); });
    await page.waitForSelector('[data-act="again"]', { timeout: 90000 });
    await page.click('[data-act="again"]'); await page.waitForFunction(() => window.__frame.game.phase === 'play' && window.__frame.game.state.lives === 3, null, { timeout: 30000 });
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('frame browser smoke: ok');
} finally { await browser.close(); await new Promise(r => srv.server.close(r)); }
