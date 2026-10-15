// Exercise real controls and canvas picking; engine-only smoke tests cannot catch UI regressions.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { startServer } from './serve.mjs';

const { server, url } = await startServer(0);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const errors = [], externalRequests = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(url)) externalRequests.push(request.url()); });
// These controls live in panels that re-paint whenever state changes (e.g. buying one
// operation changes every card's affordable/disabled state, replacing the deck body). Under
// software-WebGL, frames are seconds apart, so a pixel-level click races the re-paint and the
// target button detaches or scrolls out ("Element is not visible"). We instead confirm the
// control is visible, then fire the app's real (delegated) click handler via the DOM — robust
// to the slow renderer while still exercising the actual handler and asserting resulting state.
// Coordinate-click coverage (nothing invisibly covers the UI) stays in smoke.mjs (start/begin,
// real mouse clicks) and in the canvas deploys below (page.mouse.click on both floors).
const click = async selector => {
  await page.locator(selector).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30000 });
  // Click synchronously inside the page: querySelector resolves the CURRENT (attached) element and
  // .click() bubbles to the real delegated handler in one page turn — no Playwright round-trip to
  // race the panel re-paint under software-WebGL. State is still asserted after each click.
  const ok = await page.evaluate(sel => {
    const el = [...document.querySelectorAll(sel)].find(e => e.getClientRects().length) || document.querySelector(sel);
    if (!el || el.disabled) return false; el.click(); return true;
  }, selector);
  if (!ok) throw new Error('click: no enabled element for ' + selector);
};
const settleCamera = () => page.waitForTimeout(1000);
async function canvasPoint(id, kind = 'room') {
  return page.evaluate(({ id, kind }) => {
    const s = window.__sentinel, b = s.building;
    const mesh = kind === 'room' ? b.rooms.get(id).pad : b.desks.get(id).deskMesh;
    const v = mesh.getWorldPosition(new s.world.THREE.Vector3()).project(s.world.camera);
    return { x: (v.x + 1) * innerWidth / 2, y: (1 - v.y) * innerHeight / 2 };
  }, { id, kind });
}
try {
  await mkdir('tools/shots', { recursive: true });
  await page.goto(url, { waitUntil: 'networkidle' });
  await click('[data-act="mission"][data-id="storm"]');
  await click('[data-act="difficulty"][data-id="guided"]');
  await click('[data-act="lang"]');
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  assert.match(await page.locator('.mission-option.selected').innerText(), /业务风暴/);
  assert.match(await page.locator('.assignment-resources').innerText(), /22/);
  await page.screenshot({ path: 'tools/shots/session-start-zh.png' });
  await click('[data-act="lang"]');
  await click('[data-act="start"]');
  assert.equal(await page.evaluate(() => window.__sentinel.engine.budget), 22);
  assert.equal(await page.evaluate(() => window.__sentinel.engine.inc.id), 'storm');
  await settleCamera();
  assert.equal(await page.locator('.sophia-id b').textContent(), 'Solvia');
  assert.ok(await page.locator('.sophia-portrait').evaluate(img => img.complete && img.naturalWidth === 200));
  assert.ok(await page.locator('.family-logo').first().evaluate(img => img.complete && img.naturalWidth > 0));
  assert.equal(await page.locator('.pcard .product-mark').count(), 7);
  assert.ok(await page.locator('.pcard .product-mark').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)), 'every defense product must load its official artwork');
  const characterState = await page.evaluate(() => {
    const s = window.__sentinel, p = s.people.get('e1'); p.wander = false; p.halted = false;
    s.people.setRoute(p, p.currentNode.startsWith('desk:') ? 'room:office' : 'desk:office#2');
    const before = p.pos.y;
    for (let i = 0; i < 120; i++) s.people.update(1 / 60);
    return { drift: Math.abs(p.pos.y - before), height: p.pos.y };
  });
  assert.ok(characterState.drift < .001 && Math.abs(characterState.height - .05) < .001, 'walking animation must not drift above the floor');
  await click('[data-act="tab"][data-tab="cloud"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.operation-head .product-mark')].filter(img => img.complete && img.naturalWidth > 0).length === 4);
  const stableDefenseTab = await page.locator('[data-act="tab"][data-tab="defense"]').elementHandle();
  await click('[data-act="operation"][data-id="HCI"]');
  await page.waitForFunction(() => window.__sentinel.engine.budget === 18);
  await click('[data-act="undoSetup"]');
  await page.waitForFunction(() => window.__sentinel.engine.budget === 22 && !window.__sentinel.engine.operations.has('HCI'));
  assert.ok(await stableDefenseTab.evaluate(el => el.isConnected), 'purchase/refund updates must preserve navigation controls');
  await click('[data-act="operation"][data-id="ADC"]');
  await click('[data-act="resetSetup"]');
  await page.waitForFunction(() => window.__sentinel.engine.budget === 22 && !window.__sentinel.engine.operations.size);
  for (const id of ['HCI', 'ADC', 'SASE', 'AICP']) {
    await click(`[data-act="operation"][data-id="${id}"]`);
    await page.waitForFunction(id => window.__sentinel.engine.operations.has(id), id);
  }
  assert.equal(await page.evaluate(() => window.__sentinel.engine.budget), 8);
  await page.screenshot({ path: 'tools/shots/session-cloud-en.png' });
  await click('[data-act="tab"][data-tab="ops"]');
  await click('[data-act="helperRule"][data-rule="recover"]');
  assert.equal(await page.evaluate(() => window.__sentinel.engine.helperRule), 'recover');
  await click('[data-act="tab"][data-tab="defense"]');
  await click('[data-act="pick"][data-id="ASTOR"]');
  await page.mouse.click(...Object.values(await canvasPoint('server')));
  await page.waitForFunction(() => window.__sentinel.engine.astorReady);
  await click('[data-act="floor"][data-floor="L2"]');
  await settleCamera();
  await click('[data-act="pick"][data-id="EDR"]');
  const deskPoint = await canvasPoint('l2-finance#1', 'desk');
  await page.mouse.click(deskPoint.x, deskPoint.y);
  await page.waitForFunction(() => window.__sentinel.engine.edrDesks.has('l2-finance#1'));
  const levelState = await page.evaluate(() => {
    const s = window.__sentinel;
    const hiddenPick = s.world.pick(innerWidth / 2, innerHeight / 2, s.building.pickables);
    return { l2: s.building.floors.find(f => f.id === 'L2').group.visible,
      l3: s.building.floors.find(f => f.id === 'L3').group.visible,
      l3Effects: s.world.scene.getObjectByName('effects:L3').visible,
      l2Effects: s.world.scene.getObjectByName('effects:L2').visible,
      pickedRoom: hiddenPick?.entity.roomId };
  });
  // Clicking a floor goes INTO just that level: only it (and its effects) stays visible.
  assert.equal(levelState.l2, true); assert.equal(levelState.l3, false);
  assert.equal(levelState.l2Effects, true); assert.equal(levelState.l3Effects, false);
  // The overview control restores the whole tower.
  await click('[data-act="overview"]');
  await settleCamera();
  const towerState = await page.evaluate(() => { const vis = id => window.__sentinel.building.floors.find(f => f.id === id).group.visible; return { l2: vis('L2'), l3: vis('L3'), l4: vis('L4') }; });
  assert.ok(towerState.l2 && towerState.l3 && towerState.l4, 'overview shows the whole tower');
  await page.screenshot({ path: 'tools/shots/session-floor2-en.png' });
  await click('[data-act="begin"]');
  await page.evaluate(() => { window.__sentinel.engine._paused = true; document.activeElement.blur(); });
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => window.__sentinel.engine._paused), false);
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => window.__sentinel.engine._paused), true);
  await click('[data-act="tab"][data-tab="cloud"]');
  // An installed capability remains inspectable during an incident, without another purchase.
  const incidentBudget = await page.evaluate(() => window.__sentinel.engine.budget);
  await click('[data-act="locateDeployment"][data-id="HCI"]');
  assert.equal(await page.locator('#inspect [data-product-mark]').getAttribute('data-product-mark'), 'HCI');
  assert.equal(await page.evaluate(() => window.__sentinel.engine.budget), incidentBudget);
  assert.equal(await page.evaluate(() => window.__sentinel.engine.deployOperation('HCI').ok), false);
  await page.evaluate(() => {
    const g = window.__sentinel.engine;
    const afterRansom = g.inc.beats.find(b => b.act === 'ransom').t + 12 + 4 + .5;
    while (g.time < afterRansom && !g.ended) g.tick(.1);
  });
  assert.equal(await page.evaluate(() => window.__sentinel.engine.lockedRooms.size), 0);
  assert.equal(await page.evaluate(() => window.__sentinel.engine.log.filter(e => e.action === 'recover').length), 1);
  await click('.operation-card:first-child [data-act="location"]');
  await click('[data-act="lockdown"][data-room="server"]');
  await page.waitForSelector('#endScreen:not(.hidden)');
  assert.match(await page.locator('.end-head h1').innerText(), /contain/i);
  const attackCount = await page.evaluate(() => window.__sentinel.engine.log.filter(e => e.kind === 'attack').length);
  assert.equal(await page.locator('.tl-row').count(), attackCount);
  assert.ok(attackCount < 8, 'debrief must omit future unexecuted attacks');
  await page.screenshot({ path: 'tools/shots/session-review-en.png' });
  const downloadPromise = page.waitForEvent('download');
  await click('[data-act="exportReport"]');
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'sentinel-session.json');
  const stream = await download.createReadStream(); let reportText = '';
  for await (const chunk of stream) reportText += chunk;
  const report = JSON.parse(reportText);
  assert.equal(report.mission, 'Under Pressure'); assert.equal(report.outcome, 'contained');
  assert.ok(report.events.some(e => e.action === 'recover'));
  await click('[data-act="replayPlay"]');
  assert.equal(await page.locator('.tl-row.active').getAttribute('data-step'), '0');
  await click('[data-act="backToGame"]');
  await click('[data-act="changeAssignment"]');
  assert.equal(await page.locator('[data-act="start"]').count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await click('[data-act="lang"]');
  const startButton = page.locator('[data-act="start"]');
  await startButton.scrollIntoViewIfNeeded();
  assert.equal(await startButton.isVisible(), true);
  assert.equal(await page.evaluate(() => document.querySelector('.startScreen').scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'tools/shots/session-mobile-zh.png' });
  await click('[data-act="start"]');
  await click('[data-act="begin"]');
  await click('[data-act="pause"]');
  assert.equal(await page.evaluate(() => window.__sentinel.engine._paused), true);
  const hudFit = await page.evaluate(() => {
    const left = document.querySelector('.hud-left').getBoundingClientRect();
    const right = document.querySelector('.hud-right').getBoundingClientRect();
    return left.right <= right.left && right.right <= innerWidth;
  });
  assert.ok(hudFit, 'mobile live controls overlap the brand or leave the viewport');
  await page.screenshot({ path: 'tools/shots/session-mobile-live-zh.png' });
  assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
  console.log('UI passed: mission/difficulty, EN/ZH, operations, helper, real canvas deployment on both floors, pause, recovery, debrief, report, replay, mobile and local-only requests.');
} catch (error) {
  await page.screenshot({ path: 'tools/shots/ui-failure.png' }).catch(() => {});
  throw error;
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
