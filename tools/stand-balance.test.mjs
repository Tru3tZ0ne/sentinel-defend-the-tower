import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { START_BASE, STARTER_LEVELS, BOSS_TIMES, BOSS_ORDER, bossFor, ENEMIES, MAX_ACTIVE_THREATS, deriveSquad, recommendedUpgrade, integrityScore, segmentDistanceSq, WEAPONS } from '../src/stand/model.js';
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

test('campaign starts with 10,000 HP and visible core devices; three bosses never wrap', () => {
  const g=createCombatProbe();
  assert.equal(START_BASE,10000); assert.equal(g.state.base,10000);
  assert.deepEqual(g.state.levels,STARTER_LEVELS);
  assert.deepEqual(BOSS_TIMES,[25,60,95]); assert.deepEqual(BOSS_ORDER,['ransom','botnet','siege']);
  assert.equal(bossFor(3),undefined);
  quiet(g);
  const seen=[];
  for(let i=0;i<7201;i++) {
    g.step(1/60);
    for(const e of g.state.enemies) if(e.spec.boss && !seen.includes(e.type)) seen.push(e.type);
  }
  assert.deepEqual(seen,BOSS_ORDER);
  assert.equal(g.state.bossCount,3); assert.equal(g.state.bossesKilled,3);
  assert.equal(g.summary.outcome,'victory'); assert.equal(g.summary.elapsed,120);
  assert.equal(g.summary.assistedBosses,3); assert.equal(g.toasts.filter(t=>t==='allied').length,3);
});

test('boss assistance deals real damage, death accounting is exact, no early or fake victory', () => {
  const g=createCombatProbe(); quiet(g); g.state.elapsed=24.99; g.step(.02);
  const boss=g.state.enemies.find(e=>e.spec.boss); assert.ok(boss); const hp=boss.hp;
  g.state.elapsed=37.01; g.step(.05);
  assert.ok(boss.hp<hp); assert.equal(g.state.bossesKilled,0); assert.ok(g.state.assistBeam);
  assert.equal(g.state.assistedBosses,1); assert.equal(g.state.phase,'play');
  boss.hp=.001; g.step(.05); assert.equal(g.state.bossesKilled,1);
  g.step(.05); assert.equal(g.state.bossesKilled,1);
  g.state.elapsed=119.99; g.state.bossCount=3; g.state.enemies=[]; g.step(.02);
  assert.equal(g.summary,null); assert.equal(g.state.phase,'play');
});

test('emergency cover preserves 1 HP and is disclosed; no post-finalization rewards', () => {
  const g=createCombatProbe(); quiet(g); g.state.base=10; g.state.shield=0;
  g.state.enemies=[enemy(g,'recon',{y:g.baseY, spec:{...ENEMIES.recon,speed:0,dmg:20000}})];
  g.step(.05); assert.equal(g.state.base,1); assert.equal(g.state.emergencyCover,true); assert.ok(g.toasts.includes('cover'));
  g.state.elapsed=119.99; g.state.bossCount=3; g.state.bossesKilled=3; g.step(.02);
  assert.equal(g.summary.health,1); assert.equal(g.summary.score,1); assert.equal(g.summary.emergencyCover,true);
  assert.equal(g.choose('EDR'),false); assert.equal(g.deploy('EDR'),false); assert.equal(g.useAbility('ir'),false);
});

test('CC horizontal strips hit only their area; MDR buff scales; tracking requires CC', () => {
  const g=createCombatProbe(); quiet(g); g.state.ccAcc=10;
  const inBand=enemy(g,'recon',{y:942*.34}), outBand=enemy(g,'recon',{id:90001,y:942*.44});
  g.state.enemies=[inBand,outBand]; g.step(.05);
  assert.ok(inBand.hp<1e6); assert.equal(outBand.hp,1e6); assert.equal(g.state.cc.bands.length,2);
  assert.ok(deriveSquad({MDR:2,NDR:2}).mdrDmg>deriveSquad({MDR:2,NDR:1}).mdrDmg);
  assert.equal(deriveSquad({}).tracking,false); assert.equal(deriveSquad({NDR:1}).tracking,true);
  for (const tracking of [false,true]) {
    const p=createCombatProbe(); quiet(p); p.state.squad.tracking=tracking;
    p.state.enemies=[enemy(p,'recon',{x:p.state.op.x+100,y:200})];
    p.state.shots=[{x:p.state.op.x,y:500,vx:0,vy:-980,speed:980,dmg:1,r:1,pierce:1,hit:new Set(),color:'#fff',targetId:90000}];
    p.step(.05); assert.equal(p.state.shots[0].vx>0,tracking);
    assert.ok(Math.abs(Math.hypot(p.state.shots[0].vx,p.state.shots[0].vy)-980)<.01);
  }
});

test('homing retargets an enemy killed earlier in the same projectile update', () => {
  const g=createCombatProbe(); quiet(g);
  const first=enemy(g,'recon',{x:g.state.op.x,y:300,hp:1}), second=enemy(g,'recon',{id:90001,x:g.state.op.x+150,y:200});
  g.state.enemies=[first,second];
  const shot={x:first.x,y:first.y+1,vx:0,vy:-60,speed:60,dmg:2,r:1,pierce:0,hit:new Set(),color:'#fff',targetId:first.id};
  g.state.shots=[shot,{...shot,y:500,hit:new Set()}]; g.step(1/60);
  assert.ok(first.dead); assert.equal(g.state.shots[0].targetId,second.id);
});

test('tracking rounds exclude pierced targets and have a finite flight lifetime', () => {
  const g=createCombatProbe(); quiet(g);
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

test('HP ranking clamps to 1..10000, sorts by health alone and shares tied ranks', () => {
  assert.equal(integrityScore(-1),1); assert.equal(integrityScore(10001),10000); assert.equal(integrityScore(8243.9),8243);
  const rows=mergeScores([{name:'A',score:9000},{name:'B',score:9000},{name:'C',score:8000}]);
  assert.equal(rankOf(rows,9000),1); assert.equal(rankOf(rows,8000),3);
});

test('72 seeded desktop/phone runs finish in 120s with three real boss deaths and HP differentiation', () => {
  const rows=[];
  for(const [device,width,height] of [['desktop',1440,942],['phone',390,786]]) {
    for(const policy of ['stationary','casual','informed']) {
      const result=sampleBalance({width,height,policy,seeds:12});
      assert.equal(result.ended,12,`${device}/${policy}`);
      for(const r of result.runs) {
        assert.equal(r.seconds,120); assert.equal(r.bossesKilled,3); assert.equal(r.summary.health,r.health);
        assert.ok(r.health>=1 && r.health<=10000); assert.ok(r.peakEnemies<=MAX_ACTIVE_THREATS);
      }
      rows.push({device,policy,meanHP:Math.round(result.runs.reduce((sum,r)=>sum+r.health,0)/12),...result});
    }
    const d=rows.filter(r=>r.device===device);
    assert.ok(d.find(r=>r.policy==='informed').meanHP>d.find(r=>r.policy==='casual').meanHP+150);
    assert.ok(new Set(d.flatMap(r=>r.runs.map(x=>x.health))).size>10);
  }
  assert.deepEqual(playProbe({seed:286}),playProbe({seed:286}));
  mkdirSync('tools/shots',{recursive:true}); writeFileSync('tools/shots/stand-campaign-balance.json',JSON.stringify(rows,null,2));
  console.log(JSON.stringify(rows.map(({device,policy,meanHP,mean,min,max})=>({device,policy,meanHP,seconds:mean,min,max}))));
});
