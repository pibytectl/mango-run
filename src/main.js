// The Mango Run: bootstrap. One WebGL renderer, the menus, audio unlock on the first gesture, and the 3D mission
// (src/3d/game3d.js, loaded when Play is pressed). Round 3 (Andy: "drop the 2.5D entirely"): the 2.5D
// side-scroller and its code are gone; git history keeps them.
//   ?debug=auto3d   a scripted player runs the whole mission (tests)
//   ?seg3d=<seg>    start at a segment (street, market, chase, fight, roofs, roofs2, jetty; Mission 2: start, B, C, E, F, G)
//   ?mission=2      Mission 2 (with ?debug=auto3d or ?seg3d it starts straight away; on the title it is the
//                   pick only once Mission 1 is finished, remembered in localStorage)
import * as THREE from '../vendor/three.module.min.js';
import { UI } from './ui.js';
import { audioInit, audioSuspend, audioWake, audioDebug, loadMusic, playMusic, setSound, soundOn, sfx } from './audio.js';

const Q = new URLSearchParams(location.search);
const DEBUG_AUTO3D = Q.get('debug') === 'auto3d';
const Q_MISSION = Q.get('mission') === '2' ? 2 : 1;
// missions unlocked (1 = only the first); storage can be blocked (private mode), then only the first
function unlocked() { try { return Math.max(1, Math.min(3, +localStorage.getItem('saidi.unlocked') || 1)); } catch (e) { return 1; } }
function refreshMissions() { const b = document.getElementById('btn-m2'); if (b) b.classList.toggle('locked', unlocked() < 2); }
// A phone or tablet: the primary pointer is coarse. A touchscreen laptop has touch too, but its primary
// pointer is fine (mouse or touchpad): it starts with mouse/keyboard controls (round 3: Mzee's laptop showed
// the touch overlay and the mouse did nothing). The 3D mode switches with the input actually used.
const isTouch = matchMedia('(pointer: coarse)').matches || (('ontouchstart' in window || navigator.maxTouchPoints > 0) && !matchMedia('(any-pointer: fine)').matches);
if (!isTouch) document.body.classList.add('desktop');

const ui = new UI();
const stage = document.getElementById('stage');
// MSAA on (cheap on phone GPUs, which resolve it on-chip); ?aa=0 turns it off for software-GL test runs
const renderer = new THREE.WebGLRenderer({ antialias: Q.get('aa') !== '0', alpha: false, powerPreference: 'high-performance' });
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
  state = 'title'; ui.screen('screen-title'); ui.show('hud', false); ui.clearWorld(); refreshMissions();
  playMusic('title', 0.55);
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
const on = (id, fn) => document.getElementById(id).addEventListener('click', (e) => { e.stopPropagation(); sfx.tap(); fn(); });
on('btn-start3d', () => start3D(1));
on('btn-m2', () => { if (unlocked() >= 2) start3D(2); else { const b = document.getElementById('btn-m2'); b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); } });
on('btn-next', () => start3D(2));
on('btn-how', () => { ui.screen('screen-how'); });
on('btn-how-close', () => { ui.screen('screen-title'); });
const toggleSound = () => { setSound(!soundOn()); ui.setSoundLabel(soundOn()); localStorage.setItem('saidi.sound', soundOn() ? '1' : '0'); };
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
if (localStorage.getItem('saidi.sound') === '0') setSound(false);
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
