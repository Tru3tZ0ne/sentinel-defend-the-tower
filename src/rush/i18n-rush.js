// Standalone EN / 中文 strings for Breach Rush — Sangfor Edition, with localStorage-
// persisted language. NOTE: straight ASCII quotes / escaped apostrophes in EN — curly
// quotes render full-width next to the CJK font stack.

const LS = 'sentinel.lang';
const DICT = {
  'brand.sub':   { en: 'BREACH RUSH', zh: '拦截风暴' },
  'title':       { en: 'Breach Rush', zh: '拦截风暴' },
  'eyebrow':     { en: 'A Sangfor security arcade', zh: '深信服安全街机' },
  'tagline':     { en: 'An attack chain is racing your data core. Fire the right Sangfor defence for each threat, keep the business online, and keep the data in.', zh: '一条攻击链正冲向你的数据核心。为每种威胁调用对应的深信服防护，保住业务在线，守住数据不外泄。' },

  // quick how-to (start card)
  'how.title':   { en: 'How to play', zh: '玩法' },
  'how1.h':      { en: 'Tap the threats', zh: '点击威胁' },
  'how1.b':      { en: 'Hostile blips race inward along the grid. Tap each one before it reaches the core.', zh: '敌对光点沿网格向内飞驰。在它们抵达核心前逐一点击。' },
  'how2.h':      { en: 'Spare the clean traffic', zh: '放行正常流量' },
  'how2.b':      { en: 'Teal orbs are legitimate traffic. Let them through — zapping one is a false positive.', zh: '青色光球是正常流量，放它们通过——误击即为误报。' },
  'how3.h':      { en: 'Fire the right product', zh: '调用对应产品' },
  'how3.b':      { en: 'Each threat has a Sangfor counter. Spend energy on the matching power, and protect both Uptime and Data.', zh: '每种威胁都有对应的深信服克制手段。用能量释放匹配技能，同时守住“可用性”与“数据”。' },

  'controls':    { en: 'Tap / click a blip to act · Powers: keys 1-5 or the buttons · P pause · M mute · open the Field Manual for the full briefing', zh: '点击光点进行处置 · 技能：按键 1-5 或按钮 · P 暂停 · M 静音 · 打开《战地手册》查看完整说明' },

  // start / leaderboard
  'name.label':  { en: 'Call sign', zh: '呼号' },
  'name.ph':     { en: 'Enter your name', zh: '输入你的名字' },
  'play':        { en: 'Start defending', zh: '开始防御' },
  'board.title': { en: 'World ranking', zh: '世界排名' },
  'board.local': { en: 'LOCAL', zh: '本地' },
  'board.world': { en: 'WORLD', zh: '世界' },
  'board.empty': { en: 'No scores yet. Be the first.', zh: '暂无成绩，抢占第一。' },
  'board.you':   { en: 'YOU', zh: '你' },

  // HUD
  'hud.score':   { en: 'SCORE', zh: '得分' },
  'hud.combo':   { en: 'COMBO', zh: '连击' },
  'hud.best':    { en: 'BEST', zh: '最佳' },
  'hud.uptime':  { en: 'UPTIME', zh: '可用性' },
  'hud.data':    { en: 'DATA', zh: '数据' },
  'hud.power':   { en: 'POWER', zh: '能量' },
  'hud.stage':   { en: 'ALERT LV', zh: '告警级' },

  // phases (kill chain)
  'phase.label':    { en: 'PHASE', zh: '阶段' },
  'phase.recon':    { en: 'Reconnaissance', zh: '侦察' },
  'phase.delivery': { en: 'Delivery & Exploitation', zh: '投递与利用' },
  'phase.exfil':    { en: 'Exfiltration', zh: '数据外泄' },
  'phase.lateral':  { en: 'Lateral Movement', zh: '横向移动' },
  'phase.ransom':   { en: 'Ransomware', zh: '勒索攻击' },

  // active powers (product id -> name + in-game effect)
  'pow.EDR':   { en: 'EDR', zh: 'EDR' },   'pow.EDR.d': { en: 'Remediate malware on screen', zh: '清除屏幕上的恶意软件' },
  'pow.NDR':   { en: 'NDR', zh: 'NDR' },   'pow.NDR.d': { en: 'Reveal stealth + slow the field', zh: '揭示潜行威胁并全场减速' },
  'pow.IAG':   { en: 'IAG', zh: 'IAG' },   'pow.IAG.d': { en: 'Block exfil + restore data', zh: '阻断外泄并恢复数据' },
  'pow.AF':    { en: 'AF',  zh: 'AF'  },   'pow.AF.d':  { en: 'Hold the perimeter for 4s', zh: '封锁边界 4 秒' },
  'pow.XDR':   { en: 'XDR', zh: 'XDR' },   'pow.XDR.d': { en: 'Correlate — clear everything', zh: '关联研判——清空全场' },

  // passive products
  'pas.title':   { en: 'Always on', zh: '常驻防护' },
  'pas.MDR':     { en: 'MDR', zh: 'MDR' },
  'pas.MDR.d':   { en: '24/7 SOC — auto-handles the worst threat', zh: '7×24 安全运营——自动处置最危威胁' },
  'pas.ASTOR':   { en: 'aStor', zh: 'aStor' },
  'pas.ASTOR.d': { en: 'Snapshot shield absorbs one data-loss hit', zh: '快照护盾吸收一次数据损失' },
  'pas.ready':   { en: 'READY', zh: '就绪' },
  'pas.charging':{ en: 'CHARGING', zh: '充能中' },

  // toasts
  'toast.fp':    { en: 'False positive!', zh: '误报！' },
  'toast.breach':{ en: 'Uptime hit!', zh: '可用性受损！' },
  'toast.exfil': { en: 'Data exfiltrated!', zh: '数据被外泄！' },
  'toast.astor': { en: 'aStor restored from snapshot', zh: 'aStor 已从快照恢复' },
  'toast.boss':  { en: 'Ransomware inbound — hit it 3x', zh: '勒索软件来袭——连击 3 次' },
  'toast.nopow': { en: 'Not enough power', zh: '能量不足' },
  'toast.fired': { en: '{p} deployed', zh: '已部署 {p}' },

  // game over
  'over.title.uptime': { en: 'Service down', zh: '业务中断' },
  'over.title.data':   { en: 'Data breached', zh: '数据失守' },
  'over.sub.uptime':   { en: 'Too many breaches took the core offline.', zh: '多次突破导致核心离线。' },
  'over.sub.data':     { en: 'Attackers exfiltrated your data.', zh: '攻击者已窃取你的数据。' },
  'over.score':  { en: 'Final score', zh: '最终得分' },
  'over.rank':   { en: 'World rank', zh: '世界排名' },
  'over.best':   { en: 'Personal best', zh: '个人最佳' },
  'over.newbest':{ en: 'New personal best!', zh: '新纪录！' },
  'over.again':  { en: 'Play again', zh: '再来一局' },
  'over.share':  { en: 'Copy result', zh: '复制战绩' },
  'over.copied': { en: 'Copied!', zh: '已复制！' },

  'stat.neutralised': { en: 'Neutralised', zh: '已拦截' },
  'stat.dataLeft':{ en: 'Data left', zh: '剩余数据' },
  'stat.survived':{ en: 'Survived', zh: '坚持' },
  'sec':         { en: 's', zh: ' 秒' },
  'pause':       { en: 'Paused', zh: '已暂停' },
  'resume':      { en: 'Resume', zh: '继续' },
  'quit':        { en: 'Quit', zh: '退出' },

  // ---- Field Manual ----
  'fm.open':     { en: 'Field Manual', zh: '战地手册' },
  'fm.title':    { en: 'Field Manual', zh: '战地手册' },
  'fm.close':    { en: 'Got it', zh: '明白' },
  'fm.tab.play': { en: 'How to play', zh: '玩法' },
  'fm.tab.chain':{ en: 'The kill chain', zh: '攻击链' },
  'fm.tab.arsenal': { en: 'Sangfor arsenal', zh: '深信服武器库' },
  'fm.tab.score':{ en: 'Scoring', zh: '计分' },

  'fm.play.lead': { en: 'You are the SOC analyst defending the data core. The attack chain streams inward along the radar; you have seconds to respond.', zh: '你是守护数据核心的安全运营分析师。攻击链沿雷达向内涌来，你只有数秒时间处置。' },
  'fm.play.meters.h': { en: 'Two things to protect', zh: '要守护的两样东西' },
  'fm.play.meters.b': { en: 'UPTIME (availability): three hits and the service goes down. DATA (confidentiality): exfiltration and ransomware drain it — at 0% the data is gone. Different threats harm different things.', zh: 'UPTIME（可用性）：被命中三次业务即中断。DATA（数据/机密性）：外泄与勒索会消耗它——归零即数据尽失。不同威胁损害不同目标。' },
  'fm.play.powers.h': { en: 'Fire the matching product', zh: '释放匹配的产品' },
  'fm.play.powers.b': { en: 'Neutralising threats charges energy. Spend it on the Sangfor power that counters what is on screen — EDR for malware, IAG for exfil, NDR to expose stealth, AF to hold the door, XDR to clear it all.', zh: '拦截威胁会积累能量。把能量用在克制当前威胁的深信服技能上——EDR 清恶意软件、IAG 防外泄、NDR 揭示潜行、AF 守住边界、XDR 一键清场。' },

  'fm.chain.lead': { en: 'Threats arrive in the order a real attacker works. Each has a Sangfor product that counters it — learn the map and you will know which power to fire.', zh: '威胁按真实攻击者的推进顺序到来。每一种都有对应的深信服克制产品——记住这张对照表，你就知道该释放哪个技能。' },
  'fm.chain.harms':  { en: 'Harms', zh: '损害' },
  'fm.chain.counter':{ en: 'Countered by', zh: '克制手段' },
  'fm.harm.uptime':  { en: 'Uptime', zh: '可用性' },
  'fm.harm.data':    { en: 'Data', zh: '数据' },

  'te.scan':    { en: 'Recon scan', zh: '侦察扫描' },        'te.scan.d':    { en: 'Probes the perimeter. Fast but low value.', zh: '探测边界。速度快但价值低。' },
  'te.malware': { en: 'Malware', zh: '恶意软件' },           'te.malware.d': { en: 'Infects a host and crashes services.', zh: '感染主机，导致服务中断。' },
  'te.phish':   { en: 'Phishing', zh: '钓鱼' },             'te.phish.d':   { en: 'Disguised as clean traffic — spot the red tell.', zh: '伪装成正常流量——注意那一点红色破绽。' },
  'te.exfil':   { en: 'Data exfiltration', zh: '数据外泄' }, 'te.exfil.d':   { en: 'Steals Data if it reaches the core.', zh: '一旦抵达核心便窃取数据。' },
  'te.stealth': { en: 'Lateral movement', zh: '横向移动' },  'te.stealth.d': { en: 'Nearly invisible until NDR reveals it.', zh: '在 NDR 揭示前几乎不可见。' },
  'te.ransom':  { en: 'Ransomware (boss)', zh: '勒索软件（首领）' }, 'te.ransom.d': { en: 'Three hits. Hits Data hard; aStor can recover.', zh: '需三次命中。重创数据；aStor 可恢复。' },

  'fm.arsenal.lead': { en: 'Your toolkit is the Sangfor portfolio. Five products are powers you fire; two run continuously. Capabilities and honest limitations below.', zh: '你的工具就是深信服产品矩阵。五款是可释放的技能，两款持续运行。下面列出能力与真实局限。' },
  'ar.cap':   { en: 'Capability', zh: '能力' },
  'ar.limit': { en: 'Limitation', zh: '局限' },
  'ar.fx':    { en: 'In the game', zh: '在游戏中' },
  'ar.active':{ en: 'ACTIVE POWER', zh: '主动技能' },
  'ar.passive':{ en: 'ALWAYS ON', zh: '常驻' },
  'ar.EDR.fx':   { en: 'Clears malware and phishing currently on screen.', zh: '清除当前屏幕上的恶意软件与钓鱼。' },
  'ar.NDR.fx':   { en: 'Reveals stealth movers and slows the whole field.', zh: '揭示潜行威胁并使全场减速。' },
  'ar.IAG.fx':   { en: 'Blocks exfiltration on screen and restores Data.', zh: '阻断屏幕上的外泄并恢复数据。' },
  'ar.AF.fx':    { en: 'Holds the perimeter, stopping new intrusions for a few seconds.', zh: '守住边界，数秒内阻止新的入侵。' },
  'ar.XDR.fx':   { en: 'Correlates every signal and clears the whole screen.', zh: '关联全部信号并清空整个屏幕。' },
  'ar.MDR.fx':   { en: 'A 24/7 team auto-handles your most dangerous threat.', zh: '7×24 团队自动处置你最危险的威胁。' },
  'ar.ASTOR.fx': { en: 'A snapshot shield absorbs one data-loss hit, then recharges.', zh: '快照护盾吸收一次数据损失后重新充能。' },

  'fm.score.lead': { en: 'One run, one score. The board ranks your best.', zh: '一局一分，排行榜记录你的最佳成绩。' },
  'sc.l1': { en: 'Neutralise threats for points — catching them early is worth more.', zh: '拦截威胁得分——越早拦截分越高。' },
  'sc.l2': { en: 'Chain combos: every 5 in a row raises the multiplier, up to 6x.', zh: '积累连击：每连续 5 次提升倍率，最高 6 倍。' },
  'sc.l3': { en: 'False positives (zapping clean traffic) break your combo and cost points.', zh: '误报（误击正常流量）会中断连击并扣分。' },
  'sc.l4': { en: 'Survive longer as the attack escalates — difficulty never stops rising.', zh: '随着攻击升级坚持更久——难度永不停止上升。' },
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
// Localize a {en,zh} field (used for product catalog copy in the Field Manual).
export function loc(field) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  return field[current] ?? field.en ?? '';
}
