// Scenario for the "cyber2" theme — the SAME game, but the building is restructured as a
// Sangfor DEFENSE-IN-DEPTH ARCHITECTURE. Each LEVEL is a security LAYER of the stack, and the
// Sangfor product that owns that layer is positioned there (see building-cyber2.js):
//
//   SOC CROWN   — Security Operations Center ........ XDR  + MDR   (correlation brain / managed)
//   ENDPOINT    — Workforce + Finance endpoints ..... EDR          (host protection)
//   NETWORK     — Network backbone / mirror spine .... NDR / STA    (movement visibility)
//   PERIMETER   — Entry gateway + egress checkpoint .. AF  + IAG    (front door / way out)
//   DATA CORE   — Compute, storage, crown-jewel data . aStor        (resilient storage)
//
// The room IDs, types, desks and slots are kept identical to data/scenario.js so the SAME
// engine, the SAME missions (missions.js references these room ids) and the SAME people/nav all
// work unchanged — only the floors are re-conceived as architecture layers. The intruder's kill
// chain (reception -> office -> finance -> server -> vault -> egress) now visibly traverses the
// layers of the stack instead of the floors of an office.

export const LAYOUT = {
  // Five stacked layers (top -> bottom). y spacing matches the cyber tower's tier rhythm.
  levels: [
    { id: 'SOC',  y: 6.8,  name: { en: 'SOC · Operations', zh: '安全运营层 · SOC' },      layer: true, product: 'XDR' },
    { id: 'EP',   y: 3.4,  name: { en: 'Endpoint Layer',   zh: '终端防护层' },            layer: true, product: 'EDR' },
    { id: 'NET',  y: 0,    name: { en: 'Network Layer',    zh: '网络检测层' },            layer: true, product: 'NDR' },
    { id: 'EDGE', y: -3.4, name: { en: 'Perimeter Layer',  zh: '边界防护层' },            layer: true, product: 'AF' },
    { id: 'CORE', y: -6.8, name: { en: 'Data Core',        zh: '数据核心层' },            layer: true, product: 'ASTOR' },
  ],
  defaultLevel: 'EP',
  bounds: { x0: -14, x1: 14, z0: -8.5, z1: 8.5 },
  corridor: { z0: -1.5, z1: 1.5 },
  wallH: 1.45,
  stair: { x: 12.6 },
  rooms: [
    // ---- SOC CROWN (XDR correlation + MDR managed service) ----
    { id: 'soc',       level: 'SOC',  type: 'command', name: { en: 'Security Operations Center', zh: '安全运营中心' }, rect: { x0: -7, x1: 7, z0: -7, z1: 7 }, door: { x: 0, side: 'back' } },
    // ---- ENDPOINT LAYER (EDR / EPP on every workstation) ----
    { id: 'office',    level: 'EP',   type: 'office',  name: { en: 'Workforce Endpoints', zh: '办公终端区' }, rect: { x0: -8, x1: 2, z0: 1.5, z1: 8.5 }, desks: 4, door: { x: -3, side: 'back' } },
    { id: 'l2-finance', level: 'EP',  type: 'office',  name: { en: 'Finance Endpoints',   zh: '财务终端区' }, rect: { x0: 2, x1: 10, z0: 1.5, z1: 8.5 }, desks: 3, door: { x: 6, side: 'back' } },
    // ---- NETWORK LAYER (STA mirror sensor feeding NDR / Cyber Command) ----
    { id: 'netops',    level: 'NET',  type: 'meeting', name: { en: 'Network Backbone', zh: '网络骨干' }, rect: { x0: -6, x1: 6, z0: -6, z1: 6 }, door: { x: 0, side: 'front' } },
    // ---- PERIMETER LAYER (AF next-gen firewall at entry; IAG secure web gateway at egress) ----
    { id: 'reception', level: 'EDGE', type: 'lobby',   name: { en: 'Perimeter Gateway', zh: '边界接入网关' }, rect: { x0: 2, x1: 12, z0: 1.5, z1: 8.5 }, door: { x: 7, side: 'back' }, entrance: true },
    { id: 'egress',    level: 'EDGE', type: 'egress',  name: { en: 'Egress Checkpoint', zh: '出口检查点' },   rect: { x0: -12, x1: -2, z0: -8.5, z1: -1.5 }, door: { x: -7, side: 'front' }, exit: true },
    // ---- DATA CORE (aStor resilient storage + crown-jewel records) ----
    { id: 'server',    level: 'CORE', type: 'server',  name: { en: 'Compute & Storage', zh: '计算与存储' }, rect: { x0: -8, x1: -1, z0: -8.5, z1: -1.5 }, door: { x: -4.5, side: 'front' } },
    { id: 'vault',     level: 'CORE', type: 'vault',   name: { en: 'Crown-Jewel Data',  zh: '核心数据库' }, rect: { x0: 1, x1: 8, z0: -8.5, z1: -1.5 }, door: { x: 4.5, side: 'front' } },
  ],
  // Product -> architectural position (unchanged from the office scenario, so the engine's slot
  // logic and coverage are identical). NDR/MDR/EDR are building-wide / endpoint / off-site.
  slots: {
    AF:    { room: 'reception', kind: 'entrance' },   // perimeter firewall at the gateway
    IAG:   { room: 'egress',    kind: 'checkpoint' }, // secure web gateway at the egress
    XDR:   { room: 'soc',       kind: 'console' },    // correlation console in the SOC
    NDR:   { kind: 'network' },                       // STA mirror — the whole network layer
    MDR:   { kind: 'offsite' },                       // managed SOC — off-site
    EDR:   { kind: 'endpoint' },                      // any endpoint on the endpoint layer / cores
    ASTOR: { room: 'server',    kind: 'storage' },    // resilient storage in the data core
  },
};

// Staff live on the layers that have people (endpoints, SOC, network, perimeter desk).
export const EMPLOYEES = [
  { id: 'e1', home: 'office',     name: { en: 'Maya (Marketing)',   zh: 'Maya（市场部）' } },
  { id: 'e2', home: 'office',     name: { en: 'Devi (Engineering)', zh: 'Devi（研发）' } },
  { id: 'e3', home: 'l2-finance', name: { en: 'Omar (Finance)',     zh: 'Omar（财务）' } },
  { id: 'e4', home: 'netops',     name: { en: 'Priya (NetOps)',     zh: 'Priya（网络运维）' } },
  { id: 'e5', home: 'reception',  name: { en: 'Lena (Front desk)',  zh: 'Lena（前台）' } },
  { id: 'e6', home: 'office',     name: { en: 'Ivan (IT)',          zh: 'Ivan（IT）' } },
  { id: 'e7', home: 'l2-finance', name: { en: 'Sara (Ops)',         zh: 'Sara（运营）' } },
  { id: 'e8', home: 'soc',        name: { en: 'Grace (SOC Lead)',   zh: 'Grace（安全运营主管）' } },
];
