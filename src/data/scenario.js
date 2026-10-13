// Scenario data — the single-floor sample ("A Quiet Morning on Level 3, Meridian Tower").
// One representative floor, developed thoroughly: an entrance, a corridor, a reception/shared
// area, and rooms with distinct purposes. Geometry is generated from LAYOUT by
// src/world/building.js; the incident is driven by engine.js. Room/desk ids are kept stable
// so the existing engine (fog-of-war, XDR correlation, isolate/lockdown/recover, MDR assist)
// works unchanged. Product behaviour stays accurate to Sangfor's positioning.

// ---- Single-floor layout (explicit footprints, metres; +X right, +Z toward the camera) ----
// Two rows of rooms off a central corridor. Front (camera-side) row is open to the camera;
// rooms face the corridor through glass. `door.x` is where the room meets the corridor.
export const LAYOUT = {
  floorY: 0,
  bounds: { x0: -14, x1: 14, z0: -8.5, z1: 8.5 },
  corridor: { z0: -1.5, z1: 1.5 },
  wallH: 1.45,
  rooms: [
    // front row (nearest the camera)
    { id: 'soc',       type: 'command', name: { en: 'Security Office', zh: '安防中心' },  rect: { x0: -14, x1: -7, z0: 1.5, z1: 8.5 }, door: { x: -10.5, side: 'back' } },
    { id: 'office',    type: 'office',  name: { en: 'Open Office',    zh: '开放办公区' }, rect: { x0: -7,  x1: 6,  z0: 1.5, z1: 8.5 }, desks: 4, door: { x: -0.5, side: 'back' } },
    { id: 'reception', type: 'lobby',   name: { en: 'Reception',      zh: '前台接待' },   rect: { x0: 6,   x1: 14, z0: 1.5, z1: 8.5 }, door: { x: 10, side: 'back' }, entrance: true },
    // back row
    { id: 'egress',    type: 'egress',  name: { en: 'Mailroom / Exit', zh: '收发室 / 出口' }, rect: { x0: -14, x1: -8, z0: -8.5, z1: -1.5 }, door: { x: -11, side: 'front' }, exit: true },
    { id: 'server',    type: 'server',  name: { en: 'Server Room',     zh: '服务器机房' },   rect: { x0: -8,  x1: -2, z0: -8.5, z1: -1.5 }, door: { x: -5, side: 'front' } },
    { id: 'vault',     type: 'vault',   name: { en: 'Data Room',       zh: '数据中心' },     rect: { x0: -2,  x1: 5,  z0: -8.5, z1: -1.5 }, door: { x: 1.5, side: 'front' } },
    { id: 'meeting',   type: 'meeting', name: { en: 'Meeting Room',    zh: '会议室' },       rect: { x0: 5,   x1: 14, z0: -8.5, z1: -1.5 }, door: { x: 9.5, side: 'front' } },
  ],
  // Where each product physically lives on this floor.
  slots: {
    AF:    { room: 'reception', kind: 'entrance' },
    IAG:   { room: 'egress',    kind: 'checkpoint' },
    XDR:   { room: 'soc',       kind: 'console' },
    NDR:   { kind: 'network' },     // corridor-wide
    MDR:   { kind: 'offsite' },
    EDR:   { kind: 'endpoint' },    // a workstation
    ASTOR: { room: 'server',    kind: 'storage' },
  },
};

// ---- Cast ---- (homes drive where staff work; several wear visitor lanyards so the
// intruder's badge is not a tell.)
export const EMPLOYEES = [
  { id: 'e1', home: 'office',    name: { en: 'Maya (Marketing)',  zh: 'Maya（市场部）' } },
  { id: 'e2', home: 'office',    name: { en: 'Devi (Engineering)', zh: 'Devi（研发）' } },
  { id: 'e3', home: 'office',    name: { en: 'Omar (Finance)',    zh: 'Omar（财务）' } },
  { id: 'e4', home: 'meeting',   name: { en: 'Priya (Sales)',     zh: 'Priya（销售）' } },
  { id: 'e5', home: 'reception', name: { en: 'Lena (Front desk)', zh: 'Lena（前台）' } },
  { id: 'e6', home: 'soc',       name: { en: 'Ivan (IT & Security)', zh: 'Ivan（IT 与安防）' } },
];

// ---- The incident (ground truth), staged across this one floor ----
// evidence: 'perimeter' (AF), 'endpoint' (EDR on that desk), 'network' (NDR), 'exfil' (IAG).
export const INCIDENT = {
  id: 'quiet-morning-l3',
  name: { en: 'The Quiet Morning', zh: '平静的清晨' },
  duration: 95,
  loseUptimeBelow: 35,
  intruder: { name: { en: 'Visitor badge #0', zh: '访客胸牌 #0' } },
  beats: [
    { t: 0,  room: 'reception', act: 'enter',    ev: 'perimeter', blockableBy: 'AF',
      truth: { en: 'An unescorted visitor tailgates staff in through the reception doors.', zh: '一名无人陪同的访客尾随员工从前台大门混入。' } },
    { t: 10, room: 'office',    act: 'foothold', ev: 'endpoint', desk: 'office#2',
      truth: { en: 'They settle at an empty Open Office desk and plug in a rogue device.', zh: '他在开放办公区一张空桌前坐下，接入一个恶意设备。' } },
    { t: 22, room: 'office',    act: 'recon',    ev: 'endpoint', desk: 'office#2',
      truth: { en: 'Quietly enumerating accounts and nearby shares.', zh: '悄悄枚举账户与附近的共享资源。' } },
    { t: 34, room: 'server',    act: 'move',     ev: 'network',
      truth: { en: 'Slips down the corridor into the Server Room with stolen credentials.', zh: '沿走廊潜入服务器机房，使用窃取的凭据。' } },
    { t: 46, room: 'server',    act: 'ransom',   ev: 'endpoint', locks: 'server', preventBy: 'EDR',
      truth: { en: 'Attempts to encrypt the business systems in the Server Room.', zh: '试图加密服务器机房中的业务系统。' } },
    { t: 60, room: 'vault',     act: 'move',     ev: 'network',
      truth: { en: 'Moves to the Data Room where the crown-jewel records live.', zh: '移动到存放核心数据的数据中心。' } },
    { t: 72, room: 'vault',     act: 'collect',  ev: 'endpoint', desk: 'vault#core',
      truth: { en: 'Stages the crown-jewel data for theft.', zh: '将核心数据打包，准备窃取。' } },
    { t: 84, room: 'egress',    act: 'move',     ev: 'network',
      truth: { en: 'Heads for the mailroom to get the data out.', zh: '前往收发室，准备把数据带出。' } },
    { t: 92, room: 'egress',    act: 'exfil',    ev: 'exfil', blockableBy: 'IAG', fatal: true,
      truth: { en: 'Tries to send the stolen data out through the mailroom gateway.', zh: '试图通过收发室网关把窃取的数据发送出去。' } },
  ],
};
