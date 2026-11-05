import * as THREE from '../vendor/three.module.min.js';
import { loadAll } from './gfx.js';
import { World } from './world.js';
import { UI } from './ui.js';
import { initInput, pollInput, input, clearInput } from './input.js';
import { audioInit, loadMusic, playMusic, setSound, soundOn, sfx } from './audio.js';
import { INTRO, FINALE, HINTS } from './strings.js';

const Q = new URLSearchParams(location.search);
const DEBUG_AUTO = Q.get('debug') === 'auto';
const START_SEG = Q.has('seg') ? +Q.get('seg') : null;
const SHOW_FPS = Q.has('fps') || DEBUG_AUTO;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (!isTouch) document.body.classList.add('desktop');

const ui = new UI();
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x1a0b05);
stage.appendChild(renderer.domElement);
const MAX_DPR = Math.min(window.devicePixelRatio || 1, isTouch ? 1.75 : 1.5);
let dprScale = 1;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-9, 9, 4.2, -4.2, 0.1, 100);
camera.position.z = 10;

let world = null;
let state = 'loading';
const game = { state: () => state, stats: { fpsSamples: [], segTimes: {}, deaths: 0, coverChecks: 0, heroCovered: 0, obstacleCovered: 0, coveredWhat: {} }, log: [] };
window.__saidi = game;
const glog = (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); game.log.push(s); console.log('[saidi]', s); };

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.max(1, MAX_DPR * dprScale));
  renderer.setSize(w, h, false);
  if (world) world.resize(w / h);
}
addEventListener('resize', resize);

// ---------------------------------------------------------------- boot
(async function boot() {
  ui.screen('screen-loading');
  try {
    await loadAll((p) => ui.setLoad(p));
  } catch (e) { console.error('load failed', e); }
  world = new World(scene, camera, ui);
  game.world = world;
  if (Q.has('zoom')) world.zoom = +Q.get('zoom');
  world.onFinish = onFinish;
  world.onTimeout = () => fail('time');
  world.onOutOfHearts = () => fail('hearts');
  resize();
  // warm up the GPU with every texture once, so the first play frame does not hitch
  world.render(1, 0); renderer.compile(scene, camera); renderer.render(scene, camera);
  game.ready = true;
  glog('loaded', { textures: Object.keys((await import('./gfx.js')).tex).length });
  toTitle();
  if (DEBUG_AUTO) setTimeout(() => startGame(), 300);
})();

function toTitle() {
  state = 'title'; ui.screen('screen-title'); ui.show('hud', false); ui.show('controls', false); ui.clearWorld();
  playMusic('title', 0.55);
}

// first gesture: audio, fullscreen, landscape lock
let gestured = false;
function gesture() {
  audioInit();
  if (!gestured) {
    gestured = true;
    loadMusic('title', 'assets/audio/title.mp3');
    loadMusic('run', 'assets/audio/run.mp3');
    if (state === 'title') playMusic('title', 0.55);
    if (isTouch && !DEBUG_AUTO) {
      const el = document.documentElement;
      const fs = el.requestFullscreen || el.webkitRequestFullscreen;
      if (fs) { try { const p = fs.call(el, { navigationUI: 'hide' }); if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } catch (e) {} }
    }
  }
}
addEventListener('pointerdown', gesture, { capture: true });
addEventListener('keydown', gesture, { capture: true });

// ---------------------------------------------------------------- buttons
const on = (id, fn) => document.getElementById(id).addEventListener('click', (e) => { e.stopPropagation(); sfx.tap(); fn(); });
on('btn-start', () => startGame());
on('btn-how', () => { ui.screen('screen-how'); });
on('btn-how-close', () => { ui.screen('screen-title'); });
const toggleSound = () => { setSound(!soundOn()); ui.setSoundLabel(soundOn()); localStorage.setItem('saidi.sound', soundOn() ? '1' : '0'); };
on('btn-sound', toggleSound); on('btn-sound2', toggleSound);
const toggleSubs = () => ui.setSubs(!ui.subs);
on('btn-subs', toggleSubs); on('btn-subs2', toggleSubs);
on('btn-pause', () => pause());
on('btn-resume', () => resume());
on('btn-restart-cp', () => { ui.screen(null); world.restartFromCheckpoint(); resume(); });
on('btn-menu', () => toTitle());
on('btn-menu2', () => toTitle());
on('btn-retry', () => { ui.screen(null); world.restartFromCheckpoint(failKind); state = 'play'; ui.show('hud', true); ui.show('controls', true); clearInput(); });
on('btn-again', () => startGame(true));
on('btn-skip', () => ui.dialogSkip && ui.dialogSkip());
document.getElementById('dialog').addEventListener('click', () => ui.dialogNext && ui.dialogNext());
if (localStorage.getItem('saidi.sound') === '0') setSound(false);
ui.setSoundLabel(soundOn()); ui.setSubs(ui.subs);

initInput(() => { if (state === 'play') pause(); else if (state === 'paused') resume(); }, () => { if (state === 'intro' || state === 'finale') ui.dialogNext && ui.dialogNext(); });

// ---------------------------------------------------------------- flow
function startGame(skipIntro) {
  gesture();
  world.resetRun();
  ui.clearWorld();
  ui.screen(null);
  if (START_SEG !== null) {
    const c = world.checkpoints[Math.max(0, Math.min(3, START_SEG))];
    world.cp = { x: c.x + 0.6, y: c.y, mangoes: 12, time: 270 - [0, 50, 95, 150][START_SEG] , seg: c.seg };
    world.timeLeft = world.cp.time;
    for (const tr of world.triggers) if (tr.x < c.x) tr.fired = true;
    for (const k of world.checkpoints) if (k.x <= c.x) { k.lit = true; }
    world.restartFromCheckpoint();
    beginPlay();
    return;
  }
  if (skipIntro) { beginPlay(); return; }
  state = 'intro';
  ui.show('hud', false); ui.show('controls', false);
  playMusic('title', 0.45);
  ui.dialog(INTRO, 'cut_intro', beginPlay);
  if (DEBUG_AUTO) autoAdvance();
}
function autoAdvance() {
  const iv = setInterval(() => { if (state !== 'intro' && state !== 'finale') { clearInterval(iv); return; } ui.dialogNext && ui.dialogNext(); }, 700);
}
function beginPlay() {
  state = 'play';
  ui.show('hud', true); ui.show('controls', true);
  world.syncHud();
  playMusic('run', 0.5);
  clearInput();
  if (DEBUG_AUTO) input.bot = { trace: [] };
  world.hint(isTouch ? HINTS.start : HINTS.startKeys, 'right');
  game.stats.startAt = performance.now();
  glog('play', { seg: world.segment });
}
function pause() {
  if (state !== 'play') return;
  state = 'paused'; ui.screen('screen-pause'); clearInput();
}
function resume() { if (state !== 'paused') return; ui.screen(null); state = 'play'; clearInput(); }
let failKind = 'hearts';
function fail(kind) {
  if (state !== 'play') return;
  failKind = kind; state = 'fail'; game.stats.deaths++;
  glog('fail', kind, { x: Math.round(world.hero.x) });
  ui.show('controls', false);
  ui.fail(kind);
  if (DEBUG_AUTO) setTimeout(() => document.getElementById('btn-retry').click(), 800);
}
function onFinish() {
  if (state !== 'play') return;
  state = 'finale';
  const res = { mangoes: world.mangoes, time: world.elapsed, stars: 1 + (world.mangoes >= 9 ? 1 : 0) + (world.mangoes >= 12 ? 1 : 0) };
  game.result = res;
  glog('finish', res, { deaths: game.stats.deaths, wallSec: Math.round((performance.now() - game.stats.startAt) / 1000) });
  ui.show('hud', false); ui.show('controls', false); ui.clearWorld();
  sfx.win(); playMusic('title', 0.55);
  ui.dialog(FINALE(world.mangoes), 'cut_finale', () => { state = 'end'; ui.end(res); glog('end-screen'); });
  if (DEBUG_AUTO) autoAdvance();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------------------------------------------------------------- touch-button coverage check
// Counts frames where an on-screen thumb button overlaps the hero or an obstacle (the tests read it).
let ctlRects = null;
addEventListener('resize', () => { ctlRects = null; });
function coverageCheck() {
  const ctl = document.getElementById('controls');
  if (ctl.classList.contains('hidden') || getComputedStyle(ctl).display === 'none') return;
  if (!ctlRects) ctlRects = [...ctl.querySelectorAll('.cbtn.duck, .cbtn.act, .cbtn.jump, .pad-move')].map((e) => e.getBoundingClientRect()).filter((r) => r.width);
  const V = world.view, cx = camera.position.x, cy = camera.position.y, W = innerWidth, H = innerHeight;
  const toR = (x0, x1, y0, y1) => ({ left: (x0 - (cx - V.w / 2)) / V.w * W, right: (x1 - (cx - V.w / 2)) / V.w * W, top: (cy + V.h / 2 - y1) / V.h * H, bottom: (cy + V.h / 2 - y0) / V.h * H });
  const onScreen = (a) => a.right > 0 && a.left < W && a.bottom > 0 && a.top < H;
  const hit = (a) => ctlRects.some((r) => a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top);
  const st = game.stats, h = world.hero;
  st.coverChecks++;
  if (hit(toR(h.x - 0.45, h.x + 0.45, h.y, h.y + 2.0))) st.heroCovered++;
  const obs = [];
  for (const t of world.toks) if (t.active) obs.push(['toktok', t.x - 1.3, t.x + 1.3, 0, 1.95]);
  for (const b of world.balls) obs.push(['ball', b.x - 0.21, b.x + 0.21, b.y - 0.21, b.y + 0.21]);
  if (world.goat.state === 'block') obs.push(['goat', 215.4, 216.6, 0, 1.05]);
  for (const L of world.laundry) obs.push(['laundry', L.x0, L.x1, L.y0, L.y1]);
  for (const p of world.puddles) obs.push(['puddle', p.x0, p.x1, 0, 0.1]);
  for (const s of world.solids) if (s.y1 - Math.max(s.y0, -0.5) < 3.2 && s.y1 - s.y0 < 3.2) obs.push(['prop', s.x0, s.x1, s.y0, s.y1]);
  for (const p of world.pickups) if (!p.collected) obs.push(['mango', p.x - 0.2, p.x + 0.2, p.y - 0.2, p.y + 0.2]);
  for (const [n, x0, x1, y0, y1] of obs) {
    const r = toR(x0, x1, y0, y1);
    if (!onScreen(r) || !hit(r)) continue;
    // all on-screen overlaps are counted; "relevant" = still ahead of the hero and at his level (can hit him)
    st.obstacleCovered++; st.coveredWhat[n] = (st.coveredWhat[n] || 0) + 1;
    if (x1 > h.x - 0.5 && y1 > h.y - 1.5) { st.relevantCovered = (st.relevantCovered || 0) + 1; (st.relevantWhat = st.relevantWhat || []).push([n, Math.round(x0), Math.round(h.x)]); }
  }
}
let frameNo = 0;

// ---------------------------------------------------------------- main loop: fixed 60 Hz step + interpolation
const STEP = 1 / 60;
let acc = 0, last = performance.now(), fpsAcc = 0, fpsN = 0, slowStreak = 0, fastStreak = 0, cpuAcc = 0, cpuN = 0;
const fpsEl = document.getElementById('fps');
if (SHOW_FPS) fpsEl.classList.remove('hidden');
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.25) dt = 0.25;
  if (!world) return;
  const c0 = performance.now();
  if (state === 'play') {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 8) { pollInput(); world.step(STEP); acc -= STEP; n++; }
    if (n === 8) acc = 0;
    if (state === 'play' && game.lastSeg !== world.segment) { game.lastSeg = world.segment; game.stats.segTimes[world.segment] = +world.elapsed.toFixed(1); glog('segment', world.segment, { t: +world.elapsed.toFixed(1), mangoes: world.mangoes, hearts: world.hearts }); }
  } else acc = 0;
  if (state === 'play' || state === 'paused' || state === 'fail' || state === 'finale' || state === 'intro') {
    world.render(state === 'play' ? acc / STEP : 1, state === 'play' ? dt : 0);
    renderer.render(scene, camera);
    if (state === 'play') { cpuAcc += performance.now() - c0; cpuN++; if (isTouch && (frameNo++ % 4 === 0)) coverageCheck(); }
  } else if (state === 'title' || state === 'end') {
    // idle background: keep the GPU cool
  }
  // fps + dynamic resolution
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 1) {
    const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    if (state === 'play') {
      game.stats.fpsSamples.push(Math.round(fps));
      if (cpuN) { (game.stats.cpuMs = game.stats.cpuMs || []).push(+(cpuAcc / cpuN).toFixed(2)); cpuAcc = 0; cpuN = 0; }
      game.stats.drawCalls = renderer.info.render.calls; game.stats.triangles = renderer.info.render.triangles;
      if (fps < 50) { slowStreak++; fastStreak = 0; } else if (fps > 58) { fastStreak++; slowStreak = 0; }
      if (slowStreak >= 2 && dprScale > 0.6) { dprScale = Math.max(0.6, dprScale - 0.15); slowStreak = 0; resize(); }
      if (fastStreak >= 6 && dprScale < 1) { dprScale = Math.min(1, dprScale + 0.1); fastStreak = 0; resize(); }
    }
    if (SHOW_FPS) fpsEl.textContent = `${Math.round(fps)} fps · dpr ${renderer.getPixelRatio().toFixed(2)} · x ${world.hero.x.toFixed(0)}`;
  }
}
requestAnimationFrame(frame);
