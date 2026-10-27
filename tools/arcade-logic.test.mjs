// Unit tests for the quick-play arcade games' pure logic.
// Run: node --test tools/arcade-logic.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, canMove, valueOf, TOP_TIER, CELLS } from '../src/stack/tiles.js';
import { mergeScores, rankOf, sanitizeName } from '../src/arcade/board.js';
import { makeCard, verdict, isCorrect, timeAt, scoreFor, SIGNALS } from '../src/sort/deck.js';
import { difficultyAt, spawnPick, killScore, comboMult as ppCombo, POPS } from '../src/panic/rules-panic.js';
import * as soc from '../src/soc/model.js';

// helper: build a 16-cell board from a 4x4 array of tiers (0 = empty)
let idc = 0;
function grid(rows) {
  const cells = new Array(16).fill(null);
  rows.flat().forEach((tier, i) => { if (tier) cells[i] = { id: ++idc, tier }; });
  return cells;
}
const tiers = cells => cells.map(c => (c ? c.tier : 0));

test('a line of two equal tiles merges toward the move direction', () => {
  const cells = grid([[1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const res = applyMove(cells, 'left');
  assert.ok(res.moved);
  assert.deepEqual(tiers(res.cells).slice(0, 4), [2, 0, 0, 0]);
  assert.equal(res.gained, valueOf(2));
  assert.deepEqual(res.mergedCells, [0]);
});

test('right move pushes and merges to the right edge', () => {
  const cells = grid([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const res = applyMove(cells, 'right');
  assert.deepEqual(tiers(res.cells).slice(0, 4), [0, 0, 0, 3]);
});

test('a run of three merges only one pair (the leading pair)', () => {
  const cells = grid([[1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const res = applyMove(cells, 'left');
  assert.deepEqual(tiers(res.cells).slice(0, 4), [2, 1, 0, 0]);
});

test('four-of-a-kind merges into two pairs', () => {
  const cells = grid([[3, 3, 3, 3], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const res = applyMove(cells, 'left');
  assert.deepEqual(tiers(res.cells).slice(0, 4), [4, 4, 0, 0]);
  assert.equal(res.gained, valueOf(4) * 2);
});

test('up move merges a column', () => {
  const cells = grid([[1, 0, 0, 0], [1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const res = applyMove(cells, 'up');
  assert.equal(tiers(res.cells)[0], 2);
});

test('no-op move is reported as not moved', () => {
  const cells = grid([[2, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const res = applyMove(cells, 'left');
  assert.equal(res.moved, false);
});

test('top-tile cannot merge further (caps the ladder)', () => {
  const cells = grid([[TOP_TIER, TOP_TIER, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const res = applyMove(cells, 'left');
  assert.equal(res.moved, false, 'two max tiles do not merge');
});

test('canMove: false only when board is full with no equal neighbours', () => {
  const locked = grid([[1, 2, 1, 2], [2, 1, 2, 1], [1, 2, 1, 2], [2, 1, 2, 1]]);
  assert.equal(canMove(locked), false);
  const open = grid([[1, 2, 1, 2], [2, 1, 2, 1], [1, 2, 1, 2], [2, 1, 2, 2]]);
  assert.equal(canMove(open), true);
  assert.equal(tiers(locked).filter(Boolean).length, CELLS);
});

test('maxTier tracks the highest tile after a move', () => {
  const cells = grid([[4, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  assert.equal(applyMove(cells, 'left').maxTier, 5);
});

test('leaderboard merge/dedupe/rank + name sanitise', () => {
  const a = [{ name: 'Nova', score: 100, at: 1, id: 'x' }];
  const b = [{ name: 'Nova', score: 250, at: 3, id: 'x' }, { name: 'Max', score: 50, at: 4, id: 'z' }];
  const m = mergeScores(a, b);
  assert.deepEqual(m.map(r => r.name), ['Nova', 'Max']);
  assert.equal(m[0].score, 250);
  assert.equal(rankOf(m, 300), 1);
  assert.equal(rankOf(m, 60), 2);
  assert.equal(sanitizeName('  <b>hi  '), 'bhi');
  assert.equal(sanitizeName(''), 'Anonymous');
});

// ---- Packet Sort ----
test('a card is hostile iff it carries any hostile signal; verdict follows', () => {
  // deterministic RNG stub to force a hostile card then a clean one
  let seq = [0.0, 0.0, 0.4, 0.0], i = 0;        // n=1, hostile branch
  const rngHostile = () => seq[i++ % seq.length];
  const hostile = makeCard(0, () => 0.01);       // hostile<0.52 true; bad key chosen
  assert.equal(hostile.malicious, hostile.signals.some(s => s.bad));
  assert.equal(verdict(hostile), hostile.malicious ? 'block' : 'allow');
  assert.equal(isCorrect(hostile, verdict(hostile)), true);
  assert.equal(isCorrect(hostile, verdict(hostile) === 'block' ? 'allow' : 'block'), false);
});

test('every signal declares a stable bad flag + EN/中文 labels', () => {
  for (const k of Object.keys(SIGNALS)) {
    assert.equal(typeof SIGNALS[k].bad, 'boolean');
    assert.ok(SIGNALS[k].en && SIGNALS[k].zh, `${k} is bilingual`);
  }
});

test('decision time shrinks with level but stays humane; speed+combo pay off', () => {
  assert.ok(timeAt(1) > timeAt(5));
  assert.ok(timeAt(50) >= 900);
  const slow = scoreFor({ timeFrac: 0, combo: 0 });
  const fast = scoreFor({ timeFrac: 1, combo: 0 });
  assert.ok(fast > slow, 'a faster call scores more');
  assert.equal(scoreFor({ timeFrac: 1, combo: 25 }), fast * 5, '5x combo cap');
});

// ---- Patch Panic ----
test('difficulty ramps: faster spawns, shorter fuses, more actors, bounded', () => {
  const a = difficultyAt(0), b = difficultyAt(60), c = difficultyAt(600);
  assert.ok(b.spawnInterval < a.spawnInterval && b.fuseMs < a.fuseMs);
  assert.ok(c.spawnInterval >= 420 && c.fuseMs >= 1250 && c.maxActive <= 6);
  assert.ok(b.maxActive > a.maxActive);
});

test('spawn variety unlocks over time; killScore scales with combo', () => {
  // force no-user branch by stubbing rng high enough to skip userRatio
  const noUser = () => 0.99;
  assert.ok(['malware'].includes(spawnPick(0, noUser)));           // only malware early
  const mid = new Set(Array.from({ length: 40 }, () => spawnPick(20, Math.random)));
  assert.ok(mid.has('exploit') || mid.has('malware'));            // exploit available by t=20
  assert.equal(killScore('malware', 0), POPS.malware.score);
  assert.equal(killScore('malware', 30), POPS.malware.score * ppCombo(30));
  assert.ok(ppCombo(30) <= 6 && ppCombo(0) === 1);
  assert.equal(POPS.ransom.hp, 3);
  assert.equal(POPS.user.decoy, true);
});

// ---- Incident Zero (SOC) ----
test('XDR correlation: needs >=2 alerts, same asset+IOC, >=2 distinct sensors', () => {
  const A = (sensor, asset, ioc) => ({ sensor, asset, ioc });
  assert.equal(soc.isValidCorrelation([A('AF', 'WS-1', '#a1')]), false, 'single alert is noise');
  assert.equal(soc.isValidCorrelation([A('AF', 'WS-1', '#a1'), A('EDR', 'WS-1', '#a1')]), true, 'two sensors, one IOC+asset');
  assert.equal(soc.isValidCorrelation([A('AF', 'WS-1', '#a1'), A('AF', 'WS-1', '#a1')]), false, 'same sensor does not corroborate');
  assert.equal(soc.isValidCorrelation([A('AF', 'WS-1', '#a1'), A('EDR', 'WS-1', '#b2')]), false, 'different IOC = unrelated');
  assert.equal(soc.isValidCorrelation([A('AF', 'WS-1', '#a1'), A('EDR', 'DB-2', '#a1')]), false, 'different asset');
});

test('each kill-chain stage maps to the one product whose real role stops it', () => {
  assert.equal(soc.containFor(0), 'AF');     // perimeter
  assert.equal(soc.containFor(1), 'EDR');    // endpoint
  assert.equal(soc.containFor(2), 'NDR');    // lateral
  assert.equal(soc.containFor(3), 'IAG');    // egress
  assert.equal(soc.containFor(soc.RANSOM_STAGE), 'ASTOR');  // restore
  assert.equal(soc.sensorFor(0), 'AF');
  assert.equal(soc.STAGES.length, 5);
});

test('SOC difficulty ramps and stays bounded; scoring rewards early catch + deep saves', () => {
  const a = soc.difficultyAt(0), b = soc.difficultyAt(60), c = soc.difficultyAt(600);
  assert.ok(b.incidentInterval < a.incidentInterval && b.stageAdvanceMs < a.stageAdvanceMs);
  assert.ok(c.stageAdvanceMs >= 2500 && c.alertTtl >= 5200 && c.maxIncidents <= 6);
  assert.ok(soc.confirmScore(0, 0) > soc.confirmScore(soc.RANSOM_STAGE, 0), 'earlier confirm worth more');
  assert.ok(soc.containScore(soc.RANSOM_STAGE, 0) > soc.containScore(0, 0), 'deeper containment averts more');
  assert.equal(soc.confirmScore(0, 16), soc.confirmScore(0, 0) * 5, '5x combo cap');
  assert.ok(soc.PENALTY_FALSE_CORR < 0 && soc.PENALTY_WRONG_TOOL < 0);
});

// ---------------- Threat Vector (survivor shooter) ----------------
import * as vec from '../src/vector/model.js';

test('vector: HCI is the fire-rate source (not EDR)', () => {
  const base = vec.deriveStats({});
  const hci = vec.deriveStats({ HCI: 3 });
  assert.ok(hci.fireRateMul > base.fireRateMul, 'HCI raises fire rate');
  const edr = vec.deriveStats({ EDR: 3 });
  assert.equal(edr.fireRateMul, base.fireRateMul, 'EDR does not touch fire rate');
});

test('vector: XDR damage multiplies ONLY over owned sensors (its real limitation)', () => {
  const xdrAlone = vec.deriveStats({ XDR: 4 });
  assert.equal(xdrAlone.xdrDmgMul, 1, 'XDR with no sensors multiplies nothing');
  assert.equal(xdrAlone.dmg, xdrAlone.baseDmg, 'so damage is unchanged');
  const oneSensor = vec.deriveStats({ XDR: 4, EDR: 1 });
  const twoSensors = vec.deriveStats({ XDR: 4, EDR: 1, NDR: 1 });
  assert.ok(twoSensors.xdrDmgMul > oneSensor.xdrDmgMul, 'more sensors -> more XDR damage');
  assert.ok(oneSensor.xdrDmgMul > 1, 'one sensor already helps');
});

test('vector: sensorCount counts EDR/NDR/AF only', () => {
  assert.equal(vec.sensorCount({ EDR: 2, NDR: 1, AF: 3 }), 3);
  assert.equal(vec.sensorCount({ HCI: 5, XDR: 5, MDR: 3 }), 0);
});

test('vector: each product derives its own system, scaling with level', () => {
  assert.equal(vec.deriveStats({}).edr, null);
  assert.ok(vec.deriveStats({ EDR: 1 }).edr.radius < vec.deriveStats({ EDR: 4 }).edr.radius);
  assert.ok(vec.deriveStats({ ASTOR: 3 }).astor.maxCharges === 3);
  assert.ok(vec.deriveStats({ NDR: 2 }).ndr.reveal === true);
  assert.ok(vec.deriveStats({ SASE: 2 }).sase.spawnMul > 1, 'SASE slows spawns');
  assert.ok(vec.deriveStats({ MDR: 3, EDR: 1, NDR: 1 }).mdr.dmg > vec.deriveStats({ MDR: 3 }).mdr.dmg, 'MDR aims better with sensors');
});

test('vector: difficulty is monotonic and pickDrop respects caps + is deterministic', () => {
  const a = vec.difficultyAt(0), b = vec.difficultyAt(60);
  assert.ok(b.spawnGap < a.spawnGap && b.hpMul > a.hpMul && b.cap >= a.cap);
  // all maxed -> no cap drop
  const maxed = {}; for (const id of vec.CAP_ORDER) maxed[id] = vec.CAPS[id].max;
  assert.equal(vec.pickDrop(maxed, () => 0.5), null);
  // deterministic given a fixed rng
  const rng = () => 0.0;
  assert.equal(vec.pickDrop({}, rng), vec.pickDrop({}, rng));
  // returns a grantable, non-maxed id
  const got = vec.pickDrop({ XDR: 1 }, Math.random);
  assert.ok(vec.CAP_ORDER.includes(got));
});

test('vector: scoring rewards combo, capped at 6x', () => {
  assert.equal(vec.comboMult(0), 1);
  assert.equal(vec.comboMult(100), 6);
  assert.ok(vec.killScore('ransom', 0) > vec.killScore('recon', 0), 'boss worth more');
  assert.equal(vec.killScore('recon', 100), vec.ENEMIES.recon.score * 6);
});

// ---------------- Breach Line (PvZ-style lane defense) ----------------
import * as line from '../src/line/model.js';

test('line: APT is stealthed - perimeter (AF) half-sees it, NDR/EDR hit full', () => {
  const apt = { type: 'apt' };
  assert.equal(line.damageFrom('AF', apt, 10), 4, 'AF only 40% vs stealthed APT');
  assert.equal(line.damageFrom('NDR', apt, 10), 10, 'NDR full');
  assert.equal(line.damageFrom('EDR', apt, 10), 10, 'EDR full');
  const mal = { type: 'malware' };
  assert.equal(line.damageFrom('AF', mal, 10), 10, 'AF full vs non-stealth');
});

test('line: XDR strike is weak alone, scales with sensors on the board', () => {
  assert.equal(line.xdrStrikeDamage(0), line.PLANTS.XDR.baseDmg, 'no sensors -> just base');
  assert.ok(line.xdrStrikeDamage(3) > line.xdrStrikeDamage(1));
  assert.ok(line.xdrStrikeDamage(1) > line.xdrStrikeDamage(0));
});

test('line: the sensor plants are AF/NDR/EDR and each defender has a cost', () => {
  assert.deepEqual(line.SENSOR_PLANTS.slice().sort(), ['AF', 'EDR', 'NDR']);
  for (const id of line.PLANT_ORDER) assert.ok(line.PLANTS[id].cost > 0, id + ' costs compute');
  assert.ok(line.PLANTS.HCI.kind === 'eco' && line.PLANTS.NDR.lanes === 3 && line.PLANTS.ASTOR.hp > line.PLANTS.AF.hp);
});

test('line: difficulty ramps and stays bounded; pools unlock over time', () => {
  const a = line.difficultyAt(0), b = line.difficultyAt(120);
  assert.ok(b.spawnGap < a.spawnGap && b.hpMul > a.hpMul && b.cap >= a.cap);
  assert.ok(line.threatPool(0).length < line.threatPool(100).length);
  assert.ok(!line.threatPool(0).includes('apt') && line.threatPool(100).includes('apt'));
});

test('line: scoring rewards combo (cap 6x) and boss > basic', () => {
  assert.equal(line.comboMult(0), 1);
  assert.equal(line.comboMult(100), 6);
  assert.ok(line.killScore('ransom', 0) > line.killScore('recon', 0));
  assert.equal(line.killScore('recon', 100), line.ZOMBIES.recon.score * 6);
});

// ---------------------------------------------------------------------------
// Last Stand — vertical survivor defense shooter (src/stand/model.js)
// ---------------------------------------------------------------------------
import * as stand from '../src/stand/model.js';

test('stand: EDR deploys turrets (then +dmg), MDR is one teammate that scales', () => {
  assert.equal(stand.deriveSquad({ EDR: 3 }).edrTurrets, 3);
  assert.equal(stand.deriveSquad({ EDR: 4 }).edrTurrets, 4);
  const e6 = stand.deriveSquad({ EDR: 6 });
  assert.equal(e6.edrTurrets, 4, 'turret count caps at 4');
  assert.ok(e6.edrDmg > stand.deriveSquad({ EDR: 4 }).edrDmg, 'extra EDR levels pump turret damage');
  // MDR: always a SINGLE teammate; levels raise its attack power and fire rate
  assert.equal(stand.deriveSquad({ MDR: 1 }).mdrAllies, 1);
  assert.equal(stand.deriveSquad({ MDR: 5 }).mdrAllies, 1, 'always one teammate, never a crowd');
  const m1 = stand.deriveSquad({ MDR: 1 }), m5 = stand.deriveSquad({ MDR: 5 });
  assert.ok(m5.mdrDmg > m1.mdrDmg, 'more MDR levels = more damage');
  assert.ok(m5.mdrRate > m1.mdrRate, 'more MDR levels = faster fire');
});

test('stand: HCI is a compute core = fire rate for ALL units (no damage of its own)', () => {
  const base = stand.deriveSquad({});
  const hci = stand.deriveSquad({ HCI: 4 });
  assert.ok(hci.fireRateMul > base.fireRateMul);
  assert.equal(hci.edrTurrets, 0);
  assert.equal(hci.edrDmg, base.edrDmg);
});

test('stand: NGAF deploys a barrier that blocks + weakens; IAG a slow band', () => {
  const af = stand.deriveSquad({ AF: 3 });
  assert.ok(af.afTier === 3 && af.afHp > 0 && af.afWeaken > 0 && af.afHalfWidth > 0);
  assert.equal(stand.deriveSquad({}).afTier, 0);
  const iag = stand.deriveSquad({ IAG: 3 });
  assert.ok(iag.iagBand && iag.iagSlowMul < 1);
  assert.equal(stand.deriveSquad({}).iagSlowMul, 1);
});

test('stand: the XDR beam is weak alone and multiplies with the SENSOR UNITS on the field', () => {
  const alone = stand.deriveSquad({ XDR: 3 });
  assert.ok(alone.beamOn && alone.xdrIdle && alone.sensors === 0);
  const fed = stand.deriveSquad({ XDR: 3, EDR: 2, NDR: 2, AF: 1 });
  assert.ok(!fed.xdrIdle && fed.sensors === (2 + 2 + 1), 'EDR turrets + NDR radars + AF barrier count');
  assert.ok(fed.beamDmg > alone.beamDmg * 2, 'sensors multiply the beam hard');
});

test('stand: NDR reveals + marks - cloaked APTs take half damage until NDR, bonus after', () => {
  const apt = stand.ENEMIES.apt;
  assert.equal(stand.visibilityMul(apt, stand.deriveSquad({})), 0.5);
  assert.equal(stand.visibilityMul(apt, stand.deriveSquad({ NDR: 1 })), 1);
  assert.equal(stand.damageTo(apt, stand.deriveSquad({}), 100), 50);
  const ndr = stand.deriveSquad({ NDR: 2 });
  assert.ok(stand.damageTo(apt, ndr, 100) > 100, 'marked threats take bonus damage');
});

test('stand: upgrades valid/never-maxed/nudge a sensor when XDR idle; difficulty ramps; combo cap 6x', () => {
  let seed = 11; const rng = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const offers = stand.upgradeChoices({ XDR: 1 }, rng);
  assert.equal(offers.length, 3);
  assert.ok(stand.SENSORS.some(s => offers.map(o => o.id).includes(s)), 'a sensor is offered when XDR idle');
  for (const o of offers) assert.ok(o.toLevel <= o.max);
  const maxed = {}; for (const id of stand.WEAPON_ORDER) maxed[id] = stand.WEAPONS[id].max;
  assert.equal(stand.upgradeChoices(maxed, rng).length, 0);
  const a = stand.difficultyAt(0), b = stand.difficultyAt(120);
  assert.ok(b.spawnGap < a.spawnGap && b.batch >= a.batch && b.speedMul <= 1.7);
  assert.ok(!stand.threatPool(0).includes('apt') && stand.threatPool(100).includes('apt'));
  assert.equal(stand.comboMult(0), 1); assert.equal(stand.comboMult(100), 6);
  assert.ok(stand.killScore('ransom', 1) > stand.killScore('recon', 1));
});
