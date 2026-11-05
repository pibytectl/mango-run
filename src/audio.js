// WebAudio: two music loops (decoded on first gesture) and synthesized sound effects (no SFX assets).
let ctx = null, master, musicGain, sfxGain, voiceGain, noiseBuf;
const music = { buffers: {}, src: null, name: null };
let enabled = true;

export function audioInit() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = enabled ? 1 : 0; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(comp);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(comp);
  voiceGain = ctx.createGain(); voiceGain.gain.value = 1.0; voiceGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export async function loadMusic(name, url) {
  try {
    const r = await fetch(url);
    const ab = await r.arrayBuffer();
    if (!ctx) return;
    music.buffers[name] = await new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej));
    if (music.want === name) playMusic(name);
  } catch (e) { console.warn('music load failed', name, e && e.message); }
}

export function playMusic(name, vol = 0.5) {
  music.want = name;
  if (!ctx) return;
  if (music.name === name && music.src) return;
  const buf = music.buffers[name];
  const now = ctx.currentTime;
  if (music.src) {
    const old = music.src, og = music.g;
    og.gain.setTargetAtTime(0, now, 0.4);
    setTimeout(() => { try { old.stop(); } catch (e) {} }, 2000);
    music.src = null;
  }
  music.name = null;
  if (!buf) return;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  src.loopStart = 0.03; src.loopEnd = buf.duration - 0.03;
  const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(vol, now, 0.6);
  src.connect(g); g.connect(musicGain); src.start(now, 0.03);
  music.src = src; music.g = g; music.name = name;
}
// used by the 3D mode (voices, engine and impact sounds)
export function audioParts() { return { ctx, sfxGain, voiceGain, musicGain, noiseBuf }; }
export function setMusicRate(r) { if (music.src && ctx) music.src.playbackRate.setTargetAtTime(r, ctx.currentTime, 0.5); }
export function stopMusic() { playMusic('__none__'); }
export function setMusicDuck(v) { if (musicGain) musicGain.gain.setTargetAtTime(0.5 * v, ctx.currentTime, 0.2); }

export function setSound(on) {
  enabled = on;
  if (master) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
}
export function soundOn() { return enabled; }

// ---------- synth helpers ----------
function env(g, t, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, 0.005, dur, vol);
  o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, type, freq, q = 1, delay = 0, f1) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); env(g, t, 0.004, dur, vol);
  s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

export const sfx = {
  jump() { tone('square', 260, 520, 0.13, 0.08); tone('sine', 300, 640, 0.14, 0.12); },
  land(big) { noise(big ? 0.22 : 0.1, big ? 0.5 : 0.25, 'lowpass', big ? 500 : 900); tone('sine', 110, 50, 0.12, big ? 0.35 : 0.15); },
  step() { noise(0.04, 0.06, 'bandpass', 1800 + Math.random() * 600, 2); },
  mango(i = 0) { const f = 660 * Math.pow(1.122, i % 8); tone('triangle', f, f, 0.12, 0.2); tone('sine', f * 2, f * 2, 0.08, 0.08, 0.03); },
  hurt() { tone('sawtooth', 300, 90, 0.25, 0.18); noise(0.18, 0.35, 'lowpass', 700); },
  spill() { for (let i = 0; i < 3; i++) tone('triangle', 900 - i * 160, 500 - i * 80, 0.08, 0.1, i * 0.05); },
  horn() { for (let k = 0; k < 2; k++) { tone('square', 466, 466, 0.16, 0.08, k * 0.22); tone('square', 587, 587, 0.16, 0.06, k * 0.22); } },
  bounce() { tone('sine', 180, 720, 0.18, 0.3); tone('square', 360, 900, 0.1, 0.05); },
  kick() { tone('sine', 160, 60, 0.1, 0.4); noise(0.05, 0.2, 'bandpass', 1200, 1); },
  whack() { tone('sine', 220, 80, 0.12, 0.45); noise(0.08, 0.4, 'bandpass', 2400, 1.5); },
  thud() { tone('sine', 120, 45, 0.16, 0.5); noise(0.12, 0.45, 'lowpass', 600); noise(0.05, 0.2, 'bandpass', 2600, 1.2); },
  swing() { noise(0.2, 0.25, 'bandpass', 600, 2, 0, 2600); },
  vault() { noise(0.35, 0.22, 'bandpass', 400, 1.5, 0, 1800); tone('sine', 200, 420, 0.3, 0.12); },
  bleat() {
    if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(440, t + 0.6);
    lfo.frequency.value = 18; lg.gain.value = 40; lfo.connect(lg); lg.connect(o.frequency);
    f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 2;
    env(g, t, 0.03, 0.6, 0.25); o.connect(f); f.connect(g); g.connect(sfxGain);
    o.start(t); lfo.start(t); o.stop(t + 0.7); lfo.stop(t + 0.7);
  },
  flap() { for (let i = 0; i < 5; i++) noise(0.05, 0.12, 'bandpass', 900 + Math.random() * 500, 1, i * 0.07); },
  coo() { tone('sine', 380, 300, 0.25, 0.12); tone('sine', 360, 280, 0.3, 0.1, 0.3); },
  splash() { noise(0.6, 0.5, 'lowpass', 3000, 0.7, 0, 300); noise(0.3, 0.3, 'highpass', 2000, 1, 0.1); },
  checkpoint() { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.2, 0.14, i * 0.08)); },
  ferryHorn() { tone('sawtooth', 110, 104, 1.1, 0.14); tone('sawtooth', 165, 158, 1.1, 0.08); },
  slip() { tone('sine', 900, 200, 0.4, 0.2); noise(0.2, 0.2, 'highpass', 3000); },
  cloth() { noise(0.25, 0.3, 'bandpass', 500, 0.8); },
  bump() { tone('sine', 140, 70, 0.08, 0.3); },
  tap() { tone('triangle', 880, 880, 0.05, 0.12); },
  star(i) { const f = [784, 988, 1175][i] || 1175; tone('triangle', f, f, 0.35, 0.18); tone('sine', f * 2, f * 2, 0.2, 0.06, 0.05); },
  win() { [392, 494, 587, 784, 988].forEach((f, i) => tone('triangle', f, f, 0.28, 0.16, i * 0.11)); },
  cheer() { noise(1.4, 0.18, 'bandpass', 1500, 0.6); for (let i = 0; i < 6; i++) tone('triangle', 600 + Math.random() * 500, 700 + Math.random() * 500, 0.12, 0.03, 0.1 + Math.random() * 0.8); },
  nudge() { tone('sine', 200, 160, 0.12, 0.2); },
  timeTick() { tone('square', 1200, 1200, 0.03, 0.05); },
};
