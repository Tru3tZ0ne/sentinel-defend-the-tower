// Last Stand 3D: production-simulation regressions (pure, no browser).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, ARENA, TUNE, gateAngle } from '../src/stand3d/sim.js';
import { playOnce, mulberry32 } from './stand3d-balance.mjs';
import { START_BASE, BOSS_TIMES, MISSION_SECONDS } from '../src/stand/model.js?campaign=agent-workflow-v1';

const run = (sim, seconds, input = {}) => { for (let i = 0; i < seconds * 60; i++) { sim.step(1 / 60, input); sim.fxq.length = 0; } };
const boot = (seed = 1, hooks = {}) => { const sim = createSim({ rng: mulberry32(seed), ...hooks }); const S = sim.start(0); return { sim, S }; };

test('opens with a bare mech, full Core HP and the EDR/MDR/HCI offer', () => {
  let offer = null; const { S } = boot(1, { onLevelUp: c => { if (c.length) offer = c; } });
  assert.equal(S.base, START_BASE); assert.deepEqual(S.levels, {});
  assert.deepEqual(offer.map(c => c.id), ['EDR', 'MDR', 'HCI']);
  assert.deepEqual(S.gates.active, [0]);
});

test('the mech is confined to the defense ring and dashes on a cooldown', () => {
  const { sim, S } = boot(2);
  run(sim, 3, { mx: 1, my: 0 }); assert.ok(Math.abs(Math.hypot(S.op.x, S.op.y) - ARENA.opMax) < 1e-6);
  run(sim, 4, { mx: -1, my: 0 }); assert.ok(Math.abs(Math.hypot(S.op.x, S.op.y) - ARENA.opMin) < 1e-6);
  const before = S.dashes; sim.step(1 / 60, { mx: 0, my: 1, dash: true }); assert.equal(S.dashes, before + 1); assert.ok(S.op.dashT > 0);
  sim.step(1 / 60, { dash: false }); sim.step(1 / 60, { dash: true }); assert.equal(S.dashes, before + 1, 'cooldown blocks a second dash');
  run(sim, TUNE.dashCd + .3, {}); sim.step(1 / 60, { dash: true }); assert.equal(S.dashes, before + 2);
});

test('threats leave an active gate and converge on the Core; an idle mech loses', () => {
  let over = null; const { sim, S } = boot(3, { onOver: r => { over = r; } });
  run(sim, 3);
  assert.ok(S.enemies.length > 0);
  for (const e of S.enemies) assert.ok(Math.abs(Math.atan2(e.y, e.x) - gateAngle(0)) < ARENA.gateSpread + .1, 'spawned inside the gate cone');
  const d0 = S.enemies.map(e => Math.hypot(e.x, e.y)); run(sim, 1);
  S.enemies.slice(0, d0.length).forEach((e, i) => { if (!e.dead) assert.ok(Math.hypot(e.x, e.y) < d0[i] + 1); });
  for (let i = 0; i < 130 && !over; i++) run(sim, 1, { aimX: -9999, aimY: 0 });   // aims away from every threat
  assert.equal(over.outcome, 'defeat'); assert.ok(over.elapsed < MISSION_SECONDS);
});

test('the attack front is a run of neighbouring gates that grows to three', () => {
  const { sim, S } = boot(4, { onLevelUp: () => {} });
  S.base = S.baseMax = 1e9; S.levels.HCI = 6;
  const seen = new Set();
  for (let t = 0; t < 100; t++) { run(sim, 1); const g = S.gates.active; seen.add(g.length); for (let i = 1; i < g.length; i++) assert.equal(g[i], (g[i - 1] + 1) % ARENA.gates); }
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
});

test('the NGAF arc only holds threats on the bearing the mech covers', () => {
  const { sim, S } = boot(5);
  sim.applyUpgrade('AF'); S.spawnAcc = -1e9;
  S.elapsed = 1; run(sim, .1);
  // hand-place two walkers: one on the mech's bearing (0 rad), one on the far side
  const spec = { id: 'malware', hp: 32, speed: 52, dmg: 58, xp: 2, score: 16, r: 17, color: '#ff8a3a' };
  for (const [id, a] of [[9001, 0], [9002, Math.PI]]) S.enemies.push({ id, type: 'malware', spec, x: Math.cos(a) * (ARENA.afR + 40), y: Math.sin(a) * (ARENA.afR + 40), r: 17, hp: 1e6, maxhp: 1e6, slow: 0, hit: 0, wob: 0, heading: 0, marked: false, afWeakened: false, spawnAcc: 0, attackAcc: 0, bornAt: 0, orbit: 1, held: false });
  S.shooters = [];                                   // nobody shoots during the check
  run(sim, 1.6, { aimX: 0, aimY: 9999 });
  const front = S.enemies.find(e => e.id === 9001), back = S.enemies.find(e => e.id === 9002);
  assert.ok(front.held, 'front walker is held on the arc');
  assert.ok(Math.abs(Math.hypot(front.x, front.y) - (ARENA.afR + 17)) < 1.5);
  assert.ok(!back || !back.held, 'far-side walker is not held');
  assert.ok(!back || Math.hypot(back.x, back.y) < ARENA.afR, 'and walks through');
  assert.ok(S.afHp < S.afMax);
});

test('a boss strike hurts a standing mech and misses a dashing one', () => {
  for (const dash of [false, true]) {
    const { sim, S } = boot(6);
    S.spawnAcc = -1e9; S.elapsed = BOSS_TIMES[0]; run(sim, .05);
    const boss = S.enemies.find(e => e.spec.boss); assert.ok(boss);
    boss.x = ARENA.bossHold; boss.y = 0; boss.attackAcc = 4; run(sim, .05);
    assert.ok(boss.attack, 'strike is telegraphed first');
    boss.attack.x = S.op.x; boss.attack.y = S.op.y; boss.attack.left = dash ? .05 : .2;
    const hp = S.base, dodged = S.dodged;
    if (dash) { sim.step(1 / 60, { mx: 0, my: 0, dash: true }); S.op.dashX = 0; S.op.dashY = 0; run(sim, .08, { dash: true }); }
    else run(sim, .3);
    if (dash) { assert.equal(S.base, hp); assert.equal(S.dodged, dodged + 1); }
    else assert.ok(S.base < hp - 100);
  }
});

test('same seed, same campaign', () => {
  const a = playOnce(777, 'casual'), b = playOnce(777, 'casual');
  assert.deepEqual([a.outcome, a.score, a.kills, a.hp], [b.outcome, b.score, b.kills, b.hp]);
});

test('scripted policies: informed play clears, cloud-only and idle builds do not', () => {
  const clears = policy => { let n = 0; for (let i = 0; i < 8; i++) if (playOnce(101 + i * 37, policy).outcome === 'victory') n++; return n; };
  assert.ok(clears('informed') >= 6); assert.equal(clears('cloud'), 0); assert.equal(clears('idle'), 0);
  let casual = 0; for (let i = 0; i < 30; i++) if (playOnce(101 + i * 37, 'casual').outcome === 'victory') casual++;
  assert.ok(casual >= 12 && casual <= 26, `casual mixed builds clear a middling share (got ${casual}/30)`);
});
