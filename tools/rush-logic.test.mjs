// Unit tests for Breach Rush pure logic (no DOM): scoring/difficulty + leaderboard merge.
// Run: node --test tools/rush-logic.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  difficultyAt, threatPool, bossDue, comboMult, hitScore, TYPES, THREAT_KEYS,
} from '../src/rush/rules.js';
import { mergeScores, rankOf, sanitizeName } from '../src/rush/leaderboard.js';

test('difficulty ramps monotonically and stays bounded', () => {
  const a = difficultyAt(0), b = difficultyAt(60), c = difficultyAt(600);
  assert.ok(b.speedMul > a.speedMul && c.speedMul >= b.speedMul);
  assert.ok(b.interval < a.interval);
  assert.ok(c.speedMul <= 2.9 && c.interval >= 0.38 && c.threatRatio <= 0.82);
  assert.equal(a.stage, 1);
  assert.ok(difficultyAt(90).stage === 4);
});

test('threat variety unlocks over time; bosses gated and paced', () => {
  assert.deepEqual(threatPool(0).includes('phish'), false);
  assert.ok(threatPool(12).includes('phish'));
  assert.ok(threatPool(24).includes('exfil'));
  assert.ok(threatPool(38).includes('stealth'));
  assert.equal(bossDue(40, 0), false);          // too early
  assert.equal(bossDue(55, 0), true);           // first boss window
  assert.equal(bossDue(60, 55), false);         // cooldown not elapsed
  assert.equal(bossDue(82, 55), true);          // ~26s later
});

test('combo multiplier steps and caps at 6x', () => {
  assert.equal(comboMult(0), 1);
  assert.equal(comboMult(4), 1);
  assert.equal(comboMult(5), 2);
  assert.equal(comboMult(25), 6);
  assert.equal(comboMult(100), 6);
});

test('hitScore rewards early catches and combos; spares traffic', () => {
  const early = hitScore({ type: 'malware', distFrac: 1, combo: 0 });
  const late = hitScore({ type: 'malware', distFrac: 0, combo: 0 });
  assert.ok(early > late, 'catching far out scores more');
  const comboed = hitScore({ type: 'malware', distFrac: 0, combo: 25 });
  assert.equal(comboed, late * 6, '6x multiplier at high combo');
  assert.equal(hitScore({ type: 'traffic', distFrac: 1, combo: 10 }), 0, 'traffic is never a scored hit');
  assert.ok(hitScore({ type: 'ransom', distFrac: 0.5, combo: 0 }) > hitScore({ type: 'scan', distFrac: 0.5, combo: 0 }), 'boss worth more than recon');
});

test('type table is coherent', () => {
  assert.ok(THREAT_KEYS.length >= 5);
  assert.equal(TYPES.traffic.threat, false);
  assert.equal(TYPES.ransom.boss, true);
  assert.equal(TYPES.ransom.hits, 3);
  assert.equal(TYPES.stealth.hidden, true);
  assert.equal(TYPES.phish.mimic, true);
});

test('leaderboard merges, dedupes by id, keeps best, sorts desc', () => {
  const a = [{ name: 'Nova', score: 100, at: 1, id: 'x' }, { name: 'Ivy', score: 300, at: 2, id: 'y' }];
  const b = [{ name: 'Nova', score: 250, at: 3, id: 'x' }, { name: 'Max', score: 50, at: 4, id: 'z' }];
  const m = mergeScores(a, b);
  assert.deepEqual(m.map(r => r.name), ['Ivy', 'Nova', 'Max']);
  assert.equal(m.find(r => r.id === 'x').score, 250, 'kept the higher score for same id');
  assert.ok(m[0].score >= m[1].score && m[1].score >= m[2].score);
});

test('rankOf and sanitizeName', () => {
  const rows = [{ score: 500 }, { score: 300 }, { score: 100 }];
  assert.equal(rankOf(rows, 600), 1);
  assert.equal(rankOf(rows, 400), 2);
  assert.equal(rankOf(rows, 50), 4);
  assert.equal(sanitizeName('  <script>evil  '), 'scriptevil');
  assert.equal(sanitizeName(''), 'Anonymous');
  assert.equal(sanitizeName('x'.repeat(40)).length, 14);
});
