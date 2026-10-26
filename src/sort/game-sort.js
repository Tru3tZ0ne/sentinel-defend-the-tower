// Packet Sort engine: session lifecycle, decision timer, scoring, lives. All rendering
// and text is delegated to the host (so language lives in one place). Logic in deck.js.

import { makeCard, timeAt, scoreFor, isCorrect, verdict, levelAt, START_LIVES } from './deck.js';
import { sfx } from '../rush/audio.js';

const FEEDBACK_MS = 300;

export function createSortGame({ renderCard, setBar, onHud, onFeedback, onOver }) {
  let score = 0, best = 0, combo = 0, maxCombo = 0, lives = START_LIVES, solved = 0, correctCount = 0;
  let card = null, startTs = 0, duration = 0, accepting = false, phase = 'idle', raf = 0;

  function hud() {
    onHud && onHud({ score, best, combo, lives, level: levelAt(solved), solved: correctCount });
  }

  function loop() {
    if (phase !== 'play') return;
    raf = requestAnimationFrame(loop);
    if (!accepting) return;
    const frac = 1 - (performance.now() - startTs) / duration;
    setBar && setBar(Math.max(0, frac));
    if (frac <= 0) resolve(null);   // timed out
  }

  function nextCard() {
    card = makeCard(solved);
    duration = timeAt(card.level);
    startTs = performance.now();
    accepting = true;
    renderCard && renderCard(card);
    setBar && setBar(1);
  }

  function resolve(action) {
    if (!accepting) return;
    accepting = false;
    const frac = Math.max(0, 1 - (performance.now() - startTs) / duration);
    const correct = action != null && isCorrect(card, action);
    const correctAction = verdict(card);

    if (correct) {
      const pts = scoreFor({ timeFrac: frac, combo });
      score += pts; combo++; correctCount++;
      maxCombo = Math.max(maxCombo, combo);
      if (score > best) best = score;
      sfx.hit(Math.min(24, combo * 2));
      onFeedback && onFeedback({ correct: true, action, correctAction, card, pts });
    } else {
      lives--; combo = 0;
      sfx.wrong();
      onFeedback && onFeedback({ correct: false, action, correctAction, card, timeout: action == null });
    }
    solved++;
    hud();

    if (lives <= 0) { finish(); return; }
    setBar && setBar(0);
    setTimeout(() => { if (phase === 'play') nextCard(); }, FEEDBACK_MS);
  }

  function finish() {
    phase = 'over';
    cancelAnimationFrame(raf);
    sfx.over();
    onOver && onOver({ score, best, cleared: correctCount, maxCombo, level: levelAt(solved) });
  }

  return {
    start() {
      score = 0; combo = 0; maxCombo = 0; lives = START_LIVES; solved = 0; correctCount = 0;
      phase = 'play'; sfx.start(); hud(); nextCard();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    },
    act(action) { if (phase === 'play' && accepting) resolve(action); },
    peekVerdict() { return card ? verdict(card) : null; },   // headless-test hook
    stop() { phase = 'idle'; cancelAnimationFrame(raf); },
    setBest(b) { best = b || 0; },
    get state() { return { phase, score, best, lives, accepting }; },
  };
}
