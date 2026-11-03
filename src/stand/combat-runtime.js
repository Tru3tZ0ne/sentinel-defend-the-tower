// Allocation-conscious helpers. Candidate order matches the original enemy list.
export function createCollisionIndex(cellSize = 96) {
  const rows = new Map(), candidates = [];
  let indexed = 0, maxRadius = 0;
  const stats = { queries: 0, candidates: 0, fullScan: 0 };
  function insert(enemies) {
    for (; indexed < enemies.length; indexed++) {
      const e = enemies[indexed];
      if (e.dead) continue;
      maxRadius = Math.max(maxRadius, e.r);
      const row = Math.floor(e.y / cellSize), col = Math.floor(e.x / cellSize);
      if (!rows.has(row)) rows.set(row, new Map());
      const cells = rows.get(row);
      if (!cells.has(col)) cells.set(col, []);
      cells.get(col).push(indexed);
    }
  }
  return {
    stats,
    reset(enemies) {
      for (const row of rows.values()) for (const cell of row.values()) cell.length = 0;
      indexed = 0; maxRadius = 0; insert(enemies);
    },
    query(enemies, x, y, radius) {
      insert(enemies); candidates.length = 0;
      const reach = radius + maxRadius;
      for (let row = Math.floor((y-reach)/cellSize); row <= Math.floor((y+reach)/cellSize); row++) {
        const cells = rows.get(row); if (!cells) continue;
        for (let col = Math.floor((x-reach)/cellSize); col <= Math.floor((x+reach)/cellSize); col++) {
          const cell = cells.get(col); if (cell) for (const index of cell) candidates.push(index);
        }
      }
      candidates.sort((a,b)=>a-b);
      stats.queries++; stats.candidates += candidates.length; stats.fullScan += enemies.length;
      return candidates;
    },
    appendSpawned(enemies, x, y, radius) {
      // A pierced worm can spawn children during this same projectile's loop.
      for (let i = indexed; i < enemies.length; i++) {
        const e = enemies[i], reach = radius + e.r;
        if (!e.dead && Math.abs(e.x-x)<=reach && Math.abs(e.y-y)<=reach) { candidates.push(i); stats.candidates++; }
      }
      insert(enemies);
    },
  };
}

export function compactLive(list, pool, limit = 1024, byLife = false) {
  let write = 0;
  for (let read = 0; read < list.length; read++) {
    const item = list[read];
    if (byLife ? item.life > 0 : !item.dead) list[write++] = item;
    else if (pool && pool.length < limit) pool.push(item);
  }
  list.length = write;
}
