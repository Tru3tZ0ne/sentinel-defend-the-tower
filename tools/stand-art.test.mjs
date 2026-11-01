// Rendering integration checks. Explicit fixtures below are not balance/playthrough evidence.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

export async function verifyStandArt(page, url, shots = 'tools/shots') {
  await mkdir(shots, { recursive: true });
  const errors = [], badResources = [];
  const onError = error => errors.push(error.message);
  const onConsole = message => { if (message.type() === 'error') errors.push(message.text()); };
  const onResponse = response => { if (response.status() >= 400) badResources.push(response.url()); };
  page.on('pageerror', onError); page.on('response', onResponse); page.on('console', onConsole);
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const metrics = {};
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(url + '/stand-sangfor.html');
    await page.locator('[data-act="play"]').waitFor();
    await page.screenshot({ path: shots + '/stand-sangfor-menu-en.png' });
    await page.locator('[data-act="lang"]').click();
    await page.locator('[data-act="play"]').waitFor();
    assert.match(await page.locator('.ar-tag').innerText(), /EDR|部署|防线/);
    await page.screenshot({ path: shots + '/stand-sangfor-menu-zh.png' });
    await page.locator('[data-act="lang"]').click();
    await page.locator('[data-act="play"]').click();
    await page.waitForFunction(() => window.__stand?.game.state?.elapsed > .1);
    assert.equal(await page.evaluate(() => window.__stand.game.diagnostics.art), 'sangfor');
    // A one-hit, one-XP target exercises actual shooting -> XP -> choice -> deployment.
    await page.evaluate(async () => {
      const { ENEMIES } = await import(new URL('src/stand/model.js', location.href));
      const s = window.__stand.game.state, spec = ENEMIES.recon;
      s.xp = s.xpNeed - 1;
      s.enemies = [{ id: 70000, type: 'recon', spec, x: s.op.x, y: s.op.y - 130,
        r: spec.r, hp: 1, maxhp: 1, slow: 0, hit: 0, wob: 0, marked: false }];
    });
    await page.locator('.st-card').first().waitFor({ timeout: 30000 });
    assert.equal(await page.locator('.st-equipment-preview').count(), 3);
    assert.ok(await page.locator('.st-equipment-preview').evaluateAll(images => images.every(i => i.complete && i.naturalWidth > 0)));
    await page.screenshot({ path: shots + '/stand-sangfor-upgrades.png' });
    const upgrade = await page.locator('.st-card').first().getAttribute('data-up');
    await page.locator('.st-card').first().click();
    assert.equal(await page.evaluate(id => window.__stand.game.state.levels[id], upgrade), 1);
    // All product renderers and every normal/boss silhouette, in a paused inspection fixture.
    await page.evaluate(async () => {
      const g = window.__stand.game;
      for (const id of ['EDR', 'EDR', 'EDR', 'MDR', 'AF', 'NDR', 'IAG', 'HCI', 'XDR', 'ASTOR']) g.applyUpgrade(id);
      g.state.pendingLevels = 0; g.pause();
      const s = g.state, { ENEMIES } = await import(new URL('src/stand/model.js', location.href));
      s.parts = []; s.fxr = []; s.texts = []; s.shake = 0; s.flash = 0; s.afHp = s.afMax;
      s.xpNeed = 1e9;
      const width = document.querySelector('#stCanvas').clientWidth;
      s.enemies = Object.keys(ENEMIES).map((type, i) => {
        const spec = ENEMIES[type];
        return { id: 71000 + i, type, spec, x: width / 2 + ((i % 3) - 1) * 115,
          y: 130 + Math.floor(i / 3) * 150, r: spec.r, hp: spec.hp, maxhp: spec.hp,
          slow: 0, hit: 0, wob: 0, marked: false, spawnAcc: 0 };
      });
    });
    await settle();
    metrics.inspection = await page.evaluate(() => window.__stand.game.diagnostics);
    assert.ok(metrics.inspection.calls < 300, JSON.stringify(metrics.inspection));
    assert.ok(metrics.inspection.triangles < 150000);
    await page.screenshot({ path: shots + '/stand-sangfor-all-products-threats-FIXTURE.png' });
    const paused = await page.evaluate(() => window.__stand.game.state.elapsed);
    await settle();
    assert.equal(await page.evaluate(() => window.__stand.game.state.elapsed), paused);
    // Shared template geometry must remain bounded after repeated unit rebuilds.
    await page.evaluate(() => { const g = window.__stand.game; g.applyUpgrade('EDR'); g.pause(); }); await settle();
    const warmed = await page.evaluate(() => window.__stand.game.diagnostics.geometries);
    for (let i = 0; i < 6; i++) { await page.evaluate(() => { const g = window.__stand.game; g.applyUpgrade('EDR'); g.pause(); }); await settle(); }
    const rebuilt = await page.evaluate(() => window.__stand.game.diagnostics.geometries);
    assert.ok(rebuilt <= warmed + 2, `Geometry growth: ${warmed} -> ${rebuilt}`);
    metrics.rebuildGeometry = { warmed, rebuilt };
    const abilities = await page.evaluate(() => {
      const g = window.__stand.game; g.state.pendingLevels = 0; g.resume();
      return { pt: g.useAbility('pt'), rt: g.useAbility('rt'), ir: g.useAbility('ir'), secondPt: g.useAbility('pt'), count: g.state.temps.length };
    });
    assert.deepEqual(abilities, { pt: true, rt: true, ir: true, secondPt: false, count: 9 });
    await page.waitForFunction(() => window.__stand.game.state.elapsed > .6);
    await page.evaluate(() => window.__stand.game.pause()); await settle();
    assert.equal(await page.locator('#stLevelUp').count(), 0);
    await page.screenshot({ path: shots + '/stand-sangfor-service-teams-FIXTURE.png' });
    // Reset and phone movement, without retaining any purchased equipment.
    await page.evaluate(() => window.__stand.game.start());
    assert.equal(await page.locator('#stLevelUp').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.__stand.game.state.levels), {});
    await page.setViewportSize({ width: 390, height: 844 }); await settle();
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => window.__stand.game.state.elapsed > 1.3);
    await page.keyboard.up('ArrowRight'); await page.evaluate(() => window.__stand.game.pause()); await settle();
    assert.ok(await page.evaluate(() => window.__stand.game.state.op.x < document.querySelector('#stCanvas').clientWidth));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: shots + '/stand-sangfor-mobile-right.png' });
    metrics.mobile = await page.evaluate(() => window.__stand.game.diagnostics);
    // The main entry is the COMBINED build: sculpted models under the cinematic
    // stage. It uses the art models but keeps the default HUD (no preview hero/thumbs).
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(url + '/stand.html'); await page.locator('[data-act="play"]').click();
    await page.waitForFunction(() => window.__stand.game.state.elapsed > .1);
    assert.equal(await page.evaluate(() => window.__stand.game.diagnostics.art), 'combined');
    assert.equal(await page.locator('.st-art-hero').count(), 0);
    await page.evaluate(() => window.__stand.game.pause());
    // The optional showroom shares the actual game models and renders on input.
    await page.goto(url + '/stand-showroom.html');
    await page.waitForFunction(() => window.__showroom?.selected === 'AF');
    assert.ok(await page.locator('#reference img').evaluate(i => i.complete && i.naturalWidth > 0));
    await page.screenshot({ path: shots + '/stand-showroom-ngfw.png' });
    const ids = ['AF', 'EDR', 'NDR', 'IAG', 'HCI', 'XDR', 'ASTOR', 'MDR'];
    for (const id of ids) {
      await page.locator(`[data-model="${id}"]`).click();
      assert.equal(await page.evaluate(() => window.__showroom.selected), id);
      assert.ok(await page.evaluate(() => window.__showroom.diagnostics.triangles > 100));
    }
    const galleryWarm = await page.evaluate(() => window.__showroom.diagnostics.geometries);
    for (const id of ids) await page.locator(`[data-model="${id}"]`).click();
    assert.equal(await page.evaluate(() => window.__showroom.diagnostics.geometries), galleryWarm);
    await page.locator('[data-model="HCI"]').click();
    await page.screenshot({ path: shots + '/stand-showroom-hci.png' });
    await page.locator('#model').focus();
    const beforeRotation = await page.locator('#model').screenshot();
    await page.keyboard.press('ArrowRight');
    const afterRotation = await page.locator('#model').screenshot();
    assert.notDeepEqual(beforeRotation, afterRotation, 'Model rotation must change the rendered view');
    await page.locator('#reset').click();
    await page.locator('#language').click();
    assert.match(await page.locator('#subtitle').innerText(), /近距离/);
    await page.setViewportSize({ width: 390, height: 844 }); await settle();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: shots + '/stand-showroom-mobile-zh.png', fullPage: true });
    metrics.showroom = await page.evaluate(() => window.__showroom.diagnostics);
    await page.locator('#back').click(); await page.locator('[data-act="play"]').waitFor();
    assert.deepEqual(errors, []); assert.deepEqual(badResources, []);
    return metrics;
  } finally {
    page.off('pageerror', onError); page.off('response', onResponse); page.off('console', onConsole);
  }
}

if (process.argv[1]?.endsWith('stand-art.test.mjs')) {
  const { server, url } = await startServer(0);
  const browser = await chromium.launch({ headless: process.env.HEADED !== '1', args: ['--ignore-gpu-blocklist'] });
  try {
    console.log(JSON.stringify(await verifyStandArt(await browser.newPage(), url), null, 2));
    console.log('Last Stand equipment preview checks passed.');
  } finally { await browser.close(); server.close(); }
}
