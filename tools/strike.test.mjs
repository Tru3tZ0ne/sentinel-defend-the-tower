// Sentinel Strike: production-simulation regressions (pure, no browser).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, buildStage, xdrPower, xdrSensors, STAGE_SECONDS, STAGES, MAXLV } from '../src/strike/sim.js';
import { fly, mulberry32 } from './strike-balance.mjs';

const boot = (hooks = {}) => { const sim = createSim({ rng: mulberry32(7), ...hooks }); return { sim, S: sim.start() }; };
const run = (sim, s, input = {}) => { for (let i = 0; i < s * 60; i++) { sim.step(1 / 60, input); sim.fxq.length = 0; } };

test('starts with the EDR vulcan, three lives and three bombs', () => {
  const { S } = boot(); assert.equal(S.main, 'EDR'); assert.equal(S.mainLv, 1); assert.equal(S.lives, 3); assert.equal(S.bombs, 3);
});
test('stage scripts are deterministic and always deliver supply carriers', () => {
  for (let i = 0; i < STAGES.length; i++) {
    const a = buildStage(i), b = buildStage(i); assert.deepEqual(a, b);
    assert.ok(a.filter(e => e.type === 'carrier').length >= 6); assert.ok(a.every(e => e.t < STAGE_SECONDS));
  }
});
test('same main weapon levels up, a different one switches and keeps the level', () => {
  const { sim, S } = boot(); sim.grant('EDR'); sim.grant('EDR'); assert.equal(S.mainLv, 3);
  sim.grant('AF'); assert.equal(S.main, 'AF'); assert.equal(S.mainLv, 3);
  for (let i = 0; i < 9; i++) sim.grant('AF'); assert.equal(S.mainLv, MAXLV.AF);
});
test('XDR is weak alone and grows with every support product feeding it', () => {
  const lv = { NDR: 0, HCI: 0, IAG: 0, ASTOR: 0 }; const alone = xdrPower(3, lv);
  lv.NDR = 1; lv.IAG = 1; assert.equal(xdrSensors(lv), 2); assert.ok(xdrPower(3, lv) > alone * 1.9);
  lv.HCI = 1; lv.ASTOR = 1; assert.ok(xdrPower(3, lv) > alone * 3);
});
test('aStor absorbs a hit and keeps the build; without it a life and a weapon level go', () => {
  const { sim, S } = boot(); sim.grant('EDR'); sim.grant('ASTOR'); S.ship.inv = 0; S.cursor = 999;
  S.eb.push({ x: S.ship.x, y: S.ship.y, vx: 0, vy: 0, r: .2, kind: 0, age: 0 }); run(sim, .05);
  assert.equal(S.lives, 3); assert.equal(S.shield, 0); assert.equal(S.mainLv, 2);
  S.ship.inv = 0; S.eb.push({ x: S.ship.x, y: S.ship.y, vx: 0, vy: 0, r: .2, kind: 0, age: 0 }); run(sim, .05);
  assert.equal(S.lives, 2); assert.equal(S.mainLv, 1);
});
test('IAG slows hostile bullets only inside its ring', () => {
  const { sim, S } = boot(); sim.grant('IAG'); S.cursor = 999; S.ship.inv = 99;
  S.eb.push({ x: S.ship.x + 2, y: S.ship.y + 2, vx: 0, vy: 1, r: .1, kind: 0, age: 0 }, { x: S.ship.x, y: 15, vx: 0, vy: 1, r: .1, kind: 0, age: 0 });
  const y0 = S.eb.map(b => b.y); run(sim, .5); const moved = S.eb.map((b, i) => b.y - y0[i]);
  assert.ok(moved[0] < moved[1] * .9);
});
test('the MDR bomb clears every bullet and costs one bomb', () => {
  const { sim, S } = boot(); S.cursor = 999;
  for (let i = 0; i < 30; i++) S.eb.push({ x: i / 4 - 4, y: 12, vx: 0, vy: -1, r: .2, kind: 0, age: 0 });
  assert.ok(sim.bomb()); run(sim, .05); assert.equal(S.eb.length, 0); assert.equal(S.bombs, 2);
});
test('cloaked APTs take half damage until Cyber Command is aboard', () => {
  const dmg = withNdr => { const { sim, S } = boot(); if (withNdr) sim.grant('NDR'); S.cursor = 999; S.script = [{ t: 0, type: 'apt', x: 0, y: 18, move: 'hover', hold: 18, stay: 99 }]; S.cursor = 0; run(sim, .1); const e = S.enemies[0]; e.hp = e.maxhp = 1000; S.missiles.length = 0; run(sim, 1.5); return 1000 - e.hp; };
  const blind = dmg(false), seen = dmg(true); assert.ok(blind > 0); assert.ok(seen > blind * 1.6);
});
test('an idle ship loses; scripted pilots reach the bosses and can finish the campaign', () => {
  assert.equal(fly(101, 0).outcome, 'defeat');
  let wins = 0, bosses = 0; for (let i = 0; i < 10; i++) { const r = fly(101 + i * 37, 2); if (r.outcome === 'victory') wins++; bosses += r.cleared; }
  assert.ok(wins >= 6, `sharp pilot wins ${wins}/10`); assert.ok(bosses >= 24);
  const a = fly(555, 1), b = fly(555, 1); assert.deepEqual([a.score, a.kills, a.outcome], [b.score, b.kills, b.outcome]);
});
