// Radwan: third-person character controller (acceleration, sprint + stamina, coyote time, jump buffer,
// variable jump, contextual vault / mantle / wall jump / slide / landing roll) and the tahtib combat moves
// (3-hit nabboot combo starting with the overhead chop, block, dodge, hit-stop hooks). The crate rides on his
// left shoulder with a two-bone IK arm holding it.
import * as THREE from '../../vendor/three.module.min.js';
import { A } from './assets3d.js';
import { Anim, twoBoneIK } from './anim.js';
import { moveBody, fits } from './physics.js';
import { rimFillModel } from './shade.js';

const G_UP = 22, G_DOWN = 30, JUMP_V = 7.6;
const SPD = { walk: 2.0, run: 6.2, sprint: 8.8, air: 9, accel: 34, decel: 26 };
const ATK_SPEED = 1.3;
export const ATTACKS = [
  { clip: 'strike_overhead', impact: 0.47, dur: 1.0, dmg: 1, range: 2.4, arc: 1.25 },
  { clip: 'strike_side', impact: 0.4, dur: 0.87, dmg: 1, range: 2.3, arc: 1.7 },
  { clip: 'strike_thrust', impact: 0.33, dur: 0.73, dmg: 2, range: 2.7, arc: 0.9, finisher: true },
];
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
export { angDiff };

export class Hero {
  constructor(scene, phys, emit) {
    this.phys = phys; this.emit = emit || (() => {});
    const g = A.glb.hero;
    this.model = g.scene;
    this.model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    rimFillModel(this.model, { fill: 0.12, rimK: 0.26 }, 'heroRim');
    this.root = new THREE.Group(); this.root.add(this.model); scene.add(this.root);
    this.anim = new Anim(this.model, A.clips.hero);
    this.bones = {}; this.model.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    this.staff = this.model.getObjectByName('Staff');
    this.body = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), r: 0.32, h: 1.75, onGround: true, walls: [] };
    this.yaw = Math.PI; this.state = 'move'; this.st = 0;
    this.stamina = 100; this.sprintLock = false; this.sprinting = false;
    this.coyote = 0; this.jumpBuf = 0; this.airT = 0; this.fallV = 0;
    this.combo = -1; this.queued = false; this.hitDone = false; this.iframes = 0; this.blockT = 0;
    this.targets = []; this.lockTarget = null; this.inCombat = false;
    this.carry = false; this.carryW = 0; this.cine = false; this.ride = false;
    this.modelOff = new THREE.Vector3();
    this.anim.play('idle', { loop: true });
    this.anim.update(0); this.model.updateMatrixWorld(true);
    this.setupCrate();
    this.wallT = 0; this.wallN = null;
    this.speedNow = 0;
  }

  setupCrate() {
    // place the crate on the left shoulder in the bind pose, then parent it to the shoulder bone
    const b = this.bones, w = new THREE.Vector3(), hips = new THREE.Vector3(), hl = new THREE.Vector3();
    b.ShoulderL.getWorldPosition(w); b.Hips.getWorldPosition(hips); b.HandL.getWorldPosition(hl);
    const left = Math.sign(hl.x - hips.x) || 1;
    this.leftSign = left;
    const crate = A.glb.mango_crate.scene.clone();
    crate.scale.setScalar(0.82);
    crate.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    crate.position.set(w.x + left * 0.25, w.y + 0.03, w.z - 0.01);
    crate.quaternion.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -left * 0.22));
    this.model.add(crate); crate.updateMatrixWorld(true);
    b.ShoulderL.attach(crate);
    const anchor = new THREE.Object3D();
    anchor.position.set(w.x + left * 0.45, w.y + 0.12, w.z + 0.04);
    this.model.add(anchor); crate.attach(anchor);
    this.crate = crate; this.crateAnchor = anchor;
    this.crate.visible = false;
  }
  setCarry(on) { this.carry = on; this.crate.visible = on; }

  place(x, y, z, yaw) {
    this.body.pos.set(x, y, z); this.body.vel.set(0, 0, 0); this.body.onGround = true;
    if (yaw !== undefined) this.yaw = yaw;
    this.state = 'move'; this.st = 0; this.combo = -1; this.iframes = 0; this.modelOff.set(0, 0, 0);
    this.anim.play('idle', { loop: true, fade: 0.05 });
    this.sync();
  }
  setState(s) { this.state = s; this.st = 0; }

  // ------------------------------------------------------------------ main update
  update(dt, I, camYaw) {
    this.st += dt; this.iframes = Math.max(0, this.iframes - dt);
    if (this.cine || this.ride) { this.anim.update(dt); this.sync(); return; }
    const b = this.body;
    // desired move direction in world space
    let mx = 0, mz = 0, mag = 0;
    if (I.world) { mx = I.world.x; mz = I.world.z; mag = Math.min(1, Math.hypot(mx, mz)); }
    else if (I.mx || I.my) {
      const sy = Math.sin(camYaw), cy = Math.cos(camYaw);
      // stick up (my>0) = away from the camera = -camera back vector
      mx = I.mx * cy - I.my * sy; mz = -I.mx * sy - I.my * cy;
      mag = Math.min(1, Math.hypot(I.mx, I.my));
    }
    if (mag > 0.001) { const l = Math.hypot(mx, mz); mx /= l; mz /= l; }
    this.inputMag = mag; this.inDir = { x: mx, z: mz };
    if (I.jumpPressed) this.jumpBuf = 0.15; else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    if (this.attackBuf > 0) this.attackBuf -= dt;
    if (I.attackPressed) this.attackBuf = 0.25;

    // sprint + stamina
    const wantSprint = (I.sprint || mag > 0.92 && I.autoSprint) && mag > 0.5;
    if (this.stamina < 5) this.sprintLock = true; else if (this.stamina > 30) this.sprintLock = false;
    this.sprinting = wantSprint && !this.sprintLock && b.onGround && this.state === 'move' || (this.sprinting && !b.onGround && this.state === 'air');
    if (this.sprinting && b.onGround) this.stamina = Math.max(0, this.stamina - 11 * dt);
    else this.stamina = Math.min(100, this.stamina + (this.state === 'block' ? 10 : 24) * dt);

    const S = this.state;
    if (S === 'move' || S === 'air') this.locomotion(dt, I, mx, mz, mag);
    else if (S === 'vault') this.doVault(dt);
    else if (S === 'climb') this.doClimb(dt);
    else if (S === 'slide') this.doSlide(dt, I);
    else if (S === 'roll') this.doRoll(dt, mx, mz, mag);
    else if (S === 'land') { this.decel(dt, 18); this.phys && moveBody(this.phys, b, dt); if (this.st > 0.22) this.setState('move'); }
    else if (S === 'walljump') this.doWallJump(dt, mx, mz, mag);
    else if (S === 'attack') this.doAttack(dt, I, mx, mz, mag);
    else if (S === 'block') this.doBlock(dt, I);
    else if (S === 'dodge') this.doDodge(dt);
    else if (S === 'hit') { this.decel(dt, 10); moveBody(this.phys, b, dt); this.gravity(dt); if (this.st > 0.45) this.setState('move'); }
    else if (S === 'down') { this.decel(dt, 6); moveBody(this.phys, b, dt); this.gravity(dt); if (this.st > 1.15) { this.setState('getup'); this.anim.play('get_up', { fade: 0.1 }); this.iframes = 1.4; } }
    else if (S === 'getup') { moveBody(this.phys, b, dt); this.gravity(dt); if (this.st > 1.1) { this.setState('move'); } }
    this.anim.update(dt);
    this.sync();
  }

  gravity(dt) {
    const b = this.body;
    if (!b.onGround) { b.vel.y -= (b.vel.y > 0 ? G_UP : G_DOWN) * dt; if (b.vel.y < -40) b.vel.y = -40; }
  }
  decel(dt, k) { const b = this.body; const f = Math.max(0, 1 - k * dt); b.vel.x *= f; b.vel.z *= f; }

  locomotion(dt, I, mx, mz, mag) {
    const b = this.body;
    const was = b.onGround;
    // target speed
    let top = mag < 0.55 ? SPD.walk + (SPD.run - SPD.walk) * Math.max(0, (mag - 0.25) / 0.3) : SPD.run;
    if (this.sprinting) top = SPD.sprint;
    if (this.carry && !this.sprinting) top *= 0.97;
    const tx = mx * top * (mag > 0.05 ? 1 : 0), tz = mz * top * (mag > 0.05 ? 1 : 0);
    const acc = b.onGround ? (mag > 0.05 ? SPD.accel : SPD.decel) : SPD.air;
    const dx = tx - b.vel.x, dz = tz - b.vel.z, dl = Math.hypot(dx, dz), mxd = acc * dt;
    if (dl > mxd) { b.vel.x += dx / dl * mxd; b.vel.z += dz / dl * mxd; } else { b.vel.x = tx; b.vel.z = tz; }
    // sharp turns on the ground keep momentum better: rotate velocity toward the input
    if (b.onGround && mag > 0.2) {
      const sp = Math.hypot(b.vel.x, b.vel.z);
      if (sp > 1) { const want = Math.atan2(mx, mz), cur = Math.atan2(b.vel.x, b.vel.z), d = angDiff(cur, want); const r = cur + Math.sign(d) * Math.min(Math.abs(d), 9 * dt); b.vel.x = Math.sin(r) * sp; b.vel.z = Math.cos(r) * sp; }
    }
    // jumping
    if (b.onGround) { this.coyote = 0.12; this.airT = 0; } else { this.coyote -= dt; this.airT += dt; }
    if (this.jumpBuf > 0) {
      if (this.tryVault(mx, mz, mag, true)) return;
      if (this.coyote > 0) {
        this.jumpBuf = 0; this.coyote = 0;
        b.vel.y = JUMP_V; b.onGround = false; this.jumpHeld = true;
        this.anim.play('jump', { fade: 0.08, speed: 1.15, at: 0.12 });
        this.setState('air'); this.emit('jump');
      } else if (this.wallT > 0 && this.airT > 0.08) { this.startWallJump(); return; }
    }
    if (this.jumpHeld && !I.jumpHeld && b.vel.y > 2.5) { b.vel.y *= 0.55; this.jumpHeld = false; }
    // contextual: sprinting into a low obstacle vaults on its own
    if (b.onGround && this.sprinting && this.tryVault(mx, mz, mag, false)) return;
    // slide / dodge
    if (I.slidePressed && b.onGround) {
      if (this.inCombat) { this.startDodge(mx, mz, mag); return; }
      // any speed: from a standstill it is a short duck-and-scoot (toward the stick, else where he faces)
      this.startSlide(mx, mz, mag); return;
    }
    // pushing into a low laundry line ducks under it on its own (nobody gets stuck there)
    if (b.onGround && mag > 0.3 && b.walls.some((w) => w.box.kind === 'laundry' && w.box.y0 > b.pos.y + 0.8 && mx * w.nx + mz * w.nz < -0.3)) {
      this.duckT = (this.duckT || 0) + dt;
      if (this.duckT > 0.3) { this.duckT = 0; this.emit('duck'); this.startSlide(mx, mz, mag); return; }
    } else this.duckT = 0;
    if (I.blockHeld && b.onGround && this.inCombat) { this.startBlock(); return; }
    if (this.attackBuf > 0 && (b.onGround || this.airT < 0.3)) { this.attackBuf = 0; this.startAttack(0); return; }

    this.gravity(dt);
    const vyBefore = b.vel.y;
    moveBody(this.phys, b, dt);
    // walls touched in the air (wall jump window) and ledges in reach (mantle)
    if (!b.onGround) {
      const w = b.walls.find((c) => c.box.kind !== 'laundry' && (c.box.building || c.box.wall || c.box.y1 - b.pos.y > 2.2));
      if (w) { this.wallT = 0.22; this.wallN = w; } else this.wallT = Math.max(0, this.wallT - dt);
      if (this.tryMantle(mx, mz, mag)) return;
    } else this.wallT = 0;
    if (b.onGround && mag > 0.3 && this.tryMantle(mx, mz, mag, true)) return;

    // landing
    if (!was && b.onGround) {
      const sp = Math.hypot(b.vel.x, b.vel.z);
      if (vyBefore < -11.5 && sp > 2.5) { this.setState('roll'); this.anim.play('land_roll', { fade: 0.06, speed: 1.25 }); this.emit('roll'); return; }
      if (vyBefore < -13) { this.setState('land'); this.anim.play('land', { fade: 0.05, speed: 1.4 }); this.emit('land', 1); return; }
      this.emit('land', 0);
    }
    if (!b.onGround) {
      if (this.state !== 'air') { this.setState('air'); if (this.anim.name !== 'jump') this.anim.play('jump', { fade: 0.2, at: 0.5 }); }
    } else if (this.state === 'air') this.setState('move');
    // facing
    const sp = Math.hypot(b.vel.x, b.vel.z);
    this.speedNow = sp;
    if (sp > 0.4) {
      const want = Math.atan2(b.vel.x, b.vel.z);
      this.yaw += angDiff(this.yaw, want) * Math.min(1, (b.onGround ? 14 : 5) * dt);
    }
    if (b.onGround) this.locoAnim(sp);
  }
  locoAnim(sp) {
    let n, s;
    if (sp < 0.35) { n = this.inCombat ? 'tahtib_ready' : 'idle'; s = 1; }
    else if (sp < 3.2) { n = 'walk'; s = Math.max(0.7, sp / 1.7); }
    else if (sp < 7.2) { n = 'run'; s = Math.max(0.8, sp / 6.0); }
    else { n = 'sprint'; s = sp / 8.4; }
    this.anim.play(n, { loop: true, speed: Math.min(1.5, s), fade: 0.18 });
    // footsteps
    if (n !== 'idle' && n !== 'tahtib_ready') {
      const ph = (this.anim.t / this.anim.dur) * 2 % 1;
      if (this._ph !== undefined && ph < this._ph) this.emit('step', sp);
      this._ph = ph;
    }
  }

  // ------------------------------------------------------------------ parkour
  fwd(mx, mz, mag) {
    const b = this.body, sp = Math.hypot(b.vel.x, b.vel.z);
    if (mag > 0.2) return [mx, mz];
    if (sp > 0.5) return [b.vel.x / sp, b.vel.z / sp];
    return [Math.sin(this.yaw), Math.cos(this.yaw)];
  }
  tryVault(mx, mz, mag, pressed) {
    const b = this.body, p = b.pos;
    const sp = Math.hypot(b.vel.x, b.vel.z);
    if (!b.onGround && this.coyote <= 0) return false;
    if (sp < (pressed ? 1.5 : 5)) return false;
    const [fx, fz] = this.fwd(mx, mz, mag);
    const look = pressed ? 1.5 : 0.9;
    for (const box of this.phys.query(p.x + fx * look - 1, p.z + fz * look - 1, p.x + fx * look + 1, p.z + fz * look + 1)) {
      if (box.ghost || box.building || box.noVault || box.kind === 'laundry') continue;
      const rise = box.y1 - p.y;
      if (rise < 0.4 || rise > 1.36 || box.y0 > p.y + 0.3) continue;
      // entry: ray from the body along fwd
      let tIn = null, tOut = null;
      for (let t = 0; t < 4.2; t += 0.05) {
        const x = p.x + fx * t, z = p.z + fz * t;
        const inside = x > box.x0 - b.r && x < box.x1 + b.r && z > box.z0 - b.r && z < box.z1 + b.r;
        if (inside && tIn === null) tIn = t;
        if (!inside && tIn !== null) { tOut = t; break; }
      }
      if (tIn === null || tIn > look + 0.2 || tOut === null || tOut - tIn > 2.6) continue;
      const lx = p.x + fx * (tOut + 0.25), lz = p.z + fz * (tOut + 0.25);
      const g = this.phys.groundAt(lx, lz, 0.25, p.y + 0.5);
      const ly = g ? g.y : p.y;
      if (ly < p.y - 4) continue;
      if (!fits(this.phys, lx, ly, lz, b.r * 0.9, 1.6, new Set([box]))) continue;
      this.jumpBuf = 0;
      this.vault = { x0: p.x, z0: p.z, y0: p.y, x1: lx, z1: lz, y1: ly, top: box.y1, box, dur: Math.max(0.5, Math.min(0.75, (tOut + 0.3) / Math.max(sp, 5) + 0.3)), sp: Math.max(sp, 5.5) };
      this.yaw = Math.atan2(fx, fz);
      this.setState('vault');
      this.anim.play('vault', { fade: 0.08, speed: 0.9 / this.vault.dur });
      this.emit('vault');
      return true;
    }
    return false;
  }
  doVault(dt) {
    const v = this.vault, t = Math.min(1, this.st / v.dur), b = this.body;
    const e = t;
    const lift = Math.max(0, v.top - v.y0 - 0.55);
    b.pos.x = v.x0 + (v.x1 - v.x0) * e; b.pos.z = v.z0 + (v.z1 - v.z0) * e;
    b.pos.y = v.y0 + (v.y1 - v.y0) * Math.max(0, (t - 0.6) / 0.4) + lift * Math.sin(Math.PI * Math.min(1, t * 1.15));
    if (t >= 1) {
      const dx = v.x1 - v.x0, dz = v.z1 - v.z0, l = Math.hypot(dx, dz) || 1;
      b.vel.set(dx / l * v.sp * 0.95, 0, dz / l * v.sp * 0.95);
      b.onGround = Math.abs(v.y1 - b.pos.y) < 0.05;
      this.setState(b.onGround ? 'move' : 'air');
    }
  }
  tryMantle(mx, mz, mag, ground) {
    const b = this.body, p = b.pos;
    const [fx, fz] = this.fwd(mx, mz, mag);
    if (mag < 0.3 && !(ground === undefined && Math.hypot(b.vel.x, b.vel.z) > 2)) return false;
    if (!ground && b.vel.y > 4) return false;
    for (const box of this.phys.query(p.x + fx * 0.7 - 0.6, p.z + fz * 0.7 - 0.6, p.x + fx * 0.7 + 0.6, p.z + fz * 0.7 + 0.6)) {
      if (box.ghost || box.kind === 'laundry' || box.noClimb) continue;
      const rise = box.y1 - p.y;
      if (ground ? (rise < 1.3 || rise > 2.05) : (rise < 0.25 || rise > 1.95)) continue;
      if (!ground && box.y0 > p.y + 1.9) continue;
      // the box must be right in front (within reach) along fwd
      const hx = p.x + fx * (b.r + 0.35), hz = p.z + fz * (b.r + 0.35);
      if (!(hx > box.x0 && hx < box.x1 && hz > box.z0 && hz < box.z1)) continue;
      // standing spot on top
      const tx = p.x + fx * (b.r + 0.6), tz = p.z + fz * (b.r + 0.6);
      if (!(tx > box.x0 - 0.05 && tx < box.x1 + 0.05 && tz > box.z0 - 0.05 && tz < box.z1 + 0.05)) {
        // thin ledge: stand at its middle
      }
      const sx = Math.max(box.x0 + 0.2, Math.min(box.x1 - 0.2, tx)), sz = Math.max(box.z0 + 0.2, Math.min(box.z1 - 0.2, tz));
      if (!fits(this.phys, sx, box.y1, sz, b.r * 0.85, 1.7)) continue;
      // facing must point at the ledge
      this.yaw = Math.atan2(fx, fz);
      const short = rise < 1.3;
      this.climb = { x0: p.x, y0: p.y, z0: p.z, x1: sx, y1: box.y1, z1: sz, rise, dur: short ? 0.55 : 1.15, short, box, bx: box.x0, bz: box.z0 };
      this.setState('climb'); b.vel.set(0, 0, 0);
      if (short) this.anim.play('vault', { fade: 0.08, speed: 1.5 });
      else this.anim.play('climb', { fade: 0.08, speed: 1.47 / this.climb.dur, at: Math.max(0, (1.8 - rise) * 0.35) });
      this.emit('climb', rise);
      return true;
    }
    return false;
  }
  doClimb(dt) {
    const c = this.climb, t = Math.min(1, this.st / c.dur), b = this.body;
    if (c.box.dynamic) { // ride along with a moving ledge (the ferry)
      const dx = c.box.x0 - c.bx, dz = c.box.z0 - c.bz; c.bx = c.box.x0; c.bz = c.box.z0;
      c.x0 += dx; c.x1 += dx; c.z0 += dz; c.z1 += dz;
    }
    if (c.short) {
      b.pos.set(c.x0 + (c.x1 - c.x0) * t, c.y0 + (c.y1 - c.y0) * Math.sin(Math.PI / 2 * Math.min(1, t * 1.4)), c.z0 + (c.z1 - c.z0) * t);
      this.modelOff.set(0, 0, 0);
    } else {
      // the clip lifts the hips 1.8 m and 0.6 m forward; keep the root at the start and offset the model
      // for ledges that are not exactly 1.8 m, then hand the motion over to the root at the end
      b.pos.set(c.x0, c.y0, c.z0);
      const k = THREE.MathUtils.smoothstep(t, 0.1, 0.9);
      this.modelOff.set(0, (c.rise - 1.8) * k, 0);
    }
    if (t >= 1) {
      this.modelOff.set(0, 0, 0);
      b.pos.set(c.x1, c.y1, c.z1); b.vel.set(0, 0, 0); b.onGround = true;
      this.setState('move'); this.anim.play('idle', { loop: true, fade: 0.02 });
    }
  }
  startWallJump() {
    const w = this.wallN, b = this.body;
    this.jumpBuf = 0; this.wallT = 0;
    this.wjFrom = Math.atan2(-w.nx, -w.nz);   // facing the wall
    this.yaw = this.wjFrom;
    b.vel.set(w.nx * 4.6, 8.6, w.nz * 4.6);
    b.onGround = false;
    this.setState('walljump');
    this.anim.play('wall_jump', { fade: 0.05, speed: 1.4 });
    this.emit('walljump');
  }
  doWallJump(dt, mx, mz, mag) {
    const b = this.body;
    this.gravity(dt);
    moveBody(this.phys, b, dt);
    const w = b.walls.find((c) => c.box.building || c.box.wall);
    if (w && this.st > 0.12) { this.wallT = 0.25; this.wallN = w; }
    if (this.st > 0.08 && this.tryMantle(mx, mz, Math.max(mag, 0.5))) return;
    if (this.jumpBuf > 0 && this.wallT > 0 && this.st > 0.18) { this.startWallJump(); return; }
    this.wallT = Math.max(0, this.wallT - dt);
    if (this.st > 0.5 || b.onGround) {
      this.yaw = this.wjFrom + Math.PI;
      this.setState(b.onGround ? 'move' : 'air');
      this.anim.play('jump', { fade: 0.12, at: 0.55 });
    }
  }
  startSlide(mx = 0, mz = 0, mag = 0) {
    const b = this.body, sp = Math.hypot(b.vel.x, b.vel.z);
    if (sp > 3) this.slideDir = [b.vel.x / sp, b.vel.z / sp];
    else if (mag > 0.2) this.slideDir = [mx, mz];
    else this.slideDir = [Math.sin(this.yaw), Math.cos(this.yaw)];
    this.slideV = sp > 3 ? Math.min(10.5, sp * 1.18 + 0.8) : 5.6;
    b.h = 0.9;
    this.setState('slide');
    this.anim.play('slide', { fade: 0.06, speed: 1.07 / 0.8 });
    this.yaw = Math.atan2(this.slideDir[0], this.slideDir[1]);
    this.emit('slide');
  }
  doSlide(dt) {
    const b = this.body;
    this.slideV = Math.max(2.5, this.slideV - 7 * dt);
    b.vel.x = this.slideDir[0] * this.slideV; b.vel.z = this.slideDir[1] * this.slideV;
    this.gravity(dt);
    moveBody(this.phys, b, dt);
    if (this.st > 0.8) {
      // stand up only if there is head room
      if (fits(this.phys, b.pos.x, b.pos.y + 0.9, b.pos.z, b.r * 0.9, 0.85)) { b.h = 1.75; this.setState(b.onGround ? 'move' : 'air'); }
      else if (this.anim.t > 0.5) this.anim.cur.time = 0.45;
    }
  }
  doRoll(dt, mx, mz, mag) {
    const b = this.body;
    const sp = Math.max(4, Math.hypot(b.vel.x, b.vel.z));
    const [fx, fz] = mag > 0.3 ? [mx, mz] : [Math.sin(this.yaw), Math.cos(this.yaw)];
    b.vel.x = fx * sp; b.vel.z = fz * sp;
    this.yaw += angDiff(this.yaw, Math.atan2(fx, fz)) * Math.min(1, 6 * dt);
    this.gravity(dt);
    moveBody(this.phys, b, dt);
    if (this.st > 0.7) this.setState('move');
  }

  // ------------------------------------------------------------------ combat
  pickTarget(mx, mz, mag) {
    const p = this.body.pos;
    let best = null, bs = 1e9;
    const [fx, fz] = mag > 0.2 ? [mx, mz] : [Math.sin(this.yaw), Math.cos(this.yaw)];
    for (const t of this.targets) {
      if (!t.hittable || !t.hittable()) continue;
      const dx = t.pos.x - p.x, dz = t.pos.z - p.z, d = Math.hypot(dx, dz);
      if (d > 5.5) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      const score = d - dot * 2.2 + (t === this.lockTarget ? -3 : 0);
      if (score < bs) { bs = score; best = t; }
    }
    return best;
  }
  startAttack(i) {
    const b = this.body;
    this.combo = i; this.queued = false; this.hitDone = false;
    const a = ATTACKS[i];
    const tg = this.pickTarget(this.inDir.x, this.inDir.z, this.inputMag);
    this.atkTarget = tg;
    if (tg) this.atkYaw = Math.atan2(tg.pos.x - b.pos.x, tg.pos.z - b.pos.z);
    else if (this.inputMag > 0.2) this.atkYaw = Math.atan2(this.inDir.x, this.inDir.z);
    else this.atkYaw = this.yaw;
    this.setState('attack');
    this.anim.play(a.clip, { fade: i === 0 ? 0.08 : 0.06, speed: ATK_SPEED });
    this.emit('swing', i);
  }
  doAttack(dt, I, mx, mz, mag) {
    const b = this.body, a = ATTACKS[this.combo];
    const t = this.anim.t; // clip time
    this.yaw += angDiff(this.yaw, this.atkYaw) * Math.min(1, 18 * dt);
    // lunge toward the target before impact
    const tg = this.atkTarget;
    let lunge = 0;
    if (t < a.impact) {
      if (tg) { const d = Math.hypot(tg.pos.x - b.pos.x, tg.pos.z - b.pos.z); lunge = d > 1.55 ? Math.min(7, (d - 1.4) * 5) : 0; }
      else lunge = this.combo === 2 ? 3.5 : 1.6;
    }
    b.vel.x = Math.sin(this.yaw) * lunge; b.vel.z = Math.cos(this.yaw) * lunge;
    this.gravity(dt);
    moveBody(this.phys, b, dt);
    if (!this.hitDone && t >= a.impact) { this.hitDone = true; this.emit('impact', { attack: a, index: this.combo }); }
    if (this.attackBuf > 0 && t > a.impact - 0.25) { this.queued = true; this.attackBuf = 0; }
    if (this.queued && this.combo < 2 && t >= a.impact + 0.1) { this.startAttack(this.combo + 1); return; }
    if (I.slidePressed && t > a.impact) { this.startDodge(mx, mz, mag); return; }
    if (I.blockHeld && t > a.impact && this.inCombat) { this.startBlock(); return; }
    if (t >= a.dur * 0.82 || (t > a.impact + 0.15 && mag > 0.5 && !this.queued)) { this.combo = -1; this.setState('move'); }
  }
  startBlock() { this.setState('block'); this.anim.play('tahtib_block', { fade: 0.06, speed: 1.6 }); this.body.vel.x *= 0.2; this.body.vel.z *= 0.2; }
  doBlock(dt, I) {
    const b = this.body;
    if (this.lockTarget || this.atkTarget) { const tg = this.lockTarget || this.pickTarget(0, 0, 0); if (tg) this.yaw += angDiff(this.yaw, Math.atan2(tg.pos.x - b.pos.x, tg.pos.z - b.pos.z)) * Math.min(1, 10 * dt); }
    this.decel(dt, 14); this.gravity(dt); moveBody(this.phys, b, dt);
    if (!I.blockHeld && this.st > 0.18) this.setState('move');
    if (I.slidePressed) this.startDodge(this.inDir.x, this.inDir.z, this.inputMag);
  }
  startDodge(mx, mz, mag) {
    const b = this.body;
    let dx, dz;
    if (mag > 0.3) { dx = mx; dz = mz; } else { dx = -Math.sin(this.yaw); dz = -Math.cos(this.yaw); }
    this.dodgeDir = [dx, dz]; this.iframes = 0.42;
    this.setState('dodge');
    this.anim.play('tahtib_dodge', { fade: 0.05, speed: 1.3 });
    b.vel.set(dx * 7.5, 0, dz * 7.5);
    this.emit('dodge');
  }
  doDodge(dt) {
    const b = this.body, k = Math.max(0, 1 - this.st / 0.45);
    b.vel.x = this.dodgeDir[0] * 7.5 * k; b.vel.z = this.dodgeDir[1] * 7.5 * k;
    this.gravity(dt); moveBody(this.phys, b, dt);
    if (this.st > 0.48) this.setState('move');
  }
  // returns 'dodged' | 'blocked' | 'hit' | 'down'
  takeHit(dmg, fx, fz, heavy) {
    const b = this.body;
    if (this.state === 'down' || this.state === 'getup' || this.iframes > 0) return 'dodged';
    const dx = fx - b.pos.x, dz = fz - b.pos.z, d = Math.hypot(dx, dz) || 1;
    if (this.state === 'block' && (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / d > 0.1 && !heavy) {
      b.vel.x = -dx / d * 3; b.vel.z = -dz / d * 3;
      this.anim.play('tahtib_block', { restart: true, fade: 0.02, speed: 1.6, at: 0.3 });
      return 'blocked';
    }
    this.combo = -1; b.h = 1.75; this.modelOff.set(0, 0, 0);
    if (heavy) {
      this.setState('down'); this.anim.play('knockdown', { fade: 0.05, speed: 1.2 });
      b.vel.set(-dx / d * 7, 3.5, -dz / d * 7); b.onGround = false; this.iframes = 2.2;
      this.yaw = Math.atan2(dx, dz);
      return 'down';
    }
    this.setState('hit'); this.anim.play('hit_react', { fade: 0.04, restart: true });
    b.vel.x = -dx / d * 4; b.vel.z = -dz / d * 4; this.iframes = 0.85;
    this.yaw = Math.atan2(dx, dz);
    return 'hit';
  }

  // ------------------------------------------------------------------ pose + crate arm
  sync() {
    const b = this.body;
    this.root.position.set(b.pos.x + this.modelOff.x, b.pos.y + this.modelOff.y, b.pos.z + this.modelOff.z);
    this.root.rotation.y = this.yaw;
    this.root.updateMatrixWorld(true);
    // crate arm IK: off while the arm is busy
    const busy = ['attack', 'block', 'dodge', 'climb', 'vault', 'walljump', 'hit', 'down', 'getup'].includes(this.state);
    const want = this.carry && !busy && !this.ride ? 1 : 0;
    this.carryW += (want - this.carryW) * Math.min(1, 0.016 * 14);
    if (this.carryW > 0.01) {
      const bn = this.bones;
      const tgt = new THREE.Vector3(); this.crateAnchor.getWorldPosition(tgt);
      const sh = new THREE.Vector3(); bn.UpperArmL.getWorldPosition(sh);
      // elbow out to the side and slightly down/forward
      const side = new THREE.Vector3(Math.cos(this.yaw) * this.leftSign, 0, -Math.sin(this.yaw) * this.leftSign);
      const pole = sh.clone().addScaledVector(side, 0.5).add(new THREE.Vector3(Math.sin(this.yaw) * 0.25, -0.35, Math.cos(this.yaw) * 0.25));
      twoBoneIK(bn.UpperArmL, bn.LowerArmL, bn.HandL, tgt, pole, this.carryW);
    }
  }
  get pos() { return this.body.pos; }
}
