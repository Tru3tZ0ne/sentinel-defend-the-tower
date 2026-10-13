// DOM overlay that floats above the 3D canvas: start screen, top HUD, deploy tray,
// contextual inspect card, signal feed, Sophia dock, toasts, and the spatial-replay end
// screen. Pure presentation + event delegation; all decisions go back through `h` (handlers).
import { t, loc, getLang } from '../i18n.js';
import { PRODUCTS, PRODUCT_ORDER } from '../data/products.js';
import { icon } from './icons.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createOverlay(root, h) {
  root.innerHTML = `
    <div id="labels" class="labels"></div>
    <div id="topbar" class="topbar hidden"></div>
    <div id="prepbar" class="prepbar hidden"></div>
    <aside id="tray" class="tray hidden"></aside>
    <aside id="feedPanel" class="feedPanel hidden">
      <h2 class="ptitle">${icon('ndr')} ${t('feed.title')}</h2>
      <div id="feed" class="feed"></div>
    </aside>
    <div id="inspect" class="inspect hidden"></div>
    <div id="sophiaDock" class="sophiaDock hidden"></div>
    <div id="toasts" class="toasts"></div>
    <div id="startScreen"></div>
    <div id="endScreen" class="endScreen hidden"></div>`;

  const $ = s => root.querySelector(s);
  const els = {
    labels: $('#labels'), topbar: $('#topbar'), prepbar: $('#prepbar'), tray: $('#tray'),
    feedPanel: $('#feedPanel'), feed: $('#feed'), inspect: $('#inspect'), sophia: $('#sophiaDock'),
    toasts: $('#toasts'), start: $('#startScreen'), end: $('#endScreen'),
  };

  function brand() {
    return `<span class="brand"><span class="brand-glyph">${icon('sophia')}</span>
      <span class="brand-word">SANGFOR</span>
      <span class="brand-badge">${t('badge.placeholder')}</span></span>`;
  }
  const langBtn = () => `<button class="btn ghost" data-act="lang">${t('lang.toggle')}</button>`;

  // ---------- start ----------
  function showStart() {
    els.start.className = 'startScreen';
    els.start.innerHTML = `
      <div class="start-inner">
        <div class="start-top">${brand()}${langBtn()}</div>
        <div class="start-hero">
          <div class="hero-title"><span class="t1">${t('game.title')}</span><span class="t2">${t('game.subtitle')}</span></div>
          <p class="hero-byline">${t('game.byline')}</p>
          <p class="hero-tagline">${t('start.tagline')}</p>
          <ul class="hero-brief"><li>${t('start.brief1')}</li><li>${t('start.brief2')}</li><li>${t('start.brief3')}</li></ul>
          <button class="btn primary big" data-act="start">${t('start.play')} →</button>
        </div>
      </div>`;
  }
  function hideStart() { els.start.className = 'hidden'; els.start.innerHTML = ''; }

  // ---------- HUD ----------
  function setPhase(phase) {
    const inGame = phase === 'prep' || phase === 'incident';
    els.topbar.classList.toggle('hidden', !inGame);
    els.prepbar.classList.toggle('hidden', phase !== 'prep');
    els.tray.classList.toggle('hidden', !(phase === 'prep' || phase === 'incident'));
    els.feedPanel.classList.toggle('hidden', !(phase === 'prep' || phase === 'incident'));
    els.sophia.classList.toggle('hidden', !(phase === 'prep' || phase === 'incident'));
  }

  function renderHud(e) {
    const phase = e.phase;
    const pill = `<span class="phase-pill ${phase}">${t('phase.' + phase)}</span>`;
    const meters = phase === 'incident' ? `
      ${meter(t('hud.uptime'), e.uptime, 'up')}
      ${meter(t('hud.data'), e.data, 'data')}
      <div class="hud-time">${t('hud.time')} ${Math.ceil(e.time)}s / ${e.inc.duration}s</div>` : '';
    const controls = phase === 'incident' ? `
      <button class="btn ghost" data-act="pause">${e._paused ? t('hud.resume') : t('hud.pause')}</button>
      <span class="speed">${[1,2,3].map(s => `<button class="chip ${e.speed===s?'on':''}" data-act="speed" data-s="${s}">${s}×</button>`).join('')}</span>` : '';
    els.topbar.innerHTML = `
      <div class="tb-left">${brand()} ${pill}</div>
      <div class="tb-mid">${meters}</div>
      <div class="tb-right"><span class="hud-budget">${icon('xdr')}<b>${e.budget}</b>${t('hud.credits')}</span>${controls}${langBtn()}</div>`;
    els.prepbar.innerHTML = phase === 'prep' ? `
      <div class="prep-note">${t('prep.banner')}</div>
      <button class="btn primary" data-act="begin">${t('begin.day')}</button>` : '';
  }
  const meter = (label, val, cls) => `<div class="meter ${cls}"><div class="meter-top"><span>${label}</span><span>${Math.round(val)}%</span></div><div class="meter-bar"><i style="width:${Math.max(0,Math.min(100,val))}%"></i></div></div>`;

  // ---------- deploy tray ----------
  function renderTray(e, placing) {
    const cards = PRODUCT_ORDER.map(id => {
      const p = PRODUCTS[id];
      const deployed = id === 'EDR' ? e.edrDesks.size : (e.bySlot.has(id) ? 1 : 0);
      const single = id !== 'EDR';
      const done = single && deployed > 0;
      const afford = e.budget >= p.cost;
      return `<button class="pcard ${placing===id?'placing':''} ${(!afford||done)?'dim':''}" data-act="pick" data-id="${id}" ${done?'disabled':''}>
        <span class="pcard-icon">${icon(p.icon)}</span>
        <span class="pcard-main"><span class="pcard-name">${esc(p.name)}</span><span class="pcard-tag">${esc(loc(p.tagline))}</span></span>
        <span class="pcard-cost">${done ? '✓'+(id==='EDR'?'':'') : p.cost+' '+t('hud.credits')}${id==='EDR'&&deployed?` ·${deployed}`:''}</span>
      </button>`;
    }).join('');
    const note = placing
      ? `<div class="tray-note placing">${t('tray.placing')}: <b>${esc(PRODUCTS[placing].name)}</b> — ${t('tray.clickWorld')} · <button class="linklike" data-act="cancel">${t('tray.cancel')}</button></div>`
      : `<div class="tray-note">${t('tray.hint')}</div>`;
    els.tray.innerHTML = `<h2 class="ptitle">${icon('af')} ${t('tray.title')}</h2>${note}<div class="pcards">${cards}</div>`;
  }

  // ---------- signal feed ----------
  function renderFeed(e) {
    if (!e.clues.length) { els.feed.innerHTML = `<div class="empty">${t('feed.none')}</div>`; return; }
    const roomName = id => { const r = e.sc.LAYOUT.rooms.find(x => x.id === id); return r ? loc(r.name) : id; };
    els.feed.innerHTML = [...e.clues].slice(-9).reverse().map(c => {
      const tag = c.blocked ? `<span class="tag good">${t('end.blocked')}</span>`
        : c.prevented ? `<span class="tag good">${t('end.prevented')}</span>`
        : c.confidence === 'confirmed' ? `<span class="tag confirmed">${t('clue.confirmed')}</span>`
        : `<span class="tag weak">${t('clue.weak')}</span>`;
      return `<div class="clue ${c.confidence} ${c.resolved?'resolved':''}">
        <span class="clue-icon ev-${c.type}">${icon(c.type)}</span>
        <span class="clue-body"><b>${t('clue.'+c.type)}</b><span class="clue-loc">${t('clue.at')} ${esc(roomName(c.room))}</span></span>${tag}</div>`;
    }).join('');
  }

  // ---------- contextual inspect ----------
  function showInspect(data) {
    if (!data) { clearInspect(); return; }
    els.inspect.className = 'inspect';
    els.inspect.innerHTML = data.html + `<button class="inspect-close" data-act="closeInspect">✕</button>`;
  }
  function clearInspect() { els.inspect.className = 'inspect hidden'; els.inspect.innerHTML = ''; }

  // ---------- Sophia ----------
  function renderSophia(hint, expanded, greet) {
    const body = greet || (hint ? (expanded ? loc(hint.more) : loc(hint.dir)) : '');
    const more = (hint && !expanded && !greet) ? `<button class="linklike" data-act="sophiaMore">${t('sophia.more')} ↓</button>` : '';
    els.sophia.innerHTML = `
      <div class="sophia">
        <div class="sophia-avatar">${icon('sophia')}</div>
        <div class="sophia-text">
          <div class="sophia-name">${t('sophia.name')} <span>· ${t('sophia.role')}</span></div>
          <div class="sophia-body">${esc(body)}</div>
          <div class="sophia-actions">${more}</div>
        </div>
      </div>`;
  }
  function pulseSophia() { els.sophia.classList.remove('min'); els.sophia.classList.add('pulse'); setTimeout(() => els.sophia.classList.remove('pulse'), 1200); }

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
    const win = e.result === 'win';
    const contained = e.log.some(l => l.kind === 'end' && l.contained);
    const summary = win ? (contained ? t('end.win.contained') : t('end.win.survived'))
      : (e.result === 'lose-breach' ? t('end.lose.breach') : t('end.lose.uptime'));
    const attacks = e.log.filter(l => l.kind === 'attack');
    const detected = attacks.filter(a => a.visible || a.blocked || a.prevented).length;
    els.end.className = 'endScreen';
    els.end.innerHTML = `
      <div class="end-inner ${win ? 'win' : 'lose'}">
        <div class="end-top">${brand()}${langBtn()}</div>
        <div class="end-head">
          <div class="end-badge">${win ? icon('check') : icon('attacker')}</div>
          <h1>${win ? t('end.win.title') : t('end.lose.title')}</h1>
          <p>${esc(summary)}</p>
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
      const contained = e.log.some(l => l.kind === 'respond' && l.result === 'contained' && l.t >= a.t);
      let status, cls;
      if (a.blocked) { status = t('end.blocked'); cls = 'good'; }
      else if (a.prevented) { status = t('end.prevented'); cls = 'good'; }
      else if (a.visible) { status = t('end.detected'); cls = 'seen'; }
      else { status = t('end.missed'); cls = 'bad'; }
      return `<li class="tl-row ${cls}" data-step="${i}">
        <span class="tl-time">${Math.round(a.t)}s</span>
        <span class="tl-ev ev-${a.ev}">${icon(a.ev)}</span>
        <span class="tl-truth">${esc(loc(beat.truth) || a.act)} <em>· ${esc(roomName(a.room))}</em></span>
        <span class="tl-status ${cls}">${status}</span></li>`;
    }).join('');
  }
  function hideEnd() { els.end.className = 'hidden'; els.end.innerHTML = ''; }
  function highlightStep(i) {
    els.end.querySelectorAll('.tl-row').forEach(r => r.classList.toggle('active', +r.dataset.step === i));
  }

  // ---------- event delegation ----------
  root.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act;
    const map = {
      start: h.onStart, begin: h.onBeginDay, cancel: h.onCancelPlacing, lang: h.onLang,
      pause: h.onPauseToggle, sophiaMore: h.onSophiaMore, closeInspect: h.onCloseInspect,
      again: h.onAgain, backToGame: h.onBackToGame, replayPlay: h.onReplayPlay,
    };
    if (a === 'pick') return h.onPickProduct(el.dataset.id);
    if (a === 'speed') return h.onSpeed(+el.dataset.s);
    if (a === 'isolate') return h.onIsolate(el.dataset.desk);
    if (a === 'lockdown') return h.onLockdown(el.dataset.room);
    if (a === 'recover') return h.onRecover(el.dataset.room);
    if (map[a]) return map[a]();
  });

  return { els, showStart, hideStart, setPhase, renderHud, renderTray, renderFeed,
           showInspect, clearInspect, renderSophia, pulseSophia, toast, showEnd, hideEnd, highlightStep };
}
