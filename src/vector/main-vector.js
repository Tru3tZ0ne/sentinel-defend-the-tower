// Threat Vector orchestrator: canvas wiring, HUD (hull / score / loadout), the
// product-pickup callouts that teach what each item does, leaderboard, a Codex
// that pairs every product's REAL job with the boost it grants, and EN/中文.

import { createVectorGame } from './engine.js';
import { CAPS, CAP_ORDER, START_HULL } from './model.js';
import { PRODUCTS } from '../data/products.js';
import { makeI18n } from '../arcade/i18n.js';
import { makeBoard } from '../arcade/board.js';
import { brandHTML, boardListHTML, footerHTML, fmt, esc, painter } from '../arcade/ui-kit.js';
import { setMuted, isMuted, resumeAudio } from '../rush/audio.js';

// Short brand name + the in-game enhancement (kept faithful to the real function).
const CAP_NAME = {
  HCI: 'HCI Cloud', XDR: 'XDR', EDR: 'Endpoint Secure', NDR: 'Cyber Command / NDR', AF: 'NGAF',
  IAG: 'IAG Gateway', ASTOR: 'aStor', MDR: 'MDR', SASE: 'SASE / ZTNA',
};
const EN = {
  'vc.title': 'Threat Vector',
  'vc.tag': 'Monsters charge in from every side. Move to dodge and sweep them up - your defenses fire themselves. Every kill can drop a Sangfor product: grab it and it slots in, so you feel exactly what each one does. Survive, stack the platform, climb the board.',
  'vc.h1': 'Move with WASD / arrows, or drag anywhere. You never aim - your weapons auto-fire at the nearest threat.',
  'vc.h2': 'Kills drop glowing product tokens (gold cache = guaranteed). Touch one to deploy or upgrade it - instantly stronger.',
  'vc.h3': 'Each product boosts what it really does: HCI = fire rate, XDR = damage x your sensors, EDR = a defense aura, and so on. Zero hull ends the run.',
  'vc.hull': 'Hull',
  'vc.time': 'Time',
  'vc.codex': 'Product codex',
  'vc.loadout': 'Loadout',
  'vc.over': 'Hull breached',
  'vc.overSub': 'You held for {s}s, cleared {k} threats, and ran a {n}-product stack.',
  'vc.kills': 'Threats cleared',
  'vc.streak': 'Best streak',
  'vc.held': 'Survived',
  'vc.real': 'Real job',
  'vc.boost': 'In the game',
  'vc.limit': 'Limitation',
  'vc.codexSub': 'Every product boosts exactly what it really does. That is the whole point - grab one mid-fight and you feel its real job.',
  'vc.none': 'No products yet',
  // pickup callouts (the teaching beat) — {n} = brand, {l} = level
  'fx.HCI': 'Elastic compute online - rate of fire up',
  'fx.XDR': 'Correlation - damage scales with your sensors',
  'fx.EDR': 'Endpoint response - a defense aura zaps what gets close',
  'fx.NDR': 'Network visibility - cloaked APTs revealed, shots chain',
  'fx.AF': 'Perimeter firewall - extra forward bolts',
  'fx.IAG': 'Egress control - exfil drones cannot escape',
  'fx.ASTOR': 'Snapshots ready - restores hull when you are hit',
  'fx.MDR': 'Managed SOC - a wingman drone fights alongside you',
  'fx.SASE': 'Zero-trust edge - the attack surface shrinks',
  'fx.xdrIdle': 'XDR has no sensors to correlate yet - grab EDR / NDR / AF',
  't.boss': 'Ransomware brute inbound',
  't.restore': 'aStor restored your hull',
  't.exfilEscaped': 'Data exfiltrated! An exfil drone escaped',
  'g.en': 'Elastic, pooled cloud compute (HCI) - raw capacity and throughput for everything you run.',
  'g.sase': 'Secure Access Service Edge / Zero Trust - verifies every connection and shrinks what is even reachable.',
  'b.HCI': 'More compute = more cycles, so your weapons fire faster.',
  'b.XDR': 'A force multiplier: damage rises with how many sensors (EDR/NDR/AF) feed it.',
  'b.EDR': 'Auto-response on your ship (the endpoint): a close-range aura.',
  'b.NDR': 'East-west visibility: reveals cloaked APTs and makes shots chain across the network.',
  'b.AF': 'Perimeter screening: adds forward firewall bolts.',
  'b.IAG': 'Watches the exit: exfil drones can no longer leave with your data.',
  'b.ASTOR': 'Prepared snapshots: restore hull the moment you take a real hit.',
  'b.MDR': 'A managed analyst at your side: an autonomous wingman drone.',
  'b.SASE': 'Less attack surface: fewer threats spawn at all.',
  'l.HCI': 'Capacity, not security on its own - it makes everything else run harder.',
  'l.SASE': 'Controls access and reach - it is not the sensor that catches the intrusion.',
};
const ZH = {
  'vc.title': '威胁向量',
  'vc.tag': '怪物从四面八方冲来。移动躲避并收割它们——你的防御会自动开火。每次击杀都可能掉落一件深信服产品：捡起即装备，让你立刻感受到它的作用。活下去，叠满平台，冲上排行榜。',
  'vc.h1': '用 WASD / 方向键移动，或在任意位置拖动。你无需瞄准——武器会自动射击最近的威胁。',
  'vc.h2': '击杀会掉落发光的产品令牌（金色宝箱必掉）。碰到即可部署或升级——立即变强。',
  'vc.h3': '每件产品增强的正是它的真实功能：HCI=射速，XDR=伤害×你的传感器，EDR=防御光环，以此类推。护甲归零即结束。',
  'vc.hull': '护甲',
  'vc.time': '时间',
  'vc.codex': '产品图鉴',
  'vc.loadout': '配装',
  'vc.over': '护甲被击穿',
  'vc.overSub': '你坚持了 {s} 秒，清除 {k} 个威胁，装配了 {n} 件产品。',
  'vc.kills': '清除威胁',
  'vc.streak': '最高连击',
  'vc.held': '存活',
  'vc.real': '真实职责',
  'vc.boost': '游戏中',
  'vc.limit': '局限',
  'vc.codexSub': '每件产品增强的正是它在现实中的功能——这正是重点：战斗中捡起一件，就能直接感受到它的真实职责。',
  'vc.none': '尚无产品',
  'fx.HCI': '弹性算力上线——射速提升',
  'fx.XDR': '关联分析——伤害随传感器数量提升',
  'fx.EDR': '终端响应——防御光环清除靠近的威胁',
  'fx.NDR': '网络可见性——隐身 APT 现形，射击可连锁',
  'fx.AF': '边界防火墙——增加前向火力',
  'fx.IAG': '出口管控——外泄无人机无法逃离',
  'fx.ASTOR': '快照就绪——受击时恢复护甲',
  'fx.MDR': '托管 SOC——僚机无人机与你并肩作战',
  'fx.SASE': '零信任边缘——攻击面缩小',
  'fx.xdrIdle': 'XDR 还没有可关联的传感器——去捡 EDR / NDR / AF',
  't.boss': '勒索软件巨兽来袭',
  't.restore': 'aStor 已恢复你的护甲',
  't.exfilEscaped': '数据被窃取！一架外泄无人机逃脱了',
  'g.en': '弹性、池化的云计算（HCI）——为你运行的一切提供算力与吞吐。',
  'g.sase': '安全访问服务边缘 / 零信任——校验每一次连接，并缩小可被触达的范围。',
  'b.HCI': '算力越强、周期越多，武器射速越快。',
  'b.XDR': '力量倍增器：伤害随喂给它的传感器（EDR/NDR/AF）数量上升。',
  'b.EDR': '在你的飞船（终端）上自动响应：近距离光环。',
  'b.NDR': '东西向可见性：让隐身 APT 现形，并让射击在网络中连锁。',
  'b.AF': '边界安检：增加前向防火墙火力。',
  'b.IAG': '守住出口：外泄无人机再也无法带走你的数据。',
  'b.ASTOR': '预置快照：受到真实打击的瞬间恢复护甲。',
  'b.MDR': '身边的托管分析师：一架自主僚机无人机。',
  'b.SASE': '更小的攻击面：从源头减少威胁生成。',
  'l.HCI': '它本身是算力而非安全——让其它一切跑得更猛。',
  'l.SASE': '它管的是访问与可达性——并非捕获入侵的那个传感器。',
};

const i18n = makeI18n(EN, ZH);
const { t } = i18n;
const lang = () => i18n.getLang();
const board = makeBoard({ lsKey: 'sentinel.vector.scores.v1', apiVar: '__VECTOR_API' });
const NAME_KEY = 'sentinel.arcade.name';
const BEST_KEY = 'sentinel.vector.best';
const getName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
const saveName = n => { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } };
const getBest = () => { try { return +localStorage.getItem(BEST_KEY) || 0; } catch { return 0; } };
const saveBest = b => { try { localStorage.setItem(BEST_KEY, String(b)); } catch { /* ignore */ } };

const LINKS = [
  { href: 'soc.html', label: 'Incident Zero' },
  { href: 'rush.html', label: 'Breach Rush' },
  { href: 'index.html', label: 'Defend the Tower' },
];

const app = document.getElementById('app');
app.innerHTML = `
  <div class="ar-top">
    ${brandHTML('Threat Vector')}
    <div class="ar-stats">
      <div class="ar-combo" id="vcCombo">x1</div>
      <div class="ar-stat"><span class="k">${esc(t('vc.time'))}</span><span class="v" id="vcTime">0s</span></div>
      <div class="ar-stat"><span class="k">${esc(t('ui.score'))}</span><span class="v good" id="vcScore">0</span></div>
      <div class="ar-stat"><span class="k">${esc(t('ui.best'))}</span><span class="v" id="vcBest">0</span></div>
    </div>
  </div>
  <div class="ar-field">
    <canvas id="vcCanvas"></canvas>
    <div class="vc-hud" id="vcHud">
      <div class="vc-hull"><i id="vcHullFill"></i><span id="vcHullTxt"></span></div>
      <div class="vc-astor" id="vcAstor"></div>
    </div>
    <div class="vc-loadout" id="vcLoadout"></div>
  </div>
  <div class="ar-toasts" id="vcToasts"></div>
  <div id="vcOverlay"></div>
`;

const el = {
  canvas: document.getElementById('vcCanvas'),
  combo: document.getElementById('vcCombo'),
  time: document.getElementById('vcTime'),
  score: document.getElementById('vcScore'),
  best: document.getElementById('vcBest'),
  hud: document.getElementById('vcHud'),
  hullFill: document.getElementById('vcHullFill'),
  hullTxt: document.getElementById('vcHullTxt'),
  astor: document.getElementById('vcAstor'),
  loadout: document.getElementById('vcLoadout'),
  toasts: document.getElementById('vcToasts'),
  overlay: document.getElementById('vcOverlay'),
};
const paintScore = painter();
const paintLoadout = painter();
let phase = 'start', lastSummary = null, lastResult = null;

const game = createVectorGame(el.canvas, {
  onHud: h => {
    paintScore(el.score, fmt(h.score));
    el.best.textContent = fmt(Math.max(h.best, getBest()));
    el.time.textContent = h.elapsed + 's';
    el.combo.textContent = 'x' + h.mult;
    el.combo.classList.toggle('on', h.combo >= 8);
    const f = Math.max(0, Math.min(100, h.hull / START_HULL * 100));
    el.hullFill.style.width = f + '%';
    el.hullFill.className = f > 50 ? 'ok' : f > 25 ? 'warn' : 'bad';
    el.hullTxt.textContent = h.hull;
    el.astor.innerHTML = h.astor ? Array.from({ length: h.astor.max }, (_, i) =>
      `<span class="vc-snap${i < h.astor.charge ? '' : ' out'}"></span>`).join('') : '';
    paintLoadout(el.loadout, loadoutHTML(h.owned, h));
  },
  onToast: (key, kind) => toast(t('t.' + key), kind),
  onPickup: (cap, level, stats) => {
    toast(`${CAP_NAME[cap]} Lv${level} · ${t('fx.' + cap)}`, 'good');
    if (cap === 'XDR' && stats.sensors === 0) setTimeout(() => toast(t('fx.xdrIdle'), 'bad'), 350);
  },
  onOver: summary => onGameOver(summary),
});

function loadoutHTML(owned, h) {
  const ids = CAP_ORDER.filter(id => (owned[id] || 0) > 0);
  if (!ids.length) return `<span class="vc-lo-empty">${esc(t('vc.none'))}</span>`;
  return ids.map(id => {
    const lv = owned[id];
    const dots = Array.from({ length: CAPS[id].max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
    const idle = id === 'XDR' && (h?.sensors ?? 1) === 0 ? ' idle' : '';
    return `<span class="vc-lo cap-${id}${idle}" title="${esc(CAP_NAME[id])}"><b>${esc(id === 'ASTOR' ? 'aStor' : id)}</b><span class="vc-lo-dots">${dots}</span></span>`;
  }).join('');
}

function toast(msg, kind = '') {
  const n = document.createElement('div');
  n.className = `ar-toast ${kind}`.trim();
  n.textContent = msg;
  el.toasts.appendChild(n);
  setTimeout(() => n.remove(), 1400);
  while (el.toasts.children.length > 4) el.toasts.firstChild.remove();
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
        ${brandHTML('Threat Vector')}
        <h1 class="ar-title">Threat <span class="em">Vector</span></h1>
        <p class="ar-tag">${esc(t('vc.tag'))}</p>
        <p class="ar-field-label">${esc(t('ui.name'))}</p>
        <input class="ar-name" id="nameIn" maxlength="14" placeholder="${esc(t('ui.namePh'))}" value="${esc(getName())}" />
        <ol class="ar-how">
          <li><span class="n">1</span><span>${esc(t('vc.h1'))}</span></li>
          <li><span class="n">2</span><span>${esc(t('vc.h2'))}</span></li>
          <li><span class="n">3</span><span>${esc(t('vc.h3'))}</span></li>
        </ol>
        <div class="ar-row">
          <button class="btn ghost" data-act="codex">${esc(t('vc.codex'))}</button>
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
  return CAP_ORDER.map(id => {
    const p = PRODUCTS[id];
    const real = p ? p.capability[L] : t('g.' + (id === 'HCI' ? 'en' : 'sase'));
    const lim = p ? p.limitation[L] : t('l.' + id);
    const name = p ? p.shortName : CAP_NAME[id];
    return `<div class="vc-cx cap-${id}">
      <div class="vc-cx-h"><span class="vc-cx-dot"></span><b>${esc(name)}</b></div>
      <div class="vc-cx-row"><span class="vc-cx-k">${esc(t('vc.real'))}</span><span>${esc(real)}</span></div>
      <div class="vc-cx-row boost"><span class="vc-cx-k">${esc(t('vc.boost'))}</span><span>${esc(t('b.' + id))}</span></div>
      <div class="vc-cx-row lim"><span class="vc-cx-k">${esc(t('vc.limit'))}</span><span>${esc(lim)}</span></div>
    </div>`;
  }).join('');
}
function showCodex() {
  el.overlay.insertAdjacentHTML('beforeend', `
    <div class="ar-overlay" id="vcCodex">
      <div class="ar-card wide">
        ${brandHTML('Product codex')}
        <h1 class="ar-title" style="font-size:22px">${esc(t('vc.codex'))}</h1>
        <p class="ar-tag" style="margin-bottom:12px">${esc(t('vc.codexSub'))}</p>
        <div class="vc-cx-list">${codexRows()}</div>
        <button class="btn primary block" data-act="closeCodex" style="margin-top:14px">${esc(t('ui.back'))}</button>
      </div>
    </div>`);
}

async function onGameOver(summary) {
  phase = 'over'; lastSummary = summary; lastResult = null;
  if (summary.best > getBest()) saveBest(summary.best);
  renderOver(summary, null);
  const n = Object.keys(summary.owned).length;
  const result = await board.submitScore({ name: getName() || 'Anonymous', score: summary.score, note: `${summary.elapsed}s · ${n} products` });
  lastResult = result;
  renderOver(summary, result);
}

function renderOver(summary, result) {
  const meId = result?.id;
  const n = Object.keys(summary.owned).length;
  el.overlay.innerHTML = `
    <div class="ar-overlay">
      <div class="ar-card">
        ${brandHTML('Threat Vector')}
        <h1 class="ar-title" style="font-size:22px">${esc(t('vc.over'))}</h1>
        <div class="ar-result">
          <div class="lbl">${esc(t('ui.score'))}</div>
          <div class="big">${fmt(summary.score)}</div>
          <div class="sub">${esc(t('vc.overSub', { s: summary.elapsed, k: summary.kills, n }))}</div>
          ${result ? `<div class="sub">${esc(t('ui.youRank'))}<span class="hot">${result.rank}</span> · ${esc(result.mode === 'world' ? t('ui.world') : t('ui.local'))}</div>` : ''}
        </div>
        <div class="vc-lo-final">${loadoutHTML(summary.owned, { sensors: 1 })}</div>
        <div class="ar-meta">
          <div class="m"><span class="k">${esc(t('vc.kills'))}</span><span class="v">${fmt(summary.kills)}</span></div>
          <div class="m"><span class="k">${esc(t('vc.streak'))}</span><span class="v">${summary.maxCombo}</span></div>
          <div class="m"><span class="k">${esc(t('vc.held'))}</span><span class="v">${summary.elapsed}s</span></div>
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
  el.hullFill.style.width = '100%'; el.hullFill.className = 'ok'; el.hullTxt.textContent = START_HULL;
  el.astor.innerHTML = ''; el.loadout.innerHTML = `<span class="vc-lo-empty">${esc(t('vc.none'))}</span>`;
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
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'play' || act === 'again') play();
  else if (act === 'quit') showStart();
  else if (act === 'codex') showCodex();
  else if (act === 'closeCodex') { const c = document.getElementById('vcCodex'); if (c) c.remove(); }
  else if (act === 'lang') { i18n.toggleLang(); relabel(); rerender(); }
  else if (act === 'mute') { setMuted(!isMuted()); rerender(); }
  else if (act === 'share') shareResult(e.target);
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const c = document.getElementById('vcCodex'); if (c) c.remove(); }
});

async function shareResult(elm) {
  if (!lastSummary) return;
  const text = `Sentinel · Threat Vector — ${fmt(lastSummary.score)} pts, survived ${lastSummary.elapsed}s`;
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  const old = elm.textContent; elm.textContent = t('ui.copied');
  setTimeout(() => { elm.textContent = old; }, 1400);
}

function relabel() {
  const ks = document.querySelectorAll('.ar-stat .k');
  if (ks[0]) ks[0].textContent = t('vc.time');
  if (ks[1]) ks[1].textContent = t('ui.score');
  if (ks[2]) ks[2].textContent = t('ui.best');
}
function rerender() {
  if (phase === 'over' && lastSummary) renderOver(lastSummary, lastResult);
  else if (phase === 'start') showStart();
}

showStart();
window.__vector = { game, board, i18n };
