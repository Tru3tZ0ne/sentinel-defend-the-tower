// Breach Line — the machine. A Plants-vs-Zombies-style lane defense on a 2.5D
// canvas board: threats march right->left down 5 lanes, you place Sangfor
// defenders in the grid, and each defender fights the way its product really
// works. Exaggerated FX per capability. Pure numbers live in model.js; bilingual
// text is the host's job (engine emits ids/keys via callbacks).

import {
  ROWS, COLS, START_COMPUTE, PASSIVE_COMPUTE, PASSIVE_EVERY,
  PLANTS, SENSOR_PLANTS, ZOMBIES, damageFrom, xdrStrikeDamage,
  threatPool, difficultyAt, killScore, comboMult,
  PLACE_SCORE, SURVIVE_PER_SEC, STEAL_PENALTY,
} from './model.js';
import { ICONS } from '../ui/icons.js';
import { sfx } from '../rush/audio.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ICON_KEY = { HCI: 'network', AF: 'af', IAG: 'iag', NDR: 'ndr', EDR: 'edr', ASTOR: 'astor', XDR: 'xdr' };

function makeIcon(name, color) {
  // Standalone SVG images need an explicit xmlns (the inline ICONS set omits it,
  // which is fine in the DOM but makes a data-URL image "broken" on canvas).
  const raw = (ICONS[ICON_KEY[name]] || ICONS.af)
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replaceAll('currentColor', color);
  const img = new Image();
  img.src = 'data:image/svg+xml,' + encodeURIComponent(raw);
  return img;
}

export function createLineGame(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const onHud = opts.onHud || (() => {});
  const onToast = opts.onToast || (() => {});
  const onPlaced = opts.onPlaced || (() => {});
  const onOver = opts.onOver || (() => {});

  const icons = {}; for (const id of Object.keys(PLANTS)) icons[id] = makeIcon(id, '#eafff3');

  // ---- geometry ----
  let W = 0, H = 0, dpr = 1, boardX = 0, boardY = 0, cellW = 0, cellH = 0, houseX = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const houseW = Math.max(44, W * 0.085), rightPad = 10, topPad = 8, botPad = 8;
    boardX = houseW; boardY = topPad; houseX = houseW;
    cellW = (W - houseW - rightPad) / COLS;
    cellH = (H - topPad - botPad) / ROWS;
  }
  const cellCX = c => boardX + (c + 0.5) * cellW;
  const cellCY = r => boardY + (r + 0.5) * cellH;
  const laneForY = y => clamp(Math.floor((y - boardY) / cellH), 0, ROWS - 1);
  const colForX = x => Math.floor((x - boardX) / cellW);

  let S = null, raf = 0, lastTS = 0, nextId = 1;
  let selected = null;
  const hover = { c: -1, r: -1, on: false };

  function fresh() {
    return {
      phase: 'idle', compute: START_COMPUTE, score: 0, best: 0, combo: 0, maxCombo: 0,
      elapsed: 0, kills: 0, wave: 1,
      plants: new Map(), zombies: [], shots: [], parts: [], texts: [], fx: [],
      mdr: Array.from({ length: ROWS }, () => true),   // one managed last-line per lane
      spawnAcc: 0, passiveAcc: 0, lastBoss: -30, lastWave: 0, shake: 0, flash: 0, flashCol: '255,77,94',
      hudAcc: 0,
    };
  }
  const key = (c, r) => r * COLS + c;
  const sensorsOnBoard = () => [...S.plants.values()].filter(p => PLANTS[p.id].sensor).length;

  // ---- fx helpers ----
  function burst(x, y, color, n = 12, spread = 160) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 40 + Math.random() * spread; S.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color, r: 1.6 + Math.random() * 3 }); }
  }
  const ring = (x, y, color, max) => S.fx.push({ t: 'ring', x, y, color, r: 6, max, life: 1 });
  const beam = (x1, y1, x2, y2, color, w = 4) => S.fx.push({ t: 'beam', x1, y1, x2, y2, color, w, life: 1 });
  const zap = (x1, y1, x2, y2, color) => S.fx.push({ t: 'zap', x1, y1, x2, y2, color, life: 1 });
  const floatText = (x, y, text, color) => S.texts.push({ x, y, text, color, life: 1 });

  // ---- placement ----
  function tryPlace(c, r) {
    if (!selected || c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    const spec = PLANTS[selected];
    if (S.compute < spec.cost) { onToast('noCompute', 'bad'); sfx.wrong(); return; }
    if (spec.kind === 'strike') { xdrStrike(c, r); S.compute -= spec.cost; S.score += PLACE_SCORE; onPlaced(selected); selected = null; return; }
    if (S.plants.has(key(c, r))) { onToast('occupied', 'bad'); sfx.wrong(); return; }
    S.compute -= spec.cost; S.score += PLACE_SCORE;
    S.plants.set(key(c, r), { id: selected, c, r, hp: spec.hp, maxhp: spec.hp, cool: 0, born: S.elapsed, eat: 0 });
    ring(cellCX(c), cellCY(r), '114,187,56', Math.max(cellW, cellH) * 0.7);
    sfx.ability();
    onPlaced(selected); selected = null;
  }
  function xdrStrike(c, r) {
    const sc = sensorsOnBoard();
    const dmg = xdrStrikeDamage(sc);
    const cx = cellCX(c), cy = cellCY(r), rad = PLANTS.XDR.radius;
    // lightning from every sensor plant into the blast — correlation made visible
    for (const p of S.plants.values()) if (PLANTS[p.id].sensor) zap(cellCX(p.c), cellCY(p.r), cx, cy, '114,187,56');
    ring(cx, cy, '114,187,56', rad * cellW * 2.2); ring(cx, cy, '46,230,160', rad * cellW * 1.4);
    S.flash = 0.7; S.flashCol = '114,187,56'; S.shake = 1;
    let hit = 0;
    for (const z of S.zombies) {
      const zc = (z.x - boardX) / cellW - 0.5;
      if (Math.abs(zc - c) <= rad && Math.abs(z.lane - r) <= rad) { hurtZombie(z, dmg, 'XDR'); burst(z.x, laneY(z), '114,187,56', 10); hit++; }
    }
    onToast(sc === 0 ? 'xdrEmpty' : 'xdrHit', sc === 0 ? 'bad' : 'good', { n: sc, d: Math.round(dmg) });
    sfx.breach();
  }

  const laneY = z => cellCY(z.lane);

  // ---- spawning ----
  function spawnZombie(type) {
    const spec = ZOMBIES[type]; const d = difficultyAt(S.elapsed);
    const lane = (Math.random() * ROWS) | 0;
    S.zombies.push({ id: nextId++, type, spec, lane, x: W + 24 + Math.random() * 30, hp: spec.hp * d.hpMul, maxhp: spec.hp * d.hpMul, slow: 0, hit: 0, eating: null, carried: false });
    if (spec.boss) { S.shake = 0.8; S.flash = 0.5; S.flashCol = '255,77,94'; onToast('boss', 'bad'); sfx.boss(); }
  }
  function autoSpawn(dt) {
    const d = difficultyAt(S.elapsed);
    if (S.elapsed - S.lastBoss >= d.bossEvery) { S.lastBoss = S.elapsed; spawnZombie('ransom'); }
    if (S.elapsed - S.lastWave >= 24) { S.lastWave = S.elapsed; S.wave++; onToast('wave', 'warn', { n: S.wave }); }
    S.spawnAcc += dt;
    while (S.spawnAcc >= d.spawnGap && S.zombies.length < d.cap) {
      S.spawnAcc -= d.spawnGap;
      const pool = threatPool(S.elapsed);
      spawnZombie(pool[(Math.random() * pool.length) | 0]);
    }
  }

  // ---- combat ----
  function hurtZombie(z, dmg, source) {
    z.hp -= damageFrom(source, z, dmg); z.hit = 1;
    if (z.hp <= 0 && !z.dead) killZombie(z);
  }
  function killZombie(z) {
    z.dead = true; S.kills++; S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
    S.score += killScore(z.type, S.combo);
    burst(z.x, laneY(z), z.spec.color, z.spec.boss ? 26 : 12, z.spec.boss ? 220 : 150);
    if (z.spec.boss) { ring(z.x, laneY(z), '255,77,94', cellW * 2); sfx.ability(); } else sfx.hit(Math.min(24, S.combo));
  }
  function firstZombieInLane(lane, fromX) {
    let best = null, bx = Infinity;
    for (const z of S.zombies) { if (z.dead || z.lane !== lane) continue; if (z.x > fromX - 4 && z.x < bx) { bx = z.x; best = z; } }
    return best;
  }

  function plantShoot(p) {
    const spec = PLANTS[p.id];
    const lanes = spec.lanes === 3 ? [p.r - 1, p.r, p.r + 1].filter(l => l >= 0 && l < ROWS) : [p.r];
    let fired = false;
    const px = cellCX(p.c) + cellW * 0.22, py = cellCY(p.r);
    for (const lane of lanes) {
      if (!firstZombieInLane(lane, px)) continue;
      S.shots.push({ id: nextId++, x: px, y: cellCY(lane) + (lane === p.r ? 0 : 0), lane, vx: 520, dmg: spec.dmg, src: p.id, slow: spec.slow, slowMs: spec.slowMs, life: 2.2 });
      fired = true;
    }
    if (fired) {
      if (spec.lanes === 3) { for (const lane of lanes) beam(px, py, cellCX(COLS) , cellCY(lane), '57,192,255', 1.5); ring(px, py, '57,192,255', cellW * 0.6); }
      S.fx.push({ t: 'muzzle', x: px, y: py, color: p.id === 'IAG' ? '93,200,255' : p.id === 'NDR' ? '57,192,255' : '46,230,160', life: 1 });
      sfx.serve();
    }
  }
  function plantMelee(p) {
    const spec = PLANTS[p.id]; const px = cellCX(p.c), py = cellCY(p.r);
    let target = null, bx = Infinity;
    for (const z of S.zombies) {
      if (z.dead || z.lane !== p.r) continue;
      const dx = z.x - px;
      if (dx > -cellW * 0.4 && dx < spec.reach * cellW && z.x < bx) { bx = z.x; target = z; }
    }
    if (target) {
      hurtZombie(target, spec.dmg, p.id);
      ring(target.x, py, '255,138,90', cellW * 0.9); burst(target.x, py, '#ff8a5a', 8, 120);
      beam(px, py, target.x, py, '255,138,90', 6);
      S.shake = Math.min(1, S.shake + 0.12); sfx.hit(14);
    }
  }

  // ---- update ----
  function update(dt) {
    S.elapsed += dt;
    const d = difficultyAt(S.elapsed);

    // economy
    S.passiveAcc += dt * 1000; if (S.passiveAcc >= PASSIVE_EVERY) { S.passiveAcc = 0; S.compute += PASSIVE_COMPUTE; }

    // plants
    for (const p of S.plants.values()) {
      const spec = PLANTS[p.id];
      p.cool -= dt * 1000;
      if (spec.kind === 'wall' && p.hp < spec.hp) p.hp = Math.min(spec.hp, p.hp + spec.regen * dt);
      if (spec.kind === 'eco') { if (p.cool <= 0) { p.cool = spec.produceEvery; S.compute += spec.produce; floatText(cellCX(p.c), cellCY(p.r) - cellH * 0.3, '+' + spec.produce, '#39c0ff'); ring(cellCX(p.c), cellCY(p.r), '57,192,255', cellW * 0.6); } }
      else if (spec.kind === 'shooter') { if (p.cool <= 0) { const before = S.shots.length; plantShoot(p); if (S.shots.length > before) p.cool = spec.rate; } }
      else if (spec.kind === 'melee') { if (p.cool <= 0) { plantMelee(p); p.cool = spec.rate; } }
    }

    // shots
    for (const b of S.shots) {
      b.x += b.vx * dt; b.life -= dt;
      if (b.x > W + 20) b.life = 0;
      for (const z of S.zombies) {
        if (z.dead || z.lane !== b.lane) continue;
        if (Math.abs(z.x - b.x) < 16) {
          hurtZombie(z, b.dmg, b.src);
          if (b.slow) { z.slow = Math.max(z.slow, b.slow); z.slowT = b.slowMs / 1000; burst(z.x, laneY(z), '#5dc8ff', 6, 90); }
          else burst(b.x, b.y, '#eafff3', 4, 70);
          b.life = 0; break;
        }
      }
    }

    // zombies
    for (const z of S.zombies) {
      if (z.dead) continue;
      if (z.hit > 0) z.hit = Math.max(0, z.hit - dt * 5);
      if (z.slowT > 0) { z.slowT -= dt; if (z.slowT <= 0) z.slow = 0; }
      // eat plant in front
      const fc = colForX(z.x);
      const front = (fc >= 0 && fc < COLS) ? S.plants.get(key(fc, z.lane)) : null;
      const atPlant = front && z.x <= cellCX(fc) + cellW * 0.42;
      if (atPlant && PLANTS[front.id].kind !== 'strike') {
        z.eating = front; front.hp -= ZOMBIES[z.type].dps * dt; front.eat = 0.6;
        if (Math.random() < dt * 6) burst(z.x - 6, laneY(z), '#2a3350', 2, 40);
        if (front.hp <= 0) { S.plants.delete(key(fc, z.lane)); burst(cellCX(fc), cellCY(z.lane), '#72bb38', 10); z.eating = null; }
        continue; // stopped to eat
      }
      z.eating = null;
      const sp = z.spec.speed * d.speedMul * (1 - z.slow) * cellW;
      z.x -= sp * dt;
      if (z.x < houseX - 6) breach(z);
    }

    // fx decay
    for (const p of S.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; p.life -= dt * 1.5; }
    for (const t of S.texts) { t.y -= 24 * dt; t.life -= dt; }
    for (const f of S.fx) f.life -= dt * (f.t === 'muzzle' ? 7 : f.t === 'zap' ? 4 : 2.4);
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 2.5);
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 2);

    S.score += SURVIVE_PER_SEC * dt;
    if (S.combo > 0) { S.comboDecay = (S.comboDecay || 0) + dt; if (S.comboDecay > 3.5) { S.combo = 0; S.comboDecay = 0; } }

    S.zombies = S.zombies.filter(z => !z.dead);
    S.shots = S.shots.filter(b => b.life > 0);
    S.parts = S.parts.filter(p => p.life > 0);
    S.texts = S.texts.filter(t => t.life > 0);
    S.fx = S.fx.filter(f => f.life > 0);

    autoSpawn(dt * 1000);
  }

  function breach(z) {
    const lane = z.lane;
    if (S.mdr[lane]) {                       // MDR managed last-line clears the lane, once
      S.mdr[lane] = false;
      S.fx.push({ t: 'sweep', lane, x: W, life: 1 });
      for (const o of S.zombies) if (o.lane === lane && !o.dead) { burst(o.x, cellCY(lane), '#16ca78', 10); o.dead = true; }
      ring(houseX, cellCY(lane), '22,202,120', cellW * 2.4);
      onToast('mdr', 'good'); sfx.ability(); S.shake = 0.6;
      return;
    }
    // no managed response left on this lane -> breach
    z.dead = true;
    if (z.spec.steals) { S.score = Math.max(0, S.score - STEAL_PENALTY); onToast('exfil', 'bad'); }
    S.flash = 0.8; S.flashCol = '255,77,94'; S.shake = 1; sfx.breach();
    gameOver();
  }

  function gameOver() {
    if (S.phase === 'over') return;
    S.phase = 'over'; cancelAnimationFrame(raf); sfx.over();
    onOver({ score: Math.round(S.score), best: Math.max(S.best, Math.round(S.score)), kills: S.kills, wave: S.wave, maxCombo: S.maxCombo, elapsed: Math.floor(S.elapsed) });
  }

  // ---- render ----
  function draw() {
    ctx.clearRect(0, 0, W, H);
    let ox = 0, oy = 0;
    if (S.shake > 0) { ox = (Math.random() - 0.5) * S.shake * 9; oy = (Math.random() - 0.5) * S.shake * 9; }
    ctx.save(); ctx.translate(ox, oy);

    drawBoard();
    // plants
    for (const p of S.plants.values()) drawPlant(p);
    // shots
    for (const b of S.shots) {
      const col = b.src === 'IAG' ? '#5dc8ff' : b.src === 'NDR' ? '#39c0ff' : '#aef6c6';
      ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = col; ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(b.x, b.y, 7, 3.4, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    // zombies
    for (const z of S.zombies) drawZombie(z);
    // fx
    drawFx();
    // particles + text
    for (const p of S.parts) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 14px ui-sans-serif,system-ui';
    for (const t of S.texts) { ctx.globalAlpha = Math.max(0, t.life); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y); }
    ctx.globalAlpha = 1;
    // hover placement ghost
    if (hover.on && selected && hover.c >= 0 && hover.c < COLS) {
      const ok = PLANTS[selected].kind === 'strike' || !S.plants.has(key(hover.c, hover.r));
      ctx.fillStyle = ok ? 'rgba(114,187,56,.18)' : 'rgba(255,90,106,.18)';
      ctx.strokeStyle = ok ? 'rgba(114,187,56,.7)' : 'rgba(255,90,106,.7)'; ctx.lineWidth = 2;
      roundRect(cellCX(hover.c) - cellW / 2 + 3, cellCY(hover.r) - cellH / 2 + 3, cellW - 6, cellH - 6, 9); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    if (S.flash > 0) { ctx.fillStyle = `rgba(${S.flashCol},${S.flash * 0.28})`; ctx.fillRect(0, 0, W, H); }
  }

  function drawBoard() {
    // lanes
    for (let r = 0; r < ROWS; r++) {
      ctx.fillStyle = r % 2 ? 'rgba(20,34,58,.55)' : 'rgba(14,26,46,.55)';
      ctx.fillRect(boardX, boardY + r * cellH, W - boardX - 2, cellH);
    }
    // grid cell bevels (the 2.5D tiles)
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x = cellCX(c) - cellW / 2, y = cellCY(r) - cellH / 2;
      ctx.fillStyle = (c + r) % 2 ? 'rgba(255,255,255,.015)' : 'rgba(255,255,255,.04)';
      roundRect(x + 2, y + 2, cellW - 4, cellH - 4, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(120,150,200,.10)'; ctx.lineWidth = 1; ctx.stroke();
    }
    // house / data centre at left
    const g = ctx.createLinearGradient(0, 0, houseX, 0);
    g.addColorStop(0, 'rgba(114,187,56,.28)'); g.addColorStop(1, 'rgba(114,187,56,.05)');
    ctx.fillStyle = g; ctx.fillRect(0, boardY, houseX, H - boardY * 2);
    ctx.strokeStyle = 'rgba(114,187,56,.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(houseX, boardY); ctx.lineTo(houseX, H - boardY); ctx.stroke();
    // per-lane MDR shield indicator on the house wall
    for (let r = 0; r < ROWS; r++) {
      ctx.globalAlpha = S.mdr[r] ? 1 : 0.2;
      ctx.fillStyle = S.mdr[r] ? '#16ca78' : '#3a4a5e';
      ctx.beginPath(); ctx.arc(houseX - 10, cellCY(r), 5, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // right spawn gate glow
    const gg = ctx.createLinearGradient(W, 0, W - 40, 0);
    gg.addColorStop(0, 'rgba(255,77,94,.22)'); gg.addColorStop(1, 'rgba(255,77,94,0)');
    ctx.fillStyle = gg; ctx.fillRect(W - 40, boardY, 40, H - boardY * 2);
  }

  function drawPlant(p) {
    const spec = PLANTS[p.id], x = cellCX(p.c), y = cellCY(p.r), R = Math.min(cellW, cellH) * 0.36;
    const col = { HCI: '#39c0ff', AF: '#2ee6a0', IAG: '#5dc8ff', NDR: '#39c0ff', EDR: '#ff8a5a', ASTOR: '#a98bff', XDR: '#72bb38' }[p.id];
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + R * 0.75, R * 0.95, R * 0.4, 0, 0, TAU); ctx.fill();
    // dome
    const grad = ctx.createRadialGradient(x - R * 0.3, y - R * 0.4, R * 0.2, x, y, R * 1.1);
    grad.addColorStop(0, '#1a2740'); grad.addColorStop(1, '#0b1322');
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fillStyle = grad; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.shadowBlur = p.eat > 0 ? 16 : 8; ctx.shadowColor = col; ctx.stroke(); ctx.shadowBlur = 0;
    if (p.eat > 0) p.eat -= 0.03;
    // product icon
    const img = icons[p.id]; const s = R * 1.15;
    if (img && img.complete && img.naturalWidth > 0) { ctx.drawImage(img, x - s / 2, y - s / 2, s, s); }
    // hp bar for damaged defenders
    if (p.hp < spec.hp - 0.01) { const f = clamp(p.hp / spec.hp, 0, 1); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - R, y + R * 0.95, R * 2, 3); ctx.fillStyle = f > .5 ? '#2ee6a0' : f > .25 ? '#ffba45' : '#ff5a6a'; ctx.fillRect(x - R, y + R * 0.95, R * 2 * f, 3); }
  }

  function drawZombie(z) {
    const x = z.x, y = laneY(z), R = Math.min(cellW, cellH) * (z.spec.boss ? 0.46 : 0.34);
    ctx.fillStyle = 'rgba(0,0,0,.33)'; ctx.beginPath(); ctx.ellipse(x, y + R * 0.8, R * 0.95, R * 0.38, 0, 0, TAU); ctx.fill();
    const col = z.hit > 0 ? '#fff' : z.slow ? '#8fd4ff' : z.spec.color;
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5;
    ctx.save(); ctx.translate(x, y);
    if (z.spec.boss) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, rr = i % 2 ? R * 0.6 : R; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (z.type === 'exfil') { roundRect(-R, -R * 0.7, R * 2, R * 1.4, 4); ctx.fill(); ctx.stroke(); }
    else if (z.type === 'worm') { ctx.beginPath(); ctx.ellipse(0, 0, R * 1.15, R * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    else if (z.type === 'apt') { ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1; ctx.strokeStyle = '#d9c7ff'; ctx.beginPath(); ctx.arc(0, 0, R + 3, 0, TAU); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.stroke(); }
    // simple eyes facing left (direction of travel)
    ctx.fillStyle = '#0a0f1a'; ctx.beginPath(); ctx.arc(-R * 0.4, -R * 0.15, R * 0.14, 0, TAU); ctx.arc(-R * 0.05, -R * 0.15, R * 0.14, 0, TAU); ctx.fill();
    ctx.restore();
    // hp pip
    const f = clamp(z.hp / z.maxhp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - R, y - R - 7, R * 2, 3);
    ctx.fillStyle = f > .5 ? '#2ee6a0' : f > .25 ? '#ffba45' : '#ff5a6a'; ctx.fillRect(x - R, y - R - 7, R * 2 * f, 3);
  }

  function drawFx() {
    for (const f of S.fx) {
      const a = Math.max(0, f.life);
      if (f.t === 'ring') { ctx.globalAlpha = a; ctx.strokeStyle = `rgba(${f.color},${a})`; ctx.lineWidth = 3; const rr = f.r + (1 - a) * f.max; ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, TAU); ctx.stroke(); }
      else if (f.t === 'beam') { ctx.globalAlpha = a * 0.7; ctx.strokeStyle = `rgba(${f.color},${a})`; ctx.lineWidth = f.w; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke(); }
      else if (f.t === 'zap') { ctx.globalAlpha = a; ctx.strokeStyle = `rgba(${f.color},${a})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); let n = 5, lx = f.x1, ly = f.y1; for (let i = 1; i <= n; i++) { const tt = i / n; const mx = f.x1 + (f.x2 - f.x1) * tt + (Math.random() - 0.5) * 14; const my = f.y1 + (f.y2 - f.y1) * tt + (Math.random() - 0.5) * 14; ctx.lineTo(mx, my); lx = mx; ly = my; } ctx.stroke(); }
      else if (f.t === 'muzzle') { ctx.globalAlpha = a; ctx.fillStyle = `rgba(${f.color},${a})`; ctx.beginPath(); ctx.arc(f.x, f.y, 9 * a + 3, 0, TAU); ctx.fill(); }
      else if (f.t === 'sweep') { const sx = boardX + (W - boardX) * (1 - a); ctx.globalAlpha = a; const g = ctx.createLinearGradient(sx - 30, 0, sx + 30, 0); g.addColorStop(0, 'rgba(22,202,120,0)'); g.addColorStop(.5, 'rgba(22,202,120,.8)'); g.addColorStop(1, 'rgba(22,202,120,0)'); ctx.fillStyle = g; ctx.fillRect(sx - 30, cellCY(f.lane) - cellH / 2, 60, cellH); }
    }
    ctx.globalAlpha = 1;
  }

  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // ---- loop ----
  function frame(ts) {
    if (S.phase !== 'play') return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - lastTS) / 1000 || 0); lastTS = ts;
    update(dt); draw();
    S.hudAcc += dt; if (S.hudAcc >= 0.1) { S.hudAcc = 0; pushHud(); }
  }
  function pushHud() {
    onHud({ compute: Math.floor(S.compute), score: Math.round(S.score), best: Math.round(S.best), combo: S.combo, mult: comboMult(S.combo), elapsed: Math.floor(S.elapsed), kills: S.kills, wave: S.wave, mdr: S.mdr.filter(Boolean).length, sensors: sensorsOnBoard() });
  }

  // ---- input ----
  function cellFromEvent(e) {
    const r = canvas.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e;
    const x = t.clientX - r.left, y = t.clientY - r.top;
    return { c: colForX(x), r: laneForY(y), x, y };
  }
  const onMove = e => { if (!S || S.phase !== 'play') return; const p = cellFromEvent(e); hover.c = p.c; hover.r = p.r; hover.on = p.x >= boardX; };
  const onLeave = () => { hover.on = false; };
  const onClick = e => { if (!S || S.phase !== 'play') return; const p = cellFromEvent(e); if (p.x >= boardX) tryPlace(p.c, p.r); e.preventDefault(); };

  function bind() {
    canvas.addEventListener('mousemove', onMove); canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('click', onClick); canvas.addEventListener('touchstart', onClick, { passive: false });
    window.addEventListener('resize', resize);
  }
  function unbind() {
    canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('mouseleave', onLeave);
    canvas.removeEventListener('click', onClick); canvas.removeEventListener('touchstart', onClick);
    window.removeEventListener('resize', resize);
  }

  resize(); bind();

  return {
    start(best = 0) { S = fresh(); resize(); S.best = best; S.phase = 'play'; selected = null; lastTS = performance.now(); sfx.start(); pushHud(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
    select(id) { selected = (selected === id ? null : id); return selected; },
    get selected() { return selected; },
    canAfford(id) { return S && S.compute >= PLANTS[id].cost; },
    stop() { if (S) S.phase = 'idle'; cancelAnimationFrame(raf); },
    destroy() { this.stop(); unbind(); },
    resize,
    get phase() { return S ? S.phase : 'idle'; },
    get state() { return S; },
  };
}
