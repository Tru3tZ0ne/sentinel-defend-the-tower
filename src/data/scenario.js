// Scenario data for Milestone 2 — "The Quiet Morning at Meridian Tower".
// One memorable incident, authored as beats on a nav graph. The building geometry is
// generated from LAYOUT by src/world/building.js; the incident is driven by engine.js.
//
// Design intent: ordinary activity → a subtle compromise → clues from deployed
// capabilities → investigation → a meaningful containment decision → spatial replay.
// Nothing here hard-codes vendor performance numbers; product behavior is accurate to
// Sangfor's positioning (see assets/brand/ASSETS.md and DESIGN.md).

// ---- Building layout (semantic; coordinates computed in building.js) ----
// Rooms are listed per floor, left→right. `slot` marks where a product physically lives.
export const LAYOUT = {
  floors: 4,
  floorHeight: 3.0,
  width: 20,          // interior width (X)
  depth: 9,           // interior depth (Z)
  stairWidth: 3.0,    // right-hand circulation core
  rooms: [
    // Floor 0 — ground
    { id: 'lobby',   floor: 0, type: 'lobby',   name: { en: 'Lobby & Reception', zh: '大堂与前台' } },
    { id: 'soc',     floor: 0, type: 'command', name: { en: 'Security Office',    zh: '安防办公室' } },
    { id: 'egress',  floor: 0, type: 'egress',  name: { en: 'Mailroom / Egress',  zh: '收发室 / 出口' } },
    // Floor 1
    { id: 'office',  floor: 1, type: 'office',  name: { en: 'Open Office',        zh: '开放办公区' }, desks: 4 },
    { id: 'meeting', floor: 1, type: 'meeting', name: { en: 'Meeting Room',       zh: '会议室' } },
    // Floor 2
    { id: 'finance', floor: 2, type: 'office',  name: { en: 'Finance',            zh: '财务部' }, desks: 3 },
    { id: 'hr',      floor: 2, type: 'office',  name: { en: 'Human Resources',    zh: '人力资源部' }, desks: 2 },
    // Floor 3
    { id: 'server',  floor: 3, type: 'server',  name: { en: 'Server Room',        zh: '服务器机房' } },
    { id: 'vault',   floor: 3, type: 'vault',   name: { en: 'Data Vault',         zh: '数据金库' } },
  ],
  // Where each product physically sits in the world.
  slots: {
    AF:    { room: 'lobby',  kind: 'entrance' },
    IAG:   { room: 'egress', kind: 'checkpoint' },
    XDR:   { room: 'soc',    kind: 'console' },
    NDR:   { kind: 'network' },     // building-wide; placed on corridors
    MDR:   { kind: 'offsite' },     // remote SOC beacon
    EDR:   { kind: 'endpoint' },    // placed on a workstation (desk)
    ASTOR: { room: 'server', kind: 'storage' },
  },
};

// ---- Cast ----
// Employees wander between their home room and common areas. One intruder blends in.
export const EMPLOYEES = [
  { id: 'e1', home: 'office',  name: { en: 'Maya (Marketing)', zh: 'Maya（市场部）' } },
  { id: 'e2', home: 'office',  name: { en: 'Devi (Engineering)', zh: 'Devi（研发）' } },
  { id: 'e3', home: 'finance', name: { en: 'Omar (Finance)', zh: 'Omar（财务）' } },
  { id: 'e4', home: 'hr',      name: { en: 'Lena (HR)', zh: 'Lena（人力）' } },
  { id: 'e5', home: 'soc',     name: { en: 'Ivan (Facilities)', zh: 'Ivan（后勤）' } },
  { id: 'e6', home: 'meeting', name: { en: 'Priya (Sales)', zh: 'Priya（销售）' } },
];

// ---- The incident (ground truth) ----
// Each beat has a time (seconds after "Begin the day"), the intruder's target room,
// the kind of action, and the evidence type a *deployed sensor* could surface.
// evidence: 'perimeter' (AF), 'endpoint' (EDR on that desk), 'network' (NDR), 'exfil' (IAG).
export const INCIDENT = {
  id: 'quiet-morning',
  name: { en: 'The Quiet Morning', zh: '平静的清晨' },
  duration: 95,                 // seconds of incident time until "end of day"
  loseUptimeBelow: 35,
  intruder: { name: { en: 'Visitor badge #0', zh: '访客胸牌 #0' } },
  beats: [
    { t: 0,   room: 'lobby',   act: 'enter',   ev: 'perimeter', blockableBy: 'AF',
      truth: { en: 'An unescorted visitor tailgates staff through the lobby doors.', zh: '一名无人陪同的访客尾随员工混入大堂。' } },
    { t: 10,  room: 'office',  act: 'foothold', ev: 'endpoint', desk: 'office#2',
      truth: { en: 'They sit at an empty Open Office desk and plug in a rogue device.', zh: '他在开放办公区一张空桌前坐下，接入一个恶意设备。' } },
    { t: 20,  room: 'office',  act: 'recon',    ev: 'endpoint', desk: 'office#2',
      truth: { en: 'Quietly enumerating accounts and nearby shares.', zh: '悄悄枚举账户与附近的共享资源。' } },
    { t: 32,  room: 'finance', act: 'move',     ev: 'network',
      truth: { en: 'Moves upstairs into Finance, using stolen credentials.', zh: '利用窃取的凭据上楼潜入财务部。' } },
    { t: 44,  room: 'finance', act: 'collect',  ev: 'endpoint', desk: 'finance#1',
      truth: { en: 'Harvests credentials from a Finance workstation.', zh: '从财务部工作站收集凭据。' } },
    { t: 56,  room: 'server',  act: 'move',     ev: 'network',
      truth: { en: 'Moves to the Server Room on the top floor.', zh: '移动到顶层的服务器机房。' } },
    { t: 66,  room: 'server',  act: 'ransom',   ev: 'endpoint', locks: 'server', preventBy: 'EDR',
      truth: { en: 'Attempts to encrypt business systems in the Server Room.', zh: '试图加密服务器机房中的业务系统。' } },
    { t: 74,  room: 'vault',   act: 'move',     ev: 'network',
      truth: { en: 'Slips into the Data Vault.', zh: '潜入数据金库。' } },
    { t: 84,  room: 'vault',   act: 'collect',  ev: 'endpoint', desk: 'vault#core',
      truth: { en: 'Stages the crown-jewel data for theft.', zh: '将核心数据打包，准备窃取。' } },
    { t: 92,  room: 'egress',  act: 'exfil',    ev: 'exfil', blockableBy: 'IAG', fatal: true,
      truth: { en: 'Tries to send the stolen data out through the mailroom gateway.', zh: '试图通过收发室网关把窃取的数据发送出去。' } },
  ],
};
