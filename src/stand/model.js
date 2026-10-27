// Last Stand — pure rules. A vertical "survivor" base-defense shooter: your
// operator holds the line at the bottom, threats pour DOWN from the top, and the
// whole game is your WEAPON evolving. Each Sangfor product is a different weapon
// DIMENSION (form, power, rate, pierce, slow, beam, shield, drone); leveling it up
// via the choose-an-upgrade cards is how the weapon grows. Honors the design bar:
// every dimension boosts exactly what its product really does (+ honest limits).
//
// No DOM, no canvas, no randomness except an injected rng — so it unit-tests.

export const START_BASE = 1000;      // base integrity (the big green bar in the refs)

// --- the weapon dimensions, one per product ---------------------------------
// kind tells the engine how the dimension shapes the weapon. max = max level.
// sensor = feeds XDR correlation (EDR/NDR/AF), which is XDR's whole dependency.
export const WEAPONS = {
  HCI:   { id: 'HCI',   kind: 'rate',   max: 8, sensor: false },  // cloud compute -> fire rate
  EDR:   { id: 'EDR',   kind: 'damage', max: 8, sensor: true  },  // endpoint     -> damage/shot
  NDR:   { id: 'NDR',   kind: 'pierce', max: 6, sensor: true  },  // network      -> pierce + multishot
  AF:    { id: 'AF',    kind: 'spread', max: 6, sensor: true  },  // perimeter    -> spread fan + wall
  IAG:   { id: 'IAG',   kind: 'slow',   max: 5, sensor: false },  // egress       -> slows what it hits
  XDR:   { id: 'XDR',   kind: 'beam',   max: 6, sensor: false },  // correlation  -> the giant beam
  ASTOR: { id: 'ASTOR', kind: 'shield', max: 5, sensor: false },  // storage      -> snapshot shield/regen
  MDR:   { id: 'MDR',   kind: 'drone',  max: 4, sensor: false },  // managed      -> wingman drones
};
export const WEAPON_ORDER = ['HCI', 'EDR', 'NDR', 'AF', 'IAG', 'XDR', 'ASTOR', 'MDR'];
export const SENSORS = ['EDR', 'NDR', 'AF'];

const lv = (levels, id) => (levels && levels[id]) || 0;
export const sensorLevels = levels => SENSORS.reduce((a, id) => a + lv(levels, id), 0);
export const weaponTier = levels => WEAPON_ORDER.reduce((a, id) => a + lv(levels, id), 0);

// Composite weapon stats from the owned levels. The engine reads this every time
// a level changes. Numbers chosen so each product is felt but XDR stays honest.
export function deriveWeapon(levels) {
  const sens = sensorLevels(levels);
  const fireRate = 2.0 + lv(levels, 'HCI') * 0.62;           // shots / second  (HCI = compute throughput)
  const dmg = 10 + lv(levels, 'EDR') * 9;                    // damage / shot   (EDR = endpoint kill power)
  const pierce = lv(levels, 'NDR');                          // enemies a shot passes through (NDR = network-wide)
  const multishot = 1 + Math.floor(lv(levels, 'NDR') / 2);   // extra parallel shots from NDR
  const spread = lv(levels, 'AF');                           // side bolts in a perimeter fan (AF)
  const baseArmor = lv(levels, 'AF') * 0.04;                 // AF also hardens the perimeter (dmg taken -4%/lvl)
  const iag = lv(levels, 'IAG');
  const slowMul = iag ? Math.max(0.35, 1 - iag * 0.13) : 1;  // enemy speed while slowed
  const slowMs = iag ? 650 + iag * 180 : 0;
  const xdr = lv(levels, 'XDR');
  // XDR: weak alone, multiplied by the sensors feeding it (its real limitation).
  const beamOn = xdr > 0;
  const beamDmg = beamOn ? Math.round((6 + xdr * 7) * Math.max(0.15, sens * 0.5)) : 0;
  const beamEvery = beamOn ? Math.max(1400, 4200 - xdr * 440) : 0;   // ms between beams
  const beamWidth = beamOn ? 26 + xdr * 10 + sens * 8 : 0;           // px, grows with sensors
  const astor = lv(levels, 'ASTOR');
  const regen = astor * 3.2;                                 // base HP restored / second
  const shieldMax = astor;                                   // snapshot charges that soak a base hit
  const shieldEvery = astor ? Math.max(5000, 11000 - astor * 1200) : 0;
  const mdr = lv(levels, 'MDR');
  const drones = Math.ceil(mdr / 2);                         // MDR 1-2 -> 1 drone, 3-4 -> 2 drones
  const droneDmg = mdr ? 8 + mdr * 4 : 0;
  return {
    fireRate, shotMs: 1000 / fireRate, dmg, pierce, multishot, spread, baseArmor,
    slowMul, slowMs, sensors: sens,
    beamOn, beamDmg, beamEvery, beamWidth, xdrIdle: beamOn && sens === 0,
    regen, shieldMax, shieldEvery, drones, droneDmg,
  };
}

// APT stealth: only fully seen once NDR (network visibility) is on the board.
// A cloaked threat takes half damage until you own NDR. Pure + tested.
export function visibilityMul(enemy, levels) {
  return enemy.cloak && lv(levels, 'NDR') === 0 ? 0.5 : 1;
}
export function damageTo(enemy, levels, rawDmg) {
  return rawDmg * visibilityMul(enemy, levels);
}

// --- XP / levelling ----------------------------------------------------------
export const xpToLevel = level => Math.round(6 + Math.pow(level, 1.55) * 3);

// Up to 3 upgrade offers. Deterministic given rng(). Rules that teach the model:
//  - never offer a maxed dimension;
//  - if XDR is owned but no sensors feed it, guarantee a sensor offer (the hint);
//  - early on, favour breadth (prefer a product you do not own yet).
export function upgradeChoices(levels, rng = Math.random) {
  const avail = WEAPON_ORDER.filter(id => lv(levels, id) < WEAPONS[id].max);
  if (!avail.length) return [];
  const pick = [];
  const take = id => { if (id && !pick.includes(id)) pick.push(id); };

  // force a sensor when XDR is idle
  if (lv(levels, 'XDR') > 0 && sensorLevels(levels) === 0) {
    const sensorsAvail = SENSORS.filter(id => avail.includes(id));
    if (sensorsAvail.length) take(sensorsAvail[Math.floor(rng() * sensorsAvail.length)]);
  }
  // weighted pool: unowned products weigh more early (breadth); XDR needs a sensor first
  const pool = avail.filter(id => !pick.includes(id)).map(id => {
    let w = 1;
    if (lv(levels, id) === 0) w += 1.1;                       // encourage trying new products
    if (id === 'XDR' && sensorLevels(levels) === 0) w = 0.15; // rarely dangle XDR with nothing to feed it
    return { id, w };
  });
  while (pick.length < 3 && pool.length) {
    let total = pool.reduce((a, o) => a + o.w, 0), roll = rng() * total, idx = 0;
    for (; idx < pool.length; idx++) { roll -= pool[idx].w; if (roll <= 0) break; }
    const chosen = pool.splice(Math.min(idx, pool.length - 1), 1)[0];
    take(chosen.id);
  }
  return pick.map(id => ({ id, toLevel: lv(levels, id) + 1, max: WEAPONS[id].max }));
}

// --- enemies -----------------------------------------------------------------
export const ENEMIES = {
  recon:  { id: 'recon',  hp: 14,  speed: 62, dmg: 40,  xp: 1,  score: 10,  r: 13, color: '#8aa0c6' },
  malware:{ id: 'malware',hp: 40,  speed: 46, dmg: 70,  xp: 2,  score: 16,  r: 17, color: '#ff8a3a' },
  worm:   { id: 'worm',   hp: 30,  speed: 74, dmg: 55,  xp: 2,  score: 22,  r: 15, color: '#2ee6a0', splits: 2 },
  apt:    { id: 'apt',    hp: 60,  speed: 52, dmg: 90,  xp: 3,  score: 34,  r: 16, color: '#a98bff', cloak: true },
  exfil:  { id: 'exfil',  hp: 44,  speed: 86, dmg: 0,   xp: 3,  score: 26,  r: 15, color: '#ffd166', steals: 140 },
  ransom: { id: 'ransom', hp: 900, speed: 30, dmg: 320, xp: 12, score: 150, r: 34, color: '#ff5a6a', boss: true },
};

// Which enemy types can appear by elapsed seconds (progressive unlock).
export function threatPool(t) {
  const pool = ['recon'];
  if (t > 8)  pool.push('malware');
  if (t > 20) pool.push('worm');
  if (t > 34) pool.push('apt');
  if (t > 50) pool.push('exfil');
  return pool;
}

export function difficultyAt(t) {
  return {
    spawnGap: Math.max(360, 1400 - t * 9),         // ms between spawns (ramps up)
    hpMul: 1 + t * 0.055,
    speedMul: Math.min(1.8, 1 + t * 0.011),
    bossEvery: 42,                                  // a ransomware boss every 42s
  };
}

// --- scoring -----------------------------------------------------------------
export const comboMult = combo => Math.min(6, 1 + Math.floor(combo / 6));
export const killScore = (type, mult) => Math.round((ENEMIES[type]?.score || 10) * mult);
export const SURVIVE_PER_SEC = 4;
export const STEAL_PENALTY = 140;
