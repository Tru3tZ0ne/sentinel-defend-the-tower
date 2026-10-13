// Product catalog — grounded in Sangfor's official product positioning (see
// assets/brand/ASSETS.md for sources). Easy to edit without touching engine code.
//
// Fields:
//   id          internal id
//   name        brand product name (NOT translated)
//   athena      current "Athena" brand name, shown as a subtitle
//   icon        key into src/ui/icons.js
//   cost        budget (credits) to deploy
//   slotType    which building slot(s) it can occupy: 'perimeter'|'room'|'network'|'gateway'|'command'|'roster'|'vault'
//   sees        evidence types this capability surfaces as clues
//   tagline     one-line metaphor (localized)
//   capability  what it really does, in product terms (localized)
//   limitation  the teachable trade-off (localized)

export const PRODUCTS = {
  AF: {
    id: 'AF', name: 'Sangfor AF', athena: 'NGAF · Athena NGFW', icon: 'af',
    cost: 4, slotType: 'perimeter', sees: ['exploit'],
    tagline:    { en: 'Screening at the front door', zh: '大门口的安检' },
    capability: { en: 'Next-Gen Firewall + WAF with the Engine Zero AI malware engine. Inspects and blocks inbound intrusions and web attacks at the perimeter.', zh: '下一代防火墙 + WAF，内置 Engine Zero AI 恶意软件检测引擎。在边界检测并拦截入站入侵与 Web 攻击。' },
    limitation: { en: 'Guards the entrance — it is blind to an attacker already moving inside.', zh: '守的是入口——对已经潜入内部、横向移动的攻击者视而不见。' },
  },
  EDR: {
    id: 'EDR', name: 'Sangfor EDR', athena: 'Endpoint Secure · Athena EPP', icon: 'edr',
    cost: 3, slotType: 'room', sees: ['endpoint'],
    tagline:    { en: 'A smart guard inside the room', zh: '房间里的智能卫士' },
    capability: { en: 'Endpoint Secure: NGAV + EDR on the host. Spots suspicious processes, can isolate the host, and stops ransomware in seconds with bait-file honeypots.', zh: 'Endpoint Secure：主机上的下一代杀毒 + EDR。发现可疑进程，可一键隔离主机，并借助诱饵文件蜜罐在数秒内阻断勒索软件。' },
    limitation: { en: 'Only sees the rooms where you actually install it.', zh: '只能看见你真正安装了它的房间。' },
  },
  NDR: {
    id: 'NDR', name: 'Sangfor STA / NDR', athena: 'Cyber Command · Athena NDR', icon: 'ndr',
    cost: 5, slotType: 'network', sees: ['network'],
    tagline:    { en: 'Surveillance over every corridor', zh: '覆盖所有走廊的监控' },
    capability: { en: 'The STA sensor mirrors network traffic building-wide; Cyber Command uses AI baselines and MITRE ATT&CK to reveal lateral movement and C2 across the whole network.', zh: 'STA 探针镜像全楼网络流量；Cyber Command 通过 AI 基线与 MITRE ATT&CK 还原整网的横向移动与 C2 通信。' },
    limitation: { en: 'Sees movement on the network, not what happens on a host — and cannot block at the endpoint.', zh: '看得见网络上的移动，却看不见主机内部的动作——也无法在终端上直接处置。' },
  },
  IAG: {
    id: 'IAG', name: 'Sangfor IAG', athena: 'Internet Access Gateway · SWG', icon: 'iag',
    cost: 3, slotType: 'gateway', sees: ['exfil'],
    tagline:    { en: 'The checkpoint on the way out', zh: '出楼通道上的检查点' },
    capability: { en: 'Secure Web Gateway with DLP. Watches outbound traffic and blocks unauthorized data transfers — your last line against exfiltration.', zh: '上网行为管理网关，内置 DLP。监控出站流量，阻断未授权的数据外发——防外泄的最后一道闸门。' },
    limitation: { en: 'Watches the exit, not the break-in. By itself it never catches the intrusion.', zh: '守的是出口，不是入口。单独使用，它永远发现不了入侵本身。' },
  },
  XDR: {
    id: 'XDR', name: 'Sangfor XDR', athena: 'XDDR · Athena XDR', icon: 'xdr',
    cost: 6, slotType: 'command', sees: [],
    tagline:    { en: 'The command room that connects the dots', zh: '把线索串起来的指挥中心' },
    capability: { en: 'Correlates evidence from your other sensors with Security GPT. Two corroborating clue types become one CONFIRMED incident — revealing the attacker and making response reliable.', zh: '借助 Security GPT 关联各传感器的证据。两类相互印证的线索即可确认为同一起事件——暴露攻击者，并让处置更可靠。' },
    limitation: { en: 'Has nothing to correlate until sensors feed it. Powerful, but never works alone.', zh: '没有传感器喂数据，它就无从关联。很强大，但从不单打独斗。' },
  },
  MDR: {
    id: 'MDR', name: 'Sangfor MDR', athena: 'Cyber Guardian · Athena MDR', icon: 'mdr',
    cost: 6, slotType: 'roster', sees: [],
    tagline:    { en: 'Experts on call, 24/7', zh: '7×24 随时待命的专家团队' },
    capability: { en: 'A managed SOC team (powered by XDR + Security GPT) that watches around the clock, recommends the next move, and assists containment if you hesitate.', zh: '托管式安全运营团队（由 XDR + Security GPT 支撑），全天候盯守、给出下一步建议，并在你犹豫时协助处置。' },
    limitation: { en: 'The priciest option — it advises and assists, but the call is still yours.', zh: '最贵的选择——它提供建议与协助，但最终决定仍在你手上。' },
  },
  ASTOR: {
    id: 'ASTOR', name: 'Sangfor aStor', athena: 'Enterprise Distributed Storage', icon: 'astor',
    cost: 3, slotType: 'vault', sees: [],
    tagline:    { en: 'A resilient archive that heals', zh: '可自愈的坚固数据库' },
    capability: { en: 'Distributed storage with erasure-coding redundancy and backups. Lets you recover a room locked by ransomware and bring the business back online.', zh: '采用纠删码冗余与备份的分布式存储。可恢复被勒索软件锁定的房间，让业务重新上线。' },
    limitation: { en: 'Recovery, not prevention — it restores what was hit, it does not stop the hit.', zh: '负责恢复，而非预防——它能还原被打击的部分，却拦不住攻击本身。' },
  },
};

// Order shown in the deploy panel for Milestone 1.
export const PRODUCT_ORDER = ['AF', 'EDR', 'NDR', 'IAG', 'XDR', 'MDR', 'ASTOR'];
