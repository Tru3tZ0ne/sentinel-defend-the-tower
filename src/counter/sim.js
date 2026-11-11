// Sentinel Counter-Breach - pure rules for the round-based first-person site defense.
// No DOM, no Three.js: the view (engine.js) feeds inputs in and drains S.fx.
//
// One match is a series of rounds, first to WIN_AT. Every round starts with a buy
// phase (money -> Sangfor products), then threats pour in from the Internet strip at
// the north and a Ransomware carrier tries to plant an encryptor on Site A or B.
// World: X east, Z south, cells of CELL units. Yaw 0 looks north (-Z).

export const CELL = 2, COLS = 23, ROWS = 23;
export const MAP = [
  '#######################',
  '#.....................#',
  '#..T....T..T..T....T..#',
  '#.....................#',
  '###1#######2#######3###',
  '#.....#.........#.....#',
  '#v....#..rr.rr..#....v#',
  '#.....#.........#.....#',
  '#..r.....#####.....r..#',
  '#.....#.........#.....#',
  '#.....#....v....#.....#',
  '###.#####..#..#####.###',
  '#.......#.....#.......#',
  '#.rr.rr.........rr.rr.#',
  '#...A...#..r..#...B...#',
  '#.rr.rr.#.....#.rr.rr.#',
  '#.......#.....#.......#',
  '####.####..#..####.####',
  '#.......#.....#.......#',
  '#.....................#',
  '#.......#..S..#.......#',
  '#.......#.....#.......#',
  '#######################',
];
export const N = COLS * ROWS;
export const cx = c => (c - 11) * CELL, cz = r => (r - 11) * CELL;
export const colOf = x => Math.floor((x + 23) / CELL), rowOf = z => Math.floor((z + 23) / CELL);
export const idx = (c, r) => r * COLS + c;
export const SOLID = new Uint8Array(N), RACK = new Uint8Array(N);
export const SITES = {}, GATES = [], SPAWNS = [], VENTS = [];
export let PLAYER_SPAWN = { c: 11, r: 20 };
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const ch = MAP[r][c], i = idx(c, r);
  if (ch === '#') SOLID[i] = 1; else if (ch === 'r') { SOLID[i] = 1; RACK[i] = 1; }
  else if (ch === 'A' || ch === 'B') SITES[ch] = { c, r, x: cx(c), z: cz(r) };
  else if (ch >= '1' && ch <= '3') GATES[+ch - 1] = { c, r, x: cx(c), z: cz(r), id: 'WME'[+ch - 1] };
  else if (ch === 'T') SPAWNS.push({ c, r }); else if (ch === 'v') VENTS.push({ c, r });
  else if (ch === 'S') PLAYER_SPAWN = { c, r };
}
// Callout names under the radar, CS style.
export function zoneOf(x, z) {
  const c = colOf(x), r = rowOf(z);
  if (r <= 3) return 'internet'; if (r === 4) return 'gate';
  if (r <= 10) return c <= 5 ? 'west' : c >= 17 ? 'east' : 'mid';
  if (r <= 16) return c <= 7 ? 'siteA' : c >= 15 ? 'siteB' : 'court';
  return c <= 7 ? 'backA' : c >= 15 ? 'backB' : 'soc';
}

export const LEVELED = ['EDR', 'AF', 'NDR', 'XDR', 'HCI', 'IAG'];
export const PRODUCTS = [...LEVELED, 'ASTOR', 'MDR'];
export const MAXLV = 3;
export const PRICE = { EDR: [1500, 2400, 3300], AF: [1200, 1800, 2600], NDR: [900, 1700, 2500], XDR: [1600, 2200, 2800], HCI: [900, 1500, 2600], IAG: [700, 1100, 1700], ASTOR: 2200, MDR: 1800 };
export const COLOR = { EDR: '#49c7a0', AF: '#ff8a3c', NDR: '#4aa8ff', XDR: '#b58cff', HCI: '#f2c14e', IAG: '#5fd4e8', ASTOR: '#8fd16a', MDR: '#ff5d6c' };
// Lv0 is the free Endpoint Agent sidearm; buying Endpoint Secure upgrades the gun itself.
export const GUN = [
  { dmg: 26, rate: 3.6, mag: 12, reload: 1.3 },
  { dmg: 24, rate: 9.5, mag: 30, reload: 1.9 },
  { dmg: 30, rate: 9.5, mag: 35, reload: 1.8 },
  { dmg: 34, rate: 10.5, mag: 40, reload: 1.6 },
];
export const ARMOR = [0, 50, 100, 100];
export const WALL_HP = [0, 520, 520, 760];
export const THREAT = {
  phish: { hp: 60, sp: 3.5, r: .42, h: 1.75, melee: 15, cd: .8, reward: 100, bash: 30, color: '#ff9a3c' },
  worm: { hp: 26, sp: 4.8, r: .4, h: .85, melee: 8, cd: .55, reward: 50, bash: 14, color: '#9be04a' },
  trojan: { hp: 90, sp: 2.6, r: .45, h: 1.8, shot: 16, cd: 1.5, range: 17, reward: 150, bash: 24, color: '#c88aff' },
  apt: { hp: 110, sp: 2.8, r: .42, h: 1.85, snipe: 38, cd: 3.2, range: 26, reward: 300, bash: 24, color: '#6fe6ff' },
  brute: { hp: 700, sp: 1.9, r: .75, h: 2.6, melee: 45, cd: 1.2, reward: 600, bash: 0, color: '#ff4055' },
  carrier: { hp: 150, sp: 2.7, r: .48, h: 1.8, melee: 10, cd: .9, reward: 300, bash: 22, color: '#ff3b3b' },
};
export const WAVES = [
  { phish: 5 },
  { phish: 6, worm: 5, trojan: 1 },
  { phish: 6, worm: 5, trojan: 3, apt: 1 },
  { phish: 6, worm: 4, trojan: 3, apt: 2, brute: 1 },
  { phish: 7, worm: 6, trojan: 4, apt: 3, brute: 1 },
  { phish: 8, worm: 6, trojan: 5, apt: 3, brute: 2 },
  { phish: 8, worm: 8, trojan: 5, apt: 4, brute: 2 },
];
export const WIN_AT = 4;
export const TUNE = { buySeconds: 25, roundSeconds: 80, plant: 3.5, fuse: 22, defuse: 4.5, startMoney: 1000, winMoney: 2200, lossMoney: 1400, enemyHp: 1, enemyDmg: 1.15, playerSpeed: 5.6 };
export const EYE = 1.6;
const WALL_COST = 30, PR = .38;

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// XDR correlates what the other products see: weak alone, stronger with every one you own.
export function xdrSensors(S) { return ['EDR', 'AF', 'NDR', 'HCI', 'IAG'].reduce((n, id) => n + (S.lv[id] > 0 ? 1 : 0), 0) + (S.snap > 0 ? 1 : 0) + (S.mdr > 0 ? 1 : 0); }
export const xdrPower = S => .5 + .25 * xdrSensors(S);

export function createSim(opts = {}) {
  const S = { phase: 'idle', fx: [] };
  let rnd = mulberry(1), uid = 1;
  const hud = () => opts.onHud?.(hudState()), toast = (k, kind, arg) => opts.onToast?.(k, kind, arg), sfx = (n, a) => opts.onSfx?.(n, a);
  const fx = (type, o) => { if (S.fx.length < 400) S.fx.push({ type, ...o }); };
  const feed = o => { S.feedN++; opts.onFeed?.(o); };

  // ---------- geometry ----------
  const wallOn = new Int8Array(N).fill(-1); // gate index of an ACTIVE firewall in that cell
  const inMap = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS;
  const solid = (c, r) => !inMap(c, r) || SOLID[idx(c, r)] === 1;
  const solidOrWall = (c, r) => solid(c, r) || wallOn[idx(c, r)] >= 0;
  function ray(x, z, dx, dz, max, blocked = solid) { // grid DDA, returns distance to the first blocked cell
    const gx = (x + 23) / CELL, gz = (z + 23) / CELL; let c = Math.floor(gx), r = Math.floor(gz);
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1, tdx = dx ? Math.abs(1 / dx) : 1e9, tdz = dz ? Math.abs(1 / dz) : 1e9;
    let tx = (dx > 0 ? c + 1 - gx : gx - c) * tdx, tz = (dz > 0 ? r + 1 - gz : gz - r) * tdz, t = 0;
    while (t * CELL < max) { if (tx < tz) { c += sx; t = tx; tx += tdx; } else { r += sz; t = tz; tz += tdz; } if (blocked(c, r)) return Math.min(max, t * CELL); }
    return max;
  }
  function los(x0, z0, x1, z1, blocked = solid) { const dx = x1 - x0, dz = z1 - z0, d = Math.hypot(dx, dz); return d < .01 || ray(x0, z0, dx / d, dz / d, d, blocked) >= d - .001; }
  function hits(x, z, r, blocked) { const c0 = colOf(x - r), c1 = colOf(x + r), r0 = rowOf(z - r), r1 = rowOf(z + r); for (let rr = r0; rr <= r1; rr++) for (let c = c0; c <= c1; c++) if (blocked(c, rr)) return true; return false; }
  function slide(o, dx, dz, r, blocked) { if (!hits(o.x + dx, o.z, r, blocked)) o.x += dx; if (!hits(o.x, o.z + dz, r, blocked)) o.z += dz; }

  // ---------- path fields ----------
  const cache = new Map(); let wallsVer = 0;
  function field(key, target, pen) {
    const k = key + (pen ? 'p' : 'n'), hit = cache.get(k);
    if (hit && hit.target === target && (!pen || hit.ver === wallsVer)) return hit.f;
    const f = hit?.f || new Float32Array(N); f.fill(1e9); f[target] = 0; const q = [target];
    for (let h = 0; h < q.length; h++) {
      const i = q[h], c = i % COLS, r = (i / COLS) | 0, base = f[i];
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c2 = c + dc, r2 = r + dr; if (solid(c2, r2)) continue; const j = idx(c2, r2);
        const cost = base + 1 + (pen && wallOn[j] >= 0 ? WALL_COST : 0); if (cost < f[j]) { f[j] = cost; q.push(j); }
      }
    }
    cache.set(k, { target, ver: wallsVer, f }); return f;
  }
  const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function nextCell(f, c, r) { // steepest descent, no corner cutting
    let best = f[idx(c, r)], bc = c, br = r;
    for (const [dc, dr] of DIRS8) {
      const c2 = c + dc, r2 = r + dr; if (solid(c2, r2)) continue; if (dc && dr && (solid(c + dc, r) || solid(c, r + dr))) continue;
      const v = f[idx(c2, r2)] + (dc && dr ? .4 : 0); if (v < best - 1e-4) { best = v; bc = c2; br = r2; }
    }
    return [bc, br];
  }
  // direction a walker at (x,z) should take to reach (tx,tz); used by bots and tests
  function nav(x, z, tx, tz) {
    const c = colOf(x), r = rowOf(z), tc = colOf(tx), tr = rowOf(tz);
    if (c === tc && r === tr) { const d = Math.hypot(tx - x, tz - z) || 1; return { x: (tx - x) / d, z: (tz - z) / d }; }
    const [nc, nr] = nextCell(field('nav', idx(tc, tr), false), c, r), dx = cx(nc) - x, dz = cz(nr) - z, d = Math.hypot(dx, dz) || 1; return { x: dx / d, z: dz / d };
  }

  // ---------- match / round flow ----------
  function reset(seed = (Date.now() & 0x7fffffff)) {
    rnd = mulberry(seed); uid = 1; cache.clear();
    Object.assign(S, {
      phase: 'buy', seed, t: 0, round: 1, you: 0, them: 0, money: TUNE.startMoney, score: 0, lossStreak: 0, feedN: 0,
      lv: { EDR: 0, AF: 0, NDR: 0, XDR: 0, HCI: 0, IAG: 0 }, snap: 0, mdr: 0, gateSel: [false, false, false],
      kills: 0, heads: 0, shotsFired: 0, shotsHit: 0, history: [], last: null, hurtRound: 0,
      stats: { EDR: { kills: 0 }, XDR: { kills: 0 }, MDR: { kills: 0, defuses: 0 }, AF: { kills: 0, blocked: 0 }, IAG: { stuns: 0 }, HCI: { absorbed: 0, failovers: 0 }, ASTOR: { restores: 0 }, NDR: { revealed: 0 } },
      p: { x: 0, z: 0, yaw: 0, pitch: 0, hp: 100, armor: 0, mag: GUN[0].mag, reloadT: 0, fireCd: 0, bloom: 0, inv: 0, nades: 0, failover: false, useT: 0, moving: 0, kick: 0, alive: true },
      threats: [], queue: [], shots: [], nades: [], walls: [], bomb: { state: 'none' }, fx: [], aptWarned: false, aptCredWarned: false, total: 0, buyT: TUNE.buySeconds, roundT: 0, endT: 0,
    });
    startBuy(true); return S;
  }
  function placePlayer() { const p = S.p; p.x = cx(PLAYER_SPAWN.c); p.z = cz(PLAYER_SPAWN.r); p.yaw = 0; p.pitch = 0; }
  function startBuy(first) {
    S.phase = 'buy'; S.buyT = TUNE.buySeconds + (first ? 10 : 0); S.threats = []; S.queue = []; S.shots = []; S.nades = []; S.walls = []; wallOn.fill(-1); wallsVer++;
    S.bomb = { state: 'none' }; placePlayer(); const p = S.p; p.hp = 100; p.alive = true; p.armor = ARMOR[S.lv.HCI]; p.mag = GUN[S.lv.EDR].mag; p.reloadT = 0; p.nades = S.lv.IAG; p.useT = 0;
    hud();
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function startRound() {
    if (S.phase !== 'buy') return;
    S.phase = 'live'; S.roundT = TUNE.roundSeconds; S.hurtRound = 0; S.fx.length = 0;
    const p = S.p; p.hp = 100; p.armor = ARMOR[S.lv.HCI]; p.mag = GUN[S.lv.EDR].mag; p.reloadT = 0; p.fireCd = .25; p.bloom = 0; p.inv = 0; p.nades = S.lv.IAG; p.failover = false; p.useT = 0; p.alive = true;
    // firewalls go up on the gates chosen in the buy menu
    S.walls = []; wallOn.fill(-1);
    GATES.forEach((g, i) => { if (S.gateSel[i] && S.walls.length < S.lv.AF) { S.walls.push({ gate: i, hp: WALL_HP[S.lv.AF], max: WALL_HP[S.lv.AF], flash: 0, zapT: 0 }); wallOn[idx(g.c, g.r)] = i; } });
    wallsVer++;
    const site = rnd() < .5 ? 'A' : 'B'; S.bomb = { state: 'carried', site, carrier: 0, x: 0, z: 0, t: 0, plantT: 0 };
    const spec = WAVES[Math.min(WAVES.length - 1, S.round - 1)], q = [];
    const outside = []; for (const type of ['phish', 'trojan', 'apt', 'brute']) for (let i = 0; i < (spec[type] || 0); i++) outside.push(type);
    shuffle(outside).forEach((type, i) => q.push({ type, at: 1 + i * (12 / Math.max(6, outside.length)) + rnd() * .8, vent: false, role: i % 2 ? 'escort' : 'hunt' }));
    for (let i = 0; i < (spec.worm || 0); i++) q.push({ type: 'worm', at: 7 + Math.floor(i / 3) * 7 + (i % 3) * .5, vent: true, role: 'hunt' });
    q.push({ type: 'carrier', at: 2.5, vent: false, role: 'carrier' });
    S.queue = q.sort((a, b) => a.at - b.at); S.total = q.length; S.threats = []; S.shots = []; S.nades = [];
    fx('round', { n: S.round }); sfx('start'); hud();
  }
  function spawn(q) {
    const def = THREAT[q.type], at = q.vent ? VENTS[(rnd() * VENTS.length) | 0] : SPAWNS[(rnd() * SPAWNS.length) | 0];
    const th = { id: uid++, type: q.type, role: q.role, x: cx(at.c) + (rnd() - .5) * 1.2, z: cz(at.r) + (rnd() - .5) * 1.2, yaw: Math.PI, hp: def.hp * TUNE.enemyHp, max: def.hp * TUNE.enemyHp, r: def.r, h: def.h, cd: .6 + rnd(), stun: 0, see: false, seeT: rnd() * .15, dist: 99, aim: 0, flash: 0, vx: 0, vz: 0, plantT: 0, bashing: -1, cloak: q.type === 'apt', anim: rnd() * 6, spawnT: .6 };
    S.threats.push(th); if (q.type === 'carrier') S.bomb.carrier = th.id;
    if (q.vent) fx('vent', { x: th.x, z: th.z });
    if (q.type === 'brute') toast('brute', 'bad'); if (q.type === 'apt' && !S.aptWarned) { S.aptWarned = true; toast(S.lv.NDR ? 'aptSeen' : 'aptBlind', S.lv.NDR ? 'good' : 'bad'); }
    if (q.type === 'apt' && S.lv.NDR) S.stats.NDR.revealed++;
    return th;
  }
  function endRound(result) {
    if (S.phase !== 'live') return;
    const win = result !== 'encrypted' && result !== 'down'; let reward, pts = 0;
    if (win) { S.you++; S.lossStreak = 0; reward = result === 'restored' ? 1200 : TUNE.winMoney + (result === 'defused' ? 400 : 0); pts = 1000 + (result === 'defused' ? 600 : 0) + (S.hurtRound === 0 ? 400 : 0); }
    else { S.them++; S.lossStreak++; reward = Math.min(2200, TUNE.lossMoney + 400 * (S.lossStreak - 1)); }
    S.money += reward; S.score += pts; S.history.push({ round: S.round, result, win });
    S.last = { result, win, reward, flawless: win && S.hurtRound === 0 }; S.phase = 'end'; S.endT = 4.2; S.p.useT = 0;
    fx('roundEnd', { result, win }); sfx(win ? 'ability' : 'breach'); hud();
  }
  function finish() {
    const win = S.you >= WIN_AT; if (win) S.score += 3000 + Math.round(S.money / 10);
    S.phase = 'over'; sfx(win ? 'ability' : 'over'); hud();
    opts.onOver?.({ outcome: win ? 'victory' : 'defeat', you: S.you, them: S.them, score: S.score, rounds: S.history.length, kills: S.kills, heads: S.heads, acc: S.shotsFired ? S.shotsHit / S.shotsFired : 0, stats: JSON.parse(JSON.stringify(S.stats)), lv: { ...S.lv }, history: S.history.slice(), money: S.money });
  }

  // ---------- economy ----------
  const priceOf = id => (id === 'ASTOR' ? (S.snap ? null : PRICE.ASTOR) : id === 'MDR' ? (S.mdr ? null : PRICE.MDR) : S.lv[id] >= MAXLV ? null : PRICE[id][S.lv[id]]);
  function buy(id, free = false) {
    if (S.phase !== 'buy' && !free) return false; const cost = priceOf(id); if (cost == null || (!free && S.money < cost)) return false;
    if (!free) S.money -= cost;
    if (id === 'ASTOR') S.snap = 1; else if (id === 'MDR') S.mdr = 1; else S.lv[id]++;
    if (id === 'AF') { const order = [1, 0, 2]; let n = S.gateSel.filter(Boolean).length; for (const g of order) if (n < S.lv.AF && !S.gateSel[g]) { S.gateSel[g] = true; n++; } }
    if (id === 'HCI') S.p.armor = ARMOR[S.lv.HCI]; if (id === 'EDR') S.p.mag = GUN[S.lv.EDR].mag; if (id === 'IAG') S.p.nades = S.lv.IAG;
    sfx('hit', S.lv[id] || 1); hud(); return true;
  }
  function toggleGate(i) {
    if (S.phase !== 'buy' || !S.lv.AF) return false;
    if (S.gateSel[i]) S.gateSel[i] = false;
    else { if (S.gateSel.filter(Boolean).length >= S.lv.AF) { const j = S.gateSel.findIndex((v, k) => v && k !== i); if (j >= 0) S.gateSel[j] = false; } S.gateSel[i] = true; }
    hud(); return true;
  }

  // ---------- combat ----------
  function hurt(d, x, z, by) {
    const p = S.p; if (!p.alive || p.inv > 0 || S.phase !== 'live') return;
    d *= TUNE.enemyDmg; if (p.armor > 0) { const a = Math.min(p.armor, d * .5); p.armor -= a; d -= a; S.stats.HCI.absorbed += a; }
    p.hp -= d; S.hurtRound += d; fx('hurt', { x, z, d }); sfx('wrong');
    if (p.hp <= 0) {
      if (S.lv.HCI >= 3 && !p.failover) { p.failover = true; p.hp = 60; p.inv = 1.6; S.stats.HCI.failovers++; fx('failover', {}); toast('failover', 'good'); sfx('ability'); return; }
      p.hp = 0; p.alive = false; feed({ a: by, v: 'you', bad: true }); endRound('down');
    }
  }
  function kill(th, by, hs) {
    if (th.dead) return; th.dead = true; const def = THREAT[th.type];
    S.kills++; if (hs) S.heads++; S.money += def.reward; S.score += def.reward + (hs ? 50 : 0); (S.stats[by] || S.stats.EDR).kills++;
    feed({ a: 'you', prod: by, v: th.type, hs }); fx('kill', { x: th.x, z: th.z, h: th.h, kind: th.type, by }); sfx('hit', 6);
    if (S.bomb.state === 'carried' && S.bomb.carrier === th.id) { S.bomb.state = 'dropped'; S.bomb.x = th.x; S.bomb.z = th.z; S.bomb.carrier = 0; fx('drop', { x: th.x, z: th.z }); toast('dropped', 'good'); }
    if (by === 'EDR') {
      if (S.lv.XDR) { // correlated response: arcs to threats a sensor can see
        const pw = xdrPower(S), seen = S.threats.filter(o => !o.dead && o !== th && o.spawnT <= 0 && (S.lv.NDR > 0 || o.see) && Math.hypot(o.x - th.x, o.z - th.z) < 13).sort((a, b) => Math.hypot(a.x - th.x, a.z - th.z) - Math.hypot(b.x - th.x, b.z - th.z)).slice(0, 1 + S.lv.XDR);
        let px = th.x, pz = th.z; for (const o of seen) { fx('chain', { x0: px, z0: pz, x1: o.x, z1: o.z, h: o.h * .6 }); px = o.x; pz = o.z; damage(o, 28 * pw, 'XDR', false); }
      }
      if (S.lv.EDR >= 3) { fx('burst', { x: th.x, z: th.z }); for (const o of S.threats) if (!o.dead && o !== th && Math.hypot(o.x - th.x, o.z - th.z) < 4) damage(o, 35, 'EDRB', false); }
    }
  }
  function damage(th, d, by, hs) {
    if (th.dead || th.spawnT > 0) return; if (S.lv.NDR >= 3) d *= 1.3;
    th.hp -= d; th.flash = .12; th.aware = true; if (th.hp <= 0) kill(th, by === 'EDRB' ? 'EDR' : by, hs);
  }
  function shoot() {
    const p = S.p, g = GUN[S.lv.EDR]; p.mag--; p.fireCd = 1 / g.rate; S.shotsFired++;
    const spread = p.bloom + p.moving * .014; p.bloom = Math.min(.05, p.bloom + .0055); p.kick = 1;
    const yaw = p.yaw + (rnd() - .5) * 2 * spread, pitch = p.pitch + (rnd() - .5) * 2 * spread, cp = Math.cos(pitch);
    const dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp, h = Math.hypot(dx, dz) || 1e-6, ux = dx / h, uz = dz / h;
    let best = ray(p.x, p.z, ux, uz, 80) / h, hit = null, head = false;
    if (dy < 0) best = Math.min(best, EYE / -dy);
    for (const th of S.threats) {
      if (th.dead || th.spawnT > 0) continue; const ox = th.x - p.x, oz = th.z - p.z, along = ox * ux + oz * uz; if (along < 0) continue;
      const perp2 = ox * ox + oz * oz - along * along, rr = th.r + .08; if (perp2 > rr * rr) continue;
      const t3 = (along - Math.sqrt(rr * rr - perp2)) / h; if (t3 >= best) continue; const y = EYE + dy * t3; if (y < 0 || y > th.h + .1) continue;
      best = t3; hit = th; head = y > th.h * .76;
    }
    const ex = p.x + dx * best, ey = EYE + dy * best, ez = p.z + dz * best;
    fx('shot', { x: ex, y: ey, z: ez, hit: !!hit, head }); sfx('shot', S.lv.EDR);
    if (hit) { S.shotsHit++; damage(hit, g.dmg * (head ? 2 : 1), 'EDR', head); }
  }
  function throwNade() {
    const p = S.p; if (p.nades <= 0) return; p.nades--;
    const d = Math.min(16, ray(p.x, p.z, -Math.sin(p.yaw), -Math.cos(p.yaw), 16) - .6), far = Math.max(1, p.pitch < -.05 ? Math.min(d, EYE / Math.tan(-p.pitch)) : d);
    S.nades.push({ x0: p.x, z0: p.z, x: p.x, z: p.z, x1: p.x - Math.sin(p.yaw) * far, z1: p.z - Math.cos(p.yaw) * far, t: 0, dur: .3 + far * .035 }); sfx('serve');
  }
  function stunAt(x, z) {
    const R = S.lv.IAG >= 3 ? 7 : 5.2; let n = 0;
    for (const th of S.threats) if (!th.dead && th.spawnT <= 0 && Math.hypot(th.x - x, th.z - z) < R && los(x, z, th.x, th.z)) { th.stun = Math.max(th.stun, th.type === 'apt' ? 1.2 : th.type === 'brute' ? 1.5 : 3.6); th.aim = 0; n++; }
    S.stats.IAG.stuns += n; fx('stun', { x, z, r: R, n }); sfx('ability'); if (n && S.threats.some(th => th.type === 'apt' && th.stun > 0 && th.stun <= 1.2) && !S.aptCredWarned) { S.aptCredWarned = true; toast('aptCreds', ''); }
  }
  function callMdr() {
    if (!S.mdr || S.phase !== 'live') return false; S.mdr = 0; fx('mdr', {}); sfx('ability');
    if (S.bomb.state === 'planted') { S.stats.MDR.defuses++; S.bomb.state = 'defused'; feed({ a: 'you', prod: 'MDR', v: 'encryptor' }); toast('mdrDefuse', 'good'); endRound('defused'); }
    else { toast('mdrSweep', 'good'); for (const th of S.threats.slice()) if (!th.dead && th.spawnT <= 0) { th.stun = Math.max(th.stun, 2); damage(th, 80, 'MDR', false); } }
    return true;
  }

  // ---------- threats ----------
  function stepThreat(th, dt) {
    const p = S.p, def = THREAT[th.type], b = S.bomb; th.anim += dt; th.flash = Math.max(0, th.flash - dt);
    if (th.spawnT > 0) { th.spawnT -= dt; return; }
    const dxp = p.x - th.x, dzp = p.z - th.z; th.dist = Math.hypot(dxp, dzp);
    th.seeT -= dt; if (th.seeT <= 0) { th.seeT = .15; th.see = th.dist < 40 && los(th.x, th.z, p.x, p.z); }
    th.cloak = th.type === 'apt' && S.lv.NDR === 0;
    if (th.stun > 0) { th.stun -= dt; th.vx = th.vz = 0; return; }
    th.cd -= dt; const brute = th.type === 'brute', blocked = brute ? solid : solidOrWall;
    const isCarrier = b.state === 'carried' && b.carrier === th.id;
    let goal = 'player', tx = p.x, tz = p.z;
    if (isCarrier) { goal = 'site'; tx = SITES[b.site].x; tz = SITES[b.site].z; }
    else if (b.state === 'dropped' && b.fetch === th.id) { goal = 'bomb'; tx = b.x; tz = b.z; }
    else if (th.role === 'escort' && b.state === 'carried' && !th.aware && !(th.see && th.dist < 13)) { goal = 'site'; tx = SITES[b.site].x; tz = SITES[b.site].z; }
    else if (th.role === 'escort' && th.see) th.aware = true;
    // attacks
    let hold = false;
    if (!isCarrier && goal !== 'bomb' && p.alive) {
      if (def.melee && th.dist < th.r + PR + .55) { hold = true; if (th.cd <= 0) { th.cd = def.cd; hurt(def.melee, th.x, th.z, th.type); fx('melee', { id: th.id }); } }
      else if (def.shot && th.see && th.dist < def.range) { hold = th.dist < 10; if (th.cd <= 0 && los(th.x, th.z, p.x, p.z, solidOrWall)) { th.cd = def.cd; const s = 15 / th.dist; S.shots.push({ x: th.x, z: th.z, y: 1.3, vx: dxp * s, vz: dzp * s, life: 2.2, dmg: def.shot, by: th.type }); fx('eshot', { x: th.x, z: th.z }); } }
      else if (def.snipe && th.see && th.dist < def.range) {
        hold = true; if (th.cd <= 0) { th.aim += dt; if (th.aim >= 1) { th.aim = 0; th.cd = def.cd; const ok = los(th.x, th.z, p.x, p.z, solidOrWall); fx('snipe', { x: th.x, z: th.z, hit: ok }); if (ok) hurt(def.snipe, th.x, th.z, th.type); } }
      } else th.aim = 0;
    }
    if (hold || th.dist < 1e-3) { th.yaw = Math.atan2(-dxp, -dzp); th.vx *= .7; th.vz *= .7; th.bashing = -1; if (def.snipe || def.shot) return; }
    // movement
    let mx = 0, mz = 0; th.bashing = -1;
    if (isCarrier && Math.hypot(tx - th.x, tz - th.z) < .5) { // planting
      th.plantT += dt; b.plantT = th.plantT; th.vx = th.vz = 0; if (th.plantT >= TUNE.plant) { b.state = 'planted'; b.x = th.x; b.z = th.z; b.t = TUNE.fuse; b.carrier = 0; th.role = 'hunt'; fx('planted', { x: b.x, z: b.z, site: b.site }); toast('planted_' + b.site, 'bad'); sfx('boss'); }
      return;
    }
    if (isCarrier) { th.plantT = 0; b.plantT = 0; }
    if (goal === 'bomb' && Math.hypot(tx - th.x, tz - th.z) < .9) { b.state = 'carried'; b.carrier = th.id; b.fetch = 0; fx('pickup', { id: th.id }); return; }
    const c = colOf(th.x), r = rowOf(th.z), tc = colOf(tx), tr = rowOf(tz);
    if (!hold) {
      if ((c === tc && r === tr) || (goal === 'player' && th.see && th.dist < 7 && def.melee && los(th.x, th.z, p.x, p.z, blocked))) { mx = tx - th.x; mz = tz - th.z; }
      else {
        const f = field(goal === 'site' ? 'site' + b.site : goal, idx(tc, tr), !brute), [nc, nr] = nextCell(f, c, r);
        if (!brute && wallOn[idx(nc, nr)] >= 0) { // a firewall is in the way and no cheaper route exists: bash it
          const w = S.walls.find(o => o.gate === wallOn[idx(nc, nr)]); th.bashing = w.gate; w.hp -= def.bash * dt; w.flash = .15; S.stats.AF.blocked += def.bash * dt;
          if (S.lv.AF >= 3) { th.zap = (th.zap || 0) + dt; if (th.zap >= .5) { th.zap = 0; fx('zap', { x: th.x, z: th.z, h: th.h }); damage(th, 9, 'AF', false); } }
          th.yaw = Math.atan2(-(cx(nc) - th.x), -(cz(nr) - th.z)); th.vx = th.vz = 0; return;
        }
        mx = cx(nc) - th.x; mz = cz(nr) - th.z;
      }
      const m = Math.hypot(mx, mz) || 1; mx /= m; mz /= m;
    }
    for (const o of S.threats) { // separation
      if (o === th || o.dead || o.spawnT > 0) continue; const ox = th.x - o.x, oz = th.z - o.z, d = Math.hypot(ox, oz), min = th.r + o.r + .15; if (d < min && d > 1e-4) { const k = (min - d) / min * 1.6; mx += ox / d * k; mz += oz / d * k; }
    }
    const sp = def.sp * (hold ? .35 : 1); th.vx += (mx * sp - th.vx) * Math.min(1, dt * 8); th.vz += (mz * sp - th.vz) * Math.min(1, dt * 8);
    slide(th, th.vx * dt, th.vz * dt, th.r * .8, blocked);
    if (!hold && (Math.abs(th.vx) + Math.abs(th.vz)) > .2) th.yaw = Math.atan2(-th.vx, -th.vz);
  }

  // ---------- frame ----------
  function step(dt, inp = {}) {
    if (S.phase === 'idle' || S.phase === 'over') return; S.t += dt; const p = S.p;
    if (S.phase === 'buy') { S.buyT -= dt; if (S.buyT <= 0) startRound(); hud(); return; }
    if (S.phase === 'end') { S.endT -= dt; if (S.endT <= 0) { if (S.you >= WIN_AT || S.them >= WIN_AT) finish(); else { S.round++; startBuy(); } } hud(); return; }
    // --- player
    if (p.alive) {
      if (inp.yaw != null) p.yaw = inp.yaw; if (inp.pitch != null) p.pitch = Math.max(-1.2, Math.min(1.2, inp.pitch));
      let fwd = inp.mz || 0, str = inp.mx || 0; const m = Math.hypot(fwd, str); if (m > 1) { fwd /= m; str /= m; }
      const defusing = inp.use && S.bomb.state === 'planted' && Math.hypot(S.bomb.x - p.x, S.bomb.z - p.z) < 2.6;
      if (defusing) { fwd = str = 0; p.useT += dt; if (p.useT >= TUNE.defuse) { S.bomb.state = 'defused'; S.score += 0; feed({ a: 'you', prod: 'EDR', v: 'encryptor' }); toast('defused', 'good'); endRound('defused'); hud(); return; } } else p.useT = 0;
      const sn = Math.sin(p.yaw), cs = Math.cos(p.yaw), vx = (-sn * fwd + cs * str) * TUNE.playerSpeed, vz = (-cs * fwd - sn * str) * TUNE.playerSpeed;
      slide(p, vx * dt, vz * dt, PR, solid); p.moving = Math.min(1, Math.hypot(fwd, str));
      p.inv = Math.max(0, p.inv - dt); p.fireCd -= dt; p.bloom = Math.max(0, p.bloom - dt * .11); p.kick = Math.max(0, p.kick - dt * 9);
      const g = GUN[S.lv.EDR];
      if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) { p.mag = g.mag; fx('reloaded', {}); } }
      else if ((inp.reload && p.mag < g.mag) || p.mag <= 0) { p.reloadT = g.reload; fx('reload', {}); sfx('reload'); }
      else if (inp.fire && p.fireCd <= 0 && !defusing) shoot();
      if (inp.nade) throwNade(); if (inp.mdr) callMdr();
      if (S.phase !== 'live') { hud(); return; }
    }
    // --- spawns
    const el = TUNE.roundSeconds - S.roundT; while (S.queue.length && S.queue[0].at <= el) spawn(S.queue.shift());
    // --- bomb logistics
    const b = S.bomb;
    if (b.state === 'dropped' && !S.threats.some(th => th.id === b.fetch && !th.dead)) { let best = null, bd = 1e9; for (const th of S.threats) if (!th.dead && th.type !== 'brute' && th.type !== 'worm') { const d = Math.hypot(th.x - b.x, th.z - b.z); if (d < bd) { bd = d; best = th; } } b.fetch = best ? best.id : 0; }
    for (const th of S.threats) if (!th.dead) stepThreat(th, dt); if (S.phase !== 'live') { hud(); return; }
    S.threats = S.threats.filter(th => !th.dead);
    // --- firewalls
    for (const w of S.walls) { w.flash = Math.max(0, w.flash - dt); if (w.hp <= 0 && !w.down) { w.down = true; wallOn[idx(GATES[w.gate].c, GATES[w.gate].r)] = -1; wallsVer++; fx('wallBreak', { gate: w.gate }); toast('wallDown', 'bad'); sfx('breach'); } }
    // --- hostile shots
    for (const s of S.shots) {
      s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt; const c = colOf(s.x), r = rowOf(s.z);
      if (solid(c, r)) s.life = 0; else if (wallOn[idx(c, r)] >= 0) { s.life = 0; const w = S.walls.find(o => o.gate === wallOn[idx(c, r)]); w.hp -= 6; w.flash = .15; S.stats.AF.blocked += 6; fx('block', { x: s.x, z: s.z }); }
      else if (p.alive && Math.hypot(s.x - p.x, s.z - p.z) < .55) { s.life = 0; hurt(s.dmg, s.x - s.vx, s.z - s.vz, s.by); if (S.phase !== 'live') { hud(); return; } }
    }
    S.shots = S.shots.filter(s => s.life > 0);
    for (const n of S.nades) { n.t += dt; const k = Math.min(1, n.t / n.dur); n.x = n.x0 + (n.x1 - n.x0) * k; n.z = n.z0 + (n.z1 - n.z0) * k; n.y = EYE * (1 - k) + Math.sin(k * Math.PI) * 1.6; if (k >= 1) { n.done = true; stunAt(n.x1, n.z1); } }
    S.nades = S.nades.filter(n => !n.done);
    // --- round result
    if (b.state === 'planted') {
      b.t -= dt;
      if (b.t <= 0) { fx('detonate', { x: b.x, z: b.z }); if (S.snap > 0) { S.snap = 0; S.stats.ASTOR.restores++; toast('restored', 'good'); feed({ a: 'you', prod: 'ASTOR', v: 'restore' }); endRound('restored'); } else { toast('encrypted', 'bad'); endRound('encrypted'); } }
    } else {
      S.roundT -= dt;
      if (!S.queue.length && !S.threats.length) endRound('eliminated'); else if (S.roundT <= 0) endRound('time');
    }
    hud();
  }

  function hudState() {
    const p = S.p, g = GUN[S.lv.EDR], b = S.bomb, near = b.state === 'planted' && Math.hypot(b.x - p.x, b.z - p.z) < 2.6;
    return {
      phase: S.phase, round: S.round, you: S.you, them: S.them, money: S.money, score: S.score, hp: Math.ceil(p.hp), armor: Math.ceil(p.armor), mag: p.mag, magMax: g.mag, reload: p.reloadT > 0 ? 1 - p.reloadT / g.reload : -1,
      nades: p.nades, mdr: S.mdr, snap: S.snap, lv: S.lv, gateSel: S.gateSel, walls: S.walls.map(w => ({ gate: w.gate, frac: Math.max(0, w.hp / w.max), down: !!w.down })),
      timer: S.phase === 'buy' ? S.buyT : b.state === 'planted' ? b.t : S.roundT, bomb: b.state, site: b.site, siteKnown: S.lv.NDR >= 2 || b.state === 'planted', plantFrac: b.state === 'carried' ? (b.plantT || 0) / TUNE.plant : 0,
      near, defuse: p.useT / TUNE.defuse, alive: S.threats.length + S.queue.length, total: S.total || 0, last: S.last, zone: zoneOf(p.x, p.z), sensors: xdrSensors(S), bloom: p.bloom + p.moving * .014, failover: S.lv.HCI >= 3 && !p.failover, kills: S.kills,
    };
  }
  return { S, reset, step, buy, toggleGate, ready: startRound, priceOf, nav, los, ray, hudState, callMdr, endRound, kill, damage, hurt, spawn, wallAt: i => wallOn[i] };
}
