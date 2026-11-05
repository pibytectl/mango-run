// Keyboard + multitouch. Touch buttons are resolved per touch with elementFromPoint, so a thumb can slide
// from one button to the next without lifting. Edge events (jump/act pressed) are latched until consumed.
export const input = {
  left: false, right: false, down: false, jump: false, act: false,
  jumpPressed: false, actPressed: false, anyPressed: false,
  bot: null, // when set (autoplay), its state replaces the human one
};
const keys = new Set();
const touchBtns = new Map(); // touch id -> btn name
const touchStart = new Map(); // touch id -> start y on the move pad (swipe down = duck)
const swipeDown = new Set();
let touchSet = new Set();

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump', KeyK: 'jump',
  KeyX: 'act', KeyJ: 'act', ShiftLeft: 'act',
};

export function initInput(onPause, onAdvance) {
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') { onPause(); e.preventDefault(); return; }
    if (e.code === 'Enter') onAdvance();
    const b = KEYMAP[e.code];
    if (!b) return;
    e.preventDefault();
    if (e.repeat) return;
    keys.add(b);
    if (b === 'jump') { input.jumpPressed = true; onAdvance(); }
    if (b === 'act') input.actPressed = true;
    input.anyPressed = true;
  });
  addEventListener('keyup', (e) => { const b = KEYMAP[e.code]; if (b) keys.delete(b); });
  addEventListener('blur', () => { keys.clear(); touchBtns.clear(); swipeDown.clear(); touchStart.clear(); refreshTouch(); });

  const ctl = document.getElementById('controls');
  const btnEls = [...ctl.querySelectorAll('[data-btn]')];
  const update = (e) => {
    for (const t of e.changedTouches) {
      if (e.type === 'touchend' || e.type === 'touchcancel') { touchBtns.delete(t.identifier); touchStart.delete(t.identifier); swipeDown.delete(t.identifier); continue; }
      if (e.type === 'touchstart') { const el0 = document.elementFromPoint(t.clientX, t.clientY); if (el0 && el0.closest && el0.closest('#pad-move')) touchStart.set(t.identifier, t.clientY); }
      if (touchStart.has(t.identifier)) { if (t.clientY - touchStart.get(t.identifier) > 22) swipeDown.add(t.identifier); else if (t.clientY - touchStart.get(t.identifier) < 10) swipeDown.delete(t.identifier); }
      // a thumb that slid below the pad still steers by its x position
      const pad = document.getElementById('pad-move').getBoundingClientRect();
      const cy = touchStart.has(t.identifier) ? Math.min(t.clientY, pad.bottom - 4) : t.clientY;
      const el = document.elementFromPoint(t.clientX, cy);
      const b = el && el.closest && el.closest('[data-btn]');
      const name = b ? b.dataset.btn : null;
      const prev = touchBtns.get(t.identifier);
      if (name !== prev) {
        if (name) {
          touchBtns.set(t.identifier, name);
          if (name === 'jump') input.jumpPressed = true;
          if (name === 'act') input.actPressed = true;
          input.anyPressed = true;
          if (navigator.vibrate) try { navigator.vibrate(8); } catch (err) {}
        } else touchBtns.delete(t.identifier);
      }
    }
    refreshTouch();
    e.preventDefault();
  };
  for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) ctl.addEventListener(ev, update, { passive: false });
  // mouse fallback for the on-screen pad (desktop testing)
  ctl.addEventListener('mousedown', (e) => {
    const b = e.target.closest('[data-btn]'); if (!b) return;
    touchBtns.set('m', b.dataset.btn);
    if (b.dataset.btn === 'jump') input.jumpPressed = true;
    if (b.dataset.btn === 'act') input.actPressed = true;
    refreshTouch();
  });
  addEventListener('mouseup', () => { if (touchBtns.delete('m')) refreshTouch(); });

  function refreshTouch() {
    touchSet = new Set(touchBtns.values());
    if (swipeDown.size) touchSet.add('down');
    for (const el of btnEls) el.classList.toggle('on', touchSet.has(el.dataset.btn));
  }
}

// Called once per fixed step before the simulation reads the state.
export function pollInput() {
  if (input.bot) {
    const b = input.bot;
    input.left = !!b.left; input.right = !!b.right; input.down = !!b.down; input.jump = !!b.jump;
    if (b.jumpPressed) { input.jumpPressed = true; b.jumpPressed = false; }
    if (b.actPressed) { input.actPressed = true; b.actPressed = false; }
    return;
  }
  input.left = keys.has('left') || touchSet.has('left');
  input.right = keys.has('right') || touchSet.has('right');
  input.down = keys.has('down') || touchSet.has('down');
  input.jump = keys.has('jump') || touchSet.has('jump');
  input.act = keys.has('act') || touchSet.has('act');
}
export function consumeJump() { const p = input.jumpPressed; input.jumpPressed = false; return p; }
export function consumeAct() { const p = input.actPressed; input.actPressed = false; return p; }
export function clearInput() { keys.clear(); touchBtns.clear(); swipeDown.clear(); touchStart.clear(); touchSet = new Set(); input.jumpPressed = input.actPressed = false; }
