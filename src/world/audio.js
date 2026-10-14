// Quiet ventilation and electrical hum, synthesized locally. Playback is opt-in.
export function createAmbience() {
  let context = null, gain = null, enabled = false;
  async function toggle() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    if (!context) {
      context = new Audio();
      gain = context.createGain(); gain.gain.value = 0; gain.connect(context.destination);
      const buffer = context.createBuffer(1, context.sampleRate * 8, context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      const noise = context.createBufferSource(); noise.buffer = buffer; noise.loop = true;
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 650;
      noise.connect(filter); filter.connect(gain); noise.start();
      const hum = context.createOscillator(); hum.frequency.value = 60;
      const humGain = context.createGain(); humGain.gain.value = .025;
      hum.connect(humGain); humGain.connect(gain); hum.start();
    }
    enabled = !enabled;
    if (enabled) await context.resume();
    gain.gain.setTargetAtTime(enabled ? .035 : 0, context.currentTime, .25);
    return enabled;
  }
  document.addEventListener('visibilitychange', () => {
    if (!context) return;
    if (document.hidden) context.suspend(); else if (enabled) context.resume().catch(() => {});
  });
  return { toggle, get enabled() { return enabled; } };
}
