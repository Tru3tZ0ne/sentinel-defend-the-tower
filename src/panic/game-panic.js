// Patch Panic engine: endpoint grid, spawner, burning fuses, taps, energy sweep, lives.
// Pure tuning lives in rules-panic.js.

import { POPS, START_LIVES, ENERGY_MAX, ENERGY_PER_KILL, SWEEP_SCORE, FALSE_POSITIVE,
  difficultyAt, spawnPick, fuseFor, comboMult, killScore } from './rules-panic.js';
import { sfx } from '../rush/audio.js';

const RING_R = 26;
const CIRC = 2 * Math.PI * RING_R;

export function createPanicGame(grid, { onHud, onFeedback, onOver } = {}) {
  const cells = [...grid.querySelectorAll('.pp-cell')];
  const active = new Map();   // cellIdx -> { type, hp, el, timer }
  let score = 0, best = 0, combo = 0, maxCombo = 0, lives = START_LIVES, energy = 0, cleared = 0;
  let startTs = 0, running = false, spawnT = 0, hudT = 0;

  const elapsed = () => (performance.now() - startTs) / 1000;

  function hud() {
    onHud && onHud({ score, best, combo, lives, energy, cleared,
      elapsed: elapsed(), mult: comboMult(combo), canSweep: energy >= ENERGY_MAX });
  }

  function popHTML(type, hp) {
    const spec = POPS[type];
    const hpDots = spec.hp > 1 ? `<span class="pp-hp">${'●'.repeat(hp)}</span>` : '';
    return `<svg class="pp-ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="${RING_R}" /></svg>` +
      `<span class="pp-label">${spec.label}</span>${hpDots}`;
  }

  function spawn() {
    const t = elapsed();
    const d = difficultyAt(t);
    if (active.size < d.maxActive) {
      const free = cells.map((_, i) => i).filter(i => !active.has(i));
      if (free.length) {
        const idx = free[(Math.random() * free.length) | 0];
        const type = spawnPick(t);
        const fuse = fuseFor(type, t);
        const el = document.createElement('button');
        el.className = `pp-pop pp-${type}`;
        el.innerHTML = popHTML(type, POPS[type].hp);
        const ring = el.querySelector('.pp-ring circle');
        ring.style.strokeDasharray = CIRC;
        ring.style.animation = `pp-drain ${fuse}ms linear forwards`;
        cells[idx].appendChild(el);
        requestAnimationFrame(() => el.classList.add('in'));
        const rec = { type, hp: POPS[type].hp, el, timer: setTimeout(() => expire(idx), fuse) };
        active.set(idx, rec);
      }
    }
    spawnT = setTimeout(spawn, d.spawnInterval);
  }

  function removePop(idx, cls) {
    const rec = active.get(idx); if (!rec) return;
    clearTimeout(rec.timer);
    active.delete(idx);
    rec.el.classList.add(cls);
    rec.el.style.pointerEvents = 'none';
    setTimeout(() => rec.el.remove(), 170);
  }

  function expire(idx) {
    const rec = active.get(idx); if (!rec) return;
    if (POPS[rec.type].decoy) { removePop(idx, 'pp-leave'); return; }   // user left alone: fine
    removePop(idx, 'pp-breach');
    lives--; combo = 0;
    sfx.breach();
    onFeedback && onFeedback({ kind: 'breach', idx });
    hud();
    if (lives <= 0) finish();
  }

  function tap(idx) {
    const rec = active.get(idx); if (!rec || !running) return;
    if (POPS[rec.type].decoy) {
      score = Math.max(0, score + FALSE_POSITIVE); combo = 0;
      removePop(idx, 'pp-false');
      sfx.wrong();
      onFeedback && onFeedback({ kind: 'false', idx });
      hud();
      return;
    }
    rec.hp--;
    if (rec.hp > 0) {
      rec.el.querySelector('.pp-hp').textContent = '●'.repeat(rec.hp);
      rec.el.classList.remove('hit'); void rec.el.offsetWidth; rec.el.classList.add('hit');
      sfx.serve();
      return;
    }
    const pts = killScore(rec.type, combo);
    removePop(idx, 'pp-killed');
    score += pts; combo++; cleared++;
    maxCombo = Math.max(maxCombo, combo);
    if (score > best) best = score;
    energy = Math.min(ENERGY_MAX, energy + ENERGY_PER_KILL);
    sfx.hit(Math.min(24, combo * 2));
    onFeedback && onFeedback({ kind: 'kill', idx, pts, boss: !!POPS[rec.type].boss });
    hud();
  }

  function sweep() {
    if (!running || energy < ENERGY_MAX) return;
    energy = 0;
    let n = 0;
    for (const [idx, rec] of [...active]) {
      if (POPS[rec.type].decoy) continue;
      removePop(idx, 'pp-killed');
      n++;
    }
    if (n) { score += n * SWEEP_SCORE; cleared += n; if (score > best) best = score; }
    sfx.ability();
    onFeedback && onFeedback({ kind: 'sweep', n });
    hud();
  }

  function clearAll() {
    for (const [, rec] of active) { clearTimeout(rec.timer); rec.el.remove(); }
    active.clear();
  }

  function finish() {
    running = false;
    clearTimeout(spawnT); clearInterval(hudT);
    clearAll();
    sfx.over();
    onOver && onOver({ score, best, elapsed: Math.floor(elapsed()), cleared, maxCombo });
  }

  grid.addEventListener('pointerdown', e => {
    const cell = e.target.closest('.pp-cell'); if (!cell) return;
    const idx = cells.indexOf(cell);
    if (idx >= 0) tap(idx);
  });

  return {
    start() {
      clearAll();
      score = 0; combo = 0; maxCombo = 0; lives = START_LIVES; energy = 0; cleared = 0;
      startTs = performance.now(); running = true;
      sfx.start(); hud();
      clearTimeout(spawnT); spawnT = setTimeout(spawn, 500);
      clearInterval(hudT); hudT = setInterval(hud, 100);
    },
    sweep,
    stop() { running = false; clearTimeout(spawnT); clearInterval(hudT); clearAll(); },
    setBest(b) { best = b || 0; },
    get state() { return { running, score, best, lives, energy }; },
  };
}
