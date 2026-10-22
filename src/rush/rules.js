// Pure tuning + scoring for "Breach Rush". No DOM, no canvas — unit-testable.
// The whole game's balance lives here so it can be reasoned about and tested.

// Threat & traffic archetypes. `threat:false` = legitimate traffic (must be spared).
// color/accent drive rendering; the rest drives gameplay.
export const TYPES = {
  traffic: { threat: false, color: '#2fe0c6', accent: '#8affe9', speed: 1.00, serve: 8, shape: 'orb' },
  scan:    { threat: true,  color: '#ffd166', accent: '#fff0b8', speed: 1.45, base: 60,  shape: 'tri',  tier: 0 },
  malware: { threat: true,  color: '#ff6b5e', accent: '#ffc3bc', speed: 1.00, base: 110, shape: 'spike', tier: 0 },
  phish:   { threat: true,  color: '#49c6e0', accent: '#bdeffb', speed: 0.92, base: 150, shape: 'orb', tier: 2, mimic: true },  // disguised as traffic
  exfil:   { threat: true,  color: '#c07bff', accent: '#e6c9ff', speed: 1.18, base: 170, shape: 'diamond', tier: 3, steals: 10 },
  stealth: { threat: true,  color: '#8fb6ff', accent: '#d6e4ff', speed: 0.88, base: 200, shape: 'ghost', tier: 4, hidden: true },
  ransom:  { threat: true,  color: '#ff3b6b', accent: '#ffb0c4', speed: 0.56, base: 360, shape: 'boss', tier: 5, hits: 3, boss: true, breach: 2 },
};

export const THREAT_KEYS = Object.keys(TYPES).filter(k => TYPES[k].threat);

// Difficulty as a function of elapsed seconds — monotonic, endless.
export function difficultyAt(t) {
  return {
    speedMul:    Math.min(2.9, 1 + t * 0.016),          // blips fly in faster over time
    interval:    Math.max(0.38, 1.20 - t * 0.0135),     // seconds between spawns
    threatRatio: Math.min(0.82, 0.50 + t * 0.0060),     // share of spawns that are hostile
    stage:       1 + Math.floor(t / 30),                // cosmetic "alert level" (every 30s)
  };
}

// Which non-boss threat types are unlocked yet (progressive variety).
export function threatPool(t) {
  const pool = ['scan', 'malware', 'malware'];
  if (t >= 12) pool.push('phish');
  if (t >= 24) pool.push('exfil');
  if (t >= 38) pool.push('stealth', 'stealth');
  return pool;
}

// Boss (ransomware) cadence: first at 55s, then roughly every 26s. Returns true once per window.
export function bossDue(elapsed, lastBossAt) {
  if (elapsed < 55) return false;
  return (elapsed - lastBossAt) >= 26;
}

// Combo multiplier: +1× per 5 consecutive correct neutralizes, capped at 6×.
export function comboMult(combo) {
  return Math.min(6, 1 + Math.floor(combo / 5));
}

// Points for neutralizing a threat. Reward speed (catching it far from the core) and combos.
// dist/maxDist is how far out the blip still is (1 = just spawned, 0 = at the core).
export function hitScore({ type, distFrac, combo }) {
  const spec = TYPES[type];
  if (!spec || !spec.threat) return 0;
  const earliness = 1 + Math.max(0, Math.min(1, distFrac)) * 1.1;   // up to +110% for early catches
  return Math.round(spec.base * earliness * comboMult(combo));
}

// False-positive penalty for zapping legitimate traffic.
export const FALSE_POSITIVE = -80;
// Flat reward for correctly letting legitimate traffic reach the core.
export const SERVE_BONUS = 8;
// Starting integrity (breaches you can absorb) and energy economy for abilities.
export const START_INTEGRITY = 3;
export const ENERGY_PER_HIT = 7;      // energy gained per neutralize
export const ENERGY_MAX = 100;

// Ability costs (energy). Keyed by ability id.
export const ABILITIES = {
  purge: { cost: 100, key: '1', product: 'XDR', color: '#2ee6a0' },  // neutralize everything on screen
  slow:  { cost: 55,  key: '2', product: 'EDR', color: '#39c0ff' },  // slow all blips for a few seconds
  scan:  { cost: 45,  key: '3', product: 'NDR', color: '#8fb6ff' },  // reveal stealth + flag phish
};
