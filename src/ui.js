import { num, clock, HOWTO, UI as TXT } from './strings.js';

const $ = (id) => document.getElementById(id);

// Hearts are inline SVG, not the ♥ text glyph: iOS draws that glyph as a colour emoji that ignores CSS colour,
// so full, half and empty all looked the same on an iPhone. Full = red, half = left half red with a light
// split line, empty = dark hollow with an outline.
const HEART = 'M12 21.2 3.4 12.6C1 10.2 1 6.4 3.4 4.1 5.6 2 9.2 2.1 11.3 4.3L12 5l.7-.7c2.1-2.2 5.7-2.3 7.9-.2 2.4 2.3 2.4 6.1 0 8.5Z';
function heartSVG(state, i, pop) {
  const fill = state === 'empty' ? '' : `<path d="${HEART}" fill="#e2342c"${state === 'half' ? ` clip-path="url(#hh${i})"` : ''}/>`
    + `<path d="M7.2 5.6c-1.6.2-2.7 1.5-2.8 3" stroke="#ffb3a6" stroke-width="1.6" stroke-linecap="round" fill="none"${state === 'half' ? ` clip-path="url(#hh${i})"` : ''}/>`;
  return `<svg class="heart ${state}${pop ? ' pop' : ''}" viewBox="0 0 24 23" aria-hidden="true">`
    + (state === 'half' ? `<clipPath id="hh${i}"><rect x="0" y="0" width="12" height="23"/></clipPath>` : '')
    + `<path d="${HEART}" fill="rgba(40,14,8,0.78)"/>${fill}`
    + (state === 'half' ? '<path d="M12 4.6V21" stroke="#ffe1c2" stroke-width="1.3"/>' : '')
    + `<path d="${HEART}" fill="none" stroke="${state === 'empty' ? '#c98a3a' : '#2a0905'}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}

export class UI {
  constructor() {
    this.toastT = 0;
    this.subs = localStorage.getItem('saidi.subs') !== '0';
    document.body.classList.toggle('nosubs', !this.subs);
    const how = $('how-list');
    how.innerHTML = HOWTO.map((h) => `<div class="item"><div class="k ar">${h.k}</div><div class="t"><span class="ar">${h.ar}</span><span class="en" dir="ltr">${h.en}</span></div></div>`).join('');
  }
  show(id, on = true) { $(id).classList.toggle('hidden', !on); }
  screen(name) {
    for (const s of ['screen-loading', 'screen-title', 'screen-how', 'screen-pause', 'screen-fail', 'screen-end']) this.show(s, s === name);
  }
  setLoad(p) { $('load-fill').style.width = Math.round(p * 100) + '%'; }
  setSubs(on) {
    this.subs = on; localStorage.setItem('saidi.subs', on ? '1' : '0');
    document.body.classList.toggle('nosubs', !on);
    for (const id of ['btn-subs', 'btn-subs2']) $(id).textContent = on ? TXT.subsOn : TXT.subsOff;
  }
  setSoundLabel(on) { for (const id of ['btn-sound', 'btn-sound2']) $(id).textContent = on ? TXT.soundOn : TXT.soundOff; }

  // ---------- HUD ----------
  // health in half hearts (6 = three full hearts)
  setHalfHearts(hp, popIdx) {
    $('hearts').innerHTML = [0, 1, 2].map((i) => heartSVG(hp >= i * 2 + 2 ? 'full' : hp === i * 2 + 1 ? 'half' : 'empty', i, i === popIdx)).join('');
  }
  setMangoes(n, anim) {
    $('mango-count').textContent = num(n);
    if (anim) { const s = $('slot-crate'); s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); }
  }
  setTime(t, limit) {
    const el = $('time-left');
    const txt = clock(t);
    if (txt !== this._lastClock) { el.textContent = txt; this._lastClock = txt; }
    el.classList.toggle('urgent', t < 30);
    const p = 1 - t / limit; // sun travels the arc from left-top to right-horizon
    const a = Math.PI * (0.15 + 0.85 * p);
    const x = 50 - Math.cos(a) * 48, y = 100 - Math.sin(a) * 92;
    const d = $('sun-dot'); d.style.left = x + '%'; d.style.top = y + '%';
  }
  setStamina(s) {
    const r = Math.round(s);
    if (r === this._st) return; this._st = r;
    $('stamina-fill').style.width = r + '%';
    $('staff-cool').style.height = (100 - r) * 0.9 + '%';
  }

  // key: optional id so a caller can refresh the same message without replaying the entry animation
  toast(h, dur = 3, key) {
    const t = $('toast');
    const same = key && this.toastKey === key && this.toastT > 0;
    this.toastKey = key || null;
    this.toastT = dur;
    if (same) return;
    t.querySelector('.ar').textContent = h.ar; t.querySelector('.en').textContent = h.en;
    t.classList.remove('hidden'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  }
  hideToast(key) { if (key && this.toastKey !== key) return; this.toastT = 0; this.toastKey = null; $('toast').classList.add('hidden'); }
  // counts the toast down; the 3D loop calls it every frame
  tickToast(dt) {
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) { this.toastKey = null; $('toast').classList.add('hidden'); } }
  }
  banner(seg) {
    const b = $('banner');
    b.querySelector('.ar').textContent = seg.ar; b.querySelector('.en').textContent = seg.en;
    b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(this._bannerT); this._bannerT = setTimeout(() => b.classList.add('hidden'), 2500);
  }
  clearWorld() {
    $('toast').classList.add('hidden'); $('banner').classList.add('hidden'); this.toastT = 0; this.toastKey = null;
  }
}
