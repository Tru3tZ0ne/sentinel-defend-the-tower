// Pure logic for "Patch Panic" — a whack-a-mole over a grid of endpoints. Threats pop
// with a burning fuse; tap to let Endpoint Secure (EDR) neutralise them before they
// detonate. A real user sometimes pops too — tapping them is a false positive. No DOM.

// type: label shown on the pop; hp: taps to clear; score: base points; fuseMul: fuse
// length vs base; decoy: a legitimate user (must NOT be tapped).
export const POPS = {
  malware: { label: 'MAL', hp: 1, score: 60,  fuseMul: 1.0,  harm: true },
  exploit: { label: 'EXP', hp: 1, score: 110, fuseMul: 0.8,  harm: true, tier: 15 },
  ransom:  { label: 'RAN', hp: 3, score: 120, fuseMul: 1.5,  harm: true, boss: true, tier: 40 },
  user:    { label: 'USR', hp: 1, score: 0,   fuseMul: 1.1,  decoy: true },
};

export const START_LIVES = 3;
export const ENERGY_MAX = 100;
export const ENERGY_PER_KILL = 9;
export const SWEEP_SCORE = 25;          // per threat cleared by an MDR sweep
export const FALSE_POSITIVE = -70;      // tapping a real user

// Difficulty as a function of elapsed seconds — endless ramp.
export function difficultyAt(t) {
  return {
    spawnInterval: Math.max(420, 1100 - t * 9),   // ms between spawns
    fuseMs:        Math.max(1250, 2600 - t * 16),  // base fuse before detonation
    maxActive:     Math.min(6, 2 + Math.floor(t / 18)),
    userRatio:     Math.min(0.26, 0.14 + t * 0.0015),
  };
}

// Which pop appears next. Decoys (users) are mixed in; exploits/ransom unlock over time.
export function spawnPick(t, rng = Math.random) {
  if (rng() < difficultyAt(t).userRatio) return 'user';
  const pool = ['malware', 'malware', 'malware'];
  if (t >= POPS.exploit.tier) pool.push('exploit', 'exploit');
  if (t >= POPS.ransom.tier && rng() < 0.12) return 'ransom';
  return pool[(rng() * pool.length) | 0];
}

export function fuseFor(type, t) { return Math.round(difficultyAt(t).fuseMs * POPS[type].fuseMul); }

// Combo multiplier: +1x per 6 consecutive clears, capped 6x.
export function comboMult(combo) { return Math.min(6, 1 + Math.floor(combo / 6)); }

// Points for clearing a threat (final hit).
export function killScore(type, combo) { return Math.round(POPS[type].score * comboMult(combo)); }
