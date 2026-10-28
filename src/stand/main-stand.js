// Last Stand orchestrator: canvas wiring, the vertical-shooter HUD (base integrity,
// XP/level bar, a weapon chip + loadout rail built from the product logos), the
// level-up CHOICE CARDS (where you pick which Sangfor product upgrades your weapon,
// and which dimension it grows), a Product Codex, the leaderboard, and EN / 中文.

import { createStandGame, ACCENT } from './engine.js';
import { WEAPONS, WEAPON_ORDER, START_BASE, ABILITIES, ABILITY_ORDER } from './model.js';
import { PRODUCTS } from '../data/products.js';
import { ICONS } from '../ui/icons.js';
import { PRODUCT_MARKS } from '../ui/product-marks.js';
import { makeI18n } from '../arcade/i18n.js';
import { makeBoard } from '../arcade/board.js';
import { brandHTML, boardListHTML, footerHTML, fmt, esc, painter } from '../arcade/ui-kit.js';
import { setMuted, isMuted, resumeAudio } from '../rush/audio.js';

const ICON_KEY = { HCI: 'network', EDR: 'edr', NDR: 'ndr', AF: 'af', IAG: 'iag', XDR: 'xdr', ASTOR: 'astor', MDR: 'mdr' };
const CAP_NAME = { HCI: 'HCI Cloud', EDR: 'Endpoint Secure', NDR: 'Cyber Command', AF: 'NGAF', IAG: 'IAG Gateway', XDR: 'XDR', ASTOR: 'aStor', MDR: 'MDR' };
const ICO = id => ICONS[ICON_KEY[id]] || '';
// official Sangfor product artwork for the HUD (same marks the battlefield uses)
const MARK = id => { const m = PRODUCT_MARKS[id]; return m ? `<img class="st-mark" src="assets/brand/products/sangfor-${m[0]}" alt="${esc(CAP_NAME[id] || id)}" loading="lazy" />` : ICO(id); };

const EN = {
  'st.title': 'Last Stand',
  'st.tag': 'Hold the line. Threats pour straight down at you and your base; you and every unit fire straight up. Each level you DEPLOY a Sangfor product that shows up on the field and fights the way it really works - EDR endpoint turrets beside you, an NGAF barrier that blocks + weakens, MDR teammates, an NDR radar, the XDR correlation beam. Build your squad, survive, climb the board.',
  'st.h1': 'Move along the bottom with A/D (or arrows), or just drag. You and all your units auto-fire straight up - line threats up in your columns.',
  'st.h2': 'Clear threats to level up fast. Each level, choose 1 of 3 Sangfor products - it DEPLOYS as a real unit on the field. Stack them into a squad.',
  'st.h3': 'Every unit is the real product: EDR = a turret, NGAF = a barrier, MDR = a teammate, NDR = radar + marking, IAG = a slow band, HCI = fire rate for all, XDR = the giant beam (x your sensors), aStor = a base shield. Zero base integrity ends it.',
  'st.base': 'Base integrity',
  'st.time': 'Time',
  'st.lv': 'LV',
  'st.weapon': 'Weapon',
  'st.levelup': 'Level {n}',
  'st.choose': 'Choose a product upgrade',
  'st.chooseSub': 'Each one deploys a Sangfor unit that fights its own way.',
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
  // what each product DEPLOYS (card dimension line)
  'dim.EDR': 'Endpoint turret',
  'dim.MDR': '24/7 teammate',
  'dim.AF': 'Perimeter barrier',
  'dim.NDR': 'Radar + marking',
  'dim.IAG': 'Egress slow band',
  'dim.HCI': 'Compute core (fire rate)',
  'dim.XDR': 'Correlation beam',
  'dim.ASTOR': 'Snapshot vault',
  // what the deployable does, in game terms (card body + codex "weapon upgrade")
  'b.EDR': 'Sets up a fixed EDR endpoint turret on your wall that auto-fires straight up. More levels = more turrets.',
  'b.MDR': 'A managed MDR teammate fights at your side 24/7 - more levels raise its firepower and fire rate.',
  'b.AF': 'Raises an NGAF barrier in front that blocks a cluster of threats and weakens any that break through.',
  'b.NDR': 'Deploys an NDR radar: reveals cloaked APTs and marks threats so every unit does bonus damage.',
  'b.IAG': 'Projects an IAG checkpoint band across the field - threats crossing it crawl.',
  'b.HCI': 'An HCI compute core speeds up the fire rate of every unit you have.',
  'b.XDR': 'Calls the giant XDR correlation beam. Weak alone - its damage multiplies with the sensor units (EDR/NDR/NGAF) on the field.',
  'b.ASTOR': 'An aStor snapshot vault shields your base from a hit and restores integrity.',
  't.boss': 'Ransomware brute inbound',
  't.exfil': 'Data exfiltrated! An exfil runner slipped through',
  't.absorb': 'aStor snapshot absorbed the hit',
  't.afDown': 'NGAF barrier breached - rebuilding',
  't.xdrIdle': 'XDR beam has no sensors to correlate - add EDR / NDR / NGAF',
  't.irOn': 'Incident Response - breach contained',
  't.ptOn': 'Penetration Testing - weaknesses exposed',
  't.rtOn': 'Red Team Assessment - offensive surge',
  // active operator skills
  'st.skills': 'Operator skills (service engagements)',
  'ab.ir': 'Incident Response',
  'ab.pt': 'Penetration Testing',
  'ab.rt': 'Red Team Assessment',
  'ab.ready': 'READY',
  'abd.ir': 'Contain the active breach: heavy damage to every threat on screen, restore base integrity, and brace for the next hit. [Q]',
  'abd.pt': 'Expose weaknesses: reveal every hidden threat and amplify ALL your damage for a few seconds. [E]',
  'abd.rt': 'Go on the offensive: surge the fire rate and firepower of your whole squad for a few seconds. [R]',
  'g.HCI': 'Elastic, pooled cloud compute (HCI): raw capacity and throughput for everything you run.',
  'l.HCI': 'Capacity, not security on its own - it makes everything else run harder and faster.',
};
const ZH = {
  'st.title': '最后防线',
  'st.tag': '守住防线。威胁笔直向你和基地压下，你和每一个单位都笔直向上开火。每次升级都会在战场上部署一件深信服产品，它按照真实功能作战——EDR 终端炮塔、拦截并削弱敌人的 NGAF 屏障、MDR 队友、NDR 雷达、XDR 关联光束。组建你的小队，活下去，冲上排行榜。',
  'st.h1': '用 A/D（或方向键）在底部移动，或直接拖动。你和所有单位都会笔直向上自动开火——把敌人排进你的射击纵列。',
  'st.h2': '清除威胁快速升级。每次升级从 3 件深信服产品中选 1 件——它会作为真实单位部署到战场。把它们叠成一支小队。',
  'st.h3': '每个单位都是真实产品：EDR=炮塔，NGAF=屏障，MDR=队友，NDR=雷达+标记，IAG=减速带，HCI=全体射速，XDR=巨型光束（×你的传感器），aStor=基地护盾。基地完整度归零即结束。',
  'st.base': '基地完整度',
  'st.time': '时间',
  'st.lv': '等级',
  'st.weapon': '武器',
  'st.levelup': '第 {n} 级',
  'st.choose': '选择一项产品强化',
  'st.chooseSub': '每一项都会部署一件按自身方式作战的深信服单位。',
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
  'dim.EDR': '终端炮塔',
  'dim.MDR': '7×24 队友',
  'dim.AF': '边界屏障',
  'dim.NDR': '雷达 + 标记',
  'dim.IAG': '出口减速带',
  'dim.HCI': '算力核心（射速）',
  'dim.XDR': '关联光束',
  'dim.ASTOR': '快照保险库',
  'b.EDR': '在你的防线上架设一座固定的 EDR 终端炮塔，自动笔直向上开火。等级越高，炮塔越多。',
  'b.MDR': '一名托管的 MDR 队友 7×24 在你身边并肩作战——等级越高，火力与射速越强。',
  'b.AF': '在前方升起一道 NGAF 屏障，拦截一群威胁，并削弱任何突破它的敌人。',
  'b.NDR': '部署一台 NDR 雷达：让隐身 APT 现形，并标记威胁，使每个单位造成额外伤害。',
  'b.IAG': '在战场上投射一道 IAG 检查带——穿越它的威胁会变得极慢。',
  'b.HCI': '一座 HCI 算力核心，提升你所有单位的射速。',
  'b.XDR': '召唤巨型 XDR 关联光束。单独很弱——伤害随战场上的传感器单位（EDR/NDR/NGAF）数量倍增。',
  'b.ASTOR': '一座 aStor 快照保险库替基地挡下一击，并恢复完整度。',
  't.boss': '勒索软件巨兽来袭',
  't.exfil': '数据被窃取！一个外泄跑者溜了过去',
  't.absorb': 'aStor 快照挡下了这一击',
  't.afDown': 'NGAF 屏障被攻破——重建中',
  't.xdrIdle': 'XDR 光束没有可关联的传感器——去加 EDR / NDR / NGAF',
  't.irOn': '应急响应——已遏制入侵',
  't.ptOn': '渗透测试——已暴露弱点',
  't.rtOn': '红队评估——进攻爆发',
  // 主动操作员技能
  'st.skills': '操作员技能（服务项目）',
  'ab.ir': '应急响应',
  'ab.pt': '渗透测试',
  'ab.rt': '红队评估',
  'ab.ready': '就绪',
  'abd.ir': '遏制正在发生的入侵：对屏幕上每个威胁造成大量伤害，恢复基地完整度，并抵御下一次攻击。[Q]',
  'abd.pt': '暴露弱点：让所有隐藏威胁现形，并在数秒内放大你的全部伤害。[E]',
  'abd.rt': '转入进攻：在数秒内提升整支小队的射速与火力。[R]',
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
      <div class="st-lvbadge" id="stLvTxt">${esc(t('st.lv'))} 1</div>
      <div class="st-xp"><i id="stXpFill"></i></div>
      <div class="st-weap" id="stWeap"></div>
    </div>
    <div class="st-rail" id="stRail"></div>
    <div class="st-abil" id="stAbil"></div>
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
  abil: document.getElementById('stAbil'),
  toasts: document.getElementById('stToasts'),
  overlay: document.getElementById('stOverlay'),
};

// ---------- active operator skills (bottom bar) ----------
const ABIL_CAP = { ir: 'NDR', pt: 'IAG', rt: 'EDR' };   // accent reuse
const ABIL_KEY = { ir: 'Q', pt: 'E', rt: 'R' };
const abilBtns = {};
function buildAbilBar() {
  el.abil.innerHTML = ABILITY_ORDER.map(id => `
    <button class="st-ab cap-${ABIL_CAP[id]}" data-ab="${id}" type="button"
      title="${esc(t('ab.' + id))} - ${esc(t('abd.' + id))}" aria-label="${esc(t('ab.' + id))}">
      <span class="st-ab-cd"></span>
      <span class="st-ab-key">${ABIL_KEY[id]}</span>
      <span class="st-ab-code">${id.toUpperCase()}</span>
      <span class="st-ab-name">${esc(t('ab.' + id))}</span>
      <span class="st-ab-timer"></span>
    </button>`).join('');
  for (const id of ABILITY_ORDER) {
    const b = el.abil.querySelector(`[data-ab="${id}"]`);
    abilBtns[id] = { btn: b, cd: b.querySelector('.st-ab-cd'), timer: b.querySelector('.st-ab-timer') };
    b.addEventListener('click', () => { if (phase === 'play') game.useAbility(id); });
  }
}
function updateAbilBar(abilities) {
  if (!abilities) return;
  for (const id of ABILITY_ORDER) {
    const a = abilities[id], ui = abilBtns[id]; if (!a || !ui) continue;
    const pct = a.ready ? 0 : Math.max(0, Math.min(100, a.cd / a.cdMax * 100));
    ui.cd.style.height = pct + '%';
    ui.btn.classList.toggle('ready', a.ready);
    ui.btn.classList.toggle('active', !!a.active);
    ui.timer.textContent = a.ready ? '' : Math.ceil(a.cd) + 's';
  }
}
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
    updateAbilBar(h.abilities);
  },
  onToast: (key, kind) => toast(t('t.' + key), kind),
  onLevelUp: (choices, level) => showLevelUp(choices, level),
  onOver: summary => onGameOver(summary),
});

function weapHTML(h) {
  const id = h.dom;
  if (!id) return `<span class="st-weap-ico cap-XDR">${MARK('XDR')}</span><span class="st-weap-lv"><b>${esc(t('st.weapon'))}</b><span>T0</span></span>`;
  const lvl = h.levels[id] || 0;
  return `<span class="st-weap-ico cap-${id}">${MARK(id)}</span>` +
    `<span class="st-weap-lv"><b>${esc(CAP_NAME[id])}</b><span>Lv${lvl} · T${h.tier}</span></span>`;
}
function railHTML(levels) {
  const ids = WEAPON_ORDER.filter(id => (levels[id] || 0) > 0);
  if (!ids.length) return '';
  return ids.map(id => {
    const lv = levels[id] || 0, max = WEAPONS[id].max;
    const dots = Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
    return `<span class="st-rail-item cap-${id}" title="${esc(CAP_NAME[id])} - ${esc(t('dim.' + id))}">
      <span class="st-rail-ico">${MARK(id)}</span><span class="st-rail-dots">${dots}</span></span>`;
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
      <span class="st-card-ico">${MARK(id)}</span>
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
      <div class="vc-cx-h"><span class="st-cx-ico">${MARK(id)}</span><b>${esc(name)}</b><span class="st-cx-dim">${esc(t('dim.' + id))}</span></div>
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
  el.abil.innerHTML = '';
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
  el.weap.innerHTML = ''; el.rail.innerHTML = ''; el.abil.innerHTML = '';
  el.time.textContent = '0s'; el.combo.textContent = 'x1'; el.combo.classList.remove('on');
}

function play() {
  const name = (document.getElementById('nameIn')?.value || '').trim();
  if (name) saveName(name);
  resumeAudio();
  el.overlay.innerHTML = '';
  phase = 'play';
  buildAbilBar();
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

const ABIL_HOTKEY = { q: 'ir', e: 'pt', r: 'rt' };
window.addEventListener('keydown', e => {
  if (phase === 'levelup' && '123'.includes(e.key)) {
    const cards = document.querySelectorAll('#stLevelUp .st-card');
    const card = cards[+e.key - 1]; if (card) { e.preventDefault(); chooseUpgrade(card.dataset.up); }
  } else if (phase === 'play' && ABIL_HOTKEY[e.key?.toLowerCase()]) {
    e.preventDefault(); game.useAbility(ABIL_HOTKEY[e.key.toLowerCase()]);
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
