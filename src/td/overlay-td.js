// HUD for "Kill Chain" tower-defense: top status bar (uptime / data / credits / wave +
// launch), bottom product deck (towers to place), right panel (incoming wave or the
// selected tower's upgrade/sell), start + end screens. Reuses the shared CSS vocabulary.
import { t, loc, getLang } from '../i18n.js';
import { PRODUCTS, PRODUCT_ORDER } from '../data/products.js';
import { productMark } from '../ui/product-marks.js';
import { TD_TOWERS, TD_ENEMIES } from './engine-td.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = v => Math.max(0, Math.min(100, Math.round(v)));

export function createTDOverlay(root, h) {
  root.innerHTML = `
    <header id="tdHud" class="hud td-hud hidden"></header>
    <div id="tdSide" class="td-side hidden"></div>
    <div id="tdDeck" class="dock td-deck hidden"></div>
    <div id="tdToasts" class="toasts"></div>
    <div id="tdStart" class="startScreen"></div>
    <div id="tdEnd" class="endScreen hidden"></div>`;
  const $ = s => root.querySelector(s);
  const els = { hud: $('#tdHud'), side: $('#tdSide'), deck: $('#tdDeck'), toasts: $('#tdToasts'), start: $('#tdStart'), end: $('#tdEnd') };
  const _cache = new WeakMap();
  const put = (el, html) => { if (_cache.get(el) === html) return; _cache.set(el, html); el.innerHTML = html; };

  const brand = () => `<span class="brand"><img class="brand-logo" src="assets/brand/sangfor-logo-white.png" alt="Sangfor" /><span class="brand-divider"></span><span class="brand-stack"><span class="brand-word">SENTINEL</span><span class="brand-sub">${t('td.title')}</span></span></span>`;
  const langBtn = () => `<button class="iconbtn" data-td="lang" title="EN / 中文">${getLang() === 'en' ? '中文' : 'EN'}</button>`;

  // ---------- start ----------
  function showStart() {
    els.start.className = 'startScreen';
    els.start.innerHTML = `<div class="start-inner"><div class="start-top">${brand()}${langBtn()}</div>
      <div class="start-hero"><div class="hero-copy">
        <div class="hero-eyebrow">${t('td.byline')}</div>
        <h1 class="hero-title">${t('game.title')}<span>${t('td.title')}</span></h1>
        <p class="hero-tagline">${t('td.tagline')}</p>
        <div class="concept-card"><h2 class="concept-title">${t('td.title')} · ${t('td.subtitle')}</h2>
          <ol class="concept-steps">
            <li><b>${t('td.c1title')}</b><span>${t('td.c1')}</span></li>
            <li><b>${t('td.c2title')}</b><span>${t('td.c2')}</span></li>
            <li><b>${t('td.c3title')}</b><span>${t('td.c3')}</span></li>
          </ol></div>
        <p class="camera-instructions">${t('td.controls')}</p>
      </div>
      <div class="assignment-picker td-startcard">
        <h2>${t('td.subtitle')}</h2>
        <p class="td-roster-lead">${t('td.incoming')}:</p>
        <div class="td-roster">${PRODUCT_ORDER.map(id => `<span class="td-roster-chip"><span class="pcard-ico">${productMark(id)}</span>${esc(PRODUCTS[id].shortName)}</span>`).join('')}</div>
        <button class="btn primary big" data-td="start">${t('td.play')} →</button>
      </div></div></div>`;
  }
  function hideStart() { els.start.className = 'hidden'; els.start.innerHTML = ''; }

  function setPhase(p) {
    const on = p === 'play';
    els.hud.classList.toggle('hidden', !on); els.side.classList.toggle('hidden', !on); els.deck.classList.toggle('hidden', !on);
  }

  // ---------- top HUD ----------
  function meter(cls, label, val) {
    return `<div class="meter ${cls}"><div class="meter-content"><div class="meter-head"><span>${label}</span><b>${clamp(val)}%</b></div>
      <div class="meter-bar"><i style="width:${clamp(val)}%"></i></div></div></div>`;
  }
  function renderHud(e, speed = 1) {
    const s = e.state;
    const wave = `${Math.min(s.waveIndex + 1, s.waveCount)} / ${s.waveCount}`;
    const ctrl = e.phase === 'build'
      ? `<button class="btn primary" data-td="launch">${t(s.waveIndex === 0 ? 'td.launch' : 'td.launchNext')}</button>`
      : e.phase === 'wave'
        ? `<span class="td-wavelive"><i></i>${t('td.wave')} ${wave}</span>
           <button class="iconbtn" data-td="pause">${s._paused ? '▶' : '❚❚'}</button>
           ${[1, 2, 3].map(x => `<button class="chip ${speed === x ? 'on' : ''}" data-td="speed" data-s="${x}">${x}×</button>`).join('')}`
        : '';
    put(els.hud, `
      <div class="hud-left">${brand()}</div>
      <div class="hud-center">${meter('biz', t('hud.uptime'), s.uptime)}${meter('data', t('hud.data'), s.data)}
        <div class="hud-budget"><span class="k">${t('td.credits')}</span> <b>${s.credits}</b></div>
        <div class="hud-budget"><span class="k">${t('td.wave')}</span> <b>${wave}</b></div></div>
      <div class="hud-right">${ctrl}${langBtn()}</div>`);
  }

  // ---------- bottom deck (towers) ----------
  function renderDeck(e, placing) {
    const s = e.state;
    const cards = PRODUCT_ORDER.map(id => {
      const p = PRODUCTS[id], cost = e.buildCost(id, 1), afford = s.credits >= cost;
      return `<button class="pcard td-card ${placing === id ? 'placing' : ''} ${!afford ? 'dim' : ''}" data-td="pick" data-id="${id}" ${!afford ? 'disabled' : ''}>
        <span class="pcard-top"><span class="pcard-ico">${productMark(id)}</span><span class="pcard-cost">${cost} ${t('td.credits')}</span></span>
        <span class="pcard-name">${esc(p.shortName)}</span>
        <span class="pcard-tag">${t('td.r.' + id)}</span></button>`;
    }).join('');
    const note = placing
      ? `<div class="deck-place">${t('td.build')}: <b>${esc(PRODUCTS[placing].name)}</b> — ${t('td.pickPad')} · <button class="linklike" data-td="pick" data-id="${placing}">${t('tray.cancel')}</button></div>`
      : `<div class="deck-place dim">${t('td.selectTower')}</div>`;
    put(els.deck, `<div class="dock-note">${note}</div><div class="deck td-cards">${cards}</div>`);
  }

  // ---------- right panel: incoming wave OR selected tower ----------
  function incomingHtml(e) {
    const inc = e.incomingPreview();
    const rows = inc.map(({ type, n }) => `<li><span class="td-threat-dot" style="background:#${TD_ENEMIES[type].color.toString(16).padStart(6, '0')}"></span>${t('td.e.' + type)} <b>×${n}</b></li>`).join('');
    return `<section class="card td-panel"><h3>${t('td.wave')} ${Math.min(e.state.waveIndex + 1, e.state.waveCount)} · ${t('td.incoming')}</h3>
      <ul class="td-incoming">${rows || '<li class="dim">—</li>'}</ul>
      <p class="td-hint">${t('td.c3')}</p></section>`;
  }
  function showTower(tw) {
    if (!tw) { put(els.side, incomingHtml(window.__td.engine)); return; }
    const e = window.__td.engine, p = PRODUCTS[tw.productId], st = e.towerStats(tw), spec = TD_TOWERS[tw.productId];
    const maxed = tw.level >= 3, up = e.buildCost(tw.productId, tw.level + 1), afford = e.state.credits >= up;
    const stat = (k, v) => `<div class="td-stat"><span>${k}</span><b>${v}</b></div>`;
    const dmg = spec.kind === 'support' ? '—' : spec.kind === 'core' ? '🛡' : Math.round(st.dmg);
    put(els.side, `<section class="card td-panel td-tower">
      <div class="td-tower-head"><span class="pcard-ico">${productMark(tw.productId)}</span><div><h3>${esc(p.shortName)}</h3><span class="ins-sub">${t('td.level')} ${tw.level} · ${t('td.r.' + tw.productId)}</span></div></div>
      <div class="td-stats">${stat(t('td.damage'), dmg)}${stat(t('td.range'), st.range > 50 ? '∞' : st.range.toFixed(1))}${stat(t('td.rate'), spec.cooldown ? (1 / spec.cooldown).toFixed(1) + '/s' : '—')}</div>
      <p class="deployment-explanation">${esc(loc(p.capability))}</p>
      <div class="td-tower-actions">
        ${maxed ? `<button class="btn tiny" disabled>${t('td.maxed')}</button>` : `<button class="btn tiny ${afford ? 'primary' : ''}" data-td="upgrade" ${afford ? '' : 'disabled'}>${t('td.upgrade')} · ${up} ${t('td.credits')}</button>`}
        <button class="btn tiny" data-td="sell">${t('td.sell')}</button>
      </div></section>`);
  }

  // ---------- toast ----------
  let toastT;
  function toast(key, kind = 'warn') {
    if (!key) return;
    els.toasts.innerHTML = `<div class="toast ${kind}">${t(key)}</div>`;
    clearTimeout(toastT); toastT = setTimeout(() => { els.toasts.innerHTML = ''; }, 2200);
  }

  // ---------- end ----------
  function showEnd(result, e) {
    const win = result === 'won';
    els.end.className = 'endScreen';
    els.end.innerHTML = `<div class="end-inner ${win ? 'win' : 'lose'}"><div class="end-head">
      <div class="end-badge">${win ? '✓' : '✕'}</div>
      <h1>${t(win ? 'td.win' : 'td.lose')}</h1>
      <p>${t(win ? 'td.allClear' : 'td.breached')}</p>
      <div class="end-stats"><div><b>${clamp(e.state.uptime)}%</b><span>${t('hud.uptime')}</span></div>
        <div><b>${clamp(e.state.data)}%</b><span>${t('hud.data')}</span></div>
        <div><b>${e.state._kills}</b><span>${t('td.incoming')}</span></div>
        <div><b>${Math.min(e.state.waveIndex, e.state.waveCount)}/${e.state.waveCount}</b><span>${t('td.wave')}</span></div></div>
      <div class="end-actions"><button class="btn primary big" data-td="restart">${t('td.again')}</button></div>
    </div></div>`;
  }

  // event delegation
  root.addEventListener('click', ev => {
    const el = ev.target.closest('[data-td]'); if (!el || el.disabled) return;
    const a = el.dataset.td;
    if (a === 'start') return h.onStart();
    if (a === 'pick') return h.onPick(el.dataset.id);
    if (a === 'launch') return h.onLaunch();
    if (a === 'upgrade') return h.onUpgrade();
    if (a === 'sell') return h.onSell();
    if (a === 'speed') return h.onSpeed(+el.dataset.s);
    if (a === 'pause') return h.onPause();
    if (a === 'lang') return h.onLang();
    if (a === 'restart') return h.onRestart();
  });

  return { showStart, hideStart, setPhase, renderHud, renderDeck, showTower, toast, showEnd, els };
}
