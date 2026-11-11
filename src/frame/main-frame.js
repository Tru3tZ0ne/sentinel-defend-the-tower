// Sentinel Frame orchestrator: HUD, hardpoint status, start / result cards,
// leaderboard and EN / 中文. The game itself is ./engine.js (view) + ./sim.js (rules).
import { createFrameGame } from './engine.js?v=frame-1';
import { PARTS, SLOT, MAXLV, COLOR, TIERS } from './sim.js';
import { PRODUCT_MARKS } from '../ui/product-marks.js';
import { makeI18n } from '../arcade/i18n.js';
import { makeBoard, rankOf } from '../arcade/board.js';
import { brandHTML, footerHTML, fmt, esc, painter } from '../arcade/ui-kit.js';
import { setMuted, isMuted, resumeAudio } from '../rush/audio.js';

const NAME = { EDR: 'Endpoint Secure', AF: 'NGAF', XDR: 'XDR', NDR: 'Cyber Command', HCI: 'HCI', IAG: 'IAG', ASTOR: 'aStor', MDR: 'MDR' };
const ALL = [...PARTS, 'MDR'];
const MARK = id => `<img class="fr-mark" src="assets/brand/products/sangfor-${PRODUCT_MARKS[id][0]}" alt="${esc(NAME[id])}" />`;

const EN = {
  'st.tag': 'A 3D mecha shooter. Your SF-01 frame launches bare. Every Sangfor product you dock bolts onto its own hardpoint and stays there - collect enough and the frame itself evolves, all the way to Full Armor.',
  'st.h1': 'Move with the mouse, WASD / arrows, or drag on touch. The frame fires by itself. Only the glowing core on its chest can be hit. Hold Shift for fine control.',
  'st.h2': 'Shoot the white supply carriers and fly into the crate. A crate cycles between up to three products - wait for the part you want. Every part has three levels and they all stack.',
  'st.h3': 'A hit that gets through costs a life and tears your best part down a level. Space / B / right-click (or the MDR button) sweeps every bullet. Each zone ends with a boss.',
  'st.legend': 'Hardpoints', 'st.stage': 'Zone', 'st.cleared': 'ZONE SECURED', 'st.evolved': 'Frame evolved', 'st.lost': 'damaged',
  'st.victory': 'All zones secured', 'st.defeat': 'Frame destroyed', 'st.reached': 'Zone reached', 'st.kills': 'Threats destroyed', 'st.bestChain': 'Best chain', 'st.build': 'Final frame',
  'st.pause': 'Paused - hangar view', 'st.resume': 'Press P or tap to resume', 'st.sensors': '{n}/6 feeding it', 'st.toNext': '{n} more to {tier}', 'st.maxTier': 'Every hardpoint is live', 'st.parts': '{n}/21 part levels', 'ui.board': 'Pilot ranking',
  'tier.0': 'SF-01 Base Frame', 'tier.1': 'Mk-II Assault Frame', 'tier.2': 'Mk-III Heavy Frame', 'tier.3': 'Full Armor Sentinel',
  'tierShort.0': 'MK-I', 'tierShort.1': 'MK-II', 'tierShort.2': 'MK-III', 'tierShort.3': 'FULL ARMOR',
  'slot.rarm': 'Right arm', 'slot.larm': 'Left arm', 'slot.head': 'Head + legs', 'slot.wings': 'Wings', 'slot.back': 'Backpack', 'slot.shoulders': 'Shoulders', 'slot.armor': 'Armor', 'slot.call': 'On call',
  'name.EDR': 'Endpoint Secure', 'name.AF': 'NGAF', 'name.XDR': 'XDR', 'name.NDR': 'Cyber Command', 'name.HCI': 'HCI', 'name.IAG': 'IAG', 'name.ASTOR': 'aStor',
  'stage.perimeter': 'Perimeter', 'stage.datacenter': 'Data Center', 'stage.cloud': 'Cloud Core',
  'boss.botnet': 'Botnet Controller', 'boss.ransom': 'Ransomware Brute', 'boss.siege': 'APT Siege Engine',
  'code.EDR': 'EDR', 'code.AF': 'NGAF', 'code.XDR': 'XDR', 'code.NDR': 'CC', 'code.HCI': 'HCI', 'code.IAG': 'IAG', 'code.ASTOR': 'aStor', 'code.MDR': 'MDR',
  'p.EDR': 'Beam rifle. Endpoint protection is where you actually act on a threat, so it is the gun in your hand: each level adds barrels and spread.',
  'p.AF': 'Firewall shield. It denies hostile fire arriving at the front - and only the front. What comes from the side or behind still gets in. It overloads if you lean on it; at level 3 it fires blocked traffic back.',
  'p.NDR': 'Sensor fins and missile pods. Cyber Command watches the network: homing missiles find threats for you, and cloaked APTs are exposed.',
  'p.XDR': 'Wing funnels that fire chain beams between threats. XDR correlates what your other products see: alone it is weak, and every other product installed makes it hit harder.',
  'p.HCI': 'Reactor backpack. More compute for everything: every weapon on the frame cycles faster with each level.',
  'p.IAG': 'Shoulder emitters. Traffic control: hostile bullets slow down inside the amber ring around the frame.',
  'p.ASTOR': 'Snapshot armor. Takes a hit for you and restores the frame with every part intact. Recharges slowly.',
  'p.MDR': 'Not a part - a team. Calls a managed Incident Response sweep: clears every bullet and hammers everything on screen.',
  't.pick_EDR': 'Right arm: Endpoint Secure beam rifle', 't.pick_AF': 'Left arm: NGAF firewall shield', 't.pick_XDR': 'Wings: XDR funnels', 't.pick_NDR': 'Head + legs: Cyber Command sensors and missiles',
  't.pick_HCI': 'Backpack: HCI reactor - faster fire', 't.pick_IAG': 'Shoulders: IAG emitters - bullets slowed', 't.pick_ASTOR': 'Armor: aStor snapshot plating', 't.pick_MDR': 'MDR - Incident Response +1',
  't.maxed': 'already maxed: +2,000', 't.xdrAlone': 'XDR has nothing to correlate yet - install other products to power it',
  't.snapshot': 'aStor restored the frame from a snapshot', 't.down': 'Frame down - a part was torn off', 't.bomb': 'MDR Incident Response - airspace swept', 't.fwBreak': 'Firewall overloaded - recharging',
  't.exfil': 'Data exfiltrated! -1,500', 't.clear': 'Zone {n} secured  +{bonus}',
  't.evolve_1': 'Frame evolved: Mk-II Assault - all damage +10%', 't.evolve_2': 'Frame evolved: Mk-III Heavy - all damage +20%', 't.evolve_3': 'FULL ARMOR SENTINEL - all damage +30%',
  't.boss_botnet': 'Botnet Controller inbound', 't.boss_ransom': 'Ransomware Brute inbound', 't.boss_siege': 'APT Siege Engine inbound - it cloaks without Cyber Command',
  't.stage_datacenter': 'Zone 2 - Data Center', 't.stage_cloud': 'Zone 3 - Cloud Core',
};
const ZH = {
  'st.tag': '3D 机甲射击。你的 SF-01 机体出击时一身素装。每拾取一款深信服产品，它就会装到专属挂点上并一直保留——装得够多，机体本身也会进化，直到“全装甲”形态。',
  'st.h1': '鼠标、WASD / 方向键或触屏拖动来移动，机体自动开火。只有胸口发光的核心会被击中。按住 Shift 可精细微调。',
  'st.h2': '击落白色补给机并飞进补给箱。补给箱会在最多三款产品之间切换——等到想要的部件再拿。每个部件有三级，全部叠加。',
  'st.h3': '被击中会损失一条命，并让最强的部件掉一级。空格 / B / 右键（或 MDR 按钮）清除所有子弹。每个区域以 Boss 收尾。',
  'st.legend': '挂点一览', 'st.stage': '区域', 'st.cleared': '区域已肃清', 'st.evolved': '机体进化', 'st.lost': '受损',
  'st.victory': '全部区域已肃清', 'st.defeat': '机体被击毁', 'st.reached': '到达区域', 'st.kills': '摧毁威胁', 'st.bestChain': '最高连击', 'st.build': '最终机体',
  'st.pause': '已暂停——机库视角', 'st.resume': '按 P 或点击继续', 'st.sensors': '{n}/6 款为它供数', 'st.toNext': '再装 {n} 级进化为 {tier}', 'st.maxTier': '所有挂点已上线', 'st.parts': '{n}/21 部件等级', 'ui.board': '驾驶员排行榜',
  'tier.0': 'SF-01 基础机体', 'tier.1': 'Mk-II 强袭型', 'tier.2': 'Mk-III 重装型', 'tier.3': '全装甲哨兵',
  'tierShort.0': 'MK-I', 'tierShort.1': 'MK-II', 'tierShort.2': 'MK-III', 'tierShort.3': '全装甲',
  'slot.rarm': '右臂', 'slot.larm': '左臂', 'slot.head': '头部＋腿部', 'slot.wings': '翼部', 'slot.back': '背包', 'slot.shoulders': '肩部', 'slot.armor': '装甲', 'slot.call': '随时待命',
  'name.EDR': 'Endpoint Secure', 'name.AF': 'NGAF', 'name.XDR': 'XDR', 'name.NDR': 'Cyber Command', 'name.HCI': 'HCI', 'name.IAG': 'IAG', 'name.ASTOR': 'aStor',
  'stage.perimeter': '网络边界', 'stage.datacenter': '数据中心', 'stage.cloud': '云核心',
  'boss.botnet': '僵尸网络控制器', 'boss.ransom': '勒索软件巨兽', 'boss.siege': 'APT 攻城引擎',
  'code.EDR': 'EDR', 'code.AF': 'NGAF', 'code.XDR': 'XDR', 'code.NDR': 'CC', 'code.HCI': 'HCI', 'code.IAG': 'IAG', 'code.ASTOR': 'aStor', 'code.MDR': 'MDR',
  'p.EDR': '光束步枪。终端防护是真正对威胁动手的地方，所以它就是你手里的枪：每升一级，枪管更多、射界更宽。',
  'p.AF': '防火墙盾。拦下从正面来的敌方火力——也只拦正面，侧面和背后来的照样进得来。扛得太多会过载；3 级时把拦下的流量反射回去。',
  'p.NDR': '传感天线与导弹舱。Cyber Command 监视整个网络：追踪导弹替你找到威胁，隐身的 APT 也会现形。',
  'p.XDR': '翼部浮游炮，在威胁之间发射连锁光束。XDR 关联其他产品看到的信息：单独使用很弱，每多装一款其他产品，威力就更强。',
  'p.HCI': '反应堆背包。给一切提供更多算力：每升一级，机体上所有武器的射速都更快。',
  'p.IAG': '肩部发射器。流量管控：敌方子弹进入机体周围的琥珀色圆环后会减速。',
  'p.ASTOR': '快照装甲。替你挡下一击，并让机体带着全部部件原样恢复，缓慢充能。',
  'p.MDR': '它不是部件，而是一支团队。呼叫托管式应急响应清场：消除所有子弹，并重创屏幕上的一切。',
  't.pick_EDR': '右臂：Endpoint Secure 光束步枪', 't.pick_AF': '左臂：NGAF 防火墙盾', 't.pick_XDR': '翼部：XDR 浮游炮', 't.pick_NDR': '头部＋腿部：Cyber Command 传感器与导弹',
  't.pick_HCI': '背包：HCI 反应堆——射速提升', 't.pick_IAG': '肩部：IAG 发射器——子弹减速', 't.pick_ASTOR': '装甲：aStor 快照装甲', 't.pick_MDR': 'MDR——应急响应 +1',
  't.maxed': '已满级：+2,000', 't.xdrAlone': 'XDR 还没有可关联的数据——安装其他产品为它供能',
  't.snapshot': 'aStor 已从快照恢复机体', 't.down': '机体被击落——一个部件被打掉', 't.bomb': 'MDR 应急响应——空域已清场', 't.fwBreak': '防火墙过载——充能中',
  't.exfil': '数据被窃取！-1,500', 't.clear': '区域 {n} 已肃清  +{bonus}',
  't.evolve_1': '机体进化：Mk-II 强袭型——全部伤害 +10%', 't.evolve_2': '机体进化：Mk-III 重装型——全部伤害 +20%', 't.evolve_3': '全装甲哨兵——全部伤害 +30%',
  't.boss_botnet': '僵尸网络控制器来袭', 't.boss_ransom': '勒索软件巨兽来袭', 't.boss_siege': 'APT 攻城引擎来袭——没有 Cyber Command 它会隐身',
  't.stage_datacenter': '区域 2——数据中心', 't.stage_cloud': '区域 3——云核心',
};
const i18n = makeI18n(EN, ZH), { t } = i18n;
const board = makeBoard({ lsKey: 'sentinel.frame.scores.v1', apiVar: '__FRAME_API' });
const NAME_KEY = 'sentinel.arcade.name', BEST_KEY = 'sentinel.frame.best.v1';
const ls = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
const getBest = () => +ls.get(BEST_KEY, 0) || 0;
const LINKS = [{ href: 'stand3d.html', label: 'Sentinel Strike' }, { href: 'stand.html', label: 'Last Stand' }, { href: 'line.html', label: 'Breach Line' }, { href: 'index.html', label: 'Defend the Tower' }];

const app = document.getElementById('app');
app.innerHTML = `
  <div class="ar-top">
    ${brandHTML('Sentinel Frame')}
    <div class="ar-stats">
      <div class="ar-combo" id="frChain">x1.0</div>
      <div class="ar-stat"><span class="k" id="frScoreK"></span><span class="v good" id="frScore">0</span></div>
      <div class="ar-stat"><span class="k" id="frBestK"></span><span class="v" id="frBest">0</span></div>
    </div>
  </div>
  <div class="ar-field">
    <canvas id="stCanvas"></canvas>
    <div class="fr-zone" id="frZone" hidden><b id="frZoneName"></b><div class="fr-prog"><i id="frProg"></i></div></div>
    <div class="st-boss" id="frBoss" hidden><div class="st-boss-row"><span class="st-boss-name" id="frBossName"></span></div><div class="st-boss-bar"><i id="frBossFill"></i></div></div>
    <div class="fr-status" id="frStatus" hidden></div>
    <div class="fr-left" id="frLeft" hidden>
      <div class="fr-lives" id="frLives"></div>
      <button class="fr-bomb" id="frBomb" type="button">${MARK('MDR')}<b id="frBombN">3</b><small>SPACE</small></button>
    </div>
    <button class="fr-pausebtn" id="frPause" type="button" hidden aria-label="Pause">II</button>
  </div>
  <div class="ar-toasts" id="frToasts"></div>
  <div id="frOverlay"></div>`;
const $ = id => document.getElementById(id);
const el = { canvas: $('stCanvas'), chain: $('frChain'), score: $('frScore'), best: $('frBest'), zone: $('frZone'), zoneName: $('frZoneName'), prog: $('frProg'), boss: $('frBoss'), bossName: $('frBossName'), bossFill: $('frBossFill'), status: $('frStatus'), left: $('frLeft'), lives: $('frLives'), bomb: $('frBomb'), bombN: $('frBombN'), pause: $('frPause'), toasts: $('frToasts'), overlay: $('frOverlay') };
const paintStatus = painter(), paintLives = painter();
let phase = 'start', lastSummary = null, lastResult = null;

const pips = n => `<span class="fr-pips">${Array.from({ length: MAXLV }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
function chip(id, lv, extra = '') { return `<div class="fr-chip${lv ? '' : ' off'}" style="--cap:${COLOR[id]}">${MARK(id)}<span><em>${esc(t('slot.' + SLOT[id]))}</em><b>${esc(NAME[id])}</b>${pips(lv)}${extra}</span></div>`; }
function tierHTML(h) {
  const prev = TIERS[h.tier], frac = h.nextAt ? (h.total - prev) / (h.nextAt - prev) : 1;
  const sub = h.nextAt ? t('st.toNext', { n: h.nextAt - h.total, tier: t('tierShort.' + (h.tier + 1)) }) : t('st.maxTier');
  return `<div class="fr-tier t${h.tier}"><b>${esc(t('tierShort.' + h.tier))}</b><div class="fr-evo"><i style="width:${Math.round(frac * 100)}%"></i></div><small>${esc(sub)}</small></div>`;
}
function statusHTML(h) {
  const extra = id => id === 'AF' && h.lv.AF ? `<div class="fr-energy${h.fwDown ? ' down' : ''}"><i style="width:${Math.round(h.fw / h.fwMax * 100)}%"></i></div>`
    : id === 'XDR' && h.lv.XDR ? `<small class="${h.sensors ? '' : 'warn'}">${esc(t('st.sensors', { n: h.sensors }))}</small>` : '';
  return tierHTML(h) + PARTS.map(id => chip(id, h.lv[id], extra(id))).join('');
}
const LIFE_SVG = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2l2.2 3.2h3.3l1 4.3 3 .9-1.6 5.6h-3.4L15 22h-2.2v-5h-1.6v5H9l-1.5-6H4.1L2.5 10.4l3-.9 1-4.3h3.3z" fill="currentColor"/></svg>';

const game = createFrameGame(el.canvas, {
  label: k => t(k),
  onHud: h => {
    el.score.textContent = fmt(h.score); el.best.textContent = fmt(Math.max(h.score, getBest()));
    el.chain.textContent = 'x' + h.mult.toFixed(1); el.chain.classList.toggle('on', h.chain >= 10);
    el.zoneName.textContent = `${t('st.stage')} ${h.stage + 1} · ${t('stage.' + h.stageId)}`; el.prog.style.width = (h.progress * 100) + '%';
    paintStatus(el.status, statusHTML(h)); paintLives(el.lives, Array.from({ length: Math.max(0, h.lives - 1) }, () => LIFE_SVG).join(''));
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
function hud(on) { for (const n of [el.zone, el.status, el.left, el.pause]) n.hidden = !on; if (!on) el.boss.hidden = true; }
function labels() { $('frScoreK').textContent = t('ui.score'); $('frBestK').textContent = t('ui.best'); }

function legendHTML() {
  const row = id => `<div class="fr-leg" style="--cap:${COLOR[id]}">${MARK(id)}<div><em>${esc(t('slot.' + (SLOT[id] || 'call')))}</em><b>${esc(NAME[id])}</b><span>${esc(t('p.' + id))}</span></div></div>`;
  return `<div class="fr-legend">${ALL.map(row).join('')}</div>`;
}
function boardBlock(b, meId) {
  const rows = b.rows?.length ? b.rows.slice(0, 8).map(r => `<li class="lb-row${r.id === meId ? ' me' : ''}"><span class="lb-rank">${rankOf(b.rows, r.score)}</span><span class="lb-name">${esc(r.name)}</span><span class="lb-score">${fmt(r.score)}</span></li>`).join('') : `<li class="lb-empty">${esc(t('ui.empty'))}</li>`;
  return `<div class="ar-lb"><div class="ar-lb-h"><span class="t">${esc(t('ui.board'))}</span><span class="mode ${b.mode === 'world' ? 'world' : ''}">${esc(b.mode === 'world' ? t('ui.world') : t('ui.local'))}</span></div><ol class="lb-rows">${rows}</ol></div>`;
}
async function showStart() {
  phase = 'start'; game.stop(); hud(false); labels(); el.best.textContent = fmt(getBest()); el.score.textContent = '0';
  const b = await board.fetchBoard(); if (phase !== 'start') return;
  el.overlay.innerHTML = `<div class="ar-overlay"><div class="ar-card fr-card">
    ${brandHTML('Sentinel Frame')}
    <h1 class="ar-title">Sentinel <span class="em">Frame</span></h1>
    <p class="ar-tag">${esc(t('st.tag'))}</p>
    <p class="ar-field-label">${esc(t('ui.name'))}</p>
    <input class="ar-name" id="nameIn" maxlength="14" placeholder="${esc(t('ui.namePh'))}" value="${esc(ls.get(NAME_KEY, ''))}" />
    <div class="ar-row"><button class="btn primary block" data-act="play">${esc(t('ui.play'))}</button></div>
    <ol class="ar-how">${[1, 2, 3].map(i => `<li><span class="n">${i}</span><span>${esc(t('st.h' + i))}</span></li>`).join('')}</ol>
    <div class="fr-leg-title">${esc(t('st.legend'))}</div>${legendHTML()}
    ${boardBlock(b)}${footerHTML(t, { muted: isMuted(), links: LINKS })}</div></div>`;
}
function renderOver(s, result) {
  el.overlay.innerHTML = `<div class="ar-overlay"><div class="ar-card fr-card">
    ${brandHTML('Sentinel Frame')}
    <h1 class="ar-title" style="font-size:24px">${esc(t(s.outcome === 'victory' ? 'st.victory' : 'st.defeat'))}</h1>
    <div class="ar-result"><div class="lbl">${esc(t('ui.score'))}</div><div class="big">${fmt(s.score)}</div>
      ${result ? `<div class="sub">${esc(t('ui.youRank'))}<span class="hot">${result.rank}</span> · ${esc(result.mode === 'world' ? t('ui.world') : t('ui.local'))}</div>` : ''}</div>
    <div class="ar-meta">
      <div class="m"><span class="k">${esc(t('st.reached'))}</span><span class="v">${s.stage}/3</span></div>
      <div class="m"><span class="k">${esc(t('st.kills'))}</span><span class="v">${fmt(s.kills)}</span></div>
      <div class="m"><span class="k">${esc(t('st.bestChain'))}</span><span class="v">${s.bestChain}</span></div>
    </div>
    <div class="fr-leg-title">${esc(t('st.build'))}</div>
    <div class="fr-tierline">${esc(t('tier.' + s.tier))} · ${esc(t('st.parts', { n: s.total }))}</div>
    <div class="fr-build">${PARTS.map(id => chip(id, s.lv[id])).join('')}</div>
    <div class="ar-row"><button class="btn ghost" data-act="quit">${esc(t('ui.quit'))}</button><button class="btn primary" data-act="again">${esc(t('ui.again'))}</button></div>
    ${result ? boardBlock(result, result.id) : ''}
    ${footerHTML(t, { muted: isMuted(), links: LINKS })}</div></div>`;
}
async function onOver(s) {
  phase = 'over'; lastSummary = s; lastResult = null; hud(false);
  if (s.score > getBest()) ls.set(BEST_KEY, String(s.score));
  el.best.textContent = fmt(getBest()); renderOver(s, null);
  const result = await board.submitScore({ name: ls.get(NAME_KEY, '') || 'Anonymous', score: s.score, note: `zone ${s.stage}/3 · ${EN['tierShort.' + s.tier]} · ${s.total}/21 parts · ${s.kills} kills` });
  if (phase !== 'over' || lastSummary !== s) return;
  lastResult = result; renderOver(s, result);
}
function play() {
  const name = ($('nameIn')?.value || '').trim(); if (name) ls.set(NAME_KEY, name);
  resumeAudio(); el.overlay.innerHTML = ''; el.toasts.innerHTML = ''; phase = 'play'; hud(true); game.start();
}
function togglePause() {
  if (phase === 'play' && game.phase === 'play') { game.pause(); el.overlay.innerHTML = `<div class="ar-overlay fr-paused" data-act="resume"><div class="ar-card"><h1 class="ar-title" style="font-size:20px">${esc(t('st.pause'))}</h1><p class="ar-tag" style="margin:0">${esc(t('st.resume'))}</p></div></div>`; }
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
window.__frame = { game, board, i18n, ALL };
