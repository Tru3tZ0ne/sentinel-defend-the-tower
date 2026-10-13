// Localization: a tiny t(key, vars) dictionary over EN / 中文.
// All player-facing UI strings live here. Product *names* are intentionally NOT
// translated (they are brand names); their blurbs are translated in data/products.js.

export const LANGS = ['en', 'zh'];

const DICT = {
  // --- shell / meta ---
  'game.title':        { en: 'Sentinel', zh: '哨兵' },
  'game.subtitle':     { en: 'Defend the Tower', zh: '守护大厦' },
  'game.byline':       { en: 'A Sangfor security experience', zh: '深信服安全体验' },
  'lang.toggle':       { en: '中文', zh: 'EN' },

  // --- start screen ---
  'start.tagline':     { en: 'Meridian Tower is under quiet attack. What you deploy decides what you can see.', zh: '子午大厦正遭受悄然入侵。你部署什么，就能看见什么。' },
  'start.play':        { en: 'Start shift', zh: '开始值守' },
  'start.how':         { en: 'How to play', zh: '玩法说明' },
  'start.brief1':      { en: 'You are the security operator of a growing enterprise HQ.', zh: '你是一家成长型企业总部的安全运营人员。' },
  'start.brief2':      { en: 'Attackers are already moving. You can only see where your tools give you eyes.', zh: '攻击者已经潜入。只有部署了工具的地方，你才看得见。' },
  'start.brief3':      { en: 'Deploy Sangfor capabilities, read the clues, and contain the breach — while keeping the business running.', zh: '部署深信服的安全能力，解读线索，遏制入侵——同时保证业务持续运转。' },

  // --- HUD ---
  'hud.budget':        { en: 'Budget', zh: '预算' },
  'hud.uptime':        { en: 'Business uptime', zh: '业务在线率' },
  'hud.data':          { en: 'Data integrity', zh: '数据完整性' },
  'hud.time':          { en: 'Quarter', zh: '本季度' },
  'hud.pause':         { en: 'Pause', zh: '暂停' },
  'hud.resume':        { en: 'Resume', zh: '继续' },
  'hud.speed':         { en: 'Speed', zh: '速度' },
  'hud.credits':       { en: 'cr', zh: '点' },

  // --- deploy panel ---
  'panel.deploy':      { en: 'Deploy capability', zh: '部署安全能力' },
  'panel.deployHint':  { en: 'Pick a product, then click a highlighted slot.', zh: '选择一个产品，然后点击高亮的部署位。' },
  'panel.cancel':      { en: 'Cancel', zh: '取消' },
  'panel.deployed':    { en: 'Deployed', zh: '已部署' },
  'panel.cost':        { en: 'Cost', zh: '费用' },
  'panel.cantAfford':  { en: 'Not enough budget', zh: '预算不足' },
  'panel.place':       { en: 'Placing', zh: '正在部署' },
  'panel.clickSlot':   { en: 'click a glowing slot to place it', zh: '点击发光的部署位完成部署' },
  'panel.response':    { en: 'Response', zh: '处置' },

  // --- clues / incident ---
  'clue.feed':         { en: 'Signal feed', zh: '信号流' },
  'clue.none':         { en: 'No signals yet. Deploy sensors to gain visibility.', zh: '暂无信号。部署传感能力以获得可见性。' },
  'clue.exploit':      { en: 'Intrusion attempt at the perimeter', zh: '边界处的入侵尝试' },
  'clue.endpoint':     { en: 'Suspicious host activity', zh: '可疑的主机行为' },
  'clue.network':      { en: 'Unusual lateral movement', zh: '异常的横向移动' },
  'clue.exfil':        { en: 'Data leaving the building', zh: '数据正在外泄' },
  'clue.weak':         { en: 'weak signal', zh: '弱信号' },
  'clue.confirmed':    { en: 'CONFIRMED by XDR', zh: '已由 XDR 确认' },
  'clue.at':           { en: 'at', zh: '位置：' },

  // --- responses ---
  'resp.isolate':      { en: 'Isolate room (EDR)', zh: '隔离房间（EDR）' },
  'resp.block':        { en: 'Re-block perimeter (AF)', zh: '重新封锁边界（AF）' },
  'resp.recover':      { en: 'Recover room (aStor)', zh: '恢复房间（aStor）' },
  'resp.needEdr':      { en: 'Needs EDR in this room', zh: '需要此房间已部署 EDR' },
  'resp.needAstor':    { en: 'Needs aStor', zh: '需要已部署 aStor' },
  'resp.contained':    { en: 'Threat contained here', zh: '此处威胁已遏制' },
  'resp.wrongRoom':    { en: 'Nothing to contain here — the business was disrupted.', zh: '此处无可遏制目标——业务反而受到了干扰。' },

  // --- room tags ---
  'room.locked':       { en: 'LOCKED (ransomware)', zh: '已被锁定（勒索软件）' },
  'room.vault':        { en: 'Data Vault', zh: '数据金库' },

  // --- Sophia ---
  'sophia.name':       { en: 'Sophia', zh: 'Sophia' },
  'sophia.role':       { en: 'your guide', zh: '你的向导' },
  'sophia.ask':        { en: 'Ask Sophia', zh: '问 Sophia' },
  'sophia.more':       { en: 'Tell me more', zh: '再详细些' },
  'sophia.greet':      { en: "Hi, I'm Sophia. I'll ride along. Tap me whenever a clue, action, or product isn't clear — I'll point you in a direction first, then explain if you want.", zh: '你好，我是 Sophia，会一路陪着你。遇到看不懂的线索、操作或产品，点我一下——我会先给你方向，需要时再细说。' },

  // --- end / replay ---
  'end.win.title':     { en: 'Quarter secured', zh: '本季度安全达标' },
  'end.lose.title':    { en: 'Breach review', zh: '入侵复盘' },
  'end.win.msg':       { en: 'You reached the quarter review with the Vault intact and the business running.', zh: '你守住了数据金库、保持了业务运转，顺利通过季度审查。' },
  'end.lose.breach':   { en: 'The attacker exfiltrated the Vault data.', zh: '攻击者已将金库数据外泄。' },
  'end.lose.uptime':   { en: 'Business operations collapsed under disruption.', zh: '业务在持续干扰下陷入瘫痪。' },
  'end.replay':        { en: 'Incident replay', zh: '事件回放' },
  'end.replay.sub':    { en: 'What actually happened — and what your deployments caught.', zh: '真实发生的经过——以及你的部署捕捉到了什么。' },
  'end.detected':      { en: 'you detected this', zh: '你已发现' },
  'end.missed':        { en: 'missed — no coverage', zh: '遗漏——无覆盖' },
  'end.blocked':       { en: 'blocked by your defense', zh: '被你的防御拦截' },
  'end.again':         { en: 'Play again', zh: '再玩一次' },
  'end.score':         { en: 'Score', zh: '得分' },

  // --- misc ---
  'badge.placeholder': { en: 'original art · official logo TBD', zh: '原创美术 · 官方标识待替换' },
};

let current = 'en';

export function setLang(l) { if (LANGS.includes(l)) current = l; }
export function getLang() { return current; }

export function t(key, vars) {
  const entry = DICT[key];
  let s = entry ? (entry[current] ?? entry.en) : key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
  return s;
}

// Pull a localized field { en, zh } from data objects.
export function loc(field) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  return field[current] ?? field.en ?? '';
}
