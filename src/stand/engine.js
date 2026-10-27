// Last Stand — the machine. A vertical, pseudo-3D base-defense shooter. Threats
// pour straight DOWN; the operator and every deployed Sangfor UNIT fire straight UP
// (no angled shots). Products are visible units that fight the way they really work:
// EDR endpoint turrets beside you, an NGAF barrier that blocks + weakens, MDR
// teammates, an NDR radar that reveals + marks, an IAG checkpoint that slows, an HCI
// compute core that speeds everyone, the XDR correlation beam, an aStor vault.
// Pure numbers live in model.js.

import {
  START_BASE, OPERATOR, TURRET, ALLY, WEAPON_ORDER, SENSORS, deriveSquad, damageTo,
  xpToLevel, upgradeChoices, ENEMIES, threatPool, difficultyAt,
  comboMult, killScore, SURVIVE_PER_SEC, STEAL_PENALTY,
} from './model.js';
import { ICONS } from '../ui/icons.js';
import { PRODUCT_MARKS } from '../ui/product-marks.js';
import { sfx } from '../rush/audio.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

export const ACCENT = {
  EDR: '#ff8a5a', MDR: '#16ca78', AF: '#2ee6a0', NDR: '#58c8ff',
  IAG: '#ffd166', HCI: '#39c0ff', XDR: '#9be85a', ASTOR: '#a98bff',
};
const ICON_KEY = { HCI: 'network', EDR: 'edr', NDR: 'ndr', AF: 'af', IAG: 'iag', XDR: 'xdr', ASTOR: 'astor', MDR: 'mdr' };
const MDR_SLOTS = [-52, 52, -96, 96];             // MDR teammates flank the operator (and move with them)
const BAR_OFFSET = 74;                            // barrier sits this far above the operator
const COLS = 6;                                   // lane column guides

function makeIcon(name, color) {
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

  const icons = {}; for (const id of WEAPON_ORDER) icons[id] = makeIcon(id, '#f4fff9');
  // official Sangfor product artwork (raster) rendered on each deployed unit
  const marks = {};
  for (const id of WEAPON_ORDER) { const m = PRODUCT_MARKS[id]; if (m) { const im = new Image(); im.src = 'assets/brand/products/sangfor-' + m[0]; marks[id] = im; } }
  const brandImg = new Image(); brandImg.src = 'assets/brand/sangfor-logo-white.png';

  // ---- geometry ----
  // the arena is a narrow central LANE (fieldL..fieldR); the sides are framed walls.
  let W = 0, H = 0, dpr = 1, barH = 0, baseY = 0, opHome = 0, bandY = 0, cracks = [];
  let fieldL = 0, fieldR = 0, fieldW = 0, colW = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    barH = Math.max(52, H * 0.09);
    baseY = H - barH;
    opHome = baseY - 30;
    bandY = H * 0.44;
    fieldW = clamp(W * 0.8, 300, 380);              // wider lane (was too narrow)
    fieldL = Math.round((W - fieldW) / 2); fieldR = fieldL + fieldW; colW = fieldW / COLS;
    if (S) { S.op.x = clamp(S.op.x, fieldL + 26, fieldR - 26); S.op.y = clamp(S.op.y, baseY - 150, baseY - 12); }
    buildCracks();
  }
  const opMinX = () => fieldL + 26, opMaxX = () => fieldR - 26;
  function buildCracks() {
    cracks = [];
    for (let i = 0; i < 9; i++) {
      const x = rand(fieldL, fieldR), y = rand(0, baseY), len = rand(50, 150), a = rand(0, TAU);
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
      levels: {}, squad: deriveSquad({}), shooters: [], shield: 0, pendingLevels: 0,
      afHp: 0, afMax: 0, afDown: false, afDownT: 0, radarAng: 0,
      op: { x: W / 2, y: opHome, muzzle: 0 },
      enemies: [], shots: [], parts: [], texts: [], fx: [], beam: null,
      spawnAcc: 0, beamAcc: 0, shieldAcc: 0, lastBoss: -28,
      shake: 0, flash: 0, flashCol: '255,90,106', hudAcc: 0,
    };
  }

  function recompute() {
    S.squad = deriveSquad(S.levels);
    const sq = S.squad;
    // rebuild the firing squad: operator + EDR turrets + MDR allies into flank slots
    const list = [{ kind: 'op', off: 0, yoff: 0, dmg: OPERATOR.dmg, rate: OPERATOR.rate, speed: OPERATOR.bulletSpeed, pierce: OPERATOR.pierce, acc: 0 }];
    // EDR = FIXED turret emplacements along the wall (do NOT move with the operator),
    // spread evenly across the lane so they cover columns.
    const n = sq.edrTurrets;
    for (let i = 0; i < n; i++) list.push({ kind: 'edr', fixed: true, frac: (i + 1) / (n + 1), dmg: sq.edrDmg, rate: TURRET.rate, speed: TURRET.bulletSpeed, pierce: TURRET.pierce, acc: 0 });
    // MDR = teammates that flank the operator and move with them (staggered V)
    for (let i = 0; i < sq.mdrAllies; i++) list.push({ kind: 'mdr', off: MDR_SLOTS[i] ?? 0, yoff: Math.floor(i / 2) * 12, dmg: sq.mdrDmg, rate: ALLY.rate, speed: ALLY.bulletSpeed, pierce: ALLY.pierce, acc: 0 });
    // keep existing accumulators where kinds line up (smooth level-ups)
    if (S.shooters) list.forEach((s, i) => { if (S.shooters[i]) s.acc = S.shooters[i].acc; });
    S.shooters = list;
    // barrier
    if (sq.afTier > 0) { const grew = sq.afHp - S.afMax; S.afMax = sq.afHp; if (grew > 0) S.afHp = Math.min(sq.afHp, S.afHp + grew); if (S.afHp <= 0 && !S.afDown) S.afHp = sq.afHp; }
    else { S.afMax = 0; S.afHp = 0; S.afDown = false; }
  }

  // ---- fx helpers ----
  function burst(x, y, color, n = 12, spread = 180) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 40 + Math.random() * spread; S.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color, r: 1.4 + Math.random() * 3 }); }
  }
  const ring = (x, y, color, max, w = 3) => S.fx.push({ t: 'ring', x, y, color, r: 5, max, w, life: 1 });
  const shock = (x, y, color, max) => S.fx.push({ t: 'ring', x, y, color, r: 5, max, w: 5, life: 1 });
  const zap = (x1, y1, x2, y2, color) => S.fx.push({ t: 'zap', x1, y1, x2, y2, color, life: 1 });
  function dmgText(x, y, n, color, big) { S.texts.push({ x, y, text: fmtNum(n), color, life: 1, big: !!big, vy: -32 - Math.random() * 20, vx: rand(-14, 14) }); }

  // ---- enemies ----
  function spawnEnemy(type) {
    const d = difficultyAt(S.elapsed), spec = ENEMIES[type];
    const hp = Math.round(spec.hp * (spec.boss ? 1 : d.hpMul));
    S.enemies.push({ id: nextId++, type, spec, x: rand(fieldL + spec.r + 4, fieldR - spec.r - 4), y: -spec.r - rand(2, 40), r: spec.r, hp, maxhp: hp, slow: 0, hit: 0, wob: Math.random() * TAU, marked: false, afWeakened: false });
  }
  function killEnemy(e, viaBeam) {
    e.dead = true;
    S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
    S.score += killScore(e.type, comboMult(S.combo)); S.kills++;
    gainXp(e.spec.xp);
    burst(e.x, e.y, e.spec.color, e.spec.boss ? 40 : 12, e.spec.boss ? 300 : 170);
    ring(e.x, e.y, e.spec.color, e.r * (e.spec.boss ? 5 : 2.2));
    if (e.spec.boss) { S.shake = 1; S.flash = 0.8; S.flashCol = '255,90,106'; sfx.boss(); }
    else if (!viaBeam) sfx.hit(S.combo);
    if (e.spec.splits) for (let i = 0; i < e.spec.splits; i++) { const r2 = ENEMIES.recon; S.enemies.push({ id: nextId++, type: 'recon', spec: r2, x: e.x + rand(-14, 14), y: e.y, r: r2.r, hp: r2.hp, maxhp: r2.hp, slow: 0, hit: 0, wob: Math.random() * TAU, marked: false, afWeakened: false }); }
  }
  function hitEnemy(e, raw, color, big) {
    const dealt = damageTo(e, S.squad, raw);
    e.hp -= dealt; e.hit = 1;
    dmgText(e.x, e.y - e.r, dealt, color || '#fff', big);
  }

  // ---- firing (STRAIGHT UP only) ----
  function unitX(sh) { return sh.fixed ? fieldL + fieldW * sh.frac : clamp(S.op.x + (sh.off || 0), fieldL + 16, fieldR - 16); }
  function unitY(sh) { return sh.fixed ? baseY - 26 : S.op.y + (sh.yoff || 0); }
  function fireUp(x, y, dmg, speed, pierce, color) {
    S.shots.push({ x, y, vx: 0, vy: -speed, dmg, pierce, hit: new Set(), r: 4.5, color });
  }
  function fireBeam() {
    const sq = S.squad; if (!sq.beamOn) return;
    S.beam = { x: S.op.x, life: 1, width: sq.beamWidth, dmg: sq.beamDmg };
    S.flash = 0.7; S.flashCol = '155,232,90'; S.shake = Math.min(1, 0.4 + sq.sensors * 0.07);
    // lightning from the beam to each sensor unit feeding it
    for (const sh of S.shooters) if (sh.kind === 'edr') zap(S.op.x, S.op.y - 16, unitX(sh), S.op.y - 6, ACCENT.EDR);
    sfx.ability();
    if (sq.xdrIdle) onToast('xdrIdle', 'bad');
  }
  function dominant() { let b = null, bl = 0; for (const id of WEAPON_ORDER) { const l = S.levels[id] || 0; if (l > bl) { bl = l; b = id; } } return b; }

  // ---- xp / level ----
  function gainXp(n) {
    S.xp += n;
    while (S.xp >= S.xpNeed) { S.xp -= S.xpNeed; S.level++; S.xpNeed = xpToLevel(S.level); S.pendingLevels++; }
    if (S.pendingLevels > 0 && S.phase === 'play') openLevelUp();
  }
  function openLevelUp() {
    const choices = upgradeChoices(S.levels);
    if (!choices.length) { S.pendingLevels = 0; return; }
    S.phase = 'levelup'; S.op.muzzle = 0; onLevelUp(choices, S.level); sfx.start();
  }
  function applyUpgrade(id) {
    S.levels[id] = Math.min((S.levels[id] || 0) + 1, 99);
    recompute();
    ring(S.op.x, S.op.y, ACCENT[id] || '#72bb38', 90, 5); burst(S.op.x, S.op.y - 16, ACCENT[id] || '#72bb38', 18, 150);
    S.pendingLevels--;
    if (S.pendingLevels > 0) openLevelUp(); else { S.phase = 'play'; lastTS = performance.now(); }
  }

  // ---- base damage ----
  function hitBase(amount, color) {
    if (S.shield > 0) { S.shield--; S.flash = 0.6; S.flashCol = '169,139,255'; ring(S.op.x, baseY - 2, ACCENT.ASTOR, 120, 6); onToast('absorb', 'good'); sfx.ability(); return; }
    S.base = Math.max(0, S.base - amount);
    S.combo = 0; S.shake = Math.min(1, 0.5 + amount / 350); S.flash = 0.7; S.flashCol = color || '255,90,106'; sfx.breach();
    if (S.base <= 0) gameOver();
  }

  // ---- loop ----
  function update(dt) {
    S.elapsed += dt;
    const d = difficultyAt(S.elapsed), sq = S.squad, op = S.op;

    // movement
    const mv = 380 * dt;
    if (keys.has('left')) op.x -= mv; if (keys.has('right')) op.x += mv;
    if (keys.has('up')) op.y -= mv; if (keys.has('down')) op.y += mv;
    if (drag.on) { op.x += (drag.x - op.x) * Math.min(1, dt * 16); op.y += (drag.y - op.y) * Math.min(1, dt * 16); }
    op.x = clamp(op.x, opMinX(), opMaxX()); op.y = clamp(op.y, baseY - 150, baseY - 12);
    op.muzzle = Math.max(0, op.muzzle - dt * 6);

    // spawns (batches = more monsters)
    S.spawnAcc += dt * 1000;
    if (S.spawnAcc >= d.spawnGap) { S.spawnAcc = 0; const pool = threatPool(S.elapsed); for (let i = 0; i < d.batch; i++) spawnEnemy(pool[Math.floor(Math.random() * pool.length)]); }
    if (S.elapsed - S.lastBoss > d.bossEvery) { S.lastBoss = S.elapsed; spawnEnemy('ransom'); onToast('boss', 'bad'); }

    // firing — every unit straight up
    for (const sh of S.shooters) {
      sh.acc += dt * 1000; const interval = 1000 / (sh.rate * sq.fireRateMul);
      while (sh.acc >= interval) { sh.acc -= interval; const x = unitX(sh), uy = unitY(sh); fireUp(x, uy - 16, sh.dmg, sh.speed, sh.pierce, sh.kind === 'op' ? dominantColor() : ACCENT[sh.kind === 'edr' ? 'EDR' : 'MDR']); if (sh.kind === 'op') op.muzzle = 1; sh.muzzle = 1; S.fx.push({ t: 'muzzle', x, y: uy - 18, color: ACCENT[sh.kind === 'edr' ? 'EDR' : sh.kind === 'mdr' ? 'MDR' : 'HCI'], life: 1 }); }
      if (sh.muzzle) sh.muzzle = Math.max(0, sh.muzzle - dt * 6);
    }
    // XDR beam
    if (sq.beamOn) { S.beamAcc += dt * 1000; if (S.beamAcc >= sq.beamEvery) { S.beamAcc = 0; fireBeam(); } }
    // aStor shield + regen
    if (sq.shieldEvery) { S.shieldAcc += dt * 1000; if (S.shieldAcc >= sq.shieldEvery) { S.shieldAcc = 0; S.shield = Math.min(sq.shieldMax, S.shield + 1); } }
    if (sq.regen) S.base = Math.min(S.baseMax, S.base + sq.regen * dt);

    // NGAF barrier state
    const barY = op.y - BAR_OFFSET, halfW = sq.afHalfWidth;
    if (sq.afTier > 0) {
      if (S.afDown) { S.afDownT -= dt; if (S.afDownT <= 0) { S.afDown = false; S.afHp = S.afMax * 0.5; } }
      else { S.afHp = Math.min(S.afMax, S.afHp + S.afMax * 0.08 * dt); }   // slow regen
    }
    const barActive = sq.afTier > 0 && !S.afDown;
    const afChip = 9 + sq.afTier * 5;

    // enemies
    for (const e of S.enemies) {
      if (e.dead) continue;
      if (sq.ndrReveal) e.marked = true;                        // network visibility marks everyone
      let slowK = e.slow > 0 ? 0.5 : 1; if (e.slow > 0) e.slow -= dt * 1000;
      if (sq.iagBand && e.y > bandY - 24 && e.y < bandY + 24) slowK *= sq.iagSlowMul;   // IAG checkpoint
      e.wob += dt * 3;
      const sp = e.spec.speed * d.speedMul * slowK;
      const nextY = e.y + sp * dt;
      const dx = op.x - e.x; e.x = clamp(e.x + clamp(dx * 0.15, -18, 18) * dt + Math.cos(e.wob) * 6 * dt, fieldL + e.r, fieldR - e.r);
      e.hit = Math.max(0, e.hit - dt * 4);
      // barrier interaction
      const underBar = Math.abs(e.x - op.x) <= halfW + e.r;
      if (barActive && underBar && nextY + e.r >= barY && e.y + e.r < barY + 4) {
        e.y = barY - e.r; e.held = true;
        S.afHp -= e.spec.dmg * dt * 0.7; e.hp -= afChip * dt;
        if (Math.random() < dt * 6) burst(e.x, barY, ACCENT.AF, 2, 50);
        if (S.afHp <= 0) { S.afDown = true; S.afDownT = 3.2 + sq.afTier * 0.3; ring(op.x, barY, ACCENT.AF, halfW * 2, 6); onToast('afDown', 'bad'); }
        if (e.hp <= 0) killEnemy(e, false);
        continue;
      }
      e.held = false;
      // weaken breachers that cross a downed barrier
      if (sq.afTier > 0 && underBar && !e.afWeakened && e.y + e.r < barY && nextY + e.r >= barY) { e.hp *= (1 - sq.afWeaken); e.slow = 1400; e.afWeakened = true; burst(e.x, barY, ACCENT.AF, 6, 90); dmgText(e.x, barY, (e.maxhp * sq.afWeaken), ACCENT.AF, false); }
      e.y = nextY;
      if (e.y + e.r >= baseY) {
        e.dead = true;
        if (e.spec.steals) { S.score = Math.max(0, S.score - STEAL_PENALTY); S.combo = 0; onToast('exfil', 'bad'); S.flash = 0.5; S.flashCol = '255,209,102'; burst(e.x, baseY, e.spec.color, 18); }
        else hitBase(e.spec.dmg, e.spec.boss ? '255,90,106' : null);
      }
    }

    // beam damage
    if (S.beam) {
      const b = S.beam; b.life -= dt * 2.2;
      for (const e of S.enemies) { if (e.dead) continue; if (Math.abs(e.x - b.x) < b.width / 2 + e.r) { hitEnemy(e, b.dmg * dt * 1.2, ACCENT.XDR, true); if (Math.random() < 0.4) burst(e.x, e.y, ACCENT.XDR, 3, 60); if (e.hp <= 0) killEnemy(e, true); } }
      if (b.life <= 0) S.beam = null;
    }

    // projectiles (vertical)
    for (const p of S.shots) {
      if (p.dead) continue;
      p.y += p.vy * dt;
      if (p.y < -20) { p.dead = true; continue; }
      for (const e of S.enemies) {
        if (e.dead || p.hit.has(e.id)) continue;
        if (dist2(p.x, p.y, e.x, e.y) <= (e.r + p.r) ** 2) {
          p.hit.add(e.id); hitEnemy(e, p.dmg, p.color, false); burst(p.x, p.y, p.color, 4, 70);
          if (e.hp <= 0) { killEnemy(e, false); if (e.spec.boss) shock(e.x, e.y, p.color, 180); }
          else if (p.dmg >= 36) shock(p.x, p.y, p.color, 20);
          if (p.pierce-- <= 0) { p.dead = true; break; }
        }
      }
    }

    // integrators
    for (const pt of S.parts) { pt.life -= dt * 1.7; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.94; pt.vy = pt.vy * 0.94 + 40 * dt; }
    for (const tx of S.texts) { tx.life -= dt * 1.3; tx.y += tx.vy * dt; tx.x += tx.vx * dt; tx.vy *= 0.92; }
    for (const f of S.fx) { f.life -= dt * (f.t === 'zap' ? 5 : f.t === 'muzzle' ? 10 : 2.6); if (f.r !== undefined && f.max) f.r += (f.max - f.r) * Math.min(1, dt * 9); }
    S.radarAng += dt * 2.4;
    S.enemies = S.enemies.filter(e => !e.dead); S.shots = S.shots.filter(p => !p.dead);
    S.parts = S.parts.filter(p => p.life > 0); S.texts = S.texts.filter(t => t.life > 0); S.fx = S.fx.filter(f => f.life > 0);
    S.shake = Math.max(0, S.shake - dt * 2.4); S.flash = Math.max(0, S.flash - dt * 2.2);
    S.score += SURVIVE_PER_SEC * dt;
    S.hudAcc += dt; if (S.hudAcc >= 0.1) { S.hudAcc = 0; pushHud(); }
  }

  function dominantColor() { const id = dominant(); return id ? (ACCENT[id] || '#9be85a') : '#9be85a'; }

  // ---- render ----
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (S.shake > 0) ctx.translate(rand(-1, 1) * S.shake * 7, rand(-1, 1) * S.shake * 7);
    drawFloor(); drawCracks();
    if (S.squad.iagBand) drawBand();
    const order = [...S.enemies].sort((a, b) => a.y - b.y);
    for (const e of order) drawEnemy(e);
    drawFx(); drawShots();
    if (S.beam) drawBeam(S.beam);
    if (S.squad.afTier > 0) drawBarrier();
    drawSquad();
    drawBarricade(); drawTexts();
    ctx.restore();
    if (S.flash > 0) { ctx.fillStyle = `rgba(${S.flashCol},${S.flash * 0.3})`; ctx.fillRect(0, 0, W, H); }
    drawVignette();
    drawHudBands();
  }

  // dark shelves so the HTML HUD reads cleanly over the incoming action
  function drawHudBands() {
    const tg = ctx.createLinearGradient(0, 0, 0, 58);
    tg.addColorStop(0, 'rgba(5,8,14,.82)'); tg.addColorStop(0.7, 'rgba(5,8,14,.35)'); tg.addColorStop(1, 'rgba(5,8,14,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, 58);
  }

  function drawFloor() {
    // framed side walls (so the lane reads as a contained arena, not a wide floor)
    const wall = ctx.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, '#070a12'); wall.addColorStop(1, '#03050a');
    ctx.fillStyle = wall; ctx.fillRect(0, 0, fieldL, H); ctx.fillRect(fieldR, 0, W - fieldR, H);
    // the lane floor
    const g = ctx.createLinearGradient(0, 0, 0, baseY);
    g.addColorStop(0, '#0a0d16'); g.addColorStop(0.55, '#141a26'); g.addColorStop(1, '#1d2432');
    ctx.fillStyle = g; ctx.fillRect(fieldL, 0, fieldW, baseY);
    // horizontal depth rows
    ctx.strokeStyle = 'rgba(120,150,190,.07)'; ctx.lineWidth = 1;
    for (let i = 1; i < 22; i++) { const t = i / 22, y = baseY * (t * t); ctx.beginPath(); ctx.moveTo(fieldL, y); ctx.lineTo(fieldR, y); ctx.stroke(); }
    // the five column guides
    ctx.strokeStyle = 'rgba(120,150,190,.09)';
    for (let i = 1; i < COLS; i++) { const x = fieldL + colW * i; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, baseY); ctx.stroke(); }
    // glowing lane edges
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(114,187,56,.45)'; ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(114,187,56,.55)'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(fieldL + 0.5, 0); ctx.lineTo(fieldL + 0.5, H); ctx.moveTo(fieldR - 0.5, 0); ctx.lineTo(fieldR - 0.5, H); ctx.stroke();
    ctx.restore();
  }
  function drawCracks() { ctx.strokeStyle = 'rgba(0,0,0,.33)'; ctx.lineWidth = 2; for (const pts of cracks) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); ctx.stroke(); } }
  function drawBand() {
    const sq = S.squad; ctx.save();
    const g = ctx.createLinearGradient(0, bandY - 22, 0, bandY + 22);
    g.addColorStop(0, 'rgba(255,209,102,0)'); g.addColorStop(0.5, `rgba(255,200,90,${0.12 + 0.03 * 0})`); g.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = g; ctx.fillRect(fieldL, bandY - 22, fieldW, 44);
    ctx.strokeStyle = 'rgba(255,209,102,.5)'; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -(S.elapsed * 40) % 24; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(fieldL, bandY); ctx.lineTo(fieldR, bandY); ctx.stroke(); ctx.setLineDash([]);
    drawMark(fieldL + 15, bandY, 'IAG', 18); label(fieldL + 28, bandY - 15, 'IAG EGRESS', ACCENT.IAG, false);
    ctx.restore();
  }
  function drawEnemy(e) {
    const cloaked = e.spec.cloak && !S.squad.ndrReveal;
    const r = e.r, col = e.spec.color, boss = e.spec.boss, spin = e.wob;
    ctx.save(); ctx.globalAlpha = cloaked ? 0.34 : 1;
    shadowEllipse(e.x, e.y + r * 0.85, r * 0.95, r * 0.4);
    // spiked shell for the aggressive strains
    if (e.type === 'malware' || e.type === 'worm' || boss) {
      const n = boss ? 11 : 7;
      ctx.fillStyle = shade(col, -0.3); ctx.beginPath();
      for (let i = 0; i < n * 2; i++) { const a = spin * 0.6 + i / (n * 2) * TAU, rr = (i % 2 ? r * 0.92 : r * 1.42); const px = e.x + Math.cos(a) * rr, py = e.y + Math.sin(a) * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.fill();
    }
    // glossy 3D body
    sphere(e.x, e.y, r, col);
    ctx.strokeStyle = tintA(col, 0.5, cloaked ? 0.4 : 0.85); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(0, r - 0.6), 0, TAU); ctx.stroke();
    // pulsing threat core
    const pulse = 0.55 + 0.45 * Math.sin(S.elapsed * 6 + e.wob);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hexA('#ffffff', 0.28 * pulse); ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(0, r * 0.36), 0, TAU); ctx.fill();
    ctx.fillStyle = tintA(col, 0.6, 0.6 * pulse); ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(0, r * 0.2), 0, TAU); ctx.fill();
    ctx.restore();
    // type signatures (not cartoon faces)
    if (e.type === 'recon') { ctx.strokeStyle = tintA(col, 0.6, 0.9); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(e.x, e.y - r); ctx.lineTo(e.x, e.y - r - 5); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e.x, e.y - r - 5, 1.6, 0, TAU); ctx.fill(); }
    if (e.type === 'exfil') { ctx.fillStyle = 'rgba(8,12,20,.8)'; roundRect(e.x - r * 0.34, e.y - r * 0.26, r * 0.68, r * 0.52, 2); ctx.fill(); ctx.strokeStyle = tintA(col, 0.7, 0.95); ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { const yy = e.y - r * 0.12 + i * r * 0.18; ctx.beginPath(); ctx.moveTo(e.x - r * 0.2, yy); ctx.lineTo(e.x + r * 0.2, yy); ctx.stroke(); } }
    if (boss) { ctx.fillStyle = '#ffd166'; ctx.save(); ctx.shadowColor = '#ffba45'; ctx.shadowBlur = 8; ctx.beginPath(); for (let i = 0; i < 3; i++) { const bx = e.x + (i - 1) * r * 0.5; ctx.moveTo(bx - r * 0.16, e.y - r * 0.78); ctx.lineTo(bx, e.y - r * 1.05); ctx.lineTo(bx + r * 0.16, e.y - r * 0.78); } ctx.closePath(); ctx.fill(); ctx.restore(); }
    if (e.hit > 0) { ctx.fillStyle = `rgba(255,255,255,${e.hit * 0.7})`; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (e.marked && !cloaked) { ctx.strokeStyle = 'rgba(88,200,255,.9)'; ctx.lineWidth = 1.5; const m = r + 4; ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + Math.PI / 4; ctx.moveTo(e.x + Math.cos(a) * m, e.y + Math.sin(a) * m); ctx.lineTo(e.x + Math.cos(a) * (m + 4), e.y + Math.sin(a) * (m + 4)); } ctx.stroke(); }
    if (e.slow > 0) { ctx.strokeStyle = 'rgba(255,209,102,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(0, e.r + 3), 0, TAU); ctx.stroke(); }
    if (e.hp < e.maxhp) { const wd = e.r * 2, hpx = e.x - e.r, hpy = e.y - e.r - 7; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(hpx, hpy, wd, 3.5); ctx.fillStyle = e.spec.boss ? '#ff5a6a' : '#2ee6a0'; ctx.fillRect(hpx, hpy, wd * clamp(e.hp / e.maxhp, 0, 1), 3.5); }
  }
  function drawShots() {
    for (const p of S.shots) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + 18); g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = p.r; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + 18); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, p.r * 0.6), 0, TAU); ctx.fill(); ctx.restore();
    }
  }
  function drawBeam(b) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const a = Math.max(0, b.life), w = b.width * (0.6 + a * 0.4);
    const g = ctx.createLinearGradient(b.x - w, 0, b.x + w, 0);
    g.addColorStop(0, 'rgba(155,232,90,0)'); g.addColorStop(0.5, `rgba(180,255,120,${0.5 * a})`); g.addColorStop(1, 'rgba(155,232,90,0)');
    ctx.fillStyle = g; ctx.fillRect(b.x - w, 0, w * 2, S.op.y);
    ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`; ctx.fillRect(b.x - w * 0.18, 0, w * 0.36, S.op.y);
    ctx.strokeStyle = `rgba(210,255,170,${a})`; ctx.lineWidth = 2; ctx.beginPath(); let yy = 0; ctx.moveTo(b.x, 0); while (yy < S.op.y) { yy += 24; ctx.lineTo(b.x + rand(-w * 0.4, w * 0.4), yy); } ctx.stroke(); ctx.restore();
  }
  // NGAF = a 3D energy barrier: emitter posts + a panelled force field whose
  // opacity tracks its HP, with the official NGFW mark on the emitters.
  function drawBarrier() {
    const op = S.op, sq = S.squad, barY = op.y - BAR_OFFSET, halfW = sq.afHalfWidth, col = ACCENT.AF;
    const frac = S.afMax ? clamp(S.afHp / S.afMax, 0, 1) : 0;
    const L = op.x - halfW, R = op.x + halfW, down = S.afDown;
    ctx.save();
    // field
    ctx.save();
    ctx.globalAlpha = down ? 0.22 + 0.14 * Math.sin(S.elapsed * 20) : 0.35 + frac * 0.4;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, barY - 14, 0, barY + 14);
    g.addColorStop(0, 'rgba(120,255,200,0)'); g.addColorStop(0.5, col); g.addColorStop(1, 'rgba(20,150,110,0)');
    ctx.fillStyle = g; ctx.fillRect(L, barY - 14, halfW * 2, 28);
    // hex-ish panel seams
    ctx.strokeStyle = `rgba(190,255,225,${down ? 0.25 : 0.5})`; ctx.lineWidth = 1;
    for (let x = L + 6; x < R; x += 18) { ctx.beginPath(); ctx.moveTo(x, barY - 12); ctx.lineTo(x + 9, barY); ctx.lineTo(x, barY + 12); ctx.stroke(); }
    ctx.restore();
    // bright top/bottom rails
    ctx.strokeStyle = `rgba(90,255,190,${0.6 + frac * 0.4})`; ctx.lineWidth = 2; ctx.shadowColor = col; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(L, barY - 13); ctx.lineTo(R, barY - 13); ctx.moveTo(L, barY + 13); ctx.lineTo(R, barY + 13); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    // emitter posts at each end (3D) + marks
    for (const ex of [L, R]) { ctx.save(); shadowEllipse(ex, barY + 18, 8, 3); cyl(ex, barY - 12, 11, 26, '#1d4a38'); ctx.restore(); drawMark(ex, barY - 18, 'AF', 16); }
    label(op.x, barY - 24, 'NGAF BARRIER', col, true);
  }
  function drawSquad() {
    const op = S.op;
    // HCI compute core behind the operator, with power lines feeding every unit
    if ((S.levels.HCI || 0) > 0) {
      const cx = op.x, cy = op.y + 20;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.55 + 0.45 * Math.sin(S.elapsed * 5);
      ctx.strokeStyle = `rgba(57,192,255,${0.45 * pulse})`; ctx.lineWidth = 2;
      for (const sh of S.shooters) { if (sh.kind === 'op') continue; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(unitX(sh), unitY(sh) - 6); ctx.stroke(); }
      ctx.restore();
      drawCore(cx, cy, pulse);
    }
    // NDR radar unit (fixed, lower corner) if owned
    if ((S.levels.NDR || 0) > 0) drawRadar(clamp(fieldR - 34, fieldL + 30, fieldR - 30), baseY - 30);
    // render order: fixed turrets + MDR allies, back-to-front; operator last
    const units = S.shooters.filter(s => s.kind === 'edr' || s.kind === 'mdr').sort((a, b) => unitY(a) - unitY(b));
    for (const sh of units) {
      const x = unitX(sh), y = unitY(sh);
      if (sh.kind === 'edr') drawTurret(x, y, sh.muzzle || 0);
      else drawAlly(x, y, sh.muzzle || 0);
    }
    drawOperator();
  }
  function drawCore(x, y, pulse) {
    ctx.save();
    shadowEllipse(x, y + 8, 16, 5);
    cyl(x, y - 6, 26, 12, '#1b3a52');
    // glowing coils
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(57,192,255,${0.5 + 0.5 * pulse})`; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y - 6 + i * 4, 11 - i, 3.4, 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
    drawMark(x, y - 20, 'HCI', 22);
    ctx.restore();
  }
  // EDR = a fixed 3D turret emplacement with the official EPP mark on its dome
  function drawTurret(x, y, flash) {
    const col = ACCENT.EDR;
    ctx.save();
    shadowEllipse(x, y + 15, 17, 6);
    // armoured base ring + pedestal
    ctx.fillStyle = '#4b5873'; ctx.beginPath(); ctx.ellipse(x, y + 12, 16, 6, 0, 0, TAU); ctx.fill();
    cyl(x, y - 2, 24, 15, '#2f3a52');
    // rotating housing (sphere) tinted EDR
    sphere(x, y - 6, 13, col);
    // twin barrels up
    for (const dx of [-5, 5]) { ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 8; const bg = ctx.createLinearGradient(x + dx - 3, 0, x + dx + 3, 0); bg.addColorStop(0, shade(col, -0.2)); bg.addColorStop(.5, '#fff'); bg.addColorStop(1, shade(col, -0.2)); ctx.fillStyle = bg; roundRect(x + dx - 2.6, y - 28, 5.2, 24, 2.5); ctx.fill(); ctx.restore(); }
    if (flash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = flash; ctx.fillStyle = '#fff'; for (const dx of [-5, 5]) { ctx.beginPath(); ctx.arc(x + dx, y - 28, Math.max(0, 5 * flash), 0, TAU); ctx.fill(); } ctx.restore(); }
    ctx.restore();
    drawMark(x, y - 7, 'EDR', 19);
  }
  // MDR = a 3D teammate operator that moves with you
  function drawAlly(x, y, flash) {
    const col = ACCENT.MDR;
    ctx.save();
    shadowEllipse(x, y + 16, 14, 5);
    // body armour (shaded)
    const bg = ctx.createLinearGradient(x - 10, 0, x + 10, 0); bg.addColorStop(0, '#15402f'); bg.addColorStop(.5, '#2b6b4e'); bg.addColorStop(1, '#123726');
    ctx.fillStyle = bg; roundRect(x - 9, y - 6, 18, 23, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)'; roundRect(x - 7, y - 5, 6, 20, 4); ctx.fill();
    // shoulders
    ctx.fillStyle = shade(col, -0.2); ctx.beginPath(); ctx.ellipse(x - 9, y - 4, 4, 6, 0, 0, TAU); ctx.ellipse(x + 9, y - 4, 4, 6, 0, 0, TAU); ctx.fill();
    // head + visor
    sphere(x, y - 13, 7, '#e7c9a0');
    ctx.fillStyle = col; ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 7; roundRect(x - 6, y - 16, 12, 5, 2.5); ctx.fill(); ctx.restore();
    // rifle up
    ctx.fillStyle = '#20313f'; roundRect(x + 5, y - 26, 5, 22, 2); ctx.fill();
    ctx.fillStyle = col; ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 6; roundRect(x + 5.5, y - 26, 4, 5, 1.5); ctx.fill(); ctx.restore();
    if (flash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = flash; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 7.5, y - 27, Math.max(0, 5 * flash), 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.restore();
    drawMark(x - 13, y - 12, 'MDR', 16);
  }
  // NDR = a 3D radar emplacement with a sweeping dish
  function drawRadar(x, y) {
    const col = ACCENT.NDR;
    ctx.save();
    shadowEllipse(x, y + 13, 14, 5);
    cyl(x, y + 2, 16, 11, '#223246');
    // tilted dish
    ctx.save(); ctx.translate(x, y - 6); ctx.transform(1, 0, -0.35, 0.72, 0, 0);
    const dg = ctx.createRadialGradient(-2, -3, 1, 0, 0, 12); dg.addColorStop(0, shade(col, 0.4)); dg.addColorStop(1, '#13364d');
    ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(88,200,255,.5)'; ctx.lineWidth = 1; for (let rr = 4; rr <= 11; rr += 3.5) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke(); }
    ctx.restore();
    // sweep beam
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + Math.cos(S.radarAng) * 11, y - 6 + Math.sin(S.radarAng) * 7); ctx.stroke(); ctx.restore();
    ctx.restore();
    drawMark(x, y - 22, 'NDR', 17);
  }
  // the operator: a 3D hero gunner with the dominant product mark on the chest
  function drawOperator() {
    const op = S.op, dom = dominant(), col = dominantColor();
    ctx.save();
    shadowEllipse(op.x, op.y + 17, 18, 6);
    // legs
    ctx.fillStyle = '#20283a'; roundRect(op.x - 8, op.y + 6, 7, 12, 3); roundRect(op.x + 1, op.y + 6, 7, 12, 3); ctx.fill();
    // torso armour
    const bg = ctx.createLinearGradient(op.x - 12, 0, op.x + 12, 0); bg.addColorStop(0, '#263450'); bg.addColorStop(.5, '#3f5578'); bg.addColorStop(1, '#1c2740');
    ctx.fillStyle = bg; roundRect(op.x - 11, op.y - 7, 22, 24, 7); ctx.fill();
    // chest glow line + brand accent
    ctx.fillStyle = `rgba(${hexRGB(col)},.9)`; ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 8; roundRect(op.x - 7, op.y - 2, 14, 2.5, 1); ctx.fill(); ctx.restore();
    // shoulders
    ctx.fillStyle = '#2b3a58'; ctx.beginPath(); ctx.ellipse(op.x - 11, op.y - 5, 4.5, 7, 0, 0, TAU); ctx.ellipse(op.x + 11, op.y - 5, 4.5, 7, 0, 0, TAU); ctx.fill();
    // head + helmet + visor
    sphere(op.x, op.y - 14, 7.5, '#dcc39a');
    ctx.fillStyle = '#2c3d5e'; ctx.beginPath(); ctx.arc(op.x, op.y - 16, 8, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 8; roundRect(op.x - 7, op.y - 15, 14, 4.5, 2); ctx.fill(); ctx.restore();
    // weapon up (gradient barrel)
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 12; const wg = ctx.createLinearGradient(op.x - 4, 0, op.x + 4, 0); wg.addColorStop(0, shade(col, -0.2)); wg.addColorStop(.5, '#fff'); wg.addColorStop(1, shade(col, -0.2)); ctx.fillStyle = wg; roundRect(op.x - 3.5, op.y - 36, 7, 26, 3); ctx.fill();
    if (op.muzzle > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#fff'; ctx.globalAlpha = op.muzzle; ctx.beginPath(); ctx.arc(op.x, op.y - 38, Math.max(0, 8 * op.muzzle), 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.restore();
    if (dom) drawMark(op.x, op.y + 6, dom, 15);
    if (S.shield > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(169,139,255,.8)'; ctx.lineWidth = 2.5; ctx.shadowColor = ACCENT.ASTOR; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(op.x, op.y - 4, 28, Math.PI * 0.85, Math.PI * 2.15); ctx.stroke(); ctx.restore(); drawMark(op.x, op.y - 46, 'ASTOR', 15); }
  }
  function drawBarricade() {
    const g = ctx.createLinearGradient(0, baseY, 0, H);
    g.addColorStop(0, '#39445a'); g.addColorStop(0.15, '#2a3245'); g.addColorStop(1, '#141924');
    ctx.fillStyle = g; ctx.fillRect(fieldL, baseY, fieldW, barH);
    // beveled top lip
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(fieldL, baseY, fieldW, 2);
    ctx.fillStyle = 'rgba(114,187,56,.55)'; ctx.fillRect(fieldL, baseY + 2, fieldW, 1.5);
    // armour plates with rivets
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1;
    for (let x = fieldL; x <= fieldR; x += 46) { ctx.beginPath(); ctx.moveTo(x, baseY + 4); ctx.lineTo(x, H); ctx.stroke(); ctx.fillStyle = 'rgba(180,200,230,.3)'; ctx.beginPath(); ctx.arc(x + 8, baseY + 13, 1.8, 0, TAU); ctx.fill(); }
    // the SANGFOR corporate logo on the base you are defending
    if (brandImg.complete && brandImg.naturalWidth > 0) {
      const lw = Math.min(fieldW * 0.42, 150), lh = lw * (brandImg.naturalHeight / brandImg.naturalWidth);
      ctx.save(); ctx.globalAlpha = 0.9; ctx.drawImage(brandImg, fieldL + fieldW / 2 - lw / 2, baseY + barH / 2 - lh / 2, lw, lh); ctx.restore();
    }
  }
  function drawFx() {
    for (const f of S.fx) {
      const a = Math.max(0, f.life);
      if (f.t === 'ring') { ctx.strokeStyle = hexA(f.color, a); ctx.lineWidth = f.w; ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(0, f.r), 0, TAU); ctx.stroke(); }
      else if (f.t === 'zap') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = hexA(f.color, a); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); const mx = (f.x1 + f.x2) / 2 + rand(-12, 12), my = (f.y1 + f.y2) / 2 + rand(-12, 12); ctx.quadraticCurveTo(mx, my, f.x2, f.y2); ctx.stroke(); ctx.restore(); }
      else if (f.t === 'muzzle') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA(f.color, a); ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(0, 7 * a), 0, TAU); ctx.fill(); ctx.restore(); }
    }
    for (const pt of S.parts) { ctx.globalAlpha = Math.max(0, pt.life); ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, Math.max(0, pt.r), 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  function drawTexts() {
    ctx.textAlign = 'center';
    for (const t of S.texts) { const a = Math.max(0, Math.min(1, t.life * 1.4)); ctx.font = `800 ${t.big ? 20 : 13}px ui-sans-serif,system-ui`; ctx.fillStyle = `rgba(0,0,0,${a * 0.6})`; ctx.fillText(t.text, t.x + 1, t.y + 1); ctx.fillStyle = hexA(t.color, a); ctx.fillText(t.text, t.x, t.y); }
    ctx.textAlign = 'start';
  }
  function drawVignette() { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }

  // small canvas helpers
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function drawIcon(id, x, y, s, tint) { const img = icons[id]; if (img && img.complete && img.naturalWidth > 0) ctx.drawImage(img, x - s / 2, y - s / 2, s, s); else { ctx.fillStyle = tint || '#fff'; ctx.beginPath(); ctx.arc(x, y, s * 0.3, 0, TAU); ctx.fill(); } }
  function label(x, y, text, color, center) { ctx.save(); ctx.font = '700 8.5px ui-monospace,monospace'; ctx.textAlign = center === undefined ? 'center' : (center ? 'center' : 'left'); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(text, x + 0.5, y + 0.5); ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore(); ctx.textAlign = 'start'; }

  // ---- 3D primitives ----
  function shadowEllipse(x, y, rx, ry) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); }
  function sphere(x, y, r, col) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, shade(col, 0.55)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.45));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(x - r * 0.32, y - r * 0.4, r * 0.24, r * 0.15, -0.6, 0, TAU); ctx.fill();
  }
  function cyl(x, yTop, w, h, col) {
    const hw = w / 2, ry = w * 0.26;
    const g = ctx.createLinearGradient(x - hw, 0, x + hw, 0);
    g.addColorStop(0, shade(col, -0.35)); g.addColorStop(0.45, shade(col, 0.28)); g.addColorStop(0.55, shade(col, 0.28)); g.addColorStop(1, shade(col, -0.4));
    ctx.fillStyle = g; ctx.fillRect(x - hw, yTop, w, h);
    ctx.fillStyle = shade(col, -0.3); ctx.beginPath(); ctx.ellipse(x, yTop + h, hw, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(col, 0.3); ctx.beginPath(); ctx.ellipse(x, yTop, hw, ry, 0, 0, TAU); ctx.fill();
  }
  // a bright product badge carrying the official Sangfor mark
  function drawMark(x, y, id, s) {
    const col = ACCENT[id] || '#72bb38';
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = s * 0.5;
    const g = ctx.createLinearGradient(x, y - s / 2, x, y + s / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e7edf5');
    ctx.fillStyle = g; roundRect(x - s / 2, y - s / 2, s, s, s * 0.26); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; roundRect(x - s / 2 + 0.75, y - s / 2 + 0.75, s - 1.5, s - 1.5, s * 0.24); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; roundRect(x - s / 2 + 1.5, y - s / 2 + 1.5, s - 3, s * 0.36, s * 0.2); ctx.fill();
    const im = marks[id], pad = s * 0.17;
    if (im && im.complete && im.naturalWidth > 0) {
      const avail = s - pad * 2, sc = Math.min(avail / im.naturalWidth, avail / im.naturalHeight), dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
      ctx.save(); roundRect(x - s / 2 + 2, y - s / 2 + 2, s - 4, s - 4, s * 0.2); ctx.clip(); ctx.drawImage(im, x - dw / 2, y - dh / 2, dw, dh); ctx.restore();
    } else drawIcon(id, x, y, s * 0.6, col);
    ctx.restore();
  }
  function hexRGB(hex) { const c = hex.replace('#', ''); return `${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)}`; }
  function tintA(hex, amt, a) { const c = hex.replace('#', ''); let r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16); r = clamp(Math.round(r + 255 * amt), 0, 255); g = clamp(Math.round(g + 255 * amt), 0, 255); b = clamp(Math.round(b + 255 * amt), 0, 255); return `rgba(${r},${g},${b},${a})`; }

  // ---- hud ----
  function pushHud() {
    onHud({ base: Math.round(S.base), baseMax: S.baseMax, score: S.score, best: Math.max(S.best, S.score), combo: S.combo, mult: comboMult(S.combo), elapsed: Math.floor(S.elapsed), level: S.level, xp: S.xp, xpNeed: S.xpNeed, tier: WEAPON_ORDER.reduce((a, id) => a + (S.levels[id] || 0), 0), levels: { ...S.levels }, dom: dominant(), sensors: S.squad.sensors, shield: S.shield, shieldMax: S.squad.shieldMax });
  }

  // ---- lifecycle ----
  function frame(ts) { const dt = Math.min(0.05, Math.max(0, (ts - lastTS) / 1000 || 0)); lastTS = ts; if (S.phase === 'play') update(dt); draw(); raf = requestAnimationFrame(frame); }
  function gameOver() { if (S.phase === 'over') return; S.phase = 'over'; S.best = Math.max(S.best, S.score); sfx.over(); onOver({ score: Math.round(S.score), best: Math.round(S.best), kills: S.kills, elapsed: Math.floor(S.elapsed), maxCombo: S.maxCombo, level: S.level, levels: { ...S.levels } }); }

  // ---- input ----
  const toLocal = ev => { const r = canvas.getBoundingClientRect(); const p = ev.touches ? ev.touches[0] : ev; return { x: p.clientX - r.left, y: p.clientY - r.top }; };
  function onDown(ev) { if (S?.phase !== 'play') return; ev.preventDefault(); const p = toLocal(ev); drag.on = true; drag.x = clamp(p.x, opMinX(), opMaxX()); drag.y = clamp(p.y, baseY - 150, baseY - 12); }
  function onMove(ev) { if (!drag.on) return; ev.preventDefault(); const p = toLocal(ev); drag.x = clamp(p.x, opMinX(), opMaxX()); drag.y = clamp(p.y, baseY - 150, baseY - 12); }
  function onUp() { drag.on = false; }
  const KMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
  function onKey(e, down) { const k = KMAP[e.key]; if (k) { if (down) keys.add(k); else keys.delete(k); e.preventDefault(); } }
  const kd = e => onKey(e, true), ku = e => onKey(e, false);
  function bind() { canvas.addEventListener('mousedown', onDown); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); canvas.addEventListener('touchstart', onDown, { passive: false }); canvas.addEventListener('touchmove', onMove, { passive: false }); window.addEventListener('touchend', onUp); window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('resize', resize); }
  function unbind() { canvas.removeEventListener('mousedown', onDown); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); canvas.removeEventListener('touchstart', onDown); canvas.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); }

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

  function shade(hex, amt) { const c = hex.replace('#', ''); let r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16); r = clamp(Math.round(r + 255 * amt), 0, 255); g = clamp(Math.round(g + 255 * amt), 0, 255); b = clamp(Math.round(b + 255 * amt), 0, 255); return `rgb(${r},${g},${b})`; }
  function hexA(hex, a) { const c = hex.replace('#', ''); const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16); return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`; }
}
