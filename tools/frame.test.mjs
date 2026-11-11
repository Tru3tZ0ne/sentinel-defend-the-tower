// Sentinel Frame: production-simulation regressions (pure, no browser).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, buildStage, xdrPower, xdrSensors, tierOf, STAGE_SECONDS, STAGES, MAXLV, PARTS, TIERS, FW_MAX } from '../src/frame/sim.js';
import { fly, mulberry32 } from './frame-balance.mjs';

const boot = (hooks = {}) => { const sim = createSim({ rng: mulberry32(7), ...hooks }); const S = sim.start(); S.cursor = 999; return { sim, S }; };
const run = (sim, s, input = {}) => { for (let i = 0; i < s * 60; i++) { sim.step(1 / 60, input); sim.fxq.length = 0; } };
const bullet = (x, y, vx = 0, vy = 0) => ({ x, y, vx, vy, r: .2, kind: 0, age: 0 });

test('the frame launches bare: no parts, Mk-I, three lives, three bombs', () => {
  const { S } = boot(); assert.deepEqual(Object.values(S.lv), [0, 0, 0, 0, 0, 0, 0]); assert.equal(S.tier, 0); assert.equal(S.lives, 3); assert.equal(S.bombs, 3);
});
test('stage scripts are deterministic and always deliver supply carriers', () => {
  for (let i = 0; i < STAGES.length; i++) {
    const a = buildStage(i), b = buildStage(i); assert.deepEqual(a, b);
    assert.equal(a.filter(e => e.type === 'carrier' && e.drop === 'part').length, 7); assert.ok(a.every(e => e.t < STAGE_SECONDS));
  }
});
test('parts stack on their hardpoints up to level 3 and the frame evolves at 3 / 8 / 15', () => {
  const evolved = []; const { sim, S } = boot({ onToast: k => { if (k.startsWith('evolve_')) evolved.push(k); } });
  assert.deepEqual(TIERS, [0, 3, 8, 15]); assert.equal(tierOf(2), 0); assert.equal(tierOf(8), 2);
  sim.grant('EDR'); sim.grant('AF'); assert.equal(S.tier, 0);
  S.eb.push(bullet(5, 15)); sim.grant('HCI'); assert.equal(S.tier, 1); run(sim, .05); assert.equal(S.eb.length, 0, 'evolving clears the sky');
  for (let k = 0; k < 4; k++) for (const id of PARTS) sim.grant(id);
  assert.ok(PARTS.every(id => S.lv[id] === MAXLV)); assert.equal(S.tier, 3); assert.deepEqual(evolved, ['evolve_1', 'evolve_2', 'evolve_3']);
});
test('a crate only offers parts the frame can still take, three at most', () => {
  const { sim, S } = boot(); for (let i = 0; i < 3; i++) for (const id of ['EDR', 'AF', 'NDR', 'XDR', 'HCI']) sim.grant(id);
  S.script = [{ t: 0, type: 'carrier', x: 0, y: 10, drop: 'part', dir: 1 }]; S.cursor = 0; S.ship.x = 0; S.ship.y = 2; run(sim, .1);
  S.enemies[0].hp = 1; S.ship.inv = 99; run(sim, 1.2); const it = S.items[0]; assert.ok(it, 'the carrier dropped a crate');
  assert.ok(it.cands.length <= 3); assert.ok(it.cands.every(id => id === 'MDR' || S.lv[id] < MAXLV)); assert.ok(it.cands.includes('IAG') && it.cands.includes('ASTOR'));
});
test('XDR is weak alone and grows with every other product installed', () => {
  const lv = { EDR: 0, AF: 0, NDR: 0, XDR: 2, HCI: 0, IAG: 0, ASTOR: 0 }, alone = xdrPower(lv);
  lv.NDR = 1; lv.IAG = 1; assert.equal(xdrSensors(lv), 2); assert.ok(xdrPower(lv) > alone * 2);
  lv.EDR = lv.AF = lv.HCI = lv.ASTOR = 1; assert.equal(xdrSensors(lv), 6); assert.ok(xdrPower(lv) > alone * 4.5);
});
test('the NGAF shield denies fire from the front only, and overloads when leaned on', () => {
  const { sim, S } = boot(); sim.grant('AF'); S.ship.inv = 0; const p = S.ship;
  S.eb.push(bullet(p.x, p.y + 4, 0, -6)); run(sim, .8); assert.equal(S.lives, 3); assert.equal(S.fw, FW_MAX[1] - 1 + 0, 'one charge spent');
  S.eb.push(bullet(p.x, p.y - 3, 0, 6)); run(sim, .8); assert.equal(S.lives, 2, 'a shot from behind gets through');
  S.ship.inv = 99; S.ship.dead = 0; S.fw = FW_MAX[S.lv.AF] || 0;
  if (!S.lv.AF) sim.grant('AF');
  for (let i = 0; i < 5; i++) S.eb.push(bullet(p.x, p.y + 1.5 + i * .01, 0, 0)); run(sim, .05); assert.equal(S.fwDown, true, 'overloaded');
  S.ship.inv = 99; run(sim, 4); assert.equal(S.fwDown, false, 'and it recharges');
});
test('aStor absorbs a hit and keeps the build; without it a life and the best part level go', () => {
  const { sim, S } = boot(); sim.grant('EDR'); sim.grant('EDR'); sim.grant('ASTOR'); S.ship.inv = 0;
  S.eb.push(bullet(S.ship.x, S.ship.y)); run(sim, .05); assert.equal(S.lives, 3); assert.equal(S.shield, 0); assert.equal(S.lv.EDR, 2);
  S.ship.inv = 0; S.eb.push(bullet(S.ship.x, S.ship.y)); run(sim, .05); assert.equal(S.lives, 2); assert.equal(S.lv.EDR, 1);
});
test('HCI makes every weapon cycle faster', () => {
  const fired = hci => { const { sim, S } = boot(); for (let i = 0; i < hci; i++) sim.grant('HCI'); let n = 0, seen = new Set(); for (let i = 0; i < 120; i++) { sim.step(1 / 60, {}); for (const s of S.shots) if (!seen.has(s)) { seen.add(s); n++; } } return n; };
  assert.ok(fired(3) > fired(0) * 1.35);
});
test('IAG slows hostile bullets only inside its ring', () => {
  const { sim, S } = boot(); sim.grant('IAG'); S.ship.inv = 99;
  S.eb.push(bullet(S.ship.x + 2, S.ship.y - 2, 0, -1), bullet(S.ship.x, 15, 0, -1));
  const y0 = S.eb.map(b => b.y); run(sim, .5); const moved = S.eb.map((b, i) => y0[i] - b.y);
  assert.ok(moved[0] < moved[1] * .9);
});
test('the MDR bomb clears every bullet and costs one bomb', () => {
  const { sim, S } = boot();
  for (let i = 0; i < 30; i++) S.eb.push(bullet(i / 4 - 4, 12, 0, -1));
  assert.ok(sim.bomb()); run(sim, .05); assert.equal(S.eb.length, 0); assert.equal(S.bombs, 2);
});
test('cloaked APTs take half damage until Cyber Command is aboard', () => {
  const dmg = withNdr => { const { sim, S } = boot(); if (withNdr) sim.grant('NDR'); S.script = [{ t: 0, type: 'apt', x: .45, y: 18, move: 'hover', hold: 18, stay: 99 }]; S.cursor = 0; run(sim, .1); const e = S.enemies[0]; e.hp = e.maxhp = 1000; e.x = S.ship.x + .45; e.move = 'none'; S.missiles.length = 0; S.ship.inv = 99; const n0 = S.missiles; void n0; run(sim, 1.5); return { d: 1000 - e.hp, S }; };
  const blind = dmg(false), seen = dmg(true); assert.ok(blind.d > 0); assert.ok(seen.d > blind.d * 1.6);
});
test('an idle frame loses; scripted pilots reach the bosses and can finish the campaign', () => {
  assert.equal(fly(101, 0).outcome, 'defeat');
  let wins = 0, bosses = 0; for (let i = 0; i < 10; i++) { const r = fly(101 + i * 37, 2); if (r.outcome === 'victory') wins++; bosses += r.cleared; }
  assert.ok(wins >= 6, `sharp pilot wins ${wins}/10`); assert.ok(bosses >= 24);
  const a = fly(555, 1), b = fly(555, 1); assert.deepEqual([a.score, a.kills, a.outcome], [b.score, b.kills, b.outcome]);
});
