// Sentinel Strike - the pure simulation of a Raiden-style vertical shooter.
// You fly a Sangfor interceptor up a scrolling datascape; every power-up is a
// Sangfor product and behaves the way the product really works:
//   EDR  Endpoint Secure  - vulcan spread (main weapon): covers many endpoints at once
//   AF   NGAF             - piercing firewall beam (main weapon): narrow, hard, straight
//   XDR                   - chain plasma (main weapon): weak alone, scales with every
//                           other product you run (it correlates what they see)
//   NDR  Cyber Command    - homing missiles + reveals cloaked APTs
//   HCI                   - scale-out wingman nodes + fire rate
//   IAG                   - traffic control: hostile bullets slow down near the ship
//   ASTOR aStor           - snapshot shield: absorbs a hit, keeps your build
//   MDR                   - bomb: a managed Incident Response sweep
// No DOM, no THREE, seeded randomness: the browser view draws it, a Node bot plays it.
// Field: x in [-8, 8], y in [0, 22] (y grows up-screen). Units are world units.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const d2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

export const FIELD = { w: 8, h: 22, shipMinY: 1, shipMaxY: 14 };
export const MAIN = ['EDR', 'AF', 'XDR'];
export const SUB = ['NDR', 'HCI', 'IAG', 'ASTOR'];
export const MAXLV = { EDR: 5, AF: 5, XDR: 5, NDR: 4, HCI: 4, IAG: 3, ASTOR: 2 };
export const COLOR = { EDR: '#ff8a5a', AF: '#2ee6a0', XDR: '#9be85a', NDR: '#58c8ff', HCI: '#39c0ff', IAG: '#ffd166', ASTOR: '#a98bff', MDR: '#16ca78' };
export const STAGES = [
  { id: 'perimeter', boss: 'botnet', bossHp: 430 },
  { id: 'datacenter', boss: 'ransom', bossHp: 700 },
  { id: 'cloud', boss: 'siege', bossHp: 980 },
];
export const STAGE_SECONDS = 50;                 // waves, then the boss
export const ENEMY = {
  recon:   { hp: 2,  r: .55, score: 100,  color: '#8aa0c6' },
  malware: { hp: 11, r: .85, score: 400,  color: '#ff8a3a' },
  worm:    { hp: 3,  r: .6,  score: 150,  color: '#2ee6a0' },
  apt:     { hp: 8,  r: .7,  score: 600,  color: '#a98bff', cloak: true },
  exfil:   { hp: 7,  r: .7,  score: 800,  color: '#ffd166' },
  turret:  { hp: 16, r: .9,  score: 500,  color: '#ff5a6a', ground: true },
  carrier: { hp: 7,  r: .9,  score: 300,  color: '#d5dfce' },
  botnet:  { hp: 1,  r: 2.5, score: 20000, color: '#39c0ff', boss: true },
  ransom:  { hp: 1,  r: 2.7, score: 30000, color: '#ff5a6a', boss: true },
  siege:   { hp: 1,  r: 2.9, score: 50000, color: '#ff5ad0', boss: true },
};
export const TUNE = { bulletSpeed: 6, enemyHp: 1, fireRate: 1, lives: 3, bombs: 3 };

// How many other products feed XDR (its real dependency).
export const xdrSensors = lv => SUB.reduce((n, id) => n + (lv[id] > 0 ? 1 : 0), 0);
export const xdrPower = (mainLv, lv) => (1.6 + mainLv * .5) * (.55 + .3 * xdrSensors(lv));

// ---- stage scripts: deterministic per stage -------------------------------
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function buildStage(index) {
  const r = mulberry(9173 + index * 131), ev = [];
  const push = (t, type, o) => ev.push({ t, type, ...o });
  const side = () => (r() < .5 ? -1 : 1);
  // supply carriers arrive on a fixed beat: main / sub / sub / main / sub / bomb
  [[2.5, 'main'], [10, 'sub'], [18, 'sub'], [26, 'main'], [34, 'sub'], [42, 'bomb'], [47, 'sub']].forEach(([t, drop], i) => push(t, 'carrier', { x: (i % 2 ? 1 : -1) * 9.5, y: 17 - (i % 3), drop, dir: i % 2 ? -1 : 1 }));
  const kinds = index === 0 ? ['scouts', 'scouts', 'line', 'gunship', 'worm', 'turrets']
    : index === 1 ? ['scouts', 'line', 'gunship', 'gunship', 'worm', 'turrets', 'turrets', 'exfil', 'apt']
      : ['scouts', 'line', 'gunship', 'gunship', 'worm', 'turrets', 'exfil', 'apt', 'apt'];
  let t = 1.2, last = '';
  while (t < STAGE_SECONDS - 3) {
    let k = kinds[Math.floor(r() * kinds.length)]; if (k === last) k = kinds[Math.floor(r() * kinds.length)]; last = k;
    if (t < 6) k = 'scouts';
    if (k === 'scouts') { const s = side(), n = 5 + index; for (let i = 0; i < n; i++) push(t + i * .28, 'recon', { x: s * (3 + r() * 4), y: 23.5, move: 'arc', dir: -s }); }
    else if (k === 'line') { const n = 5 + index, x0 = -6 + r() * 2; for (let i = 0; i < n; i++) push(t + (i % 2) * .15, 'recon', { x: x0 + i * (12 / (n - 1)), y: 23.5 + (i % 2), move: 'dive' }); }
    else if (k === 'gunship') { const n = 1 + (index > 0 ? 1 : 0) + (r() < .3 ? 1 : 0); for (let i = 0; i < n; i++) push(t + i * .5, 'malware', { x: -5.5 + r() * 11, y: 23.5, move: 'hover', hold: 14 + r() * 4, stay: 5.5 }); }
    else if (k === 'worm') { const x = -3 + r() * 6, ph = r() * TAU; for (let i = 0; i < 7; i++) push(t + i * .22, 'worm', { x, y: 23.5, move: 'snake', phase: ph }); }
    else if (k === 'turrets') { const n = 2 + (r() < .5 ? 1 : 0); for (let i = 0; i < n; i++) push(t + i * .7, 'turret', { x: -6 + r() * 12, y: 23.5, move: 'ground' }); }
    else if (k === 'exfil') { const s = side(); push(t, 'exfil', { x: s * 9, y: 6 + r() * 4, move: 'flee', dir: -s }); }
    else if (k === 'apt') { for (let i = 0; i < 2; i++) push(t + i * .6, 'apt', { x: -6 + r() * 12, y: 23.5, move: 'stalk', hold: 13 + r() * 5, stay: 4 }); }
    t += (k === 'scouts' || k === 'line' ? 2.5 : 3.3) - index * .28;
  }
  ev.sort((a, b) => a.t - b.t);
  return ev;
}

export function createSim(opts = {}) {
  const rng = opts.rng || Math.random;
  const onHud = opts.onHud || (() => {}), onToast = opts.onToast || (() => {}), onOver = opts.onOver || (() => {}), onSfx = opts.onSfx || (() => {});
  const rand = (a, b) => a + rng() * (b - a);
  const fxq = [];
  const fx = (t, o) => { if (fxq.length < 700) { o.t = t; fxq.push(o); } };
  let S = null, nextId = 1;

  function fresh() {
    return {
      phase: 'play', time: 0, stage: 0, stageT: 0, script: buildStage(0), cursor: 0, mode: 'waves', modeT: 0,
      score: 0, chain: 0, chainT: 0, bestChain: 0, kills: 0, leaks: 0, lives: TUNE.lives, bombs: TUNE.bombs, bombT: 0,
      main: 'EDR', mainLv: 1, lv: { NDR: 0, HCI: 0, IAG: 0, ASTOR: 0 }, shield: 0, shieldAcc: 0, picked: {},
      ship: { x: 0, y: 3, vx: 0, vy: 0, inv: 2, dead: 0, fireAcc: 0, xdrAcc: 0, missAcc: 0, muzzle: 0 },
      enemies: [], eb: [], shots: [], missiles: [], items: [], boss: null, arcs: [],
      hudAcc: 0, bombHeld: false, scroll: 0, warp: 0, cleared: 0, outcome: null,
    };
  }

  // ---------- spawning ----------
  function spawn(type, o = {}) {
    const spec = ENEMY[type], hpMul = (1 + S.stage * .4) * TUNE.enemyHp;
    const e = { id: nextId++, type, spec, x: o.x ?? 0, y: o.y ?? 23.5, x0: o.x ?? 0, r: spec.r, hp: Math.ceil(spec.hp * hpMul), age: 0, hit: 0,
      move: o.move || 'dive', dir: o.dir || 1, hold: o.hold || 15, stay: o.stay || 5, phase: o.phase || 0, drop: o.drop || null,
      shootAcc: rand(.2, 1.2), cloaked: !!spec.cloak, vx: 0, vy: 0, rot: 0 };
    e.maxhp = e.hp; S.enemies.push(e); return e;
  }
  function spawnBoss() {
    const st = STAGES[S.stage], e = spawn(st.boss, { x: 0, y: 27, move: 'boss' });
    e.hp = e.maxhp = Math.round(st.bossHp * TUNE.enemyHp); e.pattern = -1; e.patT = 1.5; e.spin = 0; e.cloakT = 0;
    S.boss = e; return e;
  }
  const bulletSpeed = () => TUNE.bulletSpeed + S.stage * .7;
  function bullet(x, y, ang, speed, kind = 0) {
    if (S.eb.length >= 420) return;
    S.eb.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: kind === 1 ? .26 : .17, kind, age: 0 });
  }
  const aim = (x, y) => Math.atan2(S.ship.y - y, S.ship.x - x);
  function fan(x, y, center, n, spread, speed, kind) { for (let i = 0; i < n; i++) bullet(x, y, center + (n === 1 ? 0 : (i / (n - 1) - .5) * spread), speed, kind); }
  function radial(x, y, n, speed, offset = 0, kind = 0) { for (let i = 0; i < n; i++) bullet(x, y, offset + i * TAU / n, speed, kind); }

  // ---------- scoring ----------
  function addScore(base, x, y) {
    const mult = 1 + Math.min(S.chain, 40) * .05, pts = Math.round(base * mult / 10) * 10;
    S.score += pts; if (x != null && base >= 300) fx('text', { x, y, str: String(pts), color: '#ffe9a8' });
  }
  function dropItem(x, y, kind) {
    S.items.push({ id: nextId++, x: clamp(x, -7, 7), y, kind, idx: Math.floor(rng() * 4), cyc: 0, vx: rand(-1.2, 1.2), vy: 1.6, age: 0 });
  }
  const itemId = it => (it.kind === 'main' ? MAIN[it.idx % MAIN.length] : it.kind === 'sub' ? SUB[it.idx % SUB.length] : 'MDR');
  function kill(e, byBomb) {
    if (e.dead) return; e.dead = true;
    S.kills++; S.chain++; S.chainT = 2.6; S.bestChain = Math.max(S.bestChain, S.chain);
    addScore(e.spec.score, e.x, e.y);
    fx('boom', { x: e.x, y: e.y, size: e.spec.boss ? 5 : e.r * 1.7, color: e.spec.color, boss: !!e.spec.boss, ground: !!e.spec.ground });
    onSfx(e.spec.boss ? 'boss' : 'hit', S.chain);
    if (e.drop) dropItem(e.x, e.y, e.drop);
    else if (e.type === 'exfil') dropItem(e.x, e.y, 'sub');
    else if (!e.spec.boss && !byBomb && rng() < .012) dropItem(e.x, e.y, 'bomb');
    if (e.spec.boss) bossDown(e);
  }
  function hurt(e, dmg) {
    if (e.dead) return;
    if (e.cloaked && !S.lv.NDR) dmg *= .5;             // you cannot hit well what you cannot see
    e.hp -= dmg; e.hit = 1;
    if (e.hp <= 0) kill(e);
  }
  function bossDown(e) {
    S.boss = null; S.cleared++;
    for (const b of S.eb) { b.dead = true; S.score += 10; fx('spark', { x: b.x, y: b.y, color: '#ffe9a8' }); }
    for (const o of S.enemies) if (!o.dead && !o.spec.boss) { o.dead = true; fx('boom', { x: o.x, y: o.y, size: o.r * 1.5, color: o.spec.color }); }
    const bonus = S.lives * 3000 + S.bombs * 1000; S.score += bonus;
    S.mode = 'clear'; S.modeT = 0; S.ship.inv = Math.max(S.ship.inv, 4);
    fx('clear', { stage: S.stage, bonus }); onToast('clear', 'good', { n: S.stage + 1, bonus });
  }

  // ---------- player ----------
  function pick(it) {
    const id = itemId(it); it.dead = true; S.picked[id] = (S.picked[id] || 0) + 1;
    let maxed = false;
    if (it.kind === 'main') {
      if (S.main === id) { if (S.mainLv >= MAXLV[id]) maxed = true; else S.mainLv++; }
      else S.main = id;
    } else if (it.kind === 'sub') {
      if (S.lv[id] >= MAXLV[id]) maxed = id !== 'ASTOR' || S.shield >= 2; else S.lv[id]++;
      if (id === 'ASTOR') S.shield = Math.min(2, S.shield + 1);
    } else { if (S.bombs >= 5) maxed = true; else S.bombs++; }
    if (maxed) addScore(2000, it.x, it.y);
    fx('pick', { id, x: it.x, y: it.y, color: COLOR[id] }); onToast('pick_' + id, 'good', { maxed }); onSfx('ability');
    if (S.main === 'XDR' && xdrSensors(S.lv) === 0 && id === 'XDR') onToast('xdrAlone', 'bad');
    pushHud();
  }
  function bomb() {
    if (S.bombs <= 0 || S.bombT > 0 || S.ship.dead > 0 || S.mode === 'clear') return false;
    S.bombs--; S.bombT = 1.1; S.ship.inv = Math.max(S.ship.inv, 2.2);
    for (const b of S.eb) { b.dead = true; fx('spark', { x: b.x, y: b.y, color: '#bfefff' }); }
    fx('bomb', { x: S.ship.x, y: S.ship.y }); onToast('bomb', 'good'); onSfx('ability'); pushHud();
    return true;
  }
  function shipHit() {
    const p = S.ship; if (p.inv > 0 || p.dead > 0 || S.lives <= 0) return;
    for (const b of S.eb) if (d2(b.x, b.y, p.x, p.y) < 16) { b.dead = true; fx('spark', { x: b.x, y: b.y, color: '#c9b5ff' }); }
    if (S.shield > 0) {            // aStor: restore from the snapshot, nothing lost
      S.shield--; p.inv = 1.6; fx('shield', { x: p.x, y: p.y }); onToast('snapshot', 'good'); onSfx('ability'); pushHud(); return;
    }
    S.lives--; S.chain = 0; p.dead = 1.1; p.inv = 3.4;
    S.mainLv = Math.max(1, S.mainLv - 1);
    fx('death', { x: p.x, y: p.y }); onSfx('breach');
    if (S.lives <= 0) { S.outcome = 'defeat'; S.mode = 'dying'; S.modeT = 0; }
    else { S.bombs = Math.max(S.bombs, 2); onToast('down', 'bad'); }
    pushHud();
  }
  function shot(x, y, ang, speed, dmg, kind, pierce) {
    if (S.shots.length >= 360) return;
    S.shots.push({ x, y, vx: Math.sin(ang) * speed, vy: Math.cos(ang) * speed, dmg, kind, pierce, r: kind === 'AF' ? .34 : .2, hitIds: pierce ? [] : null });
  }
  function fireMain(x, y, lv, scale, isOption) {
    if (S.main === 'EDR') {
      const dmg = (lv >= 4 ? 1.3 : 1) * scale;
      if (isOption) { shot(x, y, 0, 30, dmg, 'EDR'); return; }
      const fans = [[], [0, 0], [0, 0, 0], [-.14, 0, 0, 0, .14], [-.26, -.13, 0, 0, .13, .26], [-.36, -.24, -.12, 0, 0, .12, .24, .36]][lv];
      const flat = fans.filter(a => a === 0).length;
      let f = 0; for (const a of fans) { const off = a === 0 ? (flat === 1 ? 0 : (f++ - (flat - 1) / 2) * .36) : 0; shot(x + off, y + .5, a, 30, dmg, 'EDR'); }
    } else if (S.main === 'AF') {
      const dmg = [0, 2.3, 3.1, 2.5, 3.4, 3.1][lv] * scale, n = isOption ? 1 : [0, 1, 1, 2, 2, 3][lv];
      for (let i = 0; i < n; i++) shot(x + (i - (n - 1) / 2) * .5, y + .7, 0, 44, isOption ? dmg * .6 : dmg, 'AF', true);
    }
  }
  function fireXdr() {
    // chain plasma: lock the nearest threat ahead, then hop to neighbours
    const p = S.ship, links = 2 + S.mainLv + Math.min(2, S.lv.HCI), dmg = xdrPower(S.mainLv, S.lv);
    let cur = null, best = 1e9;
    for (const e of S.enemies) { if (e.dead || e.y > 22.5 || (e.cloaked && !S.lv.NDR)) continue; const d = d2(p.x, p.y, e.x, e.y) * (e.y < p.y ? 3 : 1); if (d < best && d < 420) { best = d; cur = e; } }
    if (!cur) return;
    const pts = [{ x: p.x, y: p.y + .6 }], used = new Set();
    for (let i = 0; i < links && cur; i++) {
      used.add(cur.id); pts.push({ x: cur.x, y: cur.y }); hurt(cur, dmg * Math.pow(.86, i));
      let nx = null, nb = 30;
      for (const e of S.enemies) { if (e.dead || used.has(e.id) || e.y > 22.5 || (e.cloaked && !S.lv.NDR)) continue; const d = d2(cur.x, cur.y, e.x, e.y); if (d < nb) { nb = d; nx = e; } }
      cur = nx;
    }
    S.arcs.push({ pts, life: .16 }); if (S.arcs.length > 6) S.arcs.shift();
  }

  // ---------- enemies ----------
  function moveEnemy(e, dt) {
    const p = S.ship, a = e.age;
    switch (e.move) {
      case 'arc': e.vy = -6.2; e.vx = e.dir * Math.sin(Math.min(a, 2.6) * 1.2) * 6.5; break;
      case 'dive': e.vy = -7.2; e.vx = clamp((p.x - e.x) * .5, -1.6, 1.6); break;
      case 'snake': e.vy = -3.9; e.x = e.x0 + Math.sin(a * 2.1 + e.phase) * 3.6; e.vx = 0; break;
      case 'ground': e.vy = -3.1; e.vx = 0; break;
      case 'flee': e.vx = e.dir * (a < 1.4 ? 5 : 1.2); e.vy = a < 1.4 ? 0 : 2 + (a - 1.4) * 5; break;
      case 'carrier': e.vx = e.dir * 3.1; e.vy = Math.sin(a * 2) * .7; break;
      case 'hover': case 'stalk':
        if (a < 1.3) { e.vy = -(e.y - e.hold) * 3.2 - 1; e.vx = 0; }
        else if (a < 1.3 + e.stay) { e.vy = Math.sin(a * 1.7) * .5; e.vx = e.move === 'stalk' ? clamp((p.x - e.x) * 1.4, -4, 4) : Math.cos(a * .9 + e.id) * 1.3; }
        else { e.vy = 5.5; e.vx = e.x < 0 ? -3 : 3; }
        break;
      case 'boss': {
        if (e.y > 17.2) { e.vy = -3.2; e.vx = 0; } else { e.vy = Math.sin(a * .9) * .5; e.vx = Math.cos(a * .55) * (2.2 + S.stage * .5); }
        break;
      }
    }
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.move === 'boss') e.x = clamp(e.x, -5.2, 5.2);
  }
  function enemyFire(e, dt) {
    if (e.y > 21.5 || e.y < 2 || S.mode === 'clear') return;
    e.shootAcc -= dt; if (e.shootAcc > 0) return;
    const sp = bulletSpeed(), st = S.stage;
    switch (e.type) {
      case 'recon': if (st > 0 || rng() < .35) bullet(e.x, e.y, aim(e.x, e.y), sp); e.shootAcc = rand(1.6, 2.8) - st * .25; break;
      case 'malware': fan(e.x, e.y - .4, aim(e.x, e.y), 3 + (st > 1 ? 2 : 0), .5 + st * .12, sp); e.shootAcc = 1.35 - st * .15; break;
      case 'worm': if (rng() < .3) bullet(e.x, e.y, -Math.PI / 2, sp * .8); e.shootAcc = rand(1.2, 2.2); break;
      case 'apt': if (e.age > 1.2) { for (let i = 0; i < 3; i++) bullet(e.x, e.y, aim(e.x, e.y) + (i - 1) * .07, sp * (1.25 + i * .12)); } e.shootAcc = 1.5 - st * .12; break;
      case 'turret': radial(e.x, e.y, 8 + st * 2, sp * .78, e.age * .7, 1); e.shootAcc = 1.9 - st * .15; break;
      default: e.shootAcc = 9;
    }
  }
  function bossFire(e, dt) {
    if (e.y > 17.4) return;
    const sp = bulletSpeed(), rage = e.hp < e.maxhp * .4 ? 1 : 0;
    e.patT -= dt; e.spin += dt;
    if (e.patT <= 0) { e.pattern = (e.pattern + 1) % 3; e.patT = 4.2 - rage * .6; e.burst = 0; e.burstAcc = .5; e.gap = rand(-5, 5); onSfx('serve'); }
    e.burstAcc -= dt; if (e.burstAcc > 0) return;
    const P = e.pattern;
    if (e.type === 'botnet') {
      if (P === 0) { radial(e.x, e.y, 14 + rage * 4, sp * .85, e.burst * .22, 1); e.burstAcc = .7; }
      else if (P === 1) { if (e.burst < 4 + rage) spawn('recon', { x: e.x + (e.burst % 2 ? 2 : -2), y: e.y - 1, move: 'dive' }); e.burstAcc = .5; }
      else { fan(e.x, e.y - 1, aim(e.x, e.y), 5 + rage * 2, .9, sp * 1.1); e.burstAcc = .55; }
    } else if (e.type === 'ransom') {
      if (P === 0) { for (const o of [-1.6, 0, 1.6]) bullet(e.x + o, e.y - 1.4, aim(e.x + o, e.y - 1.4), sp * 1.35); e.burstAcc = .2 - rage * .04; }
      else if (P === 1) { for (let x = -7.6; x <= 7.6; x += .95) if (Math.abs(x - e.gap) > 1.75) bullet(x, e.y - 1, -Math.PI / 2, sp * .72, 1); e.gap = clamp(e.gap + rand(-2.4, 2.4), -6, 6); e.burstAcc = 1.05 - rage * .15; }
      else { radial(e.x, e.y, 18, sp * .9, (e.burst % 2) * TAU / 36, 0); e.burstAcc = .62; }
    } else {
      if (P === 0) { for (const k of [0, Math.PI]) bullet(e.x, e.y, e.spin * 2.6 + k, sp * .95); bullet(e.x, e.y, -e.spin * 2.1, sp * .8, 1); e.burstAcc = .075; }
      else if (P === 1) { fan(e.x, e.y - 1, aim(e.x, e.y), 7, 1.5, sp * 1.05); if (e.burst % 2) radial(e.x, e.y, 10, sp * .7, e.burst * .3, 1); e.burstAcc = .6 - rage * .1; }
      else { if (e.burst === 0) { e.cloakT = 3; for (const s of [-1, 1]) spawn('apt', { x: e.x + s * 3, y: e.y, move: 'stalk', hold: 12, stay: 3 }); } fan(e.x, e.y - 1, -Math.PI / 2, 9, 2.2, sp * .9); e.burstAcc = .7; }
    }
    e.burst++;
  }

  // ---------- the step ----------
  function update(dt, input) {
    S.time += dt; S.stageT += dt; S.modeT += dt;
    const p = S.ship;
    S.warp = S.mode === 'clear' ? Math.min(1, S.warp + dt * 1.5) : Math.max(0, S.warp - dt * 1.2);
    S.scroll += dt * (6 + S.warp * 30);

    // stage flow
    if (S.mode === 'waves') {
      while (S.cursor < S.script.length && S.script[S.cursor].t <= S.stageT) { const ev = S.script[S.cursor++]; spawn(ev.type, ev.type === 'carrier' ? { ...ev, move: 'carrier' } : ev); }
      if (S.stageT >= STAGE_SECONDS) { S.mode = 'warn'; S.modeT = 0; fx('warn', { boss: STAGES[S.stage].boss }); onToast('boss_' + STAGES[S.stage].boss, 'bad'); onSfx('boss'); }
    } else if (S.mode === 'warn') { if (S.modeT >= 2.6) { S.mode = 'boss'; S.modeT = 0; spawnBoss(); } }
    else if (S.mode === 'clear') {
      if (S.modeT >= 4) {
        if (S.stage >= STAGES.length - 1) { S.outcome = 'victory'; gameOver(); return; }
        S.stage++; S.stageT = 0; S.script = buildStage(S.stage); S.cursor = 0; S.mode = 'waves'; S.modeT = 0;
        fx('stage', { stage: S.stage }); onToast('stage_' + STAGES[S.stage].id, 'good'); onSfx('start');
      }
    } else if (S.mode === 'dying') { if (S.modeT >= 1.6) { gameOver(); return; } }

    // ship
    p.inv = Math.max(0, p.inv - dt); p.muzzle = Math.max(0, p.muzzle - dt * 8);
    if (p.dead > 0) { p.dead -= dt; if (p.dead <= 0 && S.lives > 0) { p.x = 0; p.y = 3; } }
    else {
      let tvx = 0, tvy = 0;
      if (input && input.tx != null) { const dx = input.tx - p.x, dy = input.ty - p.y; tvx = clamp(dx * 14, -26, 26); tvy = clamp(dy * 14, -26, 26); }
      else if (input) { let mx = input.mx || 0, my = input.my || 0; const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; } const sp = input.slow ? 6 : 12.5; tvx = mx * sp; tvy = my * sp; }
      const k = Math.min(1, dt * 22); p.vx += (tvx - p.vx) * k; p.vy += (tvy - p.vy) * k;
      p.x = clamp(p.x + p.vx * dt, -FIELD.w + .6, FIELD.w - .6); p.y = clamp(p.y + p.vy * dt, FIELD.shipMinY, FIELD.shipMaxY);
      const wantBomb = !!input?.bomb; if (wantBomb && !S.bombHeld) bomb(); S.bombHeld = wantBomb;

      // weapons (auto-fire)
      if (S.mode !== 'clear') {
        const rate = (1 + (S.lv.HCI >= 3 ? .12 : 0) + (S.lv.HCI >= 4 ? .12 : 0)) * TUNE.fireRate, opts = Math.min(2, S.lv.HCI);
        if (S.main === 'XDR') { p.xdrAcc += dt * rate; if (p.xdrAcc >= .2) { p.xdrAcc = 0; fireXdr(); p.muzzle = 1; } }
        else {
          p.fireAcc += dt * rate; const iv = S.main === 'AF' ? .075 : .09;
          while (p.fireAcc >= iv) { p.fireAcc -= iv; fireMain(p.x, p.y, S.mainLv, 1, false); for (let i = 0; i < opts; i++) fireMain(p.x + (i ? 1.5 : -1.5), p.y - .5, S.mainLv, .5, true); p.muzzle = 1; }
        }
        if (S.lv.NDR > 0) {
          p.missAcc += dt * rate;
          if (p.missAcc >= .62) { p.missAcc = 0; const n = S.lv.NDR >= 3 ? 4 : 2, dmg = S.lv.NDR % 2 ? 3 : 4.4; for (let i = 0; i < n; i++) { const s = (i % 2 ? 1 : -1) * (1 + (i >> 1)); if (S.missiles.length < 40) S.missiles.push({ x: p.x + s * .5, y: p.y, vx: s * 5, vy: 5, dmg, target: 0, life: 2.6 }); } }
        }
      }
    }
    if (S.lv.ASTOR > 0 && S.shield < S.lv.ASTOR) { S.shieldAcc += dt; if (S.shieldAcc >= 22) { S.shieldAcc = 0; S.shield++; fx('shieldUp', {}); pushHud(); } } else S.shieldAcc = 0;
    if (S.chainT > 0) { S.chainT -= dt; if (S.chainT <= 0) S.chain = 0; }

    // bomb: a sweeping Incident Response wave
    if (S.bombT > 0) {
      S.bombT -= dt;
      for (const b of S.eb) b.dead = true;
      for (const e of S.enemies) if (!e.dead && e.y < 23) { e.hp -= (e.spec.boss ? 85 : 60) * dt / 1.1; e.hit = 1; if (e.hp <= 0) kill(e, true); }
    }

    // enemies
    for (const e of S.enemies) {
      if (e.dead) continue;
      e.age += dt; e.hit = Math.max(0, e.hit - dt * 6); e.rot += dt;
      moveEnemy(e, dt);
      if (e.spec.cloak) e.cloaked = !S.lv.NDR && d2(e.x, e.y, p.x, p.y) > 30;
      if (e.spec.boss) { bossFire(e, dt); if (e.cloakT > 0) { e.cloakT -= dt; e.cloaked = !S.lv.NDR; } else e.cloaked = false; }
      else enemyFire(e, dt);
      if (!e.spec.boss && (e.y < -2 || e.y > 30 || Math.abs(e.x) > 13)) {
        e.dead = true;
        if (e.type === 'exfil' && e.y > 20) { S.leaks++; S.chain = 0; S.score = Math.max(0, S.score - 1500); onToast('exfil', 'bad'); fx('leak', { x: e.x }); }
      }
      if (!e.dead && !e.spec.ground && p.dead <= 0 && p.inv <= 0 && d2(e.x, e.y, p.x, p.y) < (e.r * .72 + .22) ** 2) shipHit();
    }

    // player shots
    for (const s of S.shots) {
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.y > 23.5 || Math.abs(s.x) > 10) { s.dead = true; continue; }
      for (const e of S.enemies) {
        if (e.dead || e.y > 22.8) continue;
        const rr = e.r + s.r; if (Math.abs(e.x - s.x) > rr || Math.abs(e.y - s.y) > rr + .6) continue;
        if (s.pierce) { if (s.hitIds.includes(e.id)) continue; s.hitIds.push(e.id); hurt(e, s.dmg); fx('hit', { x: s.x, y: e.y - e.r * .5, color: COLOR.AF }); }
        else { hurt(e, s.dmg); s.dead = true; fx('hit', { x: s.x, y: s.y, color: COLOR.EDR }); break; }
      }
    }
    // Cyber Command missiles
    for (const m of S.missiles) {
      m.life -= dt; if (m.life <= 0) { m.dead = true; continue; }
      let t = null; if (m.target) t = S.enemies.find(e => e.id === m.target && !e.dead);
      if (!t) { let best = 1e9; for (const e of S.enemies) { if (e.dead || e.y > 22.5) continue; const d = d2(m.x, m.y, e.x, e.y) * (e.spec.boss ? .6 : 1); if (d < best) { best = d; t = e; } } m.target = t ? t.id : 0; }
      const sp = 17;
      if (t) { const a = Math.atan2(t.y - m.y, t.x - m.x), k = Math.min(1, dt * 7); m.vx += (Math.cos(a) * sp - m.vx) * k; m.vy += (Math.sin(a) * sp - m.vy) * k; }
      else { m.vy += (sp - m.vy) * Math.min(1, dt * 4); m.vx *= 1 - Math.min(1, dt * 3); }
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.y > 24 || m.y < -1 || Math.abs(m.x) > 11) { m.dead = true; continue; }
      if (t && d2(m.x, m.y, t.x, t.y) < (t.r + .3) ** 2) { hurt(t, m.dmg); m.dead = true; fx('hit', { x: m.x, y: m.y, color: COLOR.NDR, big: true }); }
    }
    // hostile bullets (IAG throttles traffic near the ship)
    const iagR2 = S.lv.IAG ? (3 + S.lv.IAG * .5) ** 2 : 0, iagK = 1 - S.lv.IAG * .17;
    for (const b of S.eb) {
      if (b.dead) continue;
      const k = iagR2 && d2(b.x, b.y, p.x, p.y) < iagR2 ? iagK : 1;
      b.x += b.vx * dt * k; b.y += b.vy * dt * k; b.age += dt; b.slow = k < 1;
      if (b.y < -1 || b.y > 24 || Math.abs(b.x) > 9.5) { b.dead = true; continue; }
      if (p.dead <= 0 && p.inv <= 0 && d2(b.x, b.y, p.x, p.y) < (b.r + .17) ** 2) { b.dead = true; shipHit(); }
    }
    // items: drift down, bounce off the sides, cycle product every 1.8 s
    for (const it of S.items) {
      it.age += dt; it.cyc += dt; if (it.cyc >= 1.8 && it.kind !== 'bomb') { it.cyc = 0; it.idx++; }
      it.vy = Math.max(-2.3, it.vy - dt * 3); it.x += it.vx * dt; it.y += it.vy * dt;
      if (Math.abs(it.x) > 7.2) { it.vx *= -1; it.x = clamp(it.x, -7.2, 7.2); }
      if (it.y < 1.2 && it.age < 13) { it.y = 1.2; it.vy = 2.6; }      // one more lap before it leaves
      if (it.y < -1) it.dead = true;
      else if (p.dead <= 0 && d2(it.x, it.y, p.x, p.y) < 1.5) pick(it);
    }
    for (const a of S.arcs) a.life -= dt;

    compact(S.enemies); compact(S.eb); compact(S.shots); compact(S.missiles); compact(S.items);
    for (let i = S.arcs.length - 1; i >= 0; i--) if (S.arcs[i].life <= 0) S.arcs.splice(i, 1);
    S.hudAcc += dt; if (S.hudAcc >= .1) { S.hudAcc = 0; pushHud(); }
  }
  function compact(list) { let w = 0; for (let i = 0; i < list.length; i++) if (!list[i].dead) list[w++] = list[i]; list.length = w; }

  function pushHud() {
    const b = S.boss;
    onHud({ score: S.score, lives: S.lives, bombs: S.bombs, stage: S.stage, stageId: STAGES[S.stage].id, mode: S.mode, chain: S.chain, mult: 1 + Math.min(S.chain, 40) * .05,
      main: S.main, mainLv: S.mainLv, lv: { ...S.lv }, shield: S.shield, sensors: xdrSensors(S.lv), xdr: S.main === 'XDR' ? xdrPower(S.mainLv, S.lv) : 0,
      boss: b ? { type: b.type, frac: clamp(b.hp / b.maxhp, 0, 1), color: b.spec.color, cloaked: b.cloaked } : null,
      progress: S.mode === 'waves' ? clamp(S.stageT / STAGE_SECONDS, 0, 1) : 1 });
  }
  function gameOver() {
    if (S.phase === 'over') return; S.phase = 'over'; pushHud(); onSfx('over');
    onOver({ outcome: S.outcome || 'defeat', score: S.score, stage: S.stage + 1, cleared: S.cleared, kills: S.kills, bestChain: S.bestChain, leaks: S.leaks,
      main: S.main, mainLv: S.mainLv, lv: { ...S.lv }, picked: { ...S.picked }, time: Math.round(S.time) });
  }

  return {
    fxq, itemId,
    start() { S = fresh(); fxq.length = 0; fx('stage', { stage: 0 }); onSfx('start'); pushHud(); return S; },
    step(dt, input) { if (S && S.phase === 'play') update(dt, input); },
    bomb: () => (S && S.phase === 'play' ? bomb() : false),
    grant(id) { if (!S) return; const kind = MAIN.includes(id) ? 'main' : SUB.includes(id) ? 'sub' : 'bomb'; pick({ kind, idx: kind === 'main' ? MAIN.indexOf(id) : kind === 'sub' ? SUB.indexOf(id) : 0, x: S.ship.x, y: S.ship.y }); },
    get state() { return S; },
  };
}
