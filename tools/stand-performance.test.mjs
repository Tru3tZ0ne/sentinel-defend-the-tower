// Fixed rendering load, not a natural-play or hardware-FPS benchmark.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

export async function inspectStandLoad(page, url, label = 'current') {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url + '/stand.html');
  await page.locator('[data-act="play"]').click();
  await page.waitForFunction(() => window.__stand?.game.state.elapsed > .1);
  await page.evaluate(async () => {
    const g = window.__stand.game, { ENEMIES, WEAPONS } = await import(new URL('src/stand/model.js', location.href));
    for (const [id, spec] of Object.entries(WEAPONS)) while ((g.state.levels[id] || 0) < spec.max) g.applyUpgrade(id);
    g.state.pendingLevels = 0; g.useAbility('pt'); g.useAbility('rt'); g.pause();
    const s = g.state, canvas = document.querySelector('#stCanvas'), w = canvas.clientWidth;
    const h=canvas.clientHeight, barY=h-Math.max(52,h*.09), fieldL=(w-440)/2, fieldR=fieldL+440;
    s.cc={life:.5,bands:[h*.34,h*.55],width:42,dmg:100};
    const hub={id:'XDR',x:fieldR-23,y:barY-78};
    s.link={age:.3,charge:.65,duration:1.1,hub,devices:[hub,...s.shooters.filter(sh=>sh.kind!=='op').map(sh=>({id:sh.kind==='edr'?'EDR':'MDR',x:sh.fixed?fieldL+440*sh.frac:s.op.x+sh.off,y:barY-50})),
      {id:'NDR',x:fieldR-34,y:barY-30},{id:'AF',x:s.op.x-120,y:s.op.y-62},{id:'AF',x:s.op.x+120,y:s.op.y-62},
      {id:'IAG',x:fieldL+23,y:h*.44},{id:'ASTOR',x:fieldL+23,y:barY-17},{id:'HCI',x:fieldL+65,y:barY-113},{id:'AI',x:fieldL+23,y:barY-184},{id:'AGENT',x:fieldL+23,y:barY-258}]};
    s.beam={x:hub.x,y:hub.y,tx:w/2-100,ty:100,width:100,life:.7,dmg:100};
    s.elapsed = 120; s.shake = 0; s.flash = 0; s.parts = []; s.fxr = []; s.texts = [];
    const types = ['recon', 'malware', 'worm', 'apt', 'exfil'];
    s.enemies = Array.from({ length: 64 }, (_, i) => {
      const type = types[i % types.length], spec = ENEMIES[type];
      return { id: 80000 + i, type, spec, x: w / 2 + ((i % 8) - 3.5) * 48,
        y: 80 + Math.floor(i / 8) * 70, r: spec.r, hp: 150, maxhp: 300, slow: 0, hit: i % 4 ? 0 : 1,
        wob: i * .1, spawnAcc: 0, marked: true, afWeakened: false };
    });
    s.shots = Array.from({ length: 256 }, (_, i) => ({ x: w / 2 + ((i % 16) - 7.5) * 24,
      y: 70 + Math.floor(i / 16) * 45, vx: 0, vy: -980, dmg: 20, pierce: 1, hit: new Set(), r: 4.5,
      color: ['#9be85a', '#ff8a5a', '#58c8ff'][i % 3] }));
  });
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await settle();
  const full = await page.evaluate(() => window.__stand.game.diagnostics);
  await mkdir('tools/shots', { recursive: true });
  await page.screenshot({ path: `tools/shots/stand-performance-${label}.png` });
  // Removal/reintroduction must not allocate another complete wave of resources.
  await page.evaluate(() => { window.__loadEnemies = window.__stand.game.state.enemies; window.__stand.game.state.enemies = []; });
  await settle();
  await page.evaluate(() => { window.__stand.game.state.enemies = window.__loadEnemies; });
  await settle();
  const restored = await page.evaluate(() => window.__stand.game.diagnostics);
  await page.evaluate(() => { window.__stand.game.state.shots = []; }); await settle();
  const noShots = await page.evaluate(() => window.__stand.game.diagnostics);
  assert.equal(full.enemies, 64); assert.equal(full.shots, 256);
  assert.ok(full.calls < 450, `Full-frame draw budget: ${full.calls}`);
  assert.equal(full.calls - noShots.calls, 1, 'Every bullet must share one draw');
  assert.equal(restored.geometries, full.geometries);
  // Retain per-enemy cloak/hit states, including after the pool is warm.
  // Explicit clipping avoids an element-stability wait on software-rendered canvas.
  const canvasShot = async () => page.screenshot({clip: await page.locator('#stCanvas').boundingBox()});
  const revealed = await canvasShot();
  await page.evaluate(() => { window.__stand.game.state.squad.ndrReveal = false; }); await settle();
  const cloaked = await canvasShot();
  assert.notDeepEqual(revealed, cloaked, 'Cloaking must still change the rendered creatures');
  const warmed = await page.evaluate(() => window.__stand.game.diagnostics);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { window.__stand.game.state.squad.ndrReveal = true; }); await settle();
    await page.evaluate(() => { window.__stand.game.state.squad.ndrReveal = false; }); await settle();
  }
  const reused = await page.evaluate(() => window.__stand.game.diagnostics);
  for (const key of ['geometries', 'textures', 'programs', 'cachedEnemyBatches']) assert.equal(reused[key], warmed[key], key);
  await page.evaluate(() => {
    const s = window.__stand.game.state;
    s.shots = Array.from({ length: 513 }, (_, i) => ({ x: s.op.x + (i % 8) * 5, y: 100 + i,
      color: '#9be85a' }));
  }); await settle();
  const grown = await page.evaluate(() => window.__stand.game.diagnostics);
  assert.equal(grown.shots, 513); assert.equal(grown.bulletCapacity, 1024);
  assert.equal(grown.geometries, warmed.geometries, 'Bullet capacity growth must retain shared geometry');
  await page.evaluate(() => window.__stand.game.start()); await settle();
  await page.evaluate(() => window.__stand.game.pause());
  assert.ok(await page.evaluate(() => window.__stand.game.state.elapsed < 5));
  const restarted = await page.evaluate(() => window.__stand.game.diagnostics);
  assert.equal(restarted.enemies, 0);
  assert.deepEqual(errors, []);
  return { full, restored, noShots, bulletDraws: full.calls - noShots.calls, reused, grown, restarted };
}

if (process.argv[1]?.endsWith('stand-performance.test.mjs')) {
  const { server, url } = await startServer(0);
  const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist'] });
  try {
    const label = process.argv[2] || 'current';
    const page = await browser.newPage();
    const result = await inspectStandLoad(page, url, label);
    await page.close();
    // Keep native high-DPI rendering: no resolution or quality fallback.
    const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 600, height: 600 } });
    const retina = await context.newPage(); await retina.goto(url + '/stand.html');
    await retina.locator('[data-act="play"]').click();
    await retina.waitForFunction(() => window.__stand?.game.state.elapsed > .1);
    result.retina = await retina.evaluate(() => {
      const canvas = document.querySelector('#stCanvas');
      return { pixelRatio: window.__stand.game.diagnostics.pixelRatio, ratio: canvas.width / canvas.clientWidth };
    });
    assert.equal(result.retina.pixelRatio, 2); assert.equal(result.retina.ratio, 2);
    await context.close();
    await writeFile(`tools/shots/stand-performance-${label}.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); server.close(); }
}
