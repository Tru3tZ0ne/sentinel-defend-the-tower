// Scenario data — a three-level cutaway of Meridian Tower. Level 4 (top) is the executive
// floor; Level 3 holds the crown-jewel Data Room; Level 2 (bottom, via the internal stairwell)
// holds Finance. The incident currently spans L3 and L2, so the player must watch where the
// intruder goes; L4 is populated and available for future incident beats. Geometry is per level
// by src/world/building.js; the incident is driven by engine.js. Room ids are globally unique
// (so the shared nav graph needs no per-level prefixing except corridor/stair nodes).

export const LAYOUT = {
  // A taller cutaway tower: three stacked floors with breathing room between them so each
  // floor reads clearly. Level 4 (top) is the executive floor; Level 3 holds the Data Room;
  // Level 2 (bottom) holds Finance. The incident currently spans L3 and L2.
  levels: [
    { id: 'L4', y: 3.8,  name: { en: 'Level 4', zh: '四层' } },
    { id: 'L3', y: 0,    name: { en: 'Level 3', zh: '三层' } },
    { id: 'L2', y: -3.8, name: { en: 'Level 2', zh: '二层' } },
  ],
  defaultLevel: 'L3',
  bounds: { x0: -14, x1: 14, z0: -8.5, z1: 8.5 },
  corridor: { z0: -1.5, z1: 1.5 },
  wallH: 1.45,
  stair: { x: 12.6 },                 // internal stairwell connecting the levels (corridor right end)
  rooms: [
    // ---- Level 3 (upper; the target floor) ----
    { id: 'soc',       level: 'L3', type: 'command', name: { en: 'Security Office', zh: '安防中心' },  rect: { x0: -14, x1: -7, z0: 1.5, z1: 8.5 }, door: { x: -10.5, side: 'back' } },
    { id: 'office',    level: 'L3', type: 'office',  name: { en: 'Open Office',    zh: '开放办公区' }, rect: { x0: -7,  x1: 6,  z0: 1.5, z1: 8.5 }, desks: 4, door: { x: -0.5, side: 'back' } },
    { id: 'reception', level: 'L3', type: 'lobby',   name: { en: 'Reception',      zh: '前台接待' },   rect: { x0: 6,   x1: 14, z0: 1.5, z1: 8.5 }, door: { x: 10, side: 'back' }, entrance: true },
    { id: 'egress',    level: 'L3', type: 'egress',  name: { en: 'Mailroom / Exit', zh: '收发室 / 出口' }, rect: { x0: -14, x1: -8, z0: -8.5, z1: -1.5 }, door: { x: -11, side: 'front' }, exit: true },
    { id: 'server',    level: 'L3', type: 'server',  name: { en: 'Server Room',     zh: '服务器机房' },   rect: { x0: -8,  x1: -2, z0: -8.5, z1: -1.5 }, door: { x: -5, side: 'front' } },
    { id: 'vault',     level: 'L3', type: 'vault',   name: { en: 'Data Room',       zh: '数据中心' },     rect: { x0: -2,  x1: 5,  z0: -8.5, z1: -1.5 }, door: { x: 1.5, side: 'front' } },
    { id: 'meeting',   level: 'L3', type: 'meeting', name: { en: 'Meeting Room',    zh: '会议室' },       rect: { x0: 5,   x1: 14, z0: -8.5, z1: -1.5 }, door: { x: 9.5, side: 'front' } },
    // ---- Level 2 (lower; where the intruder detours for credentials) ----
    { id: 'l2-it',     level: 'L2', type: 'command', name: { en: 'IT Helpdesk',    zh: 'IT 服务台' },   rect: { x0: -14, x1: -7, z0: 1.5, z1: 8.5 }, door: { x: -10.5, side: 'back' } },
    { id: 'l2-work',   level: 'L2', type: 'office',  name: { en: 'Workspace',      zh: '办公区' },     rect: { x0: -7,  x1: 6,  z0: 1.5, z1: 8.5 }, desks: 4, door: { x: -0.5, side: 'back' } },
    { id: 'l2-lobby',  level: 'L2', type: 'lobby',   name: { en: 'Lobby',          zh: '大堂' },       rect: { x0: 6,   x1: 14, z0: 1.5, z1: 8.5 }, door: { x: 10, side: 'back' } },
    { id: 'l2-dock',   level: 'L2', type: 'egress',  name: { en: 'Loading Dock',   zh: '装卸区' },     rect: { x0: -14, x1: -8, z0: -8.5, z1: -1.5 }, door: { x: -11, side: 'front' } },
    { id: 'l2-store',  level: 'L2', type: 'server',  name: { en: 'Storage',        zh: '存储间' },     rect: { x0: -8,  x1: -2, z0: -8.5, z1: -1.5 }, door: { x: -5, side: 'front' } },
    { id: 'l2-finance', level: 'L2', type: 'office', name: { en: 'Finance',        zh: '财务部' },     rect: { x0: -2,  x1: 5,  z0: -8.5, z1: -1.5 }, desks: 3, door: { x: 1.5, side: 'front' } },
    { id: 'l2-conf',   level: 'L2', type: 'meeting', name: { en: 'Conference',     zh: '会议室' },     rect: { x0: 5,   x1: 14, z0: -8.5, z1: -1.5 }, door: { x: 9.5, side: 'front' } },
    // ---- Level 4 (top; executive floor) ----
    { id: 'l4-exec',   level: 'L4', type: 'command', name: { en: 'Executive Office', zh: '行政办公室' }, rect: { x0: -14, x1: -7, z0: 1.5, z1: 8.5 }, door: { x: -10.5, side: 'back' } },
    { id: 'l4-mgmt',   level: 'L4', type: 'office',  name: { en: 'Management',       zh: '管理部' },     rect: { x0: -7,  x1: 6,  z0: 1.5, z1: 8.5 }, desks: 4, door: { x: -0.5, side: 'back' } },
    { id: 'l4-lobby',  level: 'L4', type: 'lobby',   name: { en: 'Sky Lobby',        zh: '空中大堂' },   rect: { x0: 6,   x1: 14, z0: 1.5, z1: 8.5 }, door: { x: 10, side: 'back' } },
    { id: 'l4-fac',    level: 'L4', type: 'egress',  name: { en: 'Facilities',       zh: '设施间' },     rect: { x0: -14, x1: -8, z0: -8.5, z1: -1.5 }, door: { x: -11, side: 'front' } },
    { id: 'l4-comms',  level: 'L4', type: 'server',  name: { en: 'Comms Room',       zh: '通信机房' },   rect: { x0: -8,  x1: -2, z0: -8.5, z1: -1.5 }, door: { x: -5, side: 'front' } },
    { id: 'l4-records', level: 'L4', type: 'vault',  name: { en: 'Records',          zh: '档案室' },     rect: { x0: -2,  x1: 5,  z0: -8.5, z1: -1.5 }, door: { x: 1.5, side: 'front' } },
    { id: 'l4-board',  level: 'L4', type: 'meeting', name: { en: 'Boardroom',        zh: '董事会议室' }, rect: { x0: 5,   x1: 14, z0: -8.5, z1: -1.5 }, door: { x: 9.5, side: 'front' } },
  ],
  slots: {
    AF:    { room: 'reception', kind: 'entrance' },
    IAG:   { room: 'egress',    kind: 'checkpoint' },
    XDR:   { room: 'soc',       kind: 'console' },
    NDR:   { kind: 'network' },     // building-wide (movement across both floors + the stairwell)
    MDR:   { kind: 'offsite' },
    EDR:   { kind: 'endpoint' },    // any workstation on either floor
    ASTOR: { room: 'server',    kind: 'storage' },
  },
};

export const EMPLOYEES = [
  { id: 'e1', home: 'office',    name: { en: 'Maya (Marketing)',  zh: 'Maya（市场部）' } },
  { id: 'e2', home: 'office',    name: { en: 'Devi (Engineering)', zh: 'Devi（研发）' } },
  { id: 'e3', home: 'l2-finance', name: { en: 'Omar (Finance)',   zh: 'Omar（财务）' } },
  { id: 'e4', home: 'meeting',   name: { en: 'Priya (Sales)',     zh: 'Priya（销售）' } },
  { id: 'e5', home: 'reception', name: { en: 'Lena (Front desk)', zh: 'Lena（前台）' } },
  { id: 'e6', home: 'l2-work',   name: { en: 'Ivan (IT)',         zh: 'Ivan（IT）' } },
  { id: 'e7', home: 'l2-work',   name: { en: 'Sara (Ops)',        zh: 'Sara（运营）' } },
  { id: 'e8', home: 'l4-mgmt',   name: { en: 'Grace (Director)',  zh: 'Grace（总监）' } },
  { id: 'e9', home: 'l4-board',  name: { en: 'Leo (Executive)',   zh: 'Leo（高管）' } },
];

// The incident, spanning both floors.
export const INCIDENT = {
  id: 'two-floor-morning',
  name: { en: 'The Quiet Morning', zh: '平静的清晨' },
  duration: 105,
  loseUptimeBelow: 35,
  intruder: { name: { en: 'Visitor badge #0', zh: '访客胸牌 #0' } },
  beats: [
    { t: 0,  room: 'reception', act: 'enter',    ev: 'perimeter', blockableBy: 'AF',
      truth: { en: 'An unescorted visitor tailgates staff in through the Level 3 reception doors.', zh: '一名无人陪同的访客尾随员工从三层前台大门混入。' } },
    { t: 10, room: 'office',    act: 'foothold', ev: 'endpoint', desk: 'office#2',
      truth: { en: 'They settle at an empty Open Office desk and plug in a rogue device.', zh: '他在开放办公区一张空桌前坐下，接入一个恶意设备。' } },
    { t: 22, room: 'office',    act: 'recon',    ev: 'endpoint', desk: 'office#2',
      truth: { en: 'Quietly enumerating accounts and nearby shares.', zh: '悄悄枚举账户与附近的共享资源。' } },
    { t: 34, room: 'l2-finance', act: 'move',    ev: 'network',
      truth: { en: 'Takes the internal stairwell DOWN to Level 2 and slips into Finance.', zh: '走内部楼梯下到二层，潜入财务部。' } },
    { t: 48, room: 'l2-finance', act: 'collect', ev: 'endpoint', desk: 'l2-finance#1',
      truth: { en: 'Harvests privileged credentials from a Finance workstation.', zh: '从财务部工作站窃取特权凭据。' } },
    { t: 62, room: 'server',    act: 'move',     ev: 'network',
      truth: { en: 'Climbs back UP to Level 3 and heads for the Server Room.', zh: '返回三层，前往服务器机房。' } },
    { t: 72, room: 'server',    act: 'ransom',   ev: 'endpoint', desk: 'server#core', locks: 'server', preventBy: 'EDR',
      truth: { en: 'Attempts to encrypt the business systems in the Server Room.', zh: '试图加密服务器机房中的业务系统。' } },
    { t: 84, room: 'vault',     act: 'move',     ev: 'network',
      truth: { en: 'Moves to the Data Room where the crown-jewel records live.', zh: '移动到存放核心数据的数据中心。' } },
    { t: 94, room: 'vault',     act: 'collect',  ev: 'endpoint', desk: 'vault#core',
      truth: { en: 'Stages the crown-jewel data for theft.', zh: '将核心数据打包，准备窃取。' } },
    { t: 102, room: 'egress',   act: 'exfil',    ev: 'exfil', blockableBy: 'IAG', fatal: true,
      truth: { en: 'Tries to send the stolen data out through the mailroom gateway.', zh: '试图通过收发室网关把窃取的数据发送出去。' } },
  ],
};
