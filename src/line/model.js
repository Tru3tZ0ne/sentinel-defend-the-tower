// Breach Line — pure rules for a Plants-vs-Zombies-style lane defense. Threats
// march right -> left down straight lanes; you spend COMPUTE to place Sangfor
// defenders in a grid. Every defender does what its product really does. No DOM/
// canvas here — unit-tested in tools/arcade-logic.test.mjs.

export const ROWS = 5;
export const COLS = 9;
export const START_COMPUTE = 150;
export const PASSIVE_COMPUTE = 6;      // trickle per 5s so you are never fully stuck
export const PASSIVE_EVERY = 5000;

// ---- defenders (the "plants") ----------------------------------------------
// kind: eco | shooter | melee | wall | strike. cost = compute, cd = packet
// recharge (ms). Numbers tuned for a PvZ cadence. `sensor:true` means it feeds
// XDR's correlation strike (its damage scales with how many are on the board).
export const PLANTS = {
  HCI:   { id: 'HCI',   kind: 'eco',     cost: 50,  cd: 5000,  hp: 6,  produce: 25, produceEvery: 6500 },
  AF:    { id: 'AF',    kind: 'shooter', cost: 100, cd: 5000,  hp: 8,  dmg: 2,   rate: 1350, sensor: true },
  IAG:   { id: 'IAG',   kind: 'shooter', cost: 125, cd: 7000,  hp: 8,  dmg: 1,   rate: 1450, slow: 0.45, slowMs: 2600 },
  NDR:   { id: 'NDR',   kind: 'shooter', cost: 200, cd: 12000, hp: 8,  dmg: 2,   rate: 1550, lanes: 3, sensor: true },
  EDR:   { id: 'EDR',   kind: 'melee',   cost: 150, cd: 9000,  hp: 12, dmg: 7,   rate: 1100, reach: 1.6, sensor: true },
  ASTOR: { id: 'ASTOR', kind: 'wall',    cost: 50,  cd: 12000, hp: 46, regen: 2.4 },
  XDR:   { id: 'XDR',   kind: 'strike',  cost: 150, cd: 22000, hp: 1,  radius: 1.6, baseDmg: 5 },
};
export const PLANT_ORDER = ['HCI', 'AF', 'IAG', 'NDR', 'EDR', 'ASTOR', 'XDR'];
export const SENSOR_PLANTS = ['AF', 'NDR', 'EDR'];

// ---- threats (the "zombies") -----------------------------------------------
// speed = cells per second. dps = damage to a plant it is eating, per second.
// armor:true (APT) => the perimeter firewall only half-sees it; network/endpoint
// defenders hit it in full. steals (exfil) => extra sting if it reaches the house.
export const ZOMBIES = {
  recon:   { id: 'recon',   hp: 4,  speed: 0.42, dps: 8,  score: 10, color: '#8aa0c6' },
  malware: { id: 'malware', hp: 9,  speed: 0.36, dps: 12, score: 16, color: '#ff8a5a' },
  worm:    { id: 'worm',    hp: 7,  speed: 0.60, dps: 9,  score: 18, color: '#39c0ff' },
  apt:     { id: 'apt',     hp: 11, speed: 0.36, dps: 12, score: 30, color: '#a98bff', armor: true },
  exfil:   { id: 'exfil',   hp: 9,  speed: 0.66, dps: 6,  score: 40, color: '#ffd166', steals: true },
  ransom:  { id: 'ransom',  hp: 70, speed: 0.20, dps: 26, score: 150, color: '#ff4d5e', boss: true },
};

// perimeter can't fully see the stealthy APT; network/endpoint can.
export function damageFrom(sourcePlant, zombie, dmg) {
  const z = ZOMBIES[zombie.type] || zombie.spec || {};
  if (z.armor && sourcePlant === 'AF') return dmg * 0.4;
  return dmg;
}

// XDR correlation strike: near-useless alone, devastating once sensors feed it.
export function xdrStrikeDamage(sensorCount) {
  return PLANTS.XDR.baseDmg + sensorCount * 9;
}

// ---- waves / difficulty ----------------------------------------------------
export function threatPool(t) {
  const pool = ['recon', 'recon', 'malware'];
  if (t >= 20) pool.push('malware', 'worm');
  if (t >= 45) pool.push('apt', 'worm');
  if (t >= 70) pool.push('apt', 'exfil');
  if (t >= 100) pool.push('exfil', 'malware', 'apt');
  return pool;
}

export function difficultyAt(t) {
  const s = Math.max(0, t);
  return {
    spawnGap: Math.max(1100, 3400 - s * 18),   // ms between zombies
    hpMul: 1 + s * 0.012,
    speedMul: Math.min(1.7, 1 + s * 0.0028),
    bossEvery: 48,                              // ransom brute cadence (s)
    cap: Math.min(60, 14 + Math.floor(s / 6)),  // max zombies alive
  };
}

// ---- scoring ---------------------------------------------------------------
export function comboMult(combo) { return Math.min(6, 1 + Math.floor(combo / 8)); }
export function killScore(type, combo) {
  const base = (ZOMBIES[type] || ZOMBIES.recon).score;
  return Math.round(base * comboMult(combo));
}
export const PLACE_SCORE = 5;
export const SURVIVE_PER_SEC = 4;
export const STEAL_PENALTY = 120;
