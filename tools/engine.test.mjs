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
  advanceTo(g, 33); assert.equal(g.intruder.room, 'office'); assert.equal(g.intruder.desk, 'office#2');
  assert.ok(g.log.some(e => e.kind === 'branch' && e.route === 'local-office'));
  assert.equal(MISSIONS.robber.beats.find(b => b.act === 'foothold').room, 'l2-finance');
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
  g.beginDay(); advanceTo(g, 66);
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
  assert.equal(g.phase, 'incident'); assert.ok(g.lockedRooms.has('server'));
  advanceTo(g, 50);
  assert.equal(g.outcome.kind, 'contained'); assert.equal(g.lockedRooms.size, 0);
  const incomplete = game('robber'); incomplete.inc.duration = 45;
  incomplete.beginDay(); advanceTo(incomplete, 44); incomplete.lockdownRoom('server'); advanceTo(incomplete, 46);
  assert.equal(incomplete.outcome.kind, 'contained-disrupted');
  assert.equal(incomplete.outcome.verdict, 'partial');
});

test('setup undo refunds mixed purchases and cannot change a live incident', () => {
  const g = game(); const budget = g.budget;
  g.deploy('EDR','office#2'); g.deployOperation('SASE'); g.deploy('ASTOR');
  assert.ok(g.astorReady); assert.ok(g.undoSetup().ok); assert.equal(g.astorReady,false);
  g.undoSetup(); assert.equal(g.operations.has('SASE'),false);
  g.undoSetup(); assert.equal(g.edrDesks.size,0); assert.equal(g.deployed.length,0);
  assert.equal(g.budget,budget); assert.equal(g.undoSetup().ok,false);
  g.deploy('AF'); g.beginDay(); assert.equal(g.undoSetup().ok,false); assert.ok(g.hasAF);
});

test('restores have a cost, exclusive capacity, cancellation and actual completion', () => {
  const g = game('robber'); g.budget=99; g.deploy('ASTOR'); g.beginDay(); advanceTo(g,44);
  const budget=g.budget; assert.ok(g.recover('server').ok); assert.equal(g.budget,budget-2);
  assert.equal(g.recover('server').ok,false); assert.equal(g.budget,budget-2);
  g.tick(2); assert.ok(g.lockedRooms.has('server'));
  assert.ok(g.cancelRecovery('server').ok); assert.equal(g.budget,budget-1);
  assert.equal(g.cancelRecovery('server').ok,false);
  assert.ok(g.recover('server').ok); g.tick(6); assert.equal(g.lockedRooms.has('server'),false);
  assert.equal(g.log.filter(e=>e.action==='recover').length,1);
  g.lockedRooms.add('server'); g.budget=1; assert.equal(g.recover('server').ok,false);
  g.budget=3; g.operations.add('HCI'); assert.ok(g.recover('server').ok); g.tick(4);
  assert.equal(g.lockedRooms.has('server'),false);
});

test('mission objectives distinguish containment, data, uptime and restoration', () => {
  const storm=game('storm'); storm.uptime=79; assert.equal(storm.objectives()[2].met,false);
  const quiet=game(); quiet.uptime=79; assert.equal(quiet.objectives()[2].met,true);
  const robber=game('robber'); robber.lockedRooms.add('server'); assert.equal(robber.objectives()[2].met,false);
  assert.equal(robber.objectives()[0].met,false); robber.intruder.contained=true;
  assert.equal(robber.objectives()[0].met,true); robber.data=10; assert.equal(robber.objectives()[1].met,false);
});

test('large simulation steps preserve causal ordering and reject nonfinite input', () => {
  const a = game('storm'), b = game('storm'); a.beginDay(); b.beginDay();
  a.tick(NaN); a.tick(Infinity); a.tick(-1); assert.equal(a.time, 0);
  a.tick(30); for (let i = 0; i < 120; i++) b.tick(.25);
  assert.equal(a.uptime, b.uptime); assert.equal(a.beatIndex, b.beatIndex); assert.equal(a.budget, b.budget);
});

// Cancellation is an operator override: the local helper must not spend the refund again.
test('cancelled helper recovery waits for a manual restart', () => {
  const g=game('robber'); g.budget=99; g.deploy('ASTOR'); g.deployOperation('AICP'); g.setHelperRule('recover');
  g.beginDay(); advanceTo(g,44); assert.ok(g.recoveryJobs.has('server'));
  g.cancelRecovery('server'); g.tick(1); assert.equal(g.recoveryJobs.size,0);
  assert.ok(g.lockedRooms.has('server')); assert.ok(g.recover('server').ok);
});

// Every assignment/difficulty must be winnable within its budget by an INFORMED player:
// deploy a plan, read visible endpoint clues, then isolate the exact foothold device
// (and mitigate scripted infrastructure events). Containing early prevents later damage.
test('every mission/difficulty has a demonstrated viable winning strategy', () => {
  const PLANS = {
    quiet: {
      guided:   { products: ['NDR', 'XDR'], edr: ['office#2', 'vault#core'] },
      standard: { products: ['NDR', 'XDR'], edr: ['office#2'] },
      expert:   { products: ['AF'], edr: ['office#2'] },
    },
    robber: {
      guided:   { products: ['XDR', 'ASTOR'], edr: ['l2-finance#1', 'server#core'] },
      standard: { products: ['XDR'], edr: ['l2-finance#1'] },
      expert:   { products: [], edr: ['l2-finance#1'] },
    },
    storm: {
      guided:   { products: ['NDR', 'XDR'], edr: ['l2-finance#1'], operations: ['ADC', 'HCI'] },
      standard: { edr: ['l2-finance#1'], operations: ['ADC', 'HCI'] },
      expert:   { edr: ['l2-finance#1'], operations: ['ADC', 'HCI'] },
    },
  };
  for (const [mission, byDiff] of Object.entries(PLANS)) {
    for (const [difficulty, plan] of Object.entries(byDiff)) {
      const g = game(mission, difficulty);
      for (const op of plan.operations || []) assert.ok(g.deployOperation(op).ok, `${mission}/${difficulty} op ${op}`);
      for (const p of plan.products || []) assert.ok(g.deploy(p).ok, `${mission}/${difficulty} ${p}`);
      for (const d of plan.edr || []) assert.ok(g.deploy('EDR', d).ok, `${mission}/${difficulty} EDR ${d}`);
      assert.ok(g.budget >= 0, `${mission}/${difficulty} overspent`);
      g.beginDay();
      let guard = 0;
      while (!g.ended && guard++ < 4000) {
        g.tick(.1);
        const a = g.intruder;
        // Act only on a visible endpoint clue at the actor's current device (no omniscience).
        if (a.desk && g.edrDesks.has(a.desk) && !a.contained && g.clues.some(c => c.desk === a.desk)) g.isolateDevice(a.desk);
      }
      assert.ok(g.ended, `${mission}/${difficulty} never ended`);
      assert.equal(g.outcome.verdict, 'win', `${mission}/${difficulty} -> ${g.outcome.verdict}/${g.outcome.kind}`);
    }
  }
});

// Infrastructure operations must only be exercised by assignments whose (player-visible)
// briefing shape includes the matching event — never by hidden attack truth.
test('infrastructure operations match the exercising events of each assignment', () => {
  const exercises = (mission, act) => missionFor(mission).beats.some(b => b.act === act);
  assert.ok(exercises('storm', 'ddos') && exercises('storm', 'failure') && exercises('storm', 'remote'));
  assert.ok(exercises('robber', 'remote'));
  assert.ok(!exercises('quiet', 'ddos') && !exercises('quiet', 'failure') && !exercises('quiet', 'remote'));
  assert.ok(!exercises('robber', 'ddos') && !exercises('robber', 'failure'));
  // HCI stays useful wherever a room can lock (ransomware downtime + faster restore).
  for (const m of ['quiet', 'robber', 'storm']) assert.ok(missionFor(m).beats.some(b => b.locks), `${m} has a lockable room`);
});
