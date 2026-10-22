// Breach Rush orchestrator: wires the canvas game, the DOM overlay, the leaderboard
// and keyboard/lifecycle. Entry point loaded by rush.html.

import { createGame } from './game-rush.js';
import { createRushUI } from './ui-rush.js';
import { fetchBoard, submitScore } from './leaderboard.js';
import { t, toggleLang } from './i18n-rush.js';
import { setMuted, isMuted, resumeAudio } from './audio.js';

const NAME_KEY = 'sentinel.rush.name';
const canvas = document.getElementById('scene');
const overlay = document.getElementById('overlay');

let lastSummary = null;     // latest game-over summary (for re-render on board arrival)

const game = createGame(canvas, {
  onHud: hud => ui.renderHud(hud),
  onToast: (key, kind) => ui.toast(key, kind),
  onOver: summary => onGameOver(summary),
});

const ui = createRushUI(overlay, {
  onStart: name => startGame(name),
  onAbility: id => game.useAbility(id),
  onPause: () => { game.pause(); ui.setPhase('paused'); ui.showPause(); },
  onResume: () => { ui.hidePause(); ui.setPhase('playing'); game.resume(); },
  onQuit: () => quitToStart(),
  onRestart: () => startGame(getSavedName()),
  onLang: () => { toggleLang(); rerender(); },
  onMute: () => { setMuted(!isMuted()); rerender(); },
  onShare: (score, el) => shareResult(score, el),
});

function getSavedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } }

async function boot() {
  ui.setPhase('idle');
  ui.showStart(null, getSavedName());
  const board = await fetchBoard();
  ui.showStart(board, getSavedName());   // repaint with real scores
}

function startGame(name) {
  resumeAudio();
  const n = (name || '').trim();
  if (n) saveName(n);
  lastSummary = null;
  ui.hideStart(); ui.hidePause(); ui.els.over.classList.add('hidden');
  ui.setPhase('playing');
  game.start();
}

function quitToStart() {
  game.toIdle();
  ui.hidePause();
  ui.setPhase('idle');
  boot();
}

async function onGameOver(summary) {
  lastSummary = summary;
  ui.setPhase('over');
  // show immediately with local-only ranking, then enrich once the submit resolves
  ui.showOver(summary, null);
  const name = getSavedName() || ui.getName();
  const result = await submitScore({ name, score: summary.score, stage: summary.stage, elapsed: summary.elapsed });
  // tag which row is "me" (most recent submit with our score)
  const mine = result.rows.find(r => r.score === summary.score && r.name);
  result.submittedId = mine?.id;
  ui.setOverBoard(summary, result);
}

function rerender() {
  if (lastSummary && !ui.els.over.classList.contains('hidden')) ui.showOver(lastSummary, null);
  else if (!ui.els.start.classList.contains('hidden')) boot();
  // HUD/dock repaint on next frame via game's onHud
}

async function shareResult(score, el) {
  const text = `Sentinel · Breach Rush — ${score.toLocaleString()} pts`;
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  const old = el.textContent; el.textContent = t('over.copied');
  setTimeout(() => { el.textContent = old; }, 1400);
}

// keyboard
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  const s = game.state.phase;
  if (e.key === '1') game.useAbility('purge');
  else if (e.key === '2') game.useAbility('slow');
  else if (e.key === '3') game.useAbility('scan');
  else if (e.key.toLowerCase() === 'p') { if (s === 'playing') { game.pause(); ui.setPhase('paused'); ui.showPause(); } else if (s === 'paused') { ui.hidePause(); ui.setPhase('playing'); game.resume(); } }
  else if (e.key.toLowerCase() === 'm') { setMuted(!isMuted()); rerender(); }
});

boot();

// expose for headless tests / screenshots
window.__rush = { game, ui, startGame, fetchBoard, submitScore };
