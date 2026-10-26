// Threat Vector — pure rules. A fast, lively "survivor"-style arena: you only move,
// your defenses auto-fire, monsters swarm and charge you, and killing them DROPS
// Sangfor product pickups (plus the odd cache/chest) that instantly slot in and
// level up. The portfolio IS the loot table, and each item enhances exactly what
// its real-world function would. No DOM/canvas here — unit-tested in
// tools/arcade-logic.test.mjs.

// ---- the collectible capabilities ------------------------------------------
// `kind`: 'sensor' products feed XDR correlation (EDR / NDR / AF). `max` levels.
// `drop` is the relative chance it appears when loot rolls. The *effect* each one
// has is faithful to the product's real job (see README / in-game codex).
export const CAPS = {
  HCI:   { id: 'HCI',   kind: 'cloud',  max: 5, drop: 10 }, // elastic compute -> fire rate
  XDR:   { id: 'XDR',   kind: 'brain',  max: 5, drop: 9  }, // correlation -> damage x sensors
  EDR:   { id: 'EDR',   kind: 'sensor', max: 4, drop: 11 }, // endpoint -> defense aura
  NDR:   { id: 'NDR',   kind: 'sensor', max: 4, drop: 10 }, // network sight -> reveal + chain
  AF:    { id: 'AF',    kind: 'sensor', max: 4, drop: 10 }, // perimeter -> firewall shots
  IAG:   { id: 'IAG',   kind: 'edge',   max: 3, drop: 7  }, // egress -> exfil lock
  ASTOR: { id: 'ASTOR', kind: 'resil',  max: 3, drop: 8  }, // snapshots -> restore hull
  MDR:   { id: 'MDR',   kind: 'service',max: 3, drop: 8  }, // managed -> wingman drone
  SASE:  { id: 'SASE',  kind: 'cloud',  max: 3, drop: 7  }, // attack surface -> fewer spawns
};
export const CAP_ORDER = ['XDR', 'EDR', 'NDR', 'AF', 'HCI', 'MDR', 'IAG', 'ASTOR', 'SASE'];
export const SENSORS = ['EDR', 'NDR', 'AF'];

export const START_HULL = 100;

// ---- enemy roster (kill-chain flavoured) -----------------------------------
// hp/speed/r are base at t=0; difficultyAt() scales them. `dps` = contact damage
// per second while touching you. `counter` is the product whose function most
// directly answers this threat (used for the drop hint + codex).
export const ENEMIES = {
  recon:   { id: 'recon',   hp: 3,  speed: 54, r: 10, dps: 10, score: 8,  color: '#8aa0c6', counter: 'AF'  },
  malware: { id: 'malware', hp: 6,  speed: 44, r: 13, dps: 16, score: 16, color: '#ff8a5a', counter: 'EDR' },
  apt:     { id: 'apt',     hp: 7,  speed: 50, r: 13, dps: 18, score: 26, color: '#a98bff', counter: 'NDR', cloak: true },
  worm:    { id: 'worm',    hp: 9,  speed: 40, r: 14, dps: 14, score: 22, color: '#39c0ff', counter: 'NDR', splits: true },
  exfil:   { id: 'exfil',   hp: 10, speed: 66, r: 14, dps: 6,  score: 40, color: '#ffd166', counter: 'IAG', steals: true },
  ransom:  { id: 'ransom',  hp: 60, speed: 26, r: 26, dps: 30, score: 150, color: '#ff4d5e', counter: 'ASTOR', boss: true },
};

// Which threats are in the pool as time passes (seconds).
export function threatPool(t) {
  const pool = ['recon', 'recon', 'recon', 'malware'];
  if (t >= 15) pool.push('malware', 'apt');
  if (t >= 35) pool.push('apt', 'worm');
  if (t >= 55) pool.push('worm', 'exfil');
  if (t >= 80) pool.push('exfil', 'malware', 'apt');
  return pool;
}

// ---- difficulty (continuous, by elapsed seconds) ---------------------------
export function difficultyAt(t) {
  const s = Math.max(0, t);
  return {
    spawnGap: Math.max(170, 820 - s * 6.2),   // ms between spawns, ramps up
    burst: 1 + Math.floor(s / 35),            // enemies per spawn tick
    hpMul: 1 + s * 0.015,
    speedMul: Math.min(1.9, 1 + s * 0.004),
    bossEvery: 42,                            // a ransom brute every N seconds
    cap: Math.min(220, 70 + Math.floor(s * 1.4)), // max alive
  };
}

// ---- derived player stats from owned capabilities --------------------------
// owned: { [capId]: level }. Pure so tests can assert the product mapping.
export function sensorCount(owned) {
  return SENSORS.reduce((n, s) => n + ((owned[s] || 0) > 0 ? 1 : 0), 0);
}

export function deriveStats(owned = {}) {
  const lvl = id => owned[id] || 0;
  const sensors = sensorCount(owned);

  // HCI (cloud compute) -> fire rate. More compute, more cycles.
  const fireRateMul = 1 + lvl('HCI') * 0.34;

  // XDR correlation -> damage, but ONLY as a multiplier over the sensors feeding
  // it. With zero sensors deployed, XDR multiplies nothing (its real limitation).
  const xdrDmgMul = 1 + lvl('XDR') * 0.20 * sensors;

  const baseDmg = 1;
  return {
    fireRateMul,
    xdrDmgMul,
    xdrLevel: lvl('XDR'),
    sensors,
    baseDmg,
    dmg: baseDmg * xdrDmgMul,
    // EDR endpoint auto-response: a defense aura on YOUR ship (the endpoint).
    edr: lvl('EDR') ? { level: lvl('EDR'), radius: 46 + lvl('EDR') * 16, interval: Math.max(220, 560 - lvl('EDR') * 90), dmg: 2 + lvl('EDR') } : null,
    // NDR network visibility -> reveal cloaked + shot chaining.
    ndr: lvl('NDR') ? { level: lvl('NDR'), chain: lvl('NDR'), chainRange: 74 + lvl('NDR') * 16, reveal: true } : null,
    // AF perimeter -> extra forward "firewall" bolts covering your facing arc.
    af: lvl('AF') ? { level: lvl('AF'), bolts: lvl('AF'), spread: 0.26, dmg: 1 } : null,
    // IAG egress -> lock exfil drones from escaping, slow their outbound dash.
    iag: lvl('IAG') ? { level: lvl('IAG'), lock: true, slow: 1 - lvl('IAG') * 0.22 } : null,
    // aStor -> restore hull on a hit, scarce charges that recharge slowly.
    astor: lvl('ASTOR') ? { level: lvl('ASTOR'), maxCharges: lvl('ASTOR'), restore: 12 + lvl('ASTOR') * 4, regenMs: 10000 - lvl('ASTOR') * 1500 } : null,
    // MDR -> orbiting wingman drone; aims/hits better with more sensors feeding it.
    mdr: lvl('MDR') ? { level: lvl('MDR'), interval: Math.max(460, 1000 - lvl('MDR') * 170), dmg: 1 + lvl('MDR') + Math.floor(sensors / 2) } : null,
    // SASE -> shrink the attack surface: fewer spawns.
    sase: lvl('SASE') ? { level: lvl('SASE'), spawnMul: 1 + lvl('SASE') * 0.20 } : null,
  };
}

// ---- loot: what a kill / chest drops ---------------------------------------
// Returns a capability id to grant (+1 level), or null when every cap is maxed
// (the caller then drops a hull patch / intel token instead). Deterministic
// given rng. A light synergy nudge keeps builds coherent without any menu.
export function pickDrop(owned = {}, rng = Math.random) {
  const avail = CAP_ORDER.filter(id => (owned[id] || 0) < CAPS[id].max);
  if (!avail.length) return null;
  const sensors = sensorCount(owned);
  const weightOf = id => {
    let w = CAPS[id].drop;
    if (id === 'XDR' && sensors >= 1 && (owned.XDR || 0) === 0) w += 10;   // you have sensors, surface the brain
    if (SENSORS.includes(id) && (owned.XDR || 0) > 0 && sensors === 0) w += 8; // XDR owned but nothing feeds it
    return w;
  };
  const total = avail.reduce((s, id) => s + weightOf(id), 0);
  let r = rng() * total;
  for (const id of avail) { r -= weightOf(id); if (r <= 0) return id; }
  return avail[avail.length - 1];
}

// ---- scoring ---------------------------------------------------------------
export function comboMult(combo) { return Math.min(6, 1 + Math.floor(combo / 8)); }
export function killScore(enemy, combo) {
  const base = (ENEMIES[enemy] || ENEMIES.recon).score;
  return Math.round(base * comboMult(combo));
}
export const PICKUP_SCORE = 30;      // grabbing a product token
export const SURVIVE_PER_SEC = 5;    // score per second survived
