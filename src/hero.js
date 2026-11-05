import * as THREE from '../vendor/three.module.min.js';
import { sprite, matFor, tex } from './gfx.js';
import { input, consumeJump, consumeAct } from './input.js';
import { sfx } from './audio.js';

export const G = 32, JUMP_V = 12.4, MAXV = 7.4, DUCKV = 2.6, HALF_W = 0.3, H_STAND = 1.8, H_DUCK = 1.08;
const COYOTE = 0.1, BUFFER = 0.13, VAULT_VY = 13.6, VAULT_VX = 10.8;

export class Hero {
  constructor(world) {
    this.world = world;
    this.reset(0, 0);
    this.buildRig();
  }
  reset(x, y) {
    Object.assign(this, {
      x, y, vx: 0, vy: 0, px: x, py: y, onGround: true, ground: null, facing: 1,
      coyote: 0, jumpBuf: 0, duck: false, invuln: 0, stun: 0, slipT: 0, vaultT: 0, swingT: 0, nudgeT: 0,
      hurtT: 0, celebrate: false, stamina: 100, phase: 0, sx: 1, sy: 1, lastStepPhase: 0,
      airTime: 0, frozen: false, jumpHeld: false, plantX: 0, plantY: 0, swingHit: false, bodyTilt: 0,
    });
  }
  get h() { return this.duck ? H_DUCK : H_STAND; }
  box(h = this.h) { return { x0: this.x - HALF_W, x1: this.x + HALF_W, y0: this.y, y1: this.y + h }; }

  step(dt) {
    const w = this.world;
    this.px = this.x; this.py = this.y;
    if (this.frozen) { this.vx = 0; this.vy = 0; consumeJump(); consumeAct(); return; }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.stun > 0) this.stun -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.swingT > 0) this.swingT -= dt;
    if (this.nudgeT > 0) this.nudgeT -= dt;
    if (this.vaultT > 0) this.vaultT -= dt;
    if (this.onGround) this.stamina = Math.min(100, this.stamina + 34 * dt);
    else this.stamina = Math.min(100, this.stamina + 8 * dt);

    const control = this.stun <= 0 && this.slipT <= 0;
    let dir = 0;
    if (control) dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    // carried by a moving platform
    if (this.onGround && this.ground && this.ground.dx) this.x += this.ground.dx;

    // duck (needs headroom to stand back up)
    const wantDuck = control && input.down && this.onGround;
    if (wantDuck) this.duck = true;
    else if (this.duck) {
      if (!w.overlapsSolid({ x0: this.x - HALF_W + 0.02, x1: this.x + HALF_W - 0.02, y0: this.y + 0.05, y1: this.y + H_STAND })) this.duck = false;
    }

    // jump buffer / coyote
    if (consumeJump()) this.jumpBuf = BUFFER;
    else this.jumpBuf -= dt;
    if (this.onGround) this.coyote = COYOTE; else this.coyote -= dt;
    if (control && this.jumpBuf > 0 && this.coyote > 0) {
      this.vy = JUMP_V; this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.jumpHeld = true;
      this.sy = 1.16; this.sx = 0.88; this.duck = false;
      sfx.jump(); w.fx.dust(this.x, this.y, 5, 0.6);
    }

    // nabboot (context: goat > ball > vault > swing)
    if (consumeAct() && control && this.swingT <= 0 && this.nudgeT <= 0 && this.vaultT <= 0) {
      const ctx = w.actContext(this);
      if (ctx === 'goat') { this.nudgeT = 0.45; this.stamina -= 8; sfx.nudge(); w.onNudge(this); }
      else if (ctx === 'ball' || !this.onGround || Math.abs(this.vx) < 3.0 || this.stamina < 28) {
        if (this.stamina >= 10 || ctx === 'ball') { this.swingT = 0.3; this.swingHit = false; this.stamina = Math.max(0, this.stamina - 10); sfx.swing(); }
        else w.ui.flashStamina();
      } else {
        // pole-vault: plant the staff ahead and launch
        this.vaultT = 0.6; this.stamina -= 28;
        this.vy = VAULT_VY; this.vx = this.facing * VAULT_VX; this.onGround = false; this.coyote = 0; this.duck = false;
        this.plantX = this.x + this.facing * 1.1; this.plantY = this.y;
        this.sy = 0.8; this.sx = 1.15; sfx.vault(); w.fx.dust(this.plantX, this.y, 8, 0.8); w.shake(0.12);
      }
    }

    // horizontal motion
    const maxV = this.duck ? DUCKV : MAXV;
    if (this.slipT > 0) {
      this.slipT -= dt; this.vx *= Math.pow(0.35, dt);
    } else if (dir !== 0) {
      this.facing = this.vaultT > 0 ? this.facing : dir;
      const acc = this.onGround ? 42 : 26;
      if (dir * this.vx < maxV) this.vx += dir * acc * dt * (dir * this.vx < 0 ? 1.8 : 1);
      if (this.onGround && Math.abs(this.vx) > maxV) this.vx -= Math.sign(this.vx) * Math.min(Math.abs(this.vx) - maxV, 60 * dt);
    } else if (this.onGround) {
      const dec = 48 * dt * (this.ground && this.ground.slippery ? 0.15 : 1);
      this.vx = Math.abs(this.vx) <= dec ? 0 : this.vx - Math.sign(this.vx) * dec;
    } else {
      this.vx *= Math.pow(0.7, dt);
    }

    this.x += this.vx * dt;
    this.resolveX(w);

    // vertical
    let g = G;
    if (this.vy > 0 && !input.jump && this.vaultT <= 0) g = G * 2.3; // short hop when released
    if (this.vy < 0) g = G * 1.12;
    this.vy = Math.max(this.vy - g * dt, -24);
    const wasGround = this.onGround, prevVy = this.vy;
    this.y += this.vy * dt;
    this.resolveY(w);
    if (!this.onGround) this.airTime += dt;
    if (this.onGround && !wasGround) {
      const big = prevVy < -16;
      this.sy = big ? 0.72 : 0.84; this.sx = big ? 1.2 : 1.1;
      sfx.land(big); w.fx.dust(this.x, this.y, big ? 12 : 6, big ? 1.2 : 0.7);
      if (big) w.shake(0.25);
      this.airTime = 0; this.vaultT = Math.min(this.vaultT, 0.05);
    }

    // stride phase + footsteps
    if (this.onGround) {
      this.phase += Math.abs(this.vx) * dt * 3.5;
      if (Math.floor(this.phase / Math.PI) !== Math.floor(this.lastStepPhase / Math.PI) && Math.abs(this.vx) > 2) {
        sfx.step(); if (Math.abs(this.vx) > 5.5 && Math.random() < 0.5) w.fx.dust(this.x - this.facing * 0.2, this.y, 2, 0.4);
      }
      this.lastStepPhase = this.phase;
    }
    this.sx += (1 - this.sx) * Math.min(1, dt * 11);
    this.sy += (1 - this.sy) * Math.min(1, dt * 11);
  }

  resolveX(w) {
    const h = this.h;
    for (const s of w.solids) {
      if (this.x + HALF_W <= s.x0 || this.x - HALF_W >= s.x1 || this.y + h <= s.y0 || this.y >= s.y1) continue;
      const rise = s.y1 - this.y;
      if (rise > 0 && rise <= 0.66 && (this.onGround || this.vy <= 0) && !w.overlapsSolid({ x0: this.x - HALF_W, x1: this.x + HALF_W, y0: s.y1 + 0.01, y1: s.y1 + h })) {
        this.y = s.y1; this.vy = 0; continue; // step up small ledges
      }
      if (this.x < (s.x0 + s.x1) / 2) this.x = s.x0 - HALF_W; else this.x = s.x1 + HALF_W;
      if (Math.abs(this.vx) > 6 && this.onGround) w.shake(0.05);
      this.vx = 0;
    }
  }

  resolveY(w) {
    const h = this.h;
    this.onGround = false; this.ground = null;
    for (const s of w.solids) {
      if (this.x + HALF_W <= s.x0 || this.x - HALF_W >= s.x1 || this.y + h <= s.y0 || this.y >= s.y1) continue;
      if (this.vy <= 0 && this.py >= s.y1 - 0.08) { this.y = s.y1; this.vy = 0; this.onGround = true; this.ground = s; }
      else if (this.vy > 0 && this.py + h <= s.y0 + 0.08) { this.y = s.y0 - h; this.vy = 0; sfx.bump(); }
    }
    if (this.vy <= 0) {
      for (const p of w.oneways) {
        if (p.off) continue;
        const top = p.y1, prevTop = top - (p.dy || 0);
        if (this.x + HALF_W * 0.6 <= p.x0 || this.x - HALF_W * 0.6 >= p.x1) continue;
        if (this.py >= prevTop - 0.04 && this.y <= top) {
          if (p.bouncy) { this.y = top; this.vy = p.bouncy; this.sy = 1.2; this.sx = 0.86; p.onBounce && p.onBounce(this); continue; }
          this.y = top; this.vy = 0; this.onGround = true; this.ground = p;
        }
      }
    }
  }

  hurt(srcX, { heart = true, spill = 2, line = null, kb = 5 } = {}) {
    if (this.invuln > 0 || this.frozen) return false;
    const w = this.world;
    this.invuln = 1.4; this.stun = 0.35; this.hurtT = 0.45;
    const d = Math.sign(this.x - srcX) || -this.facing;
    this.vx = d * kb; this.vy = Math.max(this.vy, 5.5); this.onGround = false;
    this.swingT = 0; this.vaultT = 0; this.duck = false;
    if (heart) { w.loseHeart(); sfx.hurt(); w.shake(0.45); w.hitstop(0.07); w.flash(1); }
    else { sfx.cloth(); w.shake(0.2); }
    w.spillMangoes(spill, this.x, this.y + 1.6);
    w.heroSay(line || w.pick('hurt'));
    if (navigator.vibrate) try { navigator.vibrate(heart ? [40, 30, 60] : 25); } catch (e) {}
    return true;
  }
  slip() {
    if (this.slipT > 0 || this.invuln > 0) return;
    this.slipT = 0.85; this.invuln = 1.0; this.vx = this.facing * Math.max(6, Math.abs(this.vx)) * 1.1;
    this.duck = false; sfx.slip(); this.world.shake(0.2);
    this.world.spillMangoes(1, this.x, this.y + 1.4);
    this.world.heroSay(this.world.lines.slip);
  }

  // ---------------- cutout rig ----------------
  buildRig() {
    const root = new THREE.Group();
    const dark = 0x9c8676;
    const mk = (name, h, ax, ay, opts = {}) => {
      const m = sprite(name, h, { ax, ay, ...opts });
      m.userData.part = name; return m;
    };
    this.legs = new THREE.Group(); root.add(this.legs);
    this.backShin = mk('hero_shin', 0.42, 0.27, 0.963, { color: dark }); this.backShin.position.set(-0.07, 0.44, 0);
    this.frontShin = mk('hero_shin', 0.42, 0.27, 0.963); this.frontShin.position.set(0.09, 0.44, 0);
    this.legs.add(this.backShin, this.frontShin);

    this.body = new THREE.Group(); this.body.position.set(0, 0.9, 0); root.add(this.body);
    const off = (m, x, y) => { m.position.set(x, y - 0.9, 0); this.body.add(m); return m; };
    this.backArm = off(mk('hero_arm', 0.66, 0.514, 0.925, { color: dark }), -0.044 - 0.06, 1.405);
    // torso: subdivided so the robe hem can sway
    const tg = new THREE.PlaneGeometry(1, 1, 1, 8); tg.translate(0, 0.5, 0);
    this.torsoBase = Float32Array.from(tg.attributes.position.array);
    this.torso = new THREE.Mesh(tg, matFor(tex.hero_torso));
    this.torso.scale.set(0.8, 1.36, 1);
    off(this.torso, 0, 0.2);
    this.crate = off(mk('hero_crate', 0.5, 0.5, 0.5), -0.25, 1.78);
    this.head = off(mk('hero_head', 0.56, 0.446, 0.123), 0.0875, 1.514);
    this.frontArm = off(mk('hero_arm', 0.66, 0.514, 0.925), -0.044 + 0.03, 1.405);
    this.staff = mk('hero_staff', 0.171, 0.436, 0.5, { width: 1.95 });
    root.add(this.staff);
    // draw order inside the rig
    const order = [this.backShin, this.frontShin, this.torso, this.crate, this.backArm, this.head, this.staff, this.frontArm];
    order.forEach((m, i) => { m.renderOrder = 60 + i; });
    this.rigParts = order;
    this.root = root;
    this.fistLocal = new THREE.Vector3((0.714 - 0.514) * 0.231, -(0.925 - 0.075) * 0.66, 0);
    this._v = new THREE.Vector3();
  }

  setRigOrder(base) { this.rigParts.forEach((m, i) => { m.renderOrder = base + i; }); }

  updateRig(alpha, t) {
    const x = this.px + (this.x - this.px) * alpha, y = this.py + (this.y - this.py) * alpha;
    const r = this.root;
    r.position.set(x, y, 0);
    const spd = Math.min(1, Math.abs(this.vx) / MAXV);
    const ph = this.phase;
    const ground = this.onGround;
    r.scale.set(this.facing * this.sx, this.sy, 1);
    r.visible = !(this.invuln > 0 && this.hurtT <= 0 && Math.floor(t * 16) % 2 === 0) || this.frozen;

    let lean = 0, bob = 0, tsy = 1, fShin = 0, bShin = 0, fLift = 0, bLift = 0, armF = 0.18, staffA = Math.PI / 2;
    let sway = 0, flare = 0, headR = 0, legY = 0, armB = -2.55;
    if (this.slipT > 0) {
      const k = this.slipT / 0.85;
      lean = 1.0 * Math.sin(Math.min(1, (1 - k) * 3) * Math.PI / 2) * (k > 0.25 ? 1 : k / 0.25);
      fShin = 1.5; bShin = 1.1; fLift = 0.2; bLift = 0.15; armF = 2.2; staffA = 0.4; headR = 0.3; flare = 0.08;
    } else if (this.duck) {
      tsy = 0.66; fShin = 1.0; bShin = -0.7; legY = -0.18; armF = 0.9; staffA = 0.25; lean = -0.15; sway = 0.03;
    } else if (!ground) {
      if (this.vy > 0) { fShin = 0.55; bShin = -0.45; fLift = 0.12; bLift = 0.05; armF = 0.7; staffA = Math.PI / 2 - 0.9; }
      else { fShin = 0.25 + Math.sin(t * 20) * 0.05; bShin = -0.2; armF = 0.45; staffA = Math.PI / 2 - 0.6; }
      lean = -0.1 + Math.max(-0.15, Math.min(0.15, -this.vy * 0.01));
      flare = Math.min(0.1, Math.abs(this.vy) * 0.008); sway = this.vy * 0.004;
    } else {
      const s = Math.sin(ph), c = Math.cos(ph);
      const amp = 0.62 * Math.min(1, spd * 1.5);
      fShin = s * amp; bShin = -s * amp;
      fLift = Math.max(0, c) * 0.09 * spd; bLift = Math.max(0, -c) * 0.09 * spd;
      lean = -0.13 * spd;
      bob = Math.abs(s) * 0.055 * spd + Math.sin(t * 2.2) * 0.008 * (1 - spd);
      armF = 0.2 + 0.45 * Math.sin(ph + Math.PI) * spd;
      staffA = Math.PI / 2 - 0.75 * spd - 0.05;
      sway = -0.05 * s * spd; flare = 0.02 * spd;
      tsy = 1 + Math.sin(t * 2.2) * 0.01 * (1 - spd);
      armB = -2.55 + Math.sin(ph * 2) * 0.05 * spd;
    }
    if (this.hurtT > 0) { lean = 0.28; headR = 0.25; }
    if (this.celebrate) { armF = Math.PI - 0.25; staffA = Math.PI / 2 + 0.25; lean = -0.05; headR = -0.12; }

    // vault: staff from the plant point to the fist, body pitches forward
    let vaultK = -1;
    if (this.vaultT > 0) { vaultK = 1 - this.vaultT / 0.6; lean = -0.45 * Math.sin(vaultK * Math.PI); fShin = -0.2 - 0.6 * vaultK; bShin = -0.6; armF = 2.4; flare = 0.1; }
    if (this.swingT > 0) {
      const k = 1 - this.swingT / 0.3, e = 1 - Math.pow(1 - k, 3);
      armF = -2.5 + e * 4.1; staffA = armF - Math.PI / 2;
    }
    if (this.nudgeT > 0) {
      const k = 1 - this.nudgeT / 0.45;
      armF = 1.35; staffA = 0.02; lean = -0.08;
      this.body.position.x = Math.sin(k * Math.PI) * 0.12;
    } else this.body.position.x = 0;

    this.bodyTilt += (lean - this.bodyTilt) * 0.35;
    this.body.rotation.z = this.bodyTilt;
    this.body.position.y = 0.9 + bob - (this.slipT > 0 ? 0.45 * Math.min(1, (0.85 - this.slipT) * 5) * Math.min(1, this.slipT * 4) : 0);
    this.legs.position.y = legY;
    this.frontShin.rotation.z = fShin; this.frontShin.position.y = 0.44 + fLift;
    this.backShin.rotation.z = bShin; this.backShin.position.y = 0.44 + bLift;

    // torso scale (duck) moves head, arms and crate with the neck
    this.torso.scale.y = 1.36 * tsy;
    const top = 0.2 + 1.36 * tsy;
    this.head.position.y = 0.2 + 1.314 * tsy - 0.9;
    this.head.rotation.z = headR + (ground ? -0.04 * spd : 0);
    const sh = 0.2 + 1.205 * tsy - 0.9;
    this.frontArm.position.y = sh; this.backArm.position.y = sh;
    this.crate.position.y = top + 0.2 - 0.9 + (this.duck ? -0.05 : 0);
    this.frontArm.rotation.z = armF;
    this.backArm.rotation.z = armB;

    // robe hem sway: bottom vertices move, top stays
    const pos = this.torso.geometry.attributes.position, base = this.torsoBase;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1];
      const b = Math.pow(1 - by, 2);
      pos.setX(i, bx + (sway * b + flare * b * Math.sign(bx) * 2) / 0.8);
    }
    pos.needsUpdate = true;

    // staff follows the fist (computed in root space)
    r.updateMatrixWorld(true);
    const fist = this.frontArm.localToWorld(this._v.copy(this.fistLocal));
    r.worldToLocal(fist);
    this.staff.position.set(fist.x, fist.y, 0);
    let planted = false;
    if (vaultK >= 0) {
      const p = r.worldToLocal(new THREE.Vector3(this.plantX, this.plantY, 0));
      const len = Math.hypot(fist.x - p.x, fist.y - p.y);
      if (len < 2.9 && fist.x > p.x - 1.2) {
        planted = true;
        const a = Math.atan2(fist.y - p.y, fist.x - p.x);
        const L = Math.max(1.95, len + 0.2); // the pole flexes a little longer while it carries him
        this.staff.scale.x = L;
        this.staff.rotation.z = a;
        // the bottom end stays on the plant point while the hero swings over it
        this.staff.position.set(p.x + Math.cos(a) * L * 0.436, p.y + Math.sin(a) * L * 0.436, 0);
      }
    }
    if (!planted) {
      this.staff.scale.x = 1.95;
      const a = vaultK >= 0 ? Math.PI / 2 - 0.9 : staffA;
      this.staff.rotation.z = a + (this.swingT > 0 || this.nudgeT > 0 ? this.bodyTilt : 0);
      if (this.nudgeT > 0) this.staff.position.x += Math.sin((1 - this.nudgeT / 0.45) * Math.PI) * 0.35;
    }
  }
}
