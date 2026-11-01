import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { difficultyAt, bossHpScale, ENEMIES, MAX_ACTIVE_THREATS } from '../src/stand/model.js';
import { createCombatProbe, playProbe, sampleBalance } from './stand-balance.mjs';

// Historical v2 rules, used only for a reproducible before/after comparison.
const previous = {
  difficultyAt: t => ({ spawnGap: Math.max(250, 940 - t * 7.5), batch: Math.min(5, 1 + Math.floor(t / 19)),
    hpMul: 1 + t * .052, speedMul: Math.min(1.7, 1 + t * .011), bossEvery: 38 }),
  bossHpScale: (t, mega) => 1 + t * (mega ? .007 : .004),
  MAX_ACTIVE_THREATS: Infinity,
};

test('stand pacing: opening minute retains previous difficulty and seeded play', () => {
  for (const t of [0, 15, 30, 45, 60]) {
    assert.deepEqual(difficultyAt(t), previous.difficultyAt(t));
    for (const mega of [false, true]) assert.equal(bossHpScale(t, mega), previous.bossHpScale(t, mega));
  }
  for (const policy of ['casual', 'informed']) {
    const options = { seed: 101, policy, limit: 60 };
    assert.deepEqual(playProbe(options), playProbe({ ...options, overrides: previous }));
  }
});

test('stand pacing: escalating durability, bounded spawns, no timed defeat', () => {
  let hp = 0;
  for (let t = 0; t <= 600; t += 5) {
    const d = difficultyAt(t);
    assert.ok(d.hpMul >= hp && d.spawnGap >= 300 && d.batch <= 4 && d.speedMul <= 1.7);
    if (t > 60) assert.ok(d.hpMul > previous.difficultyAt(t).hpMul);
    hp = d.hpMul;
  }
  for (const mega of [false, true]) assert.ok(bossHpScale(150, mega) > previous.bossHpScale(150, mega) * 4);
  const g = createCombatProbe();
  g.state.elapsed = 59.99; g.state.lastBoss = 60;
  g.step(.02); g.step(.02);
  assert.equal(g.toasts.filter(t => t === 'pressure').length, 1);
  g.state.elapsed = 179.99; g.state.lastBoss = 180;
  g.step(.02);
  assert.equal(g.state.phase, 'play');
  assert.equal(g.state.base, g.state.baseMax);
});

function fill(g, type, count) {
  g.state.enemies = Array.from({ length: count }, (_, i) => ({ id: 90000 + i, type,
    spec: { ...ENEMIES[type], speed: 0 }, x: g.fieldL + 50, y: 50, r: ENEMIES[type].r,
    hp: ENEMIES[type].hp, maxhp: ENEMIES[type].hp, slow: 0, hit: 0, wob: 0, spawnAcc: 100,
    afWeakened: false, marked: false }));
}

test('stand pacing: all spawn paths respect capacity; a delayed boss keeps its place', () => {
  const g = createCombatProbe();
  fill(g, 'recon', MAX_ACTIVE_THREATS);
  g.state.elapsed = 120; g.state.spawnAcc = 1000;
  g.step(1 / 60);
  assert.equal(g.state.enemies.length, MAX_ACTIVE_THREATS);
  assert.equal(g.state.bossCount, 0);
  g.state.enemies.pop(); g.state.spawnAcc = 0;
  g.step(1 / 60);
  assert.equal(g.state.bossCount, 1);
  assert.equal(g.state.enemies.at(-1).type, 'ransom');
  for (const type of ['botnet', 'siege']) {
    const crowd = createCombatProbe(); fill(crowd, type, MAX_ACTIVE_THREATS - 1);
    crowd.state.lastBoss = 1000; crowd.step(1 / 60);
    assert.equal(crowd.state.enemies.length, MAX_ACTIVE_THREATS);
  }
  const worms = createCombatProbe(); fill(worms, 'worm', MAX_ACTIVE_THREATS);
  worms.useAbility('ir');
  assert.ok(worms.state.enemies.length <= MAX_ACTIVE_THREATS);
});

test('stand pacing: seeded probe is repeatable', () => {
  assert.deepEqual(playProbe({ seed: 286 }), playProbe({ seed: 286 }));
});

test('stand pacing: desktop and phone strategies reach short sessions with room for skill', () => {
  const rows = [];
  for (const [device, width, height] of [['desktop', 1440, 942], ['phone', 390, 786]]) {
    for (const policy of ['casual', 'informed']) {
      const result = sampleBalance({ width, height, policy, seeds: 12 });
      assert.equal(result.ended, 12, `${device}/${policy}: long-running build`);
      assert.ok(result.mean >= 105 && result.mean <= 165, `${device}/${policy}: ${result.mean}s active`);
      assert.ok(result.runs.every(r => r.peakEnemies <= MAX_ACTIVE_THREATS));
      // Decision pauses vary by person. This is an estimate, not measured wall time.
      const estimatedSessionMean = result.runs.reduce((sum, r) => sum + r.seconds + r.choices * 1.5, 0) / 12;
      assert.ok(estimatedSessionMean >= 120 && estimatedSessionMean <= 185);
      rows.push({ device, policy, ...result, estimatedSessionMean: Math.round(estimatedSessionMean * 10) / 10 });
    }
    const casual = rows.find(r => r.device === device && r.policy === 'casual');
    const informed = rows.find(r => r.device === device && r.policy === 'informed');
    assert.ok(informed.mean > casual.mean + 10, 'Build choices, aiming and skill timing still matter');
  }
  const old = sampleBalance({ seeds: 4, policy: 'informed', overrides: previous });
  assert.equal(old.ended, 0, 'Historical defense builds should reproduce the long-session issue');
  mkdirSync('tools/shots', { recursive: true });
  writeFileSync('tools/shots/stand-balance.json', JSON.stringify({ previous: old, current: rows }, null, 2));
  console.log(JSON.stringify(rows.map(({ device, policy, mean, min, max, estimatedSessionMean }) =>
    ({ device, policy, activeMean: mean, min, max, estimatedSessionMean }))));
});
