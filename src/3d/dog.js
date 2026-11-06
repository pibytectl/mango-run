// Mission 2's guard dog: a tan Egyptian street dog (baladi) chained to a kennel on a roof. Built in code,
// one merged vertex-coloured mesh (one draw call), a procedural trot. Fair and readable:
//   asleep until Radwan is inside chain + 3 m; then up, barking, trotting at the end of its chain toward him;
//   within 2.6 m it crouches and growls for 0.45 s (the telegraph), then lunges; a bite is a whole heart.
//   A staff hit sends it yelping back to its kennel for 2.5 s. It can never pass its chain.
import * as THREE from '../../vendor/three.module.min.js';
import { mergeGeometries } from '../../vendor/addons/BufferGeometryUtils.js';

function paint(g, c) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.index ? g.toNonIndexed() : g; }
let geo = null;
function dogGeometry() {
  if (geo) return geo;
  const P = [], tan = [0.66, 0.48, 0.3], tan2 = [0.55, 0.38, 0.22], dark = [0.16, 0.12, 0.1], pale = [0.82, 0.7, 0.55];
  const add = (g, c, x, y, z, rx = 0, ry = 0, rz = 0) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); P.push(paint(g, c)); };
  add(new THREE.CapsuleGeometry(0.17, 0.5, 4, 10), tan, 0, 0.5, 0, Math.PI / 2);          // body (nose to +Z)
  add(new THREE.SphereGeometry(0.15, 10, 8), pale, 0, 0.47, 0.22);                       // chest
  add(new THREE.CylinderGeometry(0.08, 0.11, 0.28, 8), tan, 0, 0.7, 0.38, 0.9);          // neck
  add(new THREE.SphereGeometry(0.12, 10, 8), tan, 0, 0.82, 0.5);                         // head
  add(new THREE.BoxGeometry(0.1, 0.09, 0.18), tan2, 0, 0.78, 0.64);                      // muzzle
  add(new THREE.SphereGeometry(0.03, 6, 5), dark, 0, 0.8, 0.73);                         // nose
  for (const s of [-1, 1]) add(new THREE.ConeGeometry(0.05, 0.16, 5), tan2, s * 0.07, 0.96, 0.47, 0, 0, s * -0.3);   // ears up
  for (const [x, z] of [[-0.09, 0.26], [0.09, 0.26], [-0.09, -0.26], [0.09, -0.26]]) add(new THREE.CylinderGeometry(0.035, 0.03, 0.42, 6), tan2, x, 0.21, z);
  add(new THREE.CylinderGeometry(0.03, 0.015, 0.34, 6), tan, 0, 0.66, -0.4, -0.9);       // tail up
  add(new THREE.TorusGeometry(0.1, 0.018, 5, 12), [0.6, 0.1, 0.08], 0, 0.72, 0.37, 1.3); // red collar
  geo = mergeGeometries(P); geo.computeBoundingSphere();
  return geo;
}

export class Dog {
  constructor(game, kennel, r) {
    this.g = game; this.home = kennel.clone(); this.r = r;
    this.mesh = new THREE.Mesh(dogGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.mesh.castShadow = true; this.root = new THREE.Group(); this.root.add(this.mesh); game.scene.add(this.root);
    // the chain: one line from the kennel to the collar
    this.chainGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.chain = new THREE.Line(this.chainGeo, new THREE.LineBasicMaterial({ color: 0x3a3632 })); this.chain.frustumCulled = false; game.scene.add(this.chain);
    this.reset();
  }
  reset() {
    this.pos = this.home.clone().add(new THREE.Vector3(1.0, 0, 0)); this.yaw = Math.PI / 2; this.state = 'sleep'; this.t = 0; this.cool = 0; this.bark = 0; this.place(0);
  }
  show(on) { this.root.visible = this.chain.visible = on; }
  stun() { if (this.state === 'stun') return false; this.state = 'stun'; this.t = 0; this.g.onDog('yelp'); return true; }
  place(dt) {
    const run = this.state === 'chase' || this.state === 'back' || this.state === 'lunge', ph = (this.ph = (this.ph || 0) + dt * (run ? 14 : 3));
    const crouch = this.state === 'growl' ? -0.08 : 0, lie = this.state === 'sleep' ? -0.22 : 0;
    this.root.position.set(this.pos.x, this.pos.y + crouch + lie + (run ? Math.abs(Math.sin(ph)) * 0.05 : 0), this.pos.z);
    this.root.rotation.set(run ? Math.sin(ph) * 0.05 : 0, this.yaw, this.state === 'stun' ? Math.sin(this.t * 30) * 0.1 : 0);
    const a = this.chainGeo.attributes.position.array, s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    a[0] = this.home.x; a[1] = this.home.y + 0.3; a[2] = this.home.z; a[3] = this.pos.x + s * 0.35; a[4] = this.pos.y + 0.68 + crouch + lie; a[5] = this.pos.z + c * 0.35;
    this.chainGeo.attributes.position.needsUpdate = true;
  }
  // move toward (x, z) at sp, never past the chain
  moveTo(x, z, sp, dt) {
    const dx = x - this.pos.x, dz = z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.05) { this.yaw = Math.atan2(dx, dz); const s = Math.min(sp * dt, d); this.pos.x += dx / d * s; this.pos.z += dz / d * s; }
    const hx = this.pos.x - this.home.x, hz = this.pos.z - this.home.z, hd = Math.hypot(hx, hz);
    if (hd > this.r) { this.pos.x = this.home.x + hx / hd * this.r; this.pos.z = this.home.z + hz / hd * this.r; }
    return d;
  }
  update(dt) {
    const g = this.g, h = g.hero.pos;
    this.t += dt; this.cool -= dt; this.bark -= dt;
    const dh = Math.hypot(h.x - this.home.x, h.z - this.home.z), dd = Math.hypot(h.x - this.pos.x, h.z - this.pos.z), level = Math.abs(h.y - this.pos.y) < 1.2;
    switch (this.state) {
      case 'sleep': if (level && dh < this.r + 3) { this.state = 'chase'; this.t = 0; g.onDog('wake'); } break;
      case 'chase':
        if (!level || dh > this.r + 4.5) { this.state = 'back'; break; }
        this.moveTo(h.x, h.z, 6.8, dt);
        if (this.bark <= 0) { this.bark = 0.7 + Math.random() * 0.5; g.onDog('bark'); }
        if (dd < 2.6 && this.cool <= 0) { this.state = 'growl'; this.t = 0; g.onDog('growl'); }
        break;
      case 'growl': this.yaw = Math.atan2(h.x - this.pos.x, h.z - this.pos.z); if (this.t > 0.45) { this.state = 'lunge'; this.t = 0; this.bit = false; } break;
      case 'lunge': {
        const d = this.moveTo(h.x, h.z, 9.5, dt);
        if (!this.bit && d < 0.9 && level) { this.bit = true; g.onDog('bite'); }
        if (this.t > 0.4) { this.state = 'chase'; this.t = 0; this.cool = 1.1; }
        break;
      }
      case 'stun': this.moveTo(this.home.x + 0.8, this.home.z, 5, dt); if (this.t > 2.5) { this.state = 'chase'; this.t = 0; this.cool = 0.6; } break;
      case 'back': if (this.moveTo(this.home.x + 1.0, this.home.z, 3, dt) < 0.2) { this.state = 'sleep'; this.t = 0; } if (level && dh < this.r + 2) this.state = 'chase'; break;
    }
    this.place(dt);
  }
}
