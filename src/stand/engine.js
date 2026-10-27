// Last Stand — the machine. A vertical, pseudo-3D "survivor" base-defense shooter:
// the operator holds the bottom line, threats pour DOWN from the top, the weapon
// auto-fires UP, and it evolves as you level Sangfor product dimensions (chosen on
// the level-up cards the host renders). Exaggerated per-product FX; the XDR beam is
// the colossal vertical lance from the reference. Pure numbers live in model.js.

import {
  START_BASE, WEAPONS, WEAPON_ORDER, SENSORS, deriveWeapon, damageTo,
  xpToLevel, upgradeChoices, ENEMIES, threatPool, difficultyAt,
  comboMult, killScore, SURVIVE_PER_SEC, STEAL_PENALTY,
} from './model.js';
import { ICONS } from '../ui/icons.js';
import { sfx } from '../rush/audio.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

// Accent per product — mirrors stand.css .cap-* so canvas and DOM agree.
export const ACCENT = {
  HCI: '#39c0ff', EDR: '#ff8a5a', NDR: '#58c8ff', AF: '#2ee6a0',
  IAG: '#ffd166', XDR: '#9be85a', ASTOR: '#a98bff', MDR: '#16ca78',
};
const ICON_KEY = { HCI: 'network', EDR: 'edr', NDR: 'ndr', AF: 'af', IAG: 'iag', XDR: 'xdr', ASTOR: 'astor', MDR: 'mdr' };

function makeIcon(name, color) {
  // Canvas <img> sources need an explicit xmlns (the inline ICONS set omits it,
  // fine in the DOM but "broken" as a data-URL image on canvas).
  const raw = (ICONS[ICON_KEY[name]] || ICONS.af)
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replaceAll('currentColor', color);
  const img = new Image();
  img.src = 'data:image/svg+xml,' + encodeURIComponent(raw);
  return img;
}
const fmtNum = n => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(Math.round(n)));

export function createStandGame(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const onHud = opts.onHud || (() => {});
  const onToast = opts.onToast || (() => {});
  const onLevelUp = opts.onLevelUp || (() => {});
  const onOver = opts.onOver || (() => {});

  const icons = {}; for (const id of WEAPON_ORDER) icons[id] = makeIcon(id, '#eafff3');

  // ---- geometry ----
  let W = 0, H = 0, dpr = 1, barH = 0, baseY = 0, opHome = 0, cracks = [];
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    barH = Math.max(56, H * 0.1);
    baseY = H - barH;              // enemies crossing this hit the base
    opHome = baseY - 26;
    if (S) { S.op.x = clamp(S.op.x, 40, W - 40); S.op.y = clamp(S.op.y, baseY - 150, baseY - 10); }
    buildCracks();
  }
  function buildCracks() {
    cracks = [];
    for (let i = 0; i < 9; i++) {
      const x = rand(0, W), y = rand(0, baseY), len = rand(50, 150), a = rand(0, TAU);
      const pts = [[x, y]]; let px = x, py = y, ang = a;
      for (let k = 0; k < 4; k++) { ang += rand(-0.7, 0.7); px += Math.cos(ang) * len / 4; py += Math.sin(ang) * len / 4; pts.push([px, py]); }
      cracks.push(pts);
    }
  }

  let S = null, raf = 0, lastTS = 0, nextId = 1;
  const keys = new Set();
  const drag = { on: false };

  function fresh() {
    return {
      phase: 'idle', base: START_BASE, baseMax: START_BASE, score: 0, best: 0,
      combo: 0, maxCombo: 0, elapsed: 0, kills: 0, level: 1, xp: 0, xpNeed: xpToLevel(1),
      levels: {}, w: deriveWeapon({}), shield: 0, pendingLevels: 0,
      op: { x: W / 2, y: opHome, aim: -Math.PI / 2, muzzle: 0 },
      drones: [], enemies: [], shots: [], parts: [], texts: [], fx: [], beam: null,
      spawnAcc: 0, fireAcc: 0, beamAcc: 0, shieldAcc: 0, lastBoss: -30,
      shake: 0, flash: 0, flashCol: '255,90,106', hudAcc: 0,
    };
  }

  function recompute() {
    S.w = deriveWeapon(S.levels);
    S.baseMax = START_BASE;
    // place drones around the operator
    const n = S.w.drones;
    while (S.drones.length < n) S.drones.push({ ang: S.drones.length * (TAU / Math.max(1, n)), fireAcc: 0 });
    while (S.drones.length > n) S.drones.pop();
  }

  // ---- fx helpers ----
  function burst(x, y, color, n = 12, spread = 180) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 40 + Math.random() * spread; S.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color, r: 1.4 + Math.random() * 3 }); }
  }
  const ring = (x, y, color, max, w = 3) => S.fx.push({ t: 'ring', x, y, color, r: 5, max, w, life: 1 });
  const shock = (x, y, color, max) => S.fx.push({ t: 'ring', x, y, color, r: 5, max, w: 5, life: 1 });
  const zap = (x1, y1, x2, y2, color) => S.fx.push({ t: 'zap', x1, y1, x2, y2, color, life: 1 });
  const frost = (x, y) => S.fx.push({ t: 'frost', x, y, r: 6, max: 34, life: 1 });
  function dmgText(x, y, n, color, big) { S.texts.push({ x, y, text: fmtNum(n), color, life: 1, big: !!big, vy: -34 - Math.random() * 20, vx: rand(-16, 16) }); }

  // ---- enemies ----
  function spawnEnemy(type) {
    const d = difficultyAt(S.elapsed), spec = ENEMIES[type];
    const hp = Math.round(spec.hp * (spec.boss ? 1 : d.hpMul));
    S.enemies.push({
      id: nextId++, type, spec, x: rand(spec.r + 10, W - spec.r - 10), y: -spec.r - 4,
      hp, maxhp: hp, r: spec.r, slow: 0, hit: 0, wob: Math.random() * TAU,
    });
  }
  function killEnemy(e, viaBeam) {
    e.dead = true;
    S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
    const mult = comboMult(S.combo);
    S.score += killScore(e.type, mult);
    S.kills++;
    gainXp(e.spec.xp);
    burst(e.x, e.y, e.spec.color, e.spec.boss ? 40 : 14, e.spec.boss ? 300 : 180);
    ring(e.x, e.y, e.spec.color, e.r * (e.spec.boss ? 5 : 2.4));
    if (e.spec.boss) { S.shake = 1; S.flash = 0.8; S.flashCol = '255,90,106'; sfx.boss(); }
    else if (!viaBeam) sfx.hit(S.combo);
    if (e.spec.splits) for (let i = 0; i < e.spec.splits; i++) {
      const r2 = ENEMIES.recon; S.enemies.push({ id: nextId++, type: 'recon', spec: r2, x: e.x + rand(-14, 14), y: e.y, r: r2.r, hp: r2.hp, maxhp: r2.hp, slow: 0, hit: 0, wob: Math.random() * TAU });
    }
  }
  function hitEnemy(e, raw, color, big) {
    const dealt = damageTo(e, S.levels, raw);
    e.hp -= dealt; e.hit = 1;
    dmgText(e.x, e.y - e.r, dealt, color || '#fff', big);
    if (S.w.slowMs) { e.slow = S.w.slowMs; }    // IAG egress throttle
  }

  // ---- firing ----
  function nearestEnemy(x, y, maxD) {
    let best = null, bd = (maxD || 1e9) ** 2;
    for (const e of S.enemies) { if (e.dead) continue; const d = dist2(x, y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function fireWeapon() {
    const op = S.op, w = S.w;
    const tgt = nearestEnemy(op.x, op.y);
    let aim = -Math.PI / 2;
    if (tgt) { aim = Math.atan2(tgt.y - op.y, tgt.x - op.x); aim = clamp(aim, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9); }
    op.aim = aim; op.muzzle = 1;
    const color = dominantColor();
    const shots = [];
    const lanes = w.multishot;                       // NDR parallel streams
    for (let i = 0; i < lanes; i++) {
      const off = (i - (lanes - 1) / 2) * 12;
      shots.push({ ang: aim, offx: Math.cos(aim + Math.PI / 2) * off, offy: Math.sin(aim + Math.PI / 2) * off });
    }
    for (let i = 1; i <= w.spread; i++) {            // AF perimeter fan
      const da = i * 0.16;
      shots.push({ ang: aim - da, offx: 0, offy: 0, fan: true });
      shots.push({ ang: aim + da, offx: 0, offy: 0, fan: true });
    }
    for (const s of shots) {
      const sp = 640;
      S.shots.push({
        x: op.x + s.offx, y: op.y - 14 + s.offy, vx: Math.cos(s.ang) * sp, vy: Math.sin(s.ang) * sp,
        dmg: w.dmg * (s.fan ? 0.7 : 1), pierce: w.pierce, hit: new Set(), r: 4.5, color, fan: !!s.fan,
      });
    }
    S.fx.push({ t: 'muzzle', x: op.x + Math.cos(aim) * 16, y: op.y - 14 + Math.sin(aim) * 16, ang: aim, color, life: 1 });
    sfx.serve();
  }
  function fireDrone(d) {
    const dx = S.op.x + Math.cos(d.ang) * 46, dy = S.op.y - 20 + Math.sin(d.ang) * 30;
    const tgt = nearestEnemy(dx, dy); if (!tgt) return;
    const ang = Math.atan2(tgt.y - dy, tgt.x - dx), sp = 560, color = ACCENT.MDR;
    S.shots.push({ x: dx, y: dy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, dmg: S.w.droneDmg, pierce: 0, hit: new Set(), r: 3.6, color, drone: true });
  }
  function fireBeam() {
    const w = S.w; if (!w.beamOn) return;
    S.beam = { x: S.op.x, life: 1, width: w.beamWidth, dmg: w.beamDmg, dealt: new Set() };
    S.flash = 0.7; S.flashCol = '155,232,90'; S.shake = Math.min(1, 0.4 + w.sensors * 0.08);
    // lightning branches from the operator to each owned sensor's position marker
    SENSORS.forEach((id, i) => { if ((S.levels[id] || 0) > 0) zap(S.op.x, S.op.y - 16, S.op.x + (i - 1) * 46, S.op.y + 6, ACCENT[id]); });
    sfx.ability();
    if (w.xdrIdle) onToast('xdrIdle', 'bad');
  }

  function dominantColor() {
    let best = null, bl = 0;
    for (const id of WEAPON_ORDER) { const l = S.levels[id] || 0; if (l > bl) { bl = l; best = id; } }
    return best ? ACCENT[best] : '#72bb38';
  }

  // ---- xp / level ----
  function gainXp(n) {
    S.xp += n;
    while (S.xp >= S.xpNeed) { S.xp -= S.xpNeed; S.level++; S.xpNeed = xpToLevel(S.level); S.pendingLevels++; }
    if (S.pendingLevels > 0 && S.phase === 'play') openLevelUp();
  }
  function openLevelUp() {
    const choices = upgradeChoices(S.levels);
    if (!choices.length) { S.pendingLevels = 0; return; }   // everything maxed -> skip
    S.phase = 'levelup'; S.op.muzzle = 0;
    onLevelUp(choices, S.level);
    sfx.start();
  }
  function applyUpgrade(id) {
    if (!WEAPONS[id]) return;
    S.levels[id] = Math.min(WEAPONS[id].max, (S.levels[id] || 0) + 1);
    recompute();
    ring(S.op.x, S.op.y, ACCENT[id], 90, 5);
    burst(S.op.x, S.op.y - 16, ACCENT[id], 20, 150);
    S.pendingLevels--;
    if (S.pendingLevels > 0) { openLevelUp(); }
    else { S.phase = 'play'; lastTS = performance.now(); }
  }

  // ---- base damage ----
  function hitBase(amount, color) {
    if (S.shield > 0) {                  // aStor snapshot absorbs the hit
      S.shield--; S.flash = 0.6; S.flashCol = '169,139,255';
      ring(S.op.x, baseY - 2, ACCENT.ASTOR, 120, 6); onToast('absorb', 'good'); sfx.ability(); return;
    }
    const dmg = amount * (1 - S.w.baseArmor);
    S.base = Math.max(0, S.base - dmg);
    S.combo = 0; S.shake = Math.min(1, 0.5 + dmg / 400); S.flash = 0.7; S.flashCol = color || '255,90,106';
    sfx.breach();
    if (S.base <= 0) gameOver();
  }

  // ---- loop ----
  function update(dt) {
    S.elapsed += dt;
    const d = difficultyAt(S.elapsed);

    // operator movement (keyboard + drag target)
    const op = S.op, mv = 360 * dt;
    if (keys.has('left')) op.x -= mv; if (keys.has('right')) op.x += mv;
    if (keys.has('up')) op.y -= mv; if (keys.has('down')) op.y += mv;
    if (drag.on) { op.x += (drag.x - op.x) * Math.min(1, dt * 14); op.y += (drag.y - op.y) * Math.min(1, dt * 14); }
    op.x = clamp(op.x, 40, W - 40); op.y = clamp(op.y, baseY - 150, baseY - 10);
    op.muzzle = Math.max(0, op.muzzle - dt * 6);

    // spawns
    S.spawnAcc += dt * 1000;
    if (S.spawnAcc >= d.spawnGap) { S.spawnAcc = 0; const pool = threatPool(S.elapsed); spawnEnemy(pool[Math.floor(Math.random() * pool.length)]); }
    if (S.elapsed - S.lastBoss > d.bossEvery) { S.lastBoss = S.elapsed; spawnEnemy('ransom'); onToast('boss', 'bad'); }

    // auto fire
    S.fireAcc += dt * 1000;
    while (S.fireAcc >= S.w.shotMs) { S.fireAcc -= S.w.shotMs; fireWeapon(); }
    // drones
    for (const dr of S.drones) { dr.ang += dt * 1.6; dr.fireAcc += dt * 1000; if (dr.fireAcc >= 620) { dr.fireAcc = 0; fireDrone(dr); } }
    // beam
    if (S.w.beamOn) { S.beamAcc += dt * 1000; if (S.beamAcc >= S.w.beamEvery) { S.beamAcc = 0; fireBeam(); } }
    // aStor shield recharge
    if (S.w.shieldEvery) { S.shieldAcc += dt * 1000; if (S.shieldAcc >= S.w.shieldEvery) { S.shieldAcc = 0; S.shield = Math.min(S.w.shieldMax, S.shield + 1); } }
    // aStor regen
    if (S.w.regen) S.base = Math.min(S.baseMax, S.base + S.w.regen * dt);

    // enemies
    for (const e of S.enemies) {
      if (e.dead) continue;
      const slowK = e.slow > 0 ? S.w.slowMul : 1; if (e.slow > 0) e.slow -= dt * 1000;
      e.wob += dt * 3;
      const sp = e.spec.speed * d.speedMul * slowK;
      e.y += sp * dt;
      const dx = op.x - e.x; e.x += clamp(dx * 0.6, -36, 36) * dt + Math.cos(e.wob) * 6 * dt;
      e.x = clamp(e.x, e.r, W - e.r);
      e.hit = Math.max(0, e.hit - dt * 4);
      if (e.y + e.r >= baseY) {               // reached the line
        e.dead = true;
        if (e.spec.steals) { S.score = Math.max(0, S.score - STEAL_PENALTY); S.combo = 0; onToast('exfil', 'bad'); S.flash = 0.5; S.flashCol = '255,209,102'; burst(e.x, baseY, e.spec.color, 18); }
        else hitBase(e.spec.dmg, e.spec.boss ? '255,90,106' : null);
      }
    }

    // beam damage (sustained vertical column)
    if (S.beam) {
      const b = S.beam; b.life -= dt * 2.2;
      for (const e of S.enemies) { if (e.dead) continue; if (Math.abs(e.x - b.x) < b.width / 2 + e.r) { hitEnemy(e, b.dmg * dt * 60 / 60 * 1.2, ACCENT.XDR, true); if (Math.random() < 0.4) burst(e.x, e.y, ACCENT.XDR, 3, 60); if (e.hp <= 0) killEnemy(e, true); } }
      if (b.life <= 0) S.beam = null;
    }

    // projectiles
    for (const p of S.shots) {
      if (p.dead) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y < -20 || p.x < -20 || p.x > W + 20) { p.dead = true; continue; }
      for (const e of S.enemies) {
        if (e.dead || p.hit.has(e.id)) continue;
        if (dist2(p.x, p.y, e.x, e.y) <= (e.r + p.r) ** 2) {
          p.hit.add(e.id);
          hitEnemy(e, p.dmg, p.color, false);
          burst(p.x, p.y, p.color, 4, 70);
          if (p.drone) ring(e.x, e.y, ACCENT.MDR, e.r * 1.8, 2);
          if (e.hp <= 0) { killEnemy(e, false); if (e.spec.boss) shock(e.x, e.y, p.color, 180); }
          else if (!p.drone && p.dmg >= 40) shock(p.x, p.y, p.color, 22);   // EDR heavy impact
          if (p.pierce-- <= 0) { p.dead = true; break; }
        }
      }
    }

    // particles / texts / fx
    for (const pt of S.parts) { pt.life -= dt * 1.7; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.94; pt.vy = pt.vy * 0.94 + 40 * dt; }
    for (const tx of S.texts) { tx.life -= dt * 1.3; tx.y += tx.vy * dt; tx.x += tx.vx * dt; tx.vy *= 0.92; }
    for (const f of S.fx) { f.life -= dt * (f.t === 'zap' ? 5 : f.t === 'muzzle' ? 10 : 2.6); if (f.r !== undefined && f.max) f.r += (f.max - f.r) * Math.min(1, dt * 9); }
    S.enemies = S.enemies.filter(e => !e.dead);
    S.shots = S.shots.filter(p => !p.dead);
    S.parts = S.parts.filter(p => p.life > 0);
    S.texts = S.texts.filter(t => t.life > 0);
    S.fx = S.fx.filter(f => f.life > 0);
    S.shake = Math.max(0, S.shake - dt * 2.4); S.flash = Math.max(0, S.flash - dt * 2.2);

    // survival trickle
    S.score += SURVIVE_PER_SEC * dt;

    S.hudAcc += dt; if (S.hudAcc >= 0.1) { S.hudAcc = 0; pushHud(); }
  }

  // ---- render ----
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (S.shake > 0) ctx.translate(rand(-1, 1) * S.shake * 7, rand(-1, 1) * S.shake * 7);
    drawFloor();
    drawCracks();
    // enemies (far -> near by y)
    const order = [...S.enemies].sort((a, b) => a.y - b.y);
    for (const e of order) drawEnemy(e);
    drawFx();
    drawShots();
    if (S.beam) drawBeam(S.beam);
    drawDrones();
    drawOperator();
    drawBarricade();
    drawTexts();
    ctx.restore();
    if (S.flash > 0) { ctx.fillStyle = `rgba(${S.flashCol},${S.flash * 0.3})`; ctx.fillRect(0, 0, W, H); }
    drawVignette();
  }

  function drawFloor() {
    const g = ctx.createLinearGradient(0, 0, 0, baseY);
    g.addColorStop(0, '#0a0d16'); g.addColorStop(0.55, '#141a26'); g.addColorStop(1, '#1d2432');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, baseY);
    // perspective grid — lines closer together far away (top)
    ctx.strokeStyle = 'rgba(120,150,190,.06)'; ctx.lineWidth = 1;
    for (let i = 1; i < 22; i++) { const t = i / 22, y = baseY * (t * t); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const cx = W / 2;
    for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(cx + i * (W / 10), 0); ctx.lineTo(cx + i * (W / 3.2), baseY); ctx.stroke(); }
  }
  function drawCracks() {
    ctx.strokeStyle = 'rgba(0,0,0,.33)'; ctx.lineWidth = 2;
    for (const pts of cracks) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); ctx.stroke(); }
  }
  function drawEnemy(e) {
    const cloaked = e.spec.cloak && (S.levels.NDR || 0) === 0;
    ctx.save();
    ctx.globalAlpha = cloaked ? 0.4 : 1;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.8, e.r * 0.95, e.r * 0.4, 0, 0, TAU); ctx.fill();
    // body
    const g = ctx.createRadialGradient(e.x - e.r * 0.3, e.y - e.r * 0.4, e.r * 0.2, e.x, e.y, e.r);
    g.addColorStop(0, '#fff'); g.addColorStop(0.25, e.spec.color); g.addColorStop(1, shade(e.spec.color, -0.5));
    ctx.fillStyle = g;
    if (e.spec.boss) {
      ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, rr = e.r * (i % 2 ? 0.7 : 1.1); const x = e.x + Math.cos(a) * rr, y = e.y + Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fill();
    } else { ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill(); }
    if (e.hit > 0) { ctx.fillStyle = `rgba(255,255,255,${e.hit * 0.7})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill(); }
    // eye / mark
    ctx.fillStyle = 'rgba(8,10,16,.8)';
    ctx.beginPath(); ctx.arc(e.x - e.r * 0.28, e.y - e.r * 0.1, e.r * 0.16, 0, TAU); ctx.arc(e.x + e.r * 0.28, e.y - e.r * 0.1, e.r * 0.16, 0, TAU); ctx.fill();
    ctx.restore();
    // slowed = frost tint ring
    if (e.slow > 0) { ctx.strokeStyle = 'rgba(120,200,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, TAU); ctx.stroke(); }
    // hp bar
    if (e.hp < e.maxhp) {
      const wd = e.r * 2, hpx = e.x - e.r, hpy = e.y - e.r - 7;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(hpx, hpy, wd, 3.5);
      ctx.fillStyle = e.spec.boss ? '#ff5a6a' : '#2ee6a0'; ctx.fillRect(hpx, hpy, wd * clamp(e.hp / e.maxhp, 0, 1), 3.5);
    }
  }
  function drawShots() {
    for (const p of S.shots) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const ang = Math.atan2(p.vy, p.vx), len = p.fan ? 10 : 16;
      const x2 = p.x - Math.cos(ang) * len, y2 = p.y - Math.sin(ang) * len;
      const g = ctx.createLinearGradient(p.x, p.y, x2, y2); g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = p.r; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.6, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  function drawBeam(b) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const a = Math.max(0, b.life);
    const w = b.width * (0.6 + a * 0.4);
    const g = ctx.createLinearGradient(b.x - w, 0, b.x + w, 0);
    g.addColorStop(0, 'rgba(155,232,90,0)'); g.addColorStop(0.5, `rgba(180,255,120,${0.5 * a})`); g.addColorStop(1, 'rgba(155,232,90,0)');
    ctx.fillStyle = g; ctx.fillRect(b.x - w, 0, w * 2, S.op.y);
    ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`; ctx.fillRect(b.x - w * 0.18, 0, w * 0.36, S.op.y);
    // crackle
    ctx.strokeStyle = `rgba(210,255,170,${a})`; ctx.lineWidth = 2;
    ctx.beginPath(); let yy = 0; ctx.moveTo(b.x, 0); while (yy < S.op.y) { yy += 24; ctx.lineTo(b.x + rand(-w * 0.4, w * 0.4), yy); } ctx.stroke();
    ctx.restore();
  }
  function drawDrones() {
    for (const dr of S.drones) {
      const x = S.op.x + Math.cos(dr.ang) * 46, y = S.op.y - 20 + Math.sin(dr.ang) * 30;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = ACCENT.MDR; ctx.shadowColor = ACCENT.MDR; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x - 6, y + 5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  function drawOperator() {
    const op = S.op, col = dominantColor();
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(op.x, op.y + 16, 18, 6, 0, 0, TAU); ctx.fill();
    // body
    ctx.fillStyle = '#2a3346'; ctx.beginPath(); ctx.roundRect(op.x - 10, op.y - 6, 20, 24, 5); ctx.fill();
    ctx.fillStyle = '#e7c9a0'; ctx.beginPath(); ctx.arc(op.x, op.y - 12, 7, 0, TAU); ctx.fill();   // head
    ctx.fillStyle = '#39507a'; ctx.beginPath(); ctx.roundRect(op.x - 8, op.y - 17, 16, 7, 3); ctx.fill(); // visor
    // weapon barrel toward aim, glowing in dominant product color
    ctx.save(); ctx.translate(op.x, op.y - 10); ctx.rotate(op.aim + Math.PI / 2);
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.roundRect(-3.5, -24, 7, 24, 3); ctx.fill();
    if (op.muzzle > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#fff'; ctx.globalAlpha = op.muzzle; ctx.beginPath(); ctx.arc(0, -26, 7 * op.muzzle, 0, TAU); ctx.fill(); }
    ctx.restore();
    // aStor shield dome
    if (S.shield > 0) { ctx.strokeStyle = `rgba(169,139,255,.7)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(op.x, op.y, 30, Math.PI, TAU); ctx.stroke(); }
  }
  function drawBarricade() {
    const g = ctx.createLinearGradient(0, baseY, 0, H);
    g.addColorStop(0, '#39445a'); g.addColorStop(0.15, '#2a3245'); g.addColorStop(1, '#141924');
    ctx.fillStyle = g; ctx.fillRect(0, baseY, W, barH);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, baseY, W, 2);
    // plates + rivets
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1;
    const plates = Math.ceil(W / 64);
    for (let i = 0; i <= plates; i++) { const x = i * 64; ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x, H); ctx.stroke(); ctx.fillStyle = 'rgba(180,200,230,.25)'; ctx.beginPath(); ctx.arc(x + 10, baseY + 12, 2, 0, TAU); ctx.arc(x + 54, baseY + 12, 2, 0, TAU); ctx.fill(); }
  }
  function drawFx() {
    for (const f of S.fx) {
      const a = Math.max(0, f.life);
      if (f.t === 'ring') { ctx.strokeStyle = hexA(f.color, a); ctx.lineWidth = f.w; ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(0, f.r), 0, TAU); ctx.stroke(); }
      else if (f.t === 'zap') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = hexA(f.color, a); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); const mx = (f.x1 + f.x2) / 2 + rand(-12, 12), my = (f.y1 + f.y2) / 2 + rand(-12, 12); ctx.quadraticCurveTo(mx, my, f.x2, f.y2); ctx.stroke(); ctx.restore(); }
      else if (f.t === 'frost') { ctx.strokeStyle = `rgba(150,210,255,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(0, f.r), 0, TAU); ctx.stroke(); }
      else if (f.t === 'muzzle') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA(f.color, a); ctx.beginPath(); ctx.arc(f.x, f.y, 9 * a, 0, TAU); ctx.fill(); ctx.restore(); }
    }
    for (const pt of S.parts) { ctx.globalAlpha = Math.max(0, pt.life); ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  function drawTexts() {
    ctx.textAlign = 'center';
    for (const t of S.texts) {
      const a = Math.max(0, Math.min(1, t.life * 1.4));
      ctx.font = `800 ${t.big ? 20 : 13}px ui-sans-serif,system-ui`;
      ctx.fillStyle = `rgba(0,0,0,${a * 0.6})`; ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = hexA(t.color, a); ctx.fillText(t.text, t.x, t.y);
    }
    ctx.textAlign = 'start';
  }
  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ---- hud push ----
  function pushHud() {
    onHud({
      base: Math.round(S.base), baseMax: S.baseMax, score: S.score, best: Math.max(S.best, S.score),
      combo: S.combo, mult: comboMult(S.combo), elapsed: Math.floor(S.elapsed), level: S.level,
      xp: S.xp, xpNeed: S.xpNeed, tier: WEAPON_ORDER.reduce((a, id) => a + (S.levels[id] || 0), 0),
      levels: { ...S.levels }, dom: domId(), sensors: S.w.sensors, shield: S.shield, shieldMax: S.w.shieldMax,
    });
  }
  function domId() { let b = null, bl = 0; for (const id of WEAPON_ORDER) { const l = S.levels[id] || 0; if (l > bl) { bl = l; b = id; } } return b; }

  // ---- lifecycle ----
  function frame(ts) {
    const dt = Math.min(0.05, Math.max(0, (ts - lastTS) / 1000 || 0)); lastTS = ts;
    if (S.phase === 'play') update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }
  function gameOver() {
    if (S.phase === 'over') return;
    S.phase = 'over'; S.best = Math.max(S.best, S.score); sfx.over();
    onOver({ score: Math.round(S.score), best: Math.round(S.best), kills: S.kills, elapsed: Math.floor(S.elapsed), maxCombo: S.maxCombo, level: S.level, levels: { ...S.levels } });
  }

  // ---- input ----
  const toLocal = ev => { const r = canvas.getBoundingClientRect(); const p = ev.touches ? ev.touches[0] : ev; return { x: p.clientX - r.left, y: p.clientY - r.top }; };
  function onDown(ev) { if (S?.phase !== 'play') return; ev.preventDefault(); const p = toLocal(ev); drag.on = true; drag.x = clamp(p.x, 40, W - 40); drag.y = clamp(p.y, baseY - 150, baseY - 10); }
  function onMove(ev) { if (!drag.on) return; ev.preventDefault(); const p = toLocal(ev); drag.x = clamp(p.x, 40, W - 40); drag.y = clamp(p.y, baseY - 150, baseY - 10); }
  function onUp() { drag.on = false; }
  const KMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
  function onKey(e, down) { const k = KMAP[e.key]; if (k) { if (down) keys.add(k); else keys.delete(k); e.preventDefault(); } }
  const kd = e => onKey(e, true), ku = e => onKey(e, false);

  function bind() {
    canvas.addEventListener('mousedown', onDown); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false }); canvas.addEventListener('touchmove', onMove, { passive: false }); window.addEventListener('touchend', onUp);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('resize', resize);
  }
  function unbind() {
    canvas.removeEventListener('mousedown', onDown); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
    canvas.removeEventListener('touchstart', onDown); canvas.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp);
    window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize);
  }

  resize(); bind();
  return {
    start(best = 0) { S = fresh(); resize(); S.best = best; S.op.x = W / 2; S.op.y = opHome; S.phase = 'play'; recompute(); lastTS = performance.now(); sfx.start(); pushHud(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
    applyUpgrade,
    pause() { if (S && S.phase === 'play') S.phase = 'paused'; },
    resume() { if (S && S.phase === 'paused') { S.phase = 'play'; lastTS = performance.now(); } },
    stop() { cancelAnimationFrame(raf); raf = 0; if (S) S.phase = 'idle'; },
    destroy() { cancelAnimationFrame(raf); unbind(); },
    resize,
    get phase() { return S ? S.phase : 'idle'; },
    get state() { return S; },
  };

  // ---- small color utils ----
  function shade(hex, amt) {
    const c = hex.replace('#', ''); let r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    r = clamp(Math.round(r + 255 * amt), 0, 255); g = clamp(Math.round(g + 255 * amt), 0, 255); b = clamp(Math.round(b + 255 * amt), 0, 255);
    return `rgb(${r},${g},${b})`;
  }
  function hexA(hex, a) {
    const c = hex.replace('#', ''); const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
  }
}
