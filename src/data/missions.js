import { INCIDENT } from './scenario.js';

// All missions share a building, but exercise different operational decisions.
const beat = (t, room, act, ev, en, zh, extra = {}) => ({ t, room, act, ev, truth: { en, zh }, ...extra });
export const MISSIONS = {
  quiet: { ...INCIDENT,
    brief: { en: 'Follow a quiet intrusion across two floors. The entry workstation differs each run — detect where, don’t guess. Then correlate and contain.', zh: '追踪跨越两层的隐蔽入侵。每局的入侵起始工位都会不同——要靠侦测找出位置，而非猜测。随后完成关联与遏制。' } },
  robber: {
    id: 'robber', name: { en: 'The Lockout', zh: '勒索封锁' }, duration: 100, loseUptimeBelow: 35,
    brief: { en: 'A stolen identity opens the door. Prepare snapshots, protect endpoints, and restore services.', zh: '被盗身份打开了入口。提前准备快照，保护终端并恢复业务。' },
    intruder: INCIDENT.intruder,
    beats: [
      beat(0, 'reception', 'enter', 'perimeter', 'A visitor tries the main entrance.', '访客试探大堂入口。'),
      beat(9, 'l2-finance', 'remote', 'network', 'A stolen remote identity reaches Finance; scoped SASE access can reject it.', '被盗远程身份连接财务部；限定范围的 SASE 访问策略可拒绝连接。', { desk: 'l2-finance#1' }),
      beat(20, 'l2-finance', 'foothold', 'endpoint', 'The compromised Finance endpoint launches a payload.', '受控财务终端启动恶意载荷。', { desk: 'l2-finance#1' }),
      beat(32, 'server', 'move', 'network', 'The operator pivots to production servers.', '攻击者横向移动至生产服务器。'),
      beat(43, 'server', 'ransom', 'endpoint', 'Production volumes are targeted for encryption.', '生产卷成为加密目标。', { desk: 'server#core', locks: 'server' }),
      beat(59, 'l2-finance', 'ransom', 'endpoint', 'A second payload targets Finance. Server recovery alone will not stop it.', '第二个载荷攻击财务部；仅恢复服务器无法阻止它。', { desk: 'l2-finance#1', locks: 'l2-finance' }),
      beat(73, 'vault', 'move', 'network', 'The operator seeks the protected records.', '攻击者寻找核心数据。'),
      beat(82, 'vault', 'collect', 'endpoint', 'Records are staged for double extortion.', '核心数据被打包，用于双重勒索。', { desk: 'vault#core' }),
      beat(94, 'egress', 'exfil', 'exfil', 'The stolen records leave unless egress policy blocks them.', '若出口策略未阻断，被盗数据将外泄。'),
    ],
  },
  storm: {
    id: 'storm', name: { en: 'Under Pressure', zh: '业务风暴' }, duration: 100, loseUptimeBelow: 35,
    brief: { en: 'Keep services online through traffic pressure, a host failure, and a remote intrusion.', zh: '在流量冲击、主机故障和远程入侵中保持业务在线。' },
    intruder: INCIDENT.intruder,
    beats: [
      beat(0, 'reception', 'enter', 'perimeter', 'A perimeter probe distracts the operator.', '边界试探分散了运营人员的注意力。'),
      beat(12, 'server', 'ddos', 'network', 'A traffic surge saturates the application tier. ADC models service distribution, not unlimited DDoS protection.', '流量激增压垮应用层；ADC 模拟服务分发，并非无限抗 DDoS 防护。'),
      beat(27, 'server', 'failure', 'network', 'A compute host fails. Prepared HCI capacity reduces the service impact.', '计算主机故障；预留的 HCI 容量可以降低业务影响。'),
      beat(38, 'l2-finance', 'remote', 'network', 'An unauthorized remote session attempts entry through a scoped access policy.', '未授权远程会话尝试突破限定访问策略。', { desk: 'l2-finance#1' }),
      beat(51, 'l2-finance', 'foothold', 'endpoint', 'The remote foothold starts harvesting credentials.', '远程立足点开始窃取凭据。', { desk: 'l2-finance#1' }),
      beat(66, 'server', 'ransom', 'endpoint', 'Production systems face encryption.', '生产系统遭到加密攻击。', { desk: 'server#core', locks: 'server' }),
      beat(80, 'vault', 'move', 'network', 'The actor crosses into the Data Room.', '攻击者进入数据中心。'),
      beat(92, 'egress', 'exfil', 'exfil', 'The actor attempts to export business records.', '攻击者尝试导出业务数据。'),
    ],
  },
};
export const DIFFICULTIES = {
  guided: { budget: 22, timing: 1.2, damage: 0.8 },
  standard: { budget: 15, timing: 1, damage: 1 },
  expert: { budget: 12, timing: 0.8, damage: 1.15 },
};
// Reproducible per-session variation: the Quiet Morning's foothold workstation differs each
// run (within the Open Office), so memorising one scripted "isolate office#2" response is less
// effective — the player must actually detect the entry. Causal ordering is unchanged; the
// chosen desk is recorded on the mission for replay/report. Other missions keep their stable
// stolen-identity route. A deterministic seed can be supplied for tests.
const FOOTHOLD_VARIANTS = { 'two-floor-morning': { room: 'office', desks: ['office#1', 'office#2', 'office#3', 'office#4'] } };
function applyFootholdVariant(mission, seed) {
  const v = FOOTHOLD_VARIANTS[mission.id];
  if (!v) return;
  const desk = v.desks[Math.floor(seed * v.desks.length) % v.desks.length];
  mission.footholdDesk = desk; mission.variantSeed = seed;
  for (const b of mission.beats) if ((b.act === 'foothold' || b.act === 'recon') && b.room === v.room) b.desk = desk;
}
export function missionFor(id = 'quiet', difficulty = 'standard', seed = Math.random()) {
  const source = MISSIONS[id] || MISSIONS.quiet;
  const settings = DIFFICULTIES[difficulty] || DIFFICULTIES.standard;
  const mission = { ...source, difficulty, ...settings, duration: source.duration * settings.timing,
    beats: source.beats.map(b => ({ ...b, t: b.t * settings.timing })) };
  applyFootholdVariant(mission, seed);
  return mission;
}
