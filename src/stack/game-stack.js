// Defense Stack — DOM board, slide/merge animation, input, milestones. Logic lives in
// tiles.js; this layer renders it and makes it feel good (2048-style).

import { CELLS, SIZE, LADDER, TOP_TIER, rung, spawnTier, applyMove, canMove, emptyCells, newTile } from './tiles.js';
import { sfx } from '../rush/audio.js';

const ANIM_MS = 120;

export function createStackGame(board, { onScore, onOver, onMilestone } = {}) {
  let cells = new Array(CELLS).fill(null);   // logical: {id,tier} | null
  const nodes = new Map();                    // id -> DOM node
  let score = 0, best = 0, maxSeen = 0, won = false, over = false, anim = false;

  function posVars(el, cell) {
    const r = Math.floor(cell / SIZE), c = cell % SIZE;
    el.style.setProperty('--tx', `calc(var(--gap) + (var(--ts) + var(--gap)) * ${c})`);
    el.style.setProperty('--ty', `calc(var(--gap) + (var(--ts) + var(--gap)) * ${r})`);
  }

  function makeNode(tile) {
    const el = document.createElement('div');
    el.className = `sk-tile sk-t${tile.tier} sk-new`;
    el.dataset.tier = tile.tier;
    paintFace(el, tile.tier);
    posVars(el, tile.cell);
    board.appendChild(el);
    nodes.set(tile.id, el);
    requestAnimationFrame(() => el.classList.remove('sk-new'));
    return el;
  }

  function paintFace(el, tier) {
    const g = rung(tier);
    el.innerHTML = `<span class="sk-short">${g.short}</span>`;
  }

  function addRandom() {
    const empties = emptyCells(cells);
    if (!empties.length) return;
    const cell = empties[(Math.random() * empties.length) | 0];
    const t = newTile(spawnTier(), cell);
    cells[cell] = { id: t.id, tier: t.tier };
    makeNode(t);
  }

  function clearBoard() {
    for (const el of nodes.values()) el.remove();
    nodes.clear();
    cells = new Array(CELLS).fill(null);
  }

  function start() {
    clearBoard();
    score = 0; maxSeen = 0; won = false; over = false; anim = false;
    addRandom(); addRandom();
    onScore && onScore(score, best);
    sfx.start();
  }

  function move(dir) {
    if (over || anim) return;
    const res = applyMove(cells, dir);
    if (!res.moved) return;
    anim = true;

    // slide every tile (gone tiles slide onto their survivor)
    for (const m of res.moves) {
      const el = nodes.get(m.id);
      if (el) posVars(el, m.to);
    }
    if (res.gained > 0) sfx.hit(Math.min(24, maxSeen * 2));
    else sfx.serve();

    setTimeout(() => {
      // remove absorbed tiles
      for (const m of res.moves) {
        if (m.gone) { const el = nodes.get(m.id); if (el) el.remove(); nodes.delete(m.id); }
      }
      // bump survivors that merged
      for (const cell of res.mergedCells) {
        const t = res.cells[cell];
        const el = nodes.get(t.id);
        if (el) {
          el.className = `sk-tile sk-t${t.tier} sk-merge`;
          el.dataset.tier = t.tier;
          paintFace(el, t.tier);
          posVars(el, cell);
          requestAnimationFrame(() => el.classList.remove('sk-merge'));
        }
      }
      cells = res.cells;
      score += res.gained;
      if (score > best) best = score;

      // milestone: reaching a new rung for the first time
      if (res.maxTier > maxSeen) {
        maxSeen = res.maxTier;
        if (res.maxTier >= 2) onMilestone && onMilestone(rung(res.maxTier), res.maxTier >= TOP_TIER && !won);
        if (res.maxTier >= TOP_TIER) won = true;
      }

      addRandom();
      onScore && onScore(score, best);

      if (!canMove(cells)) { finish(); return; }
      anim = false;
    }, ANIM_MS);
  }

  function finish() {
    over = true; anim = false;
    sfx.over();
    onOver && onOver({ score, best, maxTier: maxSeen, rung: rung(maxSeen) });
  }

  // ---- input: swipe on the board ----
  let sx = 0, sy = 0, tracking = false;
  board.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; tracking = true; }, { passive: true });
  board.addEventListener('touchmove', e => { if (tracking) e.preventDefault(); }, { passive: false });
  board.addEventListener('touchend', e => {
    if (!tracking) return; tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
    else move(dy > 0 ? 'down' : 'up');
  }, { passive: true });

  return {
    start, move,
    get state() { return { score, best, over, maxTier: maxSeen }; },
    setBest(b) { best = b || 0; },
  };
}
