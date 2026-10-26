// Incident Zero engine: a single rAF tick drives alert spawning, incident stage
// advancement, charge regen and loss. Rendering is delegated via onState snapshots.
// Pure rules live in model.js.

import {
  STAGES, RANSOM_STAGE, SENSORS, START_INTEGRITY, SNAP_MAX, MDR_MAX, SNAP_REGEN, MDR_REGEN,
  containFor, sensorFor, isValidCorrelation, difficultyAt, comboMult,
  confirmScore, containScore, PENALTY_FALSE_CORR, PENALTY_WRONG_TOOL, SCORE_MDR, WRONG_REASON,
} from './model.js';
import { sfx } from '../rush/audio.js';

const ASSETS = ['WS', 'DB', 'SRV', 'APP', 'FS', 'DC', 'VPN', 'MAIL'];
const ACTORS = ['SHADOW FOX', 'IRON VIPER', 'PALE WIDOW', 'NIGHT HERON', 'RUST GOLEM', 'ASH LYNX'];
const HUD_MS = 90;
const MAX_ALERTS = 30;

let _id = 0;
const uid = () => ++_id;
const hex = () => '#' + Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
const pick = a => a[(Math.random() * a.length) | 0];

export function createSocGame({ onState, onToast, onOver } = {}) {
  let integrity = 0, score = 0, best = 0, combo = 0, maxCombo = 0;
  let confirmed = 0, contained = 0, breaches = 0, missed = 0;
  let snap = 0, mdr = 0, snapT = 0, mdrT = 0;
  let incidents = [], alerts = [];
  const iocs = new Set();
  let phase = 'idle', last = 0, raf = 0, hudAcc = 0, noiseAcc = 0, incAcc = 0, elapsed = 0;

  function uniqueIoc() { let h; do { h = hex(); } while (iocs.has(h)); iocs.add(h); return h; }

  function emitAlert(inc, sensor) {
    if (alerts.length >= MAX_ALERTS) { const i = alerts.findIndex(a => a.noise); if (i >= 0) alerts.splice(i, 1); }
    const ttl = difficultyAt(elapsed).alertTtl;
    alerts.push({ id: uid(), sensor, asset: inc.asset, ioc: inc.ioc, sev: inc.sev, born: now(), ttl, noise: false });
  }
  function emitNoise() {
    if (alerts.length >= MAX_ALERTS) return;
    const ttl = difficultyAt(elapsed).alertTtl * 0.8;
    // sometimes land on a live incident's asset to force the player to check the IOC, not the host
    const decoy = incidents.length && Math.random() < 0.4 ? pick(incidents).asset : `${pick(ASSETS)}-${(Math.random() * 40 + 1) | 0}`;
    alerts.push({ id: uid(), sensor: pick(SENSORS), asset: decoy, ioc: uniqueIoc(), sev: 1 + ((Math.random() * 2) | 0), born: now(), ttl, noise: true });
  }

  function spawnIncident() {
    const d = difficultyAt(elapsed);
    if (incidents.filter(i => i.status !== 'done').length >= d.maxIncidents) return;
    const inc = {
      id: uid(), asset: `${pick(ASSETS)}-${(Math.random() * 40 + 1) | 0}`, ioc: uniqueIoc(),
      actor: pick(ACTORS), sev: 2 + ((Math.random() * 2) | 0),
      stage: 0, status: 'latent', stageTimer: d.stageAdvanceMs,
    };
    incidents.push(inc);
    emitAlert(inc, sensorFor(0));
  }

  function advanceStage(inc) {
    inc.stage++;
    if (inc.stage > RANSOM_STAGE) {               // ransom window elapsed uncontained
      if (inc.status === 'latent') missed++;      // never even detected
      breach(inc);
      return;
    }
    inc.stageTimer = difficultyAt(elapsed).stageAdvanceMs;
    if (inc.status === 'latent') emitAlert(inc, sensorFor(inc.stage));   // more corroboration, deeper in
  }

  function breach(inc) {
    inc.status = 'done'; inc._leave = 'breach';
    integrity--; combo = 0; breaches++;
    sfx.breach();
    emit('toast', 'breach', 'bad', { a: inc.asset });
    if (integrity <= 0) return gameOver();
    pushState(true);
  }

  function finishIncident(inc, kind) { inc.status = 'done'; inc._leave = kind; }

  // ---- player actions ----
  function correlate(ids) {
    if (phase !== 'play') return;
    const sel = ids.map(id => alerts.find(a => a.id === id)).filter(Boolean);
    if (!isValidCorrelation(sel)) {
      score = Math.max(0, score + PENALTY_FALSE_CORR); combo = 0;
      sfx.wrong(); emit('toast', 'falseCorr', 'bad'); pushState(true); return;
    }
    const ioc = sel[0].ioc;
    const inc = incidents.find(i => i.ioc === ioc && i.status === 'latent');
    // consume all alerts for that IOC either way (they are now understood)
    alerts = alerts.filter(a => a.ioc !== ioc);
    if (!inc) { sfx.serve(); pushState(true); return; }   // real but already confirmed
    inc.status = 'active';
    const pts = confirmScore(inc.stage, combo);
    score += pts; combo++; confirmed++; maxCombo = Math.max(maxCombo, combo);
    if (score > best) best = score;
    sfx.ability(); emit('toast', 'confirmed', 'good', { p: pts });
    pushState(true);
  }

  function contain(incidentId, tool) {
    if (phase !== 'play') return;
    const inc = incidents.find(i => i.id === incidentId && i.status === 'active');
    if (!inc) return;
    if (tool === 'MDR') {
      if (mdr <= 0) { emit('toast', 'noMdr', 'bad'); sfx.wrong(); return; }
      mdr--; success(inc, SCORE_MDR, 'mdr'); return;
    }
    const correct = containFor(inc.stage);
    if (tool !== correct) {
      score = Math.max(0, score + PENALTY_WRONG_TOOL); combo = 0;
      sfx.wrong(); emit('toast', 'wrong', 'bad', { why: WRONG_REASON[tool] }); pushState(true); return;
    }
    if (tool === 'ASTOR' && snap <= 0) { emit('toast', 'noSnap', 'bad'); sfx.wrong(); return; }
    if (tool === 'ASTOR') snap--;
    success(inc, containScore(inc.stage, combo), tool === 'ASTOR' ? 'restore' : 'contain');
  }

  function success(inc, pts, kind) {
    score += pts; combo++; contained++; maxCombo = Math.max(maxCombo, combo);
    if (score > best) best = score;
    finishIncident(inc, kind);
    sfx.hit(Math.min(24, combo * 2));
    emit('toast', kind === 'restore' ? 'restored' : kind === 'mdr' ? 'mdr' : 'contained', 'good', { p: pts, a: inc.asset });
    pushState(true);
  }

  // ---- loop ----
  function now() { return performance.now(); }

  function tick(ts) {
    if (phase !== 'play') return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(80, ts - last); last = ts; elapsed += dt / 1000;
    const d = difficultyAt(elapsed);

    for (const inc of incidents) {
      if (inc.status === 'latent' || inc.status === 'active') {
        inc.stageTimer -= dt;
        if (inc.stageTimer <= 0) advanceStage(inc);
      }
    }
    // expire alerts
    const tnow = now();
    alerts = alerts.filter(a => tnow - a.born < a.ttl);
    // keep a finished incident on the board for a short exit beat, then drop it
    for (const i of incidents) { if (i.status === 'done' && !i._leaveAt) i._leaveAt = tnow; }
    incidents = incidents.filter(i => i.status !== 'done' || tnow - i._leaveAt < 240);

    // charge regen
    if (snap < SNAP_MAX) { snapT += dt; if (snapT >= SNAP_REGEN * 1000) { snap++; snapT = 0; } }
    if (mdr < MDR_MAX) { mdrT += dt; if (mdrT >= MDR_REGEN * 1000) { mdr++; mdrT = 0; } }

    // spawns
    noiseAcc += dt; if (noiseAcc >= d.noiseInterval) { noiseAcc = 0; emitNoise(); }
    incAcc += dt; if (incAcc >= d.incidentInterval) { incAcc = 0; spawnIncident(); }

    hudAcc += dt; if (hudAcc >= HUD_MS) { hudAcc = 0; pushState(false); }
  }

  function dto() {
    const tnow = now();
    return {
      alerts: alerts.map(a => ({
        id: a.id, sensor: a.sensor, asset: a.asset, ioc: a.ioc, sev: a.sev,
        remaining: Math.max(0, a.ttl - (tnow - a.born)), ttl: a.ttl, noise: a.noise,
      })),
      incidents: incidents.map(i => ({
        id: i.id, asset: i.asset, ioc: i.ioc, actor: i.actor, sev: i.sev,
        stage: i.stage, stageId: STAGES[Math.min(i.stage, RANSOM_STAGE)].id, status: i.status,
        remaining: Math.max(0, i.stageTimer), ttl: difficultyAt(elapsed).stageAdvanceMs,
        atRansom: i.stage >= RANSOM_STAGE, leave: i._leave,
      })),
      hud: {
        integrity, score, best, combo, mult: comboMult(combo),
        snap, snapMax: SNAP_MAX, mdr, mdrMax: MDR_MAX,
        snapProg: snap < SNAP_MAX ? snapT / (SNAP_REGEN * 1000) : 1,
        mdrProg: mdr < MDR_MAX ? mdrT / (MDR_REGEN * 1000) : 1,
        elapsed: Math.floor(elapsed), confirmed, contained, breaches,
      },
    };
  }
  function pushState() { onState && onState(dto()); }
  function emit(_t, key, kind, vars) { onToast && onToast(key, kind, vars); }

  function gameOver() {
    phase = 'over'; cancelAnimationFrame(raf);
    sfx.over();
    onOver && onOver({ score, best, confirmed, contained, breaches, missed, maxCombo, elapsed: Math.floor(elapsed) });
  }

  return {
    start() {
      integrity = START_INTEGRITY; score = 0; combo = 0; maxCombo = 0;
      confirmed = 0; contained = 0; breaches = 0; missed = 0;
      snap = SNAP_MAX; mdr = MDR_MAX; snapT = 0; mdrT = 0;
      incidents = []; alerts = []; iocs.clear();
      elapsed = 0; hudAcc = 0; noiseAcc = 0; incAcc = 0;
      phase = 'play'; last = now(); sfx.start();
      spawnIncident();                                  // seed the first incident right away
      pushState(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    },
    correlate, contain,
    pause() { if (phase === 'play') { phase = 'paused'; cancelAnimationFrame(raf); } },
    resume() { if (phase === 'paused') { phase = 'play'; last = now(); raf = requestAnimationFrame(tick); } },
    stop() { phase = 'idle'; cancelAnimationFrame(raf); },
    setBest(b) { best = b || 0; },
    get phase() { return phase; },
    get state() { return { phase, integrity, score, best, confirmed, contained, breaches, incidents, alerts }; },
  };
}
