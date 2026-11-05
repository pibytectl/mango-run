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
  scrape() { noise(0.3, 0.22, 'bandpass', 2400, 4, 0, 1200); },
  bump() { tone('sine', 150, 70, 0.14, 0.45); noise(0.12, 0.35, 'lowpass', 1200); },
  boost() { noise(0.5, 0.25, 'bandpass', 300, 1.5, 0, 1600); },
  slide() { noise(0.55, 0.22, 'lowpass', 1500, 0.7, 0, 400); },
  wall() { tone('sine', 220, 120, 0.1, 0.3); noise(0.08, 0.3, 'bandpass', 1500, 1.5); },
  splash() { noise(0.9, 0.6, 'lowpass', 3000, 0.7, 0, 250); noise(0.4, 0.3, 'highpass', 2000, 1, 0.1); },
  flap() { for (let i = 0; i < 7; i++) noise(0.05, 0.14, 'bandpass', 900 + Math.random() * 500, 1, i * 0.06); },
  telegraph() { tone('triangle', 660, 990, 0.12, 0.1); },
  cheer() { noise(1.6, 0.2, 'bandpass', 1300, 0.6); for (let i = 0; i < 8; i++) tone('triangle', 500 + Math.random() * 600, 700 + Math.random() * 500, 0.14, 0.035, 0.1 + Math.random()); },
};

// tok-tok engine: a buzzy two-stroke loop whose pitch follows speed
export class Engine {
  start() {
    const { ctx, sfxGain } = audioParts(); if (!ctx || this.o) return;
    this.o = ctx.createOscillator(); this.o.type = 'sawtooth';
    this.o2 = ctx.createOscillator(); this.o2.type = 'square';
    this.f = ctx.createBiquadFilter(); this.f.type = 'lowpass'; this.f.frequency.value = 900; this.f.Q.value = 2;
    this.g = ctx.createGain(); this.g.gain.value = 0.0;
    this.o.connect(this.f); this.o2.connect(this.f); this.f.connect(this.g); this.g.connect(sfxGain);
    this.o.start(); this.o2.start();
    this.g.gain.setTargetAtTime(0.07, ctx.currentTime, 0.3);
  }
  set(speed, boost) {
    const { ctx } = audioParts(); if (!ctx || !this.o) return;
    const f = 38 + speed * 4.2 + (boost ? 14 : 0), t = ctx.currentTime;
    this.o.frequency.setTargetAtTime(f, t, 0.08); this.o2.frequency.setTargetAtTime(f * 1.505, t, 0.08);
    this.f.frequency.setTargetAtTime(500 + speed * 70 + (boost ? 600 : 0), t, 0.1);
    this.g.gain.setTargetAtTime(0.05 + Math.min(0.06, speed * 0.004), t, 0.1);
  }
  stop() {
    const { ctx } = audioParts(); if (!ctx || !this.o) return;
    const o = this.o, o2 = this.o2; this.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    setTimeout(() => { try { o.stop(); o2.stop(); } catch (e) {} }, 800);
    this.o = null;
  }
}
