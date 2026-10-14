// Verify that every purchased capability creates a persistent, discoverable entity
// and that refund/restart removes its geometry and picking targets.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const { server, url } = await startServer(0);
// Use the native desktop GPU on Windows; Linux CI remains headless.
const browser = await chromium.launch({ headless: process.platform !== 'win32', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
// Panels repaint on each purchase/refund, so under software-WebGL (frames seconds apart) a pixel
// click races the repaint and the button detaches. Click synchronously inside the page: querySelector
// resolves the CURRENT (attached) element and .click() bubbles to the real delegated handler in one
// page turn — robust to the slow renderer while still exercising the real handler and asserting state.
const clickSel = async selector => {
  const ok = await page.evaluate(sel => {
    const el = [...document.querySelectorAll(sel)].find(e => e.getClientRects().length) || document.querySelector(sel);
    if (!el || el.disabled) return false; el.click(); return true;
  }, selector);
  if (!ok) throw new Error('click: no enabled element for ' + selector);
};
const click = clickSel;
const operations = ['HCI', 'ADC', 'SASE', 'AICP'];
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.__sentinel.charactersReady);
  await click('[data-act="start"]');
  for (const id of ['AF', 'EDR', 'NDR', 'IAG', 'XDR', 'MDR', 'ASTOR', ...operations]) {
    console.log('Checking ' + id);
    await click(`[data-act="tab"][data-tab="${operations.includes(id) ? 'cloud' : 'defense'}"]`);
    const result = await page.evaluate(({ id, operation }) => {
      const s = window.__sentinel;
      const budget = s.engine.budget;
      const result = operation ? s.engine.deployOperation(id) : s.engine.deploy(id, id === 'EDR' ? 'office#2' : undefined);
      const entry = s.deployments.get(id, id === 'EDR' ? 'office#2' : undefined);
      let meshes = 0, triangles = 0;
      entry?.group.traverse(o => {
        if (o.isMesh) { meshes++; triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3; }
      });
      return { ok: result.ok, count: s.deployments.entries.size, meshes, triangles,
        spent: budget - s.engine.budget, level: entry?.level, room: entry?.room };
    }, { id, operation: operations.includes(id) });
    assert.ok(result.ok && result.spent > 0, id + ' must be a real affordable purchase');
    assert.equal(result.count, 1);
    assert.ok(result.meshes >= (id === 'EDR' ? 3 : 4) && result.triangles > (id === 'EDR' ? 24 : 40), id + ' needs an actual scene representation');
    assert.equal(result.level, id === 'SASE' ? 'L2' : 'L3');
    const card = page.locator(`[data-act="locateDeployment"][data-id="${id}"]`);
    await card.waitFor();
    await card.first().evaluate(el => { if (!el.disabled) el.click(); });
    await page.waitForTimeout(850);
    assert.ok(await page.locator('#inspect .deployment-state').isVisible());
    assert.equal(await page.locator('#inspect [data-product-mark]').getAttribute('data-product-mark'), id);
    const focus = await page.evaluate(id => {
      const s = window.__sentinel;
      const entry = s.deployments.get(id, id === 'EDR' ? 'office#2' : undefined);
      const target = entry.position.clone(); target.y += .8;
      return { distance: s.world.controls.target.distanceTo(target),
        floorPressed: document.querySelector(`.fs-btn[data-floor="${entry.level}"]`)?.getAttribute('aria-pressed') };
    }, id);
    assert.ok(focus.distance < .15, id + ' card must locate the actual device');
    assert.equal(focus.floorPressed, 'true');
    if (id === 'AF') {
      // Close/reopen via the actual cabinet body, not only the product card.
      await page.locator('[data-act="closeInspect"]').first().evaluate(el => { if (!el.disabled) el.click(); });
      const point = await page.evaluate(() => {
        const s = window.__sentinel;
        const p = s.deployments.get('AF').position.clone().add(new s.world.THREE.Vector3(0, .6, .52));
        p.project(s.world.camera);
        return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
      });
      await page.mouse.click(point.x, point.y);
      await page.waitForFunction(() => document.querySelector('#inspect .deployment-state'));
      assert.equal(await page.locator('#inspect [data-product-mark]').getAttribute('data-product-mark'), 'AF');
    }
    await page.locator('[data-act="undoSetup"]').first().evaluate(el => { if (!el.disabled) el.click(); });
    await page.waitForFunction(() => window.__sentinel.deployments.entries.size === 0 && !document.querySelector('#dock [data-act="locateDeployment"]'));
    assert.equal(await page.evaluate(() => window.__sentinel.deployments.pickables.length), 0);
    assert.ok(await page.locator('#inspect').evaluate(el => el.classList.contains('hidden')));
    console.log(id + ': purchase, locate and removal passed');
  }

  // Distinct endpoint instances are independently represented and refunded.
  await page.evaluate(() => {
    const s = window.__sentinel;
    s.newGame('storm', 'guided');
    s.engine.deploy('EDR', 'office#2');
    s.engine.deploy('EDR', 'l2-finance#1');
    s.engine.deployOperation('SASE');
  });
  await page.locator('[data-act="tab"][data-tab="defense"]').first().evaluate(el => { if (!el.disabled) el.click(); });
  const edrLocate = page.locator('[data-act="locateDeployment"][data-id="EDR"]');
  await edrLocate.first().evaluate(el => { if (!el.disabled) el.click(); });
  assert.equal(await page.locator('[data-act="deploymentEndpoint"]').getAttribute('data-target'), 'office#2');
  await edrLocate.first().evaluate(el => { if (!el.disabled) el.click(); });
  assert.equal(await page.locator('[data-act="deploymentEndpoint"]').getAttribute('data-target'), 'l2-finance#1');
  assert.ok(await page.locator('[data-act="pick"][data-id="EDR"]').isEnabled(), 'locating existing agents must retain placement');
  await page.locator('[data-act="pick"][data-id="EDR"]').first().evaluate(el => { if (!el.disabled) el.click(); });
  await page.locator('.deck-place').waitFor();
  await page.locator('[data-act="cancel"]').first().evaluate(el => { if (!el.disabled) el.click(); });
  await page.locator('[data-act="deploymentEndpoint"]').first().evaluate(el => { if (!el.disabled) el.click(); });
  assert.match(await page.locator('#inspect').innerText(), /Finance.*l2-finance#1/i);
  await page.locator('[data-act="lang"]').first().evaluate(el => { if (!el.disabled) el.click(); });
  await edrLocate.first().evaluate(el => { if (!el.disabled) el.click(); });
  assert.equal(await page.locator('#inspect .deployment-state').innerText(), '代理已安装在此终端');
  assert.equal(await page.locator('.deployment-inventory').count(), 0, 'no duplicate deployment strip');
  await page.setViewportSize({ width: 390, height: 844 });
  await edrLocate.scrollIntoViewIfNeeded();
  await edrLocate.first().evaluate(el => { if (!el.disabled) el.click(); });
  assert.ok(await page.locator('#inspect .deployment-state').isVisible());
  assert.ok(await page.locator('.deck').evaluate(el => el.scrollWidth > el.clientWidth));
  await page.locator('[data-act="resetSetup"]').first().evaluate(el => { if (!el.disabled) el.click(); });
  await page.waitForFunction(() => window.__sentinel.deployments.entries.size === 0);
  assert.equal(await page.evaluate(() => window.__sentinel.engine.budget), 22);
  assert.deepEqual(errors, []);
  console.log('Deployment entities: all 11 capabilities, paid placement, existing-card locate, physical picking, both floors, undo/reset, EN/ZH and mobile passed.');
} finally {
  await browser.close();
  server.close();
}
