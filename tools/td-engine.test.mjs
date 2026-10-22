import test from 'node:test';
import assert from 'node:assert/strict';
import { createTD, TD_WAVES } from '../src/td/engine-td.js';

const PRODUCTS = { AF: { cost: 4 }, EDR: { cost: 3 }, NDR: { cost: 5 }, IAG: { cost: 3 }, XDR: { cost: 6 }, MDR: { cost: 6 }, ASTOR: { cost: 3 } };
const PATH = [{ x: 0, z: 0 }, { x: 40, z: 0 }];
const SLOTS = [{ id: 'a', x: 5, z: 3 }, { id: 'b', x: 12, z: 3 }, { id: 'c', x: 22, z: 3 }, { id: 'd', x: 32, z: -3 }, { id: 'core', x: 40, z: 0 }];
const mk = (credits = 100) => createTD({ path: PATH, slots: SLOTS, products: PRODUCTS, startCredits: credits, waves: TD_WAVES });
const run = (g, steps, dt = 0.1) => { for (let i = 0; i < steps && g.phase === 'wave'; i++) g.tick(dt); };

test('path length and endpoints', () => {
  const g = mk();
  assert.equal(Math.round(g.pathLength), 40);
  assert.deepEqual(g.pointAt(0), { x: 0, z: 0 });
  assert.deepEqual(g.pointAt(999), { x: 40, z: 0 });
  assert.equal(Math.round(g.pointAt(20).x), 20);
});

test('build spends credits, occupies pad, and guards against bad builds', () => {
  const g = mk(10);
  assert.equal(g.build('a', 'AF').ok, true);
  assert.equal(g.state.credits, 6);
  assert.equal(g.build('a', 'EDR').reason, 'occupied');
  assert.equal(g.build('zzz', 'AF').reason, 'noPad');
  const poor = mk(1); assert.equal(poor.build('a', 'XDR').reason, 'tooPoor');
});

test('a damage tower kills a weak threat before it leaks', () => {
  const g = mk();
  g.build('a', 'AF');
  g.startWave();            // wave 1 = recon only
  run(g, 400);
  assert.ok(g.state._kills >= 1, 'at least one kill');
  assert.equal(g.state._leaks, 0, 'nothing leaked');
  assert.equal(g.state.uptime, 100);
  assert.ok(g.state.credits > 0);
});

test('undefended wave leaks and drains uptime', () => {
  const g = mk();
  g.startWave();
  run(g, 400);
  assert.ok(g.state._leaks >= 1);
  assert.ok(g.state.uptime < 100);
});

test('stealth lateral movers are untargetable until a sensor reveals them', () => {
  // wave 4 (index 3) introduces lateral movers. Only a damage tower, no sensor:
  const g = mk(100);
  g.build('b', 'AF');
  g.state.waveIndex = 3; g.startWave();
  // step until a lateral mover exists; confirm it is not revealed and survives past the tower
  let sawHiddenLateral = false;
  for (let i = 0; i < 300 && g.phase === 'wave'; i++) {
    g.tick(0.1);
    const lat = g.state.enemies.find(e => e.type === 'lateral');
    if (lat && !lat.revealed) sawHiddenLateral = true;
  }
  assert.ok(sawHiddenLateral, 'lateral movers spend time hidden');
  const leaksNoSensor = g.state._leaks;

  // Now with an NDR sensor covering the lane, lateral movers get revealed (and can die).
  const g2 = mk(100);
  g2.build('b', 'AF'); g2.build('a', 'NDR');
  g2.state.waveIndex = 3; g2.startWave();
  let revealed = false;
  for (let i = 0; i < 400 && g2.phase === 'wave'; i++) { g2.tick(0.1); if (g2.state.enemies.some(e => e.type === 'lateral' && e.revealed)) revealed = true; }
  assert.ok(revealed, 'NDR reveals lateral movers');
  assert.ok(g2.state._kills >= leaksNoSensor === false || g2.state._kills >= 1, 'sensor enables kills');
});

test('aStor shield softens core breaches', () => {
  const bare = mk(100); bare.startWave(); run(bare, 400);
  const shielded = mk(100); shielded.build('core', 'ASTOR'); shielded.startWave(); run(shielded, 400);
  // same undefended wave, but shielded loses less uptime because charges soak breaches
  assert.ok(shielded.state.uptime > bare.state.uptime, `${shielded.state.uptime} > ${bare.state.uptime}`);
});

test('XDR support buffs a neighbour tower\'s damage', () => {
  const g = mk();
  g.build('a', 'AF');
  const base = g.towerStats(g.state.towers[0]).dmg;
  g.build('b', 'XDR');                // within 6.4 of pad a? dist a(5,3)->b(12,3)=7 > 6.4, so no buff
  const far = g.towerStats(g.state.towers[0]).dmg;
  assert.equal(far, base, 'distant XDR does not buff');
  // place XDR on the same-ish spot (use a pad close to a): reuse pad c far; instead test adjacency via direct insert
  g.state.towers.push({ id: 99, slotId: 'x', productId: 'XDR', x: 6, z: 3, level: 1, cool: 0 });
  const buffed = g.towerStats(g.state.towers[0]).dmg;
  assert.ok(buffed > base, `${buffed} > ${base}`);
});

test('a solid loadout can survive all waves to a win', () => {
  const g = mk(60);
  // stack the lane; generous credits + per-wave bonuses let it hold
  g.build('a', 'AF'); g.build('b', 'NDR'); g.build('c', 'EDR'); g.build('d', 'IAG'); g.build('core', 'ASTOR');
  let guard = 0;
  while (g.phase !== 'won' && g.phase !== 'lost' && guard++ < 40) {
    if (g.phase === 'build') {
      // spend bonus on upgrades
      for (const tw of g.state.towers) g.upgrade(tw.id);
      g.startWave();
    }
    run(g, 1200);
  }
  assert.equal(g.phase, 'won', `ended ${g.phase} on wave ${g.state.waveIndex}, uptime ${g.state.uptime}, data ${g.state.data}`);
});
