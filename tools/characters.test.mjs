// Real-asset regression coverage: late loading, navigation, animation and restart.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const { server, url } = await startServer(0);
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let releaseAssets;
const assetGate = new Promise(resolve => { releaseAssets = resolve; });
await page.route('**/assets/models/office/*.glb', async route => {
  await assetGate;
  await route.continue();
});

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__sentinel);
  await page.locator('[data-act="start"]').click();
  const before = await page.evaluate(() => {
    const s = window.__sentinel;
    s.engine.deploy('EDR', 'office#2');
    window.__beforeAssets = { engine: s.engine, group: s.people.get('e1').group };
    return { fallback: !s.people.get('e1').fig.isGLB, budget: s.engine.budget };
  });
  assert.ok(before.fallback, 'start controls must work before character downloads finish');
  releaseAssets();
  assert.deepEqual(await page.evaluate(() => window.__sentinel.charactersReady), ['josh', 'martha']);
  const loaded = await page.evaluate(() => {
    const s = window.__sentinel;
    return { engineUnchanged: s.engine === window.__beforeAssets.engine,
      groupUnchanged: s.people.get('e1').group === window.__beforeAssets.group,
      budget: s.engine.budget, edr: s.engine.edrDesks.has('office#2'),
      allRigged: s.people.list.every(p => p.fig.isGLB),
      identity: s.people.get('e1').group.userData.personId };
  });
  assert.deepEqual(loaded, { engineUnchanged: true, groupUnchanged: true,
    budget: before.budget, edr: true, allRigged: true, identity: 'e1' });

  const animation = await page.evaluate(() => {
    const s = window.__sentinel, p = s.people.get('e1');
    for (const q of s.people.list) q.wander = false;
    const originY = p.pos.y;
    s.people.setRoute(p, 'desk:office#2');
    s.people.update(1 / 60);
    const walking = p.fig.activePose;
    for (let i = 0; i < 1200; i++) s.people.update(1 / 60);
    p.group.updateWorldMatrix(true, true);
    p.fig.model.traverse(o => { if (o.isSkinnedMesh) o.computeBoundingBox(); });
    const box = new s.world.THREE.Box3().setFromObject(p.fig.model);
    const time = p.fig.actions.work.time;
    s.people.update(0);
    const frozen = p.fig.actions.work.time === time;
    const seated = p.fig.activePose;
    const footOffset = box.min.y - p.pos.y;
    const seatedHeight = box.max.y - p.pos.y;
    const arrived = p.pos.distanceTo(s.building.nav.nodes.get('desk:office#2').pos);
    const rootOffset = p.group.position.distanceTo(p.pos);
    p.halted = true;
    for (let i = 0; i < 30; i++) s.people.update(1 / 60);
    const standing = p.fig.activePose;
    const heightDrift = p.pos.y - originY;
    p.halted = false;
    s.people.setRoute(p, 'desk:l2-finance#1');
    for (let i = 0; i < 3000; i++) s.people.update(1 / 60);
    return { walking, seated, standing, frozen, footOffset, seatedHeight, arrived,
      rootOffset, heightDrift, floorY: p.pos.y,
      floorTarget: s.building.nav.nodes.get('desk:l2-finance#1').pos.y,
      floorArrival: p.pos.distanceTo(s.building.nav.nodes.get('desk:l2-finance#1').pos) };
  });
  assert.equal(animation.walking, 'walk');
  assert.equal(animation.seated, 'work');
  assert.equal(animation.standing, 'idle');
  assert.ok(animation.frozen, 'zero simulation delta freezes the animation');
  assert.ok(Math.abs(animation.footOffset) < .12, 'seated feet stay grounded');
  assert.ok(animation.seatedHeight > .8 && animation.seatedHeight < 1.25, 'work pose is seated');
  assert.ok(animation.arrived < .001 && animation.rootOffset < .001);
  assert.ok(Math.abs(animation.heightDrift) < .001, 'animation never changes navigation height');
  assert.ok(animation.floorArrival < .001 && animation.floorY === animation.floorTarget,
    'the rig must follow the existing cross-floor route');

  const restart = await page.evaluate(() => {
    const s = window.__sentinel;
    const originalGeometry = [];
    const originalMaterials = [];
    let sharedDisposed = 0;
    s.people.get('e1').fig.model.traverse(o => {
      if (!o.isMesh) return;
      originalGeometry.push(o.geometry); originalMaterials.push(o.material);
      o.geometry.addEventListener('dispose', () => sharedDisposed++);
      o.material.addEventListener('dispose', () => sharedDisposed++);
      for (const value of Object.values(o.material)) {
        if (value?.isTexture) value.addEventListener('dispose', () => sharedDisposed++);
      }
    });
    for (let i = 0; i < 4; i++) s.newGame();
    const geometry = [], materials = [];
    s.people.get('e1').fig.model.traverse(o => {
      if (o.isMesh) { geometry.push(o.geometry); materials.push(o.material); }
    });
    return { rigged: s.people.list.every(p => p.fig.isGLB), sharedDisposed,
      shared: geometry.every((g, i) => g === originalGeometry[i]) &&
        materials.every((m, i) => m === originalMaterials[i]) };
  });
  assert.deepEqual(restart, { rigged: true, sharedDisposed: 0, shared: true });
  await page.locator('[data-act="lang"]').click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  assert.ok(await page.evaluate(() => window.__sentinel.people.list.every(p => p.fig.isGLB)));

  // Both failed and partially available libraries remain playable.
  await page.unroute('**/assets/models/office/*.glb');
  await page.route('**/assets/models/office/*.glb', route => route.abort());
  await page.reload({ waitUntil: 'networkidle' });
  assert.deepEqual(await page.evaluate(() => window.__sentinel.charactersReady), []);
  await page.locator('[data-act="start"]').click();
  assert.ok(await page.evaluate(() => window.__sentinel.people.list.every(p => !p.fig.isGLB)));
  await page.unroute('**/assets/models/office/*.glb');
  await page.route('**/assets/models/office/martha.glb', route => route.abort());
  await page.reload({ waitUntil: 'networkidle' });
  assert.deepEqual(await page.evaluate(() => window.__sentinel.charactersReady), ['josh']);
  assert.ok(await page.evaluate(() => window.__sentinel.people.list.every(p => p.fig.assetId === 'josh')));
  assert.deepEqual(errors, []);
  console.log('Office characters: late loading, poses, grounding, cross-floor navigation, pause, restart, EN/ZH and fallback passed.');
} finally {
  releaseAssets();
  await browser.close();
  server.close();
}
