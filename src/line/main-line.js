// Breach Line orchestrator: the 3D-style seed bar (Sangfor product packets with
// their logos), compute economy HUD, wave readout, placement wiring, a Product
// Codex, leaderboard and EN/中文. The battlefield + FX live in engine.js.

import { createLineGame } from './engine.js';
import { PLANTS, PLANT_ORDER } from './model.js';
import { PRODUCTS } from '../data/products.js';
import { ICONS } from '../ui/icons.js';
import { makeI18n } from '../arcade/i18n.js';
import { makeBoard } from '../arcade/board.js';
import { brandHTML, boardListHTML, footerHTML, fmt, esc, painter } from '../arcade/ui-kit.js';
import { setMuted, isMuted, resumeAudio } from '../rush/audio.js';

const ICON_KEY = { HCI: 'network', AF: 'af', IAG: 'iag', NDR: 'ndr', EDR: 'edr', ASTOR: 'astor', XDR: 'xdr' };
const PLANT_NAME = { HCI: 'HCI Cloud', AF: 'NGAF', IAG: 'IAG', NDR: 'Cyber Command', EDR: 'Endpoint Secure', ASTOR: 'aStor', XDR: 'XDR Strike' };

const EN = {
  'ln.title': 'Breach Line',
  'ln.tag': 'Threats march down the lanes from the right. Spend compute to deploy Sangfor defenders in the grid - each fights exactly the way its product really works. Hold the line to the left; let one through and it is a breach.',
  'ln.h1': 'Pick a defender from the bar (it costs compute), then click a lane cell to deploy it. HCI generates the compute you spend.',
  'ln.h2': 'Each product does its real job: NGAF screens the lane, IAG slows traffic, Cyber Command (NDR) hits 3 lanes, EDR devours what gets close, aStor is a self-healing wall, XDR calls a correlation strike.',
  'ln.h3': 'APTs are stealthed - NGAF only half-sees them, but NDR and EDR hit them full. MDR is your managed last line: it saves each lane once. After that, a breach ends the run.',
  'ln.compute': 'Compute',
  'ln.wave': 'Wave',
  'ln.codex': 'Product codex',
  'ln.cost': 'cost',
  'ln.over': 'Line breached',
  'ln.overSub': 'You held {s}s to wave {w}, cleared {k} threats.',
  'ln.kills': 'Threats cleared',
  'ln.streak': 'Best streak',
  'ln.wreached': 'Wave reached',
  'ln.real': 'Real job',
  'ln.boost': 'On the board',
  'ln.limit': 'Limitation',
  'ln.codexSub': 'Every defender fights the way its product really works - that is how you learn the portfolio by playing.',
  // what each defender does on the board
  'b.HCI': 'Generates the compute you spend - your whole economy (cloud capacity).',
  'b.AF': 'A lane firewall: fires inline, screening inbound threats. Cheap workhorse.',
  'b.IAG': 'A gateway that slows every threat it hits - traffic throttled at the exit.',
  'b.NDR': 'Sees across the network: hits its lane plus both neighbours at once.',
  'b.EDR': 'Endpoint response: short range but devours whatever gets close.',
  'b.ASTOR': 'A hardened wall that heals itself from snapshots - soaks the lane.',
  'b.XDR': 'An instant correlation strike. Near-useless alone; its blast scales with how many sensors (NGAF/NDR/EDR) are on the board.',
  'g.HCI': 'Elastic, pooled cloud compute (HCI) - raw capacity for everything you run.',
  'l.HCI': 'Capacity, not security on its own - it powers the rest, it does not fight.',
  // toasts
  't.noCompute': 'Not enough compute',
  't.occupied': 'That cell is taken',
  't.boss': 'Ransomware brute inbound',
  't.wave': 'Wave {n}',
  't.mdr': 'MDR saved the lane!',
  't.exfil': 'Data exfiltrated!',
  't.xdrHit': 'XDR strike: {n} sensors -> {d} dmg',
  't.xdrEmpty': 'XDR had no sensors to correlate - weak strike',
};
const ZH = {
  'ln.title': '防线告急',
  'ln.tag': '威胁沿车道从右侧推进。消耗算力在网格中部署深信服防御单位——每个都按其产品的真实工作方式作战。守住左侧防线；放进一个即视为被攻破。',
  'ln.h1': '从卡槽选择一个防御单位（需消耗算力），然后点击车道格子部署。HCI 负责产出你消耗的算力。',
  'ln.h2': '每个产品各司其职：NGAF 车道安检、IAG 减速、Cyber Command（NDR）同时打 3 条车道、EDR 近身吞噬、aStor 自愈墙、XDR 呼叫关联打击。',
  'ln.h3': 'APT 处于隐身——NGAF 只能看清一半，而 NDR 与 EDR 可全额命中。MDR 是你的托管最后防线：每条车道拯救一次。此后再被突破即结束。',
  'ln.compute': '算力',
  'ln.wave': '波次',
  'ln.codex': '产品图鉴',
  'ln.cost': '消耗',
  'ln.over': '防线被突破',
  'ln.overSub': '你坚持了 {s} 秒，推进到第 {w} 波，清除 {k} 个威胁。',
  'ln.kills': '清除威胁',
  'ln.streak': '最高连击',
  'ln.wreached': '到达波次',
  'ln.real': '真实职责',
  'ln.boost': '在棋盘上',
  'ln.limit': '局限',
  'ln.codexSub': '每个防御单位都按其产品的真实工作方式作战——在游玩中掌握整个产品矩阵。',
  'b.HCI': '产出你消耗的算力——你的整个经济（云端算力）。',
  'b.AF': '车道防火墙：内联开火，安检入站威胁。廉价主力。',
  'b.IAG': '减速网关：命中的每个威胁都会被放慢——在出口对流量限速。',
  'b.NDR': '纵览全网：同时打击本车道及上下相邻车道。',
  'b.EDR': '终端响应：射程短，但能吞噬任何靠近者。',
  'b.ASTOR': '可自愈的加固墙——靠快照恢复，吸收整条车道的压力。',
  'b.XDR': '瞬发关联打击。单独几乎无用；爆发威力随棋盘上传感器（NGAF/NDR/EDR）数量提升。',
  'g.HCI': '弹性、池化的云计算（HCI）——为你运行的一切提供算力。',
  'l.HCI': '它是算力而非安全本身——为其余单位供能，自己并不作战。',
  't.noCompute': '算力不足',
  't.occupied': '该格已被占用',
  't.boss': '勒索软件巨兽来袭',
  't.wave': '第 {n} 波',
  't.mdr': 'MDR 拯救了车道！',
  't.exfil': '数据被窃取！',
  't.xdrHit': 'XDR 打击：{n} 个传感器 -> {d} 伤害',
  't.xdrEmpty': 'XDR 没有可关联的传感器——打击微弱',
};

const i18n = makeI18n(EN, ZH);
const { t } = i18n;
const lang = () => i18n.getLang();
const board = makeBoard({ lsKey: 'sentinel.line.scores.v1', apiVar: '__LINE_API' });
const NAME_KEY = 'sentinel.arcade.name';
const BEST_KEY = 'sentinel.line.best';
const getName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
const saveName = n => { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } };
const getBest = () => { try { return +localStorage.getItem(BEST_KEY) || 0; } catch { return 0; } };
const saveBest = b => { try { localStorage.setItem(BEST_KEY, String(b)); } catch { /* ignore */ } };

const LINKS = [
  { href: 'vector.html', label: 'Threat Vector' },
  { href: 'soc.html', label: 'Incident Zero' },
  { href: 'rush.html', label: 'Breach Rush' },
];

const app = document.getElementById('app');
app.innerHTML = `
  <div class="ar-top">
    ${brandHTML('Breach Line')}
    <div class="ar-stats">
      <div class="ar-combo" id="lnCombo">x1</div>
      <div class="ar-stat"><span class="k">${esc(t('ln.wave'))}</span><span class="v" id="lnWave">1</span></div>
      <div class="ar-stat"><span class="k">${esc(t('ui.score'))}</span><span class="v good" id="lnScore">0</span></div>
      <div class="ar-stat"><span class="k">${esc(t('ui.best'))}</span><span class="v" id="lnBest">0</span></div>
    </div>
  </div>
  <div class="ln-bar" id="lnBar">
    <div class="ln-compute"><span class="ln-cp-ic">${ICONS.network}</span><span id="lnCompute">0</span></div>
    <div class="ln-packets" id="lnPackets"></div>
  </div>
  <div class="ar-field"><canvas id="lnCanvas"></canvas></div>
  <div class="ar-toasts" id="lnToasts"></div>
  <div id="lnOverlay"></div>
`;

const el = {
  canvas: document.getElementById('lnCanvas'),
  combo: document.getElementById('lnCombo'),
  wave: document.getElementById('lnWave'),
  score: document.getElementById('lnScore'),
  best: document.getElementById('lnBest'),
  compute: document.getElementById('lnCompute'),
  packets: document.getElementById('lnPackets'),
  toasts: document.getElementById('lnToasts'),
  overlay: document.getElementById('lnOverlay'),
};
const paintScore = painter();
let phase = 'start', lastSummary = null, lastResult = null;
const cooldownUntil = {};   // packet id -> ms timestamp

el.packets.innerHTML = PLANT_ORDER.map(id => {
  const p = PLANTS[id];
  return `<button class="ln-pk cap-${id}" data-plant="${id}" title="${esc(PLANT_NAME[id])}">
    <span class="ln-pk-ic">${ICONS[ICON_KEY[id]]}</span>
    <span class="ln-pk-name">${esc(id === 'ASTOR' ? 'aStor' : id)}</span>
    <span class="ln-pk-cost">${p.cost}</span>
    <i class="ln-pk-cd" data-cd="${id}"></i>
  </button>`;
}).join('');

const game = createLineGame(el.canvas, {
  onHud: h => {
    paintScore(el.score, fmt(h.score));
    el.best.textContent = fmt(Math.max(h.best, getBest()));
    el.wave.textContent = h.wave;
    el.compute.textContent = fmt(h.compute);
    el.combo.textContent = 'x' + h.mult;
    el.combo.classList.toggle('on', h.combo >= 8);
    updatePackets(h.compute);
  },
  onToast: (key, kind, vars) => toast(t('t.' + key, vars), kind),
  onPlaced: id => { cooldownUntil[id] = performance.now() + PLANTS[id].cd; syncSelected(); },
  onOver: summary => onGameOver(summary),
});

function updatePackets(compute) {
  const now = performance.now();
  for (const id of PLANT_ORDER) {
    const btn = el.packets.querySelector(`[data-plant="${id}"]`);
    const cd = el.packets.querySelector(`[data-cd="${id}"]`);
    const cdLeft = (cooldownUntil[id] || 0) - now;
    const onCd = cdLeft > 0;
    const poor = compute < PLANTS[id].cost;
    btn.classList.toggle('poor', poor && !onCd);
    btn.classList.toggle('cooling', onCd);
    btn.classList.toggle('sel', game.selected === id);
    cd.style.transform = onCd ? `scaleY(${Math.min(1, cdLeft / PLANTS[id].cd)})` : 'scaleY(0)';
  }
}
function syncSelected() { updatePackets(game.state ? game.state.compute : 0); }

function selectPlant(id) {
  const now = performance.now();
  if ((cooldownUntil[id] || 0) > now) return;
  if (!game.canAfford(id)) { toast(t('t.noCompute'), 'bad'); return; }
  game.select(id); syncSelected();
}

function toast(msg, kind = '') {
  const n = document.createElement('div');
  n.className = `ar-toast ${kind}`.trim(); n.textContent = msg;
  el.toasts.appendChild(n); setTimeout(() => n.remove(), 1300);
  while (el.toasts.children.length > 4) el.toasts.firstChild.remove();
}

// ---------- screens ----------
async function showStart() {
  phase = 'start'; game.stop();
  const b = await board.fetchBoard();
  el.best.textContent = fmt(getBest()); el.compute.textContent = '0'; el.wave.textContent = '1';
  el.overlay.innerHTML = `
    <div class="ar-overlay">
      <div class="ar-card">
        ${brandHTML('Breach Line')}
        <h1 class="ar-title">Breach <span class="em">Line</span></h1>
        <p class="ar-tag">${esc(t('ln.tag'))}</p>
        <p class="ar-field-label">${esc(t('ui.name'))}</p>
        <input class="ar-name" id="nameIn" maxlength="14" placeholder="${esc(t('ui.namePh'))}" value="${esc(getName())}" />
        <ol class="ar-how">
          <li><span class="n">1</span><span>${esc(t('ln.h1'))}</span></li>
          <li><span class="n">2</span><span>${esc(t('ln.h2'))}</span></li>
          <li><span class="n">3</span><span>${esc(t('ln.h3'))}</span></li>
        </ol>
        <div class="ar-row">
          <button class="btn ghost" data-act="codex">${esc(t('ln.codex'))}</button>
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
  return PLANT_ORDER.map(id => {
    const p = PRODUCTS[id];
    const real = p ? p.capability[L] : t('g.' + id);
    const lim = p ? p.limitation[L] : t('l.' + id);
    const name = p ? p.shortName : PLANT_NAME[id];
    return `<div class="ln-cx cap-${id}">
      <div class="ln-cx-h"><span class="ln-cx-ic">${ICONS[ICON_KEY[id]]}</span><b>${esc(name)}</b><span class="ln-cx-cost">${PLANTS[id].cost}</span></div>
      <div class="ln-cx-row"><span class="ln-cx-k">${esc(t('ln.real'))}</span><span>${esc(real)}</span></div>
      <div class="ln-cx-row boost"><span class="ln-cx-k">${esc(t('ln.boost'))}</span><span>${esc(t('b.' + id))}</span></div>
      <div class="ln-cx-row lim"><span class="ln-cx-k">${esc(t('ln.limit'))}</span><span>${esc(lim)}</span></div>
    </div>`;
  }).join('');
}
function showCodex() {
  el.overlay.insertAdjacentHTML('beforeend', `
    <div class="ar-overlay" id="lnCodex">
      <div class="ar-card wide">
        ${brandHTML('Product codex')}
        <h1 class="ar-title" style="font-size:22px">${esc(t('ln.codex'))}</h1>
        <p class="ar-tag" style="margin-bottom:12px">${esc(t('ln.codexSub'))}</p>
        <div class="ln-cx-list">${codexRows()}</div>
        <button class="btn primary block" data-act="closeCodex" style="margin-top:14px">${esc(t('ui.back'))}</button>
      </div>
    </div>`);
}

async function onGameOver(summary) {
  phase = 'over'; lastSummary = summary; lastResult = null;
  if (summary.best > getBest()) saveBest(summary.best);
  renderOver(summary, null);
  const result = await board.submitScore({ name: getName() || 'Anonymous', score: summary.score, note: `wave ${summary.wave} · ${summary.elapsed}s` });
  lastResult = result; renderOver(summary, result);
}

function renderOver(summary, result) {
  const meId = result?.id;
  el.overlay.innerHTML = `
    <div class="ar-overlay">
      <div class="ar-card">
        ${brandHTML('Breach Line')}
        <h1 class="ar-title" style="font-size:22px">${esc(t('ln.over'))}</h1>
        <div class="ar-result">
          <div class="lbl">${esc(t('ui.score'))}</div>
          <div class="big">${fmt(summary.score)}</div>
          <div class="sub">${esc(t('ln.overSub', { s: summary.elapsed, w: summary.wave, k: summary.kills }))}</div>
          ${result ? `<div class="sub">${esc(t('ui.youRank'))}<span class="hot">${result.rank}</span> · ${esc(result.mode === 'world' ? t('ui.world') : t('ui.local'))}</div>` : ''}
        </div>
        <div class="ar-meta">
          <div class="m"><span class="k">${esc(t('ln.kills'))}</span><span class="v">${fmt(summary.kills)}</span></div>
          <div class="m"><span class="k">${esc(t('ln.wreached'))}</span><span class="v">${summary.wave}</span></div>
          <div class="m"><span class="k">${esc(t('ln.streak'))}</span><span class="v">${summary.maxCombo}</span></div>
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

function play() {
  const name = (document.getElementById('nameIn')?.value || '').trim();
  if (name) saveName(name);
  resumeAudio();
  for (const k in cooldownUntil) delete cooldownUntil[k];
  el.overlay.innerHTML = ''; phase = 'play';
  game.start(getBest());
}

// ---------- events ----------
el.packets.addEventListener('click', e => {
  const id = e.target.closest('[data-plant]')?.dataset.plant;
  if (id && phase === 'play') selectPlant(id);
});
el.overlay.addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'play' || act === 'again') play();
  else if (act === 'quit') showStart();
  else if (act === 'codex') showCodex();
  else if (act === 'closeCodex') { document.getElementById('lnCodex')?.remove(); }
  else if (act === 'lang') { i18n.toggleLang(); relabel(); rerender(); }
  else if (act === 'mute') { setMuted(!isMuted()); rerender(); }
  else if (act === 'share') shareResult(e.target);
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { document.getElementById('lnCodex')?.remove(); if (game.selected) { game.select(game.selected); syncSelected(); } return; }
  if (phase !== 'play') return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= PLANT_ORDER.length) selectPlant(PLANT_ORDER[n - 1]);
});

async function shareResult(elm) {
  if (!lastSummary) return;
  const text = `Sentinel · Breach Line — ${fmt(lastSummary.score)} pts, wave ${lastSummary.wave}`;
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  const old = elm.textContent; elm.textContent = t('ui.copied'); setTimeout(() => { elm.textContent = old; }, 1400);
}

function relabel() {
  const ks = document.querySelectorAll('.ar-stat .k');
  if (ks[0]) ks[0].textContent = t('ln.wave');
  if (ks[1]) ks[1].textContent = t('ui.score');
  if (ks[2]) ks[2].textContent = t('ui.best');
}
function rerender() {
  if (phase === 'over' && lastSummary) renderOver(lastSummary, lastResult);
  else if (phase === 'start') showStart();
}

showStart();
window.__line = { game, board, i18n };
