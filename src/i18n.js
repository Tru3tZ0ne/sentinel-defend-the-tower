// Localization — EN / 中文. t(key, vars) for UI strings; loc(field) for {en,zh} data.
// Product brand names are intentionally not translated.

export const LANGS = ['en', 'zh'];

const DICT = {
  'game.title':    { en: 'Sentinel', zh: '哨兵' },
  'game.subtitle': { en: 'Defend the Tower', zh: '守护大厦' },
  'game.byline':   { en: 'A Sangfor security experience', zh: '深信服安全体验' },
  'lang.toggle':   { en: '中文', zh: 'EN' },
  'badge.placeholder': { en: 'original art · official logo TBD', zh: '原创美术 · 官方标识待替换' },

  // start
  'start.tagline': { en: 'A living building. A quiet intruder. You only see what you choose to watch.', zh: '一座鲜活的大厦，一个悄无声息的入侵者。你选择看守哪里，就只能看见哪里。' },
  'start.play':    { en: 'Enter the tower', zh: '进入大厦' },
  'start.brief1':  { en: 'You are the security operator of Meridian Tower.', zh: '你是子午大厦的安全运营人员。' },
  'start.brief2':  { en: 'Set up calmly first — no clock. Inspect rooms and people, deploy your tools.', zh: '先从容布置——没有计时。查看房间与人物，部署你的工具。' },
  'start.brief3':  { en: 'Then begin the day, read the clues your tools surface, and contain the breach.', zh: '然后开始这一天，解读工具呈现的线索，遏制这场入侵。' },

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
  'resp.wrongArea':  { en: 'The intruder is not there — you disrupted the business', zh: '入侵者不在那里——你反而干扰了业务' },
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
  'sophia.name':  { en: 'Sophia', zh: 'Sophia' },
  'sophia.role':  { en: 'your guide', zh: '你的向导' },
  'sophia.more':  { en: 'Tell me more', zh: '再详细些' },
  'sophia.ask':   { en: 'Ask Sophia', zh: '问 Sophia' },
  'sophia.greet': { en: "Hi, I'm Sophia. I'll ride along. Tap me whenever a clue, action, or product isn't clear — I'll point you toward something in the building first, then explain if you want.", zh: '你好，我是 Sophia，会一路陪着你。遇到看不懂的线索、操作或产品，点我一下——我会先把你引向楼里的某处，需要时再细说。' },

  // end / replay
  'end.win.title':     { en: 'Day secured', zh: '安全守住这一天' },
  'end.lose.title':    { en: 'Breach review', zh: '入侵复盘' },
  'end.win.contained': { en: 'You identified and contained the intruder before real damage was done.', zh: '你在造成实质损失前，就识别并遏制了入侵者。' },
  'end.win.survived':  { en: 'You reached end of day with the Data Room intact and the business running.', zh: '你守住了数据中心、保持了业务运转，顺利走到了一天结束。' },
  'end.lose.breach':   { en: "The intruder exfiltrated the Data Room's records.", zh: '入侵者已将数据中心的数据外泄。' },
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

let current = 'en';
export function setLang(l) { if (LANGS.includes(l)) current = l; }
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
