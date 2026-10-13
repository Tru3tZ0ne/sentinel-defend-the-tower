// Security-operations UI shell over the 3D scene. A night-ops command centre:
// top status bar, a right column (incident timeline · inspect card · Sophia analyst),
// a bottom capability deck with live status + tabs, and an event ticker. Pure presentation
// + event delegation; all decisions go back through `h` (handlers).
import { t, loc, getLang } from '../i18n.js';
import { PRODUCTS, PRODUCT_ORDER } from '../data/products.js';
import { icon } from './icons.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = v => Math.max(0, Math.min(100, v));

export function createOverlay(root, h) {
  root.innerHTML = `
    <div id="labels" class="labels"></div>
    <header id="hud" class="hud hidden"></header>
    <div id="rightcol" class="rightcol hidden">
      <section id="incident" class="card incident"></section>
      <section id="inspect" class="card inspect hidden"></section>
      <section id="sophiaCard" class="card sophia"></section>
    </div>
    <div id="dock" class="dock hidden"></div>
    <div id="ticker" class="ticker hidden"></div>
    <div id="toasts" class="toasts"></div>
    <div id="startScreen"></div>
    <div id="endScreen" class="endScreen hidden"></div>`;

  const $ = s => root.querySelector(s);
  const els = {
    labels: $('#labels'), hud: $('#hud'), rightcol: $('#rightcol'), incident: $('#incident'),
    inspect: $('#inspect'), sophia: $('#sophiaCard'), dock: $('#dock'), ticker: $('#ticker'),
    toasts: $('#toasts'), start: $('#startScreen'), end: $('#endScreen'),
  };
  let tab = 'defense';

  const brand = () => `<span class="brand"><span class="brand-glyph">${icon('sophia')}</span>
    <span class="brand-stack"><span class="brand-word">SANGFOR</span><span class="brand-sub">SENTINEL · ${t('game.subtitle')}</span></span>
    <span class="brand-badge">${t('badge.placeholder')}</span></span>`;
  const langBtn = () => `<button class="iconbtn" data-act="lang" title="${t('lang.toggle')}">${getLang() === 'en' ? '中文' : 'EN'}</button>`;

  // ---------- start ----------
  function showStart() {
    els.start.className = 'startScreen';
    els.start.innerHTML = `
      <div class="start-inner">
        <div class="start-top">${brand()}${langBtn()}</div>
        <div class="start-hero">
          <div class="hero-eyebrow">${t('game.byline')}</div>
          <h1 class="hero-title">${t('game.title')}<span>${t('game.subtitle')}</span></h1>
          <p class="hero-tagline">${t('start.tagline')}</p>
          <ul class="hero-brief"><li>${t('start.brief1')}</li><li>${t('start.brief2')}</li><li>${t('start.brief3')}</li></ul>
          <button class="btn primary big" data-act="start">${t('start.play')} →</button>
        </div>
      </div>`;
  }
  function hideStart() { els.start.className = 'hidden'; els.start.innerHTML = ''; }

  // ---------- phase visibility ----------
  function setPhase(phase) {
    const inGame = phase === 'prep' || phase === 'incident';
    els.hud.classList.toggle('hidden', !inGame);
    els.rightcol.classList.toggle('hidden', !inGame);
    els.dock.classList.toggle('hidden', !inGame);
    els.ticker.classList.toggle('hidden', !inGame);
    els.hud.classList.toggle('prep', phase === 'prep');
  }

  // ---------- top HUD ----------
  function meter(label, val, cls) {
    return `<div class="meter ${cls}"><div class="meter-head"><span>${label}</span><b>${Math.round(clamp(val))}%</b></div>
      <div class="meter-bar"><i style="width:${clamp(val)}%"></i></div></div>`;
  }
  function renderHud(e) {
    const phase = e.phase;
    const live = phase === 'incident';
    const remain = Math.max(0, e.inc.duration - e.time);
    const mm = String(Math.floor(remain / 60)).padStart(1, '0'), ss = String(Math.floor(remain % 60)).padStart(2, '0');
    const clock = live ? `${mm}:${ss}` : t('phase.' + phase);
    const controls = live ? `
      <button class="iconbtn" data-act="pause" title="${e._paused ? t('hud.resume') : t('hud.pause')}">${e._paused ? '▶' : '❚❚'}</button>
      <span class="speed">${[1, 2, 3].map(s => `<button class="chip ${e.speed === s ? 'on' : ''}" data-act="speed" data-s="${s}">${s}×</button>`).join('')}</span>` : '';
    els.hud.innerHTML = `
      <div class="hud-left">${brand()}</div>
      <div class="hud-center">
        ${meter(t('hud.uptime'), e.uptime, 'biz')}
        ${meter(t('hud.data'), e.data, 'data')}
        <div class="hud-budget"><span class="k">${t('hud.budget')}</span><b>${e.budget}</b><span class="u">${t('hud.credits')}</span></div>
      </div>
      <div class="hud-right">
        <div class="hud-clock ${live ? 'live' : 'prep'}">${live ? `<span class="dot"></span>` : ''}${clock}</div>
        ${controls}${langBtn()}
      </div>`;
  }

  // ---------- right: incident timeline ----------
  function renderFeed(e) {              // (kept name) → incident panel
    const roomName = id => { const r = e.sc.LAYOUT.rooms.find(x => x.id === id); return r ? loc(r.name) : id; };
    const clues = e.clues;
    const confirmed = e.confirmed;
    const status = !clues.length ? 'idle' : confirmed ? 'confirmed' : 'weak';
    const head = {
      idle: { t: t('inc.monitoring'), cls: 'idle' },
      weak: { t: t('inc.suspicious'), cls: 'weak' },
      confirmed: { t: t('inc.confirmed'), cls: 'confirmed' },
    }[status];
    const rows = [...clues].slice(-5).reverse().map(c => {
      const tg = c.blocked ? `<span class="tl-tag good">${t('end.blocked')}</span>`
        : c.prevented ? `<span class="tl-tag good">${t('end.prevented')}</span>` : '';
      return `<li class="tl ev-${c.type}" data-act="focusClue" data-clue="${c.id}">
        <span class="tl-dot"></span>
        <span class="tl-body"><span class="tl-h">${t('clue.' + c.type)} ${tg}</span>
        <span class="tl-sub">${t('clue.at')} ${esc(roomName(c.room))}</span></span></li>`;
    }).join('');
    const cta = (!e.hasXDR && e.typesSeen && e.typesSeen.size >= 2)
      ? `<button class="btn block warn-b" data-act="investigate">${icon('xdr')} ${t('inc.needXDR')}</button>`
      : clues.length ? `<button class="btn block" data-act="investigate">${t('inc.locate')} →</button>` : '';
    els.incident.innerHTML = `
      <div class="card-h"><span class="card-ico ${head.cls}">${icon(status === 'idle' ? 'ndr' : 'attacker')}</span>
        <div><span class="card-k">${t('inc.label')}</span><h3 class="${head.cls}">${head.t}</h3></div></div>
      ${clues.length ? `<ul class="timeline-live">${rows}</ul>` : `<p class="card-empty">${t(e.phase === 'prep' ? 'feed.hintPrep' : 'feed.none')}</p>`}
      ${cta}`;
  }

  // ---------- right: inspect card ----------
  function showInspect(data) {
    if (!data) { clearInspect(); return; }
    els.inspect.className = 'card inspect';
    els.inspect.innerHTML = data.html + `<button class="inspect-x" data-act="closeInspect">✕</button>`;
  }
  function clearInspect() { els.inspect.className = 'card inspect hidden'; els.inspect.innerHTML = ''; }

  // ---------- right: Sophia analyst ----------
  function renderSophia(hint, expanded, greet) {
    const body = greet || (hint ? (expanded ? loc(hint.more) : loc(hint.dir)) : '');
    const actions = hint && !greet ? `
      ${!expanded ? `<button class="btn tiny" data-act="sophiaShow">${t('sophia.show')} →</button>` : ''}
      ${!expanded ? `<button class="linklike" data-act="sophiaMore">${t('sophia.more')}</button>` : ''}` : '';
    els.sophia.innerHTML = `
      <div class="sophia-top"><div class="sophia-av">${icon('sophia')}<span class="sophia-dot"></span></div>
        <div class="sophia-id"><b>${t('sophia.name')}</b><span>${t('sophia.role')}</span></div></div>
      <div class="sophia-body">${esc(body)}</div>
      <div class="sophia-actions">${actions}</div>`;
  }
  function pulseSophia() { els.sophia.classList.remove('min'); els.sophia.classList.add('pulse'); setTimeout(() => els.sophia.classList.remove('pulse'), 1400); }

  // ---------- bottom: capability deck + tabs ----------
  const TABS = [['defense', 'tab.defense', 'af'], ['cloud', 'tab.cloud', 'astor'], ['ops', 'tab.ops', 'mdr'], ['replay', 'tab.replay', 'check']];
  function renderTray(e, placing) {      // (kept name) → capability deck
    const tabsHtml = TABS.map(([id, key, ic]) => `<button class="dtab ${tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">${icon(ic)} ${t(key)}</button>`).join('');
    let body;
    if (tab === 'defense') body = defenseDeck(e, placing);
    else if (tab === 'cloud') body = infoDeck('cloud');
    else if (tab === 'ops') body = infoDeck('ops');
    else body = `<div class="deck-note">${t('tab.replayNote')}</div>`;
    const note = placing
      ? `<div class="deck-place">${t('tray.placing')}: <b>${esc(PRODUCTS[placing].name)}</b> — ${t('tray.clickWorld')} · <button class="linklike" data-act="cancel">${t('tray.cancel')}</button></div>`
      : '';
    els.dock.innerHTML = `<div class="dock-tabs">${tabsHtml}</div>${note}<div class="deck">${body}</div>`;
  }
  function defenseDeck(e, placing) {
    return PRODUCT_ORDER.map(id => {
      const p = PRODUCTS[id];
      const isEDR = id === 'EDR';
      const count = isEDR ? e.edrDesks.size : (e.bySlot.has(id) ? 1 : 0);
      const active = isEDR ? count > 0 : e.bySlot.has(id);
      const done = !isEDR && active;
      const afford = e.budget >= p.cost;
      const status = active
        ? (isEDR ? `<span class="pst on">● ${count} ${t('deck.devices')}</span>` : `<span class="pst on">● ${t('deck.active')}</span>`)
        : afford ? `<span class="pst av">${t('deck.available')}</span>` : `<span class="pst no">${t('deck.locked')}</span>`;
      return `<button class="pcard ${placing === id ? 'placing' : ''} ${active ? 'is-on' : ''} ${(!afford && !active) ? 'dim' : ''}" data-act="pick" data-id="${id}" ${done ? 'disabled' : ''}>
        <span class="pcard-top"><span class="pcard-ico">${icon(p.icon)}</span><span class="pcard-cost">${active ? '' : p.cost + ' ' + t('hud.credits')}</span></span>
        <span class="pcard-name">${esc(p.name)}</span>
        <span class="pcard-tag">${esc(loc(p.tagline))}</span>
        ${status}</button>`;
    }).join('');
  }
  function infoDeck(which) {
    const items = which === 'cloud'
      ? [['hci', 'HCI'], ['astor2', 'aStor'], ['adc', 'ADC'], ['sase', 'SASE'], ['aicp', 'AICP']]
      : [['xdrops', 'XDR'], ['mdrops', 'MDR'], ['gpt', 'Security GPT']];
    return `<div class="info-strip">${items.map(([k, n]) => `<div class="info-card"><b>${n}</b><span>${t('info.' + k)}</span></div>`).join('')}
      <div class="info-note">${t('info.soon')}</div></div>`;
  }

  // ---------- prep begin CTA (lives in the ticker row during prep) ----------
  function setEvent(text, prep, kind) {
    if (prep) {
      els.ticker.className = 'ticker prep';
      els.ticker.innerHTML = `<span class="tick-note">${t('prep.banner')}</span><button class="btn primary" data-act="begin">${t('begin.day')}</button>`;
    } else {
      els.ticker.className = 'ticker';
      els.ticker.innerHTML = `<span class="tick-lbl ${kind || ''}">${icon('attacker')} ${t('ticker.event')}</span><span class="tick-msg">${esc(text || t('ticker.none'))}</span>`;
    }
  }

  // ---------- toasts ----------
  function toast(p) {
    const txt = p.clue ? t('clue.' + p.clue) : (p.product ? `${PRODUCTS[p.product]?.name || ''} · ${t(p.key)}` : t(p.key || ''));
    const n = document.createElement('div');
    n.className = `toast ${p.kind || 'info'}`;
    n.innerHTML = p.clue ? `<span class="ev-${p.clue}">${icon(p.clue)}</span> ${esc(txt)}` : esc(txt);
    els.toasts.appendChild(n);
    while (els.toasts.children.length > 3) els.toasts.firstChild.remove();
    setTimeout(() => n.classList.add('in'), 10);
    setTimeout(() => { n.classList.remove('in'); setTimeout(() => n.remove(), 300); }, 2600);
  }

  // ---------- end / replay ----------
  function showEnd(e) {
    const o = e.outcome || {};              // { kind: 'contained'|'survived-delayed'|'breach'|'collapse', ... }
    const win = o.verdict === 'win';
    const kindCls = win ? (o.kind === 'contained' ? 'win' : 'partial') : 'lose';
    const attacks = e.log.filter(l => l.kind === 'attack');
    const detected = attacks.filter(a => a.visible || a.blocked || a.prevented).length;
    els.end.className = 'endScreen';
    els.end.innerHTML = `
      <div class="end-inner ${kindCls}">
        <div class="end-top">${brand()}${langBtn()}</div>
        <div class="end-head">
          <div class="end-badge">${o.kind === 'contained' ? icon('check') : win ? icon('mdr') : icon('attacker')}</div>
          <h1>${t(o.titleKey || 'end.win.title')}</h1>
          <p>${esc(t(o.summaryKey || 'end.win.survived'))}</p>
          <div class="end-stats">
            <div><b>${e.score}</b><span>${t('end.score')}</span></div>
            <div><b>${Math.round(e.uptime)}%</b><span>${t('hud.uptime')}</span></div>
            <div><b>${Math.round(e.data)}%</b><span>${t('hud.data')}</span></div>
            <div><b>${detected}/${attacks.length}</b><span>${t('end.detected')}</span></div>
          </div>
        </div>
        <div class="replay">
          <div class="replay-head"><div><h2>${t('end.replay')}</h2><p>${t('end.replay.sub')}</p></div>
            <button class="btn" data-act="replayPlay">${t('end.replay.play')}</button></div>
          <ol class="timeline">${timeline(e, attacks)}</ol>
        </div>
        <div class="end-actions">
          <button class="btn ghost" data-act="backToGame">${t('end.backToGame')}</button>
          <button class="btn primary big" data-act="again">${t('end.again')}</button>
        </div>
      </div>`;
  }
  function timeline(e, attacks) {
    const roomName = id => { const r = e.sc.LAYOUT.rooms.find(x => x.id === id); return r ? loc(r.name) : id; };
    return attacks.map((a, i) => {
      const beat = e.inc.beats.find(b => b.act === a.act && b.room === a.room) || {};
      let status, cls;
      if (a.blocked) { status = t('end.blocked'); cls = 'good'; }
      else if (a.prevented) { status = t('end.prevented'); cls = 'good'; }
      else if (a.contained) { status = t('end.contained'); cls = 'good'; }
      else if (a.visible) { status = t('end.detected'); cls = 'seen'; }
      else { status = t('end.missed'); cls = 'bad'; }
      return `<li class="tl-row ${cls}" data-step="${i}">
        <span class="tl-ev ev-${a.ev}">${icon(a.ev)}</span>
        <div class="tl-main"><div class="tl-truth">${esc(loc(beat.truth) || a.act)}</div>
          <div class="tl-meta"><span class="tl-time">${Math.round(a.t)}s</span><span class="tl-room">${esc(roomName(a.room))}</span><span class="tl-status ${cls}">${status}</span></div></div></li>`;
    }).join('');
  }
  function hideEnd() { els.end.className = 'hidden'; els.end.innerHTML = ''; }
  function highlightStep(i) { els.end.querySelectorAll('.tl-row').forEach(r => r.classList.toggle('active', +r.dataset.step === i)); }

  // ---------- event delegation ----------
  root.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act;
    const map = {
      start: h.onStart, begin: h.onBeginDay, cancel: h.onCancelPlacing, lang: h.onLang,
      pause: h.onPauseToggle, sophiaMore: h.onSophiaMore, sophiaShow: h.onSophiaShow || h.onSophiaMore,
      closeInspect: h.onCloseInspect, again: h.onAgain, backToGame: h.onBackToGame,
      replayPlay: h.onReplayPlay, investigate: h.onInvestigate,
    };
    if (a === 'pick') return h.onPickProduct(el.dataset.id);
    if (a === 'focusClue') return h.onFocusClue(el.dataset.clue);
    if (a === 'speed') return h.onSpeed(+el.dataset.s);
    if (a === 'isolate') return h.onIsolate(el.dataset.desk);
    if (a === 'lockdown') return h.onLockdown(el.dataset.room);
    if (a === 'recover') return h.onRecover(el.dataset.room);
    if (a === 'tab') { tab = el.dataset.tab; if (tab === 'replay' && h.onReplayTab) return h.onReplayTab(); return h.onTab ? h.onTab(tab) : null; }
    if (map[a]) return map[a]();
  });

  return { els, showStart, hideStart, setPhase, renderHud, renderTray, renderFeed,
           showInspect, clearInspect, renderSophia, pulseSophia, toast, setEvent, showEnd, hideEnd, highlightStep,
           get tab() { return tab; } };
}
