// WebAudio: two music loops (decoded on first gesture) and synthesized sound effects (no SFX assets).
let ctx = null, master, musicGain, sfxGain, voiceGain, noiseBuf;
const music = { buffers: {}, src: null, name: null };
let enabled = true;

// iOS notes: Web Audio counts as "ambient" (muted by the silent switch) unless the page asks for playback;
// only touchend/click (not pointerdown) are user gestures there; an app switch, a call or the lock screen
// leaves the context "interrupted" (not "suspended"). audioInit() is called from every gesture and resumes
// from both states; audioSuspend/audioWake follow page visibility.
export const audioLog = [];
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let unlocked = false, htmlEl = null, hidden = false;
function setPlayback() {
  try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) {}
}
// fallback for iOS without navigator.audioSession: a looping silent <audio> element puts the page's audio
// session in playback mode, so Web Audio is heard with the silent switch on (iOS only: on Android an
// <audio> element would show a media notification)
function silentWavUrl() {
  const n = 2205, b = new ArrayBuffer(44 + n), v = new DataView(b), w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 22050, true); v.setUint32(28, 22050, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}
function htmlUnlock() {
  if (!IOS || (navigator.audioSession && 'type' in navigator.audioSession)) return;
  if (!htmlEl) {
    htmlEl = document.createElement('audio');
    htmlEl.setAttribute('playsinline', ''); htmlEl.setAttribute('x-webkit-airplay', 'deny');
    htmlEl.preload = 'auto'; htmlEl.loop = true; htmlEl.src = silentWavUrl();
  }
  if (htmlEl.paused && !hidden) { audioLog.push(['html-audio', 'play']); try { const p = htmlEl.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
}
function tryResume(why) {
  if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;
  try { const p = ctx.resume(); if (p && p.then) p.then(() => audioLog.push(['resumed', why, ctx.state]), (e) => audioLog.push(['resume failed', why, String(e)])); } catch (e) {}
}
export function audioInit(why = 'gesture') {
  setPlayback();
  htmlUnlock();
  if (ctx) {
    tryResume(why);
    if (!unlocked) unlockTick();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  ctx.onstatechange = () => { audioLog.push(['state', ctx.state]); if (ctx.state === 'interrupted' && !hidden) setTimeout(() => tryResume('interrupted'), 400); };
  audioLog.push(['created', ctx.state]);
  tryResume(why);
  master = ctx.createGain(); master.gain.value = enabled ? 1 : 0; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(comp);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(comp);
  voiceGain = ctx.createGain(); voiceGain.gain.value = 1.0; voiceGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  unlockTick();
}
// a one-sample silent buffer started inside the gesture: the classic iOS output unlock
function unlockTick() {
  try { const b = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(0); unlocked = true; } catch (e) {}
}
export function audioSuspend() {
  hidden = true;
  if (htmlEl && !htmlEl.paused) htmlEl.pause();
  if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) {} }
}
export function audioWake(why = 'visible') {
  hidden = false;
  if (!ctx) return;
  setPlayback();
  tryResume(why);
}
export function audioState() { return ctx ? ctx.state : 'none'; }
// tests only (window.__saidi.audio)
export function audioDebug() { return { ctx, htmlEl, log: audioLog, loops: loopReport, music: music.name, ambient: ambWant.name && beds[ambWant.name] && beds[ambWant.name].src ? ambWant.vol : null, ambientBed: ambWant.name, session: navigator.audioSession ? navigator.audioSession.type : null }; }

export async function loadMusic(name, url) {
  try {
    const r = await fetch(url);
    const ab = await r.arrayBuffer();
    if (!ctx) return;
    music.buffers[name] = loopable(await new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)), 0.03);
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
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.__tag = 'music';
  const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(vol, now, 0.6);
  src.connect(g); g.connect(musicGain); src.start(now);
  music.src = src; music.g = g; music.name = name;
}
// A decoded loop made seamless (round 3). Round 2 looped from `pre` to duration - `pre` to skip encoder padding,
// but the samples at those two points do not meet: a click on every wrap (measured on the decoded files:
// run.mp3 jumped 0.61 at its loop point, above the music's own 99.9th-percentile sample step of 0.37; the
// street bed 0.0095 against 0.0031). Now the loop is [pre, end - pre) copied into its own buffer, and its last
// `pre` seconds are crossfaded (equal power) into the `pre` seconds that come just before the loop start, so the
// wrap continues exactly where the head begins. Played with loop = true over the whole buffer.
function loopable(buf, pre) {
  const sr = buf.sampleRate, a = Math.round(pre * sr), n = buf.length - 2 * a;
  if (n <= a * 4) return buf;
  const out = ctx.createBuffer(buf.numberOfChannels, n, sr);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const s = buf.getChannelData(c), d = out.getChannelData(c);
    d.set(s.subarray(a, a + n));
    for (let j = 0; j < a; j++) {
      const w = (j + 1) / a, i = n - a + j;                 // w: 0 -> 1 across the tail
      d[i] = s[a + i] * Math.cos(w * Math.PI / 2) + s[j] * Math.sin(w * Math.PI / 2);
    }
  }
  out.__loop = true;
  return out;
}
// tests: how well every looping buffer wraps (sample jump at the wrap against the 99.9th percentile step)
export function loopReport() {
  const r = {};
  const one = (name, b) => {
    if (!b) return;
    const d = b.getChannelData(0), n = d.length, st = new Float32Array(n - 1);
    for (let i = 1; i < n; i++) st[i - 1] = Math.abs(d[i] - d[i - 1]);
    const sorted = Array.from(st).sort((x, y) => x - y);
    r[name] = { wrap: +Math.abs(d[0] - d[n - 1]).toFixed(4), p999: +sorted[Math.floor(sorted.length * 0.999)].toFixed(4), median: +sorted[Math.floor(sorted.length / 2)].toFixed(5) };
  };
  for (const [k, b] of Object.entries(music.buffers)) one('music-' + k, b);
  for (const [k, b] of Object.entries(beds)) one('amb-' + k, b.buf);
  return r;
}
// ambient beds (3D), one at a time, crossfaded: 'street' (distant traffic) and 'roof' (city from a rooftop)
const beds = {};
let ambWant = { name: null, vol: 0 };
export async function loadAmbient(name, url) {
  const b = beds[name] = beds[name] || { raw: null, buf: null, src: null, g: null };
  try { b.raw = await (await fetch(url)).arrayBuffer(); } catch (e) { return; }
  decodeAmbient(name);
}
async function decodeAmbient(name) {
  const b = beds[name];
  if (!ctx || !b || !b.raw || b.buf) return;
  const raw = b.raw; b.raw = null;
  try { b.buf = loopable(await new Promise((res, rej) => ctx.decodeAudioData(raw, res, rej)), 0.06); } catch (e) { return; }
  setAmbient(ambWant.vol, ambWant.name);
}
export function setAmbient(vol, name = 'street') {
  ambWant = { name, vol };
  if (!ctx) return;
  for (const [k, b] of Object.entries(beds)) {
    const v = k === name ? vol : 0;
    if (!b.buf) { if (v > 0) decodeAmbient(k); continue; }
    if (!b.src && v > 0) {
      const src = ctx.createBufferSource(); src.buffer = b.buf; src.loop = true; src.__tag = 'amb-' + k;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(master); src.start(ctx.currentTime);
      b.src = src; b.g = g;
    }
    if (b.g) b.g.gain.setTargetAtTime(v, ctx.currentTime, 0.8);
  }
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
  horn() { if (!ctx || ctx.currentTime - (sfx._horn || -9) < 1.4) return; sfx._horn = ctx.currentTime; for (let k = 0; k < 2; k++) { tone('square', 466, 466, 0.16, 0.08, k * 0.22); tone('square', 587, 587, 0.16, 0.06, k * 0.22); } },
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
