// Scripted players for Sentinel Counter-Breach. Bots, not people: they aim and
// react more consistently than a human, so treat the rates as an upper bound.
import { createSim, THREAT, EYE, SITES, WIN_AT } from '../src/counter/sim.js';
const POLICY = {
  idle: { turn: 0, err: 0, buys: [] },
  casual: { turn: 2.6, err: .05, react: .5, wob: .14, buys: ['EDR', 'HCI', 'NDR', 'AF', 'IAG', 'EDR', 'XDR', 'HCI', 'AF', 'MDR', 'EDR', 'XDR', 'NDR', 'ASTOR'] },
  sharp: { turn: 7, err: .02, react: .2, wob: .025, buys: ['EDR', 'NDR', 'XDR', 'HCI', 'EDR', 'AF', 'IAG', 'XDR', 'EDR', 'HCI', 'AF', 'MDR', 'NDR', 'ASTOR', 'XDR', 'IAG'] },
  nobuy: { turn: 7, err: .02, react: .2, wob: .025, buys: [] },
};
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
export function playMatch(kind, seed, log, diff = 'normal') {
  const pol = POLICY[kind]; let over = null; const sim = createSim({ onOver: s => { over = s; } }), S = sim.reset(seed, { diff });
  let r = seed * 7919 + 1; const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let bi = 0, seen = 0, t = 0, yaw = 0, pitch = 0; const dt = 1 / 30;
  while (!over && t < 1500) {
    t += dt;
    if (S.phase === 'buy') { while (bi < pol.buys.length && sim.buy(pol.buys[bi])) bi++; if (S.buyT < TUNE_SKIP) sim.ready(); sim.step(dt, {}); yaw = 0; pitch = 0; continue; }
    if (S.phase !== 'live') { sim.step(dt, {}); continue; }
    const p = S.p, inp = { yaw, pitch, mx: 0, mz: 0 }, wob = (pol.wob || 0) * (Math.sin(t * 3.1 + seed) + Math.sin(t * 7.7) * .6); let tgt = null, td = 1e9;
    for (const th of S.threats) if (th.spawnT <= 0 && th.see && !(th.cloak) && th.dist < td) { td = th.dist; tgt = th; }
    if (pol.turn) {
      if (tgt) { seen += dt; const want = Math.atan2(-(tgt.x - p.x), -(tgt.z - p.z)), wp = Math.atan2(tgt.h * .62 - EYE, td), dy = wrap(want - yaw), step = pol.turn * dt; yaw += Math.max(-step, Math.min(step, dy)) + (rnd() - .5) * pol.err * .5; pitch += Math.max(-step, Math.min(step, wp - pitch)); if (seen > pol.react && Math.abs(wrap(want - yaw)) < pol.err + tgt.r / td * .8) inp.fire = true; }
      else seen = 0;
      const b = S.bomb; let go = null;
      if (b.state === 'planted') { const d = Math.hypot(b.x - p.x, b.z - p.z); if (d > 1.6) go = b; if (d < 2.4 && (!tgt || td > 9)) inp.use = true; if (S.mdr && b.t < 6 && d > 4) inp.mdr = true; }
      else if (!tgt) { const hold = S.lv.NDR >= 2 ? { x: SITES[b.site].x + (b.site === 'A' ? 4 : -4), z: SITES[b.site].z + 4 } : { x: 0, z: 4 }; if (Math.hypot(hold.x - p.x, hold.z - p.z) > 1.2) go = hold; }
      if (go) { const d = sim.nav(p.x, p.z, go.x, go.z), sn = Math.sin(yaw), cs = Math.cos(yaw); inp.mz = -sn * d.x - cs * d.z; inp.mx = cs * d.x - sn * d.z; if (!tgt) { const want = Math.atan2(-d.x, -d.z), step = pol.turn * dt; yaw += Math.max(-step, Math.min(step, wrap(want - yaw))); pitch *= .9; } }
      else if (tgt && td < 5 && THREAT[tgt.type].melee) inp.mz = -1; else if (tgt) inp.mx = Math.sin(t * 2.2) > 0 ? 1 : -1;
      if (p.nades && S.threats.filter(th => th.see && th.dist < 12).length >= 3 && tgt) { inp.nade = true; }
      if (S.mdr && p.hp < 35 && b.state !== 'planted') inp.mdr = true;
    }
    inp.yaw = yaw + wob; inp.pitch = pitch + wob * .5; sim.step(dt, inp);
  }
  if (log && over) console.log(kind, seed, over.outcome, `${over.you}-${over.them}`, over.history.map(h => h.result[0] + (h.win ? '+' : '-')).join(' '), 'score', over.score, 'kills', over.kills, 'acc', over.acc.toFixed(2), `t=${t | 0}s`);
  return over || { outcome: 'timeout', you: S.you, them: S.them, history: S.history, score: 0 };
}
const TUNE_SKIP = 20;
if (process.argv[1].endsWith('counter-balance.mjs')) {
  const n = +(process.argv[2] || 12), diff = process.argv[3] || 'normal';
  for (const kind of ['idle', 'nobuy', 'casual', 'sharp']) {
    let w = 0, rounds = 0, rw = 0; const res = {};
    for (let i = 1; i <= n; i++) { const o = playMatch(kind, i * 31, i <= 2 && !process.argv[3], diff); if (o.outcome === 'victory') w++; for (const h of o.history) { rounds++; if (h.win) rw++; res[h.result] = (res[h.result] || 0) + 1; } }
    console.log(`== ${diff} ${kind}: matches ${w}/${n}, rounds won ${rw}/${rounds}`, JSON.stringify(res));
  }
}
