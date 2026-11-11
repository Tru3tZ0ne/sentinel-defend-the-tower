// Headless probe for Sentinel Frame: scripted pilots fly the production sim.
// Deterministic per seed. These are bots, not human results.
import { createSim } from '../src/frame/sim.js';
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// skill: 0 = idle, 1 = casual (slow reactions, short sight), 2 = sharp
export function fly(seed, skill = 1, maxSeconds = 400) {
  let result = null;
  const sim = createSim({ rng: mulberry32(seed), onOver: r => { result = r; } }), S = sim.start();
  const input = { mx: 0, my: 0, bomb: false }, dt = 1 / 60, sight = skill === 2 ? 3.4 : 2.1, lag = skill === 2 ? 2 : 9;
  let tick = 0, hold = { mx: 0, my: 0 };
  while (S.phase === 'play' && S.time < maxSeconds) {
    if (skill > 0 && tick++ % lag === 0) {
      const p = S.ship; let fx = 0, fy = 0, danger = 0;
      for (const b of S.eb) { const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy); if (d < sight && (b.vx * dx + b.vy * dy) > 0) { const w = (sight - d) / sight; fx += dx / (d || 1) * w * 3 + (dx >= 0 ? 1 : -1) * w; fy += dy / (d || 1) * w; danger = Math.max(danger, w); } }
      for (const e of S.enemies) { if (e.spec.ground) continue; const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy); if (d < e.r + 2) { fx += dx / (d || 1) * 2; fy += dy / (d || 1) * 2; } }
      let tx = 0, ty = 3.2, best = 1e9;
      for (const it of S.items) { if (it.y < 12) { tx = it.x; ty = it.y; best = -1; } }
      if (best > 0) for (const e of S.enemies) { if (e.y < p.y + 1 || e.y > 22) continue; const d = Math.abs(e.x - p.x) + (e.y - p.y) * .2; if (d < best) { best = d; tx = e.x; } }
      const k = danger > .25 ? .25 : 1;
      hold = { mx: fx + Math.max(-1, Math.min(1, (tx - p.x) * .8)) * k, my: fy + Math.max(-1, Math.min(1, (ty - p.y) * .8)) * k };
      input.bomb = danger > (skill === 2 ? .82 : .9) && S.bombs > 0;
    }
    input.mx = hold.mx; input.my = hold.my;
    sim.step(dt, input); sim.fxq.length = 0;
  }
  return result || { outcome: 'timeout', score: S.score, stage: S.stage + 1, cleared: S.cleared, kills: S.kills, time: Math.round(S.time), lv: S.lv, tier: S.tier, total: 0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +(process.argv[2] || 30);
  for (const [name, skill] of [['idle', 0], ['casual', 1], ['sharp', 2]]) {
    const runs = []; for (let i = 0; i < (skill ? n : 6); i++) runs.push(fly(101 + i * 37, skill));
    const avg = k => (runs.reduce((a, r) => a + r[k], 0) / runs.length);
    const dist = [0, 0, 0, 0]; for (const r of runs) dist[r.cleared]++;
    console.log(`${name.padEnd(7)} wins ${runs.filter(r => r.outcome === 'victory').length}/${runs.length}  bosses cleared 0/1/2/3: ${dist.join('/')}  avg score ${Math.round(avg('score'))}  avg time ${Math.round(avg("time"))}s  avg parts ${avg("total").toFixed(1)}  kills ${Math.round(avg('kills'))}`);
  }
}
