// Defense Stack orchestrator: screens, leaderboard, keyboard, language, sound.

import { createStackGame } from './game-stack.js';
import { rung, LADDER, TOP_TIER } from './tiles.js';
import { makeI18n } from '../arcade/i18n.js';
import { makeBoard } from '../arcade/board.js';
import { brandHTML, boardListHTML, footerHTML, fmt, esc, painter } from '../arcade/ui-kit.js';
import { setMuted, isMuted, resumeAudio } from '../rush/audio.js';

const EN = {
  'sk.title': 'Defense Stack',
  'sk.tag': 'Slide to merge matching layers and climb the Sangfor stack — from a bare asset all the way to the unified platform. How high can you build before the board locks up?',
  'sk.h1': 'Swipe, or use the arrow / WASD keys. Every tile slides; two matching tiles merge into the next product up.',
  'sk.h2': 'Each merge scores and unlocks the next Sangfor layer. Chain merges on one slide for big points.',
  'sk.h3': 'Keep stacking toward the unified Sangfor platform. The run ends when the board fills with no merges left.',
  'sk.best': 'Best',
  'sk.score': 'Score',
  'sk.reached': 'Reached',
  'sk.over': 'Board locked',
  'sk.overSub': 'No moves left. Your stack topped out at {name}.',
  'sk.win': 'Unified platform reached!',
  'sk.winSub': 'You built the full Sangfor stack. Keep going for a higher score.',
  'sk.online': '{name} online',
  'sk.ladder': 'The ladder',
};
const ZH = {
  'sk.title': '防御堆叠',
  'sk.tag': '滑动合并相同的层级，沿深信服安全栈一路向上——从一台裸资产直到统一平台。棋盘锁死之前，你能堆多高？',
  'sk.h1': '滑动或使用方向键 / WASD。所有方块滑动；两个相同方块合并为更高一级的产品。',
  'sk.h2': '每次合并都会得分并解锁下一层深信服能力。一次滑动连续合并可获得高分。',
  'sk.h3': '持续堆叠，冲向统一的深信服平台。当棋盘填满且无可合并时本局结束。',
  'sk.best': '最高',
  'sk.score': '得分',
  'sk.reached': '最高层级',
  'sk.over': '棋盘锁死',
  'sk.overSub': '无路可走。本局最高堆到 {name}。',
  'sk.win': '已抵达统一平台！',
  'sk.winSub': '你搭建了完整的深信服安全栈。继续冲击更高分数。',
  'sk.online': '{name} 已上线',
  'sk.ladder': '产品阶梯',
};

const i18n = makeI18n(EN, ZH);
const { t } = i18n;
const board = makeBoard({ lsKey: 'sentinel.stack.scores.v1', apiVar: '__STACK_API' });
const NAME_KEY = 'sentinel.arcade.name';
const BEST_KEY = 'sentinel.stack.best';

const getName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
const saveName = n => { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } };
const getBest = () => { try { return +localStorage.getItem(BEST_KEY) || 0; } catch { return 0; } };
const saveBest = b => { try { localStorage.setItem(BEST_KEY, String(b)); } catch { /* ignore */ } };

const LINKS = [
  { href: 'sort.html', label: 'Packet Sort' },
  { href: 'panic.html', label: 'Patch Panic' },
  { href: 'rush.html', label: 'Breach Rush' },
];

const app = document.getElementById('app');
app.innerHTML = `
  <div class="ar-top">
    ${brandHTML('Defense Stack')}
    <div class="ar-stats">
      <div class="ar-stat"><span class="k">${esc(t('sk.best'))}</span><span class="v" id="skBest">0</span></div>
      <div class="ar-stat"><span class="k">${esc(t('sk.score'))}</span><span class="v good" id="skScore">0</span></div>
    </div>
  </div>
  <div class="ar-field">
    <div class="sk-wrap">
      <div class="sk-board" id="skBoard">
        ${Array.from({ length: 16 }, () => '<div class="sk-cell"></div>').join('')}
      </div>
      <div class="sk-ladder" id="skLadder"></div>
    </div>
  </div>
  <div class="ar-toasts" id="skToasts"></div>
  <div id="skOverlay"></div>
`;

const el = {
  best: document.getElementById('skBest'),
  score: document.getElementById('skScore'),
  boardEl: document.getElementById('skBoard'),
  ladder: document.getElementById('skLadder'),
  toasts: document.getElementById('skToasts'),
  overlay: document.getElementById('skOverlay'),
};
const paintScore = painter();

renderLadder();
function renderLadder() {
  el.ladder.innerHTML = `<div class="sk-ladder-h">${esc(t('sk.ladder'))}</div>` +
    LADDER.map(g => `<div class="sk-rung sk-t${g.tier}"><span class="sk-rung-s">${g.short}</span><span class="sk-rung-n">${esc(localName(g))}</span></div>`).join('');
}
function localName(g) {
  // product rungs read nicer with the catalog name; keep EN short names intact
  return g.name;
}

const game = createStackGame(el.boardEl, {
  onScore: (score, best) => {
    paintScore(el.score, fmt(score));
    el.best.textContent = fmt(Math.max(best, getBest()));
  },
  onMilestone: (g, isWin) => {
    if (isWin) toast(t('sk.win'), 'good', true);
    else toast(t('sk.online', { name: `${g.short} · ${g.name}` }), 'good');
  },
  onOver: summary => onGameOver(summary),
});

let lastSummary = null;
let lastResult = null;
let phase = 'start';

function toast(msg, kind = '', big = false) {
  const n = document.createElement('div');
  n.className = `ar-toast ${kind} ${big ? 'big' : ''}`.trim();
  n.textContent = msg;
  el.toasts.appendChild(n);
  setTimeout(() => n.remove(), big ? 2200 : 1500);
}

// ---------- start screen ----------
async function showStart() {
  phase = 'start';
  const b = await board.fetchBoard();
  el.best.textContent = fmt(getBest());
  el.overlay.innerHTML = `
    <div class="ar-overlay" id="startOv">
      <div class="ar-card">
        ${brandHTML('Defense Stack')}
        <h1 class="ar-title">Defense <span class="em">Stack</span></h1>
        <p class="ar-tag">${esc(t('sk.tag'))}</p>
        <p class="ar-field-label">${esc(t('ui.name'))}</p>
        <input class="ar-name" id="nameIn" maxlength="14" placeholder="${esc(t('ui.namePh'))}" value="${esc(getName())}" />
        <ol class="ar-how">
          <li><span class="n">1</span><span>${esc(t('sk.h1'))}</span></li>
          <li><span class="n">2</span><span>${esc(t('sk.h2'))}</span></li>
          <li><span class="n">3</span><span>${esc(t('sk.h3'))}</span></li>
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

// ---------- over screen ----------
async function onGameOver(summary) {
  lastSummary = summary;
  phase = 'over';
  if (summary.best > getBest()) saveBest(summary.best);
  lastResult = null;
  renderOver(summary, null);
  const result = await board.submitScore({ name: getName() || 'Anonymous', score: summary.score, note: summary.rung.short });
  lastResult = result;
  renderOver(summary, result);
}

function renderOver(summary, result) {
  const g = summary.rung;
  const isWin = summary.maxTier >= TOP_TIER;
  const meId = result?.id;
  el.overlay.innerHTML = `
    <div class="ar-overlay">
      <div class="ar-card">
        ${brandHTML('Defense Stack')}
        <h1 class="ar-title" style="font-size:22px">${esc(isWin ? t('sk.win') : t('sk.over'))}</h1>
        <div class="ar-result">
          <div class="lbl">${esc(t('ui.score'))}</div>
          <div class="big">${fmt(summary.score)}</div>
          <div class="sub">${esc(isWin ? t('sk.winSub') : t('sk.overSub', { name: `${g.short} · ${g.name}` }))}</div>
          ${result ? `<div class="sub">${esc(t('ui.youRank'))}<span class="hot">${result.rank}</span> · ${esc(result.mode === 'world' ? t('ui.world') : t('ui.local'))}</div>` : ''}
        </div>
        <div class="ar-meta">
          <div class="m"><span class="k">${esc(t('sk.best'))}</span><span class="v">${fmt(Math.max(summary.best, getBest()))}</span></div>
          <div class="m"><span class="k">${esc(t('sk.reached'))}</span><span class="v">${esc(g.short)}</span></div>
        </div>
        ${result ? boardBlock(result, meId) : ''}
        <div class="ar-row">
          <button class="btn ghost" data-act="quit">${esc(t('ui.quit'))}</button>
          <button class="btn primary" data-act="again">${esc(t('ui.again'))}</button>
        </div>
        <button class="linklike block" data-act="share" style="display:block;margin:10px auto 0;text-align:center">${esc(t('ui.share'))}</button>
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
  else if (act === 'lang') { i18n.toggleLang(); rerender(); }
  else if (act === 'mute') { setMuted(!isMuted()); rerender(); }
  else if (act === 'share') shareResult(e.target);
});

async function shareResult(elm) {
  if (!lastSummary) return;
  const text = `Sentinel · Defense Stack — ${fmt(lastSummary.score)} pts (reached ${lastSummary.rung.short})`;
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  const old = elm.textContent; elm.textContent = t('ui.copied');
  setTimeout(() => { elm.textContent = old; }, 1400);
}

function rerender() {
  renderLadder();
  // relabel the two top-bar stats (best, score)
  const ks = document.querySelectorAll('.ar-stat .k');
  if (ks[0]) ks[0].textContent = t('sk.best');
  if (ks[1]) ks[1].textContent = t('sk.score');
  if (phase === 'over' && lastSummary) renderOver(lastSummary, lastResult);
  else if (phase === 'start') showStart();
}

window.addEventListener('keydown', e => {
  if (phase !== 'play') return;
  const k = e.key.toLowerCase();
  const map = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down' };
  if (map[k]) { e.preventDefault(); game.move(map[k]); }
});

showStart();
window.__stack = { game, board, i18n };
