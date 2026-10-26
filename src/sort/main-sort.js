// Packet Sort orchestrator: screens, card rendering, input, leaderboard, language.

import { createSortGame } from './game-sort.js';
import { SIGNALS, START_LIVES } from './deck.js';
import { makeI18n } from '../arcade/i18n.js';
import { makeBoard } from '../arcade/board.js';
import { brandHTML, boardListHTML, footerHTML, fmt, esc, painter } from '../arcade/ui-kit.js';
import { setMuted, isMuted, resumeAudio } from '../rush/audio.js';

const EN = {
  'so.title': 'Packet Sort',
  'so.tag': 'Sessions hit the firewall faster than any analyst can read a policy. Clear the clean ones, block the hostile ones — before the timer drains. Learn the tells and keep the combo alive.',
  'so.h1': 'Each card is one live session. Read its signals, then call it before time runs out.',
  'so.h2': 'ALLOW clean traffic; BLOCK anything hostile. Use the buttons, Arrow keys, or swipe the card.',
  'so.h3': 'A fast, correct call scores more and builds your combo. Three wrong calls ends the run.',
  'so.q': 'Allow or block?',
  'so.block': 'Block',
  'so.allow': 'Allow',
  'so.lvl': 'LVL',
  'so.good': '+{pts}',
  'so.missBlock': 'Hostile! {why}',
  'so.missAllow': 'That was clean traffic.',
  'so.timeout': 'Too slow!',
  'so.over': 'Session flooded',
  'so.overSub': 'Three bad calls. You cleared {n} sessions and reached level {lvl}.',
  'so.cleared': 'Cleared',
  'so.streak': 'Best streak',
  'so.verdictB': 'BLOCK',
  'so.verdictA': 'ALLOW',
};
const ZH = {
  'so.title': '流量分拣',
  'so.tag': '会话涌向防火墙的速度，比任何分析师读一条策略都快。在计时条耗尽前放行干净流量、拦截恶意流量。记住特征，保持连击。',
  'so.h1': '每张卡片是一次实时会话。读懂它的信号，在时间耗尽前作出判断。',
  'so.h2': '放行干净流量，拦截任何恶意流量。可用按钮、方向键或滑动卡片。',
  'so.h3': '又快又准的判断得分更高并累积连击。三次误判本局结束。',
  'so.q': '放行还是拦截？',
  'so.block': '拦截',
  'so.allow': '放行',
  'so.lvl': '等级',
  'so.good': '+{pts}',
  'so.missBlock': '恶意流量！{why}',
  'so.missAllow': '这是干净流量。',
  'so.timeout': '太慢了！',
  'so.over': '会话洪流',
  'so.overSub': '三次误判。你清理了 {n} 个会话，到达第 {lvl} 级。',
  'so.cleared': '已清理',
  'so.streak': '最高连击',
  'so.verdictB': '应拦截',
  'so.verdictA': '应放行',
};

const i18n = makeI18n(EN, ZH);
const { t } = i18n;
const loc = key => SIGNALS[key][i18n.getLang()] || SIGNALS[key].en;
const board = makeBoard({ lsKey: 'sentinel.sort.scores.v1', apiVar: '__SORT_API' });
const NAME_KEY = 'sentinel.arcade.name';
const BEST_KEY = 'sentinel.sort.best';
const getName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
const saveName = n => { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } };
const getBest = () => { try { return +localStorage.getItem(BEST_KEY) || 0; } catch { return 0; } };
const saveBest = b => { try { localStorage.setItem(BEST_KEY, String(b)); } catch { /* ignore */ } };

const LINKS = [
  { href: 'stack.html', label: 'Defense Stack' },
  { href: 'panic.html', label: 'Patch Panic' },
  { href: 'rush.html', label: 'Breach Rush' },
];

const app = document.getElementById('app');
app.innerHTML = `
  <div class="ar-top">
    ${brandHTML('Packet Sort')}
    <div class="ar-stats">
      <div class="so-lives" id="soLives"></div>
      <div class="ar-combo" id="soCombo">x1</div>
      <div class="ar-stat"><span class="k">${esc(t('ui.score'))}</span><span class="v good" id="soScore">0</span></div>
      <div class="ar-stat"><span class="k">${esc(t('ui.best'))}</span><span class="v" id="soBest">0</span></div>
    </div>
  </div>
  <div class="ar-field">
    <div class="so-stage">
      <div class="so-card" id="soCard">
        <div class="so-timer"><i class="so-bar" id="soBar"></i></div>
        <div class="so-body" id="soBody"></div>
      </div>
      <div class="so-actions">
        <button class="so-btn block" data-act="block"><span class="so-key">&larr;</span> ${esc(t('so.block'))}</button>
        <button class="so-btn allow" data-act="allow">${esc(t('so.allow'))} <span class="so-key">&rarr;</span></button>
      </div>
    </div>
  </div>
  <div class="ar-toasts" id="soToasts"></div>
  <div id="soOverlay"></div>
`;

const el = {
  lives: document.getElementById('soLives'),
  combo: document.getElementById('soCombo'),
  score: document.getElementById('soScore'),
  best: document.getElementById('soBest'),
  card: document.getElementById('soCard'),
  body: document.getElementById('soBody'),
  bar: document.getElementById('soBar'),
  toasts: document.getElementById('soToasts'),
  overlay: document.getElementById('soOverlay'),
};
const paintScore = painter();

let phase = 'start', lastSummary = null, lastResult = null;

const game = createSortGame({
  renderCard: card => {
    el.card.classList.remove('ok', 'bad');
    el.body.innerHTML = `
      <div class="so-head">
        <span class="so-proto">${esc(card.proto)}</span>
        <span class="so-flow">${esc(card.srcIp)} <b>&rarr;</b> :${card.port}</span>
        <span class="so-lvl">${esc(t('so.lvl'))} ${card.level}</span>
      </div>
      <div class="so-q">${esc(t('so.q'))}</div>
      <div class="so-signals">
        ${card.signals.map(s => `<span class="so-sig">${esc(loc(s.key))}</span>`).join('')}
      </div>`;
  },
  setBar: frac => {
    el.bar.style.width = (frac * 100).toFixed(1) + '%';
    el.bar.classList.toggle('hot', frac < 0.34);
  },
  onHud: h => {
    paintScore(el.score, fmt(h.score));
    el.best.textContent = fmt(Math.max(h.best, getBest()));
    el.lives.innerHTML = Array.from({ length: START_LIVES }, (_, i) =>
      `<span class="so-life${i < h.lives ? '' : ' out'}"></span>`).join('');
    const m = Math.min(5, 1 + Math.floor(h.combo / 5));
    el.combo.textContent = 'x' + m;
    el.combo.classList.toggle('on', h.combo >= 5);
  },
  onFeedback: fb => {
    el.card.classList.add(fb.correct ? 'ok' : 'bad');
    if (fb.correct) {
      toast(t('so.good', { pts: fb.pts }), 'good');
    } else if (fb.timeout) {
      toast(t('so.timeout'), 'bad');
    } else if (fb.correctAction === 'block') {
      const why = loc(fb.card.signals.find(s => s.bad).key);
      toast(t('so.missBlock', { why }), 'bad');
    } else {
      toast(t('so.missAllow'), 'bad');
    }
  },
  onOver: summary => onGameOver(summary),
});

function toast(msg, kind = '') {
  const n = document.createElement('div');
  n.className = `ar-toast ${kind}`.trim();
  n.textContent = msg;
  el.toasts.appendChild(n);
  setTimeout(() => n.remove(), 1200);
}

// ---------- screens ----------
async function showStart() {
  phase = 'start';
  const b = await board.fetchBoard();
  el.best.textContent = fmt(getBest());
  el.lives.innerHTML = Array.from({ length: START_LIVES }, () => '<span class="so-life"></span>').join('');
  el.overlay.innerHTML = `
    <div class="ar-overlay">
      <div class="ar-card">
        ${brandHTML('Packet Sort')}
        <h1 class="ar-title">Packet <span class="em">Sort</span></h1>
        <p class="ar-tag">${esc(t('so.tag'))}</p>
        <p class="ar-field-label">${esc(t('ui.name'))}</p>
        <input class="ar-name" id="nameIn" maxlength="14" placeholder="${esc(t('ui.namePh'))}" value="${esc(getName())}" />
        <ol class="ar-how">
          <li><span class="n">1</span><span>${esc(t('so.h1'))}</span></li>
          <li><span class="n">2</span><span>${esc(t('so.h2'))}</span></li>
          <li><span class="n">3</span><span>${esc(t('so.h3'))}</span></li>
        </ol>
        <button class="btn primary big block" data-act="play">${esc(t('ui.play'))}</button>
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

async function onGameOver(summary) {
  phase = 'over'; lastSummary = summary; lastResult = null;
  if (summary.best > getBest()) saveBest(summary.best);
  renderOver(summary, null);
  const result = await board.submitScore({ name: getName() || 'Anonymous', score: summary.score, note: 'L' + summary.level });
  lastResult = result;
  renderOver(summary, result);
}

function renderOver(summary, result) {
  const meId = result?.id;
  el.overlay.innerHTML = `
    <div class="ar-overlay">
      <div class="ar-card">
        ${brandHTML('Packet Sort')}
        <h1 class="ar-title" style="font-size:22px">${esc(t('so.over'))}</h1>
        <div class="ar-result">
          <div class="lbl">${esc(t('ui.score'))}</div>
          <div class="big">${fmt(summary.score)}</div>
          <div class="sub">${esc(t('so.overSub', { n: summary.cleared, lvl: summary.level }))}</div>
          ${result ? `<div class="sub">${esc(t('ui.youRank'))}<span class="hot">${result.rank}</span> · ${esc(result.mode === 'world' ? t('ui.world') : t('ui.local'))}</div>` : ''}
        </div>
        <div class="ar-meta">
          <div class="m"><span class="k">${esc(t('so.cleared'))}</span><span class="v">${fmt(summary.cleared)}</span></div>
          <div class="m"><span class="k">${esc(t('so.streak'))}</span><span class="v">${summary.maxCombo}</span></div>
          <div class="m"><span class="k">${esc(t('ui.best'))}</span><span class="v">${fmt(Math.max(summary.best, getBest()))}</span></div>
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
  el.overlay.innerHTML = '';
  phase = 'play';
  game.setBest(getBest());
  game.start();
}

// ---------- events ----------
el.overlay.addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'play' || act === 'again') play();
  else if (act === 'quit') showStart();
  else if (act === 'lang') { i18n.toggleLang(); rebuildStatic(); rerender(); }
  else if (act === 'mute') { setMuted(!isMuted()); rerender(); }
  else if (act === 'share') shareResult(e.target);
});

document.querySelector('.so-actions').addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act) game.act(act);
});

// swipe the card
let sx = 0, tracking = false;
el.card.addEventListener('touchstart', e => { sx = e.touches[0].clientX; tracking = true; }, { passive: true });
el.card.addEventListener('touchend', e => {
  if (!tracking) return; tracking = false;
  const dx = e.changedTouches[0].clientX - sx;
  if (dx < -40) game.act('block'); else if (dx > 40) game.act('allow');
}, { passive: true });

window.addEventListener('keydown', e => {
  if (phase !== 'play') return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); game.act('block'); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); game.act('allow'); }
});

async function shareResult(elm) {
  if (!lastSummary) return;
  const text = `Sentinel · Packet Sort — ${fmt(lastSummary.score)} pts (${lastSummary.cleared} sessions cleared)`;
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  const old = elm.textContent; elm.textContent = t('ui.copied');
  setTimeout(() => { elm.textContent = old; }, 1400);
}

// the action buttons + score labels carry text, so relabel on language flip
function rebuildStatic() {
  const btns = document.querySelectorAll('.so-actions .so-btn');
  if (btns[0]) btns[0].innerHTML = `<span class="so-key">&larr;</span> ${esc(t('so.block'))}`;
  if (btns[1]) btns[1].innerHTML = `${esc(t('so.allow'))} <span class="so-key">&rarr;</span>`;
  const ks = document.querySelectorAll('.ar-stat .k');
  if (ks[0]) ks[0].textContent = t('ui.score');
  if (ks[1]) ks[1].textContent = t('ui.best');
}

function rerender() {
  if (phase === 'over' && lastSummary) renderOver(lastSummary, lastResult);
  else if (phase === 'start') showStart();
}

showStart();
window.__sort = { game, board, i18n };
