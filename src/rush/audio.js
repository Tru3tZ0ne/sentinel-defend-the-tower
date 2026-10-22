// Tiny synthesised sound — no audio files, offline-friendly. All calls are no-ops
// until the first user gesture resumes the AudioContext, and respect the mute flag.

let ctx = null, master = null, muted = false;

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  } catch { ctx = null; }
  return ctx;
}

export function resumeAudio() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }
export function setMuted(m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.22; }
export function isMuted() { return muted; }

function blip({ type = 'sine', from = 440, to = 440, dur = 0.12, gain = 0.6, delay = 0 }) {
  const c = ensure(); if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  hit(combo = 0) { blip({ type: 'triangle', from: 520 + Math.min(combo, 24) * 28, to: 880 + Math.min(combo, 24) * 30, dur: 0.1, gain: 0.5 }); },
  serve() { blip({ type: 'sine', from: 300, to: 420, dur: 0.08, gain: 0.25 }); },
  wrong() { blip({ type: 'sawtooth', from: 220, to: 110, dur: 0.22, gain: 0.5 }); },
  breach() { blip({ type: 'sawtooth', from: 180, to: 60, dur: 0.4, gain: 0.7 }); blip({ type: 'square', from: 90, to: 40, dur: 0.5, gain: 0.4, delay: 0.04 }); },
  ability() { blip({ type: 'sine', from: 660, to: 1320, dur: 0.18, gain: 0.5 }); blip({ type: 'sine', from: 990, to: 1760, dur: 0.22, gain: 0.35, delay: 0.05 }); },
  boss() { blip({ type: 'sawtooth', from: 140, to: 80, dur: 0.6, gain: 0.5 }); },
  over() { for (let i = 0; i < 4; i++) blip({ type: 'triangle', from: 500 - i * 90, to: 300 - i * 70, dur: 0.18, gain: 0.4, delay: i * 0.12 }); },
  start() { blip({ type: 'sine', from: 440, to: 660, dur: 0.12, gain: 0.4 }); blip({ type: 'sine', from: 660, to: 990, dur: 0.16, gain: 0.3, delay: 0.1 }); },
};
