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
    await page.addInitScript(() => {
      localStorage.setItem('sentinel.stand.scores.v1', JSON.stringify([{ name: 'LegacyScore', score: 999999, id: 'legacy' }]));
      localStorage.setItem('sentinel.stand.best', '999999');
      localStorage.setItem('sentinel.stand.health.scores.v1',JSON.stringify([{name:'HealthLegacy',score:8765,id:'health-legacy'}]));
      if (!localStorage.getItem('sentinel.stand.enterprise.scores.v1')) localStorage.setItem('sentinel.stand.enterprise.scores.v1', JSON.stringify([
        {name:'TieA',score:9000,id:'tie-a'}, {name:'TieB',score:9000,id:'tie-b'}]));
    });
    await page.goto(url + '/stand-sangfor.html');
    await page.locator('[data-act="play"]').waitFor();
    assert.match(await page.locator('.ar-how').innerText(), /25 \/ 60 \/ 95/);
    assert.doesNotMatch(await page.locator('.ar-lb').innerText(), /LegacyScore/);
    assert.deepEqual(await page.locator('.lb-rank').allTextContents(), ['1','1']);
    assert.equal(await page.locator('#stBest').innerText(), '0');
    await page.screenshot({ path: shots + '/stand-sangfor-menu-en.png' });
    await page.locator('[data-act="lang"]').click();
    await page.locator('[data-act="play"]').waitFor();
    assert.match(await page.locator('.ar-tag').innerText(), /120 秒/);
    assert.match(await page.locator('.ar-how').innerText(), /算力/);
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
    const offers=await page.locator('.st-card').evaluateAll(cards=>cards.map(c=>c.dataset.up));
    assert.equal(await page.locator('.st-equipment-preview').count(),offers.filter(id=>!['AI','AGENT'].includes(id)).length);
    assert.ok(await page.locator('.st-equipment-preview').evaluateAll(images => images.every(i => i.complete && i.naturalWidth > 0)));
    await page.screenshot({ path: shots + '/stand-sangfor-upgrades.png' });
    const offerTime = await page.evaluate(() => window.__stand.game.state.elapsed);
    assert.equal(await page.evaluate(() => window.__stand.game.phase), 'play');
    await page.keyboard.press('e');
    assert.equal(await page.evaluate(() => window.__stand.game.state.temps.length), 3);
    const upgrade = await page.locator('.st-card').first().getAttribute('data-up');
    const beforeLevel = await page.evaluate(id => window.__stand.game.state.levels[id] || 0, upgrade);
    await page.locator('.st-card').first().click();
    assert.equal(await page.evaluate(id => window.__stand.game.state.levels[id], upgrade), beforeLevel + 1);
    assert.ok(await page.evaluate(() => window.__stand.game.state.elapsed) > offerTime);
    // All product renderers and every normal/boss silhouette, in a paused inspection fixture.
    await page.evaluate(async () => {
      const g = window.__stand.game;
      g.start();
      for (const id of ['EDR', 'EDR', 'MDR', 'AF', 'NDR', 'XDR', 'IAG', 'HCI', 'ASTOR', 'AI', 'AGENT']) g.applyUpgrade(id);
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
    // Ten products (including the new AI and workflow consoles), nine threat types.
    assert.ok(metrics.inspection.calls < 330, JSON.stringify(metrics.inspection));
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
    assert.deepEqual(await page.evaluate(() => window.__stand.game.state.levels), {EDR:1,MDR:1,HCI:1});
    await page.waitForFunction(() => document.querySelector('#stNetwork').textContent.includes('not deployed'));
    assert.equal(await page.locator('#stCloudScores .st-metrics span').count(),4);
    await page.setViewportSize({ width: 390, height: 844 }); await settle();
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => window.__stand.game.state.elapsed > 1.3);
    await page.keyboard.up('ArrowRight'); await page.evaluate(() => window.__stand.game.pause()); await settle();
    assert.ok(await page.evaluate(() => window.__stand.game.state.op.x < document.querySelector('#stCanvas').clientWidth));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await page.locator('.ar-top .ar-stat, #stCombo').evaluateAll(nodes => nodes.every(n => {
      const r=n.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && n.scrollWidth<=n.clientWidth;
    })), 'All phone HP/time/boss counters must remain visible');
    await page.screenshot({ path: shots + '/stand-sangfor-mobile-right.png' });
    metrics.mobile = await page.evaluate(() => window.__stand.game.diagnostics);
    // A phone-sized offer remains compact and auto-deploys without pausing.
    await page.evaluate(async () => {
      const g=window.__stand.game; g.start(); const s=g.state;
      const {ENEMIES}=await import(new URL('src/stand/model.js',location.href));
      s.xp=s.xpNeed-1;
      s.enemies=[{id:97500,type:'recon',spec:ENEMIES.recon,x:s.op.x,y:200,r:13,hp:1,maxhp:1,slow:0,hit:0,wob:0}];
      g.useAbility('ir');
    });
    await page.locator('#stLevelUp').waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await page.locator('#stLevelUp').evaluate(el=>el.getBoundingClientRect().bottom < innerHeight*.5));
    assert.equal(await page.locator('.st-card.recommended').count(),1);
    await page.screenshot({path:shots+'/stand-command-mobile-offer-FIXTURE.png'});
    await page.waitForFunction(() => !window.__stand.game.state.choices.length);
    assert.equal(await page.evaluate(() => Object.values(window.__stand.game.state.levels).reduce((a,b)=>a+b,0)),4);
    assert.ok(await page.evaluate(() => window.__stand.game.state.elapsed >= 3));
    assert.equal(await page.locator('#stLevelUp').count(),0);
    // The main entry is the COMBINED build: sculpted models under the cinematic
    // stage. It uses the art models but keeps the default HUD (no preview hero/thumbs).
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(url + '/stand.html'); await page.locator('[data-act="play"]').click();
    await page.waitForFunction(() => window.__stand.game.state.elapsed > .1);
    assert.equal(await page.evaluate(() => window.__stand.game.diagnostics.art), 'combined');
    assert.equal(await page.locator('.st-art-hero').count(), 0);
    // Production charging and side-laser transitions, with explicit durable targets.
    await page.evaluate(async () => {
      const g=window.__stand.game, s=g.state;
      for(const id of ['MDR','AF','NDR','XDR','IAG','HCI','ASTOR','AI','AGENT']) g.applyUpgrade(id);
      const {ENEMIES}=await import(new URL('src/stand/model.js',location.href));
      const w=document.querySelector('#stCanvas').clientWidth;
      s.enemies=Array.from({length:8},(_,i)=>({id:98000+i,type:'malware',spec:{...ENEMIES.malware,speed:0},
        x:w/2+((i%4)-1.5)*75,y:240+Math.floor(i/4)*140,r:17,hp:100000,maxhp:100000,slow:0,hit:0,wob:0,spawnAcc:0}));
      s.beamAcc=1e5; s.ccAcc=1e5; s.xpNeed=1e9;
    });
    await page.waitForFunction(() => {
      const g=window.__stand.game;
      if (g.state.link && g.state.cc) { g.pause(); return true; }
      return false;
    });
    await page.evaluate(() => {
      const g=window.__stand.game; g.pause();
      g.state.parts=[]; g.state.fxr=[]; g.state.texts=[]; g.state.flash=0; g.state.shake=0;
    }); await settle();
    const linked=await page.evaluate(() => [...new Set(window.__stand.game.state.link.devices.map(d=>d.id))].sort());
    assert.deepEqual(linked,['AF','AGENT','AI','ASTOR','EDR','HCI','IAG','MDR','NDR','XDR']);
    await page.screenshot({path:shots+'/stand-command-cc-xdr-charge-FIXTURE.png'});
    await page.evaluate(() => window.__stand.game.resume());
    await page.waitForFunction(() => {
      const g=window.__stand.game;
      if (g.state.beam) { g.pause(); return true; }
      return false;
    });
    await settle();
    assert.ok(await page.evaluate(() => window.__stand.game.state.beam && window.__stand.game.state.link.fired));
    await page.screenshot({path:shots+'/stand-command-xdr-fire-FIXTURE.png'});
    await page.setViewportSize({width:390,height:844}); await settle();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.ok(await page.locator('#stCloudScores').evaluate(el=>el.getBoundingClientRect().bottom<innerHeight*.45),'Scores leave the lower movement area clear');
    await page.screenshot({path:shots+'/stand-enterprise-mobile-xdr-FIXTURE.png'});
    await page.setViewportSize({width:1440,height:1000}); await settle();
    // A failed defense cannot submit or contaminate either previous board.
    const boardBefore=await page.evaluate(()=>localStorage.getItem('sentinel.stand.enterprise.scores.v1'));
    await page.evaluate(()=>{const g=window.__stand.game;g.start();g.state.elapsed=119.95;g.state.bossCount=3;g.state.bossesKilled=0;});
    await page.locator('[data-act="again"]').waitFor();
    assert.match(await page.locator('.ar-title').innerText(),/Defense failed/);
    assert.equal(await page.locator('.lb-row.me').count(),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('sentinel.stand.enterprise.scores.v1')),boardBefore);
    await page.screenshot({path:shots+'/stand-enterprise-failure-FIXTURE.png'});
    // Actual final kill and real result callback at the campaign endpoint.
    await page.evaluate(async () => {
      const g=window.__stand.game; g.start(); const s=g.state;
      const {ENEMIES}=await import(new URL('src/stand/model.js?campaign=enterprise-balance-v1',location.href));
      const spec=ENEMIES.siege;
      s.elapsed=119.8; s.bossCount=3; s.bossesKilled=2; s.base=8605;
      s.businessWork=7200;s.aiWork=2100;s.agentWork=1080;
      s.enemies=[{id:99000,type:'siege',spec,x:s.op.x,y:200,r:50,hp:1,maxhp:1000,slow:0,hit:0,wob:0,spawnAcc:0,bornAt:119.8,attackAcc:0}];
      g.useAbility('ir');
    });
    await page.locator('[data-act="again"]').waitFor();
    await page.locator('.lb-row.me').waitFor();
    assert.equal(await page.evaluate(() => window.__stand.game.phase), 'over');
    assert.match(await page.locator('.ar-result').innerText(), /8,765|8765/);
    const expected=await page.evaluate(async()=>{const {campaignScores}=await import(new URL('src/stand/model.js',location.href));return campaignScores(window.__stand.game.state).total;});
    assert.match(await page.locator('.ar-result .big').innerText(),new RegExp(expected.toLocaleString('en-US')));
    assert.match(await page.locator('.ar-result').innerText(), /3\/3/);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sentinel.stand.scores.v1'))[0].score),999999);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sentinel.stand.health.scores.v1'))[0].score),8765);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sentinel.stand.enterprise.scores.v1')).find(r=>r.note)?.score),expected);
    await page.screenshot({path:shots+'/stand-enterprise-result-FIXTURE.png'});
    await page.locator('[data-act="lang"]').click();
    assert.match(await page.locator('.ar-result').innerText(),/综合分/);
    assert.match(await page.locator('.ar-result').innerText(),/业务/);
    await page.screenshot({path:shots+'/stand-enterprise-result-zh-FIXTURE.png'});
    await page.locator('[data-act="lang"]').click();
    await page.locator('[data-act="again"]').click();
    await page.waitForFunction(() => window.__stand.game.state.elapsed > .1 && window.__stand.game.state.elapsed < 5);
    assert.equal(await page.evaluate(() => window.__stand.game.state.base),10000);
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
    console.log(JSON.stringify(await verifyStandArt(await browser.newPage(), url, 'tools/shots/stand-enterprise'), null, 2));
    console.log('Last Stand equipment preview checks passed.');
  } finally { await browser.close(); server.close(); }
}
