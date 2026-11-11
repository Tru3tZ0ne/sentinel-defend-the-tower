// Rule tests for Sentinel Counter-Breach (pure sim, no browser).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, SITES, GATES, SPAWNS, VENTS, PRICE, TUNE, WIN_AT, ARMOR, xdrPower, cx, cz, rowOf, colOf, SOLID, idx } from '../src/counter/sim.js';
import { playMatch } from './counter-balance.mjs';

const DT = 1 / 30;
function fresh(seed = 5, setup) { const out = { toasts: [], feed: [], over: null }; const sim = createSim({ onToast: k => out.toasts.push(k), onFeed: f => out.feed.push(f), onOver: s => { out.over = s; } }); const S = sim.reset(seed); S.money = 99999; setup?.(sim, S); return { sim, S, out }; }
const run = (sim, S, secs, inp = {}, until) => { for (let t = 0; t < secs; t += DT) { sim.step(DT, typeof inp === 'function' ? inp() : inp); if (until?.()) return true; } return false; };
const godmode = S => { S.p.inv = 1e9; };

test('map: two sites, three gates, every spawn can walk to both sites', () => {
  const { sim } = fresh(); assert.equal(GATES.length, 3); assert.ok(SITES.A && SITES.B);
  for (const sp of [...SPAWNS, ...VENTS]) for (const k of ['A', 'B']) {
    let x = cx(sp.c), z = cz(sp.r), ok = false;
    for (let i = 0; i < 400 && !ok; i++) { const d = sim.nav(x, z, SITES[k].x, SITES[k].z); x += d.x * .5; z += d.z * .5; assert.equal(SOLID[idx(colOf(x), rowOf(z))], 0, 'path stays on floor'); ok = Math.hypot(x - SITES[k].x, z - SITES[k].z) < .6; }
    assert.ok(ok, `spawn ${sp.c},${sp.r} reaches site ${k}`);
  }
});

test('economy: prices are charged, levels cap, nothing sells mid-round', () => {
  const { sim, S } = fresh(); S.money = PRICE.EDR[0] + 100;
  assert.ok(sim.buy('EDR')); assert.equal(S.money, 100); assert.equal(S.lv.EDR, 1); assert.equal(sim.buy('EDR'), false, 'cannot afford the next level');
  S.money = 99999; sim.buy('EDR'); sim.buy('EDR'); assert.equal(S.lv.EDR, 3); assert.equal(sim.priceOf('EDR'), null); assert.equal(sim.buy('EDR'), false);
  assert.ok(sim.buy('ASTOR')); assert.equal(sim.buy('ASTOR'), false, 'only one snapshot is held');
  sim.ready(); assert.equal(S.phase, 'live'); assert.equal(sim.buy('HCI'), false, 'no buying after the buy phase');
});

test('NGAF: threats from the Internet go around a firewalled gate and never cross it', () => {
  const { sim, S } = fresh(11, (sim, S) => { sim.buy('AF'); sim.buy('AF'); }); assert.deepEqual(S.gateSel, [true, true, false]);
  sim.ready(); godmode(S); const walled = [GATES[0], GATES[1]]; let crossed = 0, eastUsed = 0;
  run(sim, S, 30, {}, () => { for (const th of S.threats) { if (th.type === 'worm') continue; const c = colOf(th.x), r = rowOf(th.z); if (walled.some(g => g.c === c && g.r === r)) crossed++; if (c === GATES[2].c && r === GATES[2].r) eastUsed++; } return false; });
  assert.equal(crossed, 0); assert.ok(eastUsed > 0, 'they used the open gate'); assert.ok(S.walls.every(w => w.hp === w.max), 'an avoidable wall is not attacked');
});

test('NGAF limits: worms start inside the perimeter and a Zero-Day walks through', () => {
  const { sim, S } = fresh(3, (sim, S) => { S.round = 4; for (let i = 0; i < 3; i++) sim.buy('AF'); }); sim.ready(); godmode(S); assert.equal(S.walls.length, 3);
  let bruteInside = false, wormInsideAtSpawn = true;
  run(sim, S, 45, {}, () => { for (const th of S.threats) { if (th.type === 'brute' && rowOf(th.z) > GATES[0].r && S.walls.some(w => !w.down)) bruteInside = true; if (th.type === 'worm' && th.spawnT > 0 && rowOf(th.z) <= GATES[0].r) wormInsideAtSpawn = false; } return bruteInside; });
  assert.ok(bruteInside, 'the Zero-Day passed a standing firewall'); assert.ok(wormInsideAtSpawn);
});

test('NGAF: with every gate closed the walls get attacked and can fall', () => {
  const { sim, S, out } = fresh(8, (sim, S) => { for (let i = 0; i < 3; i++) sim.buy('AF'); }); sim.ready(); godmode(S);
  run(sim, S, 60, {}, () => S.walls.some(w => w.down)); assert.ok(S.walls.some(w => w.hp < w.max)); assert.ok(S.stats.AF.blocked > 0);
});

test('Cyber Command: APTs are cloaked without it and visible with it', () => {
  for (const own of [false, true]) { const { sim, S } = fresh(4, (sim, S) => { S.round = 4; if (own) sim.buy('NDR'); }); sim.ready(); godmode(S); run(sim, S, 20, {}, () => S.threats.some(th => th.type === 'apt' && th.spawnT <= 0)); const apt = S.threats.find(th => th.type === 'apt'); assert.ok(apt); sim.step(DT, {}); assert.equal(apt.cloak, !own); }
});

test('XDR: weak alone, stronger with every other product owned', () => {
  const { sim, S } = fresh(); sim.buy('XDR'); const alone = xdrPower(S); for (const id of ['EDR', 'AF', 'NDR', 'HCI', 'IAG', 'ASTOR', 'MDR']) sim.buy(id);
  assert.equal(alone, .5); assert.equal(xdrPower(S), 2.25);
});

test('IAG: the grenade locks threats out, but an APT with stolen credentials shrugs it off', () => {
  const { sim, S } = fresh(4, (sim, S) => { S.round = 4; sim.buy('IAG'); sim.buy('NDR'); }); sim.ready(); godmode(S);
  run(sim, S, 25, {}, () => S.threats.some(th => th.type === 'apt' && th.spawnT <= 0) && S.threats.some(th => th.type === 'phish' && th.spawnT <= 0));
  const apt = S.threats.find(th => th.type === 'apt'), ph = S.threats.find(th => th.type === 'phish'); S.p.x = cx(11); S.p.z = cz(2); apt.x = S.p.x - 1; apt.z = S.p.z - 1; ph.x = S.p.x + 1; ph.z = S.p.z - 1;
  sim.step(DT, { yaw: 0, pitch: -1.2, nade: true }); run(sim, S, 1, { yaw: 0, pitch: -1.2 }, () => ph.stun > 0);
  assert.ok(ph.stun > 2.5); assert.ok(apt.stun > 0 && apt.stun <= 1.2); assert.equal(S.p.nades, 0);
});

test('encryptor: planted, then it detonates - lost without aStor, restored with it', () => {
  for (const own of [false, true]) {
    const { sim, S } = fresh(6, (sim, S) => { if (own) sim.buy('ASTOR'); }); sim.ready(); godmode(S);
    assert.ok(run(sim, S, 60, {}, () => S.bomb.state === 'planted'), 'the carrier plants when nobody stops it');
    run(sim, S, TUNE.fuse + 2, {}, () => S.phase === 'end'); assert.equal(S.last.result, own ? 'restored' : 'encrypted'); assert.equal(S.last.win, own); assert.equal(S.snap, 0);
  }
});

test('encryptor: holding use next to it defuses, and MDR defuses from anywhere', () => {
  let { sim, S } = fresh(6); sim.ready(); godmode(S); run(sim, S, 60, {}, () => S.bomb.state === 'planted');
  S.p.x = S.bomb.x + 1; S.p.z = S.bomb.z; run(sim, S, TUNE.defuse + .5, { use: true }, () => S.phase === 'end'); assert.equal(S.last.result, 'defused'); assert.equal(S.you, 1);
  ({ sim, S } = fresh(6, sim => sim.buy('MDR'))); sim.ready(); godmode(S); run(sim, S, 60, {}, () => S.bomb.state === 'planted');
  sim.step(DT, { mdr: true }); assert.equal(S.last.result, 'defused'); assert.equal(S.mdr, 0); assert.equal(S.stats.MDR.defuses, 1);
});

test('killing the carrier drops the encryptor and another threat fetches it', () => {
  const { sim, S } = fresh(9); sim.ready(); godmode(S); run(sim, S, 20, {}, () => S.threats.some(th => th.id === S.bomb.carrier && th.spawnT <= 0) && S.threats.length > 2);
  const c = S.threats.find(th => th.id === S.bomb.carrier); sim.damage(c, 9999, 'EDR', false); assert.equal(S.bomb.state, 'dropped');
  assert.ok(run(sim, S, 40, {}, () => S.bomb.state === 'carried'), 'picked up again'); assert.notEqual(S.bomb.carrier, c.id);
});

test('HCI: armor halves damage and level 3 fails over once per round', t => {
  const keep = TUNE.enemyDmg; TUNE.enemyDmg = 1; t.after(() => { TUNE.enemyDmg = keep; });
  const { sim, S } = fresh(2, sim => { sim.buy('HCI'); }); sim.ready(); assert.equal(S.p.armor, ARMOR[1]);
  sim.hurt(40, 0, 0, 'phish'); assert.equal(S.p.hp, 80); assert.equal(S.p.armor, 30);
  const b = fresh(2, sim => { for (let i = 0; i < 3; i++) sim.buy('HCI'); }); b.sim.ready(); b.S.p.armor = 0;
  b.sim.hurt(500, 0, 0, 'brute'); assert.equal(b.S.p.hp, 60); assert.equal(b.S.phase, 'live'); b.S.p.inv = 0; b.sim.hurt(500, 0, 0, 'brute'); assert.equal(b.S.phase, 'end'); assert.equal(b.S.last.result, 'down');
});

test('the rifle hits what it is aimed at, headshots double, walls stop bullets', () => {
  const { sim, S } = fresh(7); sim.ready(); godmode(S); run(sim, S, 12, {}, () => S.threats.some(th => th.type === 'phish' && th.spawnT <= 0));
  const th = S.threats.find(o => o.type === 'phish'); S.threats = [th]; S.queue = []; th.stun = 99; S.p.x = cx(5); S.p.z = cz(19); th.x = S.p.x + 6; th.z = S.p.z; th.hp = th.max = 1000; const E = -Math.PI / 2;
  S.p.fireCd = 0; S.p.bloom = 0; sim.step(DT, { yaw: E, pitch: Math.atan2(1.0 - 1.6, 6), fire: true }); assert.equal(1000 - th.hp, 26, 'body shot');
  S.p.fireCd = 0; S.p.bloom = 0; const hp = th.hp; sim.step(DT, { yaw: E, pitch: 0, fire: true }); assert.equal(hp - th.hp, 52, 'headshot');
  S.p.x = cx(11); th.x = S.p.x; th.z = S.p.z - 8; S.p.fireCd = 0; S.p.bloom = 0; const hp2 = th.hp; sim.step(DT, { yaw: 0, pitch: 0, fire: true }); assert.equal(th.hp, hp2, 'the pillar north of spawn blocks the shot');
});

test('a match is first to four rounds and replays identically from a seed', () => {
  const a = playMatch('sharp', 77), b = playMatch('sharp', 77), idle = playMatch('idle', 5);
  assert.equal(Math.max(a.you, a.them), WIN_AT); assert.equal(a.score, b.score); assert.deepEqual(a.history, b.history);
  assert.equal(idle.outcome, 'defeat'); assert.equal(idle.them, WIN_AT);
});
