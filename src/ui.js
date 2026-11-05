import { num, clock, NAMES, HOWTO, UI as TXT } from './strings.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.worldUI = $('world-ui');
    this.bubbles = [];
    this.floats = [];
    this.warns = [];
    this.toastT = 0; this.hintT = 0; this.hintEl = null;
    this.subs = localStorage.getItem('saidi.subs') !== '0';
    document.body.classList.toggle('nosubs', !this.subs);
    const how = $('how-list');
    how.innerHTML = HOWTO.map((h) => `<div class="item"><div class="k ar">${h.k}</div><div class="t"><span class="ar">${h.ar}</span><span class="en" dir="ltr">${h.en}</span></div></div>`).join('');
    this.lastHearts = 3;
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
  setHearts(n, anim) {
    const el = $('hearts');
    el.innerHTML = [0, 1, 2].map((i) => `<div class="heart${i < n ? '' : ' empty'}${anim && i === n ? ' pop' : ''}"></div>`).join('');
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
  flashStamina() { const s = $('slot-staff'); s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); }

  toast(h, dur = 3) {
    const t = $('toast');
    t.querySelector('.ar').textContent = h.ar; t.querySelector('.en').textContent = h.en;
    t.classList.remove('hidden'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    this.toastT = dur;
  }
  banner(seg) {
    const b = $('banner');
    b.querySelector('.ar').textContent = seg.ar; b.querySelector('.en').textContent = seg.en;
    b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(this._bannerT); this._bannerT = setTimeout(() => b.classList.add('hidden'), 2500);
  }
  hintBtn(name, dur) {
    if (this.hintEl) this.hintEl.classList.remove('hint');
    this.hintEl = document.querySelector(`[data-btn="${name}"]`);
    if (this.hintEl) this.hintEl.classList.add('hint');
    this.hintT = dur;
  }
  bump(name) { const el = document.querySelector(`[data-btn="${name}"]`); if (el) { el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 120); } }
  edgeWarn(dur, yFrac) {
    const el = document.createElement('div'); el.className = 'edge-warn'; el.textContent = '!';
    el.style.top = (yFrac === undefined ? 70 : 100 - yFrac * 10) + '%';
    this.worldUI.appendChild(el); this.warns.push({ el, t: dur });
  }
  bubble(target, line, dur, isHero, yOff) {
    // one bubble per speaker at a time
    for (const b of this.bubbles) if (b.target === target) { b.t = 0; }
    const el = document.createElement('div');
    el.className = 'bubble' + (isHero ? ' hero' : '');
    el.innerHTML = `<div class="ar"></div><div class="en" dir="ltr"></div>`;
    el.firstChild.textContent = line.ar; el.lastChild.textContent = line.en;
    this.worldUI.appendChild(el);
    this.bubbles.push({ el, target, t: dur, isHero, yOff: yOff || 0 });
  }
  floatText(x, y, txt) {
    const el = document.createElement('div'); el.className = 'float-txt'; el.textContent = txt;
    this.worldUI.appendChild(el); this.floats.push({ el, x, y, t: 0.9 });
  }
  clearWorld() {
    for (const b of this.bubbles) b.el.remove(); for (const f of this.floats) f.el.remove(); for (const w of this.warns) w.el.remove();
    this.bubbles = []; this.floats = []; this.warns = [];
    $('toast').classList.add('hidden'); $('banner').classList.add('hidden');
    if (this.hintEl) this.hintEl.classList.remove('hint');
  }
  updateWorldUI(world, cx, cy, vw, vh, frameDt) {
    const W = innerWidth, H = innerHeight, dt = Math.min(0.1, frameDt || 0);
    const toScreen = (x, y) => [((x - (cx - vw / 2)) / vw) * W, ((cy + vh / 2 - y) / vh) * H];
    const placed = [];
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.t -= dt;
      if (b.t <= 0) { b.el.remove(); this.bubbles.splice(i, 1); continue; }
      let x, y;
      if (b.target === world.hero) { x = world.hero.root.position.x; y = world.hero.root.position.y + 2.2; }
      else if (b.target.m) { x = b.target.m.position.x; y = b.target.m.position.y + (b.target.h || 1.9) + 0.3 + b.yOff * 0; }
      else { x = b.target.x; y = b.target.y; }
      const [sx, sy] = toScreen(x, y);
      const half = Math.min(130, b.el.offsetWidth / 2 || 100);
      const bw = b.el.offsetWidth || 200, bh = b.el.offsetHeight || 40;
      const left = Math.max(half + 6, Math.min(W - half - 6, sx));
      let top = Math.max(64 + bh, sy);
      // keep bubbles from stacking on each other: push later ones up (or down if no room)
      for (let k = 0; k < 4; k++) {
        const hit = placed.find((r) => Math.abs(r.x - left) < (r.w + bw) / 2 + 4 && top > r.y - r.h - 4 && top - bh < r.y + 4);
        if (!hit) break;
        top = hit.y - hit.h - 6;
        if (top - bh < 56) top = hit.y + bh + 10;
      }
      placed.push({ x: left, y: top, w: bw, h: bh });
      b.el.style.left = left + 'px';
      b.el.style.top = top + 'px';
      b.el.style.opacity = Math.min(1, b.t * 4);
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]; f.t -= dt; f.y += dt * 1.2;
      if (f.t <= 0) { f.el.remove(); this.floats.splice(i, 1); continue; }
      const [sx, sy] = toScreen(f.x, f.y);
      f.el.style.left = sx + 'px'; f.el.style.top = sy + 'px'; f.el.style.opacity = Math.min(1, f.t * 2);
    }
    for (let i = this.warns.length - 1; i >= 0; i--) { const w = this.warns[i]; w.t -= dt; if (w.t <= 0) { w.el.remove(); this.warns.splice(i, 1); } }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('toast').classList.add('hidden'); }
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0 && this.hintEl) this.hintEl.classList.remove('hint'); }
    this.setStamina(world.hero.stamina);
    this.setTime(world.timeLeft, 270);
  }

  // ---------- dialogue cards ----------
  dialog(cards, bg, onDone) {
    this.show('dialog', true);
    $('cut-img').src = `assets/img/${bg}.webp`;
    let i = -1;
    const next = () => {
      i++;
      if (i >= cards.length) { this.show('dialog', false); this.dialogNext = null; onDone(); return; }
      const c = cards[i], who = NAMES[c.who];
      $('d-name').textContent = who.ar ? who.ar + (this.subs && who.en ? '' : '') : '';
      $('d-line').textContent = c.ar; $('d-en').textContent = c.en;
      const port = $('d-port');
      port.parentElement.classList.toggle('none', !who.port);
      if (who.port) port.src = `assets/img/${who.port}.webp`;
      const box = document.querySelector('.dbox'); box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
      sfx.tap();
    };
    this.dialogNext = next;
    this.dialogSkip = () => { i = cards.length - 1; next(); };
    next();
  }

  // ---------- end screen ----------
  end({ stars, mangoes, time }) {
    this.screen('screen-end');
    const st = [...document.querySelectorAll('#stars span')];
    st.forEach((s, i) => s.classList.toggle('on', i < stars));
    $('end-mangoes').textContent = num(mangoes) + ' من ' + num(12);
    $('end-time').textContent = clock(time);
    const r = TXT.ranks[stars - 1];
    $('end-rank').textContent = r.ar; $('end-rank-en').textContent = r.en;
    for (let i = 0; i < stars; i++) setTimeout(() => sfx.star(i), 350 * i + 200);
  }
  fail(kind) {
    const t = kind === 'time' ? TXT.timeoutTitle : TXT.heartsTitle, b = kind === 'time' ? TXT.timeoutBody : TXT.heartsBody;
    $('fail-title').textContent = t.ar; $('fail-title-en').textContent = t.en;
    $('fail-body').textContent = b.ar; $('fail-body-en').textContent = b.en;
    this.screen('screen-fail');
  }
}
