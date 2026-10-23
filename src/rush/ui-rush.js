// DOM overlay for Breach Rush — Sangfor Edition. Start screen (name entry + how-to +
// Field Manual + leaderboard), in-game HUD (score/combo + Uptime/Data/Power meters +
// phase), 5-product power dock with passive strip, kill-chain phase banner, Field
// Manual (tabbed), pause + game-over screens. Presentational; main-rush wires it.

import { t, loc, getLang } from './i18n-rush.js';
import { ABILITIES, POWERS, PASSIVES, PHASES, ENERGY_MAX, START_INTEGRITY } from './rules.js';
import { PRODUCTS } from '../data/products.js';
import { isMuted } from './audio.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PASS = ['MDR', 'ASTOR'];
const TE = ['scan', 'malware', 'phish', 'exfil', 'stealth', 'ransom'];
const ARSENAL = ['AF', 'EDR', 'NDR', 'IAG', 'XDR', 'MDR', 'ASTOR'];
const PCOL = { AF: '#ffba45', EDR: '#39c0ff', NDR: '#8fb6ff', IAG: '#2ee6a0', XDR: '#a98bff', MDR: '#16ca78', ASTOR: '#ffd166' };

const shield = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" fill="currentColor"/></svg>`;
const SND_ON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 010 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
const SND_OFF = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
const soundIco = () => isMuted() ? SND_OFF : SND_ON;

function brand() {
  return `<span class="brand"><img class="brand-logo" src="assets/brand/sangfor-logo-white.png" alt="Sangfor" />
    <span class="brand-divider"></span><span class="brand-stack">
    <span class="brand-word">SENTINEL</span><span class="brand-sub">${t('brand.sub')}</span></span></span>`;
}
function topBtns(inGame) {
  return `<button class="iconbtn" data-rush="manual" aria-label="${esc(t('fm.open'))}">?</button>
    ${inGame ? '<button class="iconbtn" data-rush="pause" aria-label="pause">❚❚</button>' : ''}
    <button class="iconbtn" data-rush="lang">${getLang() === 'en' ? '中文' : 'EN'}</button>
    <button class="iconbtn" data-rush="mute" aria-label="sound">${soundIco()}</button>`;
}

export function createRushUI(root, h) {
  root.innerHTML = `
    <div id="rushHud" class="rush-hud hidden"></div>
    <div id="rushDock" class="rush-dock hidden"></div>
    <div id="rushPhase" class="rush-phase hidden"></div>
    <div id="rushToasts" class="toasts rush-toasts"></div>
    <div id="rushStart" class="rush-screen"></div>
    <div id="rushManual" class="rush-overlay hidden"></div>
    <div id="rushPause" class="rush-overlay hidden"></div>
    <div id="rushOver" class="rush-overlay hidden"></div>`;
  const $ = s => root.querySelector(s);
  const els = { hud: $('#rushHud'), dock: $('#rushDock'), phase: $('#rushPhase'), toasts: $('#rushToasts'),
                start: $('#rushStart'), manual: $('#rushManual'), pause: $('#rushPause'), over: $('#rushOver') };
  const _cache = new WeakMap();
  const put = (el, html) => { if (_cache.get(el) === html) return; _cache.set(el, html); el.innerHTML = html; };
  let manualTab = 'play';

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
    els.start.innerHTML = `<div class="rush-top">${brand()}<div class="rush-top-btns">${topBtns(false)}</div></div>
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
          <div class="rush-arsenal-row">${ARSENAL.map(id => `<span class="ars-chip" style="--pc:${PCOL[id]}">${id === 'ASTOR' ? 'aStor' : id}</span>`).join('')}</div>
          <p class="rush-controls">${t('controls')}</p>
        </div>
        <div class="rush-side">
          <div class="rush-namecard">
            <label for="rushName">${t('name.label')}</label>
            <input id="rushName" class="rush-name" maxlength="14" placeholder="${t('name.ph')}" value="${esc(savedName || '')}" autocomplete="off" />
            <button class="btn primary big rush-play" data-rush="start">${t('play')} →</button>
            <button class="btn ghost rush-manual-btn" data-rush="manual">${t('fm.open')}</button>
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
    els.start.className = p === 'idle' ? 'rush-screen' : 'hidden';
  }
  // kill-chain phase banner
  let phaseT;
  function banner(id, num) {
    els.phase.className = 'rush-phase';
    els.phase.innerHTML = `<span class="ph-num">${t('phase.label')} ${num}</span><span class="ph-name">${t('phase.' + id)}</span>`;
    clearTimeout(phaseT); phaseT = setTimeout(() => { els.phase.className = 'rush-phase hidden'; }, 2600);
  }

  // ---------- HUD ----------
  function renderHud(hud) {
    const pips = Array.from({ length: START_INTEGRITY }, (_, i) =>
      `<span class="pip ${i < hud.integrity ? 'on' : ''}">${shield}</span>`).join('');
    const phId = PHASES[hud.phaseIdx]?.id || 'recon';
    put(els.hud, `
      <div class="hud-l">${brand()}</div>
      <div class="hud-c">
        <div class="stat big"><span>${t('hud.score')}</span><b>${hud.score.toLocaleString()}</b></div>
        <div class="stat"><span>${t('hud.combo')}</span><b class="${hud.combo >= 5 ? 'hot' : ''}">${hud.combo}×</b></div>
        <div class="stat"><span>${t('hud.best')}</span><b>${hud.best.toLocaleString()}</b></div>
      </div>
      <div class="hud-r"><span class="phase-chip">${t('phase.label')} ${hud.phaseIdx + 1} · ${t('phase.' + phId)}</span>${topBtns(true)}</div>
      <div class="hud-meters">
        <div class="m m-up"><span class="m-k">${t('hud.uptime')}</span><span class="integrity">${pips}</span></div>
        <div class="m m-data"><span class="m-k">${t('hud.data')}</span><div class="m-bar"><i style="width:${hud.data}%"></i></div><b>${hud.data}%</b></div>
        <div class="m m-pow"><span class="m-k">${t('hud.power')}</span><div class="m-bar"><i style="width:${(hud.energy / ENERGY_MAX) * 100}%"></i></div></div>
      </div>`);
    renderDock(hud);
  }
  function renderDock(hud) {
    const powers = POWERS.map(id => {
      const a = ABILITIES[id], ready = hud.energy >= a.cost;
      const active = (id === 'NDR' && (hud.reveal || hud.slow)) || (id === 'AF' && hud.block);
      return `<button class="pow ${ready ? 'ready' : ''} ${active ? 'active' : ''}" data-rush="power" data-id="${id}" ${ready ? '' : 'disabled'} style="--pc:${a.color}">
        <span class="pow-key">${a.key}</span>
        <span class="pow-body"><b>${t('pow.' + id)}</b><span>${t('pow.' + id + '.d')}</span></span>
        <span class="pow-cost">${a.cost}</span></button>`;
    }).join('');
    const passives = `<div class="pass-strip">
      <span class="pass ${hud.shield ? 'ok' : 'off'}" style="--pc:${PCOL.ASTOR}" title="${esc(t('pas.ASTOR.d'))}">aStor · ${hud.shield ? t('pas.ready') : t('pas.charging')}</span>
      <span class="pass ok" style="--pc:${PCOL.MDR}" title="${esc(t('pas.MDR.d'))}">MDR · 24/7</span></div>`;
    put(els.dock, `<div class="pow-row">${powers}</div>${passives}`);
  }

  // ---------- Field Manual ----------
  function manualBody() {
    if (manualTab === 'play') {
      return `<p class="fm-lead">${t('fm.play.lead')}</p>
        <ol class="rush-how fm-how">
          <li><span class="how-n">1</span><div><b>${t('how1.h')}</b><span>${t('how1.b')}</span></div></li>
          <li><span class="how-n">2</span><div><b>${t('how2.h')}</b><span>${t('how2.b')}</span></div></li>
          <li><span class="how-n">3</span><div><b>${t('how3.h')}</b><span>${t('how3.b')}</span></div></li>
        </ol>
        <div class="fm-note"><b>${t('fm.play.meters.h')}</b><p>${t('fm.play.meters.b')}</p></div>
        <div class="fm-note"><b>${t('fm.play.powers.h')}</b><p>${t('fm.play.powers.b')}</p></div>`;
    }
    if (manualTab === 'chain') {
      const rows = TE.map(k => `<div class="ti-row">
        <span class="ti-dot" style="background:${threatColor(k)}"></span>
        <div class="ti-main"><b>${t('te.' + k)}</b><span>${t('te.' + k + '.d')}</span></div>
        <span class="ti-harm">${harmLabel(k)}</span>
        <span class="ti-ctr" style="--pc:${PCOL[counterOf(k)]}">${counterOf(k) === 'ASTOR' ? 'aStor' : counterOf(k)}</span></div>`).join('');
      return `<p class="fm-lead">${t('fm.chain.lead')}</p>
        <div class="ti-head"><span></span><span></span><span>${t('fm.chain.harms')}</span><span>${t('fm.chain.counter')}</span></div>
        <div class="ti-list">${rows}</div>`;
    }
    if (manualTab === 'arsenal') {
      const cards = ARSENAL.map(id => {
        const p = PRODUCTS[id]; const active = POWERS.includes(id);
        const a = ABILITIES[id];
        return `<div class="ar-card" style="--pc:${PCOL[id]}">
          <div class="ar-top"><span class="ar-name">${esc(p.shortName)}</span>
            <span class="ar-tag ${active ? 'a' : 'p'}">${active ? t('ar.active') + (a ? ' · ' + a.key : '') : t('ar.passive')}</span></div>
          <div class="ar-fx">${t('ar.fx')}: <b>${t('ar.' + id + '.fx')}</b></div>
          <div class="ar-cap"><span>${t('ar.cap')}</span>${esc(loc(p.capability))}</div>
          <div class="ar-lim"><span>${t('ar.limit')}</span>${esc(loc(p.limitation))}</div></div>`;
      }).join('');
      return `<p class="fm-lead">${t('fm.arsenal.lead')}</p><div class="ar-grid">${cards}</div>`;
    }
    // score
    return `<p class="fm-lead">${t('fm.score.lead')}</p>
      <ul class="fm-score"><li>${t('sc.l1')}</li><li>${t('sc.l2')}</li><li>${t('sc.l3')}</li><li>${t('sc.l4')}</li></ul>`;
  }
  function showManual(tab) {
    if (tab) manualTab = tab;
    els.manual.className = 'rush-overlay';
    const tabs = ['play', 'chain', 'arsenal', 'score'];
    els.manual.innerHTML = `<div class="rush-card fm-card">
      <div class="fm-head"><h2>${t('fm.title')}</h2><button class="guide-x" data-rush="manualClose" aria-label="close">✕</button></div>
      <div class="fm-tabs">${tabs.map(tb => `<button class="fm-tab ${manualTab === tb ? 'on' : ''}" data-rush="manualTab" data-tab="${tb}">${t('fm.tab.' + tb)}</button>`).join('')}</div>
      <div class="fm-body">${manualBody()}</div>
      <div class="rush-card-btns"><button class="btn primary big" data-rush="manualClose">${t('fm.close')}</button></div>
    </div>`;
  }
  function hideManual() { els.manual.className = 'rush-overlay hidden'; }
  function manualOpen() { return !els.manual.classList.contains('hidden'); }

  function threatColor(k) { return ({ scan: '#ffd166', malware: '#ff6b5e', phish: '#49c6e0', exfil: '#c07bff', stealth: '#8fb6ff', ransom: '#ff3b6b' })[k]; }
  function counterOf(k) { return ({ scan: 'AF', malware: 'EDR', phish: 'EDR', exfil: 'IAG', stealth: 'NDR', ransom: 'ASTOR' })[k]; }
  function harmLabel(k) { return (k === 'exfil' || k === 'ransom') ? t('fm.harm.data') : t('fm.harm.uptime'); }

  // ---------- pause ----------
  function showPause() {
    els.pause.className = 'rush-overlay';
    els.pause.innerHTML = `<div class="rush-card pause-card">
      <h2>${t('pause')}</h2>
      <div class="rush-card-btns">
        <button class="btn primary big" data-rush="resume">${t('resume')} →</button>
        <button class="btn" data-rush="manual">${t('fm.open')}</button>
        <button class="btn" data-rush="quit">${t('quit')}</button>
      </div></div>`;
  }
  function hidePause() { els.pause.className = 'rush-overlay hidden'; }

  // ---------- game over ----------
  function showOver(sum, board) {
    els.over.className = 'rush-overlay';
    const rank = board?.rank;
    const reason = sum.reason === 'data' ? 'data' : 'uptime';
    els.over.innerHTML = `<div class="rush-card over-card">
      <div class="over-badge">✕</div>
      <h2>${t('over.title.' + reason)}</h2>
      <p class="over-sub">${t('over.sub.' + reason)}</p>
      <div class="over-score"><span>${t('over.score')}</span><b>${sum.score.toLocaleString()}</b>
        ${sum.isBest ? `<em class="newbest">${t('over.newbest')}</em>` : ''}</div>
      <div class="over-stats">
        <div><b>${rank ? '#' + rank : '—'}</b><span>${t('over.rank')}</span></div>
        <div><b>${sum.best.toLocaleString()}</b><span>${t('over.best')}</span></div>
        <div><b>${sum.neutralised}</b><span>${t('stat.neutralised')}</span></div>
        <div><b>${sum.data}%</b><span>${t('stat.dataLeft')}</span></div>
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
  function toast(key, kind = 'warn', p) {
    els.toasts.innerHTML = `<div class="toast ${kind}">${t(key, p ? { p } : undefined)}</div>`;
    clearTimeout(toastT); toastT = setTimeout(() => { els.toasts.innerHTML = ''; }, 1700);
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
    if (a === 'manual') return h.onManual();
    if (a === 'manualClose') return h.onManualClose();
    if (a === 'manualTab') return showManual(el.dataset.tab);
  });

  return { showStart, hideStart, setPhase, banner, renderHud, showManual, hideManual, manualOpen,
           showPause, hidePause, showOver, setOverBoard, toast, getName, els };
}
