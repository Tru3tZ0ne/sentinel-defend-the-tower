// Last Stand 3D: Citadel - the pure simulation.
// The same two-minute enterprise campaign as Last Stand (rules and numbers come
// from ../stand/model.js), replayed on a 360-degree arena: threats pour out of
// perimeter gates and converge on the central Data Core while the Sentinel mech
// roams the deck. No DOM, no THREE, no global randomness: a browser view renders
// it and a Node bot can play it for balance checks.
//
// Units are "sim units" (the lane game's pixels). The view maps 1 su = 0.055 world.

import {
  START_BASE, MAX_ACTIVE_THREATS, OPERATOR, TURRET, ALLY, WEAPONS, WEAPON_ORDER, deriveSquad,
  xpToLevel, upgradeChoices, ENEMIES, threatPool, difficultyAt, comboMult, killScore,
  ABILITIES, ABILITY_ORDER, bossFor, bossHpScale, MISSION_SECONDS, BOSS_TIMES, UPGRADE_SECONDS,
  STARTER_LEVELS, openingChoices, integrityScore, recommendedUpgrade, cloudRates, campaignScores,
  workflowSpec, WORKFLOW_STEPS,
} from '../stand/model.js?campaign=agent-workflow-v1';
import { createCollisionIndex, compactLive } from '../stand/combat-runtime.js?perf=active-v1';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const wrap = a => { a %= TAU; return a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a; };

export const ACCENT = {
  EDR: '#ff8a5a', MDR: '#16ca78', AF: '#2ee6a0', NDR: '#58c8ff',
  IAG: '#ffd166', HCI: '#39c0ff', XDR: '#9be85a', ASTOR: '#a98bff', AI: '#c09aff', AGENT: '#6ce5d7',
};

// Arena geometry (sim units, Data Core at the origin).
export const ARENA = {
  R: 780,            // deck radius
  spawnR: 720,       // gates sit here
  coreR: 54,         // reaching this hurts the core
  opMin: 130, opMax: 440, opStart: 250,
  bossHold: 450,     // bosses park here, orbit and bombard
  afR: 172, afArcK: 2.2,   // NGAF firewall arc: ring radius, px half-width -> arc length factor
  iagR: 330, iagHalf: 30,  // IAG checkpoint ring
  gates: 6, gateSpread: .2, gateEvery: 15,
  shotLife: .86, sight: 820,
};
export const gateAngle = i => i * TAU / ARENA.gates;

// Arena-only pressure knobs (model.js stays untouched). Tuned with tools/stand3d-balance.mjs.
export const TUNE = { hpRamp: .45, hp: 1, bossHp: .7, speed: 1, baseDmg: .9, strikeR: 62, strikeMegaR: 82, dashCd: 2.2, dashT: .2, moveSpeed: 380 };

const TEAM = {
  rt: { hex: '#ff5a6a', dmg: 20, rate: 3.0, speed: 960, pierce: 1 },
  pt: { hex: '#ffd166', dmg: 34, rate: 2.7, speed: 980, pierce: 2 },
};

export function createSim(opts = {}) {
  const rng = opts.rng || Math.random;
  const onToast = opts.onToast || (() => {}), onLevelUp = opts.onLevelUp || (() => {});
  const onOver = opts.onOver || (() => {}), onHud = opts.onHud || (() => {}), onSfx = opts.onSfx || (() => {});
  const rand = (a, b) => a + rng() * (b - a);
  let S = null, nextId = 1;

  // Visual events, drained by the view every frame (ignored by headless bots).
  const fxq = [];
  const fx = (t, o) => { if (fxq.length < 900) { o.t = t; fxq.push(o); } };
  const burst = (x, y, color, n = 12, spread = 180) => fx('burst', { x, y, color, n, spread });
  const ring = (x, y, color, max, w = 3) => fx('ring', { x, y, color, max, w });
  const zap = (x1, y1, x2, y2, color) => fx('zap', { x1, y1, x2, y2, color });
  const dmgText = (x, y, n, color, big) => fx('text', { x, y, n, color, big: !!big });
  const flash = (a, col) => fx('flash', { a, col });
  const shake = a => fx('shake', { a });

  function fresh() {
    return {
      phase: 'idle', base: START_BASE, baseMax: START_BASE, score: 0, best: 0,
      combo: 0, maxCombo: 0, elapsed: 0, kills: 0, level: 1, xp: 0, xpNeed: xpToLevel(1),
      levels: { ...STARTER_LEVELS }, squad: deriveSquad(STARTER_LEVELS), shooters: [], shield: 0, pendingLevels: 1, opening: true,
      afHp: 0, afMax: 0, afDown: false, afDownT: 0, afAng: 0,
      op: { x: ARENA.opStart, y: 0, aim: 0, muzzle: 0, vx: 0, vy: 0, dashT: 0, dashCd: 0, dashX: 1, dashY: 0, speed: 0 },
      enemies: [], shots: [], temps: [], arc: null, link: null, strikes: [],
      pools: { shots: [] }, collision: createCollisionIndex(), targets: new Map(),
      gates: { active: [0], nextAt: ARENA.gateEvery, pulse: 0 },
      spawnAcc: 0, xdrAcc: 0, shieldAcc: 0, bossCount: 0, bossesKilled: 0, autoId: 0, autoAcc: 0, dashHeld: false,
      choices: [], offerLeft: 0, businessWork: 0, aiWork: 0, agentWork: 0, availability: 100, xpAcc: 0, dodged: 0, defeatReason: null,
      hudAcc: 0, cd: { ir: 0, pt: 0, rt: 0, wf: 0 }, ptT: 0, rtT: 0,
      workflow: null, workflows: 0, wfCdMax: ABILITIES.wf.cd, corrAnnounced: false, dashes: 0,
    };
  }

  function recompute() {
    S.squad = deriveSquad(S.levels);
    const sq = S.squad;
    const list = [{ kind: 'op', off: 0, dmg: OPERATOR.dmg, rate: OPERATOR.rate, speed: OPERATOR.bulletSpeed, pierce: OPERATOR.pierce, acc: 0 }];
    const n = sq.edrTurrets;
    for (let i = 0; i < n; i++) list.push({ kind: 'edr', off: (i - (n - 1) / 2) * 18, dmg: sq.edrDmg, rate: TURRET.rate, speed: TURRET.bulletSpeed, pierce: TURRET.pierce, acc: 0 });
    if (sq.mdrAllies > 0) list.push({ kind: 'mdr', off: 30, dmg: sq.mdrDmg, rate: sq.mdrRate, speed: ALLY.bulletSpeed, pierce: ALLY.pierce, acc: 0 });
    if (S.shooters) list.forEach((s, i) => { if (S.shooters[i]) s.acc = S.shooters[i].acc; });
    S.shooters = list;
    if (sq.afTier > 0) { const grew = sq.afHp - S.afMax; S.afMax = sq.afHp; if (grew > 0) S.afHp = Math.min(sq.afHp, S.afHp + grew); if (S.afHp <= 0 && !S.afDown) S.afHp = sq.afHp; }
    else { S.afMax = 0; S.afHp = 0; S.afDown = false; }
    if (correlationLinks() > 0 && !S.corrAnnounced) { S.corrAnnounced = true; onToast('corrOn', 'good'); }
  }
  const afHalfAngle = () => Math.min(Math.PI, S.squad.afHalfWidth * ARENA.afArcK / ARENA.afR);

  // ---- enemies ----
  function makeEnemy(type, x, y, hp) {
    const spec = ENEMIES[type];
    return { id: nextId++, type, spec, x, y, r: spec.r, hp, maxhp: hp, slow: 0, hit: 0, wob: rng() * TAU, heading: Math.atan2(-y, -x),
      marked: false, afWeakened: false, spawnAcc: 0, attackAcc: 0, bornAt: S.elapsed, orbit: rng() < .5 ? -1 : 1, held: false };
  }
  function spawnEnemy(type, gate) {
    const d = difficultyAt(S.elapsed), spec = ENEMIES[type];
    if (!spec || S.enemies.length >= MAX_ACTIVE_THREATS - (spec.boss ? 0 : 3)) return false;
    const hp = Math.round(spec.hp * (spec.boss ? bossHpScale(S.elapsed, spec.mega) * TUNE.bossHp : (1 + (d.hpMul - 1) * TUNE.hpRamp) * TUNE.hp));
    const a = gateAngle(gate) + (spec.boss ? 0 : rand(-ARENA.gateSpread, ARENA.gateSpread));
    const r = ARENA.spawnR + (spec.boss ? 0 : rand(0, 46));
    S.enemies.push(makeEnemy(type, Math.cos(a) * r, Math.sin(a) * r, hp));
    return true;
  }
  const pickGate = () => S.gates.active[Math.floor(rng() * S.gates.active.length)];
  function rollGates() {
    const n = Math.min(3, 1 + Math.floor(S.elapsed / 38));
    // The attack front is a run of neighbouring gates that swings around the citadel.
    const G = ARENA.gates, first = (S.gates.active[0] + (rng() < .5 ? -1 : 1) * (1 + Math.floor(rng() * 2)) + G) % G, set = [];
    for (let i = 0; i < n; i++) set.push((first + i) % G);
    S.gates.active = set; S.gates.nextAt = S.elapsed + ARENA.gateEvery; S.gates.pulse = 1;
    onToast('vector', 'bad'); onSfx('serve');
  }
  function spawnBoss() {
    const type = bossFor(S.bossCount); if (!type) return false;
    const mega = !!ENEMIES[type].mega, gate = pickGate();
    if (!spawnEnemy(type, gate)) return false;
    S.bossCount++;
    onToast('boss_' + type, 'bad');
    flash(mega ? .9 : .6, ENEMIES[type].color); shake(mega ? 1 : .7); fx('bossIn', { gate, type });
    onSfx('boss');
    return true;
  }
  function creditKill(e) {
    e.dead = true;
    if (e.spec.boss) S.bossesKilled++;
    S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
    S.score += killScore(e.type, comboMult(S.combo)); S.kills++;
    fx('death', { x: e.x, y: e.y, r: e.r, color: e.spec.color, boss: !!e.spec.boss, mega: !!e.spec.mega, heading: e.heading });
    gainXp(e.spec.xp);
  }
  function killEnemy(e, viaAbility, suppressCorrelation = false) {
    if (e.dead) return;
    creditKill(e);
    if (e.spec.boss) { shake(1); flash(e.spec.mega ? 1 : .85, e.spec.color); onSfx('boss'); }
    else if (!viaAbility) onSfx('hit', S.combo);
    if (e.spec.splits) for (let i = 0; i < e.spec.splits && S.enemies.length < MAX_ACTIVE_THREATS - 3; i++) {
      const child = makeEnemy('recon', e.x + rand(-14, 14), e.y + rand(-14, 14), ENEMIES.recon.hp); child.spawnAcc = undefined; S.enemies.push(child);
    }
    const links = correlationLinks();
    if (links > 0 && !suppressCorrelation) fireCorrelation(e.x, e.y, links, 0);
  }
  // XDR needs two or more sensor units before kills correlate (its real rule).
  const correlationLinks = () => (S.squad.xdrOn && S.squad.sensors >= 2 ? Math.min(2, S.squad.sensors - 1) : 0);
  function fireCorrelation(x, y, links, depth) {
    if (links <= 0 || depth > 3) return;
    const R2 = (150 + S.squad.sensors * 12) ** 2;
    const near = S.enemies.filter(t => !t.dead && (t.x !== x || t.y !== y) && dist2(x, y, t.x, t.y) <= R2)
      .sort((a, b) => dist2(x, y, a.x, a.y) - dist2(x, y, b.x, b.y)).slice(0, links);
    if (!near.length) return;
    const dmg = 18 + S.squad.sensors * 7;
    shake(.12);
    for (const t of near) {
      zap(x, y, t.x, t.y, '#7dffd0'); ring(t.x, t.y, '#7dffd0', t.r * 2.6, 3);
      const dealt = dealDamage(t, dmg);
      dmgText(t.x, t.y, dealt, '#7dffd0', false); burst(t.x, t.y, '#7dffd0', 5, 100);
      if (t.hp <= 0 && !t.dead) { creditKill(t); fireCorrelation(t.x, t.y, links - 1, depth + 1); }
    }
    if (depth === 0) onSfx('ability');
  }
  const revealed = () => S.squad.ndrReveal;
  function dealDamage(e, raw) {
    const mark = e.spec.cloak && !revealed() ? .5 : 1;
    const bonus = S.squad.ndrMark ? 1 + S.squad.ndrMark : 1;
    const dealt = raw * mark * bonus;
    e.hp -= dealt; e.hit = 1;
    return dealt;
  }

  // ---- targeting and fire ----
  // guided: Cyber Command guidance, limited to a forward cone of the given heading.
  function chooseTarget(x, y, excluded, guided, hx, hy) {
    let target = null, best = Infinity;
    for (const e of S.enemies) {
      if (e.dead || excluded?.has(e.id)) continue;
      const dx = e.x - x, dy = e.y - y, raw = dx * dx + dy * dy;
      if (raw > (guided ? 700 : 760) ** 2) continue;
      if (guided) { const len = Math.sqrt(raw) || 1; if ((dx * hx + dy * hy) / len < .84 && len > 35) continue; }
      const distance = raw * (e.spec.boss ? .7 : 1);
      if (distance < best) { best = distance; target = e; }
    }
    return target;
  }
  function fire(x, y, hx, hy, dmg, speed, pierce, color, owner) {
    const homing = owner === 'mdr' || S.squad.tracking;
    const target = homing ? chooseTarget(x, y, null, owner !== 'mdr', hx, hy) : null;
    const p = S.pools.shots.pop() || { hit: new Set() };
    p.hit.clear(); p.dead = false; p.x = x; p.y = y; p.vx = hx * speed; p.vy = hy * speed; p.speed = speed;
    p.owner = owner; p.homing = homing; p.targetId = target?.id; p.life = ARENA.shotLife; p.dmg = dmg;
    p.pierce = pierce; p.r = 4.5; p.color = color; p.height = owner === 'edr' ? 2.65 : owner === 'mdr' ? 1.55 : 1.3;
    S.shots.push(p);
  }
  function dominant() { let b = null, bl = 0; for (const id of WEAPON_ORDER) { const l = S.levels[id] || 0; if (l > bl) { bl = l; b = id; } } return b; }
  const dominantColor = () => ACCENT[dominant()] || '#9be85a';

  function beginCorrelation() {
    S.link = { age: 0, charge: .65, duration: 1.1, fired: false };
    onToast('xdrLink', 'good');
  }
  function fireXdrChain() {
    const sq = S.squad, op = S.op; if (!sq.xdrOn) return;
    const ax = Math.cos(op.aim), ay = Math.sin(op.aim);
    let target = chooseTarget(op.x, op.y, null, true, ax, ay) || chooseTarget(op.x, op.y, null, false);
    if (!target) return;
    const nodes = [], selected = new Set();
    while (target && nodes.length < sq.xdrTargets) {
      selected.add(target.id);
      nodes.push({ id: target.id, x: target.x, y: target.y, r: target.r, hit: false, skipped: false });
      let next = null, nearest = sq.xdrJumpRange ** 2;
      for (const e of S.enemies) if (!e.dead && !selected.has(e.id)) {
        const d = dist2(target.x, target.y, e.x, e.y); if (d < nearest) { nearest = d; next = e; }
      }
      target = next;
    }
    S.arc = { x: op.x, y: op.y, age: 0, life: .62, dmg: sq.xdrDmg * .62, nodes };
    flash(.2, '#b9ffd2'); shake(.12); ring(op.x, op.y, ACCENT.XDR, 55, 2); burst(op.x, op.y, '#c8ffe3', 8, 100);
    onSfx('ability');
    if (sq.xdrIdle) onToast('xdrIdle', 'bad');
  }

  // ---- xp / level ----
  function gainXp(n) {
    S.xp += n;
    while (S.xp >= S.xpNeed) { S.xp -= S.xpNeed; S.level++; S.xpNeed = xpToLevel(S.level); S.pendingLevels++; }
    if (S.pendingLevels > 0 && !S.choices.length && S.phase === 'play') openLevelUp();
  }
  function openLevelUp() {
    const choices = S.opening ? openingChoices() : upgradeChoices(S.levels, rng);
    S.opening = false;
    if (!choices.length) { S.pendingLevels = 0; return; }
    S.choices = choices; S.offerLeft = UPGRADE_SECONDS; onLevelUp(choices, S.level); onSfx('start');
  }
  function applyUpgrade(id) {
    if (!S || !['play', 'paused'].includes(S.phase) || !WEAPON_ORDER.includes(id) || (S.levels[id] || 0) >= WEAPONS[id].max) return false;
    S.levels[id] = Math.min((S.levels[id] || 0) + 1, WEAPONS[id].max);
    recompute();
    fx('upgrade', { id, x: S.op.x, y: S.op.y, color: ACCENT[id] || '#72bb38' });
    S.choices = []; S.offerLeft = 0; S.pendingLevels = Math.max(0, S.pendingLevels - 1);
    onLevelUp([], S.level);
    if (S.pendingLevels > 0 && S.phase === 'play') openLevelUp();
    return true;
  }
  const chooseUpgrade = id => (S && S.phase === 'play' && S.choices.some(c => c.id === id) ? applyUpgrade(id) : false);

  // ---- active services ----
  function useAbility(id) {
    if (!S || S.phase !== 'play') return false;
    const spec = ABILITIES[id]; if (!spec || S.cd[id] > 0) return false;
    if (id === 'wf') return beginWorkflow();
    S.cd[id] = spec.cd;
    if (id === 'ir') abilityIR();
    else if (id === 'pt') { S.ptT = spec.dur; summonTeam('pt', spec); onToast('ptOn', 'good'); }
    else if (id === 'rt') { S.rtT = spec.dur; summonTeam('rt', spec); onToast('rtOn', 'good'); flash(.4, '#ff5a6a'); }
    pushHud();
    return true;
  }
  function beginWorkflow() {
    if (S.workflow) return false;
    const plan = workflowSpec(S.levels);
    const targets = S.enemies.filter(e => !e.dead && Math.hypot(e.x, e.y) < ARENA.spawnR)
      .sort((a, b) => (a.x * a.x + a.y * a.y) - (b.x * b.x + b.y * b.y)).slice(0, plan.targets);
    if (!targets.length) { onToast('wfEmpty', 'bad'); return false; }
    S.cd.wf = plan.cd; S.wfCdMax = plan.cd;
    S.workflow = { age: 0, stage: 0, ids: targets.map(e => e.id), plan };
    for (const e of targets) { e.marked = true; ring(e.x, e.y, ACCENT.AGENT, e.r * 1.8, 2); }
    ring(S.op.x, S.op.y, ACCENT.AGENT, 65, 2); onSfx('ability'); pushHud();
    return true;
  }
  function updateWorkflow(dt) {
    const wf = S.workflow; if (!wf) return;
    wf.age += dt;
    while (wf.stage < WORKFLOW_STEPS.length - 1 && wf.age >= (wf.stage + 1) * 1.1) {
      wf.stage++;
      if (wf.stage === 3) {
        const delivery = cloudRates(S.levels, S.elapsed, S.availability, true);
        S.agentWork += wf.plan.work * delivery.served * Math.max(0, S.availability) / 100;
        S.businessWork += delivery.business * 2;
        S.base = Math.min(S.baseMax, S.base + wf.plan.repair);
        S.availability = Math.min(100, S.availability + 2);
        S.workflows++; ring(S.op.x, S.op.y, ACCENT.AGENT, 90, 3); fx('heal', {});
        onToast('wfDone', 'good');
      } else for (const id of wf.ids) {
        const e = S.enemies.find(e => e.id === id && !e.dead); if (!e) continue;
        if (wf.stage === 1) { e.slow = Math.max(e.slow || 0, 2500); zap(S.op.x, S.op.y, e.x, e.y, ACCENT.AGENT); }
        else {
          const dealt = dealDamage(e, wf.plan.damage);
          dmgText(e.x, e.y, dealt, ACCENT.AGENT, false); burst(e.x, e.y, ACCENT.AGENT, 6, 80);
          if (e.hp <= 0) killEnemy(e, true, true);
        }
      }
    }
    if (wf.age >= ABILITIES.wf.dur) S.workflow = null;
  }
  // Temporary service teams hold the ground where they were called in: a firing
  // line across the mech's facing, so a team can be left to cover one gate.
  function summonTeam(id, spec) {
    const cfg = TEAM[id], n = spec.team, op = S.op; if (!cfg || n <= 0) return;
    const ax = Math.cos(op.aim), ay = Math.sin(op.aim), rx = -ay, ry = ax;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 56, fwd = 30 + (i % 2) * 34;
      let x = op.x + rx * off + ax * fwd, y = op.y + ry * off + ay * fwd;
      const d = Math.hypot(x, y) || 1, k = clamp(d, ARENA.opMin - 10, ARENA.opMax + 60) / d; x *= k; y *= k;
      S.temps.push({ id: nextId++, team: id, fx: x, fy: y, aim: op.aim, dmg: cfg.dmg, rate: cfg.rate, speed: cfg.speed, pierce: cfg.pierce, color: cfg.hex, acc: 0, muzzle: 0, life: spec.dur, dur: spec.dur, born: .35, targetId: 0, seek: 0 });
      burst(x, y, cfg.hex, 10, 150); ring(x, y, cfg.hex, 70, 4);
    }
    ring(op.x, op.y, cfg.hex, 170, 6); onSfx('ability');
  }
  function abilityIR() {
    flash(.95, '#58c8ff'); shake(1);
    fx('nova', { x: 0, y: 0, color: '#9fe8ff', max: ARENA.R });
    for (const e of [...S.enemies]) {
      if (e.dead) continue;
      const dmg = Math.max(e.maxhp * (e.spec.boss ? .2 : .6), 150);
      e.hp -= dmg; e.hit = 1; dmgText(e.x, e.y, dmg, '#9fe8ff', true);
      burst(e.x, e.y, '#58c8ff', 9, 170);
      if (e.hp <= 0) killEnemy(e, true);
    }
    S.base = Math.min(S.baseMax, S.base + 160);
    S.shield = Math.min((S.squad.shieldMax || 0) + 1, S.shield + 1);
    fx('heal', {}); onToast('irOn', 'good'); onSfx('ability');
  }

  // ---- core damage ----
  function hitBase(amount, color, boss = false) {
    amount *= (boss ? 3 : 5) * TUNE.baseDmg;
    if (S.shield > 0) { S.shield--; flash(.6, '#a98bff'); fx('absorb', {}); onToast('absorb', 'good'); onSfx('ability'); return; }
    S.base = Math.max(0, S.base - amount);
    S.availability = Math.max(0, S.availability - amount / 180);
    if (S.base <= 0) S.defeatReason = 'integrity';
    S.combo = 0; shake(Math.min(1, .5 + amount / 350)); flash(.7, color || '#ff5a6a'); fx('coreHit', { boss }); onSfx('breach');
  }

  // ---- the step ----
  function update(dt, input) {
    dt = Math.min(dt, Math.max(0, MISSION_SECONDS - S.elapsed));
    S.elapsed = Math.min(MISSION_SECONDS, S.elapsed + dt);
    const d = difficultyAt(S.elapsed), sq = S.squad, op = S.op;
    const cloud = cloudRates(S.levels, S.elapsed, S.availability, !!S.workflow);
    S.businessWork += cloud.business * dt; S.aiWork += cloud.ai * dt;
    S.availability = clamp(S.availability + (cloud.capacity >= cloud.demand ? 1.2 : -(1 - cloud.served) * 3.5) * dt, 0, 100);
    if (S.availability <= 0) { S.defeatReason = 'service'; gameOver(); return; }
    S.xpAcc += dt; if (S.xpAcc >= 2) { S.xpAcc -= 2; gainXp(1); }
    if (S.choices.length) {
      S.offerLeft -= dt;
      if (S.offerLeft <= 0) chooseUpgrade(recommendedUpgrade(S.choices, S.levels));
    }

    // -- mech movement, dash, aim --
    let mx = input?.mx || 0, my = input?.my || 0; const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    op.dashCd = Math.max(0, op.dashCd - dt);
    const wantDash = !!input?.dash;
    if (wantDash && !S.dashHeld && op.dashCd <= 0 && op.dashT <= 0) {
      op.dashT = TUNE.dashT; op.dashCd = TUNE.dashCd; S.dashes++;
      if (ml > .1) { op.dashX = mx / ml; op.dashY = my / ml; }
      else { op.dashX = Math.cos(op.aim); op.dashY = Math.sin(op.aim); }
      fx('dash', { x: op.x, y: op.y }); onSfx('serve');
    }
    S.dashHeld = wantDash;
    if (op.dashT > 0) { op.dashT -= dt; op.vx = op.dashX * TUNE.moveSpeed * 3.4; op.vy = op.dashY * TUNE.moveSpeed * 3.4; }
    else { const k = Math.min(1, dt * 14); op.vx += (mx * TUNE.moveSpeed - op.vx) * k; op.vy += (my * TUNE.moveSpeed - op.vy) * k; }
    op.x += op.vx * dt; op.y += op.vy * dt;
    { const r = Math.hypot(op.x, op.y) || 1, k = clamp(r, ARENA.opMin, ARENA.opMax) / r; op.x *= k; op.y *= k; }
    op.speed = Math.hypot(op.vx, op.vy);
    op.muzzle = Math.max(0, op.muzzle - dt * 6);

    let wantAim = op.aim, turn = 9;
    if (input && input.aimX != null) { wantAim = Math.atan2(input.aimY - op.y, input.aimX - op.x); turn = 18; }
    else {
      S.autoAcc -= dt;
      let t = S.targets.get(S.autoId); if (t && (t.dead || dist2(op.x, op.y, t.x, t.y) > ARENA.sight ** 2)) t = null;
      if (!t || S.autoAcc <= 0) {
        S.autoAcc = .25; let best = null, bs = Infinity;
        for (const e of S.enemies) {
          if (e.dead) continue; const dOp = Math.sqrt(dist2(op.x, op.y, e.x, e.y)); if (dOp > ARENA.sight) continue;
          const score = (dOp + Math.hypot(e.x, e.y) * .8) * (e.spec.boss ? .6 : 1) * (e.id === S.autoId ? .75 : 1);
          if (score < bs) { bs = score; best = e; }
        }
        t = best; S.autoId = t ? t.id : 0;
      }
      wantAim = t ? Math.atan2(t.y - op.y, t.x - op.x) : Math.atan2(op.y, op.x);
    }
    op.aim = wrap(op.aim + clamp(wrap(wantAim - op.aim), -turn * dt, turn * dt));
    const ax = Math.cos(op.aim), ay = Math.sin(op.aim), rx = -ay, ry = ax;
    S.afAng = Math.atan2(op.y, op.x);

    for (const k in S.cd) if (S.cd[k] > 0) S.cd[k] = Math.max(0, S.cd[k] - dt * cloud.cooldown);
    if (S.ptT > 0) S.ptT = Math.max(0, S.ptT - dt);
    if (S.rtT > 0) S.rtT = Math.max(0, S.rtT - dt);
    updateWorkflow(dt);

    // -- attack vectors (gates), bosses and waves --
    S.gates.pulse = Math.max(0, S.gates.pulse - dt);
    if (S.elapsed >= S.gates.nextAt && S.elapsed < 112) rollGates();
    if (S.bossCount < BOSS_TIMES.length && S.elapsed >= BOSS_TIMES[S.bossCount]) spawnBoss();
    S.spawnAcc += dt * 1000;
    if (S.elapsed < 114 && S.spawnAcc >= d.spawnGap) { S.spawnAcc = 0; const pool = threatPool(S.elapsed), gate = pickGate(); for (let i = 0; i < d.batch; i++) spawnEnemy(pool[Math.floor(rng() * pool.length)], i ? pickGate() : gate); }

    // -- mech weapons --
    for (const sh of S.shooters) {
      sh.acc += dt * 1000; const interval = 1000 / (sh.rate * sq.fireRateMul);
      while (sh.acc >= interval) {
        sh.acc -= interval;
        fire(op.x + ax * 22 + rx * sh.off, op.y + ay * 22 + ry * sh.off, ax, ay, sh.dmg, sh.speed, sh.pierce, sh.kind === 'op' ? dominantColor() : ACCENT[sh.kind === 'edr' ? 'EDR' : 'MDR'], sh.kind);
        if (sh.kind === 'op') op.muzzle = 1; sh.muzzle = 1;
      }
      if (sh.muzzle) sh.muzzle = Math.max(0, sh.muzzle - dt * 6);
    }
    for (const u of S.temps) {
      if (u.born > 0) u.born = Math.max(0, u.born - dt);
      u.life -= dt; if (u.life <= 0) { u.dead = true; continue; }
      u.seek -= dt;
      let t = S.targets.get(u.targetId); if (t && t.dead) t = null;
      if (!t || u.seek <= 0) { u.seek = .3; t = chooseTarget(u.fx, u.fy, null, false); u.targetId = t ? t.id : 0; }
      if (t) u.aim = wrap(u.aim + clamp(wrap(Math.atan2(t.y - u.fy, t.x - u.fx) - u.aim), -10 * dt, 10 * dt));
      u.acc += dt * 1000; const interval = 1000 / (u.rate * sq.fireRateMul);
      while (u.acc >= interval) { u.acc -= interval; if (!t) { u.acc = 0; break; } const hx = Math.cos(u.aim), hy = Math.sin(u.aim); fire(u.fx + hx * 16, u.fy + hy * 16, hx, hy, u.dmg, u.speed, u.pierce, u.color, 'service'); u.muzzle = 1; }
      if (u.muzzle) u.muzzle = Math.max(0, u.muzzle - dt * 6);
    }
    if (sq.xdrOn) { S.xdrAcc += dt * 1000; if (!S.link && S.xdrAcc >= sq.xdrEvery) { S.xdrAcc = 0; beginCorrelation(); } }
    if (S.link) {
      S.link.age += dt;
      if (!S.link.fired && S.link.age >= S.link.charge) { S.link.fired = true; fireXdrChain(); }
      if (S.link.age >= S.link.duration) S.link = null;
    }
    if (sq.shieldEvery) { S.shieldAcc += dt * 1000; if (S.shieldAcc >= sq.shieldEvery) { S.shieldAcc = 0; S.shield = Math.min(sq.shieldMax, S.shield + 1); } }
    if (sq.regen) S.base = Math.min(S.baseMax, S.base + sq.regen * dt);

    // -- NGAF firewall arc (tracks the mech's bearing around the core) --
    if (sq.afTier > 0) { if (S.afDown) { S.afDownT -= dt; if (S.afDownT <= 0) { S.afDown = false; S.afHp = S.afMax * .5; } } else S.afHp = Math.min(S.afMax, S.afHp + S.afMax * .08 * dt); }
    const barActive = sq.afTier > 0 && !S.afDown, afChip = 9 + sq.afTier * 5, afHalf = sq.afTier > 0 ? afHalfAngle() : 0;

    for (const e of S.enemies) {
      if (e.dead) continue;
      if (sq.ndrReveal) e.marked = true;
      const dist = Math.hypot(e.x, e.y) || 1, ux = -e.x / dist, uy = -e.y / dist, tx = -uy, ty = ux;
      if (e.spec.spawn && dist < ARENA.spawnR - 30) {
        e.spawnAcc += dt;
        if (e.spawnAcc >= e.spec.spawnEvery) {
          e.spawnAcc = 0;
          for (let k = 0; k < (e.spec.spawnCount || 1) && S.enemies.length < MAX_ACTIVE_THREATS - 3; k++) {
            const m = makeEnemy(e.spec.spawn, e.x + ux * e.r * .6 + rand(-30, 30), e.y + uy * e.r * .6 + rand(-30, 30), ENEMIES[e.spec.spawn].hp); S.enemies.push(m);
          }
          ring(e.x, e.y, e.spec.color, e.r * 1.5, 4); burst(e.x, e.y, e.spec.color, 8, 130);
        }
      }
      let slowK = e.slow > 0 ? .5 : 1; if (e.slow > 0) e.slow -= dt * 1000;
      if (sq.iagBand && Math.abs(dist - ARENA.iagR) < ARENA.iagHalf) slowK *= sq.iagSlowMul;
      e.wob += dt * 3; e.hit = Math.max(0, e.hit - dt * 4);
      const sp = e.spec.speed * d.speedMul * slowK * TUNE.speed;

      if (e.spec.boss) {
        // Bosses park on a far ring, circle the citadel and bombard the mech.
        if (dist > ARENA.bossHold) { const step = Math.min(sp * dt, dist - ARENA.bossHold); e.x += ux * step; e.y += uy * step; e.heading = Math.atan2(uy, ux); }
        else { const w = sp * .4 / dist * e.orbit * dt, c = Math.cos(w), s = Math.sin(w), x = e.x; e.x = x * c - e.y * s; e.y = x * s + e.y * c; e.heading = Math.atan2(op.y - e.y, op.x - e.x); }
        e.attackAcc += dt;
        if (!e.attack && e.attackAcc >= 4 && dist < ARENA.spawnR - 60) {
          e.attackAcc = 0; const total = .95 + (S.levels.AI || 0) * .06;
          e.attack = { x: op.x + op.vx * .25, y: op.y + op.vy * .25, r: e.spec.mega ? TUNE.strikeMegaR : TUNE.strikeR, left: total, total };
          onToast('bossAim', 'bad');
        }
        if (e.attack) {
          e.attack.left -= dt;
          if (e.attack.left <= 0) {
            const a = e.attack, hit = dist2(op.x, op.y, a.x, a.y) < a.r * a.r && op.dashT <= 0;
            fx('strike', { x: a.x, y: a.y, r: a.r, color: e.spec.color, fromX: e.x, fromY: e.y, hit });
            if (hit) hitBase(e.spec.dmg, '#ff5a6a', true); else S.dodged++;
            e.attack = null;
            if (S.defeatReason || S.availability <= 0) { S.defeatReason ||= 'service'; gameOver(); return; }
          }
        }
        continue;
      }

      const juke = e.spec.juke || 1, lat = Math.cos(e.wob) * 6 * juke * dt;
      const next = dist - sp * dt;
      if (sq.afTier > 0 && Math.abs(wrap(Math.atan2(e.y, e.x) - S.afAng)) <= afHalf + e.r / ARENA.afR) {
        if (barActive && next - e.r <= ARENA.afR && dist - e.r > ARENA.afR - 6) {
          const k = (ARENA.afR + e.r) / dist; e.x *= k; e.y *= k; e.held = true; e.heading = Math.atan2(uy, ux);
          S.afHp -= e.spec.dmg * dt * .7; e.hp -= afChip * dt;
          if (rng() < dt * 6) burst(e.x + ux * e.r, e.y + uy * e.r, ACCENT.AF, 2, 50);
          if (S.afHp <= 0) { S.afDown = true; S.afDownT = 3.2 + sq.afTier * .3; fx('afDown', {}); onToast('afDown', 'bad'); }
          if (e.hp <= 0) killEnemy(e, false);
          continue;
        }
        if (!e.afWeakened && dist - e.r > ARENA.afR && next - e.r <= ARENA.afR) {
          e.hp *= (1 - sq.afWeaken); e.slow = 1400; e.afWeakened = true;
          burst(e.x, e.y, ACCENT.AF, 6, 90); dmgText(e.x, e.y, e.maxhp * sq.afWeaken, ACCENT.AF, false);
        }
      }
      e.held = false;
      e.x += ux * sp * dt + tx * lat; e.y += uy * sp * dt + ty * lat; e.heading = Math.atan2(uy, ux);
      if (next - e.r <= ARENA.coreR) {
        e.dead = true; fx('breach', { x: e.x, y: e.y, color: e.spec.color });
        if (e.spec.steals) { hitBase(e.spec.steals, '#ffd166'); onToast('exfil', 'bad'); }
        else hitBase(e.spec.dmg, null);
        if (S.defeatReason || S.availability <= 0) { S.defeatReason ||= 'service'; gameOver(); return; }
      }
    }

    // -- XDR chain lightning: one hop every 65 ms, 65% damage per further hop --
    if (S.arc) {
      const b = S.arc; b.life -= dt; b.age += dt; b.x = op.x; b.y = op.y;
      for (let i = 0; i < b.nodes.length; i++) {
        const node = b.nodes[i], e = S.enemies.find(e => e.id === node.id && !e.dead);
        if (e) { node.x = e.x; node.y = e.y; }
        if (node.hit || b.age < i * .065) continue;
        node.hit = true; node.skipped = !e;
        if (!e) continue;
        const dealt = dealDamage(e, b.dmg * Math.pow(.65, i));
        dmgText(e.x, e.y, dealt, '#bdffe1', i === 0);
        burst(e.x, e.y, '#a5ffd5', 6, 95); ring(e.x, e.y, ACCENT.XDR, e.r * 1.6, 2);
        if (e.hp <= 0) killEnemy(e, true, true);
      }
      if (b.life <= 0) S.arc = null;
    }

    // -- projectiles --
    const targets = S.targets; targets.clear();
    for (const e of S.enemies) if (!e.dead) targets.set(e.id, e);
    S.collision.reset(S.enemies);
    const edge2 = (ARENA.R + 60) ** 2;
    for (const p of S.shots) {
      if (p.dead) continue;
      p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
      p.homing = p.owner === 'mdr' || sq.tracking;
      if (p.homing) {
        const guided = p.owner !== 'mdr', speed = p.speed, hx = p.vx / speed, hy = p.vy / speed;
        const locked = targets.get(p.targetId);
        let ok = locked && !locked.dead && !p.hit.has(locked.id);
        if (ok && guided) { const dx = locked.x - p.x, dy = locked.y - p.y, len = Math.hypot(dx, dy) || 1; ok = len < 700 && ((dx * hx + dy * hy) / len >= .84 || len <= 35); }
        const target = ok ? locked : chooseTarget(p.x, p.y, p.hit, guided, hx, hy);
        if (target) {
          p.targetId = target.id; const dx = target.x - p.x, dy = target.y - p.y, len = Math.hypot(dx, dy) || 1;
          const turn = Math.min(1, dt * (p.owner === 'mdr' ? 8 : 2.8));
          p.vx += (dx / len * speed - p.vx) * turn; p.vy += (dy / len * speed - p.vy) * turn;
          const cur = Math.hypot(p.vx, p.vy) || 1; p.vx *= speed / cur; p.vy *= speed / cur;
        }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x * p.x + p.y * p.y > edge2) { p.dead = true; continue; }
      const candidates = S.collision.query(S.enemies, p.x, p.y, p.r);
      for (let c = 0; c < candidates.length; c++) {
        const e = S.enemies[candidates[c]];
        if (e.dead || p.hit.has(e.id)) continue;
        if (dist2(p.x, p.y, e.x, e.y) <= (e.r + p.r) ** 2) {
          p.hit.add(e.id); const dealt = dealDamage(e, p.dmg);
          dmgText(e.x, e.y, dealt, p.color, false); fx('spark', { x: p.x, y: p.y, color: p.color, h: p.height });
          if (e.hp <= 0) killEnemy(e, false);
          S.collision.appendSpawned(S.enemies, p.x, p.y, p.r);
          if (p.pierce-- <= 0) { p.dead = true; break; }
        }
      }
    }

    compactLive(S.enemies); compactLive(S.shots, S.pools.shots, 512); compactLive(S.temps);
    S.hudAcc += dt; if (S.hudAcc >= .1) { S.hudAcc = 0; pushHud(); }
    if (S.defeatReason || S.elapsed >= MISSION_SECONDS) gameOver();
  }

  function pushHud() {
    const abilities = {};
    for (const id of ABILITY_ORDER) {
      const spec = ABILITIES[id];
      abilities[id] = { cd: S.cd[id], cdMax: id === 'wf' ? S.wfCdMax : spec.cd,
        ready: S.cd[id] <= 0 && !(id === 'wf' && S.workflow),
        active: id === 'pt' ? S.ptT > 0 : id === 'rt' ? S.rtT > 0 : id === 'wf' ? !!S.workflow : false,
        stage: id === 'wf' ? (S.workflow?.stage ?? -1) : -1, runs: id === 'wf' ? S.workflows : 0 };
    }
    let boss = null; for (const e of S.enemies) if (e.spec.boss && !e.dead && (!boss || e.hp < boss.hp)) boss = e;
    const bossHud = boss ? { type: boss.type, hp: Math.max(0, Math.round(boss.hp)), maxhp: boss.maxhp, frac: clamp(boss.hp / boss.maxhp, 0, 1), color: boss.spec.color, mega: !!boss.spec.mega } : null;
    const scores = campaignScores(S), cloud = cloudRates(S.levels, S.elapsed, S.availability, !!S.workflow);
    const tier = WEAPON_ORDER.reduce((a, id) => a + (S.levels[id] || 0), 0);
    onHud({ base: integrityScore(S.base), baseMax: S.baseMax, score: scores.total, scores, availability: Math.floor(S.availability), demand: Math.round(cloud.demand), capacity: cloud.capacity,
      best: S.best, combo: S.combo, mult: comboMult(S.combo), elapsed: Math.floor(S.elapsed), level: S.level, xp: S.xp, xpNeed: S.xpNeed, tier,
      levels: { ...S.levels }, dom: dominant(), sensors: S.squad.sensors, shield: S.shield, shieldMax: S.squad.shieldMax, corr: correlationLinks(), abilities, boss: bossHud,
      bossesKilled: S.bossesKilled, offerLeft: S.offerLeft, hasChoices: S.choices.length > 0, mechanized: true, rigStage: tier >= 14 ? 3 : tier >= 7 ? 2 : tier >= 3 ? 1 : 0,
      tracking: S.squad.tracking, linkPhase: !S.levels.XDR ? 'offline' : S.arc ? 'firing' : S.link ? 'charging' : 'ready',
      dashCd: S.op.dashCd, dashMax: TUNE.dashCd, gates: S.gates.active.slice() });
  }
  function gameOver() {
    if (S.phase === 'over') return; S.phase = 'over';
    const scores = campaignScores(S), outcome = !S.defeatReason && S.bossesKilled === BOSS_TIMES.length ? 'victory' : 'defeat';
    if (outcome === 'victory') S.best = Math.max(S.best, scores.total);
    pushHud(); onSfx('over');
    onOver({ workflows: S.workflows, outcome, reason: S.defeatReason || (outcome === 'defeat' ? 'bosses' : null), health: scores.health, scores, score: scores.total, best: S.best,
      bossesKilled: S.bossesKilled, availability: Math.floor(S.availability), dodged: S.dodged, kills: S.kills, elapsed: Math.round(S.elapsed), maxCombo: S.maxCombo, level: S.level, levels: { ...S.levels } });
  }

  return {
    fxq,
    start(best = 0) {
      S = fresh(); S.best = best; S.phase = 'play'; fxq.length = 0;
      onLevelUp([], S.level); recompute(); openLevelUp(); onSfx('start'); pushHud();
      return S;
    },
    step(dt, input) { if (S && S.phase === 'play') update(dt, input); },
    applyUpgrade, chooseUpgrade, useAbility, pushHud: () => S && pushHud(),
    afHalfAngle: () => (S && S.squad.afTier > 0 ? afHalfAngle() : 0),
    revealed: () => !!S?.squad.ndrReveal,
    get state() { return S; },
  };
}
