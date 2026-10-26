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
