// Localization — EN / 中文. t(key, vars) for UI strings; loc(field) for {en,zh} data.
// Product brand names are intentionally not translated.

import { SESSION_COPY } from './data/session-copy.js';
export const LANGS = ['en', 'zh'];

const DICT = {
  'game.title':    { en: 'Sentinel', zh: '哨兵' },
  'game.subtitle': { en: 'Defend the Tower', zh: '守护大厦' },
  'game.byline':   { en: 'A Sangfor security experience', zh: '深信服安全体验' },
  'lang.toggle':   { en: '中文', zh: 'EN' },
  'badge.placeholder': { en: 'Official Sangfor logo · original game art', zh: '官方 Sangfor 标识 · 原创游戏美术' },

  // start
  'start.tagline': { en: 'A living building. A quiet intruder. You only see what you choose to watch.', zh: '一座鲜活的大厦，一个悄无声息的入侵者。你选择看守哪里，就只能看见哪里。' },
  'start.play':    { en: 'Enter the tower', zh: '进入大厦' },
  'start.brief1':  { en: 'You are the security operator of Meridian Tower.', zh: '你是子午大厦的安全运营人员。' },
  'start.brief2':  { en: 'Set up calmly first — no clock. Inspect rooms and people, deploy your tools.', zh: '先从容布置——没有计时。查看房间与人物，部署你的工具。' },
  'start.brief3':  { en: 'Then begin the day, read the clues your tools surface, and contain the breach.', zh: '然后开始这一天，解读工具呈现的线索，遏制这场入侵。' },

  // plain-language "what is this" onboarding (for first-time / non-technical players)
  'concept.title': { en: 'New here? Here\'s the idea', zh: '第一次玩？一句话看懂' },
  'concept.lead':  { en: 'This is a hands-on demo of how Sangfor protects a company. A hacker will try to break into the building, sneak around, and steal data — your job is to place the right Sangfor products in the right places to catch and stop them.', zh: '这是一个体验式演示，展示深信服如何守护一家企业。黑客会试图闯入大楼、四处潜行并窃取数据——你的任务，是把合适的深信服产品部署到合适的位置，发现并拦住他们。' },
  'concept.s1title': { en: '1 · Set up', zh: '1 · 布防' },
  'concept.s1':    { en: 'Place Sangfor products where they defend best — firewall at the door, endpoint protection on PCs, sensors on the network.', zh: '把深信服产品放到最能发挥作用的位置——防火墙守大门、终端防护装在电脑上、探针盯住网络。' },
  'concept.s2title': { en: '2 · Watch', zh: '2 · 观察' },
  'concept.s2':    { en: 'Start the day. A hidden intruder tries to get in and move around. You only see where your tools are watching — so coverage matters.', zh: '开始这一天。隐藏的入侵者会尝试进入并四处移动。你只能看到工具覆盖之处——所以布防是否到位很关键。' },
  'concept.s3title': { en: '3 · Stop it', zh: '3 · 处置' },
  'concept.s3':    { en: 'Connect the clues to confirm the attack, find the intruder, and shut them down — keeping business online and data safe.', zh: '串联线索确认攻击、找出入侵者并将其拦截——同时保住业务在线、数据安全。' },
  'concept.goal':  { en: 'Win by keeping Business Uptime and Data Integrity high. Lose them and the company is hit.', zh: '让“业务在线率”和“数据完整性”保持在高位即可取胜；一旦失守，企业就会受损。' },

  // phase / hud
  'phase.prep':      { en: 'SETUP', zh: '布置阶段' },
  'phase.incident':  { en: 'LIVE', zh: '进行中' },
  'phase.review':    { en: 'REVIEW', zh: '复盘' },
  'prep.banner':     { en: 'Setup — take your time. Look around, inspect the building, and deploy. The day starts only when you choose.', zh: '布置阶段——不必着急。四处查看、了解大厦、完成部署。只有你决定时，这一天才会开始。' },
  'begin.day':       { en: 'Begin the day ▶', zh: '开始这一天 ▶' },
  'hud.budget':      { en: 'Budget', zh: '预算' },
  'hud.uptime':      { en: 'Business uptime', zh: '业务在线率' },
  'hud.data':        { en: 'Data integrity', zh: '数据完整性' },
  'hud.time':        { en: 'Time', zh: '时间' },
  'hud.credits':     { en: 'cr', zh: '点' },
  'hud.pause':       { en: 'Pause', zh: '暂停' },
  'hud.resume':      { en: 'Resume', zh: '继续' },
  'hud.speed':       { en: 'Speed', zh: '速度' },

  // deploy tray
  'tray.title':     { en: 'Capabilities', zh: '安全能力' },
  'tray.hint':      { en: 'Pick a capability, then click where it glows in the building.', zh: '选择一个能力，然后点击楼里发光的位置进行部署。' },
  'tray.placing':   { en: 'Placing', zh: '正在部署' },
  'tray.clickWorld':{ en: 'click a glowing spot to place it', zh: '点击发光的位置完成部署' },
  'tray.cancel':    { en: 'cancel', zh: '取消' },
  'tray.cantAfford':{ en: 'not enough budget', zh: '预算不足' },
  'panel.cantAfford': { en: 'Not enough budget', zh: '预算不足' },

  // inspect
  'inspect.title':    { en: 'Inspection', zh: '查看' },
  'inspect.empty':    { en: 'Click a room, a workstation, or a person in the building to inspect it.', zh: '点击楼里的房间、工作站或人物即可查看详情。' },
  'inspect.floor':    { en: 'Floor', zh: '楼层' },
  'inspect.level':    { en: 'Level 3', zh: '三层' },
  'inspect.occupants':{ en: 'People here', zh: '此处人员' },
  'inspect.protected':{ en: 'Protected by EDR', zh: '已由 EDR 保护' },
  'inspect.unprotected': { en: 'No endpoint protection here', zh: '此处无终端防护' },
  'inspect.person':   { en: 'Person', zh: '人物' },
  'inspect.personNote': { en: 'Looks like ordinary staff. Tools — not appearances — reveal intent.', zh: '看起来像普通员工。揭示意图的是工具，而非外表。' },
  'inspect.workstation': { en: 'Workstation', zh: '工作站' },
  'inspect.clue':     { en: 'Signal detected here', zh: '此处检测到信号' },
  'inspect.coverage': { en: 'Visibility here', zh: '此处可见性' },
  'inspect.noCoverage': { en: 'No sensor watches this area yet', zh: '暂无传感能力覆盖此区域' },
  'inspect.purpose':  { en: 'Purpose', zh: '用途' },
  'inspect.deskCount':{ en: 'Workstations', zh: '工作站' },
  'inspect.locked':   { en: 'Locked by ransomware — uptime is dropping', zh: '被勒索软件锁定——在线率正在下降' },
  'inspect.restricted': { en: 'Access-restricted — will slow the actor if they pass through', zh: '已访问封控——若攻击者经过将被拖慢' },
  'cover.af':   { en: 'AF screens the entrance', zh: 'AF 守住入口' },
  'cover.ndr':  { en: 'NDR watches movement in/out', zh: 'NDR 监视进出移动' },
  'cover.edr':  { en: 'EDR protects a workstation here', zh: '此处有 EDR 保护工作站' },
  'cover.iag':  { en: 'IAG checks outbound data', zh: 'IAG 检查外发数据' },
  'cover.xdr':  { en: 'XDR command console', zh: 'XDR 指挥控制台' },
  'cover.astor':{ en: 'aStor protected snapshots', zh: 'aStor 受保护快照' },
  // room purposes (by type)
  'room.lobby':   { en: 'Reception & main entrance — everyone enters here.', zh: '前台与主入口——所有人从这里进入。' },
  'room.office':  { en: 'Open workspace with staff workstations.', zh: '员工办公的开放工位区。' },
  'room.meeting': { en: 'Meeting room for discussions and calls.', zh: '用于讨论与会议的会议室。' },
  'room.server':  { en: 'Server room — business systems run here.', zh: '服务器机房——业务系统在此运行。' },
  'room.vault':   { en: 'Data Vault — the crown-jewel data lives here.', zh: '数据金库——最核心的数据存放于此。' },
  'room.command': { en: 'Security Office — your command console.', zh: '安防办公室——你的指挥控制台。' },
  'room.egress':  { en: 'Mailroom & outbound gateway — the way data leaves.', zh: '收发室与外发网关——数据离开的通道。' },

  // signal feed
  'feed.title':    { en: 'Signal feed', zh: '信号流' },
  'feed.none':     { en: 'No signals yet. Deploy sensors to gain visibility.', zh: '暂无信号。部署传感能力以获得可见性。' },
  'feed.focus':    { en: 'Find this on the building', zh: '在大厦上定位' },
  'feed.hintPrep': { en: 'Once the day begins, anything your deployed tools notice will appear here — and on the building.', zh: '这一天开始后，你部署的工具所发现的一切都会出现在这里——以及大厦之上。' },
  'clue.weak':      { en: 'weak signal', zh: '弱信号' },
  'clue.confirmed': { en: 'CONFIRMED', zh: '已确认' },
  'clue.at':        { en: 'at', zh: '位置：' },
  'clue.perimeter': { en: 'Intrusion attempt at the entrance', zh: '入口处的入侵尝试' },
  'clue.endpoint':  { en: 'Suspicious activity on a workstation', zh: '工作站上的可疑行为' },
  'clue.network':   { en: 'Unusual movement between areas', zh: '区域之间的异常移动' },
  'clue.exfil':     { en: 'Data attempting to leave', zh: '数据正试图外发' },

  // responses
  'resp.title':      { en: 'Response', zh: '处置' },
  'resp.hint':       { en: 'Deploy protection, then respond here when you know where to act.', zh: '先部署防护；当你确定在哪处置时，再在此采取行动。' },
  'resp.isolate':    { en: 'Isolate device (EDR)', zh: '隔离设备（EDR）' },
  'resp.lockdown':   { en: 'Lock down area', zh: '封锁区域' },
  'resp.recover':    { en: 'Restore from snapshots (aStor)', zh: '从快照恢复（aStor）' },
  'resp.needEdr':    { en: 'That device has no EDR to isolate it', zh: '该设备没有可用于隔离的 EDR' },
  'resp.nothingHere':{ en: 'Nothing malicious on that device — no effect', zh: '该设备上没有恶意行为——没有效果' },
  'resp.cleanEndpoint':{ en: 'That endpoint is clean — you took an employee offline. Confirm the actor first.', zh: '那是一台正常终端——你让一名员工被迫下线。请先确认攻击者所在。' },
  'resp.wrongArea':  { en: 'The intruder is not there — you disrupted the business', zh: '入侵者不在那里——你反而干扰了业务' },
  'resp.restricted': { en: 'Area restricted — access control will slow the actor if they come this way (business disrupted here)', zh: '区域已封控——若攻击者经过这里，访问控制会拖慢其行动（此处业务受影响）' },
  'resp.restrictDelay': { en: 'Access control held the actor at a restricted area — you bought time', zh: '访问控制在封控区拦住了攻击者——你争取到了时间' },
  'resp.alreadyRestricted': { en: 'That area is already restricted', zh: '该区域已被封控' },
  'resp.alreadyProtected': { en: 'That device already has EDR', zh: '该设备已部署 EDR' },
  'resp.alreadyDeployed': { en: 'That capability is already deployed', zh: '该能力已部署' },
  'resp.needPrepared': { en: 'No protected snapshots were prepared beforehand', zh: '事先没有准备受保护的快照' },
  'resp.contained':  { en: 'Threat contained', zh: '威胁已遏制' },

  // toasts
  'toast.deployed':     { en: 'Deployed', zh: '部署完成' },
  'toast.ransomStopped':{ en: 'EDR stopped the ransomware', zh: 'EDR 阻断了勒索软件' },
  'toast.exfilBlocked': { en: 'IAG blocked the data from leaving', zh: 'IAG 阻止了数据外发' },
  'toast.confirmed':    { en: 'XDR confirmed the incident', zh: 'XDR 已确认该事件' },
  'toast.mdrAssist':    { en: 'MDR analysts assisted containment', zh: 'MDR 专家协助完成处置' },
  'toast.recovered':    { en: 'Room restored from snapshots', zh: '房间已从快照恢复' },

  // sophia
  'sophia.name':  { en: 'Solvia', zh: 'Solvia' },
  'sophia.role':  { en: 'Your tower guide', zh: '你的大厦引导助手' },
  'sophia.more':  { en: 'Tell me more', zh: '再详细些' },
  'sophia.ask':   { en: 'Ask Solvia', zh: '问 Solvia' },
  'sophia.greet': { en: "Hi, I'm Solvia. I'll ride along. Tap me whenever a clue, action, or product isn't clear — I'll point you toward something in the building first, then explain if you want.", zh: '你好，我是 Solvia，会一路陪着你。遇到看不懂的线索、操作或产品，点我一下——我会先把你引向楼里的某处，需要时再细说。' },

  // incident panel / deck / tabs / ticker (ops UI)
  'inc.label':      { en: 'ACTIVE INCIDENT', zh: '当前事件' },
  'inc.monitoring': { en: 'Monitoring — all quiet', zh: '监控中——一切正常' },
  'inc.suspicious': { en: 'Suspicious activity', zh: '可疑活动' },
  'inc.confirmed':  { en: 'Incident confirmed', zh: '事件已确认' },
  'inc.needXDR':    { en: 'Correlate with XDR', zh: '用 XDR 关联线索' },
  'inc.locate':     { en: 'Locate on the floor', zh: '在平面图上定位' },
  'deck.active':    { en: 'Active', zh: '运行中' },
  'deck.devices':   { en: 'devices', zh: '台' },
  'deck.available': { en: 'Available', zh: '可部署' },
  'deck.locked':    { en: 'Need budget', zh: '预算不足' },
  'tab.defense':    { en: 'Defense', zh: '安全防御' },
  'tab.cloud':      { en: 'Cloud & AI', zh: '云与 AI' },
  'tab.ops':        { en: 'Operations', zh: '安全运营' },
  'tab.replay':     { en: 'Replay', zh: '回放' },
  'tab.replayNote': { en: 'The spatial replay opens at the end of the day.', zh: '空间回放将在一天结束后开启。' },
  'info.soon':      { en: 'Infrastructure & AI layer — introduced as the scenario grows.', zh: '基础设施与 AI 层——随场景逐步引入。' },
  'info.hci':       { en: 'Hyperconverged infrastructure the floor runs on.', zh: '承载整层业务的超融合基础设施。' },
  'info.astor2':    { en: 'Resilient distributed storage with WORM snapshots.', zh: '带 WORM 快照的坚固分布式存储。' },
  'info.adc':       { en: 'Application delivery & load balancing.', zh: '应用交付与负载均衡。' },
  'info.sase':      { en: 'Secure access for remote branches & users.', zh: '面向远程分支与用户的安全接入。' },
  'info.aicp':      { en: 'Infrastructure for AI workloads and local helper rules.', zh: '承载 AI 工作负载与本地助手规则的基础设施。' },
  'info.xdrops':    { en: 'Correlates your sensors into one incident.', zh: '将各传感器关联为同一事件。' },
  'info.mdrops':    { en: '24/7 managed analysts, powered by XDR.', zh: '由 XDR 支撑的 7×24 托管专家。' },
  'info.gpt':       { en: 'The AI engine behind Sangfor XDR / MDR.', zh: 'Sangfor XDR / MDR 背后的 AI 引擎。' },
  'ticker.event':   { en: 'EVENT', zh: '事件' },
  'ticker.none':    { en: 'All quiet. Normal business activity.', zh: '一切正常，业务照常运转。' },
  'ticker.ransom':  { en: 'Ransomware locked a room — business uptime is dropping.', zh: '勒索软件锁定了一个房间——业务在线率正在下降。' },
  'ticker.otherFloor': { en: 'Movement on another floor', zh: '其他楼层有动静' },
  'floors.label':   { en: 'FLOOR', zh: '楼层' },
  'sophia.show':    { en: 'Show me', zh: '带我去看' },
  'act.isolate':    { en: 'Isolate', zh: '隔离' },
  'act.restrict':   { en: 'Restrict', zh: '封锁' },
  'act.restore':    { en: 'Restore', zh: '恢复' },
  'st.endpoint':    { en: 'Endpoint', zh: '终端' },
  'st.network':     { en: 'Network', zh: '网络' },
  'st.protected':   { en: 'Protected', zh: '已保护' },
  'st.unprotected': { en: 'Exposed', zh: '暴露' },
  'st.observed':    { en: 'Observed', zh: '可观测' },
  'st.unobserved':  { en: 'Blind', zh: '盲区' },

  // end / replay
  'end.win.title':     { en: 'Day secured', zh: '安全守住这一天' },
  'end.lose.title':    { en: 'Breach review', zh: '入侵复盘' },
  'end.win.contained': { en: 'You identified and contained the intruder before real damage was done.', zh: '你在造成实质损失前，就识别并遏制了入侵者。' },
  'end.win.survived':  { en: 'You reached end of day with the Data Room intact and the business running.', zh: '你守住了数据中心、保持了业务运转，顺利走到了一天结束。' },
  'end.lose.breach':   { en: "The intruder exfiltrated the Data Room's records.", zh: '入侵者已将数据中心的数据外泄。' },
  // honest outcomes
  'end.contained.title': { en: 'Threat contained', zh: '威胁已遏制' },
  'end.contained.body':  { en: 'You identified and cut off the intruder before data left or systems went down — clean containment.', zh: '你在数据外泄或系统瘫痪之前，识别并切断了入侵者——干净利落的遏制。' },
  'end.blocked.title':   { en: 'Exfiltration blocked', zh: '外泄已拦截' },
  'end.blocked.body':    { en: 'The data was stopped at the gateway on its way out. A real save — though the actor reached the exit before you stopped them.', zh: '数据在网关出口被拦下——这是实打实的挽救，但攻击者在被拦住前已抵达出口。' },
  'end.delayed.title':   { en: 'Delayed, not contained', zh: '只是拖延，并未遏制' },
  'end.delayed.body':    { en: 'The day ended with the intruder still active. You slowed and watched them, but never cut them off — tomorrow they continue. Detection is not containment.', zh: '这一天结束时，入侵者仍在活动。你拖慢并监视了他，却始终没能切断他——明天他会继续。发现不等于遏制。' },
  'end.lose.uptime':   { en: 'Business operations collapsed under disruption.', zh: '业务在持续干扰下陷入瘫痪。' },
  'end.replay':        { en: 'Spatial replay', zh: '空间回放' },
  'end.replay.sub':    { en: "Watch the actual route on the building — and what each capability contributed.", zh: '在大厦上回看真实路线——以及每项能力发挥了什么作用。' },
  'end.replay.play':   { en: '▶ Play route', zh: '▶ 播放路线' },
  'end.replay.replay': { en: '↻ Replay', zh: '↻ 重播' },
  'end.detected':  { en: 'you detected this', zh: '你已发现' },
  'end.missed':    { en: 'missed — no coverage', zh: '遗漏——无覆盖' },
  'end.blocked':   { en: 'blocked at the entrance', zh: '在入口被拦截' },
  'end.prevented': { en: 'ransomware stopped', zh: '勒索软件已阻断' },
  'end.contained': { en: 'contained here', zh: '在此遏制' },
  'end.again':     { en: 'Play again', zh: '再玩一次' },
  'end.score':     { en: 'Score', zh: '得分' },
  'end.backToGame':{ en: 'Back to building', zh: '返回大厦' },
};

Object.assign(DICT, {
  'deployment.locate': { en: 'Locate deployment', zh: '定位部署实体' },
  'deployment.location': { en: 'Location', zh: '部署位置' },
  'deployment.prepared': { en: 'Prepared for the incident', zh: '已为事件做好准备' },
  'deployment.monitoring': { en: 'Monitoring in this simulation', zh: '正在监测本次模拟' },
  'deployment.agent': { en: 'Agent installed on this endpoint', zh: '代理已安装在此终端' },
  'deployment.waiting': { en: 'Waiting for sensor evidence', zh: '等待传感器证据' },
  'deployment.correlated': { en: 'Evidence correlated', zh: '证据已完成关联' },
  'deployment.snapshots': { en: 'Protected snapshots prepared', zh: '已准备受保护快照' },
  'deployment.endpoint': { en: 'Inspect workstation', zh: '检查工作站' },
});

Object.assign(DICT, SESSION_COPY);
let current = 'en';
export function setLang(l) {
  if (LANGS.includes(l)) {
    current = l;
    if (typeof document !== 'undefined') document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  }
}
export function getLang() { return current; }
export function t(key, vars) {
  const e = DICT[key]; let s = e ? (e[current] ?? e.en) : key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
  return s;
}
export function loc(field) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  return field[current] ?? field.en ?? '';
}
