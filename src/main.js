// App controller — screens, timer, event wiring. Keeps the engine pure; this file
// owns the DOM and the tick timer.

import { t, loc, setLang, getLang } from './i18n.js';
import { PRODUCTS, PRODUCT_ORDER } from './data/products.js';
import { LEVEL1 } from './data/level1.js';
import { Game } from './game/engine.js';
import { getHint } from './game/sophia.js';
import { icon } from './ui/icons.js';
import { deployPanel, building, clueFeed, responses } from './ui/render.js';

const root = document.getElementById('app');
let game = null;
let timer = null;
let placing = null;               // product id being placed, or null
let sophia = { id: 'intro', expanded: false };

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = sel => root.querySelector(sel);

// Original placeholder wordmark (clearly our art; official logo swaps in later).
function brandMark() {
  return `<span class="brand">
    <span class="brand-glyph">${icon('sophia')}</span>
    <span class="brand-word">SANGFOR</span>
    <span class="brand-badge" title="${t('badge.placeholder')}">${t('badge.placeholder')}</span>
  </span>`;
}

function langToggle() {
  return `<button class="btn ghost" data-lang="1" title="language">${t('lang.toggle')}</button>`;
}

// ---------------- Start screen ----------------
function renderStart() {
  stopTimer();
  root.innerHTML = `
    <div class="screen start">
      <div class="start-top">${brandMark()}${langToggle()}</div>
      <div class="start-hero">
        <div class="hero-title"><span class="t1">${t('game.title')}</span><span class="t2">${t('game.subtitle')}</span></div>
        <p class="hero-byline">${t('game.byline')}</p>
        <p class="hero-tagline">${t('start.tagline')}</p>
        <ul class="hero-brief">
          <li>${t('start.brief1')}</li>
          <li>${t('start.brief2')}</li>
          <li>${t('start.brief3')}</li>
        </ul>
        <button class="btn primary big" data-start="1">${t('start.play')} →</button>
      </div>
      ${sophiaDock(getHint('intro'), false, t('sophia.greet'))}
    </div>`;
  $('[data-start]').onclick = startGame;
  $('[data-lang]').onclick = toggleLang;
  wireSophia();
}

// ---------------- Play screen ----------------
function startGame() {
  game = new Game(LEVEL1);
  placing = null;
  sophia = { id: null, expanded: false };
  game.on('change', updatePlay)
      .on('sophia', ({ id }) => showSophia(id))
      .on('toast', showToast)
      .on('end', onEnd);
  renderPlaySkeleton();
  game.start();
  startTimer();
  updatePlay();
}

function renderPlaySkeleton() {
  stopTimer();
  root.innerHTML = `
    <div class="screen play">
      <header class="topbar">
        <div class="tb-left">${brandMark()}</div>
        <div class="tb-hud" id="hud"></div>
        <div class="tb-right" id="controls"></div>
      </header>
      <main class="stage">
        <section class="col col-left"><div id="deploy"></div></section>
        <section class="col col-center"><div id="buildingWrap"></div></section>
        <section class="col col-right">
          <h2 class="panel-title">${t('clue.feed')}</h2>
          <div id="feed" class="feed"></div>
          <h2 class="panel-title">${t('panel.response')}</h2>
          <div id="resp" class="resp"></div>
        </section>
      </main>
      <div id="sophiaDock"></div>
      <div id="toasts" class="toasts"></div>
    </div>`;
  wirePlayEvents();
}

function hud() {
  const pct = Math.min(100, (game.time / game.level.duration) * 100);
  const bar = (label, val, cls) => `
    <div class="meter ${cls}">
      <div class="meter-top"><span>${label}</span><span>${Math.round(val)}%</span></div>
      <div class="meter-bar"><i style="width:${Math.max(0, Math.min(100, val))}%"></i></div>
    </div>`;
  return `
    <div class="hud-time">
      <div class="meter-top"><span>${esc(loc(game.level.name))}</span><span>${Math.ceil(game.time)}s / ${game.level.duration}s</span></div>
      <div class="meter-bar time"><i style="width:${pct}%"></i></div>
    </div>
    ${bar(t('hud.uptime'), game.uptime, 'up')}
    ${bar(t('hud.data'), game.data, 'data')}
    <div class="hud-budget"><span>${t('hud.budget')}</span><b>${game.budget}</b><span>${t('hud.credits')}</span></div>`;
}

function controls() {
  const sp = s => `<button class="btn chip ${game.speed === s ? 'on' : ''}" data-speed="${s}">${s}×</button>`;
  return `
    <button class="btn ghost" data-pause="1">${game.running ? t('hud.pause') : t('hud.resume')}</button>
    <span class="speed">${t('hud.speed')}: ${sp(1)}${sp(2)}${sp(4)}</span>
    ${langToggle()}`;
}

function updatePlay() {
  if (!game || game.ended) return;
  game._placingEligible = placing ? new Set(game.eligibleTargets(placing)) : null;
  $('#hud').innerHTML = hud();
  $('#controls').innerHTML = controls();
  $('#deploy').innerHTML = deployPanel(game, placing);
  $('#buildingWrap').innerHTML = building(game);
  $('#feed').innerHTML = clueFeed(game);
  $('#resp').innerHTML = responses(game);
}

function wirePlayEvents() {
  root.addEventListener('click', (e) => {
    const target = e.target.closest('[data-product],[data-cancel],[data-room],[data-slot-target],[data-isolate],[data-recover],[data-pause],[data-speed],[data-lang],[data-sophia-ask],[data-sophia-more],[data-sophia-close]');
    if (!target || !game) return;

    if (target.dataset.lang) return toggleLang();
    if (target.dataset.pause) { game.running ? game.pause() : game.resume(); return updatePlay(); }
    if (target.dataset.speed) { game.setSpeed(Number(target.dataset.speed)); return updatePlay(); }

    if (target.dataset.product) {
      const id = target.dataset.product;
      if (target.disabled) return;
      placing = (placing === id) ? null : id;
      return updatePlay();
    }
    if (target.dataset.cancel) { placing = null; return updatePlay(); }

    // placement target
    const slotTarget = target.dataset.slotTarget;
    const roomTarget = target.closest('[data-room]')?.dataset.room;
    const tgt = slotTarget || roomTarget;
    if (placing && tgt) {
      const res = game.deploy(placing, tgt);
      if (res.ok) placing = null;
      return updatePlay();
    }

    if (target.dataset.isolate) { game.isolate(target.dataset.isolate); return; }
    if (target.dataset.recover) { game.recover(target.dataset.recover); return; }

    if (target.dataset.sophiaAsk !== undefined) { sophia.expanded = false; return reflowSophia(); }
    if (target.dataset.sophiaMore !== undefined) { sophia.expanded = true; return reflowSophia(); }
    if (target.dataset.sophiaClose !== undefined) { $('#sophiaDock').classList.add('min'); return; }
  });
}

// ---------------- Sophia ----------------
function sophiaDock(hint, expanded, greetOverride) {
  const name = t('sophia.name'), roleTxt = t('sophia.role');
  const body = greetOverride || (hint ? (expanded ? loc(hint.more) : loc(hint.dir)) : '');
  const moreBtn = (hint && !expanded && !greetOverride) ? `<button class="linklike" data-sophia-more>${t('sophia.more')} ↓</button>` : '';
  return `
    <div class="sophia" id="sophiaCard">
      <div class="sophia-avatar">${icon('sophia')}</div>
      <div class="sophia-text">
        <div class="sophia-name">${name} <span>· ${roleTxt}</span></div>
        <div class="sophia-body">${esc(body)}</div>
        <div class="sophia-actions">${moreBtn}</div>
      </div>
    </div>`;
}

function showSophia(id) {
  const hint = getHint(id);
  if (!hint) return;
  sophia = { id, expanded: false };
  reflowSophia();
  const dock = $('#sophiaDock'); if (dock) { dock.classList.remove('min'); dock.classList.add('pulse'); setTimeout(() => dock.classList.remove('pulse'), 1200); }
}

function reflowSophia() {
  const dock = $('#sophiaDock'); if (!dock) return;
  const hint = sophia.id ? getHint(sophia.id) : null;
  dock.innerHTML = sophiaDock(hint, sophia.expanded, sophia.id ? null : t('sophia.greet'));
}

function wireSophia() { /* start-screen sophia is static greet; clicks handled by delegation when in play */ }

// ---------------- Toasts ----------------
function showToast(p) {
  const box = $('#toasts'); if (!box) return;
  const txt = p.clue ? t('clue.' + p.clue) : t(p.key || '');
  const node = document.createElement('div');
  node.className = `toast ${p.kind || 'info'}`;
  node.innerHTML = p.clue ? `<span class="toast-icon ev-${p.clue}">${icon(p.clue)}</span> ${esc(txt)}` : esc(txt);
  box.appendChild(node);
  setTimeout(() => node.classList.add('in'), 10);
  setTimeout(() => { node.classList.remove('in'); setTimeout(() => node.remove(), 300); }, 2600);
}

// ---------------- End / replay ----------------
function onEnd({ result, score }) {
  stopTimer();
  const win = result === 'win';
  const rooms = new Map(game.level.rooms.map(r => [r.id, loc(r.name)]));
  const locName = n => rooms.get(n) || (n === 'perimeter' ? loc(game.level.slots[0].name) : n);

  const attacks = game.log.filter(l => l.kind === 'attack');
  const timeline = attacks.map(a => {
    const step = game.level.plan.find(s => s.act === a.act && s.node === a.node);
    const truth = step ? loc(step.truth) : a.act;
    let status, cls;
    if (a.blocked) { status = t('end.blocked'); cls = 'good'; }
    else if (a.prevented) { status = t('resp.contained'); cls = 'good'; }
    else if (a.visible) { status = t('end.detected'); cls = 'seen'; }
    else { status = t('end.missed'); cls = 'bad'; }
    return `<li class="tl-row ${cls}">
      <span class="tl-time">${Math.round(a.t)}s</span>
      <span class="tl-ev ev-${a.ev}">${icon(a.ev)}</span>
      <span class="tl-truth">${esc(truth)} <em>· ${esc(locName(a.node))}</em></span>
      <span class="tl-status ${cls}">${status}</span>
    </li>`;
  }).join('');

  const detected = attacks.filter(a => a.visible || a.blocked || a.prevented).length;
  const summary = win
    ? (game.attacker.contained ? t('resp.contained') : t('end.win.msg'))
    : (result === 'lose-breach' ? t('end.lose.breach') : t('end.lose.uptime'));

  root.innerHTML = `
    <div class="screen end ${win ? 'win' : 'lose'}">
      <div class="start-top">${brandMark()}${langToggle()}</div>
      <div class="end-head">
        <div class="end-badge">${win ? icon('check') : icon('attacker')}</div>
        <h1>${win ? t('end.win.title') : t('end.lose.title')}</h1>
        <p>${esc(summary)}</p>
        <div class="end-stats">
          <div><b>${score}</b><span>${t('end.score')}</span></div>
          <div><b>${Math.round(game.uptime)}%</b><span>${t('hud.uptime')}</span></div>
          <div><b>${Math.round(game.data)}%</b><span>${t('hud.data')}</span></div>
          <div><b>${detected}/${attacks.length}</b><span>${t('end.detected')}</span></div>
        </div>
      </div>
      <div class="replay">
        <h2>${t('end.replay')}</h2>
        <p class="replay-sub">${t('end.replay.sub')}</p>
        <ol class="timeline">${timeline}</ol>
      </div>
      <button class="btn primary big" data-again="1">${t('end.again')}</button>
    </div>`;
  $('[data-again]').onclick = renderStart;
  $('[data-lang]').onclick = toggleLang;
}

// ---------------- misc ----------------
function toggleLang() {
  setLang(getLang() === 'en' ? 'zh' : 'en');
  if (game && !game.ended) { renderPlaySkeleton(); updatePlay(); reflowSophia(); }
  else if (game && game.ended) onEnd({ result: game.ended, score: game.score });
  else renderStart();
}

function startTimer() { stopTimer(); timer = setInterval(() => { if (game && game.running) game.tick(0.1); }, 100); }
function stopTimer() { if (timer) clearInterval(timer); timer = null; }

// boot
renderStart();

// expose for headless testing
window.__sentinel = { get game() { return game; }, startGame, renderStart };
