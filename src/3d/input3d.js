// 3D-mode input. Touch: a floating joystick under the left thumb, camera drag anywhere else, and four
// buttons in an arc under the right thumb (attack, jump, slide/dodge, block). Desktop: WASD, mouse look
// (pointer lock), Space, J / left click, K / right click, Shift sprint, Ctrl or C slide, Q lock-on.
export const I3 = {
  mx: 0, my: 0, look: { x: 0, y: 0 }, lastLook: 0,
  jumpHeld: false, blockHeld: false, sprint: false, boostHeld: false,
  pressed: { jump: false, attack: false, slide: false, lock: false, boost: false },
  touch: false, bot: null, enabled: false,
};
const keys = new Set();
const btnTouch = new Map(); // touch id -> button name
let stickId = null, stickO = null, lookId = null, lookP = null;
let els = null, root = null;

export function initInput3D(isTouch, canvas) {
  I3.touch = isTouch;
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
    if (!I3.enabled) return;
    const W = innerWidth;
    for (const t of e.changedTouches) {
      const id = t.identifier;
      if (e.type === 'touchstart') {
        const b = btnAt(t.clientX, t.clientY);
        if (b) { btnTouch.set(id, b); press(b); vib(); continue; }
        if (t.clientX < W * 0.45 && stickId === null) { stickId = id; stickO = { x: t.clientX, y: t.clientY }; showStick(t.clientX, t.clientY); continue; }
        if (lookId === null) { lookId = id; lookP = { x: t.clientX, y: t.clientY }; }
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
          I3.look.x += (t.clientX - lookP.x) * 0.0085; I3.look.y += (t.clientY - lookP.y) * 0.0065;
          lookP = { x: t.clientX, y: t.clientY }; I3.lastLook = performance.now();
        } else if (btnTouch.has(id)) {
          const b = btnAt(t.clientX, t.clientY), prev = btnTouch.get(id);
          if (b && b !== prev) { release(prev); btnTouch.set(id, b); press(b); vib(); }
        }
      } else {
        if (id === stickId) { stickId = null; I3.mx = 0; I3.my = 0; hideStick(); }
        if (id === lookId) lookId = null;
        if (btnTouch.has(id)) { release(btnTouch.get(id)); btnTouch.delete(id); }
      }
    }
    refreshBtns();
    e.preventDefault();
  };
  for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) root.addEventListener(ev, onTouch, { passive: false });

  // keyboard
  const KM = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
    Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint', KeyJ: 'attack', KeyK: 'block', ControlLeft: 'slide', KeyC: 'slide', KeyL: 'slide', KeyQ: 'lock', Tab: 'lock', KeyE: 'attack' };
  addEventListener('keydown', (e) => {
    if (!I3.enabled) return;
    const k = KM[e.code]; if (!k) return;
    e.preventDefault(); if (e.repeat) return;
    keys.add(k);
    if (k === 'jump') { I3.pressed.jump = true; I3.pressed.boost = true; }
    if (k === 'attack') I3.pressed.attack = true;
    if (k === 'slide') I3.pressed.slide = true;
    if (k === 'lock') I3.pressed.lock = true;
    if (k === 'sprint') I3.pressed.boost = true;
  });
  addEventListener('keyup', (e) => { const k = KM[e.code]; if (k) keys.delete(k); });
  addEventListener('blur', () => { keys.clear(); btnTouch.clear(); stickId = lookId = null; I3.mx = I3.my = 0; I3.jumpHeld = I3.blockHeld = I3.boostHeld = false; hideStick(); });
  // mouse
  if (!isTouch) {
    let dragging = false, last = null;
    canvas.addEventListener('mousedown', (e) => {
      if (!I3.enabled) return;
      if (e.button === 0) { I3.pressed.attack = true; if (document.pointerLockElement !== canvas && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) {} } }
      if (e.button === 2) I3.blockHeld = true;
      if (e.button === 1) I3.pressed.lock = true;
      dragging = true; last = { x: e.clientX, y: e.clientY };
    });
    addEventListener('mouseup', (e) => { if (e.button === 2) I3.blockHeld = false; dragging = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!I3.enabled) return;
      if (document.pointerLockElement === canvas) { I3.look.x += e.movementX * 0.0032; I3.look.y += e.movementY * 0.0026; I3.lastLook = performance.now(); }
      else if (dragging && last) { I3.look.x += (e.clientX - last.x) * 0.006; I3.look.y += (e.clientY - last.y) * 0.005; last = { x: e.clientX, y: e.clientY }; I3.lastLook = performance.now(); }
    });
  }
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
export function takeLook() { const l = { x: I3.look.x, y: I3.look.y }; I3.look.x = 0; I3.look.y = 0; return l; }
export function clearInput3D() {
  keys.clear(); btnTouch.clear(); stickId = lookId = null; I3.mx = I3.my = 0; I3.look.x = I3.look.y = 0;
  I3.jumpHeld = I3.blockHeld = I3.boostHeld = false;
  for (const k in I3.pressed) I3.pressed[k] = false;
  hideStick(); if (els) refreshBtns();
}
