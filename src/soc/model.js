// Pure logic for "Incident Zero" — a live SOC where the MECHANICS are the Sangfor
// products' real functions, not just their names. No DOM: unit-testable.
//
// The teaching core:
//  - XDR = CORRELATION. A single alert is noise; a real incident only surfaces when >=2
//    sensors fire on the same asset sharing one IOC. You confirm it by correlating them.
//  - Each product only works in its REAL role/limitation, enforced as the containment rule:
//    AF=perimeter, EDR=endpoint, NDR=network/lateral, IAG=egress, aStor=restore (scarce),
//    MDR=managed assist (scarce). Wrong tool for the stage fails.

// Kill-chain stages. `sensor` sees the stage (emits the alert); `contain` is the only
// product that stops it there (its honest real-world role).
export const STAGES = [
  { id: 'intrusion', sensor: 'AF',  contain: 'AF'  },  // inbound break-in at the perimeter
  { id: 'foothold',  sensor: 'EDR', contain: 'EDR' },  // code running on a host
  { id: 'lateral',   sensor: 'NDR', contain: 'NDR' },  // movement between assets
  { id: 'exfil',     sensor: 'IAG', contain: 'IAG' },  // data heading out the gateway
  { id: 'ransom',    sensor: 'EDR', contain: 'ASTOR' },// impact: encrypt -> restore from snapshot
];
export const RANSOM_STAGE = STAGES.length - 1;
export const SENSORS = ['AF', 'EDR', 'NDR', 'IAG'];
export const TOOLS = ['AF', 'EDR', 'NDR', 'IAG', 'ASTOR', 'MDR'];

export const START_INTEGRITY = 3;
export const SNAP_MAX = 2;      // aStor snapshot charges (recovery is scarce, not guaranteed)
export const MDR_MAX = 1;       // MDR managed-assist charges on hand
export const SNAP_REGEN = 20;   // seconds to regain a snapshot charge
export const MDR_REGEN = 30;    // seconds to regain an MDR charge

export function containFor(stage) { return STAGES[stage].contain; }
export function sensorFor(stage) { return STAGES[stage].sensor; }

// Correlation rule (what XDR does): a selected set confirms an incident iff it is >=2
// alerts, all on the same asset, all sharing one IOC, from >=2 DISTINCT sensors.
// Noise alerts carry unique IOCs, so they never corroborate — the IOC is the real key.
export function isValidCorrelation(alerts) {
  if (!alerts || alerts.length < 2) return false;
  const { asset, ioc } = alerts[0];
  if (!alerts.every(a => a.asset === asset && a.ioc === ioc)) return false;
  return new Set(alerts.map(a => a.sensor)).size >= 2;
}

// Difficulty as a function of elapsed seconds — endless ramp, bounded.
export function difficultyAt(t) {
  return {
    noiseInterval:   Math.max(650,  1600 - t * 11),   // ms between noise alerts
    incidentInterval: Math.max(3200, 7500 - t * 34),  // ms between new incidents
    stageAdvanceMs:  Math.max(2500,  4300 - t * 15),  // ms an incident sits before advancing
    alertTtl:        Math.max(5200,  9000 - t * 18),  // ms an alert stays in the queue
    maxIncidents:    Math.min(6, 3 + Math.floor(t / 45)),
  };
}

export function comboMult(combo) { return Math.min(5, 1 + Math.floor(combo / 4)); }

// Confirming earlier (lower stage) is worth more — you caught it before it spread.
export function confirmScore(stage, combo) {
  const earliness = (RANSOM_STAGE - stage);          // 4 at intrusion .. 0 at ransom
  return Math.round((120 + earliness * 45) * comboMult(combo));
}
// Containing is worth more the deeper the actor got (more damage averted).
export function containScore(stage, combo) {
  return Math.round((110 + stage * 55) * comboMult(combo));
}

export const PENALTY_FALSE_CORR = -90;   // correlating unrelated/noise alerts
export const PENALTY_WRONG_TOOL = -55;   // wrong product for the stage
export const SCORE_MDR = 70;             // containing via the managed assist (smaller — it is a crutch)

// Why a wrong tool fails, keyed for i18n (the product's real limitation).
export const WRONG_REASON = {
  AF:    'af',    // guards the entrance only
  EDR:   'edr',   // only the host it is on
  NDR:   'ndr',   // sees the network, does not block on the host
  IAG:   'iag',   // watches the exit, not the break-in
  ASTOR: 'astor', // recovery only, and only at impact
  MDR:   'mdr',   // assist, needs a charge
};
