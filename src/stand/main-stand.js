// Last Stand orchestrator: canvas wiring, the vertical-shooter HUD (base integrity,
// XP/level bar, a weapon chip + loadout rail built from the product logos), the
// level-up CHOICE CARDS (where you pick which Sangfor product upgrades your weapon,
// and which dimension it grows), a Product Codex, the leaderboard, and EN / 中文.

import { createStandGame, ACCENT } from './engine.js';
import { WEAPONS, WEAPON_ORDER, START_BASE } from './model.js';
import { PRODUCTS } from '../data/products.js';
import { ICONS } from '../ui/icons.js';
import { makeI18n } from '../arcade/i18n.js';
import { makeBoard } from '../arcade/board.js';
import { brandHTML, boardListHTML, footerHTML, fmt, esc, painter } from '../arcade/ui-kit.js';
import { setMuted, isMuted, resumeAudio } from '../rush/audio.js';

const ICON_KEY = { HCI: 'network', EDR: 'edr', NDR: 'ndr', AF: 'af', IAG: 'iag', XDR: 'xdr', ASTOR: 'astor', MDR: 'mdr' };
const CAP_NAME = { HCI: 'HCI Cloud', EDR: 'Endpoint Secure', NDR: 'Cyber Command', AF: 'NGAF', IAG: 'IAG Gateway', XDR: 'XDR', ASTOR: 'aStor', MDR: 'MDR' };
const ICO = id => ICONS[ICON_KEY[id]] || '';

const EN = {
  'st.title': 'Last Stand',
  'st.tag': 'Hold the line. Threats pour down the shaft at you and your base; your weapon fires itself. Every level, you pick a Sangfor product to bolt onto the weapon - each one upgrades a different dimension (power, rate, form...) until you are melting waves with the XDR correlation beam. Survive and climb the board.',
  'st.h1': 'Move along the bottom with A/D (or arrows), or just drag. Your weapon auto-fires up at the nearest threat - you never aim.',
  'st.h2': 'Clear threats to level up. Each level, choose 1 of 3 Sangfor products - it upgrades your weapon on a different axis. Stack them into a build.',
  'st.h3': 'Each axis is the real product: HCI = fire rate, EDR = damage, NDR = pierce, NGAF = spread, IAG = slow, XDR = the beam (x your sensors), aStor = shield, MDR = a drone. Zero base integrity ends it.',
  'st.base': 'Base integrity',
  'st.time': 'Time',
  'st.lv': 'LV',
  'st.weapon': 'Weapon',
  'st.levelup': 'Level {n}',
  'st.choose': 'Choose a product upgrade',
  'st.chooseSub': 'Each one grows your weapon on a different dimension.',
  'st.codex': 'Product codex',
  'st.loadout': 'Weapon build',
  'st.over': 'Base overrun',
  'st.overSub': 'You held for {s}s, cleared {k} threats, and reached operator level {lv}.',
  'st.kills': 'Threats cleared',
  'st.streak': 'Best streak',
  'st.held': 'Survived',
  'st.reached': 'Level reached',
  'st.real': 'Real job',
  'st.boost': 'Weapon upgrade',
  'st.limit': 'Limitation',
  'st.codexSub': 'Each product upgrades the weapon on the dimension it owns in real life - that is the whole point.',
  'st.none': 'Base weapon - no products yet',
  'st.max': 'MAX',
  'st.to': 'Lv {a} -> {b}',
  'st.new': 'NEW',
  // weapon-dimension short label per product
  'dim.HCI': 'Fire rate',
  'dim.EDR': 'Damage per shot',
  'dim.NDR': 'Pierce + multishot',
  'dim.AF': 'Spread fan + armor',
  'dim.IAG': 'Slow field',
  'dim.XDR': 'Correlation beam',
  'dim.ASTOR': 'Snapshot shield',
  'dim.MDR': 'Wingman drone',
  // what the upgrade does, in game terms (card body + codex "weapon upgrade")
  'b.HCI': 'Cloud compute = cycles: your weapon fires faster every level.',
  'b.EDR': 'Endpoint kill power: straight damage per shot.',
  'b.NDR': 'Network-wide reach: shots pierce more threats and split into extra streams - and reveal cloaked APTs.',
  'b.AF': 'Perimeter screening: a fan of side bolts, and a harder base.',
  'b.IAG': 'Egress throttle: hits slow threats to a crawl.',
  'b.XDR': 'Fires the giant correlation beam. Weak alone - its damage multiplies with how many sensors (EDR/NDR/NGAF) feed it.',
  'b.ASTOR': 'Snapshot shield soaks a hit on your base, plus steady restore.',
  'b.MDR': 'A managed wingman drone fights at your side.',
  't.boss': 'Ransomware brute inbound',
  't.exfil': 'Data exfiltrated! An exfil runner slipped through',
  't.absorb': 'aStor snapshot absorbed the hit',
  't.xdrIdle': 'XDR beam has no sensors to correlate - add EDR / NDR / NGAF',
  'g.HCI': 'Elastic, pooled cloud compute (HCI): raw capacity and throughput for everything you run.',
  'l.HCI': 'Capacity, not security on its own - it makes everything else run harder and faster.',
};
const ZH = {
  'st.title': '最后防线',
  'st.tag': '守住防线。威胁顺着通道向你和基地涌下，你的武器会自动开火。每次升级，你都挑选一件深信服产品装到武器上——每件强化一个不同维度（威力、射速、形态……），直到你用 XDR 关联光束融化成片的敌人。活下去，冲上排行榜。',
  'st.h1': '用 A/D（或方向键）在底部移动，或直接拖动。武器会自动朝最近的威胁向上开火——你无需瞄准。',
  'st.h2': '清除威胁即可升级。每次升级从 3 件深信服产品中选 1 件——它会在不同维度强化你的武器。把它们叠成一套流派。',
  'st.h3': '每个维度都是产品的真实能力：HCI=射速，EDR=伤害，NDR=穿透，NGAF=散射，IAG=减速，XDR=光束（×你的传感器），aStor=护盾，MDR=无人机。基地完整度归零即结束。',
  'st.base': '基地完整度',
  'st.time': '时间',
  'st.lv': '等级',
  'st.weapon': '武器',
  'st.levelup': '第 {n} 级',
  'st.choose': '选择一项产品强化',
  'st.chooseSub': '每一项都会在不同维度强化你的武器。',
  'st.codex': '产品图鉴',
  'st.loadout': '武器配装',
  'st.over': '基地被攻陷',
  'st.overSub': '你坚持了 {s} 秒，清除 {k} 个威胁，操作员达到 {lv} 级。',
  'st.kills': '清除威胁',
  'st.streak': '最高连击',
  'st.held': '存活',
  'st.reached': '达到等级',
  'st.real': '真实职责',
  'st.boost': '武器强化',
  'st.limit': '局限',
  'st.codexSub': '每件产品强化的正是它在现实中负责的那个维度——这正是重点。',
  'st.none': '基础武器——尚无产品',
  'st.max': '满级',
  'st.to': '{a} → {b} 级',
  'st.new': '新',
  'dim.HCI': '射速',
  'dim.EDR': '单发伤害',
  'dim.NDR': '穿透 + 多重射击',
  'dim.AF': '散射 + 护甲',
  'dim.IAG': '减速力场',
  'dim.XDR': '关联光束',
  'dim.ASTOR': '快照护盾',
  'dim.MDR': '僚机无人机',
  'b.HCI': '云算力=运算周期：每级让武器射速更快。',
  'b.EDR': '终端杀伤力：直接提升单发伤害。',
  'b.NDR': '全网触达：射击穿透更多威胁并分裂出更多弹流——还能让隐身 APT 现形。',
  'b.AF': '边界安检：增加侧向散射火力，并让基地更坚固。',
  'b.IAG': '出口限流：命中使威胁减速到极慢。',
  'b.XDR': '发射巨型关联光束。单独很弱——伤害随喂给它的传感器（EDR/NDR/NGAF）数量倍增。',
  'b.ASTOR': '快照护盾替基地挡下一击，并持续恢复。',
  'b.MDR': '一架托管僚机无人机与你并肩作战。',
  't.boss': '勒索软件巨兽来袭',
  't.exfil': '数据被窃取！一个外泄跑者溜了过去',
  't.absorb': 'aStor 快照挡下了这一击',
  't.xdrIdle': 'XDR 光束没有可关联的传感器——去加 EDR / NDR / NGAF',
  'g.HCI': '弹性、池化的云计算（HCI）：为你运行的一切提供算力与吞吐。',
  'l.HCI': '它本身是算力而非安全——让其它一切跑得更猛、更快。',
};

const i18n = makeI18n(EN, ZH);
const { t } = i18n;
const lang = () => i18n.getLang();
const board = makeBoard({ lsKey: 'sentinel.stand.scores.v1', apiVar: '__STAND_API' });
const NAME_KEY = 'sentinel.arcade.name';
const BEST_KEY = 'sentinel.stand.best';
const getName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
const saveName = n => { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } };
const getBest = () => { try { return +localStorage.getItem(BEST_KEY) || 0; } catch { return 0; } };
const saveBest = b => { try { localStorage.setItem(BEST_KEY, String(b)); } catch { /* ignore */ } };

const LINKS = [
  { href: 'vector.html', label: 'Threat Vector' },
  { href: 'line.html', label: 'Breach Line' },
  { href: 'index.html', label: 'Defend the Tower' },
];

const app = document.getElementById('app');
app.innerHTML = `
  <div class="ar-top">
    ${brandHTML('Last Stand')}
    <div class="ar-stats">
      <div class="ar-combo" id="stCombo">x1</div>
      <div class="ar-stat"><span class="k">${esc(t('st.time'))}</span><span class="v" id="stTime">0s</span></div>
      <div class="ar-stat"><span class="k">${esc(t('ui.score'))}</span><span class="v good" id="stScore">0</span></div>
      <div class="ar-stat"><span class="k">${esc(t('ui.best'))}</span><span class="v" id="stBest">0</span></div>
    </div>
  </div>
  <div class="ar-field">
    <canvas id="stCanvas"></canvas>
    <div class="st-topbar">
      <div class="st-xp"><i id="stXpFill"></i><span class="st-lv-txt" id="stLvTxt">${esc(t('st.lv'))} 1</span></div>
      <div class="st-weap" id="stWeap"></div>
    </div>
    <div class="st-rail" id="stRail"></div>
    <div class="st-base"><i id="stBaseFill"></i><span class="st-base-txt" id="stBaseTxt"></span></div>
  </div>
  <div class="ar-toasts" id="stToasts"></div>
  <div id="stOverlay"></div>
`;

const el = {
  canvas: document.getElementById('stCanvas'),
  combo: document.getElementById('stCombo'),
  time: document.getElementById('stTime'),
  score: document.getElementById('stScore'),
  best: document.getElementById('stBest'),
  xpFill: document.getElementById('stXpFill'),
  lvTxt: document.getElementById('stLvTxt'),
  weap: document.getElementById('stWeap'),
  rail: document.getElementById('stRail'),
  baseFill: document.getElementById('stBaseFill'),
  baseTxt: document.getElementById('stBaseTxt'),
  toasts: document.getElementById('stToasts'),
  overlay: document.getElementById('stOverlay'),
};
const paintScore = painter();
const paintWeap = painter();
const paintRail = painter();
let phase = 'start', lastSummary = null, lastResult = null;

const game = createStandGame(el.canvas, {
  onHud: h => {
    paintScore(el.score, fmt(h.score));
    el.best.textContent = fmt(Math.max(h.best, getBest()));
    el.time.textContent = h.elapsed + 's';
    el.combo.textContent = 'x' + h.mult;
    el.combo.classList.toggle('on', h.combo >= 10);
    el.xpFill.style.width = Math.max(0, Math.min(100, h.xp / h.xpNeed * 100)) + '%';
    el.lvTxt.textContent = `${t('st.lv')} ${h.level}`;
    const bf = Math.max(0, Math.min(100, h.base / h.baseMax * 100));
    el.baseFill.style.width = bf + '%';
    el.baseFill.className = bf > 50 ? 'ok' : bf > 25 ? 'warn' : 'bad';
    el.baseTxt.textContent = `${h.base}`;
    paintWeap(el.weap, weapHTML(h));
    paintRail(el.rail, railHTML(h.levels));
  },
  onToast: (key, kind) => toast(t('t.' + key), kind),
  onLevelUp: (choices, level) => showLevelUp(choices, level),
  onOver: summary => onGameOver(summary),
});

function weapHTML(h) {
  const id = h.dom;
  if (!id) return `<span class="st-weap-ico cap-XDR">${ICO('XDR')}</span><span class="st-weap-lv"><b>${esc(t('st.weapon'))}</b><span>T0</span></span>`;
  const lvl = h.levels[id] || 0;
  return `<span class="st-weap-ico cap-${id}">${ICO(id)}</span>` +
    `<span class="st-weap-lv"><b>${esc(CAP_NAME[id])}</b><span>Lv${lvl} · T${h.tier}</span></span>`;
}
function railHTML(levels) {
  const ids = WEAPON_ORDER.filter(id => (levels[id] || 0) > 0);
  if (!ids.length) return '';
  return ids.map(id => {
    const lv = levels[id] || 0, max = WEAPONS[id].max;
    const dots = Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
    return `<span class="st-rail-item cap-${id}" title="${esc(CAP_NAME[id])} - ${esc(t('dim.' + id))}">
      <span class="st-rail-ico">${ICO(id)}</span><span class="st-rail-dots">${dots}</span></span>`;
  }).join('');
}

function toast(msg, kind = '') {
  if (!msg) return;
  const n = document.createElement('div');
  n.className = `ar-toast ${kind}`.trim();
  n.textContent = msg;
  el.toasts.appendChild(n);
  setTimeout(() => n.remove(), 1500);
  while (el.toasts.children.length > 4) el.toasts.firstChild.remove();
}

// ---------- level-up cards (the product-integrated moment) ----------
function cardHTML(ch) {
  const id = ch.id, isNew = ch.toLevel === 1, maxed = ch.toLevel >= ch.max;
  return `<button class="st-card cap-${id}" data-up="${id}">
    <span class="st-card-top">
      <span class="st-card-ico">${ICO(id)}</span>
      ${isNew ? `<span class="st-card-tag">${esc(t('st.new'))}</span>` : `<span class="st-card-tag lv">${esc(t('st.to', { a: ch.toLevel - 1, b: ch.toLevel }))}${maxed ? ' · ' + esc(t('st.max')) : ''}</span>`}
    </span>
    <span class="st-card-name">${esc(CAP_NAME[id])}</span>
    <span class="st-card-dim">${esc(t('dim.' + id))}</span>
    <span class="st-card-dd">${esc(t('b.' + id))}</span>
  </button>`;
}
function showLevelUp(choices, level) {
  phase = 'levelup';
  el.overlay.innerHTML = `
    <div class="ar-overlay st-lvup" id="stLevelUp">
      <div class="ar-card st-lvcard">
        <div class="st-lv-badge">${esc(t('st.levelup', { n: level }))}</div>
        <h2 class="st-lv-title">${esc(t('st.choose'))}</h2>
        <p class="st-lv-sub">${esc(t('st.chooseSub'))}</p>
        <div class="st-cards">${choices.map(cardHTML).join('')}</div>
      </div>
    </div>`;
}
function chooseUpgrade(id) {
  const c = document.getElementById('stLevelUp'); if (c) c.remove();
  phase = 'play';
  game.applyUpgrade(id);
}

// ---------- screens ----------
async function showStart() {
  phase = 'start'; game.stop();
  const b = await board.fetchBoard();
  el.best.textContent = fmt(getBest());
  resetHud();
  el.overlay.innerHTML = `
    <div class="ar-overlay">
      <div class="ar-card">
        ${brandHTML('Last Stand')}
        <h1 class="ar-title">Last <span class="em">Stand</span></h1>
        <p class="ar-tag">${esc(t('st.tag'))}</p>
        <p class="ar-field-label">${esc(t('ui.name'))}</p>
        <input class="ar-name" id="nameIn" maxlength="14" placeholder="${esc(t('ui.namePh'))}" value="${esc(getName())}" />
        <ol class="ar-how">
          <li><span class="n">1</span><span>${esc(t('st.h1'))}</span></li>
          <li><span class="n">2</span><span>${esc(t('st.h2'))}</span></li>
          <li><span class="n">3</span><span>${esc(t('st.h3'))}</span></li>
        </ol>
        <div class="ar-row">
          <button class="btn ghost" data-act="codex">${esc(t('st.codex'))}</button>
          <button class="btn primary" data-act="play">${esc(t('ui.play'))}</button>
        </div>
        ${boardBlock(b)}
        ${footerHTML(t, { muted: isMuted(), links: LINKS })}
      </div>
    </div>`;
}

function boardBlock(b, meId) {
  return `<div class="ar-lb">
    <div class="ar-lb-h"><span class="t">${esc(t('ui.board'))}</span>
      <span class="mode ${b.mode === 'world' ? 'world' : ''}">${esc(b.mode === 'world' ? t('ui.world') : t('ui.local'))}</span></div>
    <ol class="lb-rows">${boardListHTML(b.rows, { empty: t('ui.empty'), meId })}</ol>
  </div>`;
}

function codexRows() {
  const L = lang();
  return WEAPON_ORDER.map(id => {
    const p = PRODUCTS[id];
    const real = p ? p.capability[L] : t('g.' + id);
    const lim = p ? p.limitation[L] : t('l.' + id);
    const name = p ? p.shortName : CAP_NAME[id];
    return `<div class="vc-cx cap-${id}">
      <div class="vc-cx-h"><span class="st-cx-ico">${ICO(id)}</span><b>${esc(name)}</b><span class="st-cx-dim">${esc(t('dim.' + id))}</span></div>
      <div class="vc-cx-row"><span class="vc-cx-k">${esc(t('st.real'))}</span><span>${esc(real)}</span></div>
      <div class="vc-cx-row boost"><span class="vc-cx-k">${esc(t('st.boost'))}</span><span>${esc(t('b.' + id))}</span></div>
      <div class="vc-cx-row lim"><span class="vc-cx-k">${esc(t('st.limit'))}</span><span>${esc(lim)}</span></div>
    </div>`;
  }).join('');
}
function showCodex() {
  el.overlay.insertAdjacentHTML('beforeend', `
    <div class="ar-overlay" id="stCodex">
      <div class="ar-card wide">
        ${brandHTML('Product codex')}
        <h1 class="ar-title" style="font-size:22px">${esc(t('st.codex'))}</h1>
        <p class="ar-tag" style="margin-bottom:12px">${esc(t('st.codexSub'))}</p>
        <div class="vc-cx-list">${codexRows()}</div>
        <button class="btn primary block" data-act="closeCodex" style="margin-top:14px">${esc(t('ui.back'))}</button>
      </div>
    </div>`);
}

async function onGameOver(summary) {
  phase = 'over'; lastSummary = summary; lastResult = null;
  if (summary.best > getBest()) saveBest(summary.best);
  renderOver(summary, null);
  const n = Object.keys(summary.levels).length;
  const result = await board.submitScore({ name: getName() || 'Anonymous', score: summary.score, note: `${summary.elapsed}s · L${summary.level} · ${n} products` });
  lastResult = result;
  renderOver(summary, result);
}

function renderOver(summary, result) {
  const meId = result?.id;
  el.overlay.innerHTML = `
    <div class="ar-overlay">
      <div class="ar-card">
        ${brandHTML('Last Stand')}
        <h1 class="ar-title" style="font-size:22px">${esc(t('st.over'))}</h1>
        <div class="ar-result">
          <div class="lbl">${esc(t('ui.score'))}</div>
          <div class="big">${fmt(summary.score)}</div>
          <div class="sub">${esc(t('st.overSub', { s: summary.elapsed, k: summary.kills, lv: summary.level }))}</div>
          ${result ? `<div class="sub">${esc(t('ui.youRank'))}<span class="hot">${result.rank}</span> · ${esc(result.mode === 'world' ? t('ui.world') : t('ui.local'))}</div>` : ''}
        </div>
        <div class="st-build-h">${esc(t('st.loadout'))}</div>
        <div class="st-rail final">${railHTML(summary.levels) || `<span class="st-rail-empty">${esc(t('st.none'))}</span>`}</div>
        <div class="ar-meta">
          <div class="m"><span class="k">${esc(t('st.kills'))}</span><span class="v">${fmt(summary.kills)}</span></div>
          <div class="m"><span class="k">${esc(t('st.streak'))}</span><span class="v">${summary.maxCombo}</span></div>
          <div class="m"><span class="k">${esc(t('st.held'))}</span><span class="v">${summary.elapsed}s</span></div>
        </div>
        ${result ? boardBlock(result, meId) : ''}
        <div class="ar-row">
          <button class="btn ghost" data-act="quit">${esc(t('ui.quit'))}</button>
          <button class="btn primary" data-act="again">${esc(t('ui.again'))}</button>
        </div>
        <button class="linklike" data-act="share" style="display:block;margin:10px auto 0;text-align:center">${esc(t('ui.share'))}</button>
        ${footerHTML(t, { muted: isMuted(), links: LINKS })}
      </div>
    </div>`;
}

function resetHud() {
  el.baseFill.style.width = '100%'; el.baseFill.className = 'ok'; el.baseTxt.textContent = START_BASE;
  el.xpFill.style.width = '0%'; el.lvTxt.textContent = `${t('st.lv')} 1`;
  el.weap.innerHTML = ''; el.rail.innerHTML = '';
  el.time.textContent = '0s'; el.combo.textContent = 'x1'; el.combo.classList.remove('on');
}

function play() {
  const name = (document.getElementById('nameIn')?.value || '').trim();
  if (name) saveName(name);
  resumeAudio();
  el.overlay.innerHTML = '';
  phase = 'play';
  game.start(getBest());
}

// ---------- events ----------
el.overlay.addEventListener('click', e => {
  const up = e.target.closest('[data-up]')?.dataset.up;
  if (up) { chooseUpgrade(up); return; }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'play' || act === 'again') play();
  else if (act === 'quit') showStart();
  else if (act === 'codex') showCodex();
  else if (act === 'closeCodex') { const c = document.getElementById('stCodex'); if (c) c.remove(); }
  else if (act === 'lang') { i18n.toggleLang(); relabel(); rerender(); }
  else if (act === 'mute') { setMuted(!isMuted()); rerender(); }
  else if (act === 'share') shareResult(e.target);
});

window.addEventListener('keydown', e => {
  if (phase === 'levelup' && '123'.includes(e.key)) {
    const cards = document.querySelectorAll('#stLevelUp .st-card');
    const card = cards[+e.key - 1]; if (card) { e.preventDefault(); chooseUpgrade(card.dataset.up); }
  } else if (e.key === 'Escape') { const c = document.getElementById('stCodex'); if (c) c.remove(); }
});

async function shareResult(elm) {
  if (!lastSummary) return;
  const text = `Sentinel · Last Stand — ${fmt(lastSummary.score)} pts, survived ${lastSummary.elapsed}s (L${lastSummary.level})`;
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  const old = elm.textContent; elm.textContent = t('ui.copied');
  setTimeout(() => { elm.textContent = old; }, 1400);
}

function relabel() {
  const ks = document.querySelectorAll('.ar-stat .k');
  if (ks[0]) ks[0].textContent = t('st.time');
  if (ks[1]) ks[1].textContent = t('ui.score');
  if (ks[2]) ks[2].textContent = t('ui.best');
}
function rerender() {
  if (phase === 'over' && lastSummary) renderOver(lastSummary, lastResult);
  else if (phase === 'start') showStart();
}

showStart();
window.__stand = { game, board, i18n };
