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
    const hub={id:'XDR',x:s.op.x,y:s.op.y+10};
    const offsets={EDR:[-24,-24],MDR:[30,-4],NDR:[0,-20],AF:[28,0],HCI:[18,5],XDR:[0,10],ASTOR:[-16,16],IAG:[12,20],AI:[-18,-6],AGENT:[-27,4]};
    s.link={age:.3,charge:.65,duration:1.1,hub,devices:Object.entries(offsets).map(([id,[dx,dy]])=>({id,x:s.op.x+dx,y:s.op.y+dy}))};
    s.elapsed = 120; s.shake = 0; s.flash = 0; s.parts = []; s.fxr = []; s.texts = [];
    const types = ['recon', 'malware', 'worm', 'apt', 'exfil'];
    s.enemies = Array.from({ length: 64 }, (_, i) => {
      const type = types[i % types.length], spec = ENEMIES[type];
      return { id: 80000 + i, type, spec, x: w / 2 + ((i % 8) - 3.5) * 48,
        y: 80 + Math.floor(i / 8) * 70, r: spec.r, hp: 150, maxhp: 300, slow: 0, hit: i % 4 ? 0 : 1,
        wob: i * .1, spawnAcc: 0, marked: true, afWeakened: false };
    });
    s.arc={x:hub.x,y:hub.y,age:.3,life:.32,dmg:100,nodes:s.enemies.slice(0,5).map(e=>({id:e.id,x:e.x,y:e.y,height:e.r*.055+.35,hit:true,skipped:false}))};
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
  assert.equal(full.rig.stage, 3); assert.equal(full.rig.modules.length, 10);
  assert.equal(full.rig.groundDevices, 0);
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
  // The separate FX fixture retains every live object and draws it above the full scene.
  await page.evaluate(()=>{
    const s=window.__stand.game.state;
    s.parts=Array.from({length:3000},(_,i)=>({x:s.op.x+(i%30-15)*10,y:90+Math.floor(i/30)*5,r:1.5,life:.6,color:'#9be85a'}));
    s.texts=Array.from({length:80},(_,i)=>({x:s.op.x+(i%8-4)*40,y:150+Math.floor(i/8)*50,life:.7,text:'42',color:'#fff',big:false}));
    s.fxr=Array.from({length:24},(_,i)=>({t:'zap',x1:s.op.x,y1:s.op.y,x2:s.op.x+(i%6-3)*50,y2:120+i*20,life:.5,color:'#9be85a'}));
  }); await settle();
  const effects=await page.evaluate(()=>window.__stand.game.diagnostics);
  assert.equal(effects.particleCount,3000);assert.equal(effects.textCount,80);assert.equal(effects.effectCount,24);
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
  assert.equal(restarted.modelBuilds, full.modelBuilds, 'Replay must reuse the operator and team models');
  assert.equal(restarted.rig.moduleBuilds, full.rig.moduleBuilds, 'Replay must retain mounted module geometry');
  assert.deepEqual(restarted.rig.modules, []);
  assert.deepEqual(errors, []);
  return { full, restored, noShots, bulletDraws: full.calls - noShots.calls, reused, effects, grown, restarted };
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
