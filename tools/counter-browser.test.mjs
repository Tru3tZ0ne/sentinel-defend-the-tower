// Sentinel Counter-Breach browser smoke: boots the real page and plays through the UI.
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import assert from 'node:assert/strict';
const srv = await startServer(0);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  for (const vp of [{ width: 960, height: 600 }, { width: 390, height: 720, touch: true }]) {
    const page = await browser.newPage({ viewport: vp, hasTouch: !!vp.touch });
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('requestfailed', r => errors.push('request failed ' + r.url()));
    await page.goto(srv.url + '/counter.html');
    await page.waitForFunction(() => window.__counter?.game, { timeout: 30000 });
    const G = (fn, a) => page.evaluate(fn, a), T = { timeout: 60000 };
    assert.equal(await page.$$eval('.loadout span', n => n.length), 8, 'all eight products are on the menu');
    if (vp.touch) await G(() => window.dispatchEvent(new Event('touchstart')));
    await page.click('[data-act="play"]');
    await page.waitForFunction(() => window.__counter.game.state.phase === 'buy' && document.querySelectorAll('.cb-card').length === 8, null, T);
    await page.click('[data-buy="IAG"]'); await page.waitForFunction(() => window.__counter.game.state.lv.IAG === 1 && window.__counter.game.state.money === 300, null, T);
    await page.click('[data-buy="EDR"]'); assert.equal(await G(() => window.__counter.game.state.lv.EDR), 0, 'cannot buy what you cannot afford');
    await G(() => { window.__counter.game.state.money = 5000; }); await page.click('[data-buy="AF"]'); await page.waitForFunction(() => document.querySelector('.cb-gate.on'), null, T);
    await page.click('[data-gate="0"]'); await page.waitForFunction(() => window.__counter.game.state.gateSel[0] === true && window.__counter.game.state.gateSel[1] === false, null, T);
    await page.click('[data-act="ready"]'); await page.waitForFunction(() => window.__counter.game.state.phase === 'live', null, T);
    await G(() => { window.__counter.game.state.p.inv = 1e9; });
    assert.equal(await G(() => getComputedStyle(document.getElementById('cbBuy')).display), 'none'); assert.equal(await G(() => window.__counter.game.state.walls.length), 1);
    if (vp.touch) {
      assert.equal(await G(() => getComputedStyle(document.getElementById('cbTouch')).display), 'block');
      const z0 = await G(() => window.__counter.game.state.p.z); await G(() => window.__counter.game.touch.move(0, -1)); await page.waitForFunction(z => window.__counter.game.state.p.z < z - 1, z0, T); await G(() => window.__counter.game.touch.move(0, 0));
      await G(() => window.__counter.game.touch.fire(true)); await page.waitForFunction(() => window.__counter.game.state.shotsFired > 0, null, T); await G(() => window.__counter.game.touch.fire(false));
      await G(() => window.__counter.game.touch.tap('nade')); await page.waitForFunction(() => window.__counter.game.state.p.nades === 0, null, T);
    } else {
      const z0 = await G(() => window.__counter.game.state.p.z); await page.keyboard.down('w'); await page.waitForFunction(z => window.__counter.game.state.p.z < z - 1, z0, T); await page.keyboard.up('w');
      await page.mouse.move(480, 300); await page.mouse.down(); await page.waitForFunction(() => window.__counter.game.state.shotsFired > 0, null, T); await page.mouse.up();
      await page.keyboard.press('g'); await page.waitForFunction(() => window.__counter.game.state.p.nades === 0, null, T);
      await page.keyboard.press('p'); assert.equal(await G(() => window.__counter.game.phase), 'paused'); await page.click('[data-act="resume"]'); assert.equal(await G(() => window.__counter.game.phase), 'play');
    }
    // a real kill shows up in the kill feed with the product that made it
    await page.waitForFunction(() => window.__counter.game.state.threats.some(th => th.spawnT <= 0), null, T);
    await G(() => { const g = window.__counter.game, th = g.state.threats.find(o => o.spawnT <= 0); g.sim.damage(th, 9999, 'EDR', true); });
    await page.waitForFunction(() => document.querySelector('#cbFeed .cb-kill'), null, T);
    // real defeat path: match point for the threats and a lethal hit
    await G(() => { const g = window.__counter.game, S = g.state; S.them = 3; S.p.inv = 0; S.p.armor = 0; g.sim.hurt(999, 0, 0, 'phish'); });
    await page.waitForFunction(() => !document.getElementById('cbBanner').hidden, null, T);
    await page.waitForSelector('[data-act="again"]', { timeout: 120000 }); assert.equal(await page.$$eval('.cb-sb tr', n => n.length), 8);
    await page.click('[data-act="again"]'); await page.waitForFunction(() => window.__counter.game.phase === 'play' && window.__counter.game.state.phase === 'buy' && window.__counter.game.state.them === 0, null, T);
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('counter browser smoke: ok');
} finally { await browser.close(); await new Promise(r => srv.server.close(r)); }
