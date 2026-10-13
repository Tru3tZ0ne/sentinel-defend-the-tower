// Product catalog — grounded in Sangfor's official positioning (sources in
// assets/brand/ASSETS.md). Copy is deliberately free of unverifiable performance numbers;
// capabilities and especially LIMITATIONS are represented honestly.
//
// Fields: name (brand, not translated), athena (current brand name), icon, cost,
// worldRole (how it appears in the building), tagline / capability / limitation (localized).

export const PRODUCTS = {
  AF: {
    id: 'AF', name: 'Sangfor AF', athena: 'NGAF · Athena NGFW', icon: 'af', cost: 4,
    worldRole: { en: 'A screening archway at the lobby entrance.', zh: '大堂入口的安检闸门。' },
    tagline:    { en: 'Screening at the front door', zh: '大门口的安检' },
    capability: { en: 'Next-Gen Firewall + web protection at the perimeter. Inspects and blocks inbound intrusions and web attacks before they reach the building.', zh: '边界的下一代防火墙 + Web 防护。在入侵抵达楼内之前检测并拦截入站攻击与 Web 攻击。' },
    limitation: { en: 'Guards the entrance only — once an actor is inside, AF cannot see or stop them.', zh: '只守入口——一旦攻击者进入楼内，AF 既看不见也拦不住。' },
  },
  EDR: {
    id: 'EDR', name: 'Sangfor EDR', athena: 'Endpoint Secure · Athena EPP', icon: 'edr', cost: 3,
    worldRole: { en: 'A protective ring over a single workstation.', zh: '覆盖单台工作站的防护光环。' },
    tagline:    { en: 'A smart guard on one endpoint', zh: '单台终端上的智能卫士' },
    capability: { en: 'Endpoint protection on the host: spots suspicious activity, can isolate the device, and resists ransomware with bait-file honeypots plus layered recovery (real-time file backup and Windows VSS snapshots).', zh: '主机上的终端防护：发现可疑行为，可隔离该设备，并以诱饵文件蜜罐加分层恢复（实时文件备份与 Windows VSS 快照）抵御勒索软件。' },
    limitation: { en: 'Protects only the endpoints where it is installed. Sangfor notes it cannot fully block unknown/zero-day attacks — so recovery is a fallback, not a guarantee.', zh: '只保护已安装它的终端。深信服也说明它无法完全拦截未知/零日攻击——因此恢复是兜底手段，而非万无一失的保证。' },
  },
  NDR: {
    id: 'NDR', name: 'Sangfor STA / NDR', athena: 'Cyber Command · Athena NDR', icon: 'ndr', cost: 5,
    worldRole: { en: 'Sensor nodes watching the corridors & stairwell.', zh: '监视走廊与楼梯间的传感节点。' },
    tagline:    { en: 'Eyes on movement between areas', zh: '区域之间移动的“眼睛”' },
    capability: { en: 'The STA sensor mirrors network traffic; Cyber Command uses AI baselines and MITRE ATT&CK to surface unusual lateral movement and command-and-control across the whole building.', zh: 'STA 探针镜像网络流量；Cyber Command 以 AI 基线与 MITRE ATT&CK 还原整楼的异常横向移动与 C2 通信。' },
    limitation: { en: 'Sees movement on the network, not actions on a host — and it detects; it does not block on the endpoint.', zh: '看得见网络上的移动，却看不见主机内部的动作——它负责发现，而非在终端上直接处置。' },
  },
  IAG: {
    id: 'IAG', name: 'Sangfor IAG', athena: 'Internet Access Gateway · SWG', icon: 'iag', cost: 3,
    worldRole: { en: 'A checkpoint gate at the mailroom / egress.', zh: '收发室 / 出口处的检查闸门。' },
    tagline:    { en: 'The checkpoint on the way out', zh: '向外通道上的检查点' },
    capability: { en: 'Secure Web Gateway with data-loss prevention. Watches outbound traffic and can block unauthorized data transfers — a last line against exfiltration.', zh: '上网行为管理网关，内置数据防泄露（DLP）。监控出站流量，可阻断未授权的数据外发——防外泄的最后一道防线。' },
    limitation: { en: 'Watches the exit, not the break-in. On its own it never catches the intrusion itself.', zh: '守的是出口，不是入口。单独使用，它发现不了入侵本身。' },
  },
  XDR: {
    id: 'XDR', name: 'Sangfor XDR', athena: 'XDDR · Athena XDR', icon: 'xdr', cost: 6,
    worldRole: { en: 'A command console in the Security Office.', zh: '安防办公室里的指挥控制台。' },
    tagline:    { en: 'Connects the clues into one incident', zh: '把线索串成同一起事件' },
    capability: { en: 'Correlates evidence from your other sensors (with Security GPT). When two different clue types line up, it confirms a single incident and reveals where the actor is.', zh: '关联各传感器的证据（结合 Security GPT）。当两类不同线索相互印证时，确认为同一起事件，并暴露攻击者所在位置。' },
    limitation: { en: 'Has nothing to correlate until sensors feed it — powerful, but never works alone.', zh: '没有传感器喂数据就无从关联——很强大，但从不单打独斗。' },
  },
  MDR: {
    id: 'MDR', name: 'Sangfor MDR', athena: 'Cyber Guardian · Athena MDR', icon: 'mdr', cost: 6,
    worldRole: { en: 'A remote SOC beacon linked off-site.', zh: '连接异地的远程安全运营信标。' },
    tagline:    { en: 'A remote expert team, around the clock', zh: '7×24 的远程专家团队' },
    capability: { en: 'A managed SOC service (powered by XDR + Security GPT). Analysts monitor continuously, recommend the next move, and can assist containment if you hesitate.', zh: '托管式安全运营服务（由 XDR + Security GPT 支撑）。专家持续监控、给出下一步建议，并在你犹豫时协助处置。' },
    limitation: { en: 'A service, not a sensor — it still relies on your deployed tools for visibility, and the decision stays yours.', zh: '它是服务而非传感器——仍依赖你部署的工具获取可见性，最终决定权也在你。' },
  },
  ASTOR: {
    id: 'ASTOR', name: 'Sangfor aStor', athena: 'Enterprise Distributed Storage', icon: 'astor', cost: 3,
    worldRole: { en: 'Resilient storage protecting the Server Room.', zh: '守护服务器机房的坚固存储。' },
    tagline:    { en: 'Resilient storage with protected snapshots', zh: '带受保护快照的坚固存储' },
    capability: { en: 'Distributed storage with erasure-coding durability and immutable (WORM) snapshots. If snapshots are prepared in advance, data hit by ransomware can be restored from them.', zh: '采用纠删码保证持久性，并提供不可篡改（WORM）快照的分布式存储。若事先准备了快照，被勒索软件影响的数据可据此恢复。' },
    limitation: { en: 'Storage resilience, not automatic full backup/restore. Recovery only works if protection was set up beforehand, and it is part of a defense-in-depth plan — not a guarantee against novel attacks.', zh: '它提供的是存储层面的韧性，而非自动的完整备份/恢复。只有事先部署了保护，恢复才有效；它是纵深防御的一环，并不能保证应对新型攻击。' },
  },
};

export const PRODUCT_ORDER = ['AF', 'EDR', 'NDR', 'IAG', 'XDR', 'MDR', 'ASTOR'];
