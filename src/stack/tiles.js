// Pure logic for "Defense Stack" — a 2048-style merge game themed as building the
// Sangfor security stack. No DOM: fully unit-testable. Slide equal tiles together to
// climb the product ladder from a bare asset up to the unified Sangfor platform.

export const SIZE = 4;                 // 4x4 board
export const CELLS = SIZE * SIZE;

// The ladder: each merge climbs one rung of a real Sangfor maturity journey —
// a lone asset -> endpoint -> perimeter -> egress -> network -> storage -> managed
// SOC -> correlation -> unified platform. tier is 1-based; `win` is the goal rung.
export const LADDER = [
  { tier: 1,  key: 'asset',  short: 'ASSET',  name: 'Unmanaged asset' },
  { tier: 2,  key: 'EDR',    short: 'EDR',    name: 'Endpoint Secure' },
  { tier: 3,  key: 'AF',     short: 'NGAF',   name: 'Next-Gen Firewall' },
  { tier: 4,  key: 'IAG',    short: 'IAG',    name: 'Secure Web Gateway' },
  { tier: 5,  key: 'NDR',    short: 'NDR',    name: 'Cyber Command' },
  { tier: 6,  key: 'ASTOR',  short: 'aStor',  name: 'Enterprise Storage' },
  { tier: 7,  key: 'MDR',    short: 'MDR',    name: 'Managed Detection' },
  { tier: 8,  key: 'XDR',    short: 'XDR',    name: 'XDR Platform' },
  { tier: 9,  key: 'XDDR',   short: 'XDDR',   name: 'Athena XDDR' },
  { tier: 10, key: 'PLATFORM', short: 'SANGFOR', name: 'Unified Platform', win: true },
];
export const TOP_TIER = LADDER.length;
export const WIN_TIER = TOP_TIER;

export function rung(tier) { return LADDER[tier - 1] || LADDER[LADDER.length - 1]; }

// Points awarded when a tile of tier t is FORMED by a merge — exponential, 2048-style.
export function valueOf(tier) { return Math.round(2 ** tier); }

// New tiles are almost always a bare asset (tier 1); occasionally a pre-hardened EDR (tier 2).
export function spawnTier(rng = Math.random) { return rng() < 0.1 ? 2 : 1; }

export function emptyCells(cells) {
  const out = [];
  for (let i = 0; i < CELLS; i++) if (!cells[i]) out.push(i);
  return out;
}

// Travel order of the four lines for each direction (first index = destination edge).
function buildLines() {
  const L = { left: [], right: [], up: [], down: [] };
  for (let r = 0; r < SIZE; r++) {
    const row = []; for (let c = 0; c < SIZE; c++) row.push(r * SIZE + c);
    L.left.push(row); L.right.push([...row].reverse());
  }
  for (let c = 0; c < SIZE; c++) {
    const col = []; for (let r = 0; r < SIZE; r++) col.push(r * SIZE + c);
    L.up.push(col); L.down.push([...col].reverse());
  }
  return L;
}
const LINES = buildLines();

let _id = 0;
export function newTile(tier, cell) { return { id: ++_id, tier, cell }; }

// Apply a move. `cells` is a length-16 array of tile objects {id,tier} or null.
// Returns { cells, moves, mergedCells, gained, moved, maxTier }.
//   moves       -> [{id, to, gone?}] every tile's destination (gone tiles are absorbed)
//   mergedCells -> cell indices where a merge produced a higher tile (for pop fx)
export function applyMove(cells, dir) {
  const lines = LINES[dir];
  const next = new Array(CELLS).fill(null);
  const moves = [];
  const mergedCells = [];
  let gained = 0;

  for (const line of lines) {
    const tiles = line.map(i => cells[i]).filter(Boolean);
    let pos = 0, k = 0;
    while (k < tiles.length) {
      const a = tiles[k];
      if (k + 1 < tiles.length && tiles[k + 1].tier === a.tier && a.tier < TOP_TIER) {
        const b = tiles[k + 1];
        const dest = line[pos];
        const nt = a.tier + 1;
        next[dest] = { id: a.id, tier: nt };
        moves.push({ id: a.id, to: dest });
        moves.push({ id: b.id, to: dest, gone: true });
        mergedCells.push(dest);
        gained += valueOf(nt);
        k += 2; pos++;
      } else {
        const dest = line[pos];
        next[dest] = { id: a.id, tier: a.tier };
        moves.push({ id: a.id, to: dest });
        k++; pos++;
      }
    }
  }

  // moved if the tier layout changed (merges always change it; so does any slide).
  let moved = false;
  for (let i = 0; i < CELLS; i++) {
    if ((cells[i]?.tier || 0) !== (next[i]?.tier || 0)) { moved = true; break; }
  }
  let maxTier = 0;
  for (const t of next) if (t && t.tier > maxTier) maxTier = t.tier;

  return { cells: next, moves, mergedCells, gained, moved, maxTier };
}

// Can any of the four moves change the board? (used for game-over detection)
export function canMove(cells) {
  if (emptyCells(cells).length) return true;
  for (const dir of ['left', 'up']) if (applyMove(cells, dir).moved) return true;
  // left/up suffice to detect an adjacent equal pair on a full board, but check all to be safe:
  for (const dir of ['right', 'down']) if (applyMove(cells, dir).moved) return true;
  return false;
}
