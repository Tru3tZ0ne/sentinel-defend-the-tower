import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { START_BASE, STARTER_LEVELS, BOSS_TIMES, BOSS_ORDER, bossFor, ENEMIES, MAX_ACTIVE_THREATS, deriveSquad, recommendedUpgrade, integrityScore, segmentDistanceSq, WEAPONS, cloudRates, campaignScores, upgradeChoices, CLOUD_PRODUCTS } from '../src/stand/model.js';
import { rankOf, mergeScores } from '../src/arcade/board.js';
import { createCombatProbe, playProbe, sampleBalance } from './stand-balance.mjs';

function enemy(g, type='recon', extra={}) {
  const spec = { ...ENEMIES[type], speed: 0 };
  return { id: 90000, type, spec, x: g.fieldL+80, y: 100, r: spec.r,
    hp: 1e6, maxhp: 1e6, slow: 0, hit: 0, wob: 0, spawnAcc: 0, bornAt: g.state.elapsed, attackAcc: 0, ...extra };
}
function quiet(g) { g.state.spawnAcc = -1e8; g.state.shooters = []; g.state.beamAcc = -1e8; g.state.ccAcc = -1e8; }
function advance(g, seconds) { for (let i=0; i<Math.round(seconds*60); i++) g.step(1/60); }

test('slower rendered frames keep real campaign pace with bounded catch-up and pause', () => {
  const g=createCombatProbe(); quiet(g); g.keys.add('right'); const x=g.state.op.x;
  g.frameMs(100); assert.ok(Math.abs(g.state.elapsed-.1)<1e-8);
  assert.ok(Math.abs(g.state.op.x-x-38)<1e-8);
  g.frameMs(1000); assert.ok(Math.abs(g.state.elapsed-.35)<1e-8);
  g.state.phase='paused'; g.frameMs(100); assert.ok(Math.abs(g.state.elapsed-.35)<1e-8);
});

test('campaign starts with 10,000 HP and mixed core devices; three bosses never wrap', () => {
  const g=createCombatProbe();
  assert.equal(START_BASE,10000); assert.equal(g.state.base,10000);
  assert.deepEqual(g.state.levels,STARTER_LEVELS);
  assert.deepEqual(BOSS_TIMES,[25,60,95]); assert.deepEqual(BOSS_ORDER,['ransom','botnet','siege']);
  assert.equal(bossFor(3),undefined);
  quiet(g);
  const seen=[];
  for(let i=0;i<7201 && g.state.phase !== 'over';i++) {
    g.step(1/60);
    for(const e of g.state.enemies) if(e.spec.boss && !seen.includes(e.type)) {
      seen.push(e.type); e.hp=1; g.state.cd.ir=0; g.useAbility('ir');
    }
  }
  assert.deepEqual(seen,BOSS_ORDER);
  assert.equal(g.state.bossCount,3); assert.equal(g.state.bossesKilled,3);
  assert.equal(g.summary.outcome,'victory'); assert.equal(g.summary.elapsed,120);
  assert.deepEqual(STARTER_LEVELS,{EDR:1,MDR:1,HCI:1});
  assert.equal(g.toasts.includes('allied'),false);
});

test('bosses receive no automatic assistance; only actual deaths count, deadline can fail', () => {
  const g=createCombatProbe(); quiet(g); g.state.elapsed=24.99; g.step(.02);
  const boss=g.state.enemies.find(e=>e.spec.boss); assert.ok(boss); const hp=boss.hp;
  g.state.elapsed=37.01; g.step(.05);
  assert.equal(boss.hp,hp); assert.equal(g.state.bossesKilled,0); assert.equal(g.state.phase,'play');
  boss.hp=.001; g.useAbility('ir'); assert.equal(g.state.bossesKilled,1);
  g.step(.05); assert.equal(g.state.bossesKilled,1);
  g.state.elapsed=119.99; g.state.bossCount=3; g.state.enemies=[]; g.step(.02);
  assert.equal(g.summary.outcome,'defeat'); assert.equal(g.summary.reason,'bosses');
});

test('zero HP is terminal; no post-finalization rewards or production', () => {
  const g=createCombatProbe(); quiet(g); g.state.base=10; g.state.shield=0;
  g.state.enemies=[enemy(g,'recon',{y:g.baseY, spec:{...ENEMIES.recon,speed:0,dmg:20000}})];
  g.step(.05); assert.equal(g.state.base,0); assert.equal(g.summary.outcome,'defeat'); assert.equal(g.summary.reason,'integrity');
  assert.equal(g.summary.health,0); assert.equal(g.toasts.includes('cover'),false);
  assert.equal(g.choose('EDR'),false); assert.equal(g.deploy('EDR'),false); assert.equal(g.useAbility('ir'),false);
  const snapshot=JSON.stringify(g.state); advance(g,2); assert.equal(JSON.stringify(g.state),snapshot);
});

test('CC horizontal strips hit only their area; MDR buff is unchanged; ordinary tracking needs pair', () => {
  const g=createCombatProbe(); g.deploy('NDR'); quiet(g); g.state.ccAcc=10;
  const inBand=enemy(g,'recon',{y:942*.34}), outBand=enemy(g,'recon',{id:90001,y:942*.44});
  g.state.enemies=[inBand,outBand]; g.step(.05);
  assert.ok(inBand.hp<1e6); assert.equal(outBand.hp,1e6); assert.equal(g.state.cc.bands.length,2);
  assert.ok(deriveSquad({MDR:2,NDR:2}).mdrDmg>deriveSquad({MDR:2,NDR:1}).mdrDmg);
  for (const ids of [[],['NDR'],['XDR'],['NDR','XDR']]) for(const owner of ['op','edr','service','mdr']) {
    const p=createCombatProbe(); for(const id of ids) p.deploy(id); quiet(p);
    p.state.enemies=[enemy(p,'recon',{x:p.state.op.x+100,y:200})];
    const tracking=ids.includes('NDR') && (owner==='mdr' || ids.includes('XDR'));
    assert.equal(p.state.squad.tracking,ids.length===2);
    p.fire(p.state.op.x,500,1,980,1,'#fff',owner);
    p.step(.05); assert.equal(p.state.shots[0].vx>0,tracking);
    assert.ok(Math.abs(Math.hypot(p.state.shots[0].vx,p.state.shots[0].vy)-980)<.01);
  }
});

test('homing retargets an enemy killed earlier in the same projectile update', () => {
  const g=createCombatProbe(); g.deploy('NDR'); g.deploy('XDR'); quiet(g);
  const first=enemy(g,'recon',{x:g.state.op.x,y:300,hp:1}), second=enemy(g,'recon',{id:90001,x:g.state.op.x+150,y:200});
  g.state.enemies=[first,second];
  const shot={x:first.x,y:first.y+1,vx:0,vy:-60,speed:60,dmg:2,r:1,pierce:0,hit:new Set(),color:'#fff',targetId:first.id};
  g.state.shots=[shot,{...shot,y:500,hit:new Set()}]; g.step(1/60);
  assert.ok(first.dead); assert.equal(g.state.shots[0].targetId,second.id);
});

test('tracking rounds exclude pierced targets and have a finite flight lifetime', () => {
  const g=createCombatProbe(); g.deploy('NDR'); g.deploy('XDR'); quiet(g);
  const first=enemy(g,'recon',{x:g.state.op.x,y:200}), second=enemy(g,'recon',{id:90001,x:g.state.op.x+120,y:150});
  g.state.enemies=[first,second];
  g.state.shots=[{x:first.x,y:500,vx:0,vy:-1,speed:1,dmg:1,r:1,pierce:1,hit:new Set([first.id]),color:'#fff',targetId:first.id,life:2.4}];
  g.step(.05); assert.equal(g.state.shots[0].targetId,second.id);
  advance(g,2.5); assert.equal(g.state.shots.length,0);
});

test('XDR collects all deployed devices then fires from the actual hub; links do no damage', () => {
  const g=createCombatProbe(); for(const id of Object.keys(WEAPONS)) g.deploy(id);
  const devices=g.state.shooters; quiet(g); g.state.shooters=devices; for(const sh of devices) sh.rate=0;
  const target=enemy(g,'recon',{x:g.fieldL+100,y:200}); g.state.enemies=[target];
  g.state.beamAcc=1e5; g.step(.01);
  assert.deepEqual([...new Set(g.state.link.devices.map(d=>d.id))].sort(),Object.keys(WEAPONS).sort());
  assert.equal(g.state.beam,null); assert.equal(target.hp,1e6);
  const {hub}=g.state.link; assert.equal(hub.x,g.fieldR-23); assert.equal(hub.y,g.baseY-78);
  advance(g,.6); assert.equal(g.state.beam,null); assert.equal(target.hp,1e6);
  advance(g,.1); assert.ok(g.state.link.fired); assert.ok(g.state.beam); assert.ok(target.hp<1e6);
  assert.equal(g.state.beam.x,hub.x); assert.equal(g.state.beam.y,hub.y);
  assert.ok(deriveSquad({EDR:1,NDR:1,XDR:1,MDR:1}).beamDmg>deriveSquad({EDR:1,NDR:1,XDR:1}).beamDmg);
});

test('XDR collision follows the angled segment, not the legacy vertical column', () => {
  const g=createCombatProbe(); quiet(g);
  const a={x:g.fieldL+20,y:600}, b={x:g.fieldL+320,y:100};
  const hit=enemy(g,'recon',{x:(a.x+b.x)/2,y:350}), miss=enemy(g,'recon',{id:90001,x:a.x,y:350});
  g.state.enemies=[hit,miss]; g.state.beam={...a,tx:b.x,ty:b.y,life:1,width:20,dmg:100}; g.step(.05);
  assert.ok(hit.hp<1e6); assert.equal(miss.hp,1e6);
  assert.equal(segmentDistanceSq(a.x,a.y,a.x,a.y,b.x,b.y),0);
});

test('upgrade offers do not pause, expire into recommendation, reject invalid or capped IDs', () => {
  const g=createCombatProbe(); quiet(g); g.state.xp=g.state.xpNeed-1;
  g.state.enemies=[enemy(g,'recon',{hp:1})]; g.useAbility('ir');
  assert.equal(g.state.phase,'play'); assert.equal(g.state.choices.length,3);
  const offered=g.state.choices.map(c=>c.id), rec=recommendedUpgrade(g.state.choices,g.state.levels), before=g.state.levels[rec]||0;
  assert.equal(g.choose('INVALID'),false); assert.equal(g.choose(Object.keys(WEAPONS).find(id=>!offered.includes(id))),false);
  const elapsed=g.state.elapsed; advance(g,3.1);
  assert.ok(g.state.elapsed>=elapsed+3); assert.equal(g.state.levels[rec],before+1); assert.equal(g.state.choices.length,0);
  while(g.deploy('EDR')) {} assert.equal(g.state.levels.EDR,WEAPONS.EDR.max);
  g.state.phase='paused'; const snapshot=JSON.stringify(g.state); advance(g,2); assert.equal(JSON.stringify(g.state),snapshot);
});

test('all spawn paths stay bounded and ordinary threats reserve space for three bosses', () => {
  const g=createCombatProbe(); quiet(g);
  g.state.enemies=Array.from({length:61},(_,i)=>enemy(g,'recon',{id:1000+i}));
  for(const t of BOSS_TIMES){ g.state.elapsed=t-.01; g.step(.02); }
  assert.equal(g.state.bossCount,3); assert.ok(g.state.enemies.length<=MAX_ACTIVE_THREATS);
  for(const type of ['botnet','siege','worm']) {
    const p=createCombatProbe(); quiet(p);
    p.state.enemies=Array.from({length:61},(_,i)=>enemy(p,type,{id:2000+i,spawnAcc:100}));
    if(type==='worm') p.useAbility('ir'); else p.step(.05);
    assert.ok(p.state.enemies.length<=MAX_ACTIVE_THREATS);
  }
});

test('enterprise ranking clamps each component and weights real work; ties share ranks', () => {
  assert.equal(integrityScore(-1),0); assert.equal(integrityScore(10001),10000); assert.equal(integrityScore(8243.9),8243);
  assert.deepEqual(campaignScores({base:8000,businessWork:7200,aiWork:2100,agentWork:1080}),{health:8000,business:5000,ai:5000,agent:5000,total:6650});
  assert.equal(campaignScores({base:20000,businessWork:1e8,aiWork:1e8,agentWork:1e8}).total,10000);
  const rows=mergeScores([{name:'A',score:9000},{name:'B',score:9000},{name:'C',score:8000}]);
  assert.equal(rankOf(rows,9000),1); assert.equal(rankOf(rows,8000),3);
});

test('seeded mixed builds can win and fail; informed play improves odds, pure cloud and idle lose', () => {
  const rows=[];
  for(const [device,width,height] of [['desktop',1440,942],['phone',390,786]]) {
    for(const policy of ['stationary','cloud','casual','informed']) {
      const seeds=policy==='casual'?60:12;
      const result=sampleBalance({width,height,policy,seeds});
      assert.equal(result.ended,seeds,`${device}/${policy}`);
      for(const r of result.runs) {
        assert.ok(r.seconds<=120); assert.equal(r.summary.health,r.health);
        if(r.victory) { assert.equal(r.seconds,120); assert.equal(r.bossesKilled,3); assert.ok(r.health>0); }
        assert.ok(r.health>=0 && r.health<=10000); assert.ok(r.peakEnemies<=MAX_ACTIVE_THREATS);
      }
      rows.push({device,policy,wins:result.runs.filter(r=>r.victory).length,winRate:result.runs.filter(r=>r.victory).length/seeds,meanHP:Math.round(result.runs.reduce((sum,r)=>sum+r.health,0)/seeds),...result});
    }
    const d=rows.filter(r=>r.device===device);
    const mixed=d.find(r=>r.policy==='casual').winRate;
    assert.ok(mixed>=.5 && mixed<=.8,`${device} mixed guardrail: ${mixed}`);
    assert.ok(d.find(r=>r.policy==='informed').winRate>mixed);
    assert.equal(d.find(r=>r.policy==='cloud').wins,0); assert.equal(d.find(r=>r.policy==='stationary').wins,0);
    assert.ok(new Set(d.flatMap(r=>r.runs.map(x=>x.health))).size>10);
  }
  assert.deepEqual(playProbe({seed:286}),playProbe({seed:286}));
  mkdirSync('tools/shots',{recursive:true}); writeFileSync('tools/shots/stand-enterprise-balance.json',JSON.stringify(rows,null,2));
  console.log(JSON.stringify(rows.map(({device,policy,wins,winRate,meanHP,mean,min,max})=>({device,policy,wins,winRate,meanHP,seconds:mean,min,max}))));
});

test('ordinary guidance retains its cone and slower turn; MDR remains broadly guided by CC', () => {
  for(const owner of ['op','mdr']) {
    const g=createCombatProbe(); g.deploy('NDR'); g.deploy('XDR'); quiet(g);
    g.state.enemies=[enemy(g,'recon',{x:g.state.op.x+180,y:450})];
    g.fire(g.state.op.x,500,1,980,1,'#fff',owner); g.step(.02);
    assert.equal(g.state.shots[0].vx>0,owner==='mdr');
  }
  const turn=owner=>{const g=createCombatProbe();g.deploy('NDR');g.deploy('XDR');quiet(g);g.state.enemies=[enemy(g,'recon',{x:g.state.op.x+100,y:200})];g.fire(g.state.op.x,500,1,980,1,'#fff',owner);g.step(.02);return g.state.shots[0].vx;};
  assert.ok(turn('mdr')>turn('op')*2);
});

test('boss strike telegraphs a fixed lane; moving avoids actual damage', () => {
  for(const dodge of [false,true]) {
    const g=createCombatProbe();quiet(g);
    const boss=enemy(g,'ransom',{attackAcc:4});g.state.enemies=[boss];g.step(.01);
    assert.ok(boss.attack);const x=boss.attack.x;
    if(dodge)g.state.op.x=x+100;
    advance(g,1);
    assert.equal(g.state.base,dodge?10000:9190);assert.equal(g.state.dodged,dodge?1:0);
  }
});

test('cloud and AI offers respect prerequisites and leave a security choice', () => {
  for(const levels of [{},{HCI:1},{HCI:1,AI:1}]) for(let i=0;i<20;i++) {
    const offers=upgradeChoices(levels,()=>i/20).map(o=>o.id);
    if(!levels.HCI)assert.ok(!offers.includes('AI')&&!offers.includes('AGENT'));
    if(!levels.AI)assert.ok(!offers.includes('AGENT'));
    assert.ok(offers.some(id=>!CLOUD_PRODUCTS.includes(id)));assert.ok(offers.some(id=>CLOUD_PRODUCTS.includes(id)));
  }
});

test('HCI serves workloads; overload and service damage affect real output and can fail', () => {
  const low=cloudRates({HCI:1,AI:5,AGENT:5},100),high=cloudRates({HCI:5,AI:5,AGENT:5},100);
  assert.ok(low.served<high.served && low.ai<high.ai && low.agent<high.agent);
  assert.equal(cloudRates({AI:3,AGENT:2},10).ai,0);assert.equal(cloudRates({HCI:2,AGENT:2},10).agent,0);
  assert.equal(cloudRates({HCI:2,AI:2,AGENT:2},10,0).business,0);
  const g=createCombatProbe();quiet(g);g.deploy('AI');g.deploy('AGENT');advance(g,2);
  assert.ok(g.state.businessWork>0 && g.state.aiWork>0 && g.state.agentWork>0);
  g.state.elapsed=110;g.state.availability=.0001;g.state.levels.HCI=0;g.step(.05);
  assert.equal(g.summary.reason,'service');const work=g.state.businessWork;advance(g,2);assert.equal(g.state.businessWork,work);
});
