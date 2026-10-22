// Standalone EN / 中文 strings for Breach Rush, with localStorage-persisted language.
// Kept self-contained so the game is decoupled from the other versions' dictionary.
// NOTE: use straight ASCII quotes / escaped apostrophes in EN — curly quotes render
// full-width next to the CJK font stack.

const LS = 'sentinel.lang';
const DICT = {
  'brand.sub':   { en: 'BREACH RUSH', zh: '拦截风暴' },
  'title':       { en: 'Breach Rush', zh: '拦截风暴' },
  'eyebrow':     { en: 'A Sangfor security arcade', zh: '深信服安全街机' },
  'tagline':     { en: 'Threats are racing your data core. Neutralise them before they land — and let the clean traffic through.', zh: '威胁正冲向你的数据核心。在它们突破前拦截它们——并放行正常流量。' },

  'how.title':   { en: 'How to play', zh: '玩法' },
  'how1.h':      { en: 'Tap the threats', zh: '点击威胁' },
  'how1.b':      { en: 'Red and orange blips race inward along the grid. Tap each one before it reaches the core to neutralise it.', zh: '红色与橙色光点沿网格向内飞驰。在它们抵达核心前点击拦截。' },
  'how2.h':      { en: 'Spare the clean traffic', zh: '放行正常流量' },
  'how2.b':      { en: 'Teal orbs are legitimate traffic. Let them reach the core. Zapping one is a false positive — it breaks your combo and costs points.', zh: '青色光球是正常流量，放它们抵达核心。误击属于误报——会中断连击并扣分。' },
  'how3.h':      { en: 'Survive the escalation', zh: '扛住升级' },
  'how3.b':      { en: 'Three breaches and it is over. Build combos for bigger multipliers and charge your Sangfor powers. Watch for stealth movers and the ransomware boss.', zh: '三次突破即结束。连击越高倍率越大，并为深信服技能充能。当心潜行者与勒索软件首领。' },

  'controls':    { en: 'Tap / click a blip to act · Powers: keys 1 / 2 / 3 or the buttons · P to pause · M to mute', zh: '点击光点进行处置 · 技能：按键 1 / 2 / 3 或按钮 · P 暂停 · M 静音' },

  'name.label':  { en: 'Call sign', zh: '呼号' },
  'name.ph':     { en: 'Enter your name', zh: '输入你的名字' },
  'play':        { en: 'Start defending', zh: '开始防御' },
  'board.title': { en: 'World ranking', zh: '世界排名' },
  'board.local': { en: 'LOCAL', zh: '本地' },
  'board.world': { en: 'WORLD', zh: '世界' },
  'board.empty': { en: 'No scores yet. Be the first.', zh: '暂无成绩，抢占第一。' },
  'board.you':   { en: 'YOU', zh: '你' },

  'hud.score':   { en: 'SCORE', zh: '得分' },
  'hud.combo':   { en: 'COMBO', zh: '连击' },
  'hud.best':    { en: 'BEST', zh: '最佳' },
  'hud.integrity':{ en: 'INTEGRITY', zh: '完整性' },
  'hud.power':   { en: 'POWER', zh: '能量' },
  'hud.stage':   { en: 'ALERT LV', zh: '告警级' },

  'pow.purge':   { en: 'XDR Purge', zh: 'XDR 清剿' },
  'pow.slow':    { en: 'EDR Slow', zh: 'EDR 减速' },
  'pow.scan':    { en: 'NDR Reveal', zh: 'NDR 揭示' },
  'pow.purge.d': { en: 'Neutralise every threat on screen', zh: '清除屏幕上所有威胁' },
  'pow.slow.d':  { en: 'Slow everything for 5s', zh: '全场减速 5 秒' },
  'pow.scan.d':  { en: 'Expose stealth movers for 7s', zh: '揭示潜行威胁 7 秒' },

  'toast.fp':    { en: 'False positive!', zh: '误报！' },
  'toast.breach':{ en: 'Core breached!', zh: '核心被突破！' },
  'toast.boss':  { en: 'Ransomware inbound — hit it 3×', zh: '勒索软件来袭——连击 3 次' },
  'toast.nopow': { en: 'Not enough power', zh: '能量不足' },

  'over.title':  { en: 'Core down', zh: '核心失守' },
  'over.sub':    { en: 'The last breach took the core offline.', zh: '最后一次突破使核心离线。' },
  'over.score':  { en: 'Final score', zh: '最终得分' },
  'over.rank':   { en: 'World rank', zh: '世界排名' },
  'over.best':   { en: 'Personal best', zh: '个人最佳' },
  'over.newbest':{ en: 'New personal best!', zh: '新纪录！' },
  'over.again':  { en: 'Play again', zh: '再来一局' },
  'over.share':  { en: 'Copy result', zh: '复制战绩' },
  'over.copied': { en: 'Copied!', zh: '已复制！' },
  'over.submitting': { en: 'Submitting score...', zh: '正在提交成绩…' },

  'stat.neutralised': { en: 'Neutralised', zh: '已拦截' },
  'stat.served': { en: 'Served', zh: '已放行' },
  'stat.survived': { en: 'Survived', zh: '坚持' },
  'sec':         { en: 's', zh: ' 秒' },
  'pause':       { en: 'Paused', zh: '已暂停' },
  'resume':      { en: 'Resume', zh: '继续' },
  'quit':        { en: 'Quit', zh: '退出' },
};

let current = 'en';
try { const s = localStorage.getItem(LS); if (s === 'en' || s === 'zh') current = s; } catch { /* ignore */ }
if (typeof document !== 'undefined') document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en';

export function getLang() { return current; }
export function toggleLang() { setLang(current === 'en' ? 'zh' : 'en'); return current; }
export function setLang(l) {
  if (l !== 'en' && l !== 'zh') return;
  current = l;
  try { localStorage.setItem(LS, l); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
}
export function t(key, vars) {
  const e = DICT[key]; let s = e ? (e[current] ?? e.en) : key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
  return s;
}
