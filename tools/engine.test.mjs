import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/game/engine.js';
import { LAYOUT, EMPLOYEES } from '../src/data/scenario.js';
import { MISSIONS, DIFFICULTIES, missionFor } from '../src/data/missions.js';

const game = (mission = 'quiet', difficulty = 'standard') => new Engine({ LAYOUT, EMPLOYEES, INCIDENT: missionFor(mission, difficulty) });
const advanceTo = (g, time) => { while (!g.ended && g.time < time) g.tick(Math.min(.1, time - g.time)); };

test('all nine mission/difficulty combinations have valid endpoints and finish', () => {
  for (const mission of Object.keys(MISSIONS)) for (const difficulty of Object.keys(DIFFICULTIES)) {
    const g = game(mission, difficulty);
    assert.equal(g.budget, DIFFICULTIES[difficulty].budget);
    let previous = -1;
    for (const beat of g.inc.beats) {
      assert.ok(LAYOUT.rooms.some(r => r.id === beat.room));
      assert.ok(beat.t >= previous && beat.t < g.inc.duration); previous = beat.t;
      if (beat.desk) { const probe = game(); probe.budget = 99; assert.ok(probe.deploy('EDR', beat.desk).ok, beat.desk); }
    }
    g.beginDay(); advanceTo(g, 150);
    assert.ok(g.ended, `${mission}/${difficulty} did not finish`);
    assert.ok(g.uptime >= 0 && g.uptime <= 100);
    assert.ok(g.data >= 0 && g.data <= 100);
  }
});

test('endpoint isolation targets the device, not any device in the same room', () => {
  const g = game(); g.budget = 99;
  g.deploy('EDR', 'office#1'); g.deploy('EDR', 'office#2');
  assert.equal(g.isolateDevice('office#2').ok, false);
  g.beginDay(); advanceTo(g, 11);
  assert.equal(g.isolateDevice('office#1').contained, false);
  assert.equal(g.intruder.contained, false);
  assert.equal(g.isolateDevice('office#2').contained, true);
  assert.equal(g.outcome.kind, 'contained');
});

test('invalid deployments and unavailable actions cannot consume credits', () => {
  const g = game(); const initial = g.budget;
  for (const endpoint of ['office#0', 'office#5', 'office#1#extra', 'office#01', 'unknown#1', 'l2-store#core']) assert.equal(g.deploy('EDR', endpoint).ok, false, endpoint);
  assert.equal(g.canAfford('unknown'), false);
  assert.equal(g.deployOperation('unknown').ok, false);
  assert.equal(g.budget, initial);
  g.beginDay(); assert.equal(g.deployOperation('HCI').ok, false);
  assert.equal(g.setHelperRule('recover'), false);
  assert.equal(g.lockdownRoom('unknown').ok, false);
});

test('ADC and HCI reduce distinct service impacts without containing the actor', () => {
  const prepared = game('storm'); prepared.deployOperation('ADC'); prepared.deployOperation('HCI');
  const unprepared = game('storm');
  prepared.beginDay(); unprepared.beginDay(); advanceTo(prepared, 28); advanceTo(unprepared, 28);
  assert.equal(prepared.uptime, 92); assert.equal(unprepared.uptime, 52);
  assert.equal(prepared.intruder.contained, false);
  assert.equal(prepared.log.filter(e => e.kind === 'attack' && e.prevented).length, 2);
});

test('SASE rejects remote access, leaves evidence and forces a slower route', () => {
  const g = game('robber'); g.deployOperation('SASE'); g.beginDay(); advanceTo(g, 10);
  const event = g.log.find(e => e.act === 'remote');
  assert.ok(event.blocked && event.visible); assert.equal(g.delay, 12);
  assert.equal(g.intruder.room, 'reception');
  advanceTo(g, 33); assert.equal(g.intruder.room, 'l2-finance');
  const unprotected = game('robber'); unprotected.deploy('NDR'); unprotected.beginDay(); advanceTo(unprotected, 10);
  assert.ok(unprotected.log.find(e => e.act === 'remote' && e.visible));
});

test('snapshot recovery needs advance preparation and works for both ransomware rooms', () => {
  const g = game('robber'); g.budget = 99; g.deploy('ASTOR'); g.beginDay(); advanceTo(g, 44);
  assert.ok(g.lockedRooms.has('server')); assert.ok(g.recover('server').ok);
  advanceTo(g, 60); assert.ok(g.lockedRooms.has('l2-finance')); assert.ok(g.recover('l2-finance').ok);
  const late = game('robber'); late.beginDay(); advanceTo(late, 44); late.deploy('ASTOR');
  assert.equal(late.astorReady, false); assert.equal(late.recover('server').ok, false);
});

test('helper recovers prepared snapshots and never fabricates external AI results', () => {
  const g = game('robber'); g.budget = 99; g.deployOperation('AICP'); g.deploy('ASTOR'); g.setHelperRule('recover');
  g.beginDay(); advanceTo(g, 60);
  assert.equal(g.lockedRooms.size, 0);
  assert.equal(g.log.filter(e => e.action === 'recover').length, 2);
  const notify = game(); notify.budget = 99; notify.deployOperation('AICP'); notify.deploy('AF'); notify.deploy('EDR', 'office#2'); notify.deploy('XDR');
  notify.beginDay(); advanceTo(notify, 23);
  assert.equal(notify.log.filter(e => e.kind === 'helper' && e.action === 'notify').length, 1);
});

test('containment does not erase existing ransomware; recovery remains playable', () => {
  const g = game('robber'); g.budget = 99; g.deploy('ASTOR'); g.beginDay(); advanceTo(g, 44);
  assert.ok(g.lockdownRoom('server').contained);
  assert.equal(g.phase, 'incident'); assert.ok(g.lockedRooms.has('server'));
  assert.ok(g.recover('server').ok); g.tick(.1);
  assert.equal(g.outcome.kind, 'contained'); assert.equal(g.lockedRooms.size, 0);
  const incomplete = game('robber'); incomplete.inc.duration = 45;
  incomplete.beginDay(); advanceTo(incomplete, 44); incomplete.lockdownRoom('server'); advanceTo(incomplete, 46);
  assert.equal(incomplete.outcome.kind, 'contained-disrupted');
  assert.equal(incomplete.outcome.verdict, 'partial');
});

test('large simulation steps preserve causal ordering and reject nonfinite input', () => {
  const a = game('storm'), b = game('storm'); a.beginDay(); b.beginDay();
  a.tick(NaN); a.tick(Infinity); a.tick(-1); assert.equal(a.time, 0);
  a.tick(30); for (let i = 0; i < 120; i++) b.tick(.25);
  assert.equal(a.uptime, b.uptime); assert.equal(a.beatIndex, b.beatIndex); assert.equal(a.budget, b.budget);
});
