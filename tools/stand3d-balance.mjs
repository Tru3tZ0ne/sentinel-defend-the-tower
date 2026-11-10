// Headless balance probe for Last Stand 3D: plays the production simulation with
// scripted policies. Deterministic per seed. These are bots, not human win rates.
import { createSim, ARENA } from '../src/stand3d/sim.js';

export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const PRIORITY = ['EDR', 'MDR', 'NDR', 'HCI', 'XDR', 'AF', 'ASTOR', 'IAG', 'AI'];

export function playOnce(seed, policy = 'casual', probe = null) {
  const rng = mulberry32(seed), brain = mulberry32(seed ^ 0x9e3779b9);
  let result = null, choices = [];
  const sim = createSim({ rng, onOver: r => { result = r; }, onLevelUp: c => { choices = c; } });
  const S = sim.start(0);
  const input = { mx: 0, my: 0, aimX: null, aimY: null, dash: false };
  const react = policy === 'informed' ? .2 : 1.15;
  let think = 0, dodge = 0, pickAt = 0, goal = { x: S.op.x, y: S.op.y }, dashHold = 0;
  const dt = 1 / 60;
  while (S.phase === 'play') {
    if (policy !== 'idle') {
      think -= dt; dodge -= dt; dashHold -= dt;
      const live = S.enemies.filter(e => !e.dead);
      if (think <= 0) {
        think = react;
        let urgent = null, best = Infinity;
        for (const e of live) { const d = Math.hypot(e.x, e.y) * (e.spec.boss ? .7 : 1); if (d < best) { best = d; urgent = e; } }
        if (urgent) { const a = Math.atan2(urgent.y, urgent.x), r = policy === 'informed' ? 250 : 230 + brain() * 120; goal = { x: Math.cos(a) * r, y: Math.sin(a) * r }; }
        const boss = live.some(e => e.spec.boss), near = live.filter(e => Math.hypot(e.x, e.y) < 300).length;
        if (policy === 'informed') {
          if (boss || live.length >= 9) { sim.useAbility('rt'); sim.useAbility('pt'); }
          if (near >= 4 || S.base < 8200) sim.useAbility('ir');
          if (live.length >= 3) sim.useAbility('wf');
        } else if (policy === 'casual') {
          if (S.base < 9000 || near >= 5) sim.useAbility('ir');
          if (boss && brain() < .6) sim.useAbility('rt');
          if (live.length >= 12 && brain() < .5) sim.useAbility('pt');
          if (S.base < 9000 || S.availability < 85) sim.useAbility('wf');
        }
      }
      // boss strikes: informed always sidesteps, casual notices on a slower cadence
      input.dash = false;
      if (dodge <= 0) {
        dodge = policy === 'informed' ? .1 : .45;
        for (const e of live) if (e.attack && Math.hypot(S.op.x - e.attack.x, S.op.y - e.attack.y) < e.attack.r + 30) {
          const a = Math.atan2(S.op.y, S.op.x) + Math.PI / 2; goal = { x: S.op.x + Math.cos(a) * 200, y: S.op.y + Math.sin(a) * 200 };
          if (policy === 'informed' || brain() < .5) dashHold = .1;
        }
      }
      input.dash = dashHold > 0;
      const dx = goal.x - S.op.x, dy = goal.y - S.op.y, l = Math.hypot(dx, dy);
      input.mx = l > 14 ? dx / l : 0; input.my = l > 14 ? dy / l : 0;
      if (policy === 'cloud' && choices.length) { const c = choices.find(c => ['HCI', 'ASTOR', 'AI'].includes(c.id)) || choices[0]; sim.chooseUpgrade(c.id); }
      else if (choices.length) {
        pickAt += dt;
        if (pickAt >= (policy === 'informed' ? .4 : 1.6)) {
          pickAt = 0;
          const pick = policy === 'informed' ? [...choices].sort((a, b) => PRIORITY.indexOf(a.id) - PRIORITY.indexOf(b.id))[0] : choices[Math.floor(brain() * choices.length)];
          sim.chooseUpgrade(pick.id);
        }
      }
    }
    sim.step(dt, input); if (probe) for (const f of sim.fxq) probe(f, S); sim.fxq.length = 0;
  }
  return { ...result, seed, t: S.elapsed, hp: Math.round(S.base), dashes: S.dashes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +(process.argv[2] || 60);
  for (const policy of ['casual', 'informed', 'cloud', 'idle']) {
    const count = policy === 'casual' ? n : 12, runs = [];
    for (let i = 0; i < count; i++) runs.push(playOnce(101 + i * 37, policy));
    const wins = runs.filter(r => r.outcome === 'victory');
    const reasons = {}; for (const r of runs) if (r.reason) reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    const avg = k => Math.round(runs.reduce((a, r) => a + r[k], 0) / runs.length);
    console.log(`${policy.padEnd(9)} clears ${wins.length}/${count} (${(wins.length / count * 100).toFixed(1)}%)  avgHP ${avg('hp')}  avgScore ${avg('score')}  bosses ${(runs.reduce((a, r) => a + r.bossesKilled, 0) / count).toFixed(2)}  kills ${avg('kills')}  t ${avg('t')}  fails ${JSON.stringify(reasons)}`);
  }
  if (process.argv[3] === 'held') { const runs = []; for (let i = 0; i < 30; i++) runs.push(playOnce(5001 + i * 37, 'casual')); console.log(`held-out casual clears ${runs.filter(r => r.outcome === 'victory').length}/30`); }
}
