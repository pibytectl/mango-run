// Voiced lines with subtitles (Arabic + optional English), music ducking, and gameplay barks that never
// repeat back-to-back or talk over a story line.
import { LINES, CAST } from './lines.js';
import { voiceBuffer } from './assets3d.js';
import { audioParts, setMusicDuck, soundOn } from '../audio.js';

const $ = (id) => document.getElementById(id);

export class Voice {
  constructor() {
    this.cur = null; this.curPri = 0; this.cool = {}; this.last = {}; this.played = new Set(); this.loaded = 0; this.failed = 0;
    this.el = $('subs3d'); this.nameEl = this.el.querySelector('.who'); this.arEl = this.el.querySelector('.ar'); this.enEl = this.el.querySelector('.en');
    this.subT = 0; this.gen = 0;
  }
  // priority: 3 story (cutscene), 2 important gameplay, 1 bark
  async say(id, pri = 2) {
    const L = LINES[id];
    if (!L) return;
    if (this.cur && this.curPri > pri) return;
    this.stop();
    const gen = ++this.gen;
    this.curPri = pri; this.played.add(id);
    this.showSub(L);
    const { ctx, voiceGain } = audioParts();
    let dur = 0.9 + L.ar.length * 0.065;
    const buf = ctx ? await voiceBuffer(ctx, id) : null;
    if (gen !== this.gen) return;
    if (buf) { this.loaded++; dur = buf.duration; } else this.failed++;
    if (buf && ctx && soundOn()) {
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = ctx.createGain(); g.gain.value = 1;
      src.connect(g); g.connect(voiceGain); src.start();
      this.cur = { src, id };
      setMusicDuck(0.42);
    } else this.cur = { src: null, id };
    this.subT = dur + 0.35;
    this.endAt = performance.now() + dur * 1000;
    return new Promise((res) => {
      this._res = res;
      this._timer = setTimeout(() => { if (gen === this.gen) { this.cur = null; this.curPri = 0; setMusicDuck(1); res(); } }, dur * 1000 + 150);
    });
  }
  // a bark from a list, skipping the one said last time; cooldown per key
  bark(ids, key, cd = 4, pri = 1) {
    const now = performance.now() / 1000;
    if (this.cool[key] && now < this.cool[key]) return false;
    if (this.cur && this.curPri >= pri) return false;
    const list = Array.isArray(ids) ? ids : [ids];
    let pick = list.filter((i) => i !== this.last[key]);
    if (!pick.length) pick = list;
    const id = pick[Math.floor(Math.random() * pick.length)];
    this.last[key] = id; this.cool[key] = now + cd;
    this.say(id, pri);
    return true;
  }
  busy() { return !!this.cur; }
  stop() {
    this.gen++;
    if (this.cur && this.cur.src) { try { this.cur.src.stop(); } catch (e) {} }
    clearTimeout(this._timer);
    if (this._res) { const r = this._res; this._res = null; r(); }
    this.cur = null; this.curPri = 0; setMusicDuck(1);
  }
  showSub(L) {
    const c = CAST[L.who];
    this.nameEl.textContent = c.ar; this.nameEl.dataset.who = L.who;
    this.arEl.textContent = L.ar; this.enEl.textContent = (c.en ? c.en + ': ' : '') + L.en;
    this.el.classList.remove('hidden'); this.el.style.animation = 'none'; void this.el.offsetWidth; this.el.style.animation = '';
  }
  update(dt) {
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.el.classList.add('hidden'); }
  }
  hide() { this.subT = 0; this.el.classList.add('hidden'); }
}
