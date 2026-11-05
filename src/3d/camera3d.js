// Chase camera: spring-damped pivot, orbit with look input, auto-follow behind the hero when he runs,
// fight framing toward the lock target, collision pull-in, FOV kick on sprint and speed, trauma shake.
// Cutscene shots blend from wherever the camera is.
import * as THREE from '../../vendor/three.module.min.js';
import { angDiff } from './hero3d.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);

export class ChaseCam {
  constructor(cam, phys) {
    this.cam = cam; this.phys = phys;
    this.yaw = 0; this.pitch = -0.2; this.dist = 4.6; this.curDist = 4.6;
    this.pivot = new THREE.Vector3(); this.pivotV = new THREE.Vector3();
    this.fov = 62; this.trauma = 0; this.t = 0; this.idleLook = 9;
    this.shot = null; this.mode = 'foot';
    this.assist = 1;
  }
  snapBehind(pos, yaw) { this.yaw = yaw + Math.PI; this.pivot.set(pos.x, pos.y + 1.55, pos.z); this.curDist = this.dist; }
  shake(a) { this.trauma = Math.min(1, this.trauma + a); }
  setShot(s) { this.shot = s ? { ...s, t: 0, from: { p: this.cam.position.clone(), q: this.cam.quaternion.clone(), fov: this.cam.fov } } : null; }

  update(dt, o) {
    this.t += dt;
    const cam = this.cam;
    if (this.shot) return this.updateShot(dt);
    const look = o.look || { x: 0, y: 0 };
    this.yaw -= look.x; this.pitch = THREE.MathUtils.clamp(this.pitch - look.y, -1.1, 0.55);
    if (Math.abs(look.x) + Math.abs(look.y) > 0.0001) this.idleLook = 0; else this.idleLook += dt;
    let target = o.focus, pivotH = 1.55, wantDist = 4.6, wantFov = 62, follow = 0;
    if (o.mode === 'vehicle') {
      pivotH = 1.9; wantDist = 6.2; wantFov = 64 + Math.min(18, o.speed * 0.75);
      // stay behind the vehicle
      this.yaw += angDiff(this.yaw, o.heading + Math.PI) * Math.min(1, (this.idleLook > 0.4 ? 5 : 1.2) * dt);
      this.pitch += (-0.2 - this.pitch) * Math.min(1, 2 * dt);
    } else if (o.mode === 'fight' && o.lock) {
      wantDist = 5.6; pivotH = 1.5;
      const want = Math.atan2(target.x - o.lock.x, target.z - o.lock.z);
      if (this.idleLook > 0.5) this.yaw += angDiff(this.yaw, want) * Math.min(1, 3 * dt);
      this.pitch += (-0.26 - this.pitch) * Math.min(1, 1.5 * dt);
    } else {
      wantFov = 62 + (o.sprint ? 9 : 0) + (o.slide ? 6 : 0);
      if (o.speed > 1.5 && this.idleLook > (o.touch ? 0.45 : 1.2)) {
        follow = (o.touch ? 2.4 : 1.1) * Math.min(1, (o.speed - 1.5) / 4) * this.assist;
        this.yaw += angDiff(this.yaw, o.heading + Math.PI) * Math.min(1, follow * dt);
        this.pitch += (-0.16 - this.pitch) * Math.min(1, 0.8 * dt);
      }
      if (o.high) { wantDist = 5.4; }
    }
    if (o.dist) wantDist = o.dist;
    // pivot spring
    const tx = target.x, ty = target.y + pivotH, tz = target.z;
    const kxz = o.mode === 'vehicle' ? 14 : 18, ky = 7;
    this.pivot.x += (tx - this.pivot.x) * Math.min(1, kxz * dt);
    this.pivot.z += (tz - this.pivot.z) * Math.min(1, kxz * dt);
    this.pivot.y += (ty - this.pivot.y) * Math.min(1, ky * dt);
    if (Math.abs(ty - this.pivot.y) > 3) this.pivot.y = ty - Math.sign(ty - this.pivot.y) * 3;
    // orbit + collision
    const cp = Math.cos(this.pitch), dx = Math.sin(this.yaw) * cp, dy = -Math.sin(this.pitch), dz = Math.cos(this.yaw) * cp;
    const hit = this.phys.raycast(this.pivot.x, this.pivot.y, this.pivot.z, dx, dy, dz, wantDist + 0.3, (b) => !b.noCam && !b.ground);
    const allowed = Math.max(0.9, Math.min(wantDist, hit - 0.3));
    this.curDist = allowed < this.curDist ? allowed : this.curDist + (allowed - this.curDist) * Math.min(1, 3 * dt);
    cam.position.set(this.pivot.x + dx * this.curDist, this.pivot.y + dy * this.curDist, this.pivot.z + dz * this.curDist);
    if (cam.position.y < this.pivot.y - 1.3) cam.position.y = this.pivot.y - 1.3;
    // look slightly ahead of the pivot; over the shoulder
    const ahead = o.mode === 'vehicle' ? 3 : 0.6;
    const lx = this.pivot.x - dx * ahead, ly = this.pivot.y - (o.mode === 'vehicle' ? 0.2 : 0.05), lz = this.pivot.z - dz * ahead;
    const rx = Math.cos(this.yaw) * 0.35, rz = -Math.sin(this.yaw) * 0.35;
    cam.position.x += rx; cam.position.z += rz;
    cam.lookAt(lx + rx, ly, lz + rz);
    this.applyShake(dt);
    this.fov += (wantFov - this.fov) * Math.min(1, 4 * dt);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
  applyShake(dt) {
    if (this.trauma <= 0) return;
    const s = this.trauma * this.trauma, t = this.t * 40;
    this.cam.rotation.z += (Math.sin(t * 1.3) * 0.5 + Math.sin(t * 2.7) * 0.5) * 0.05 * s;
    this.cam.position.x += Math.sin(t * 1.9) * 0.12 * s; this.cam.position.y += Math.sin(t * 2.3 + 1) * 0.12 * s;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }
  // shot: {pos, look, fov, blend, dur, pos2, look2} positions as Vector3 or functions returning one
  updateShot(dt) {
    const s = this.shot, cam = this.cam;
    s.t += dt;
    const k = s.blend ? THREE.MathUtils.smootherstep(Math.min(1, s.t / s.blend), 0, 1) : 1;
    const u = s.dur ? Math.min(1, s.t / s.dur) : 0;
    const ev = (v) => (typeof v === 'function' ? v() : v);
    const p = ev(s.pos).clone(); if (s.pos2) p.lerp(ev(s.pos2), u);
    const l = ev(s.look).clone(); if (s.look2) l.lerp(ev(s.look2), u);
    _m.lookAt(p, l, _up); _q.setFromRotationMatrix(_m); // camera convention: looks down -Z
    cam.position.copy(s.from.p).lerp(p, k);
    cam.quaternion.copy(s.from.q).slerp(_q, k);
    const f = s.from.fov + ((s.fov || 50) - s.from.fov) * k;
    if (Math.abs(cam.fov - f) > 0.01) { cam.fov = f; cam.updateProjectionMatrix(); }
    this.applyShake(dt);
  }
  // hand the camera back to the chase rig without a jump
  release(pos, yaw) {
    this.shot = null;
    this.pivot.set(pos.x, pos.y + 1.55, pos.z);
    // derive orbit from where the cutscene left the camera
    const d = this.cam.position.clone().sub(this.pivot);
    this.yaw = Math.atan2(d.x, d.z); this.curDist = Math.min(6, d.length());
    this.pitch = THREE.MathUtils.clamp(-Math.asin(THREE.MathUtils.clamp(d.y / (d.length() || 1), -1, 1)), -0.6, 0.3);
    if (yaw !== undefined) this.yaw = yaw + Math.PI;
    this.fov = this.cam.fov;
  }
}
