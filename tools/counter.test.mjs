// Rule tests for Sentinel Counter-Breach (pure sim, no browser).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, SITES, GATES, SPAWNS, VENTS, PRICE, TUNE, WIN_AT, ARMOR, xdrPower, cx, cz, rowOf, colOf, SOLID, CRATE, CRATE_H, MUTATORS, CONTRACT_PAY, EYE, idx } from '../src/counter/sim.js';
import { playMatch } from './counter-balance.mjs';

const DT = 1 / 30;
function fresh(seed = 5, setup) { const out = { toasts: [], feed: [], over: null }; const sim = createSim({ onToast: k => out.toasts.push(k), onFeed: f => out.feed.push(f), onOver: s => { out.over = s; } }); const S = sim.reset(seed); S.money = 99999; setup?.(sim, S); return { sim, S, out }; }
const run = (sim, S, secs, inp = {}, until) => { for (let t = 0; t < secs; t += DT) { sim.step(DT, typeof inp === 'function' ? inp() : inp); if (until?.()) return true; } return false; };
const godmode = S => { S.p.inv = 1e9; };
const quiet = S => { S.queue = S.queue.slice(-1); S.queue[0].at = 1e9; S.threats = []; }; // an empty round that does not end

test('map: two sites, three gates, every spawn can walk to both sites', () => {
  const { sim } = fresh(); assert.equal(GATES.length, 3); assert.ok(SITES.A && SITES.B);
  for (const sp of [...SPAWNS, ...VENTS]) for (const k of ['A', 'B']) {
    let x = cx(sp.c), z = cz(sp.r), ok = false;
    for (let i = 0; i < 400 && !ok; i++) { const d = sim.nav(x, z, SITES[k].x, SITES[k].z); x += d.x * .5; z += d.z * .5; assert.equal(SOLID[idx(colOf(x), rowOf(z))] + CRATE[idx(colOf(x), rowOf(z))], 0, 'path stays on floor'); ok = Math.hypot(x - SITES[k].x, z - SITES[k].z) < .6; }
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

// ---------- v2: movement, cover, incidents, contracts ----------
const CR = { c: 6, r: 19 }; // a crate west of the player spawn, open floor on both sides
test('jump: a crate blocks walking, a jump lands on top, walking off drops back down', () => {
  assert.equal(CRATE[idx(CR.c, CR.r)], 1);
  const { sim, S } = fresh(5); sim.ready(); godmode(S); quiet(S); const p = S.p, W = Math.PI / 2; p.x = cx(CR.c) + 2.2; p.z = cz(CR.r);
  run(sim, S, 1.2, { yaw: W, mz: 1 }); assert.ok(p.x > cx(CR.c) + 1, 'walking does not get through'); assert.equal(p.y, 0);
  let apex = 0; sim.step(DT, { yaw: W, mz: 1, jump: true }); run(sim, S, 1, { yaw: W, mz: 1 }, () => { apex = Math.max(apex, p.y); return p.ground && p.y > 0; });
  assert.ok(apex > CRATE_H && apex < 1.5, `apex ${apex}`); assert.equal(p.y, CRATE_H); assert.ok(p.ground); assert.equal(colOf(p.x), CR.c);
  run(sim, S, 1.5, { yaw: W, mz: 1 }, () => p.ground && p.y === 0); assert.equal(p.y, 0); assert.ok(p.x < cx(CR.c) - 1, 'walked off the far side');
});

test('cover: walkers path around crates, and a worm cannot bite a defender standing on one', () => {
  const { sim, S } = fresh(3, (sim, S) => { S.round = 2; }); S.mut = 'outbreak'; sim.ready(); S.queue = S.queue.filter(q => q.type === 'worm'); const p = S.p; p.x = cx(CR.c); p.z = cz(CR.r); p.y = CRATE_H;
  let inCrate = 0, near = false; run(sim, S, 40, {}, () => { for (const th of S.threats) { if (CRATE[idx(colOf(th.x), rowOf(th.z))]) inCrate++; if (th.dist < 1.6 && th.spawnT <= 0) near = true; } return false; });
  assert.ok(near, 'worms reached the crate'); assert.equal(inCrate, 0); assert.equal(S.p.hp, 100, 'no bites landed');
  p.x = cx(CR.c) + 2.4; run(sim, S, 6, {}, () => p.hp < 100); assert.ok(p.hp < 100, 'on the floor they bite');
});

test('cover: crouching behind a crate breaks a sniper line that standing does not', () => {
  const { sim } = fresh(); const px = cx(CR.c) + 1.6, pz = cz(CR.r), sx = cx(CR.c) - 6;
  assert.ok(sim.los3(sx, 1.5, pz, px, EYE - .2, pz), 'standing: exposed'); assert.equal(sim.los3(sx, 1.5, pz, px, EYE - .6 - .2, pz), false, 'crouched: covered');
  assert.ok(sim.los3(sx, 1.5, pz + 4, px, EYE - .8, pz + 4), 'no crate, no cover');
});

test('incidents: round 1 is standard, later rounds roll a mutator; an insider carrier starts inside', () => {
  const { sim, S, out } = fresh(21); assert.equal(S.mut, null); assert.ok(S.contract && !S.contract.done);
  S.round = 2; S.mut = 'insider'; sim.ready(); godmode(S); run(sim, S, 8, {}, () => S.bomb.carrier > 0);
  const c = S.threats.find(th => th.id === S.bomb.carrier); assert.ok(c); assert.ok(rowOf(c.z) > GATES[0].r, 'spawned behind the gates'); assert.ok(out.toasts.includes('insider'));
  const seen = new Set(); for (let seed = 1; seed < 40; seed++) { const a = fresh(seed); a.sim.ready(); a.sim.endRound('time'); run(a.sim, a.S, 6, {}, () => a.S.phase === 'buy'); assert.equal(a.S.round, 2); assert.ok(MUTATORS[a.S.mut]); seen.add(a.S.mut); }
  assert.equal(seen.size, Object.keys(MUTATORS).length, 'every incident type turns up');
});

test('incidents: a DDoS halves the firewalls and a fast encryptor shortens the fuse', () => {
  let { sim, S } = fresh(4, (sim, S) => { sim.buy('AF'); S.round = 2; }); S.mut = 'ddos'; sim.ready(); assert.equal(S.walls[0].hp, S.walls[0].max / 2);
  ({ sim, S } = fresh(6, (sim, S) => { S.round = 2; })); S.mut = 'rush'; sim.ready(); godmode(S); assert.ok(run(sim, S, 60, {}, () => S.bomb.state === 'planted')); assert.ok(S.bomb.t <= TUNE.fuse * .72 + .01);
});

test('streaks and contracts pay: chained kills add a bonus, a finished contract adds its fee once', () => {
  const { sim, S } = fresh(9, (sim, S) => { S.round = 3; }); sim.ready(); godmode(S); run(sim, S, 14, {}, () => S.threats.filter(th => th.spawnT <= 0).length >= 4);
  S.contract = { id: 'multi', need: 3, have: 0, done: false }; const live = S.threats.filter(th => th.spawnT <= 0 && th.id !== S.bomb.carrier).slice(0, 3); let m0 = S.money, rewards = 0;
  for (const th of live) { rewards += ({ phish: 100, worm: 50, trojan: 150, apt: 300, brute: 600, carrier: 300 })[th.type]; sim.kill(th, 'EDR', false); }
  assert.equal(S.streakN, 3); assert.equal(S.maxStreak, 3); assert.ok(S.contract.done); assert.equal(S.contractsDone, 1); assert.equal(S.money - m0, rewards + 50 + 100 + CONTRACT_PAY);
  m0 = S.money; sim.progress('multi', 3, true); assert.equal(S.money, m0, 'paid once');
});

test('pickups: the hotfix kit heals only when hurt, intel pays on contact', () => {
  const { sim, S } = fresh(2); sim.ready(); godmode(S); quiet(S); const kit = S.loot.find(l => l.kind === 'patch'); assert.ok(kit);
  S.p.x = kit.x; S.p.z = kit.z; sim.step(DT, {}); assert.ok(S.loot.includes(kit) || S.loot.some(l => l.id === kit.id), 'full health leaves it'); S.p.hp = 50; sim.step(DT, {}); assert.equal(S.p.hp, 90); assert.ok(!S.loot.some(l => l.id === kit.id));
  S.loot.push({ id: 999, kind: 'intel', x: S.p.x, z: S.p.z, val: 250, t: 5 }); const m = S.money; sim.step(DT, {}); assert.equal(S.money, m + 250);
});

test('difficulty scales incoming damage and the final score', () => {
  const mk = diff => { const sim = createSim({}); const S = sim.reset(2, { diff }); sim.ready(); return { sim, S }; };
  const e = mk('easy'), h = mk('hard'); e.sim.hurt(20, 0, 0, 'phish'); h.sim.hurt(20, 0, 0, 'phish'); assert.ok(100 - h.S.p.hp > (100 - e.S.p.hp) * 1.7);
  const a = playMatch('sharp', 77), b = playMatch('sharp', 77, false, 'hard'); assert.equal(a.diff, 'normal'); assert.equal(b.diff, 'hard');
});
