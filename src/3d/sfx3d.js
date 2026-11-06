// Extra synthesized sounds for the 3D mode (no audio assets): nabboot whoosh and impacts, block clack,
// punches, tok-tok engine loop, crashes, crowd.
import { audioParts } from '../audio.js';

function env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function tone(type, f0, f1, dur, vol, delay = 0) {
  const { ctx, sfxGain } = audioParts(); if (!ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, 0.004, dur, vol); o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, type, freq, q = 1, delay = 0, f1) {
  const { ctx, sfxGain, noiseBuf } = audioParts(); if (!ctx) return;
  const t = ctx.currentTime + delay, s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q; if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); env(g, t, 0.003, dur, vol); s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

export const sfx3 = {
  whoosh(i = 0) { noise(0.22, 0.32, 'bandpass', 400 + i * 120, 2.2, 0, 2400); },
  staffHit(big) { tone('sine', 190, 60, 0.16, big ? 0.65 : 0.5); noise(0.07, 0.5, 'bandpass', 2600, 1.6); noise(0.14, 0.35, 'lowpass', 800); if (big) tone('square', 90, 40, 0.18, 0.12); },
  clack() { tone('triangle', 1400, 900, 0.06, 0.28); noise(0.06, 0.45, 'bandpass', 3200, 3); tone('sine', 420, 300, 0.08, 0.2); },
  punch() { noise(0.1, 0.4, 'lowpass', 900); tone('sine', 140, 70, 0.1, 0.4); },
  hurt() { tone('sawtooth', 260, 90, 0.22, 0.14); noise(0.16, 0.3, 'lowpass', 700); },
  thump() { tone('sine', 90, 40, 0.3, 0.6); noise(0.25, 0.4, 'lowpass', 400); },
  crash() { noise(0.6, 0.7, 'lowpass', 1800, 0.7, 0, 200); tone('square', 120, 50, 0.4, 0.15); for (let i = 0; i < 5; i++) tone('triangle', 900 + Math.random() * 900, 500, 0.08, 0.06, 0.05 + i * 0.06); },
  scrape() { noise(0.28, 0.13, 'bandpass', 1900, 2.5, 0, 900); },
  bump() { tone('sine', 150, 70, 0.14, 0.45); noise(0.12, 0.35, 'lowpass', 1200); },
  boost() { noise(0.5, 0.25, 'bandpass', 300, 1.5, 0, 1600); },
  slide() { noise(0.55, 0.22, 'lowpass', 1500, 0.7, 0, 400); },
  wall() { tone('sine', 220, 120, 0.1, 0.3); noise(0.08, 0.3, 'bandpass', 1500, 1.5); },
  splash() { noise(0.9, 0.6, 'lowpass', 3000, 0.7, 0, 250); noise(0.4, 0.3, 'highpass', 2000, 1, 0.1); },
  flap() { for (let i = 0; i < 7; i++) noise(0.05, 0.14, 'bandpass', 900 + Math.random() * 500, 1, i * 0.06); },
  telegraph() { tone('triangle', 660, 990, 0.12, 0.1); },
  cheer() { noise(1.6, 0.2, 'bandpass', 1300, 0.6); for (let i = 0; i < 8; i++) tone('triangle', 500 + Math.random() * 600, 700 + Math.random() * 500, 0.14, 0.035, 0.1 + Math.random()); },
};

// Tok-tok engine (round 3). Round 2 started a sawtooth + a square oscillator and never set their pitch, so
// the whole ride was a constant 440 Hz chord: the "horn that doesn't stop", raspy enough to read as crackle.
// Now: one looping AudioBuffer of a small single-cylinder putter (a decaying low thump + a little filtered
// rasp per firing), built of whole firing cycles that each start and end at exactly zero, so the loop point
// is silent and seamless (no click). One AudioBufferSourceNode per ride: start() is idempotent, the
// playback rate (firing rate and pitch) and a lowpass follow the speed, updated at most ~12 times a second
// (no per-frame automation), pause ducks it, stop() fades it out and releases every node.
const ENGINE_HZ = 24, ENGINE_CYCLES = 24;
let engineBuf = null;
function engineBuffer(ctx) {
  if (engineBuf && engineBuf.sampleRate === ctx.sampleRate) return engineBuf;
  const sr = ctx.sampleRate, n = Math.round(sr / ENGINE_HZ), len = n * ENGINE_CYCLES;
  const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
  let seed = 9871; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let c = 0; c < ENGINE_CYCLES; c++) {
    // uneven firings (a cheap engine never fires the same twice): amplitude and thump pitch wobble per cycle
    const amp = 0.62 + 0.38 * Math.abs(Math.sin(c * 2.39 + 0.7)), f = 62 + 14 * Math.sin(c * 1.7), s0 = c * n;
    let lp = 0, lp2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, x = i / n;
      const env = (1 - Math.exp(-t * 900)) * Math.exp(-t * 48);
      const taper = x > 0.8 ? 0.5 + 0.5 * Math.cos(Math.PI * (x - 0.8) / 0.2) : 1; // reaches exactly 0 at the cycle end
      lp += (rnd() - lp) * 0.22; lp2 += (lp - lp2) * 0.3;
      const thump = Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.02 * t);
      d[s0 + i] = amp * env * taper * (0.55 * thump + 1.1 * lp2 + 0.25 * (lp - lp2) * Math.exp(-t * 120));
    }
  }
  let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
  for (let i = 0; i < len; i++) d[i] /= peak;
  d[0] = 0; d[len - 1] = 0;
  return (engineBuf = b);
}
export class Engine {
  constructor() { this.src = null; this.want = false; this.muted = false; this.lastSet = -1; this.rate = 1; this.cut = 900; this.vol = 0.16; }
  start() {
    this.want = true;
    const { ctx, sfxGain } = audioParts(); if (!ctx || this.src) return;
    this.buf = engineBuffer(ctx);
    const src = ctx.createBufferSource(); src.buffer = this.buf; src.loop = true; src.__tag = 'engine';
    src.playbackRate.value = this.rate;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = this.cut; f.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start();
    g.gain.setTargetAtTime(this.muted ? 0 : this.vol, ctx.currentTime, 0.12);
    this.src = src; this.f = f; this.g = g;
  }
  // speed in m/s; called every simulation step, applied at most every 80 ms and only when it changed
  set(speed, boost) {
    if (!this.want) return;
    const { ctx } = audioParts(); if (!ctx) return;
    if (!this.src) this.start();   // audio unlocked mid-ride
    const rate = 0.85 + Math.min(1.9, speed / 7.5) + (boost ? 0.3 : 0);
    const cut = 700 + speed * 85 + (boost ? 700 : 0), vol = 0.12 + Math.min(0.08, speed * 0.006) + (boost ? 0.03 : 0);
    const t = ctx.currentTime;
    if (t - this.lastSet < 0.08 || (Math.abs(rate - this.rate) < 0.02 && Math.abs(vol - this.vol) < 0.005)) return;
    this.lastSet = t; this.rate = rate; this.cut = cut; this.vol = vol;
    this.src.playbackRate.setTargetAtTime(rate, t, 0.09);
    this.f.frequency.setTargetAtTime(cut, t, 0.1);
    if (!this.muted) this.g.gain.setTargetAtTime(vol, t, 0.12);
  }
  // pause menu / fail screen: quiet, but keep the node (resume brings it back without a new start)
  mute(on) {
    this.muted = on;
    const { ctx } = audioParts(); if (!ctx || !this.g) return;
    this.g.gain.setTargetAtTime(on ? 0 : this.vol, ctx.currentTime, 0.06);
  }
  stop() {
    this.want = false; this.muted = false;
    const { ctx } = audioParts(); if (!ctx || !this.src) { this.src = null; return; }
    const src = this.src, f = this.f, g = this.g, t = ctx.currentTime;
    g.gain.setTargetAtTime(0, t, 0.08);
    try { src.stop(t + 0.5); } catch (e) {}
    src.onended = () => { try { src.disconnect(); f.disconnect(); g.disconnect(); } catch (e) {} };
    this.src = this.f = this.g = null; this.lastSet = -1;
  }
}
