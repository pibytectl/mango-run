// The Mango Run: bootstrap. One WebGL renderer, the menus, audio unlock on the first gesture, and the 3D mission
// (src/3d/game3d.js, loaded when Play is pressed). Round 3 (Andy: "drop the 2.5D entirely"): the 2.5D
// side-scroller and its code are gone; git history keeps them.
//   ?debug=auto3d   a scripted player runs the whole mission (tests)
//   ?seg3d=<seg>    start at a segment (street, market, chase, fight, roofs, roofs2, jetty; Mission 2: start, B, C, E, F, G)
//   ?mission=2|3    Mission 2 or 3 (with ?debug=auto3d or ?seg3d it starts straight away; on the title each is
//                   the pick only once the one before is finished, remembered in localStorage; Mission 3: ?seg3d=d1..d5)
import * as THREE from '../vendor/three.module.min.js';
import { UI, onTap } from './ui.js';
import { getRec, getCostume, nextCostume, COSTUMES, costumeOpen } from './records.js';
import { num } from './strings.js';
import { audioInit, audioSuspend, audioWake, audioDebug, loadMusic, playMusic, setSound, soundOn, sfx } from './audio.js';

const Q = new URLSearchParams(location.search);
const DEBUG_AUTO3D = Q.get('debug') === 'auto3d';
const Q_MISSION = ['2', '3'].includes(Q.get('mission')) ? +Q.get('mission') : 1;
// missions unlocked (1 = only the first); storage can be blocked (private mode), then only the first
function unlocked() { try { return Math.max(1, Math.min(3, +localStorage.getItem('saidi.unlocked') || 1)); } catch (e) { return 1; } }
function refreshMissions() { for (const n of [2, 3]) { const b = document.getElementById('btn-m' + n); if (b) b.classList.toggle('locked', unlocked() < n); } }
// best stars per mission on the cards (saved by the end screen)
function refreshStars() {
  for (const c of document.querySelectorAll('.mcard')) {
    let n = 0; try { n = +localStorage.getItem('saidi.best.' + c.dataset.m) || 0; } catch (e) { n = 0; }
    c.querySelectorAll('.mstars i').forEach((s, i) => s.classList.toggle('on', i < n));
    c.classList.toggle('played', n > 0);
    const r = getRec(+c.dataset.m), b = c.querySelector('.mbest');
    if (b) b.textContent = r.score ? num(r.score) : '';
  }
  refreshCostume();
}
// the galabeya pill: cycles through the ones opened by three-star runs; with none open it says how to open one
function refreshCostume(pulse) {
  const b = document.getElementById('btn-costume'), open = COSTUMES.filter(costumeOpen).length;
  b.textContent = open > 1 ? 'الجلابية: ' + getCostume().ar : 'جلابية جديدة: ٣ نجوم';
  b.classList.toggle('lockedpill', open < 2);
  b.title = open > 1 ? 'Galabeya: ' + getCostume().en : 'Three stars on a mission unlock a new galabeya';
  if (pulse) { b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); }
}
// A phone or tablet: the primary pointer is coarse. A touchscreen laptop has touch too, but its primary
// pointer is fine (mouse or touchpad): it starts with mouse/keyboard controls (round 3: Mzee's laptop showed
// the touch overlay and the mouse did nothing). The 3D mode switches with the input actually used.
const isTouch = matchMedia('(pointer: coarse)').matches || (('ontouchstart' in window || navigator.maxTouchPoints > 0) && !matchMedia('(any-pointer: fine)').matches);
if (!isTouch) document.body.classList.add('desktop');

const ui = new UI();
const stage = document.getElementById('stage');
// MSAA on (cheap on phone GPUs, which resolve it on-chip); ?aa=0 turns it off for software-GL test runs
// Redesign: the 3D mode draws into its own multisampled target (src/3d/post.js), so the canvas itself is made
// without MSAA; a device that cannot do float targets (or ?post=0) gets the antialiased canvas as before.
const wantAA = Q.get('aa') !== '0';
let renderer = new THREE.WebGLRenderer({ antialias: wantAA && Q.get('post') === '0', alpha: false, powerPreference: 'high-performance' });
if (wantAA && Q.get('post') !== '0') {
  const gl = renderer.getContext();
  if (!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))) {
    renderer.dispose(); renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  }
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x1a0b05);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight, false);
stage.appendChild(renderer.domElement);

let state = 'loading';
const game = { state: () => state, log: [] };
window.__saidi = game;
game.audio = audioDebug;

// ---------------------------------------------------------------- boot: fonts, then the title
(async function boot() {
  ui.screen('screen-loading'); ui.setLoad(0.3);
  try { await Promise.race([document.fonts.load('900 40px CairoGame'), new Promise((r) => setTimeout(r, 3000))]); } catch (e) {}
  ui.setLoad(1);
  game.ready = true;
  toTitle();
  if (DEBUG_AUTO3D || Q.has('seg3d')) setTimeout(() => start3D(Q_MISSION), 300);
})();

// ---------------------------------------------------------------- the 3D mission
let g3 = null;
const in3D = () => !!(g3 && g3.active);
async function start3D(mission = 1) {
  gesture();
  if (g3) { g3.exit(); g3 = null; }
  state = '3d';
  ui.clearWorld(); ui.show('hud', false);
  try {
    const m = await import('./3d/game3d.js');
    g3 = await m.start3D({ renderer, ui, isTouch, auto: DEBUG_AUTO3D, mission });
    game.g3 = g3;
  } catch (e) {
    console.error('3D mode failed', e); game.g3Error = String(e && e.message);
    g3 = null; toTitle();
  }
}

function toTitle() {
  if (g3) { g3.exit(); g3 = null; }
  state = 'title'; ui.screen('screen-title'); ui.show('hud', false); ui.clearWorld(); refreshMissions(); refreshStars();
  playMusic('title', 0.55);
  warmUp();
}

// While the player reads the title screen: fetch the 3D code and the files of the mission he will most likely
// start (the newest one unlocked), two at a time, into the browser cache. Play then starts from the cache and not
// from the network (~10 MB). Not on a data-saver connection, not in test starts, once per mission.
const warmed = new Set();
function warmUp() {
  if (DEBUG_AUTO3D || Q.has('seg3d')) return;
  const c = navigator.connection;
  if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return;
  const m = unlocked();
  if (warmed.has(m)) return; warmed.add(m);
  setTimeout(async () => {
    try {
      const { assetUrls } = await import('./3d/assets3d.js');
      import('./3d/game3d.js').catch(() => {});
      const list = assetUrls(m); let i = 0;
      const next = () => { if (state !== 'title' || i >= list.length) return; fetch(list[i++]).then((r) => r.arrayBuffer()).catch(() => {}).then(next); };
      next(); next();
    } catch (e) { /* only a head start */ }
  }, 1200);
}

// first gesture: audio, fullscreen, landscape lock
let gestured = false;
function gesture(e) {
  audioInit(e && e.type);
  if (!gestured) {
    gestured = true;
    loadMusic('title', 'assets/audio/title.mp3');
    loadMusic('run', 'assets/audio/run.mp3');
    if (state === 'title') playMusic('title', 0.55);
    if (isTouch && !DEBUG_AUTO3D) {
      const el = document.documentElement;
      const fs = el.requestFullscreen || el.webkitRequestFullscreen;
      if (fs) { try { const p = fs.call(el, { navigationUI: 'hide' }); if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } catch (e) {} }
    }
  }
}
// iOS only treats touchend / click as a gesture that may start audio (pointerdown does not), and the 3D touch
// layer cancels the synthetic click, so listen to all of them on window in the capture phase
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, gesture, { capture: true, passive: true });

// ---------------------------------------------------------------- buttons
const on = (id, fn) => onTap(document.getElementById(id), (e) => { e.stopPropagation(); sfx.tap(); fn(); });
on('btn-start3d', () => start3D(1));
for (const n of [2, 3]) on('btn-m' + n, () => { if (unlocked() >= n) start3D(n); else { const b = document.getElementById('btn-m' + n); b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); } });
on('btn-next', () => start3D(Math.min(3, (+document.body.dataset.endm || 1) + 1)));
on('btn-costume', () => { if (COSTUMES.filter(costumeOpen).length > 1) nextCostume(); refreshCostume(true); });
// "restart the mission" asks for a second tap within 3 s: it throws the run away
const confirmTap = (id, fn) => {
  const b = document.getElementById(id), label = b.textContent; let t = 0;
  on(id, () => {
    if (b.dataset.sure) { clearTimeout(t); delete b.dataset.sure; b.textContent = label; fn(); return; }
    b.dataset.sure = '1'; b.textContent = 'متأكد؟ دوس تاني';
    t = setTimeout(() => { delete b.dataset.sure; b.textContent = label; }, 3000);
  });
};
confirmTap('btn-restart-run', () => in3D() && g3.restartRun());
on('btn-fail-restart', () => in3D() && g3.restartRun());
on('btn-how', () => { ui.screen('screen-how'); });
on('btn-how-close', () => { ui.screen('screen-title'); });
const toggleSound = () => { setSound(!soundOn()); ui.setSoundLabel(soundOn()); try { localStorage.setItem('saidi.sound', soundOn() ? '1' : '0'); } catch (e) { /* storage blocked */ } };
on('btn-sound', toggleSound); on('btn-sound2', toggleSound);
const toggleSubs = () => ui.setSubs(!ui.subs);
on('btn-subs', toggleSubs); on('btn-subs2', toggleSubs);
on('btn-pause', () => in3D() && g3.pause());
on('btn-resume', () => { audioInit('resume'); if (in3D()) g3.resume(); });
on('btn-restart-cp', () => in3D() && g3.restartCp());
on('btn-menu', () => toTitle());
on('btn-menu2', () => toTitle());
on('btn-retry', () => in3D() && g3.retry());
on('btn-again', () => in3D() && g3.again());
try { if (localStorage.getItem('saidi.sound') === '0') setSound(false); } catch (e) { /* storage blocked */ }
ui.setSoundLabel(soundOn()); ui.setSubs(ui.subs);

// Esc or P: pause / resume
addEventListener('keydown', (e) => {
  if ((e.code !== 'Escape' && e.code !== 'KeyP') || !in3D()) return;
  if (g3.state === 'play') g3.pause(); else if (g3.state === 'paused') g3.resume();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (in3D()) g3.pause(); audioSuspend(); }
  else if (gestured) audioWake('visible');
});
