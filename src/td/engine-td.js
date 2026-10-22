// Tower-defense engine for "Sentinel — Kill Chain". Pure game logic, no Three.js:
// a threat marches along a fixed path from the internet to the data core; Sangfor
// products placed on pads beside the path automatically fire on threats in range.
// All positions are in board XZ space; the 3D layer (main-td.js) only renders what
// this engine computes, so the whole loop is deterministic and testable headless.

// ---- tower specs (keyed by product id) ----
// kind: blocker/guard/egress = damage dealers; sensor = reveal+slow support;
// support = buffs nearby towers; managed = global sniper; core = shields the data core.
export const TD_TOWERS = {
  AF:    { range: 7.0, dmg: 15, cooldown: 0.55, kind: 'blocker', color: 0x39e08a },
  EDR:   { range: 5.4, dmg: 9,  cooldown: 0.40, kind: 'guard',   color: 0x51d0ff, bonusVs: 'malware' },
  NDR:   { range: 9.0, dmg: 3,  cooldown: 0.70, kind: 'sensor',  color: 0x6fb4ff, reveal: true, slow: 0.55 },
  IAG:   { range: 6.6, dmg: 17, cooldown: 0.55, kind: 'egress',  color: 0xff9b3d, bonusVs: 'exfil' },
  XDR:   { range: 6.4, dmg: 0,  cooldown: 0,    kind: 'support',  color: 0xffd166, buffDmg: 0.40, buffRange: 0.15 },
  MDR:   { range: 999, dmg: 30, cooldown: 2.4,  kind: 'managed',  color: 0xb98bff },
  ASTOR: { range: 0,   dmg: 0,  cooldown: 0,    kind: 'core',     color: 0x2fd0c0, shield: 3 },
};

// ---- threat specs (kill-chain stages) ----
export const TD_ENEMIES = {
  recon:   { hp: 18,  speed: 4.4, reward: 2, leakUptime: 4,  color: 0x7fe0ff },
  exploit: { hp: 34,  speed: 3.4, reward: 3, leakUptime: 7,  color: 0xffc14d },
  malware: { hp: 50,  speed: 2.9, reward: 3, leakUptime: 8,  color: 0xff6a7a },
  lateral: { hp: 42,  speed: 3.6, reward: 4, leakUptime: 8,  color: 0xa98bff, stealth: true },
  exfil:   { hp: 36,  speed: 4.0, reward: 4, leakData: 18,   color: 0xff4d9d },
  ransom:  { hp: 190, speed: 2.0, reward: 14, leakUptime: 34, color: 0xff3b3b, boss: true },
};

// ---- wave script (escalating; introduces one new threat type at a time) ----
export const TD_WAVES = [
  [{ type: 'recon', count: 6, gap: 0.9 }],
  [{ type: 'recon', count: 5, gap: 0.8 }, { type: 'exploit', count: 4, gap: 1.0, delay: 5 }],
  [{ type: 'exploit', count: 6, gap: 0.8 }, { type: 'malware', count: 4, gap: 1.1, delay: 6 }],
  [{ type: 'malware', count: 6, gap: 0.9 }, { type: 'lateral', count: 4, gap: 1.0, delay: 5 }],
  [{ type: 'lateral', count: 6, gap: 0.8 }, { type: 'exfil', count: 5, gap: 0.9, delay: 6 }],
  [{ type: 'exploit', count: 6, gap: 0.5 }, { type: 'malware', count: 5, gap: 0.7, delay: 2 }, { type: 'exfil', count: 5, gap: 0.8, delay: 7 }],
  [{ type: 'lateral', count: 6, gap: 0.6 }, { type: 'exfil', count: 6, gap: 0.6, delay: 3 }, { type: 'ransom', count: 2, gap: 4.0, delay: 10 }],
];

const dist2 = (a, b) => { const dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz; };

export function createTD({ path, slots, products, startCredits = 14, waves = TD_WAVES }) {
  // Precompute cumulative path length so we can map a scalar distance → world point.
  const seg = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    seg.push({ a, b, len, at: total });
    total += len;
  }
  function pointAt(d) {
    if (d <= 0) return { x: path[0].x, z: path[0].z };
    if (d >= total) { const e = path[path.length - 1]; return { x: e.x, z: e.z }; }
    for (const s of seg) { if (d <= s.at + s.len) { const t = (d - s.at) / s.len; return { x: s.a.x + (s.b.x - s.a.x) * t, z: s.a.z + (s.b.z - s.a.z) * t }; } }
    const e = path[path.length - 1]; return { x: e.x, z: e.z };
  }

  const state = {
    phase: 'build',            // build | wave | won | lost
    credits: startCredits,
    uptime: 100, data: 100,
    waveIndex: 0, waveCount: waves.length,
    towers: [], enemies: [], projectiles: [],
    coreShield: 0,
    time: 0, _eid: 0, _tid: 0, _spawns: null, _leaks: 0, _kills: 0,
    lastEvent: null,
  };

  const towerSpec = id => TD_TOWERS[id];
  function towerStats(tw) {
    const s = towerSpec(tw.productId);
    const lvl = tw.level;
    let dmg = s.dmg * (1 + 0.6 * (lvl - 1));
    let range = s.range * (1 + 0.12 * (lvl - 1));
    // XDR support towers buff nearby damage dealers.
    if (s.kind !== 'support' && s.kind !== 'core') {
      for (const o of state.towers) {
        const os = towerSpec(o.productId);
        if (os.kind !== 'support') continue;
        if (dist2(tw, o) <= os.range * os.range) { dmg *= (1 + os.buffDmg); range *= (1 + os.buffRange); }
      }
    }
    return { ...s, dmg, range };
  }

  function buildCost(id, lvl = 1) { return Math.round(products[id].cost * (lvl === 1 ? 1 : 1.5 * lvl)); }

  function build(slotId, productId) {
    if (!TD_TOWERS[productId]) return { ok: false, reason: 'unknown' };
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return { ok: false, reason: 'noPad' };
    if (state.towers.some(t => t.slotId === slotId)) return { ok: false, reason: 'occupied' };
    const cost = buildCost(productId, 1);
    if (state.credits < cost) return { ok: false, reason: 'tooPoor' };
    state.credits -= cost;
    const tw = { id: ++state._tid, slotId, productId, x: slot.x, z: slot.z, level: 1, cool: 0, firedAt: -99 };
    state.towers.push(tw);
    if (towerSpec(productId).kind === 'core') state.coreShield += towerSpec(productId).shield;
    return { ok: true, tower: tw };
  }
  function upgrade(towerId) {
    const tw = state.towers.find(t => t.id === towerId); if (!tw) return { ok: false };
    if (tw.level >= 3) return { ok: false, reason: 'maxed' };
    const cost = buildCost(tw.productId, tw.level + 1);
    if (state.credits < cost) return { ok: false, reason: 'tooPoor' };
    state.credits -= cost; tw.level++;
    if (towerSpec(tw.productId).kind === 'core') state.coreShield += towerSpec(tw.productId).shield;
    return { ok: true };
  }
  function sell(towerId) {
    const i = state.towers.findIndex(t => t.id === towerId); if (i < 0) return { ok: false };
    const tw = state.towers[i];
    let spent = 0; for (let l = 1; l <= tw.level; l++) spent += buildCost(tw.productId, l);
    state.credits += Math.round(spent * 0.6);
    state.towers.splice(i, 1);
    return { ok: true };
  }

  function startWave() {
    if (state.phase !== 'build' || state.waveIndex >= waves.length) return { ok: false };
    state.phase = 'wave';
    // Flatten the wave script into a timed spawn queue.
    const q = [];
    for (const group of waves[state.waveIndex]) {
      const base = group.delay || 0;
      const hpScale = 1 + 0.12 * state.waveIndex;
      for (let i = 0; i < group.count; i++) q.push({ at: base + i * group.gap, type: group.type, hpScale });
    }
    q.sort((a, b) => a.at - b.at);
    state._spawns = { q, i: 0, t: 0 };
    return { ok: true };
  }

  function spawn(type, hpScale) {
    const e = TD_ENEMIES[type];
    state.enemies.push({
      id: ++state._eid, type, dist: 0, x: path[0].x, z: path[0].z,
      hp: e.hp * hpScale, maxHp: e.hp * hpScale, speed: e.speed,
      stealth: !!e.stealth, revealed: !e.stealth, slow: 1, boss: !!e.boss,
    });
  }

  function leak(e) {
    const spec = TD_ENEMIES[e.type];
    let up = spec.leakUptime || 0, dt = spec.leakData || 0;
    // aStor shields the core: each charge soaks one breach, halving its bite.
    if (state.coreShield > 0 && (up + dt) > 0) { state.coreShield--; up *= 0.4; dt *= 0.4; }
    state.uptime = Math.max(0, state.uptime - up);
    state.data = Math.max(0, state.data - dt);
    state._leaks++;
    state.lastEvent = { kind: 'leak', type: e.type };
  }

  function tick(dt) {
    if (state.phase !== 'wave') return;
    state.time += dt;

    // 1) spawns
    const sp = state._spawns;
    if (sp) { sp.t += dt; while (sp.i < sp.q.length && sp.q[sp.i].at <= sp.t) { const s = sp.q[sp.i++]; spawn(s.type, s.hpScale); } }

    // 2) sensor auras: recompute reveal + slow each tick
    for (const e of state.enemies) { e.revealed = !e.stealth; e.slow = 1; }
    for (const tw of state.towers) {
      const s = towerSpec(tw.productId);
      if (!s.reveal && !s.slow) continue;
      const st = towerStats(tw);
      for (const e of state.enemies) {
        if (dist2(tw, e) <= st.range * st.range) {
          if (s.reveal) e.revealed = true;
          if (s.slow) e.slow = Math.min(e.slow, s.slow);
        }
      }
    }

    // 3) move enemies
    for (const e of state.enemies) {
      e.dist += e.speed * e.slow * dt;
      const p = pointAt(e.dist); e.x = p.x; e.z = p.z;
    }
    // leaks (reached the core)
    for (const e of state.enemies) if (e.dist >= total && e.hp > 0) { leak(e); e.hp = -1; }

    // 4) towers fire
    for (const tw of state.towers) {
      const s = towerSpec(tw.productId);
      if (s.kind === 'support' || s.kind === 'core') continue;
      tw.cool -= dt; if (tw.cool > 0) continue;
      const st = towerStats(tw);
      // acquire target: managed = highest hp anywhere; others = furthest-along in range, must be targetable.
      let target = null;
      if (s.kind === 'managed') {
        for (const e of state.enemies) { if (e.hp <= 0 || !e.revealed) continue; if (!target || e.hp > target.hp) target = e; }
      } else {
        let best = -1;
        for (const e of state.enemies) {
          if (e.hp <= 0 || !e.revealed) continue;
          if (dist2(tw, e) > st.range * st.range) continue;
          if (e.dist > best) { best = e.dist; target = e; }
        }
      }
      if (!target) continue;
      tw.cool = s.cooldown; tw.firedAt = state.time;
      let dmg = st.dmg;
      if (s.bonusVs && target.type === s.bonusVs) dmg *= 2;
      state.projectiles.push({ id: ++state._tid, x: tw.x, z: tw.z, tx: target.x, tz: target.z, target: target.id, dmg, color: s.color, kind: s.kind, t: 0 });
    }

    // 5) projectiles travel (fast homing) and hit
    const PSPEED = 34;
    for (const pr of state.projectiles) {
      const tgt = state.enemies.find(e => e.id === pr.target && e.hp > 0);
      if (tgt) { pr.tx = tgt.x; pr.tz = tgt.z; }
      const dx = pr.tx - pr.x, dz = pr.tz - pr.z, d = Math.hypot(dx, dz);
      const step = PSPEED * dt;
      if (d <= step || !tgt) {
        pr.x = pr.tx; pr.z = pr.tz; pr.dead = true;
        if (tgt) { tgt.hp -= pr.dmg; tgt._hit = state.time; }
      } else { pr.x += dx / d * step; pr.z += dz / d * step; pr.t += dt; }
    }
    state.projectiles = state.projectiles.filter(p => !p.dead);

    // 6) deaths → credits (hp<=0 with dist<total means killed, not leaked)
    const alive = [];
    for (const e of state.enemies) {
      if (e.hp > 0) { alive.push(e); continue; }
      if (e.dist < total) { state.credits += TD_ENEMIES[e.type].reward; state._kills++; state.lastEvent = { kind: 'kill', type: e.type }; }
    }
    state.enemies = alive;

    // 7) lose / wave-clear
    if (state.uptime <= 0 || state.data <= 0) { state.phase = 'lost'; return; }
    if (sp && sp.i >= sp.q.length && state.enemies.length === 0) {
      state._spawns = null;
      state.waveIndex++;
      if (state.waveIndex >= waves.length) { state.phase = 'won'; }
      else { state.phase = 'build'; state.credits += 6 + state.waveIndex * 2; }  // wave-clear bonus
    }
  }

  function incomingPreview() {
    if (state.waveIndex >= waves.length) return [];
    const counts = {};
    for (const g of waves[state.waveIndex]) counts[g.type] = (counts[g.type] || 0) + g.count;
    return Object.entries(counts).map(([type, n]) => ({ type, n }));
  }

  return {
    state, pointAt, pathLength: total,
    build, upgrade, sell, startWave, tick,
    towerStats, buildCost, incomingPreview,
    get phase() { return state.phase; },
  };
}
