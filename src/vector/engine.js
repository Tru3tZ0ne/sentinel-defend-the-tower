// Threat Vector — the machine. A 2D-canvas "survivor" arena: you only move, your
// Sangfor defenses auto-fire, monsters swarm and charge you, and their drops level
// those defenses up. Self-contained loop + renderer + input. Balance/mapping live
// in model.js; this file wires it to pixels. Bilingual text is the host's job
// (engine emits keys/ids via callbacks).

import {
  CAPS, ENEMIES, START_HULL, difficultyAt, threatPool, deriveStats,
  pickDrop, killScore, comboMult, PICKUP_SCORE, SURVIVE_PER_SEC,
} from './model.js';
import { sfx } from '../rush/audio.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hyp = (dx, dy) => Math.hypot(dx, dy);

// token palette per capability (keeps the loot legible at a glance)
const CAP_COLOR = {
  HCI: '#39c0ff', XDR: '#72bb38', EDR: '#ff8a5a', NDR: '#39c0ff', AF: '#2ee6a0',
  IAG: '#ffd166', ASTOR: '#a98bff', MDR: '#16ca78', SASE: '#5cc8ff',
};
const CAP_ABBR = {
  HCI: 'HCI', XDR: 'XDR', EDR: 'EDR', NDR: 'NDR', AF: 'AF', IAG: 'IAG', ASTOR: 'aStor', MDR: 'MDR', SASE: 'SASE',
};

export function createVectorGame(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const onHud = opts.onHud || (() => {});
  const onToast = opts.onToast || (() => {});
  const onPickup = opts.onPickup || (() => {});
  const onOver = opts.onOver || (() => {});

  let W = 0, H = 0, dpr = 1;
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (S) { S.ship.x = clamp(S.ship.x, 24, W - 24); S.ship.y = clamp(S.ship.y, 24, H - 24); }
  }

  let S = null, raf = 0, lastTS = 0, nextId = 1;
  const keys = new Set();
  const pointer = { down: false, x: 0, y: 0 };

  function fresh() {
    return {
      phase: 'idle',
      hull: START_HULL, score: 0, combo: 0, maxCombo: 0, best: 0,
      elapsed: 0, kills: 0,
      owned: {}, stats: deriveStats({}),
      ship: { x: W / 2, y: H / 2, aim: -Math.PI / 2, r: 14 },
      enemies: [], bullets: [], tokens: [], parts: [], texts: [], zaps: [],
      drone: { ang: 0 },
      fireAcc: 0, edrAcc: 0, mdrAcc: 0, spawnAcc: 0, surviveAcc: 0, comboDecay: 0,
      lastBoss: 0, astorCharge: 0, astorRegen: 0, shake: 0, flash: 0, dmgCd: 0,
    };
  }

  // ---------- effects ----------
  function burst(x, y, color, n = 10, spread = 150) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = 30 + Math.random() * spread;
      S.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color, r: 1.4 + Math.random() * 2.4 });
    }
  }
  function floatText(x, y, text, color) { S.texts.push({ x, y, text, color, life: 1 }); }

  // ---------- spawning ----------
  function edgePoint() {
    const m = 40, side = (Math.random() * 4) | 0;
    if (side === 0) return { x: Math.random() * W, y: -m };
    if (side === 1) return { x: W + m, y: Math.random() * H };
    if (side === 2) return { x: Math.random() * W, y: H + m };
    return { x: -m, y: Math.random() * H };
  }
  function spawnEnemy(type, opt = {}) {
    const spec = ENEMIES[type];
    const d = difficultyAt(S.elapsed);
    const p = opt.at || edgePoint();
    S.enemies.push({
      id: nextId++, type, spec, x: p.x, y: p.y,
      hp: (opt.hp ?? spec.hp) * d.hpMul, maxhp: (opt.hp ?? spec.hp) * d.hpMul,
      r: spec.r * (opt.rMul || 1), hit: 0, revealed: !spec.cloak,
      carrying: false, fleeing: false, cache: !!opt.cache, child: !!opt.child,
    });
  }
  function autoSpawn(dt) {
    const d = difficultyAt(S.elapsed);
    // ransom brute cadence
    if (S.elapsed - S.lastBoss >= d.bossEvery) { S.lastBoss = S.elapsed; spawnEnemy('ransom'); onToast('boss', 'bad'); sfx.boss(); }
    const gap = d.spawnGap * (S.stats.sase ? S.stats.sase.spawnMul : 1);   // SASE shrinks the attack surface
    S.spawnAcc += dt;
    while (S.spawnAcc >= gap && S.enemies.length < d.cap) {
      S.spawnAcc -= gap;
      const pool = threatPool(S.elapsed);
      const n = d.burst;
      for (let i = 0; i < n && S.enemies.length < d.cap; i++) {
        const type = pool[(Math.random() * pool.length) | 0];
        spawnEnemy(type, Math.random() < 0.04 ? { cache: true } : {});   // rare glowing cache always drops loot
      }
    }
  }

  // ---------- combat ----------
  function nearestEnemy(x, y, filter) {
    let best = null, bd = Infinity;
    for (const e of S.enemies) {
      if (filter && !filter(e)) continue;
      const dd = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (dd < bd) { bd = dd; best = e; }
    }
    return best;
  }
  function fireBullet(x, y, ang, dmg, kind = 'main') {
    const sp = 540;
    S.bullets.push({ id: nextId++, x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, dmg, life: 1.4, kind, chained: 0 });
  }
  function shipFire() {
    const st = S.stats;
    const target = nearestEnemy(S.ship.x, S.ship.y, e => e.revealed || !e.spec.cloak || st.ndr);
    if (!target) return;
    const ang = Math.atan2(target.y - S.ship.y, target.x - S.ship.x);
    S.ship.aim = ang;
    fireBullet(S.ship.x, S.ship.y, ang, st.dmg, 'main');
    // AF perimeter -> extra forward "firewall" bolts across your facing arc
    if (st.af) {
      for (let i = 1; i <= st.af.bolts; i++) {
        const off = st.af.spread * (i % 2 ? 1 : -1) * Math.ceil(i / 2);
        fireBullet(S.ship.x, S.ship.y, ang + off, st.dmg * 0.7 + st.af.dmg, 'af');
      }
    }
    sfx.serve();
  }
  function damageEnemy(e, dmg, fromBullet) {
    e.hp -= dmg; e.hit = 1;
    if (e.hp <= 0) return killEnemy(e);
    // NDR -> shots chain to nearby networked enemies
    if (fromBullet && S.stats.ndr && fromBullet.chained < S.stats.ndr.chain && fromBullet.kind !== 'chain') {
      const near = nearestEnemy(e.x, e.y, o => o !== e && hyp(o.x - e.x, o.y - e.y) < S.stats.ndr.chainRange);
      if (near) {
        fromBullet.chained++;
        S.zaps.push({ x1: e.x, y1: e.y, x2: near.x, y2: near.y, life: 1 });
        damageEnemy(near, Math.max(1, dmg * 0.6), { kind: 'chain', chained: fromBullet.chained });
      }
    }
    return false;
  }
  function killEnemy(e) {
    e.dead = true;
    S.kills++; S.combo++; S.comboDecay = 0; S.maxCombo = Math.max(S.maxCombo, S.combo);
    const pts = killScore(e.type, S.combo);
    S.score += pts;
    burst(e.x, e.y, e.spec.color, e.spec.boss ? 26 : 10, e.spec.boss ? 220 : 150);
    if (e.spec.boss) { sfx.ability(); S.flash = 0.5; } else sfx.hit(Math.min(24, S.combo));
    // loot
    const dropChance = e.cache ? 1 : e.spec.boss ? 1 : 0.11;
    if (Math.random() < dropChance) dropLoot(e.x, e.y, e.cache || e.spec.boss ? 2 : 1);
    // worm splits into two smaller worms
    if (e.spec.splits && !e.child) {
      for (let i = 0; i < 2; i++) spawnEnemy('worm', { at: { x: e.x + (i ? 12 : -12), y: e.y }, hp: e.maxhp * 0.45, rMul: 0.7, child: true });
    }
    return true;
  }

  // ---------- loot ----------
  function dropLoot(x, y, n = 1) {
    for (let i = 0; i < n; i++) {
      const cap = pickDrop(S.owned);
      const a = Math.random() * TAU, d = 8 + Math.random() * 20;
      const px = clamp(x + Math.cos(a) * d, 16, W - 16), py = clamp(y + Math.sin(a) * d, 16, H - 16);
      if (cap) S.tokens.push({ id: nextId++, x: px, y: py, kind: 'cap', cap, life: 14, born: S.elapsed });
      else S.tokens.push({ id: nextId++, x: px, y: py, kind: Math.random() < 0.5 ? 'hull' : 'intel', life: 14, born: S.elapsed });
    }
  }
  function collect(tok) {
    if (tok.kind === 'cap') {
      const lvl = (S.owned[tok.cap] || 0) + 1;
      S.owned[tok.cap] = Math.min(CAPS[tok.cap].max, lvl);
      S.stats = deriveStats(S.owned);
      if (tok.cap === 'ASTOR') S.astorCharge = S.stats.astor.maxCharges;   // top up snapshots on grab
      S.score += PICKUP_SCORE;
      onPickup(tok.cap, S.owned[tok.cap], S.stats);
      sfx.ability();
    } else if (tok.kind === 'hull') {
      S.hull = Math.min(START_HULL, S.hull + 18); floatText(tok.x, tok.y, '+18', '#2ee6a0'); sfx.hit(8);
    } else {
      S.score += 120; floatText(tok.x, tok.y, '+120', '#39c0ff'); sfx.hit(12);
    }
    tok.dead = true;
  }

  // ---------- hull / loss ----------
  function hurt(dmg) {
    if (S.stats.astor && S.astorCharge > 0 && dmg >= 6) {   // aStor restores from a snapshot on a real hit
      S.astorCharge--; S.hull = Math.min(START_HULL, S.hull + S.stats.astor.restore);
      floatText(S.ship.x, S.ship.y - 24, 'RESTORE', '#a98bff'); onToast('restore', 'good');
    }
    S.hull -= dmg; S.combo = Math.max(0, S.combo - 2); S.shake = Math.min(1, S.shake + 0.5); S.flash = Math.min(0.6, S.flash + 0.3);
    if (S.hull <= 0) { S.hull = 0; gameOver(); }
  }
  function gameOver() {
    S.phase = 'over'; cancelAnimationFrame(raf); sfx.over();
    onOver({ score: Math.round(S.score), best: Math.max(S.best, Math.round(S.score)), kills: S.kills, maxCombo: S.maxCombo, elapsed: Math.floor(S.elapsed), owned: { ...S.owned } });
  }

  // ---------- update ----------
  function update(dt) {
    S.elapsed += dt;
    const st = S.stats;

    // ship movement: keyboard vector + pointer-follow
    let mx = 0, my = 0;
    if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1;
    if (keys.has('w') || keys.has('arrowup')) my -= 1;
    if (keys.has('s') || keys.has('arrowdown')) my += 1;
    if (pointer.down) {
      const dx = pointer.x - S.ship.x, dy = pointer.y - S.ship.y, d = hyp(dx, dy);
      if (d > 6) { mx += dx / d; my += dy / d; }
    }
    const ml = hyp(mx, my);
    if (ml > 0) { const sp = 210; S.ship.x += (mx / ml) * sp * dt; S.ship.y += (my / ml) * sp * dt; }
    S.ship.x = clamp(S.ship.x, 20, W - 20); S.ship.y = clamp(S.ship.y, 20, H - 20);

    // survive + combo decay
    S.surviveAcc += dt; while (S.surviveAcc >= 1) { S.surviveAcc -= 1; S.score += SURVIVE_PER_SEC; }
    S.comboDecay += dt; if (S.comboDecay > 2.6 && S.combo > 0) { S.combo = 0; S.comboDecay = 0; }
    if (S.dmgCd > 0) S.dmgCd -= dt;

    // auto-fire
    S.fireAcc += dt;
    const fireGap = 0.52 / st.fireRateMul;
    while (S.fireAcc >= fireGap) { S.fireAcc -= fireGap; shipFire(); }

    // EDR aura (endpoint auto-response close to the ship)
    if (st.edr) {
      S.edrAcc += dt;
      if (S.edrAcc >= st.edr.interval / 1000) {
        S.edrAcc = 0;
        const t = nearestEnemy(S.ship.x, S.ship.y, e => hyp(e.x - S.ship.x, e.y - S.ship.y) < st.edr.radius);
        if (t) { S.zaps.push({ x1: S.ship.x, y1: S.ship.y, x2: t.x, y2: t.y, life: 1, edr: true }); damageEnemy(t, st.edr.dmg); }
      }
    }
    // MDR wingman drone
    if (st.mdr) {
      S.drone.ang += dt * 1.8;
      S.mdrAcc += dt;
      if (S.mdrAcc >= st.mdr.interval / 1000) {
        S.mdrAcc = 0;
        const dx = Math.cos(S.drone.ang) * 34, dy = Math.sin(S.drone.ang) * 34;
        const t = nearestEnemy(S.ship.x + dx, S.ship.y + dy, e => e.revealed || st.ndr);
        if (t) { const a = Math.atan2(t.y - (S.ship.y + dy), t.x - (S.ship.x + dx)); fireBullet(S.ship.x + dx, S.ship.y + dy, a, st.mdr.dmg, 'mdr'); }
      }
    }
    // aStor snapshot regen
    if (st.astor && S.astorCharge < st.astor.maxCharges) {
      S.astorRegen += dt * 1000;
      if (S.astorRegen >= st.astor.regenMs) { S.astorRegen = 0; S.astorCharge++; }
    }

    autoSpawn(dt * 1000);

    // enemies
    for (const e of S.enemies) {
      if (st.ndr && st.ndr.reveal) e.revealed = true;                     // NDR lights up cloaked APTs
      let tx = S.ship.x, ty = S.ship.y, sp = e.spec.speed * difficultyAt(S.elapsed).speedMul;
      if (e.fleeing) {                                                     // exfil drone escaping with data
        tx = e.fleeX; ty = e.fleeY; sp *= 1.25;
        if (st.iag && st.iag.lock) sp *= st.iag.slow;                     // IAG egress lock slows + pins it
      }
      const dx = tx - e.x, dy = ty - e.y, d = hyp(dx, dy) || 1;
      e.x += (dx / d) * sp * dt; e.y += (dy / d) * sp * dt;
      if (e.hit > 0) e.hit = Math.max(0, e.hit - dt * 5);

      if (e.fleeing) {
        const atEdge = e.x < -10 || e.x > W + 10 || e.y < -10 || e.y > H + 10;
        if (st.iag && st.iag.lock) {                                      // can't leave: bounce back inside
          e.x = clamp(e.x, 12, W - 12); e.y = clamp(e.y, 12, H - 12);
          if (hyp(e.x - e.fleeX, e.y - e.fleeY) < 14) { e.fleeing = false; }   // give up, charge again
        } else if (atEdge) {                                              // escaped with your data
          e.dead = true; S.score = Math.max(0, S.score - 80); S.combo = 0;
          onToast('exfilEscaped', 'bad'); floatText(S.ship.x, S.ship.y, '-80', '#ff5a6a');
        }
        continue;
      }
      // contact with ship
      if (hyp(e.x - S.ship.x, e.y - S.ship.y) < e.r + S.ship.r) {
        if (e.spec.steals && !e.carrying) {                               // exfil grabs data and flees
          e.carrying = true; e.fleeing = true; const ep = edgePoint(); e.fleeX = ep.x; e.fleeY = ep.y;
          S.score = Math.max(0, S.score - 20); floatText(e.x, e.y, '-20', '#ffd166');
        } else if (S.dmgCd <= 0) {
          hurt(e.spec.dps * 0.5); S.dmgCd = 0.22;                          // throttle contact ticks
          if (e.spec.boss) e.x -= (dx / d) * 8, e.y -= (dy / d) * 8;       // nudge boss off so it doesn't melt you instantly
        }
      }
    }

    // bullets
    for (const b of S.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) b.life = 0;
      for (const e of S.enemies) {
        if (e.dead) continue;
        if (!e.revealed && e.spec.cloak && !st.ndr) continue;             // can't hit what you can't see
        if (hyp(e.x - b.x, e.y - b.y) < e.r + 4) {
          damageEnemy(e, b.dmg, b); b.life = 0; break;
        }
      }
    }

    // tokens: magnet + collect + expiry
    for (const tok of S.tokens) {
      const dx = S.ship.x - tok.x, dy = S.ship.y - tok.y, d = hyp(dx, dy);
      if (d < 120) { const pull = (1 - d / 120) * 240; tok.x += (dx / d) * pull * dt; tok.y += (dy / d) * pull * dt; }
      if (d < S.ship.r + 12) collect(tok);
      else if (S.elapsed - tok.born > tok.life) tok.dead = true;
    }

    // particles / texts / zaps
    for (const p of S.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt * 1.6; }
    for (const t of S.texts) { t.y -= 26 * dt; t.life -= dt * 1.1; }
    for (const z of S.zaps) z.life -= dt * 6;
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 3);
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 2);

    // sweep dead
    S.enemies = S.enemies.filter(e => !e.dead);
    S.bullets = S.bullets.filter(b => b.life > 0);
    S.tokens = S.tokens.filter(t => !t.dead);
    S.parts = S.parts.filter(p => p.life > 0);
    S.texts = S.texts.filter(t => t.life > 0);
    S.zaps = S.zaps.filter(z => z.life > 0);
  }

  // ---------- render ----------
  function draw() {
    ctx.clearRect(0, 0, W, H);
    let ox = 0, oy = 0;
    if (S.shake > 0) { ox = (Math.random() - 0.5) * S.shake * 10; oy = (Math.random() - 0.5) * S.shake * 10; }
    ctx.save(); ctx.translate(ox, oy);

    // EDR aura
    if (S.stats.edr) {
      ctx.beginPath(); ctx.arc(S.ship.x, S.ship.y, S.stats.edr.radius, 0, TAU);
      ctx.fillStyle = 'rgba(255,138,90,0.06)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,138,90,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // zaps (EDR + NDR chains)
    for (const z of S.zaps) {
      ctx.globalAlpha = Math.max(0, z.life);
      ctx.strokeStyle = z.edr ? '#ff8a5a' : '#39c0ff'; ctx.lineWidth = z.edr ? 2.4 : 1.8;
      ctx.beginPath(); ctx.moveTo(z.x1, z.y1); ctx.lineTo(z.x2, z.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // tokens
    for (const tok of S.tokens) {
      const col = tok.kind === 'cap' ? (CAP_COLOR[tok.cap] || '#fff') : tok.kind === 'hull' ? '#2ee6a0' : '#39c0ff';
      const pulse = 1 + Math.sin(S.elapsed * 6 + tok.id) * 0.08;
      ctx.save(); ctx.translate(tok.x, tok.y); ctx.scale(pulse, pulse);
      ctx.beginPath(); roundRect(ctx, -13, -10, 26, 20, 5);
      ctx.fillStyle = 'rgba(8,12,22,.92)'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = col; ctx.font = '700 9px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tok.kind === 'cap' ? CAP_ABBR[tok.cap] : tok.kind === 'hull' ? '+HP' : '$$$', 0, 0);
      ctx.restore();
    }

    // bullets
    for (const b of S.bullets) {
      ctx.fillStyle = b.kind === 'mdr' ? '#16ca78' : b.kind === 'af' ? '#2ee6a0' : '#eafff3';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.kind === 'main' ? 3.4 : 2.6, 0, TAU); ctx.fill();
    }

    // enemies
    for (const e of S.enemies) drawEnemy(e);

    // MDR drone
    if (S.stats.mdr) {
      const dx = S.ship.x + Math.cos(S.drone.ang) * 34, dy = S.ship.y + Math.sin(S.drone.ang) * 34;
      ctx.beginPath(); ctx.arc(dx, dy, 6, 0, TAU); ctx.fillStyle = '#16ca78'; ctx.fill();
      ctx.strokeStyle = 'rgba(22,202,120,.5)'; ctx.lineWidth = 1; ctx.stroke();
    }

    // ship
    ctx.save(); ctx.translate(S.ship.x, S.ship.y); ctx.rotate(S.ship.aim);
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-11, 9); ctx.lineTo(-6, 0); ctx.lineTo(-11, -9); ctx.closePath();
    ctx.fillStyle = '#eafff3'; ctx.fill(); ctx.strokeStyle = '#72bb38'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();

    // particles
    for (const p of S.parts) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    // floating text
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 13px ui-sans-serif,system-ui';
    for (const t of S.texts) { ctx.globalAlpha = Math.max(0, t.life); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y); }
    ctx.globalAlpha = 1;

    ctx.restore();
    if (S.flash > 0) { ctx.fillStyle = `rgba(255,77,94,${S.flash * 0.25})`; ctx.fillRect(0, 0, W, H); }
  }
  function drawEnemy(e) {
    const vis = e.revealed || !e.spec.cloak;
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.globalAlpha = vis ? 1 : 0.18;
    const col = e.hit > 0 ? '#ffffff' : e.spec.color;
    ctx.fillStyle = col; ctx.strokeStyle = e.cache ? '#ffd166' : 'rgba(255,255,255,.25)'; ctx.lineWidth = e.cache ? 2.5 : 1;
    if (e.spec.boss) {
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, rr = i % 2 ? e.r * 0.62 : e.r; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (e.spec.id === 'exfil') {
      ctx.beginPath(); roundRect(ctx, -e.r, -e.r * 0.7, e.r * 2, e.r * 1.4, 4); ctx.fill(); ctx.stroke();
      if (e.carrying) { ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); }
    } else if (e.spec.id === 'worm') {
      ctx.beginPath(); ctx.ellipse(0, 0, e.r, e.r * 0.68, 0, 0, TAU); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill(); ctx.stroke();
    }
    // health pip for tougher foes
    if (vis && e.maxhp > 5) {
      const f = clamp(e.hp / e.maxhp, 0, 1);
      ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(-e.r, -e.r - 7, e.r * 2, 3);
      ctx.fillStyle = f > 0.5 ? '#2ee6a0' : f > 0.25 ? '#ffba45' : '#ff5a6a'; ctx.fillRect(-e.r, -e.r - 7, e.r * 2 * f, 3);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // ---------- loop ----------
  function frame(ts) {
    if (S.phase !== 'play') return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - lastTS) / 1000 || 0); lastTS = ts;
    update(dt); draw();
    S.hudAcc = (S.hudAcc || 0) + dt;
    if (S.hudAcc >= 0.09) { S.hudAcc = 0; pushHud(); }
  }
  function pushHud() {
    const st = S.stats;
    onHud({
      hull: Math.max(0, Math.round(S.hull)), score: Math.round(S.score), best: Math.round(S.best),
      combo: S.combo, mult: comboMult(S.combo), elapsed: Math.floor(S.elapsed), kills: S.kills,
      owned: { ...S.owned }, sensors: st.sensors, xdrLevel: st.xdrLevel,
      astor: st.astor ? { charge: S.astorCharge, max: st.astor.maxCharges } : null,
    });
  }

  // ---------- input ----------
  const kd = e => { const k = e.key.toLowerCase(); if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault(); keys.add(k); };
  const ku = e => keys.delete(e.key.toLowerCase());
  function ptPos(e) { const r = canvas.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top }; }
  const pdown = e => { pointer.down = true; const p = ptPos(e); pointer.x = p.x; pointer.y = p.y; e.preventDefault(); };
  const pmove = e => { if (!pointer.down) return; const p = ptPos(e); pointer.x = p.x; pointer.y = p.y; };
  const pup = () => { pointer.down = false; };

  function bind() {
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    canvas.addEventListener('mousedown', pdown); window.addEventListener('mousemove', pmove); window.addEventListener('mouseup', pup);
    canvas.addEventListener('touchstart', pdown, { passive: false }); canvas.addEventListener('touchmove', pmove, { passive: false }); window.addEventListener('touchend', pup);
    window.addEventListener('resize', resize);
  }
  function unbind() {
    window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
    canvas.removeEventListener('mousedown', pdown); window.removeEventListener('mousemove', pmove); window.removeEventListener('mouseup', pup);
    canvas.removeEventListener('touchstart', pdown); canvas.removeEventListener('touchmove', pmove); window.removeEventListener('touchend', pup);
    window.removeEventListener('resize', resize);
  }

  resize(); bind();

  return {
    start(best = 0) {
      S = fresh(); resize(); S.best = best; S.phase = 'play'; keys.clear(); pointer.down = false;
      lastTS = performance.now(); sfx.start(); pushHud();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    },
    pause() { if (S && S.phase === 'play') { S.phase = 'paused'; cancelAnimationFrame(raf); } },
    resume() { if (S && S.phase === 'paused') { S.phase = 'play'; lastTS = performance.now(); raf = requestAnimationFrame(frame); } },
    stop() { if (S) S.phase = 'idle'; cancelAnimationFrame(raf); },
    destroy() { this.stop(); unbind(); },
    resize,
    get phase() { return S ? S.phase : 'idle'; },
    get state() { return S; },
  };

  function roundRect(c, x, y, w, h, r) {
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
}
