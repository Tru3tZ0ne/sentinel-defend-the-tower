// Breach Rush — the game. A 2D canvas radial-triage arcade: threats race inward
// toward the data core along a neon grid; the player taps hostile blips to
// neutralise them and leaves legitimate traffic alone. Self-contained loop +
// renderer + input. Balance/scoring live in rules.js; this file is the machine.

import {
  TYPES, difficultyAt, threatPool, bossDue, hitScore, comboMult,
  FALSE_POSITIVE, SERVE_BONUS, START_INTEGRITY, ENERGY_PER_HIT, ENERGY_MAX, ABILITIES,
} from './rules.js';
import { sfx, resumeAudio } from './audio.js';

const TAU = Math.PI * 2;
const BEST_KEY = 'sentinel.rush.best';

function readBest() { try { return +localStorage.getItem(BEST_KEY) || 0; } catch { return 0; } }
function writeBest(v) { try { localStorage.setItem(BEST_KEY, String(Math.round(v))); } catch { /* ignore */ } }

export function createGame(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const onHud = opts.onHud || (() => {});
  const onToast = opts.onToast || (() => {});
  const onOver = opts.onOver || (() => {});

  // ---- geometry (recomputed on resize) ----
  let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, rimR = 0, coreR = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2; cy = H / 2;
    rimR = Math.min(W, H) * 0.47;
    coreR = Math.max(26, Math.min(W, H) * 0.075);
  }

  // ---- state ----
  const S = {
    phase: 'idle',            // idle | playing | paused | over
    score: 0, combo: 0, maxCombo: 0, best: readBest(),
    integrity: START_INTEGRITY, energy: 0, stage: 1,
    elapsed: 0, neutralised: 0, served: 0,
    blips: [], parts: [], texts: [],
    slowUntil: 0, revealUntil: 0,
    lastBossAt: 0, spawnAcc: 0, shake: 0, flash: 0, sweep: 0, t: 0,
  };
  let raf = 0, lastTS = 0, nextId = 1;

  // ---- spawning ----
  function spawn(type) {
    const spec = TYPES[type];
    const ang = Math.random() * TAU;
    const cross = (4.4 / spec.speed);                 // base seconds rim->core at difficulty 1
    S.blips.push({
      id: nextId++, type, spec, ang, rad: rimR * 1.02,
      cross, hp: spec.hits || 1, maxhp: spec.hits || 1,
      born: S.t, hitFlash: 0, fp: false, wobble: Math.random() * TAU,
    });
    if (spec.boss) { sfx.boss(); onToast('toast.boss', 'warn'); }
  }
  function autoSpawn(dt) {
    const d = difficultyAt(S.elapsed);
    S.stage = d.stage;
    // boss cadence
    if (bossDue(S.elapsed, S.lastBossAt)) { S.lastBossAt = S.elapsed; spawn('ransom'); }
    S.spawnAcc += dt;
    while (S.spawnAcc >= d.interval) {
      S.spawnAcc -= d.interval;
      const isThreat = Math.random() < d.threatRatio;
      if (isThreat) {
        const pool = threatPool(S.elapsed);
        spawn(pool[(Math.random() * pool.length) | 0]);
      } else {
        spawn('traffic');
      }
    }
  }

  // ---- effects ----
  function burst(x, y, color, n = 12, spread = 150) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = 40 + Math.random() * spread;
      S.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color, r: 1.5 + Math.random() * 2.5 });
    }
  }
  function floatText(x, y, str, color) { S.texts.push({ x, y, str, color, life: 1 }); }
  function shake(v) { S.shake = Math.min(18, S.shake + v); }

  // ---- outcomes ----
  function neutralise(b, byAbility) {
    const distFrac = Math.max(0, (b.rad - coreR) / (rimR - coreR));
    const pts = hitScore({ type: b.type, distFrac, combo: S.combo });
    S.score += pts; S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
    S.neutralised++;
    S.energy = Math.min(ENERGY_MAX, S.energy + ENERGY_PER_HIT);
    const p = worldPos(b);
    burst(p.x, p.y, b.spec.accent, b.spec.boss ? 26 : 12, b.spec.boss ? 260 : 150);
    floatText(p.x, p.y - 8, '+' + pts, b.spec.accent);
    b.dead = true;
    if (!byAbility) sfx.hit(S.combo);
  }
  function falsePositive(b) {
    if (b.fp) return;
    b.fp = true; b.fpT = 0.5;
    S.score = Math.max(0, S.score + FALSE_POSITIVE); S.combo = 0;
    const p = worldPos(b);
    floatText(p.x, p.y - 8, FALSE_POSITIVE, '#ff5a6a');
    S.flash = Math.max(S.flash, 0.5); sfx.wrong(); onToast('toast.fp', 'bad');
  }
  function breach(b) {
    const dmg = b.spec.breach || 1;
    S.integrity -= dmg; S.combo = 0;
    shake(b.spec.boss ? 16 : 9); S.flash = 1;
    sfx.breach(); onToast('toast.breach', 'bad');
    b.dead = true;
    if (S.integrity <= 0) gameOver();
  }

  // ---- abilities ----
  function useAbility(id) {
    if (S.phase !== 'playing') return;
    const a = ABILITIES[id]; if (!a) return;
    if (S.energy < a.cost) { onToast('toast.nopow', 'warn'); return; }
    S.energy -= a.cost; sfx.ability();
    if (id === 'purge') {
      for (const b of S.blips) if (b.spec.threat && !b.dead) neutralise(b, true);
      S.flash = Math.max(S.flash, 0.4);
    } else if (id === 'slow') {
      S.slowUntil = S.t + 5;
    } else if (id === 'scan') {
      S.revealUntil = S.t + 7;
    }
    pushHud();
  }

  // ---- input ----
  function worldPos(b) { return { x: cx + Math.cos(b.ang) * b.rad, y: cy + Math.sin(b.ang) * b.rad }; }
  function hitTest(px, py) {
    let best = null, bestD = Infinity;
    for (const b of S.blips) {
      if (b.dead) continue;
      const p = worldPos(b);
      const rr = blipRadius(b) + 16;                  // generous touch target
      const d = Math.hypot(px - p.x, py - p.y);
      if (d <= rr && d < bestD) { bestD = d; best = b; }
    }
    return best;
  }
  function act(px, py) {
    if (S.phase !== 'playing') return;
    const b = hitTest(px, py); if (!b) return;
    if (b.spec.threat) {
      b.hitFlash = 1;
      b.hp -= 1;
      if (b.hp <= 0) neutralise(b, false);
      else { sfx.hit(0); const p = worldPos(b); burst(p.x, p.y, b.spec.accent, 6, 80); }
    } else {
      falsePositive(b);
    }
    pushHud();
  }
  function onPointer(ev) {
    resumeAudio();
    const r = canvas.getBoundingClientRect();
    act(ev.clientX - r.left, ev.clientY - r.top);
  }

  // ---- loop ----
  function step(dt) {
    S.t += dt; S.elapsed += dt; S.sweep = (S.sweep + dt * 0.7) % TAU;
    autoSpawn(dt);
    const slow = S.t < S.slowUntil ? 0.42 : 1;
    const dmul = difficultyAt(S.elapsed).speedMul;
    for (const b of S.blips) {
      if (b.dead) continue;
      const v = (rimR - coreR) / b.cross * dmul * slow;
      b.rad -= v * dt;
      b.wobble += dt * 3;
      if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - dt * 4);
      if (b.fpT > 0) b.fpT = Math.max(0, b.fpT - dt);
      if (b.rad <= coreR) {
        if (b.spec.threat) breach(b);
        else { S.served++; S.score += SERVE_BONUS; const p = worldPos(b); burst(p.x, p.y, b.spec.accent, 6, 60); b.dead = true; sfx.serve(); }
      }
    }
    S.blips = S.blips.filter(b => !b.dead);
    // particles + texts
    for (const p of S.parts) { p.life -= dt * 1.6; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; }
    S.parts = S.parts.filter(p => p.life > 0);
    for (const tx of S.texts) { tx.life -= dt * 1.1; tx.y -= dt * 26; }
    S.texts = S.texts.filter(tx => tx.life > 0);
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 42);
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 2);
  }

  let hudAcc = 0;
  function pushHud() {
    onHud({
      score: Math.round(S.score), combo: S.combo, best: Math.max(S.best, S.score),
      integrity: S.integrity, energy: S.energy, stage: S.stage, elapsed: S.elapsed,
      slow: S.t < S.slowUntil, reveal: S.t < S.revealUntil,
    });
  }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!lastTS) lastTS = ts;
    let dt = (ts - lastTS) / 1000; lastTS = ts;
    if (dt > 0.05) dt = 0.05;                          // clamp after tab-switch
    if (S.phase === 'playing') { step(dt); hudAcc += dt; if (hudAcc > 0.1) { hudAcc = 0; pushHud(); } }
    draw();
  }

  // ---- render ----
  function blipRadius(b) {
    if (b.spec.boss) return 26 + 6 * Math.sin(b.wobble);
    const base = b.spec.threat ? 13 : 12;
    return base + (b.type === 'exfil' ? 2 : 0);
  }
  function visAlpha(b) {
    if (b.type !== 'stealth') return 1;
    if (S.t < S.revealUntil) return 1;
    // faintly visible; clearer as it nears the core
    const nf = 1 - Math.max(0, (b.rad - coreR) / (rimR - coreR));
    return 0.18 + nf * 0.5;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // background
    const g = ctx.createRadialGradient(cx, cy, coreR * 0.5, cx, cy, rimR * 1.2);
    g.addColorStop(0, '#071428'); g.addColorStop(0.6, '#050a16'); g.addColorStop(1, '#03060e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (S.shake > 0) ctx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);

    drawField();
    drawCore();
    for (const b of S.blips) drawBlip(b);
    drawParticles();
    drawTexts();
    ctx.restore();

    if (S.flash > 0) { ctx.fillStyle = `rgba(255,70,90,${S.flash * 0.28})`; ctx.fillRect(0, 0, W, H); }
  }

  function drawField() {
    ctx.save();
    // concentric rings
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      const rr = coreR + (rimR - coreR) * (i / 5);
      ctx.strokeStyle = `rgba(57,120,200,${0.10 + (i === 5 ? 0.14 : 0)})`;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
    }
    // radial spokes
    ctx.strokeStyle = 'rgba(57,120,200,0.08)';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * coreR, cy + Math.sin(a) * coreR);
      ctx.lineTo(cx + Math.cos(a) * rimR, cy + Math.sin(a) * rimR);
      ctx.stroke();
    }
    // sweep wedge
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const a0 = S.sweep;
    const grad = ctx.createRadialGradient(cx, cy, coreR, cx, cy, rimR);
    grad.addColorStop(0, 'rgba(46,230,160,0.0)'); grad.addColorStop(1, 'rgba(46,230,160,0.12)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rimR, a0, a0 + 0.5); ctx.closePath(); ctx.fill();
    ctx.restore();
    // rim
    ctx.strokeStyle = 'rgba(46,230,160,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, rimR, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  function drawCore() {
    ctx.save();
    const pulse = 1 + 0.05 * Math.sin(S.t * 3);
    const hurt = S.integrity <= 1;
    const col = hurt ? '#ff5a6a' : '#2ee6a0';
    ctx.shadowColor = col; ctx.shadowBlur = 26;
    const grd = ctx.createRadialGradient(cx, cy, 2, cx, cy, coreR * pulse);
    grd.addColorStop(0, '#eafff6'); grd.addColorStop(0.5, col); grd.addColorStop(1, 'rgba(8,20,16,0.2)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(cx, cy, coreR * pulse, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // integrity pips
    ctx.restore();
  }

  function drawBlip(b) {
    const p = worldPos(b); const r = blipRadius(b);
    const spec = b.spec; const alpha = visAlpha(b);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    const flash = b.hitFlash;
    ctx.shadowColor = spec.color; ctx.shadowBlur = 14 + flash * 20;
    ctx.fillStyle = flash > 0 ? '#ffffff' : spec.color;
    ctx.strokeStyle = spec.accent; ctx.lineWidth = 2;

    const sh = spec.shape;
    if (sh === 'orb') {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      if (spec.mimic) { // phish: subtle hostile tell
        ctx.fillStyle = '#ff5a6a'; ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.45, r * 0.28, 0, TAU); ctx.fill();
        if (S.t < S.revealUntil) { ctx.strokeStyle = '#ff5a6a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, TAU); ctx.stroke(); }
      } else { // traffic: friendly inner ring
        ctx.strokeStyle = spec.accent; ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, TAU); ctx.stroke();
      }
    } else if (sh === 'tri') {
      poly(3, r, -Math.PI / 2); ctx.fill();
    } else if (sh === 'spike') {
      spikes(r); ctx.fill();
    } else if (sh === 'diamond') {
      poly(4, r, 0); ctx.fill();
    } else if (sh === 'ghost') {
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = alpha * 0.5; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, TAU); ctx.fill();
    } else if (sh === 'boss') {
      spikes(r, 10); ctx.fill();
      // hp ring
      ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, r + 7, -Math.PI / 2, -Math.PI / 2 + TAU * (b.hp / b.maxhp)); ctx.stroke();
    }
    ctx.restore();

    function poly(n, rad, rot) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; const x = Math.cos(a) * rad, y = Math.sin(a) * rad; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath();
    }
    function spikes(rad, n = 5) {
      ctx.beginPath();
      for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i / (n * 2) * TAU; const rr = i % 2 ? rad * 0.46 : rad; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath();
    }
  }

  function drawParticles() {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of S.parts) {
      ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function drawTexts() {
    ctx.save();
    ctx.font = '700 15px ' + fontStack(); ctx.textAlign = 'center';
    for (const tx of S.texts) { ctx.globalAlpha = Math.max(0, tx.life); ctx.fillStyle = tx.color; ctx.fillText(tx.str, tx.x, tx.y); }
    ctx.restore();
  }
  function fontStack() { return '-apple-system, "Segoe UI", Roboto, sans-serif'; }

  // ---- lifecycle ----
  function start() {
    S.phase = 'playing';
    S.score = 0; S.combo = 0; S.maxCombo = 0; S.integrity = START_INTEGRITY; S.energy = 0;
    S.elapsed = 0; S.neutralised = 0; S.served = 0; S.stage = 1;
    S.blips = []; S.parts = []; S.texts = [];
    S.slowUntil = 0; S.revealUntil = 0; S.lastBossAt = 0; S.spawnAcc = 0; S.shake = 0; S.flash = 0; S.t = 0;
    S.best = readBest();
    resumeAudio(); sfx.start(); pushHud();
  }
  function pause() { if (S.phase === 'playing') { S.phase = 'paused'; pushHud(); } }
  function resume() { if (S.phase === 'paused') { S.phase = 'playing'; lastTS = 0; pushHud(); } }
  function togglePause() { S.phase === 'playing' ? pause() : resume(); }
  function gameOver() {
    if (S.phase === 'over') return;
    S.phase = 'over';
    const isBest = S.score > S.best;
    if (isBest) { S.best = Math.round(S.score); writeBest(S.best); }
    sfx.over();
    onOver({ score: Math.round(S.score), stage: S.stage, elapsed: Math.round(S.elapsed),
             neutralised: S.neutralised, served: S.served, maxCombo: S.maxCombo, best: S.best, isBest });
  }
  function toIdle() { S.phase = 'idle'; S.blips = []; S.parts = []; S.texts = []; }

  canvas.addEventListener('pointerdown', onPointer);
  window.addEventListener('resize', resize);
  resize();
  raf = requestAnimationFrame(frame);

  return {
    state: S, start, pause, resume, togglePause, useAbility, toIdle, resize,
    destroy() { cancelAnimationFrame(raf); canvas.removeEventListener('pointerdown', onPointer); window.removeEventListener('resize', resize); },
    // test/debug hooks
    _spawn: spawn, _act: act, _step: step, _tapNearest(threatOnly) {
      let t = null, best = Infinity;
      for (const b of S.blips) { if (b.dead) continue; if (threatOnly && !b.spec.threat) continue; if (b.rad < best) { best = b.rad; t = b; } }
      if (t) { const p = worldPos(t); act(p.x, p.y); }
      return t;
    },
  };
}
