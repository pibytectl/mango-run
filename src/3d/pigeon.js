// Mission 2's birds, from the character pack's pigeon (12 bones, clips in place: idle, walk, takeoff, fly,
// glide, land; the game moves the bird through the air).
//   Bird:  one pigeon. Perches, takes off, flies an arc to a perch (flapping up, gliding down), lands; or
//          circles a point with a flock. Sukkara is the white one, shown 1.6x life size so she reads at 10 m.
//   Flock: the rival keeper's grey and brown birds circling over his tower; a whistle pulls them down low.
import * as THREE from '../../vendor/three.module.min.js';
import * as SkeletonUtils from '../../vendor/addons/SkeletonUtils.js';
import { A } from './assets3d.js';
import { Anim } from './anim.js';
import { rimFillModel } from './shade.js';

const _v = new THREE.Vector3();
const ease = (u) => u * u * (3 - 2 * u);

export class Bird {
  constructor(scene, kind = 'pigeon', scale = 1.6) {
    this.model = SkeletonUtils.clone(A.glb[kind].scene);
    this.model.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.frustumCulled = false; } });
    rimFillModel(this.model, { fill: 0.14, rimK: 0.28 }, 'rimb');
    this.root = new THREE.Group(); this.root.add(this.model); this.root.scale.setScalar(scale); scene.add(this.root);
    this.anim = new Anim(this.model, A.clips[kind]);
    this.anim.play('idle', { loop: true }); this.anim.actions.idle.time = Math.random() * 3;
    this.state = 'perch'; this.t = 0; this.yaw = 0; this.speed = 8;
    this.from = new THREE.Vector3(); this.to = new THREE.Vector3(); this.mid = new THREE.Vector3(); this.center = new THREE.Vector3();
  }
  get pos() { return this.root.position; }
  show(on) { this.root.visible = on; }
  perchAt(p, yaw = this.yaw) { this.root.position.copy(p); this.yaw = yaw; this.state = 'perch'; this.t = 0; this.anim.play('idle', { loop: true, fade: 0.2 }); this.onLand = null; }
  // fly an arc to `to`: up over the higher end by `up` metres, at `speed` m/s; onLand when she is down
  flyTo(to, o = {}) {
    this.from.copy(this.root.position); this.to.copy(to);
    const d = this.from.distanceTo(this.to);
    this.mid.lerpVectors(this.from, this.to, 0.5); this.mid.y = Math.max(this.from.y, this.to.y) + (o.up ?? Math.min(4, 1.2 + d * 0.12));
    this.fdur = Math.max(0.9, d / (o.speed || this.speed)) + 0.4;
    this.state = this.state === 'perch' ? 'takeoff' : 'fly'; this.t = 0; this.onLand = o.onLand || null;
    if (this.state === 'takeoff') this.anim.play('takeoff', { fade: 0.08 }); else this.anim.play('fly', { loop: true, fade: 0.1 });
  }
  // circle `center` at radius r (with a little bob) until told otherwise
  circle(center, r = 6, w = 1.1, phase = Math.random() * 6.28) {
    this.center.copy(center); this.cr = r; this.cw = w; this.ca = phase; this.state = 'circle'; this.t = 0;
    this.anim.play('fly', { loop: true, fade: 0.15 });
  }
  update(dt) {
    this.t += dt;
    const p = this.root.position;
    if (this.state === 'takeoff') {
      p.y += dt * 0.6;
      if (this.t > 0.32) { this.state = 'fly'; this.t = 0; this.from.copy(p); this.anim.play('fly', { loop: true, fade: 0.12 }); }
    } else if (this.state === 'fly') {
      const u = Math.min(1, this.t / this.fdur), k = ease(u);
      // quadratic Bezier from -> mid -> to
      const a = 1 - k;
      _v.set(a * a * this.from.x + 2 * a * k * this.mid.x + k * k * this.to.x, a * a * this.from.y + 2 * a * k * this.mid.y + k * k * this.to.y, a * a * this.from.z + 2 * a * k * this.mid.z + k * k * this.to.z);
      const dx = _v.x - p.x, dz = _v.z - p.z;
      if (Math.hypot(dx, dz) > 1e-4) this.yaw = Math.atan2(dx, dz);
      const descending = _v.y < p.y;
      p.copy(_v);
      if (u > 0.82 && this.anim.name !== 'land') this.anim.play('land', { fade: 0.12 });
      else if (u <= 0.82) this.anim.play(descending ? 'glide' : 'fly', { loop: true, fade: 0.2 });
      if (u >= 1) { this.state = 'landing'; this.t = 0; }
    } else if (this.state === 'landing') {
      if (this.t > 0.45) { this.state = 'perch'; this.t = 0; this.anim.play('idle', { loop: true, fade: 0.25 }); const f = this.onLand; this.onLand = null; if (f) f(); }
    } else if (this.state === 'circle') {
      this.ca += this.cw * dt;
      const x = this.center.x + Math.cos(this.ca) * this.cr, z = this.center.z + Math.sin(this.ca) * this.cr, y = this.center.y + Math.sin(this.ca * 2.3) * 0.8;
      this.yaw = Math.atan2(x - p.x, z - p.z);
      p.set(x, y, z);
      const glide = Math.sin(this.ca * 1.7) > 0.35;
      this.anim.play(glide ? 'glide' : 'fly', { loop: true, fade: 0.3 });
    }
    this.root.rotation.set(0, this.yaw, this.state === 'circle' ? -0.35 * Math.sign(this.cw) : 0);
    this.anim.update(dt);
  }
}

// the rival keeper's flock over his tower (grey and brown birds)
export class Flock {
  constructor(scene, center, n = 6) {
    this.center = center.clone(); this.low = false;
    this.birds = [];
    for (let i = 0; i < n; i++) {
      const b = new Bird(scene, i % 2 ? 'pigeon_brown' : 'pigeon_grey', 1.3);
      b.circle(this.spot(i), 6 + (i % 3) * 1.6, (i % 2 ? 1 : -1) * (0.9 + (i % 3) * 0.15), i * 1.05);
      this.birds.push(b);
    }
  }
  spot(i) { return new THREE.Vector3(this.center.x, this.center.y + (this.low ? 1 : 5) + (i % 3) * 0.9, this.center.z); }
  // a whistle pulls the flock down low over the tower for a while
  whistle(on) { this.low = on; this.birds.forEach((b, i) => { b.center.y = this.spot(i).y; }); }
  update(dt) { for (const b of this.birds) b.update(dt); }
}
