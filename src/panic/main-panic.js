// Patch Panic orchestrator: grid build, screens, HUD, MDR sweep, leaderboard, language.

import { createPanicGame } from './game-panic.js';
import { START_LIVES, ENERGY_MAX } from './rules-panic.js';
import { makeI18n } from '../arcade/i18n.js';
import { makeBoard } from '../arcade/board.js';
import { brandHTML, boardListHTML, footerHTML, fmt, esc, painter } from '../arcade/ui-kit.js';
import { setMuted, isMuted, resumeAudio } from '../rush/audio.js';

const GRID = 9;   // 3x3 endpoints

const EN = {
  'pp.title': 'Patch Panic',
  'pp.tag': 'Threats are popping across your endpoints. Tap each one to let Endpoint Secure neutralise it before its fuse blows — but never tap a real user. Keep the fleet clean as the pace climbs.',
  'pp.h1': 'Tap a threat (MAL / EXP / RAN) before its ring burns down. Ransomware (RAN) takes a few taps.',
  'pp.h2': 'Never tap a USR tile — that is a real user, and a false positive breaks your combo.',
  'pp.h3': 'Three detonations ends the run. Fill the bar, then fire an MDR Sweep to clear the board.',
  'pp.sweep': 'MDR Sweep',
  'pp.over': 'Fleet overrun',
  'pp.overSub': 'Three endpoints breached. You neutralised {n} threats and held for {s}s.',
  'pp.cleared': 'Neutralised',
  'pp.streak': 'Best streak',
  'pp.held': 'Held',
  'fb.breach': 'Endpoint breached!',
  'fb.false': 'False positive! That was a real user.',
  'fb.sweep': 'MDR Sweep — {n} cleared',
  'fb.sweepEmpty': 'MDR Sweep ready',
};
const ZH = {
  'pp.title': '补丁狂潮',
  'pp.tag': '威胁正在各终端上冒头。在引信烧完之前点掉每一个，让终端安全处置它——但千万别点真实用户。随着节奏加快，保持终端整洁。',
  'pp.h1': '在光环烧尽前点击威胁（MAL / EXP / RAN）。勒索软件（RAN）需要点几下。',
  'pp.h2': '绝不要点 USR 方块——那是真实用户，误报会打断连击。',
  'pp.h3': '三次引爆本局结束。蓄满能量条即可释放 MDR 清扫，清空全场。',
  'pp.sweep': 'MDR 清扫',
  'pp.over': '终端失守',
  'pp.overSub': '三台终端被攻陷。你处置了 {n} 个威胁，坚持了 {s} 秒。',
  'pp.cleared': '已处置',
  'pp.streak': '最高连击',
  'pp.held': '坚持',
  'fb.breach': '终端被攻陷！',
  'fb.false': '误报！那是真实用户。',
  'fb.sweep': 'MDR 清扫——清除 {n} 个',
  'fb.sweepEmpty': 'MDR 清扫就绪',
};

const i18n = makeI18n(EN, ZH);
const { t } = i18n;
const board = makeBoard({ lsKey: 'sentinel.panic.scores.v1', apiVar: '__PANIC_API' });
const NAME_KEY = 'sentinel.arcade.name';
const BEST_KEY = 'sentinel.panic.best';
const getName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
const saveName = n => { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } };
const getBest = () => { try { return +localStorage.getItem(BEST_KEY) || 0; } catch { return 0; } };
const saveBest = b => { try { localStorage.setItem(BEST_KEY, String(b)); } catch { /* ignore */ } };

const LINKS = [
  { href: 'stack.html', label: 'Defense Stack' },
  { href: 'sort.html', label: 'Packet Sort' },
  { href: 'rush.html', label: 'Breach Rush' },
];

const app = document.getElementById('app');
app.innerHTML = `
  <div class="ar-top">
    ${brandHTML('Patch Panic')}
    <div class="ar-stats">
      <div class="pp-lives" id="ppLives"></div>
      <div class="ar-combo" id="ppCombo">x1</div>
      <div class="ar-stat"><span class="k">${esc(t('ui.score'))}</span><span class="v good" id="ppScore">0</span></div>
      <div class="ar-stat"><span class="k">${esc(t('ui.best'))}</span><span class="v" id="ppBest">0</span></div>
    </div>
  </div>
  <div class="ar-field">
    <div class="pp-grid" id="ppGrid">
      ${Array.from({ length: GRID }, () => '<div class="pp-cell"></div>').join('')}
    </div>
  </div>
  <div class="ar-ctrls">
    <button class="pp-sweep" id="ppSweep" disabled>
      <i class="pp-sweep-fill" id="ppSweepFill"></i>
      <span class="pp-sweep-lbl">${esc(t('pp.sweep'))}</span>
    </button>
  </div>
  <div class="ar-toasts" id="ppToasts"></div>
  <div id="ppOverlay"></div>
`;

const el = {
  lives: document.getElementById('ppLives'),
  combo: document.getElementById('ppCombo'),
  score: document.getElementById('ppScore'),
  best: document.getElementById('ppBest'),
  grid: document.getElementById('ppGrid'),
  sweep: document.getElementById('ppSweep'),
  sweepFill: document.getElementById('ppSweepFill'),
  toasts: document.getElementById('ppToasts'),
  overlay: document.getElementById('ppOverlay'),
};
const paintScore = painter();
let phase = 'start', lastSummary = null, lastResult = null;

const game = createPanicGame(el.grid, {
  onHud: h => {
    paintScore(el.score, fmt(h.score));
    el.best.textContent = fmt(Math.max(h.best, getBest()));
    el.lives.innerHTML = Array.from({ length: START_LIVES }, (_, i) =>
      `<span class="pp-life${i < h.lives ? '' : ' out'}"></span>`).join('');
    el.combo.textContent = 'x' + h.mult;
    el.combo.classList.toggle('on', h.combo >= 6);
    el.sweepFill.style.width = (h.energy / ENERGY_MAX * 100) + '%';
    el.sweep.classList.toggle('ready', h.canSweep);
    el.sweep.disabled = !h.canSweep;
  },
  onFeedback: fb => {
    if (fb.kind === 'kill') { if (fb.boss) toast('+' + fb.pts, 'good'); }
    else if (fb.kind === 'breach') toast(t('fb.breach'), 'bad');
    else if (fb.kind === 'false') toast(t('fb.false'), 'bad');
    else if (fb.kind === 'sweep') toast(t('fb.sweep', { n: fb.n }), 'good');
  },
  onOver: summary => onGameOver(summary),
});

function toast(msg, kind = '') {
  const n = document.createElement('div');
  n.className = `ar-toast ${kind}`.trim();
  n.textContent = msg;
  el.toasts.appendChild(n);
  setTimeout(() => n.remove(), 1100);
}

// ---------- screens ----------
async function showStart() {
  phase = 'start';
  const b = await board.fetchBoard();
  el.best.textContent = fmt(getBest());
  el.lives.innerHTML = Array.from({ length: START_LIVES }, () => '<span class="pp-life"></span>').join('');
  el.overlay.innerHTML = `
    <div class="ar-overlay">
      <div class="ar-card">
        ${brandHTML('Patch Panic')}
        <h1 class="ar-title">Patch <span class="em">Panic</span></h1>
        <p class="ar-tag">${esc(t('pp.tag'))}</p>
        <p class="ar-field-label">${esc(t('ui.name'))}</p>
        <input class="ar-name" id="nameIn" maxlength="14" placeholder="${esc(t('ui.namePh'))}" value="${esc(getName())}" />
        <ol class="ar-how">
          <li><span class="n">1</span><span>${esc(t('pp.h1'))}</span></li>
          <li><span class="n">2</span><span>${esc(t('pp.h2'))}</span></li>
          <li><span class="n">3</span><span>${esc(t('pp.h3'))}</span></li>
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
  const result = await board.submitScore({ name: getName() || 'Anonymous', score: summary.score, note: summary.elapsed + 's' });
  lastResult = result;
  renderOver(summary, result);
}

function renderOver(summary, result) {
  const meId = result?.id;
  el.overlay.innerHTML = `
    <div class="ar-overlay">
      <div class="ar-card">
        ${brandHTML('Patch Panic')}
        <h1 class="ar-title" style="font-size:22px">${esc(t('pp.over'))}</h1>
        <div class="ar-result">
          <div class="lbl">${esc(t('ui.score'))}</div>
          <div class="big">${fmt(summary.score)}</div>
          <div class="sub">${esc(t('pp.overSub', { n: summary.cleared, s: summary.elapsed }))}</div>
          ${result ? `<div class="sub">${esc(t('ui.youRank'))}<span class="hot">${result.rank}</span> · ${esc(result.mode === 'world' ? t('ui.world') : t('ui.local'))}</div>` : ''}
        </div>
        <div class="ar-meta">
          <div class="m"><span class="k">${esc(t('pp.cleared'))}</span><span class="v">${fmt(summary.cleared)}</span></div>
          <div class="m"><span class="k">${esc(t('pp.streak'))}</span><span class="v">${summary.maxCombo}</span></div>
          <div class="m"><span class="k">${esc(t('pp.held'))}</span><span class="v">${summary.elapsed}s</span></div>
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
  else if (act === 'lang') { i18n.toggleLang(); relabel(); rerender(); }
  else if (act === 'mute') { setMuted(!isMuted()); rerender(); }
  else if (act === 'share') shareResult(e.target);
});

el.sweep.addEventListener('click', () => game.sweep());
window.addEventListener('keydown', e => {
  if (phase === 'play' && (e.key === ' ' || e.code === 'Space')) { e.preventDefault(); game.sweep(); }
});

async function shareResult(elm) {
  if (!lastSummary) return;
  const text = `Sentinel · Patch Panic — ${fmt(lastSummary.score)} pts (${lastSummary.cleared} threats cleared)`;
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  const old = elm.textContent; elm.textContent = t('ui.copied');
  setTimeout(() => { elm.textContent = old; }, 1400);
}

function relabel() {
  el.sweep.querySelector('.pp-sweep-lbl').textContent = t('pp.sweep');
  const ks = document.querySelectorAll('.ar-stat .k');
  if (ks[0]) ks[0].textContent = t('ui.score');
  if (ks[1]) ks[1].textContent = t('ui.best');
}

function rerender() {
  if (phase === 'over' && lastSummary) renderOver(lastSummary, lastResult);
  else if (phase === 'start') showStart();
}

showStart();
window.__panic = { game, board, i18n };
