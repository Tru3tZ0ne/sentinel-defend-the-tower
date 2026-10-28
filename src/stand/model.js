// Last Stand — pure rules. A vertical "survivor" base-defense shooter: your
// operator holds the bottom line, threats pour straight DOWN, and everyone fires
// straight UP (no angled shots). Each Sangfor product is a DEPLOYABLE that appears
// on the field and fights the way the product really works - an EDR endpoint
// turret beside you, an NGAF barrier that blocks + weakens, an MDR teammate, an NDR
// radar that reveals + marks, an IAG checkpoint that slows, an HCI compute core
// that speeds every unit, the XDR correlation beam (scales with your sensors), and
// an aStor snapshot vault. Honors the design bar; no DOM/canvas/global randomness.

export const START_BASE = 1200;

// Fixed weapon constants (straight-up fire only).
export const OPERATOR = { dmg: 16, rate: 3.4, bulletSpeed: 980, pierce: 1 };
export const TURRET = { rate: 2.8, bulletSpeed: 940, pierce: 1 };   // EDR endpoint turret
export const ALLY = { rate: 2.3, bulletSpeed: 980, pierce: 1 };   // MDR teammate

// Active operator skills (player-triggered, on cooldown). Each maps to a real
// Sangfor security SERVICE engagement that CALLS IN temporary expert teams to the
// field (except Incident Response, which is the emergency containment button):
//   - Red Team Assessment: a big surge of temporary offensive teams storm in.
//   - Penetration Testing: a smaller, focused team joins for a probing run.
//   - Incident Response: contain the active breach now (no standing team).
// cd = cooldown (s), dur = how long the summoned team stays (s), team = team size.
export const ABILITIES = {
  ir: { id: 'ir', cd: 26, dur: 0,  team: 0 },   // Incident Response - contain: nuke every threat + restore integrity
  pt: { id: 'pt', cd: 22, dur: 8,  team: 3 },   // Penetration Testing - a small expert team joins the fight
  rt: { id: 'rt', cd: 34, dur: 10, team: 6 },   // Red Team Assessment - a large surge of temporary attack teams
};
export const ABILITY_ORDER = ['ir', 'pt', 'rt'];

// Each product is a deployable. max = max level. sensor = feeds the XDR beam.
export const WEAPONS = {
  EDR:   { id: 'EDR',   max: 8, sensor: true  },  // endpoint turret(s) beside you
  MDR:   { id: 'MDR',   max: 6, sensor: false },  // managed teammate(s), 24/7
  AF:    { id: 'AF',    max: 6, sensor: true  },  // perimeter barrier: blocks + weakens
  NDR:   { id: 'NDR',   max: 6, sensor: true  },  // radar: reveals cloak + marks (bonus dmg)
  IAG:   { id: 'IAG',   max: 5, sensor: false },  // egress checkpoint: slow band
  HCI:   { id: 'HCI',   max: 6, sensor: false },  // compute core: fire rate for ALL units
  XDR:   { id: 'XDR',   max: 6, sensor: false },  // correlation beam, scales with sensors
  ASTOR: { id: 'ASTOR', max: 5, sensor: false },  // snapshot vault: base shield + restore
};
export const WEAPON_ORDER = ['EDR', 'MDR', 'AF', 'NDR', 'IAG', 'HCI', 'XDR', 'ASTOR'];
export const SENSORS = ['EDR', 'NDR', 'AF'];

const lvl = (levels, id) => (levels && levels[id]) || 0;
export const sensorLevels = levels => SENSORS.reduce((a, id) => a + lvl(levels, id), 0);
export const weaponTier = levels => WEAPON_ORDER.reduce((a, id) => a + lvl(levels, id), 0);

// Everything the engine needs to build the squad + field from the owned levels.
export function deriveSquad(levels) {
  const hci = lvl(levels, 'HCI');
  const fireRateMul = 1 + hci * 0.24;                       // compute core speeds ALL units

  const edr = lvl(levels, 'EDR');
  const edrTurrets = Math.min(edr, 4);                      // up to 4 turrets, then +damage
  const edrDmg = 11 + Math.max(0, edr - 4) * 6;

  const mdr = lvl(levels, 'MDR');
  const mdrAllies = mdr > 0 ? 1 : 0;                        // a single teammate; levels boost its power
  const mdrDmg = 18 + Math.max(0, mdr - 1) * 12;            // attack power per level
  const mdrRate = ALLY.rate + Math.max(0, mdr - 1) * 0.45;  // and fire speed per level

  const af = lvl(levels, 'AF');
  const afTier = af;
  const afHp = af ? 70 + af * 55 : 0;                       // barrier integrity
  const afWeaken = af ? Math.min(0.65, 0.22 + af * 0.08) : 0; // hp stripped from breachers
  const afHalfWidth = af ? 44 + af * 16 : 0;                // px, half-width of the wall

  const ndr = lvl(levels, 'NDR');
  const ndrReveal = ndr > 0;                                // cloaked APTs become visible + full dmg
  const ndrMark = ndr * 0.25;                               // +25% damage to marked threats / level
  const ndrRadars = Math.min(ndr, 2);

  const iag = lvl(levels, 'IAG');
  const iagBand = iag > 0;
  const iagSlowMul = iag ? Math.max(0.28, 1 - iag * 0.16) : 1;

  // XDR: weak alone, multiplies with the sensor UNITS on the field (its real limit).
  const sensors = edrTurrets + ndrRadars + (afTier > 0 ? 1 : 0);
  const xdr = lvl(levels, 'XDR');
  const beamOn = xdr > 0;
  const beamDmg = beamOn ? Math.round((8 + xdr * 8) * Math.max(0.15, sensors * 0.45)) : 0;
  const beamEvery = beamOn ? Math.max(1300, 3800 - xdr * 420) : 0;
  const beamWidth = beamOn ? 30 + xdr * 10 + sensors * 7 : 0;

  const astor = lvl(levels, 'ASTOR');
  const shieldMax = astor;
  const shieldEvery = astor ? Math.max(4500, 10000 - astor * 1100) : 0;
  const regen = astor * 3.2;

  return {
    fireRateMul,
    edrTurrets, edrDmg, mdrAllies, mdrDmg, mdrRate,
    afTier, afHp, afWeaken, afHalfWidth,
    ndrReveal, ndrMark, ndrRadars,
    iagBand, iagSlowMul,
    sensors, beamOn, beamDmg, beamEvery, beamWidth, xdrIdle: beamOn && sensors === 0,
    shieldMax, shieldEvery, regen,
  };
}

// APT stealth: only fully seen once NDR (network visibility) is deployed.
export function visibilityMul(enemy, squad) {
  return enemy.cloak && !(squad && squad.ndrReveal) ? 0.5 : 1;
}
// Damage a shot deals to an enemy, including NDR mark bonus + stealth.
export function damageTo(enemy, squad, rawDmg) {
  const mark = enemy.cloak && !(squad && squad.ndrReveal) ? 0.5 : 1;
  const bonus = squad && squad.ndrMark ? 1 + squad.ndrMark : 1;
  return rawDmg * mark * bonus;
}

// --- XP / levelling (quick early ramp so the squad fills out fast) -----------
export const xpToLevel = level => Math.round(5 + Math.pow(level, 1.42) * 2.4);

// Up to 3 upgrade offers, deterministic given rng(). Never offers a maxed product;
// guarantees a sensor when the XDR beam is idle; favours breadth early.
export function upgradeChoices(levels, rng = Math.random) {
  const avail = WEAPON_ORDER.filter(id => lvl(levels, id) < WEAPONS[id].max);
  if (!avail.length) return [];
  const pick = [];
  const take = id => { if (id && !pick.includes(id)) pick.push(id); };

  if (lvl(levels, 'XDR') > 0 && sensorLevels(levels) === 0) {
    const s = SENSORS.filter(id => avail.includes(id));
    if (s.length) take(s[Math.floor(rng() * s.length)]);
  }
  const pool = avail.filter(id => !pick.includes(id)).map(id => {
    let w = 1;
    if (lvl(levels, id) === 0) w += 1.1;
    if (id === 'XDR' && sensorLevels(levels) === 0) w = 0.15;
    return { id, w };
  });
  while (pick.length < 3 && pool.length) {
    const total = pool.reduce((a, o) => a + o.w, 0); let roll = rng() * total, idx = 0;
    for (; idx < pool.length; idx++) { roll -= pool[idx].w; if (roll <= 0) break; }
    take(pool.splice(Math.min(idx, pool.length - 1), 1)[0].id);
  }
  return pick.map(id => ({ id, toLevel: lvl(levels, id) + 1, max: WEAPONS[id].max }));
}

// --- enemies (numerous but each fairly fragile, for a lively feel) --
export const ENEMIES = {
  recon:  { id: 'recon',  hp: 11,  speed: 64, dmg: 32,  xp: 1,  score: 10,  r: 13, color: '#8aa0c6' },
  malware:{ id: 'malware',hp: 32,  speed: 52, dmg: 58,  xp: 2,  score: 16,  r: 17, color: '#ff8a3a' },
  worm:   { id: 'worm',   hp: 22,  speed: 78, dmg: 44,  xp: 2,  score: 22,  r: 15, color: '#2ee6a0', splits: 2 },
  apt:    { id: 'apt',    hp: 52,  speed: 58, dmg: 76,  xp: 3,  score: 34,  r: 16, color: '#a98bff', cloak: true },
  exfil:  { id: 'exfil',  hp: 38,  speed: 100,dmg: 0,   xp: 3,  score: 26,  r: 15, color: '#ffd166', steals: 150 },
  ransom: { id: 'ransom', hp: 760, speed: 33, dmg: 270, xp: 12, score: 150, r: 34, color: '#ff5a6a', boss: true },
};

export function threatPool(t) {
  const pool = ['recon'];
  if (t > 6)  pool.push('malware');
  if (t > 14) pool.push('worm');
  if (t > 26) pool.push('apt');
  if (t > 40) pool.push('exfil');
  return pool;
}

export function difficultyAt(t) {
  return {
    spawnGap: Math.max(250, 940 - t * 7.5),              // ms between spawn ticks (ramps up faster)
    batch: Math.min(5, 1 + Math.floor(t / 19)),          // threats per spawn tick (denser, up to 5)
    hpMul: 1 + t * 0.052,                                // threats get tankier quicker
    speedMul: Math.min(1.7, 1 + t * 0.011),
    bossEvery: 38,                                       // bosses arrive more often
  };
}

export const comboMult = combo => Math.min(6, 1 + Math.floor(combo / 6));
export const killScore = (type, mult) => Math.round((ENEMIES[type]?.score || 10) * mult);
export const SURVIVE_PER_SEC = 4;
export const STEAL_PENALTY = 150;
