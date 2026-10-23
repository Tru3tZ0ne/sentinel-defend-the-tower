// Pure tuning + scoring for "Breach Rush — Sangfor Edition". No DOM, no canvas —
// unit-testable. All balance and the product<->threat mapping live here.
//
// Design: threats march a real attack lifecycle (recon -> delivery -> lateral ->
// exfiltration -> ransomware). Each threat harms either AVAILABILITY (Uptime) or
// CONFIDENTIALITY (Data), and each has a Sangfor product that counters it in reality.
// The player's fireable powers ARE those products, so firing the right product for
// the current threat mix is the strategy — and the lesson.

// Threat & traffic archetypes.
//   threat:false  -> legitimate traffic (must be spared)
//   counter       -> the Sangfor product id that stops this threat in reality (taught in-game)
//   harms         -> 'uptime' (availability) or 'data' (confidentiality); traffic harms neither
//   edr / iag     -> cleared by that product's mass-response power
export const TYPES = {
  traffic: { threat: false, color: '#2fe0c6', accent: '#8affe9', speed: 1.00, serve: 8, shape: 'orb' },
  scan:    { threat: true,  color: '#ffd166', accent: '#fff0b8', speed: 1.45, base: 60,  shape: 'tri',     tier: 0, counter: 'AF',  harms: 'uptime' },
  malware: { threat: true,  color: '#ff6b5e', accent: '#ffc3bc', speed: 1.00, base: 110, shape: 'spike',   tier: 0, counter: 'EDR', harms: 'uptime', edr: true },
  phish:   { threat: true,  color: '#49c6e0', accent: '#bdeffb', speed: 0.92, base: 150, shape: 'orb',     tier: 2, counter: 'EDR', harms: 'uptime', edr: true, mimic: true },
  exfil:   { threat: true,  color: '#c07bff', accent: '#e6c9ff', speed: 1.18, base: 170, shape: 'diamond', tier: 3, counter: 'IAG', harms: 'data',   iag: true, steals: 14 },
  stealth: { threat: true,  color: '#8fb6ff', accent: '#d6e4ff', speed: 0.88, base: 200, shape: 'ghost',   tier: 4, counter: 'NDR', harms: 'uptime', hidden: true },
  ransom:  { threat: true,  color: '#ff3b6b', accent: '#ffb0c4', speed: 0.56, base: 360, shape: 'boss',    tier: 5, counter: 'ASTOR', harms: 'data', hits: 3, boss: true, steals: 30 },
};

export const THREAT_KEYS = Object.keys(TYPES).filter(k => TYPES[k].threat);

// Difficulty as a function of elapsed seconds — monotonic, endless.
export function difficultyAt(t) {
  return {
    speedMul:    Math.min(2.9, 1 + t * 0.016),
    interval:    Math.max(0.38, 1.20 - t * 0.0135),
    threatRatio: Math.min(0.82, 0.50 + t * 0.0060),
    stage:       1 + Math.floor(t / 30),
  };
}

// Non-boss threat variety unlocks over time (progressive).
export function threatPool(t) {
  const pool = ['scan', 'malware', 'malware'];
  if (t >= 12) pool.push('phish');
  if (t >= 24) pool.push('exfil');
  if (t >= 38) pool.push('stealth', 'stealth');
  return pool;
}

// Boss (ransomware) cadence.
export function bossDue(elapsed, lastBossAt) {
  if (elapsed < 55) return false;
  return (elapsed - lastBossAt) >= 26;
}

// Kill-chain phase banners, tied to the unlock thresholds above. Returns the phase
// id that begins at `t`, or null. Keys resolve to i18n 'phase.*'.
export const PHASES = [
  { at: 0,  id: 'recon' },
  { at: 12, id: 'delivery' },
  { at: 24, id: 'exfil' },
  { at: 38, id: 'lateral' },
  { at: 55, id: 'ransom' },
];
export function phaseAt(elapsed, lastPhaseIdx) {
  for (let i = PHASES.length - 1; i > lastPhaseIdx; i--) {
    if (elapsed >= PHASES[i].at) return { idx: i, id: PHASES[i].id };
  }
  return null;
}

// Combo multiplier: +1× per 5 consecutive correct neutralizes, capped at 6×.
export function comboMult(combo) { return Math.min(6, 1 + Math.floor(combo / 5)); }

// Points for neutralizing a threat — rewards early catches and combos.
export function hitScore({ type, distFrac, combo }) {
  const spec = TYPES[type];
  if (!spec || !spec.threat) return 0;
  const earliness = 1 + Math.max(0, Math.min(1, distFrac)) * 1.1;
  return Math.round(spec.base * earliness * comboMult(combo));
}

export const FALSE_POSITIVE = -80;        // zapping legitimate traffic
export const SERVE_BONUS = 8;             // correctly serving legitimate traffic
export const START_INTEGRITY = 3;         // availability "lives" (Uptime pips)
export const START_DATA = 100;            // confidentiality meter (Data %)
export const IAG_RESTORE = 22;            // Data restored by the IAG power
export const ENERGY_PER_HIT = 7;
export const ENERGY_MAX = 100;

// Fireable products (dock order = keys 1..5). effect ids are handled by the engine.
export const POWERS = ['EDR', 'NDR', 'IAG', 'AF', 'XDR'];
export const ABILITIES = {
  EDR: { key: '1', product: 'EDR', color: '#39c0ff', cost: 45,  effect: 'endpoint' },  // clear malware/phish on screen
  NDR: { key: '2', product: 'NDR', color: '#8fb6ff', cost: 45,  effect: 'inspect'  },  // reveal stealth + flag phish + slow
  IAG: { key: '3', product: 'IAG', color: '#2ee6a0', cost: 55,  effect: 'egress'   },  // clear exfil + restore Data
  AF:  { key: '4', product: 'AF',  color: '#ffba45', cost: 55,  effect: 'perimeter'},  // block new spawns + push rim threats
  XDR: { key: '5', product: 'XDR', color: '#a98bff', cost: 100, effect: 'correlate'},  // neutralize everything (needs full charge)
};

// Always-on managed/recovery products.
export const PASSIVES = {
  MDR:   { interval: 11 },   // 24/7 SOC: auto-neutralise the worst threat every N seconds
  ASTOR: { regen: 22 },      // snapshot recovery: a charge that absorbs one data-loss event
};
