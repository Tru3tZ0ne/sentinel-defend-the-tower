// Sentinel Strike orchestrator: HUD, product loadout, start / result cards,
// leaderboard and EN / 中文. The game itself is ./engine.js (view) + ./sim.js (rules).
import { createStrikeGame } from './engine.js?v=strike-1';
import { MAIN, SUB, MAXLV, COLOR } from './sim.js';
import { PRODUCT_MARKS } from '../ui/product-marks.js';
import { makeI18n } from '../arcade/i18n.js';
import { makeBoard, rankOf } from '../arcade/board.js';
import { brandHTML, footerHTML, fmt, esc, painter } from '../arcade/ui-kit.js';
import { setMuted, isMuted, resumeAudio } from '../rush/audio.js';

const NAME = { EDR: 'Endpoint Secure', AF: 'NGAF', XDR: 'XDR', NDR: 'Cyber Command', HCI: 'HCI', IAG: 'IAG', ASTOR: 'aStor', MDR: 'MDR' };
const ALL = [...MAIN, ...SUB, 'MDR'];
const MARK = id => `<img class="sk-mark" src="assets/brand/products/sangfor-${PRODUCT_MARKS[id][0]}" alt="${esc(NAME[id])}" />`;

const EN = {
  'st.title': 'Sentinel Strike', 'st.tag': 'A vertical 3D shooter. Fly the Sangfor interceptor through three breached zones - every power-up is a Sangfor product, and it fights the way the product really works.',
  'st.h1': 'Move with the mouse, WASD / arrows, or drag on touch. The ship fires by itself. Hold Shift for fine control.',
  'st.h2': 'Shoot the white supply carriers and grab the product coin. Coins cycle between products every two seconds - wait for the one you want. Same main weapon again = level up; a different one = switch.',
  'st.h3': 'Space / B / right-click (or the MDR button) calls an Incident Response sweep that wipes every bullet. Three lives. Each zone ends with a boss.',
  'st.legend': 'Your arsenal', 'st.mainw': 'Main weapon', 'st.support': 'Support', 'st.stage': 'Zone', 'st.cleared': 'ZONE SECURED', 'st.lives': 'Lives', 'st.chain': 'CHAIN',
  'st.victory': 'All zones secured', 'st.defeat': 'Interceptor lost', 'st.reached': 'Zone reached', 'st.kills': 'Threats destroyed', 'st.bestChain': 'Best chain', 'st.leaks': 'Data leaks', 'st.build': 'Final loadout',
  'st.pause': 'Paused', 'st.resume': 'Press P or tap to resume', 'st.sensors': '{n}/4 products feeding XDR', 'ui.board': 'Pilot ranking',
  'stage.perimeter': 'Perimeter', 'stage.datacenter': 'Data Center', 'stage.cloud': 'Cloud Core',
  'boss.botnet': 'Botnet Controller', 'boss.ransom': 'Ransomware Brute', 'boss.siege': 'APT Siege Engine',
  'code.EDR': 'EDR', 'code.AF': 'NGAF', 'code.XDR': 'XDR', 'code.NDR': 'CC', 'code.HCI': 'HCI', 'code.IAG': 'IAG', 'code.ASTOR': 'aStor', 'code.MDR': 'MDR',
  'p.EDR': 'Vulcan spread. Endpoint protection sits on every device, so it covers the whole sky - wide, fast, light.',
  'p.AF': 'Firewall beam. A next-gen firewall is a hard line at the perimeter: narrow, heavy, and it pierces everything in the lane.',
  'p.XDR': 'Chain plasma that jumps between threats. XDR correlates what your other products see - alone it is weak; each support product you run makes it hit harder.',
  'p.NDR': 'Homing missiles. Cyber Command watches the network, so it finds threats for you and exposes cloaked APTs.',
  'p.HCI': 'Scale-out wingman nodes that copy your fire, then a faster fire rate. More compute, more throughput.',
  'p.IAG': 'Traffic control. Hostile bullets slow to a crawl inside the amber ring around your ship.',
  'p.ASTOR': 'Snapshot shield. Takes a hit for you and restores the ship with its weapons intact. Recharges slowly.',
  'p.MDR': 'Bomb. A managed Incident Response sweep: clears every bullet and hammers everything on screen.',
  't.pick_EDR': 'Endpoint Secure - vulcan spread', 't.pick_AF': 'NGAF - piercing firewall beam', 't.pick_XDR': 'XDR - chain plasma', 't.pick_NDR': 'Cyber Command - homing missiles, cloak revealed',
  't.pick_HCI': 'HCI - scale-out wingman', 't.pick_IAG': 'IAG - hostile bullets slowed', 't.pick_ASTOR': 'aStor - snapshot shield armed', 't.pick_MDR': 'MDR - Incident Response +1',
  't.maxed': 'already maxed: +2,000', 't.xdrAlone': 'XDR has nothing to correlate - collect support products to power it',
  't.snapshot': 'aStor restored you from a snapshot', 't.down': 'Interceptor down - weapon level lost', 't.bomb': 'MDR Incident Response - airspace swept',
  't.exfil': 'Data exfiltrated! -1,500', 't.clear': 'Zone {n} secured  +{bonus}',
  't.boss_botnet': 'Botnet Controller inbound', 't.boss_ransom': 'Ransomware Brute inbound', 't.boss_siege': 'APT Siege Engine inbound - it cloaks without Cyber Command',
  't.stage_datacenter': 'Zone 2 - Data Center', 't.stage_cloud': 'Zone 3 - Cloud Core',
};
const ZH = {
  'st.title': '哨兵出击', 'st.tag': '纵版 3D 射击。驾驶深信服拦截机穿越三片失陷区域——每个强化道具都是一款深信服产品，并且按产品的真实作用战斗。',
  'st.h1': '鼠标、WASD / 方向键或触屏拖动来移动，战机自动开火。按住 Shift 可精细微调。',
  'st.h2': '击落白色补给机，拾取产品徽章。徽章每两秒在几款产品之间切换——等到想要的再拿。相同主武器＝升级，不同主武器＝切换。',
  'st.h3': '空格 / B / 右键（或 MDR 按钮）呼叫应急响应清场，消除所有子弹。共三条命，每个区域以 Boss 收尾。',
  'st.legend': '你的武器库', 'st.mainw': '主武器', 'st.support': '支援', 'st.stage': '区域', 'st.cleared': '区域已肃清', 'st.lives': '生命', 'st.chain': '连击',
  'st.victory': '全部区域已肃清', 'st.defeat': '拦截机被击毁', 'st.reached': '到达区域', 'st.kills': '摧毁威胁', 'st.bestChain': '最高连击', 'st.leaks': '数据泄露', 'st.build': '最终配装',
  'st.pause': '已暂停', 'st.resume': '按 P 或点击继续', 'st.sensors': '{n}/4 款产品为 XDR 供数', 'ui.board': '飞行员排行榜',
  'stage.perimeter': '网络边界', 'stage.datacenter': '数据中心', 'stage.cloud': '云核心',
  'boss.botnet': '僵尸网络控制器', 'boss.ransom': '勒索软件巨兽', 'boss.siege': 'APT 攻城引擎',
  'code.EDR': 'EDR', 'code.AF': 'NGAF', 'code.XDR': 'XDR', 'code.NDR': 'CC', 'code.HCI': 'HCI', 'code.IAG': 'IAG', 'code.ASTOR': 'aStor', 'code.MDR': 'MDR',
  'p.EDR': '火神散射。终端防护部署在每一台设备上，所以它覆盖整片天空——宽、快、轻。',
  'p.AF': '防火墙光束。下一代防火墙是边界上的一道硬防线：窄、重，并贯穿整条航线上的一切。',
  'p.XDR': '在威胁之间跳跃的连锁等离子。XDR 关联其他产品看到的信息——单独使用很弱，每多一款支援产品，威力就更强。',
  'p.NDR': '追踪导弹。Cyber Command 监视整个网络，替你找到威胁，并让隐身的 APT 现形。',
  'p.HCI': '横向扩展的僚机节点，复制你的火力，之后提升射速。算力越多，吞吐越大。',
  'p.IAG': '流量管控。敌方子弹进入战机周围的琥珀色圆环后会大幅减速。',
  'p.ASTOR': '快照护盾。替你挡下一击，并让战机带着武器原样恢复，缓慢充能。',
  'p.MDR': '炸弹。托管式应急响应清场：消除所有子弹，并重创屏幕上的一切。',
  't.pick_EDR': 'Endpoint Secure——火神散射', 't.pick_AF': 'NGAF——穿透防火墙光束', 't.pick_XDR': 'XDR——连锁等离子', 't.pick_NDR': 'Cyber Command——追踪导弹，隐身现形',
  't.pick_HCI': 'HCI——扩展僚机', 't.pick_IAG': 'IAG——敌方子弹减速', 't.pick_ASTOR': 'aStor——快照护盾就绪', 't.pick_MDR': 'MDR——应急响应 +1',
  't.maxed': '已满级：+2,000', 't.xdrAlone': 'XDR 没有可关联的数据——收集支援产品为它供能',
  't.snapshot': 'aStor 已从快照恢复', 't.down': '拦截机被击落——武器等级下降', 't.bomb': 'MDR 应急响应——空域已清场',
  't.exfil': '数据被窃取！-1,500', 't.clear': '区域 {n} 已肃清  +{bonus}',
  't.boss_botnet': '僵尸网络控制器来袭', 't.boss_ransom': '勒索软件巨兽来袭', 't.boss_siege': 'APT 攻城引擎来袭——没有 Cyber Command 它会隐身',
  't.stage_datacenter': '区域 2——数据中心', 't.stage_cloud': '区域 3——云核心',
};
const i18n = makeI18n(EN, ZH), { t } = i18n;
const board = makeBoard({ lsKey: 'sentinel.strike.scores.v1', apiVar: '__STRIKE_API' });
const NAME_KEY = 'sentinel.arcade.name', BEST_KEY = 'sentinel.strike.best.v1';
const ls = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
const getBest = () => +ls.get(BEST_KEY, 0) || 0;
const LINKS = [{ href: 'stand.html', label: 'Last Stand' }, { href: 'line.html', label: 'Breach Line' }, { href: 'soc.html', label: 'Incident Zero' }, { href: 'index.html', label: 'Defend the Tower' }];

const app = document.getElementById('app');
app.innerHTML = `
  <div class="ar-top">
    ${brandHTML('Sentinel Strike')}
    <div class="ar-stats">
      <div class="ar-combo" id="skChain">x1.0</div>
      <div class="ar-stat"><span class="k" id="skScoreK"></span><span class="v good" id="skScore">0</span></div>
      <div class="ar-stat"><span class="k" id="skBestK"></span><span class="v" id="skBest">0</span></div>
    </div>
  </div>
  <div class="ar-field">
    <canvas id="stCanvas"></canvas>
    <div class="sk-zone" id="skZone" hidden><b id="skZoneName"></b><div class="sk-prog"><i id="skProg"></i></div></div>
    <div class="st-boss" id="skBoss" hidden><div class="st-boss-row"><span class="st-boss-name" id="skBossName"></span></div><div class="st-boss-bar"><i id="skBossFill"></i></div></div>
    <div class="sk-load" id="skLoad" hidden></div>
    <div class="sk-left" id="skLeft" hidden>
      <div class="sk-lives" id="skLives"></div>
      <button class="sk-bomb" id="skBomb" type="button">${MARK('MDR')}<b id="skBombN">3</b><small>SPACE</small></button>
    </div>
    <button class="sk-pausebtn" id="skPause" type="button" hidden aria-label="Pause">II</button>
  </div>
  <div class="ar-toasts" id="skToasts"></div>
  <div id="skOverlay"></div>`;
const $ = id => document.getElementById(id);
const el = { canvas: $('stCanvas'), chain: $('skChain'), score: $('skScore'), best: $('skBest'), zone: $('skZone'), zoneName: $('skZoneName'), prog: $('skProg'), boss: $('skBoss'), bossName: $('skBossName'), bossFill: $('skBossFill'), load: $('skLoad'), left: $('skLeft'), lives: $('skLives'), bomb: $('skBomb'), bombN: $('skBombN'), pause: $('skPause'), toasts: $('skToasts'), overlay: $('skOverlay') };
const paintLoad = painter(), paintLives = painter();
let phase = 'start', lastSummary = null, lastResult = null;

const pips = (n, max) => `<span class="sk-pips">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
function chip(id, lv, extra = '') { return `<div class="sk-chip${lv ? '' : ' off'}" style="--cap:${COLOR[id]}">${MARK(id)}<span><b>${esc(t('code.' + id))}</b>${pips(lv, MAXLV[id] || 1)}${extra}</span></div>`; }
function loadHTML(h) {
  const xdr = h.main === 'XDR' ? `<small class="${h.sensors ? '' : 'warn'}">${esc(t('st.sensors', { n: h.sensors }))}</small>` : '';
  return `<div class="sk-load-h">${esc(t('st.mainw'))}</div>${chip(h.main, h.mainLv, xdr)}<div class="sk-load-h">${esc(t('st.support'))}</div>${SUB.map(id => chip(id, id === 'ASTOR' ? h.shield : h.lv[id])).join('')}`;
}
const SHIP_SVG = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2l3 9 7 6-7-1-3 6-3-6-7 1 7-6z" fill="currentColor"/></svg>';

const game = createStrikeGame(el.canvas, {
  label: k => t(k),
  onHud: h => {
    el.score.textContent = fmt(h.score); el.best.textContent = fmt(Math.max(h.score, getBest()));
    el.chain.textContent = 'x' + h.mult.toFixed(1); el.chain.classList.toggle('on', h.chain >= 10);
    el.zoneName.textContent = `${t('st.stage')} ${h.stage + 1} · ${t('stage.' + h.stageId)}`; el.prog.style.width = (h.progress * 100) + '%';
    paintLoad(el.load, loadHTML(h)); paintLives(el.lives, Array.from({ length: Math.max(0, h.lives - 1) }, () => SHIP_SVG).join(''));
    el.bombN.textContent = h.bombs; el.bomb.classList.toggle('empty', h.bombs <= 0);
    el.boss.hidden = !h.boss;
    if (h.boss) { el.boss.style.setProperty('--bcol', h.boss.color); el.bossName.textContent = t('boss.' + h.boss.type); el.bossFill.style.width = (h.boss.frac * 100) + '%'; }
  },
  onToast: (key, kind, arg) => {
    let msg = t('t.' + key, arg && key === 'clear' ? { n: arg.n, bonus: fmt(arg.bonus) } : undefined);
    if (arg?.maxed) msg += ' · ' + t('t.maxed');
    toast(msg, kind);
  },
  onOver: s => onOver(s),
});

function toast(msg, kind = '') { if (!msg) return; const n = document.createElement('div'); n.className = `ar-toast ${kind}`.trim(); n.textContent = msg; el.toasts.appendChild(n); setTimeout(() => n.remove(), 1900); while (el.toasts.children.length > 3) el.toasts.firstChild.remove(); }
function hud(on) { for (const n of [el.zone, el.load, el.left, el.pause]) n.hidden = !on; if (!on) el.boss.hidden = true; }
function labels() { $('skScoreK').textContent = t('ui.score'); $('skBestK').textContent = t('ui.best'); }

function legendHTML() {
  const row = id => `<div class="sk-leg" style="--cap:${COLOR[id]}">${MARK(id)}<div><b>${esc(NAME[id])}</b><span>${esc(t('p.' + id))}</span></div></div>`;
  return `<div class="sk-legend"><div class="sk-leg-h">${esc(t('st.mainw'))}</div>${MAIN.map(row).join('')}<div class="sk-leg-h">${esc(t('st.support'))}</div>${[...SUB, 'MDR'].map(row).join('')}</div>`;
}
function boardBlock(b, meId) {
  const rows = b.rows?.length ? b.rows.slice(0, 8).map(r => `<li class="lb-row${r.id === meId ? ' me' : ''}"><span class="lb-rank">${rankOf(b.rows, r.score)}</span><span class="lb-name">${esc(r.name)}</span><span class="lb-score">${fmt(r.score)}</span></li>`).join('') : `<li class="lb-empty">${esc(t('ui.empty'))}</li>`;
  return `<div class="ar-lb"><div class="ar-lb-h"><span class="t">${esc(t('ui.board'))}</span><span class="mode ${b.mode === 'world' ? 'world' : ''}">${esc(b.mode === 'world' ? t('ui.world') : t('ui.local'))}</span></div><ol class="lb-rows">${rows}</ol></div>`;
}
async function showStart() {
  phase = 'start'; game.stop(); hud(false); labels(); el.best.textContent = fmt(getBest()); el.score.textContent = '0';
  const b = await board.fetchBoard(); if (phase !== 'start') return;
  el.overlay.innerHTML = `<div class="ar-overlay"><div class="ar-card sk-card">
    ${brandHTML('Sentinel Strike')}
    <h1 class="ar-title">Sentinel <span class="em">Strike</span></h1>
    <p class="ar-tag">${esc(t('st.tag'))}</p>
    <p class="ar-field-label">${esc(t('ui.name'))}</p>
    <input class="ar-name" id="nameIn" maxlength="14" placeholder="${esc(t('ui.namePh'))}" value="${esc(ls.get(NAME_KEY, ''))}" />
    <ol class="ar-how">${[1, 2, 3].map(i => `<li><span class="n">${i}</span><span>${esc(t('st.h' + i))}</span></li>`).join('')}</ol>
    <div class="ar-row"><button class="btn primary block" data-act="play">${esc(t('ui.play'))}</button></div>
    <div class="sk-leg-title">${esc(t('st.legend'))}</div>${legendHTML()}
    ${boardBlock(b)}${footerHTML(t, { muted: isMuted(), links: LINKS })}</div></div>`;
}
function buildHTML(s) { return `<div class="sk-build">${chip(s.main, s.mainLv)}${SUB.filter(id => s.lv[id] > 0).map(id => chip(id, s.lv[id])).join('')}</div>`; }
function renderOver(s, result) {
  el.overlay.innerHTML = `<div class="ar-overlay"><div class="ar-card sk-card">
    ${brandHTML('Sentinel Strike')}
    <h1 class="ar-title" style="font-size:24px">${esc(t(s.outcome === 'victory' ? 'st.victory' : 'st.defeat'))}</h1>
    <div class="ar-result"><div class="lbl">${esc(t('ui.score'))}</div><div class="big">${fmt(s.score)}</div>
      ${result ? `<div class="sub">${esc(t('ui.youRank'))}<span class="hot">${result.rank}</span> · ${esc(result.mode === 'world' ? t('ui.world') : t('ui.local'))}</div>` : ''}</div>
    <div class="ar-meta">
      <div class="m"><span class="k">${esc(t('st.reached'))}</span><span class="v">${s.stage}/3</span></div>
      <div class="m"><span class="k">${esc(t('st.kills'))}</span><span class="v">${fmt(s.kills)}</span></div>
      <div class="m"><span class="k">${esc(t('st.bestChain'))}</span><span class="v">${s.bestChain}</span></div>
    </div>
    <div class="sk-leg-title">${esc(t('st.build'))}</div>${buildHTML(s)}
    ${result ? boardBlock(result, result.id) : ''}
    <div class="ar-row"><button class="btn ghost" data-act="quit">${esc(t('ui.quit'))}</button><button class="btn primary" data-act="again">${esc(t('ui.again'))}</button></div>
    ${footerHTML(t, { muted: isMuted(), links: LINKS })}</div></div>`;
}
async function onOver(s) {
  phase = 'over'; lastSummary = s; lastResult = null; hud(false);
  if (s.score > getBest()) ls.set(BEST_KEY, String(s.score));
  el.best.textContent = fmt(getBest()); renderOver(s, null);
  const result = await board.submitScore({ name: ls.get(NAME_KEY, '') || 'Anonymous', score: s.score, note: `zone ${s.stage}/3 · ${s.main} Lv${s.mainLv} · ${s.kills} kills` });
  if (phase !== 'over' || lastSummary !== s) return;
  lastResult = result; renderOver(s, result);
}
function play() {
  const name = ($('nameIn')?.value || '').trim(); if (name) ls.set(NAME_KEY, name);
  resumeAudio(); el.overlay.innerHTML = ''; el.toasts.innerHTML = ''; phase = 'play'; hud(true); game.start();
}
function togglePause() {
  if (phase === 'play' && game.phase === 'play') { game.pause(); el.overlay.innerHTML = `<div class="ar-overlay sk-paused" data-act="resume"><div class="ar-card" style="text-align:center"><h1 class="ar-title" style="font-size:24px">${esc(t('st.pause'))}</h1><p class="ar-tag">${esc(t('st.resume'))}</p></div></div>`; }
  else if (game.phase === 'paused') { el.overlay.innerHTML = ''; game.resume(); }
}

el.overlay.addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
  if (act === 'play' || act === 'again') play();
  else if (act === 'quit') showStart();
  else if (act === 'resume') togglePause();
  else if (act === 'lang') { i18n.toggleLang(); labels(); if (phase === 'over' && lastSummary) renderOver(lastSummary, lastResult); else if (phase === 'start') showStart(); }
  else if (act === 'mute') { setMuted(!isMuted()); if (phase === 'over' && lastSummary) renderOver(lastSummary, lastResult); else if (phase === 'start') showStart(); }
});
el.bomb.addEventListener('pointerdown', e => { e.preventDefault(); if (phase === 'play') game.bomb(); });
el.pause.addEventListener('click', togglePause);
window.addEventListener('keydown', e => { if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && e.target?.tagName !== 'INPUT') togglePause(); else if (e.key === 'Enter' && phase !== 'play' && document.querySelector('[data-act="play"],[data-act="again"]') && e.target?.tagName !== 'INPUT') play(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && phase === 'play' && game.phase === 'play') togglePause(); });

showStart();
window.__strike = { game, board, i18n, ALL };
