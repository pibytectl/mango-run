// 3D-mode input. Touch: a floating joystick under the left thumb, camera drag anywhere else, and four
// buttons in an arc under the right thumb (attack, jump, slide/dodge, block). Desktop: WASD, mouse look
// (pointer lock), Space, J / left click, K / right click, Shift sprint, Ctrl or C slide, Q lock-on, R recentre.
// Touch: double-tap the look area to recentre the camera behind the hero, facing down the route.
// Round 3 (Mzee on a laptop: "mouse controls are not working"): touch, keyboard and mouse are all registered on
// every device, and the control UI follows the input actually used (a touch shows the thumb controls, the
// mouse or a key hides them). Mouse input is taken on the window in the capture phase, so the full-screen touch
// layer (#c3d) sitting over the canvas no longer swallows it; the first click asks for pointer lock, and where
// that is refused or missing, dragging with a button held turns the camera.
export const I3 = {
  mx: 0, my: 0, look: { x: 0, y: 0 }, lastLook: 0, recenter: false,
  jumpHeld: false, blockHeld: false, sprint: false, boostHeld: false,
  pressed: { jump: false, attack: false, slide: false, lock: false, boost: false },
  touch: false, bot: null, enabled: false,
};
const keys = new Set();
const btnTouch = new Map(); // touch id -> button name
let stickId = null, stickO = null, lookId = null, lookP = null, lookStart = null, lastTap = null;
// touch look: radians per pixel (was 0.0085 / 0.0065: an 80 px flick turned the view ~40 degrees)
const LOOK_X = 0.005, LOOK_Y = 0.0038;
let els = null, root = null, inited = false, cvs = null;
// 'touch' | 'kbm': which controls are on screen; switched by the last input actually used
export function setInputMode(m) {
  const touch = m === 'touch';
  if (I3.touch === touch && I3.modeSet) return;
  I3.touch = touch; I3.modeSet = true;
  document.body.classList.toggle('desktop', !touch);
  if (!touch) { stickId = lookId = null; btnTouch.clear(); hideStick(); if (els) refreshBtns(); }
  updateLockHint();
}
// "click to control the camera" until the pointer is locked (mouse/keyboard mode, during play); where the lock
// is refused or unsupported it says to drag instead, for a few seconds
let hintEl = null, lockFailedAt = 0;
export function updateLockHint() {
  if (!hintEl) {
    const ui = document.getElementById('ui'); if (!ui) return;
    hintEl = document.createElement('div'); hintEl.id = 'lockhint'; hintEl.className = 'hidden'; ui.appendChild(hintEl);
  }
  const locked = !!cvs && document.pointerLockElement === cvs;
  const failed = lockFailedAt > 0, recent = failed && performance.now() - lockFailedAt < 6000;
  const show = I3.enabled && !I3.touch && !I3.bot && !locked && (!failed || recent);
  hintEl.className = show ? '' : 'hidden';
  if (show) hintEl.innerHTML = failed
    ? '<span class="ar">اسحب بالماوس وانت دايس عشان تلف الكاميرا</span><em class="en">Hold a mouse button and drag to look around</em>'
    : '<span class="ar">دوس بالماوس على الصورة عشان تتحكم في الكاميرا</span><em class="en">Click to control the camera</em>';
  if (show && failed) setTimeout(updateLockHint, 6100);
}

export function initInput3D(isTouch, canvas) {
  cvs = canvas;
  I3.modeSet = false; setInputMode(isTouch ? 'touch' : 'kbm');
  if (inited) return;
  inited = true;
  root = document.getElementById('c3d');
  els = {
    stick: document.getElementById('stick3d'), knob: document.getElementById('stick3d-knob'),
    btns: [...root.querySelectorAll('[data-b]')],
  };
  const press = (b) => {
    if (b === 'jump') { I3.pressed.jump = true; I3.jumpHeld = true; }
    if (b === 'attack') { I3.pressed.attack = true; I3.pressed.boost = true; I3.boostHeld = true; }
    if (b === 'slide') I3.pressed.slide = true;
    if (b === 'block') I3.blockHeld = true;
  };
  const release = (b) => {
    if (b === 'jump') I3.jumpHeld = false;
    if (b === 'block') I3.blockHeld = false;
    if (b === 'attack') I3.boostHeld = false;
  };
  const btnAt = (x, y) => { const el = document.elementFromPoint(x, y); const b = el && el.closest && el.closest('[data-b]'); return b && !b.classList.contains('off') ? b.dataset.b : null; };
  const onTouch = (e) => {
    if (e.type === 'touchstart') setInputMode('touch');
    if (!I3.enabled) return;
    const W = innerWidth;
    for (const t of e.changedTouches) {
      const id = t.identifier;
      if (e.type === 'touchstart') {
        const b = btnAt(t.clientX, t.clientY);
        if (b) { btnTouch.set(id, b); press(b); vib(); continue; }
        if (t.clientX < W * 0.45 && stickId === null) { stickId = id; stickO = { x: t.clientX, y: t.clientY }; showStick(t.clientX, t.clientY); continue; }
        if (lookId === null) {
          lookId = id; lookP = { x: t.clientX, y: t.clientY }; lookStart = { x: t.clientX, y: t.clientY, t: performance.now() };
        }
      } else if (e.type === 'touchmove') {
        if (id === stickId) {
          let dx = t.clientX - stickO.x, dy = t.clientY - stickO.y; const R = 56, l = Math.hypot(dx, dy);
          if (l > R) { // drag the base along so the thumb never runs off the stick
            stickO.x += dx * (1 - R / l) * 0.6; stickO.y += dy * (1 - R / l) * 0.6;
            dx = t.clientX - stickO.x; dy = t.clientY - stickO.y;
          }
          const m = Math.min(1, Math.hypot(dx, dy) / R), a = Math.atan2(dy, dx);
          I3.mx = Math.cos(a) * m; I3.my = -Math.sin(a) * m;
          showStick(stickO.x, stickO.y, Math.cos(a) * m * R, Math.sin(a) * m * R);
        } else if (id === lookId) {
          I3.look.x += (t.clientX - lookP.x) * LOOK_X; I3.look.y += (t.clientY - lookP.y) * LOOK_Y;
          lookP = { x: t.clientX, y: t.clientY }; I3.lastLook = performance.now();
        } else if (btnTouch.has(id)) {
          const b = btnAt(t.clientX, t.clientY), prev = btnTouch.get(id);
          if (b && b !== prev) { release(prev); btnTouch.set(id, b); press(b); vib(); }
        }
      } else {
        if (id === stickId) { stickId = null; I3.mx = 0; I3.my = 0; hideStick(); }
        if (id === lookId) {
          lookId = null;
          // a tap is short and still; two taps close together = recentre
          const now = performance.now(), still = lookStart && Math.hypot(t.clientX - lookStart.x, t.clientY - lookStart.y) < 14 && now - lookStart.t < 260;
          if (still) {
            if (lastTap && now - lastTap.t < 380 && Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y) < 70) { I3.recenter = true; lastTap = null; }
            else lastTap = { x: t.clientX, y: t.clientY, t: now };
          } else lastTap = null;
        }
        if (btnTouch.has(id)) { release(btnTouch.get(id)); btnTouch.delete(id); }
      }
    }
    refreshBtns();
    e.preventDefault();
  };
  for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) root.addEventListener(ev, onTouch, { passive: false });

  // keyboard
  const KM = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
    Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint', KeyJ: 'attack', KeyK: 'block', ControlLeft: 'slide', KeyC: 'slide', KeyL: 'slide', KeyQ: 'lock', Tab: 'lock', KeyE: 'attack', KeyR: 'recenter' };
  addEventListener('keydown', (e) => {
    if (!I3.enabled) return;
    const k = KM[e.code]; if (!k) return;
    e.preventDefault(); setInputMode('kbm'); if (e.repeat) return;
    keys.add(k);
    if (k === 'jump') { I3.pressed.jump = true; I3.pressed.boost = true; }
    if (k === 'attack') I3.pressed.attack = true;
    if (k === 'slide') I3.pressed.slide = true;
    if (k === 'lock') I3.pressed.lock = true;
    if (k === 'sprint') I3.pressed.boost = true;
    if (k === 'recenter') I3.recenter = true;
  });
  addEventListener('keyup', (e) => { const k = KM[e.code]; if (k) keys.delete(k); });
  addEventListener('blur', () => { keys.clear(); btnTouch.clear(); stickId = lookId = null; I3.mx = I3.my = 0; I3.jumpHeld = I3.blockHeld = I3.boostHeld = false; hideStick(); });
  // mouse: on the window, capture phase (the touch layer and the HUD sit on top of the canvas). Buttons, links
  // and menu screens keep their own clicks.
  const uiTarget = (t) => t && t.closest && t.closest('button, a, input, select, label, .screen');
  let drag = null, lockFailed = false;
  const locked = () => !!cvs && document.pointerLockElement === cvs;
  const askLock = () => {
    if (lockFailed || locked() || !cvs || !cvs.requestPointerLock) return;
    const fail = () => { lockFailed = true; lockFailedAt = lockFailedAt || performance.now(); updateLockHint(); };
    try { const p = cvs.requestPointerLock(); if (p && p.catch) p.catch(fail); } catch (err) { fail(); }
  };
  document.addEventListener('pointerlockerror', () => { lockFailed = true; lockFailedAt = performance.now(); updateLockHint(); });
  document.addEventListener('pointerlockchange', updateLockHint);
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') { setInputMode('touch'); return; }   // touches are handled by the touch layer
    if (!I3.enabled || uiTarget(e.target)) return;
    setInputMode('kbm');
    if (e.button === 0) { if (locked()) I3.pressed.attack = true; else askLock(); }
    if (e.button === 2) I3.blockHeld = true;
    if (e.button === 1) { I3.pressed.lock = true; e.preventDefault(); }
    drag = { x: e.clientX, y: e.clientY, moved: 0, button: e.button, wasLocked: locked() };
  }, { capture: true });
  addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') return;
    if (e.button === 2) I3.blockHeld = false;
    // without pointer lock a left click (not a drag) is the staff; with it, the press already was
    if (drag && e.button === 0 && !drag.wasLocked && drag.moved < 8 && I3.enabled) I3.pressed.attack = true;
    drag = null;
  }, { capture: true });
  addEventListener('contextmenu', (e) => { if (I3.enabled || document.body.classList.contains('mode3d')) e.preventDefault(); }, { capture: true });
  addEventListener('mousemove', (e) => {
    if (!I3.enabled) return;
    if (locked()) { I3.look.x += e.movementX * 0.0032; I3.look.y += e.movementY * 0.0026; I3.lastLook = performance.now(); return; }
    // drag-to-look: any held button, when the pointer is not locked (refused, unsupported, or Esc pressed)
    if (drag && e.buttons) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
      I3.look.x += dx * 0.006; I3.look.y += dy * 0.005; I3.lastLook = performance.now();
    }
  }, { capture: true });
  addEventListener('blur', () => { drag = null; });
}
function vib() { if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {} }
function showStick(x, y, kx = 0, ky = 0) {
  els.stick.classList.remove('hidden');
  els.stick.style.left = x + 'px'; els.stick.style.top = y + 'px';
  els.knob.style.transform = `translate(${kx}px, ${ky}px)`;
}
function hideStick() { if (els) els.stick.classList.add('hidden'); }
function refreshBtns() { const on = new Set(btnTouch.values()); for (const b of els.btns) b.classList.toggle('on', on.has(b.dataset.b)); }

// Snapshot for one fixed step; pressed flags are consumed.
export function readInput3D(out) {
  if (I3.bot) {
    const b = I3.bot;
    out.world = b.world || null; out.mx = b.mx || 0; out.my = b.my || 0;
    out.jumpPressed = !!b.jumpPressed; out.jumpHeld = !!b.jumpHeld; out.attackPressed = !!b.attackPressed;
    out.slidePressed = !!b.slidePressed; out.blockHeld = !!b.blockHeld; out.sprint = !!b.sprint; out.autoSprint = false;
    out.lockPressed = false; out.steer = b.steer || 0; out.throttle = b.throttle ?? 1; out.boost = !!b.boost;
    b.jumpPressed = b.attackPressed = b.slidePressed = false;
    return out;
  }
  let mx = I3.mx, my = I3.my;
  if (keys.has('f')) my += 1; if (keys.has('b')) my -= 1; if (keys.has('l')) mx -= 1; if (keys.has('r')) mx += 1;
  const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  out.world = null; out.mx = mx; out.my = my;
  out.jumpPressed = I3.pressed.jump; out.jumpHeld = I3.jumpHeld || keys.has('jump');
  out.attackPressed = I3.pressed.attack; out.slidePressed = I3.pressed.slide;
  out.blockHeld = I3.blockHeld || keys.has('block');
  out.sprint = keys.has('sprint'); out.autoSprint = I3.touch;
  out.lockPressed = I3.pressed.lock;
  out.steer = mx; out.throttle = keys.has('b') || my < -0.5 ? -1 : 1;
  out.boost = I3.pressed.boost || I3.boostHeld || keys.has('sprint') || keys.has('jump');
  I3.pressed.jump = I3.pressed.attack = I3.pressed.slide = I3.pressed.lock = I3.pressed.boost = false;
  return out;
}
export function takeLook() { const l = { x: I3.look.x, y: I3.look.y, recenter: I3.recenter }; I3.look.x = 0; I3.look.y = 0; I3.recenter = false; return l; }
export function clearInput3D() {
  keys.clear(); btnTouch.clear(); stickId = lookId = null; lastTap = null; I3.mx = I3.my = 0; I3.look.x = I3.look.y = 0; I3.recenter = false;
  I3.jumpHeld = I3.blockHeld = I3.boostHeld = false;
  for (const k in I3.pressed) I3.pressed[k] = false;
  hideStick(); if (els) refreshBtns();
}
