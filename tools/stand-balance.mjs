// Headless balance probe: executes the production combat closure, without WebGL.
// Source boundaries are asserted so engine refactors cannot silently skip combat.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileFunction } from 'node:vm';
import { pathToFileURL } from 'node:url';
import * as rules from '../src/stand/model.js';

const source = readFileSync(new URL('../src/stand/engine.js', import.meta.url), 'utf8');
function section(from, to) {
  const a = source.indexOf(from), b = source.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `Combat adapter boundary: ${from} / ${to}`);
  return source.slice(a, b);
}
const constants = section('const TAU =', 'export function createStandGame').replace('export const ACCENT', 'const ACCENT');
const combat = section('  function fresh()', '  function billboard(');
const inputs = section('  const opMinX =', '  const cx =');
const over = source.match(/  function gameOver\(\) \{[^\n]+/)[0];
const frame = section('  function frame(ts)', '  function gameOver()');
const create = compileFunction(`
  const { ${Object.keys(rules).join(', ')} } = rules;
  ${constants}
  const W = width, H = height, barH = Math.max(52, H * .09), baseY = H - barH;
  const opHome = baseY - 62, bandY = H * .44, fieldW = clamp(W * .92, 340, 440);
  const fieldL = Math.round((W - fieldW) / 2), fieldR = fieldL + fieldW;
  ${inputs}
  const cx = () => fieldL + fieldW / 2;
  let S, nextId = 1, unitsDirty = false, lastTS = 0, offers = [], summary = null;
  const keys = new Set(), drag = { on: false }, sfx = new Proxy({}, { get: () => () => {} });
  const toasts = [], onToast = id => toasts.push(id), pushHud = () => {}, onOver = value => { summary = value; };
  const onLevelUp = choices => { offers = choices; };
  let raf = 0;
  const requestAnimationFrame = () => 0, syncScene = () => {}, render = () => {};
  ${combat}
  ${over}
  ${frame}
  S = fresh(); S.phase = 'play'; recompute();
  return { get state() { return S; }, get offers() { return offers; }, toasts,
    get summary() { return summary; }, choose: chooseUpgrade, deploy: applyUpgrade, fire: fireUp, useAbility, keys, fieldL, fieldR, baseY,
    frameMs(ms) { frame(lastTS + ms); },
    step(dt) { if (S.phase === 'play') update(dt); } };
`, ['rules', 'Math', 'width', 'height']);

export function createCombatProbe({ seed = 1, width = 1440, height = 942, overrides = {} } = {}) {
  let n = seed >>> 0;
  const math = Object.create(Math);
  math.random = () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
  return create({ ...rules, upgradeChoices: levels => rules.upgradeChoices(levels, math.random), ...overrides }, math, width, height);
}

function priority(id, levels, policy) {
  const n=levels[id] || 0;
  if (policy === 'cloud') return (rules.CLOUD_PRODUCTS.includes(id) ? 100 : -100) - n * 4;
  if (id === 'NDR' && !n) return 22;
  if (id === 'XDR' && !n) return 21;
  if (id === 'HCI' && n < 2) return 18-n;
  const target={EDR:3,MDR:3,AF:2,NDR:2,XDR:2,IAG:1,HCI:3,ASTOR:1,AI:2,AGENT:1};
  return (target[id]-n)*3 + ({EDR:2,MDR:3,AF:1,NDR:2,XDR:0,IAG:0,HCI:1,ASTOR:0,AI:0,AGENT:0}[id]);
}

export function playProbe({ policy = 'informed', limit = 121, ...options } = {}) {
  const g = createCombatProbe(options), dt = 1 / 60;
  let decisionAt = 0, targetX = (g.fieldL + g.fieldR) / 2, peakEnemies = 0, choices = 0;
  while (g.state.phase !== 'over' && g.state.elapsed < limit && g.state.elapsed < 120) {
    const s = g.state;
    if (s.choices.length && policy !== 'stationary') {
      const best = [...g.offers].sort((a, b) => priority(b.id, s.levels, policy) - priority(a.id, s.levels, policy))[0];
      if (policy !== 'cloud' || rules.CLOUD_PRODUCTS.includes(best.id)) { g.choose(best.id); choices++; }
    }
    if (policy !== 'stationary') {
      if (s.elapsed >= decisionAt) {
        decisionAt = s.elapsed + (policy === 'casual' || policy === 'cloud' ? 1.15 : .2);
        if (policy === 'casual' || policy === 'cloud') targetX = (g.fieldL + g.fieldR) / 2 + Math.sin(s.elapsed * .5) * 150;
        else {
          const target = [...s.enemies].filter(e => e.spec.dmg && e.y > 0).sort((a, b) => b.y - a.y)[0];
          targetX = target?.x ?? (g.fieldL + g.fieldR) / 2;
        }
        const strike=s.enemies.find(e=>e.attack);
        if (strike) targetX = strike.attack.x < (g.fieldL+g.fieldR)/2 ? g.fieldR-50 : g.fieldL+50;
        g.keys.clear(); if (targetX < s.op.x - 8) g.keys.add('left'); if (targetX > s.op.x + 8) g.keys.add('right');
        if (policy === 'informed' || s.enemies.length > 12) {
          g.useAbility('pt'); g.useAbility('rt');
        }
        if (s.enemies.some(e=>e.spec.boss && e.hp < e.maxhp*.65) || s.enemies.length > (policy === 'informed' ? 14 : 24) || s.base < 1500) g.useAbility('ir');
      }
    }
    g.step(dt); peakEnemies = Math.max(peakEnemies, g.state.enemies.length);
  }
  const s = g.state;
  return { seconds: Math.round(s.elapsed * 10) / 10, ended: s.phase === 'over', level: s.level,
    kills: s.kills, choices, peakEnemies, levels: s.levels, health: Math.floor(s.base), bossesKilled: s.bossesKilled, availability: Math.floor(s.availability), victory: g.summary?.outcome === 'victory', scores: g.summary?.scores, dodged: s.dodged, summary: g.summary };
}

export function sampleBalance({ seeds = 12, seedStart = 101, ...options } = {}) {
  const runs = Array.from({ length: seeds }, (_, i) => playProbe({ ...options, seed: seedStart + i * 37 }));
  const times = runs.map(r => r.seconds).sort((a, b) => a - b);
  return { mean: Math.round(times.reduce((a, b) => a + b, 0) / times.length * 10) / 10,
    min: times[0], max: times.at(-1), ended: runs.filter(r => r.ended).length, runs };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const policy of ['stationary', 'cloud', 'casual', 'informed']) {
    const { runs, ...summary } = sampleBalance({ policy });
    console.log(JSON.stringify({ policy, ...summary, times: runs.map(r => r.seconds), peakEnemies: Math.max(...runs.map(r => r.peakEnemies)) }));
  }
}
