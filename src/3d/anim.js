// AnimationMixer wrapper with cross-fades, one-shots and a two-bone IK helper for the crate arm.
import * as THREE from '../../vendor/three.module.min.js';

export class Anim {
  constructor(root, clips) {
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = {};
    for (const [n, c] of Object.entries(clips)) this.actions[n] = this.mixer.clipAction(c);
    this.cur = null; this.name = '';
  }
  play(name, o = {}) {
    const a = this.actions[name];
    if (!a) return null;
    const loop = o.loop ?? false, fade = o.fade ?? 0.14, speed = o.speed ?? 1;
    if (this.cur === a && !o.restart) { a.timeScale = speed; return a; }
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = !loop;
    a.timeScale = speed;
    a.setEffectiveWeight(1);
    if (o.at) a.time = o.at;
    a.play();
    if (this.cur && this.cur !== a) a.crossFadeFrom(this.cur, fade, false);
    this.cur = a; this.name = name;
    return a;
  }
  get t() { return this.cur ? this.cur.time : 0; }
  get dur() { return this.cur ? this.cur.getClip().duration : 0; }
  done() { return !this.cur || (this.cur.loop === THREE.LoopOnce && this.cur.time >= this.cur.getClip().duration - 1e-3); }
  update(dt) { this.mixer.update(dt); }
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3();
const _e = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _id = new THREE.Quaternion();
function rotateBoneWorld(bone, from, to, w) {
  _q.setFromUnitVectors(from.normalize(), to.normalize());
  if (w < 1) _q.slerp(_id, 1 - w);
  bone.parent.getWorldQuaternion(_pq);
  const inv = _pq.clone().invert();
  bone.quaternion.premultiply(_pq).premultiply(_q).premultiply(inv);
}
// Points upper->lower->hand at `target` (world), elbow bent toward `pole` (world).
export function twoBoneIK(upper, lower, hand, target, pole, w) {
  if (w <= 0.001) return;
  upper.getWorldPosition(_a); lower.getWorldPosition(_b); hand.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
  _t.copy(target).sub(_a);
  const dist = Math.min(Math.max(_t.length(), 0.05), l1 + l2 - 0.002);
  _t.normalize();
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  _p.copy(pole).sub(_a); _p.addScaledVector(_t, -_p.dot(_t)).normalize();
  _e.copy(_a).addScaledVector(_t, l1 * cosA).addScaledVector(_p, l1 * sinA);
  rotateBoneWorld(upper, _b.clone().sub(_a), _e.clone().sub(_a), w);
  upper.updateMatrixWorld(true);
  lower.getWorldPosition(_b); hand.getWorldPosition(_c);
  const tgt = _a.clone().addScaledVector(_t, dist);
  rotateBoneWorld(lower, _c.clone().sub(_b), tgt.sub(_b), w);
  lower.updateMatrixWorld(true);
}
