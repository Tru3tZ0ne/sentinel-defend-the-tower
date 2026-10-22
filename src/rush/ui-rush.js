// DOM overlay for Breach Rush: start screen (name entry + how-to + leaderboard),
// in-game HUD (score/combo/integrity/power), power dock, pause + game-over screens.
// Presentational — main-rush.js wires these to the game and the leaderboard.

import { t, getLang } from './i18n-rush.js';
import { ABILITIES, ENERGY_MAX, START_INTEGRITY } from './rules.js';
import { isMuted } from './audio.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const POWERS = ['purge', 'slow', 'scan'];

function brand() {
  return `<span class="brand"><img class="brand-logo" src="assets/brand/sangfor-logo-white.png" alt="Sangfor" />
    <span class="brand-divider"></span><span class="brand-stack">
    <span class="brand-word">SENTINEL</span><span class="brand-sub">${t('brand.sub')}</span></span></span>`;
}
const shield = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" fill="currentColor"/></svg>`;
const SND_ON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 010 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
const SND_OFF = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
const soundIco = () => isMuted() ? SND_OFF : SND_ON;

function toprow() {
  return `<div class="rush-top">${brand()}
    <div class="rush-top-btns">
      <button class="iconbtn" data-rush="lang">${getLang() === 'en' ? '中文' : 'EN'}</button>
      <button class="iconbtn" data-rush="mute" aria-label="sound">${soundIco()}</button>
    </div></div>`;
}

export function createRushUI(root, h) {
  root.innerHTML = `
    <div id="rushHud" class="rush-hud hidden"></div>
    <div id="rushDock" class="rush-dock hidden"></div>
    <div id="rushToasts" class="toasts rush-toasts"></div>
    <div id="rushStart" class="rush-screen"></div>
    <div id="rushPause" class="rush-overlay hidden"></div>
    <div id="rushOver" class="rush-overlay hidden"></div>`;
  const $ = s => root.querySelector(s);
  const els = { hud: $('#rushHud'), dock: $('#rushDock'), toasts: $('#rushToasts'),
                start: $('#rushStart'), pause: $('#rushPause'), over: $('#rushOver') };

  // ---------- leaderboard list ----------
  function boardList(board, highlightId, limit = 12) {
    const rows = (board?.rows || []);
    const mode = board?.mode === 'world' ? t('board.world') : t('board.local');
    const body = rows.length
      ? rows.slice(0, limit).map((r, i) => `<li class="${r.id && r.id === highlightId ? 'me' : ''}">
          <span class="lb-rank">${i + 1}</span>
          <span class="lb-name">${esc(r.name)}${r.id && r.id === highlightId ? ` <em>${t('board.you')}</em>` : ''}</span>
          <span class="lb-score">${r.score.toLocaleString()}</span></li>`).join('')
      : `<li class="lb-empty">${t('board.empty')}</li>`;
    return `<div class="lb"><div class="lb-head"><h3>${t('board.title')}</h3><span class="lb-mode ${board?.mode || 'local'}">${mode}</span></div>
      <ol class="lb-rows">${body}</ol></div>`;
  }

  // ---------- start screen ----------
  function showStart(board, savedName) {
    els.start.className = 'rush-screen';
    els.start.innerHTML = `${toprow()}
      <div class="rush-start-grid">
        <div class="rush-hero">
          <div class="hero-eyebrow">${t('eyebrow')}</div>
          <h1 class="rush-title">${t('title')}</h1>
          <p class="rush-tagline">${t('tagline')}</p>
          <ol class="rush-how">
            <li><span class="how-n">1</span><div><b>${t('how1.h')}</b><span>${t('how1.b')}</span></div></li>
            <li><span class="how-n">2</span><div><b>${t('how2.h')}</b><span>${t('how2.b')}</span></div></li>
            <li><span class="how-n">3</span><div><b>${t('how3.h')}</b><span>${t('how3.b')}</span></div></li>
          </ol>
          <p class="rush-controls">${t('controls')}</p>
        </div>
        <div class="rush-side">
          <div class="rush-namecard">
            <label for="rushName">${t('name.label')}</label>
            <input id="rushName" class="rush-name" maxlength="14" placeholder="${t('name.ph')}" value="${esc(savedName || '')}" autocomplete="off" />
            <button class="btn primary big rush-play" data-rush="start">${t('play')} →</button>
          </div>
          ${boardList(board)}
        </div>
      </div>`;
    const input = $('#rushName');
    input.addEventListener('keydown', e => { if (e.key === 'Enter') h.onStart(input.value); });
  }
  function hideStart() { els.start.className = 'hidden'; }

  // ---------- phase ----------
  function setPhase(p) {
    const playing = p === 'playing' || p === 'paused';
    els.hud.classList.toggle('hidden', !playing);
    els.dock.classList.toggle('hidden', !playing);
    if (p === 'playing' || p === 'idle') { els.pause.classList.add('hidden'); els.over.classList.add('hidden'); }
    if (p === 'idle') els.start.className = 'rush-screen';
    if (p !== 'idle') els.start.className = 'hidden';
  }

  // ---------- HUD ----------
  const hudCache = {};
  function renderHud(hud) {
    const pips = Array.from({ length: START_INTEGRITY }, (_, i) =>
      `<span class="pip ${i < hud.integrity ? 'on' : ''}">${shield}</span>`).join('');
    const key = JSON.stringify([hud.score, hud.combo, hud.best, hud.integrity, Math.round(hud.energy), hud.stage]);
    if (hudCache.k !== key) {
      hudCache.k = key;
      els.hud.innerHTML = `
        <div class="hud-l">${brand()}</div>
        <div class="hud-c">
          <div class="stat big"><span>${t('hud.score')}</span><b>${hud.score.toLocaleString()}</b></div>
          <div class="stat"><span>${t('hud.combo')}</span><b class="${hud.combo >= 5 ? 'hot' : ''}">${hud.combo}×</b></div>
          <div class="stat"><span>${t('hud.best')}</span><b>${hud.best.toLocaleString()}</b></div>
          <div class="stat"><span>${t('hud.stage')}</span><b>${hud.stage}</b></div>
        </div>
        <div class="hud-r">
          <div class="integrity">${pips}</div>
          <button class="iconbtn" data-rush="pause" aria-label="pause">❚❚</button>
          <button class="iconbtn" data-rush="mute" aria-label="sound">${soundIco()}</button>
        </div>
        <div class="power-wrap"><div class="power-bar"><i style="width:${(hud.energy / ENERGY_MAX) * 100}%"></i></div></div>`;
    }
    renderDock(hud);
  }
  function renderDock(hud) {
    els.dock.innerHTML = POWERS.map(id => {
      const a = ABILITIES[id], ready = hud.energy >= a.cost;
      const active = (id === 'slow' && hud.slow) || (id === 'scan' && hud.reveal);
      return `<button class="pow ${ready ? 'ready' : ''} ${active ? 'active' : ''}" data-rush="power" data-id="${id}" ${ready ? '' : 'disabled'} style="--pc:${a.color}">
        <span class="pow-key">${a.key}</span>
        <span class="pow-body"><b>${t('pow.' + id)}</b><span>${t('pow.' + id + '.d')}</span></span>
        <span class="pow-cost">${a.cost}</span></button>`;
    }).join('');
  }

  // ---------- pause ----------
  function showPause() {
    els.pause.className = 'rush-overlay';
    els.pause.innerHTML = `<div class="rush-card pause-card">
      <h2>${t('pause')}</h2>
      <div class="rush-card-btns">
        <button class="btn primary big" data-rush="resume">${t('resume')} →</button>
        <button class="btn" data-rush="quit">${t('quit')}</button>
      </div></div>`;
  }
  function hidePause() { els.pause.className = 'rush-overlay hidden'; }

  // ---------- game over ----------
  function showOver(sum, board) {
    els.over.className = 'rush-overlay';
    const rank = board?.rank;
    els.over.innerHTML = `<div class="rush-card over-card">
      <div class="over-badge">✕</div>
      <h2>${t('over.title')}</h2>
      <p class="over-sub">${t('over.sub')}</p>
      <div class="over-score"><span>${t('over.score')}</span><b>${sum.score.toLocaleString()}</b>
        ${sum.isBest ? `<em class="newbest">${t('over.newbest')}</em>` : ''}</div>
      <div class="over-stats">
        <div><b>${rank ? '#' + rank : '—'}</b><span>${t('over.rank')}</span></div>
        <div><b>${sum.best.toLocaleString()}</b><span>${t('over.best')}</span></div>
        <div><b>${sum.neutralised}</b><span>${t('stat.neutralised')}</span></div>
        <div><b>${sum.elapsed}${t('sec')}</b><span>${t('stat.survived')}</span></div>
      </div>
      ${boardList(board, board?.submittedId, 7)}
      <div class="rush-card-btns">
        <button class="btn primary big" data-rush="restart">${t('over.again')} ↻</button>
        <button class="btn" data-rush="share" data-score="${sum.score}">${t('over.share')}</button>
      </div></div>`;
  }
  function setOverBoard(sum, board) { if (!els.over.classList.contains('hidden')) showOver(sum, board); }

  // ---------- toast ----------
  let toastT;
  function toast(key, kind = 'warn') {
    els.toasts.innerHTML = `<div class="toast ${kind}">${t(key)}</div>`;
    clearTimeout(toastT); toastT = setTimeout(() => { els.toasts.innerHTML = ''; }, 1800);
  }

  function getName() { const i = $('#rushName'); return i ? i.value : ''; }

  // ---------- delegation ----------
  root.addEventListener('click', ev => {
    const el = ev.target.closest('[data-rush]'); if (!el || el.disabled) return;
    const a = el.dataset.rush;
    if (a === 'start') return h.onStart(getName());
    if (a === 'power') return h.onAbility(el.dataset.id);
    if (a === 'pause') return h.onPause();
    if (a === 'resume') return h.onResume();
    if (a === 'quit') return h.onQuit();
    if (a === 'restart') return h.onRestart();
    if (a === 'lang') return h.onLang();
    if (a === 'mute') return h.onMute();
    if (a === 'share') return h.onShare(+el.dataset.score, el);
  });

  return { showStart, hideStart, setPhase, renderHud, showPause, hidePause, showOver, setOverBoard, toast, getName, els };
}
