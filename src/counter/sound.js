// Tiny WebAudio kit for Counter-Breach: gunshots need noise, which the shared
// arcade blips do not have. Mute state is shared with the rest of the suite.
import { isMuted } from '../rush/audio.js';

let ctx = null, out = null, noiseBuf = null;
function ensure() {
  if (ctx) return ctx; const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext); if (!AC) return null;
  try { ctx = new AC(); } catch { return null; }
  out = ctx.createGain(); out.gain.value = .3; out.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
export function wake() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }
function tone(type, from, to, dur, gain, delay = 0) {
  const c = ensure(); if (!c || isMuted()) return; const t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(from, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + .008); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g).connect(out); o.start(t0); o.stop(t0 + dur + .02);
}
function noise(dur, gain, freq, q = .7, type = 'lowpass', delay = 0) {
  const c = ensure(); if (!c || isMuted()) return; const t0 = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  s.connect(f).connect(g).connect(out); s.start(t0, Math.random() * .3, dur + .02);
}
export const snd = {
  shot(lv = 1) { noise(lv ? .11 : .09, lv ? .9 : .7, lv ? 2600 : 3400); tone('square', lv ? 190 : 260, 60, .07, .35); },
  reload() { noise(.03, .4, 5000, 2, 'bandpass'); noise(.04, .5, 3000, 2, 'bandpass', .32); tone('square', 900, 500, .03, .12, .5); },
  hit() { tone('triangle', 1500, 900, .05, .22); },
  head() { tone('triangle', 2600, 1900, .09, .4); noise(.04, .3, 6000, 3, 'bandpass'); },
  kill() { tone('sine', 880, 1320, .09, .3); },
  hurt() { noise(.12, .6, 700); tone('sawtooth', 160, 70, .16, .35); },
  buy() { tone('sine', 880, 1175, .07, .3); tone('sine', 1175, 1760, .1, .28, .07); },
  deny() { tone('square', 180, 140, .12, .25); },
  beep(hi) { tone('square', hi ? 1900 : 1500, hi ? 1900 : 1500, .055, .22); },
  planted() { tone('sawtooth', 220, 110, .5, .4); tone('square', 1500, 1500, .08, .25, .1); },
  stun() { noise(.35, .8, 1800, .5, 'bandpass'); tone('sine', 1800, 300, .4, .3); },
  nade() { noise(.05, .3, 2400, 1, 'bandpass'); },
  chain() { tone('sawtooth', 1200, 300, .12, .2); },
  wall() { noise(.5, .7, 500); tone('sawtooth', 300, 50, .5, .3); },
  mdr() { tone('sine', 440, 880, .25, .35); tone('sine', 660, 1320, .3, .3, .1); noise(.5, .35, 1200); },
  boom() { noise(.9, 1, 320); tone('sine', 90, 30, .9, .6); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, .16, .3, i * .09)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * .97, .22, .22, i * .13)); },
  go() { tone('square', 660, 660, .08, .2); tone('square', 990, 990, .14, .22, .12); },
  tick() { tone('square', 1000, 1000, .03, .12); },
  step() { noise(.04, .1, 300); },
};
