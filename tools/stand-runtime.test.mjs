import assert from 'node:assert/strict';
import test from 'node:test';
import {createCollisionIndex,compactLive} from '../src/stand/combat-runtime.js';
import {createCombatProbe,playProbe} from './stand-balance.mjs';

test('spatial candidates preserve exhaustive circle hits, order and boundary cases',()=>{
  let seed=714; const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  const grid=createCollisionIndex();
  for(let round=0;round<100;round++) {
    const enemies=Array.from({length:64},()=>({x:random()*600-80,y:random()*1100-100,r:5+random()*60,dead:random()<.1}));
    grid.reset(enemies);
    for(let shot=0;shot<40;shot++) {
      const x=random()*600-80,y=random()*1100-100,r=1+random()*12;
      const hits=i=>{const e=enemies[i];return !e.dead&&(e.x-x)**2+(e.y-y)**2<=(r+e.r)**2;};
      assert.deepEqual(grid.query(enemies,x,y,r).filter(hits),enemies.map((_,i)=>i).filter(hits));
    }
  }
  assert.ok(grid.stats.candidates<grid.stats.fullScan*.2,JSON.stringify(grid.stats));
});

test('children spawned during a piercing shot remain hittable in original order',()=>{
  const grid=createCollisionIndex(),enemies=[{x:100,y:100,r:20}];grid.reset(enemies);
  const candidates=grid.query(enemies,100,100,4);
  enemies.push({x:101,y:100,r:13},{x:600,y:900,r:13});grid.appendSpawned(enemies,100,100,4);
  assert.deepEqual(candidates,[0,1]);
  assert.ok(grid.query(enemies,600,900,4).includes(2));
});

test('in-place compaction is stable and recycling never trims live effects',()=>{
  const alive={life:1},expired={life:0},late={life:.1},pool=[],list=[alive,expired,late];
  compactLive(list,pool,1,true);assert.deepEqual(list,[alive,late]);assert.deepEqual(pool,[expired]);
  const many=Array.from({length:3000},()=>({life:1}));compactLive(many,pool,1,true);assert.equal(many.length,3000);
});

test('reused projectiles clear pierced targets and all terminal fields',()=>{
  const g=createCombatProbe();g.state.shooters=[];g.state.spawnAcc=-1e8;
  g.fire(g.state.op.x,100,7,980,1,'#fff','op');const shot=g.state.shots[0];shot.hit.add(42);shot.dead=true;
  g.step(1/60);assert.ok(g.state.pools.shots.includes(shot));
  g.fire(g.state.op.x,500,12,980,2,'#58c8ff','mdr');
  assert.equal(g.state.shots[0],shot);assert.equal(shot.hit.size,0);assert.equal(shot.dead,false);assert.equal(shot.owner,'mdr');assert.equal(shot.life,2.4);
});

function linearIndex() {
  let candidates=[],indexed=0;
  return {stats:{},reset(enemies){indexed=enemies.length;},query(enemies){indexed=enemies.length;candidates=Array.from({length:indexed},(_,i)=>i);return candidates;},appendSpawned(enemies){while(indexed<enemies.length)candidates.push(indexed++);}};
}
test('spatial combat matches exhaustive production combat for both viewports',()=>{
  for(const [width,height]of[[1440,942],[390,786]])for(const seed of[101,175,286,5001]) {
    const options={width,height,seed,policy:'informed'};
    assert.deepEqual(playProbe(options),playProbe({...options,overrides:{createCollisionIndex:linearIndex}}));
  }
});
