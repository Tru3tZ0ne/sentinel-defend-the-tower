// Level 1 — "Meridian Tower". Data-driven: building layout + the ground-truth incident.
// The engine reads `plan` as the attacker's intended sequence and reacts to the player's
// defenses. Everything here is editable without touching engine logic.

export const LEVEL1 = {
  id: 'level1',
  name: { en: 'Meridian Tower — Q1', zh: '子午大厦 — 第一季度' },
  duration: 56,                 // game-seconds until the "quarter review"
  startBudget: 11,              // starting credits
  incomeEvery: 9,               // +1 credit this often (business revenue)
  uptimeLossPerLockedRoom: 10,  // uptime drop per second a room stays locked (scaled in engine)
  loseUptimeBelow: 35,

  // Rooms laid out on a 2-column grid of floors (row 1 = top floor).
  // type: 'normal' | 'systems' | 'vault'
  rooms: [
    { id: 'r_exec',      floor: 4, row: 1, col: 1, type: 'normal',  name: { en: 'Executive Office', zh: '高管办公室' } },
    { id: 'r_vault',     floor: 4, row: 1, col: 2, type: 'vault',   name: { en: 'Data Vault',        zh: '数据金库' }, hasData: true },
    { id: 'r_server',    floor: 3, row: 2, col: 1, type: 'systems', name: { en: 'Server Room',       zh: '服务器机房' } },
    { id: 'r_dev',       floor: 3, row: 2, col: 2, type: 'normal',  name: { en: 'Dev / Build',       zh: '研发构建区' } },
    { id: 'r_finance',   floor: 2, row: 3, col: 1, type: 'normal',  name: { en: 'Finance',           zh: '财务部' } },
    { id: 'r_hr',        floor: 2, row: 3, col: 2, type: 'normal',  name: { en: 'HR',                zh: '人力资源部' } },
    { id: 'r_reception', floor: 1, row: 4, col: 1, type: 'normal',  name: { en: 'Reception',         zh: '前台接待' } },
    { id: 'r_office',    floor: 1, row: 4, col: 2, type: 'normal',  name: { en: 'Open Office',       zh: '开放办公区' } },
  ],

  // Fixed deployment slots that are not rooms.
  slots: [
    { id: 'perimeter', slotType: 'perimeter', name: { en: 'Internet Perimeter', zh: '互联网边界' } },
    { id: 'gateway',   slotType: 'gateway',   name: { en: 'Outbound Gateway',    zh: '出口网关' } },
    { id: 'network',   slotType: 'network',   name: { en: 'Network Backbone',    zh: '网络骨干' } },
    { id: 'command',   slotType: 'command',   name: { en: 'Command Room',        zh: '指挥中心' } },
    { id: 'roster',    slotType: 'roster',    name: { en: 'SOC Roster',          zh: '安全运营团队' } },
  ],

  // The attacker's plan (ground truth). The engine advances through it, reacting to
  // the player's defenses. `ev` = evidence type a sensor could surface.
  plan: [
    { t: 4,  act: 'intrude',  node: 'perimeter', ev: 'exploit',  blockableBy: 'AF',
      truth: { en: 'Exploit probe against the public web app at the perimeter.', zh: '针对对外 Web 应用的边界漏洞探测。' } },
    { t: 9,  act: 'foothold', node: 'r_office',  ev: 'endpoint',
      truth: { en: 'Phishing payload gains a foothold on an Open Office endpoint.', zh: '钓鱼载荷在开放办公区某终端上获得立足点。' } },
    { t: 14, act: 'recon',    node: 'r_office',  ev: 'endpoint',
      truth: { en: 'Host reconnaissance: enumerating users and shares.', zh: '主机侦察：枚举用户与共享资源。' } },
    { t: 19, act: 'move',     node: 'r_finance', ev: 'network',
      truth: { en: 'Lateral movement from Open Office to Finance.', zh: '从开放办公区横向移动至财务部。' } },
    { t: 24, act: 'cred',     node: 'r_finance', ev: 'endpoint',
      truth: { en: 'Credential theft on a Finance workstation.', zh: '在财务部工作站窃取凭据。' } },
    { t: 29, act: 'move',     node: 'r_server',  ev: 'network',
      truth: { en: 'Lateral movement into the Server Room.', zh: '横向移动进入服务器机房。' } },
    { t: 34, act: 'ransom',   node: 'r_server',  ev: 'endpoint', locks: 'r_server', preventBy: 'EDR',
      truth: { en: 'Ransomware detonates in the Server Room (business systems).', zh: '勒索软件在服务器机房（业务系统）引爆。' } },
    { t: 39, act: 'move',     node: 'r_vault',   ev: 'network',
      truth: { en: 'Lateral movement toward the Data Vault.', zh: '向数据金库横向移动。' } },
    { t: 44, act: 'collect',  node: 'r_vault',   ev: 'endpoint',
      truth: { en: 'Staging and compressing the crown-jewel data.', zh: '对核心数据进行打包与压缩。' } },
    { t: 50, act: 'exfil',    node: 'r_vault',   ev: 'exfil', blockableBy: 'IAG', fatal: true,
      truth: { en: 'Exfiltration of Vault data out through the gateway.', zh: '金库数据经网关向外发送。' } },
  ],
};
